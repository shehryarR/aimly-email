/**
 * Main App Component for AI Aimly Pro
 * Handles routing with React Router and server health monitoring
 */

import React, { useState, useEffect, useContext, createContext, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ThemeProvider } from './theme/styles';
import Navbar from './template/navbar';
import Footer from './template/footer';
import Settings from './template/settings';
import Auth from './pages/auth';
import Campaigns from './pages/campaigns/Campaigns';
import Campaign from './pages/campaign/Campaign';
import EmailHistory from './pages/emailHistory/emailHistory';
import Companies from './pages/companies/Companies';
import Attachments from './pages/attachments/Attachments';
import Categories from './pages/categories/Categories';
import ServerDown from './pages/warnings/ServerDown';
import { performHealthChecks, healthMonitor } from './utils/healthCheck';

// ── Types ─────────────────────────────────────────────────
interface User {
  username: string;
  user_id: number;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

type AppState = 'loading' | 'server-down' | 'ready';

// ── Constants ─────────────────────────────────────────────
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

// ── Auth storage helpers ──────────────────────────────────
const getStoredTokens = (): AuthTokens | null => {
  try {
    const raw = localStorage.getItem('auth_tokens');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.access_token && parsed.refresh_token ? parsed : null;
  } catch {
    return null;
  }
};

const saveTokens = (tokens: AuthTokens): void => {
  localStorage.setItem('auth_tokens', JSON.stringify(tokens));
};

const clearAuthData = (): void => {
  localStorage.removeItem('auth_tokens');
  localStorage.removeItem('user');
};

// ── JWT decode (no library needed — just base64) ──────────
const decodeJwtExpiry = (token: string): number | null => {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.exp ?? null;
  } catch {
    return null;
  }
};

const isTokenExpired = (token: string): boolean => {
  const exp = decodeJwtExpiry(token);
  if (exp === null) return true;
  // 10-second buffer so we refresh slightly before actual expiry
  return Date.now() / 1000 >= exp - 10;
};

// ── Token refresh ─────────────────────────────────────────
// Returns new tokens on success, null if refresh token is also expired/invalid
const attemptTokenRefresh = async (refreshToken: string): Promise<AuthTokens | null> => {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.access_token || !data.refresh_token) return null;
    const newTokens: AuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type ?? 'bearer',
    };
    saveTokens(newTokens);
    return newTokens;
  } catch {
    return null;
  }
};

// ── Core auth check (used by AuthContext on mount) ────────
// Returns valid access token string, or null if fully unauthenticated
const resolveValidAccessToken = async (): Promise<string | null> => {
  const tokens = getStoredTokens();
  if (!tokens) return null;

  // Access token still valid — use it directly
  if (!isTokenExpired(tokens.access_token)) {
    return tokens.access_token;
  }

  // Access token expired — try refreshing
  console.log('Access token expired, attempting refresh...');
  if (isTokenExpired(tokens.refresh_token)) {
    // Refresh token also expired — full logout
    console.warn('Refresh token also expired, clearing session.');
    clearAuthData();
    return null;
  }

  const newTokens = await attemptTokenRefresh(tokens.refresh_token);
  if (!newTokens) {
    console.warn('Refresh failed, clearing session.');
    clearAuthData();
    return null;
  }

  console.log('Token refreshed successfully.');
  return newTokens.access_token;
};

// ── apiFetch — drop-in fetch replacement ─────────────────
// Automatically attaches Bearer token, refreshes on 401, force-logs out
// if refresh also fails. Components import and use this instead of fetch().
// The onForceLogout callback is wired up by AuthContext below.
let _forceLogoutCallback: (() => void) | null = null;

