/**
 * Main App Component for AI Aimly Pro
 * Handles routing with React Router and server health monitoring
 */

import React, { useState, useEffect, useContext, createContext, useCallback } from 'react';
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

type AppState = 'loading' | 'server-down' | 'ready';

// ── Constants ─────────────────────────────────────────────
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

// ── Auth storage helpers ──────────────────────────────────
// Only store non-sensitive user info (username, user_id) for UI display.
// JWT tokens are now stored in HttpOnly cookies managed by the backend.

const saveUser = (user: User): void => {
  localStorage.setItem('user', JSON.stringify(user));
};

const clearAuthData = (): void => {
  localStorage.removeItem('user');
};

// ── apiFetch — drop-in fetch replacement ─────────────────
// Cookies are sent automatically with every request (credentials: 'include').
// On 401, attempts a token refresh via the backend, then retries once.
// If refresh also fails, forces logout.
let _forceLogoutCallback: (() => void) | null = null;

export const apiFetch = async (input: RequestInfo, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(input, { ...init, headers, credentials: 'include' });

  // 401 received — attempt refresh then retry once
  if (response.status === 401) {
    console.log('Received 401, attempting token refresh...');
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshRes.ok) {
        // Retry original request — new access_token cookie is now set
        response = await fetch(input, { ...init, headers, credentials: 'include' });
      } else {
        // Refresh failed — backend already cleared cookies, clear localStorage too
        console.warn('Token refresh failed, forcing logout.');
        clearAuthData();
        _forceLogoutCallback?.();
        throw new Error('Session expired. Please log in again.');
      }
    } catch (e) {
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

  // Single auth check on mount — validate cookie session with backend
  useEffect(() => {
    const initialize = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/validate/`, { credentials: 'include' });
        if (res.ok) {
          const raw = localStorage.getItem('user');
          if (raw) setUser(JSON.parse(raw));
        } else {
          clearAuthData();
        }
      } catch {
        clearAuthData();
      }
      setAuthReady(true);
    };
    initialize();
  }, []);

  const login = useCallback((userData: User) => {
    saveUser(userData);
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

  // After login: redirect back to the page the user was trying to reach
  const handleLoginSuccess = (userData: User) => {
    login(userData);
    const intendedPath = (location.state as { from?: string })?.from;
    navigate(intendedPath && intendedPath !== '/auth' ? intendedPath : '/campaigns', { replace: true });
  };

  const handleLogout = async () => {
    try {
      // Clear API key cookies on backend before clearing local state
      // so the next user on the same browser doesn't inherit them
      await apiFetch(`${API_BASE}/auth/logout/`, { method: 'POST' });
    } catch {
      // Ignore errors — still proceed with local logout
    }
    logout();
    setShowSettings(false);
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