export const apiFetch = async (input: RequestInfo, init: RequestInit = {}): Promise<Response> => {
  let tokens = getStoredTokens();

  // Proactively refresh if access token is about to expire
  if (tokens && isTokenExpired(tokens.access_token)) {
    if (!isTokenExpired(tokens.refresh_token)) {
      const newTokens = await attemptTokenRefresh(tokens.refresh_token);
      if (newTokens) {
        tokens = newTokens;
      } else {
        clearAuthData();
        _forceLogoutCallback?.();
        throw new Error('Session expired. Please log in again.');
      }
    } else {
      clearAuthData();
      _forceLogoutCallback?.();
      throw new Error('Session expired. Please log in again.');
    }
  }

  // Attach auth header
  const headers = new Headers(init.headers);
  if (tokens?.access_token) {
    headers.set('Authorization', `Bearer ${tokens.access_token}`);
  }
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(input, { ...init, headers, credentials: 'include' });

  // 401 received — try one refresh then retry
  if (response.status === 401 && tokens?.refresh_token) {
    console.log('Received 401, attempting token refresh...');
    const refreshedTokens = isTokenExpired(tokens.refresh_token)
      ? null
      : await attemptTokenRefresh(tokens.refresh_token);

    if (refreshedTokens) {
      headers.set('Authorization', `Bearer ${refreshedTokens.access_token}`);
      response = await fetch(input, { ...init, headers, credentials: 'include' });
    } else {
      // Refresh token expired or invalid — force logout
      console.warn('Token refresh failed on 401, forcing logout.');
      clearAuthData();
      _forceLogoutCallback?.();
      throw new Error('Session expired. Please log in again.');
    }
  }

  return response;
};

// ── Auth Context ──────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  authReady: boolean;           // true once the initial auth check is done
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  authReady: false,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode; onLogout: () => void }> = ({ children, onLogout }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Wire up the force-logout callback for apiFetch
  const logout = useCallback(() => {
    clearAuthData();
    setUser(null);
    onLogout();
  }, [onLogout]);

  useEffect(() => {
    _forceLogoutCallback = logout;
    return () => { _forceLogoutCallback = null; };
  }, [logout]);

  // Single auth check on mount
  useEffect(() => {
    const initialize = async () => {
      const validToken = await resolveValidAccessToken();
      if (validToken) {
        try {
          const raw = localStorage.getItem('user');
          if (raw) setUser(JSON.parse(raw));
        } catch {
          clearAuthData();
        }
      }
      setAuthReady(true);
    };
    initialize();
  }, []);

  const login = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      authReady,
      isAuthenticated: !!user,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Spinner ───────────────────────────────────────────────
const Spinner: React.FC = () => (
  <div style={{
    minHeight: '60vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  }}>
    <div style={{
      width: '32px', height: '32px',
      border: '3px solid #e2e8f0', borderTop: '3px solid #3b82f6',
      borderRadius: '50%', animation: 'spin 1s linear infinite',
    }} />
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── Route Guards ──────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authReady, isAuthenticated } = useAuth();
  const location = useLocation();
  if (!authReady) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authReady, isAuthenticated } = useAuth();
  if (!authReady) return <Spinner />;
  if (isAuthenticated) return <Navigate to="/campaigns" replace />;
  return <>{children}</>;
};

// ── Smart Redirect ────────────────────────────────────────
const SmartRedirect: React.FC = () => {
  const { authReady, isAuthenticated } = useAuth();
  if (!authReady) return <Spinner />;
  return <Navigate to={isAuthenticated ? '/campaigns' : '/auth'} replace />;
};

// ── Campaign Wrapper ──────────────────────────────────────
const CampaignWrapper: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { campaignId } = useParams<{ campaignId: string }>();
  if (!campaignId) return <Navigate to="/campaigns" replace />;
  return <Campaign campaignId={parseInt(campaignId, 10)} onBack={onBack} />;
};

// ── Main Router ────────────────────────────────────────────
const AppRouter: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('loading');
  const [showSettings, setShowSettings] = useState(false);
  const [hasSettingsErrors, setHasSettingsErrors] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, logout } = useAuth();

  // Initial server health check
  useEffect(() => {
    const initializeApp = async () => {
      console.log('Performing initial server health check...');
      try {
        const healthResult = await performHealthChecks(3, 1000);
        if (healthResult.isHealthy) {
          console.log('Server is healthy, initializing app...');
          setAppState('ready');
        } else {
          console.warn('Server health check failed:', healthResult.error);
          setAppState('server-down');
        }
      } catch (error) {
        console.error('Critical error during app initialization:', error);
        setAppState('server-down');
      }
    };
    initializeApp();
  }, []);

  // Start health monitoring once app is ready
  useEffect(() => {
    if (appState === 'ready') {
      console.log('Starting health monitor...');
      healthMonitor.start((isHealthy, result) => {
        if (!isHealthy) {
          console.warn('Server became unhealthy during operation:', result.error);
          setAppState('server-down');
        }
      });
      return () => { healthMonitor.stop(); };
    }
  }, [appState]);

  const handleSettingsStatus = (hasErrors: boolean) => setHasSettingsErrors(hasErrors);

  // After login: redirect back to the page the user was trying to reach
  const handleLoginSuccess = (userData: User) => {
    login(userData);
    const intendedPath = (location.state as { from?: string })?.from;
    navigate(intendedPath && intendedPath !== '/auth' ? intendedPath : '/campaigns', { replace: true });
  };

  const handleLogout = () => {
    logout();
    setShowSettings(false);
    setHasSettingsErrors(null);
    navigate('/auth');
  };

  const handleCampaignClick = (campaignId: number) => navigate(`/campaign/${campaignId}`);
  const handleBackToCampaigns = () => navigate('/campaigns');

  const handleServerHealthRetry = async () => {
    console.log('User requested server health retry...');
    try {
      const healthResult = await performHealthChecks(3, 1000);
      if (healthResult.isHealthy) {
        console.log('Server is now healthy, returning to app...');
        setAppState('ready');
        healthMonitor.start((isHealthy, result) => {
          if (!isHealthy) {
            console.warn('Server became unhealthy again:', result.error);
            setAppState('server-down');
          }
        });
      } else {
        console.warn('Server is still unhealthy:', healthResult.error);
        throw new Error(healthResult.error || 'Server health check failed');
      }
    } catch (error) {
      console.error('Health retry failed:', error);
      throw error;
    }
  };

  const getPageTitle = (): string => {
    const path = location.pathname;
    if (path === '/campaigns')        return 'Dashboard';
    if (path === '/companies')        return 'Companies';
    if (path === '/attachments')      return 'Attachments';
    if (path === '/categories')       return 'Categories';
    if (path.startsWith('/campaign/') && path.endsWith('/history')) return 'Campaign Email History';
    if (path.startsWith('/campaign/')) return 'Campaign Management';
    if (path.startsWith('/company/') && path.endsWith('/history'))  return 'Company Email History';
    return '';
  };

  // Loading screen
  if (appState === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#f8fafc', color: '#64748b',
      }}>
        <div style={{
          width: '40px', height: '40px',
          border: '4px solid #e2e8f0', borderTop: '4px solid #3b82f6',
          borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem',
        }} />
        <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>Connecting to server...</div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (appState === 'server-down') {
    return <ServerDown onRetry={handleServerHealthRetry} />;
  }

  const isAuthPage = location.pathname === '/auth';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        pageTitle={!isAuthPage ? getPageTitle() : ''}
        user={user ? { username: user.username } : undefined}
        onSettingsClick={() => setShowSettings(true)}
        onThemeToggle={() => { console.log('Theme toggled'); }}
        isAuthPage={isAuthPage}
      />

      {user && (
        <Settings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          user={{ username: user.username }}
          onLogout={handleLogout}
          onSettingsStatus={handleSettingsStatus}
        />
      )}

      <main style={{ flex: 1 }}>
        <Routes>
          <Route
            path="/auth"
            element={
              <PublicRoute>
                <Auth onLoginSuccess={handleLoginSuccess} />
              </PublicRoute>
            }
          />

          <Route
            path="/companies"
            element={
              <ProtectedRoute>
                <Companies />
              </ProtectedRoute>
            }
          />

          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <Categories />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <EmailHistory />
              </ProtectedRoute>
            }
          />

          <Route
            path="/campaigns"
            element={
              <ProtectedRoute>
                <Campaigns onCampaignClick={handleCampaignClick} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/campaign/:campaignId"
            element={
              <ProtectedRoute>
                <CampaignWrapper onBack={handleBackToCampaigns} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/attachments"
            element={
              <ProtectedRoute>
                <Attachments />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<SmartRedirect />} />
          <Route path="*" element={<SmartRedirect />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
};

// ── Auth-aware wrapper so AppRouter can use useAuth() ─────
const AppRouterWithAuth: React.FC = () => {
  const navigate = useNavigate();

  const handleForceLogout = useCallback(() => {
    navigate('/auth', { replace: true });
  }, [navigate]);

  return (
    <AuthProvider onLogout={handleForceLogout}>
      <AppRouter />
    </AuthProvider>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <ThemeProvider>
      <AppRouterWithAuth />
    </ThemeProvider>
  </BrowserRouter>
);

export default App;