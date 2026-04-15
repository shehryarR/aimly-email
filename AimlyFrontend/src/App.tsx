/**
 * Main App Component for AI Aimly Pro
 * Handles routing with React Router and server health monitoring
 */

import React, { useState, useEffect, useContext, createContext, useCallback } from 'react';
import { createGlobalStyle } from 'styled-components';
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
import Paywall from './pages/subscription/Paywall';
import LandingPage from './pages/landing/LandingPage';
import TermsOfService from './pages/legal/TermsOfService';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import RefundPolicy from './pages/legal/RefundPolicy';
import PricingPage from './pages/pricing/PricingPage';
import { performHealthChecks, healthMonitor } from './utils/healthCheck';


// Hide reCAPTCHA badge — disclosure text shown on auth page per Google ToS
const GlobalStyle = createGlobalStyle`
  .grecaptcha-badge {
    visibility: hidden !important;
  }
`;

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
const PADDLE_ENABLED = import.meta.env.VITE_PADDLE_ENABLED !== 'false';

// ── Auth storage helpers ──────────────────────────────────
const saveUser = (user: User): void => {
  localStorage.setItem('user', JSON.stringify(user));
};

const clearAuthData = (): void => {
  localStorage.removeItem('user');
};

// ── apiFetch ──────────────────────────────────────────────
let _forceLogoutCallback: (() => void) | null = null;

export const apiFetch = async (input: RequestInfo, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(input, { ...init, headers, credentials: 'include' });

  if (response.status === 401) {
    console.log('Received 401, attempting token refresh...');
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshRes.ok) {
        response = await fetch(input, { ...init, headers, credentials: 'include' });
      } else {
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
  authReady: boolean;
  isAuthenticated: boolean;
  hasSubscription: boolean;
  subscriptionStatus: string;
  subscriptionLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  authReady: false,
  isAuthenticated: false,
  hasSubscription: false,
  subscriptionStatus: 'inactive',
  subscriptionLoading: true,
  login: () => {},
  logout: () => {},
  refreshSubscription: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode; onLogout: () => void }> = ({ children, onLogout }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive');
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const logout = useCallback(() => {
    clearAuthData();
    setUser(null);
    setHasSubscription(false);
    setSubscriptionStatus('inactive');
    onLogout();
  }, [onLogout]);

  useEffect(() => {
    _forceLogoutCallback = logout;
    return () => { _forceLogoutCallback = null; };
  }, [logout]);

  const refreshSubscription = useCallback(async () => {
    // Paddle disabled — grant access immediately, no backend call needed
    if (!PADDLE_ENABLED) {
      setSubscriptionStatus('active');
      setHasSubscription(true);
      setSubscriptionLoading(false);
      return;
    }
    setSubscriptionLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/subscription/status`);
      if (res.ok) {
        const data = await res.json();
        setSubscriptionStatus(data.status || 'inactive');
        setHasSubscription(data.has_access === true);
      } else {
        setSubscriptionStatus('inactive');
        setHasSubscription(false);
      }
    } catch {
      setSubscriptionStatus('inactive');
      setHasSubscription(false);
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/validate/`, { credentials: 'include' });
        if (res.ok) {
          const raw = localStorage.getItem('user');
          if (raw) {
            setUser(JSON.parse(raw));
            await refreshSubscription();
          } else {
            setSubscriptionLoading(false);
          }
        } else {
          clearAuthData();
          setSubscriptionLoading(false);
        }
      } catch {
        clearAuthData();
        setSubscriptionLoading(false);
      }
      setAuthReady(true);
    };
    initialize();
  }, [refreshSubscription]);

  const login = useCallback((userData: User) => {
    saveUser(userData);
    setUser(userData);
    refreshSubscription();
  }, [refreshSubscription]);

  return (
    <AuthContext.Provider value={{
      user,
      authReady,
      isAuthenticated: !!user,
      hasSubscription,
      subscriptionStatus,
      subscriptionLoading,
      login,
      logout,
      refreshSubscription,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Spinner ───────────────────────────────────────────────
const Spinner: React.FC = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

// ── Subscription Guard ────────────────────────────────────
// Sits inside ProtectedRoute — user is already authenticated here.
// Shows Paywall if subscription is inactive/missing.
const SubscriptionRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasSubscription, subscriptionLoading } = useAuth();
  if (subscriptionLoading) return <Spinner />;
  if (!hasSubscription) return <Paywall />;
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
  const { user, login, logout, hasSubscription } = useAuth();

  useEffect(() => {
    const initializeApp = async () => {
      console.log('Performing initial server health check...');
      try {
        const healthResult = await performHealthChecks(3, 1000);
        if (healthResult.isHealthy) {
          setAppState('ready');
        } else {
          setAppState('server-down');
        }
      } catch (error) {
        setAppState('server-down');
      }
    };
    initializeApp();
  }, []);

  useEffect(() => {
    if (appState === 'ready') {
      healthMonitor.start((isHealthy, result) => {
        if (!isHealthy) setAppState('server-down');
      });
      return () => { healthMonitor.stop(); };
    }
  }, [appState]);

  const handleLoginSuccess = (userData: User) => {
    login(userData);
    const intendedPath = (location.state as { from?: string })?.from;
    navigate(intendedPath && intendedPath !== '/auth' ? intendedPath : '/campaigns', { replace: true });
  };

  const handleLogout = async () => {
    try {
      await apiFetch(`${API_BASE}/auth/logout/`, { method: 'POST' });
    } catch { }
    logout();
    setShowSettings(false);
    navigate('/auth');
  };

  const handleCampaignClick = (campaignId: number) => navigate(`/campaign/${campaignId}`);
  const handleBackToCampaigns = () => navigate('/campaigns');

  const handleServerHealthRetry = async () => {
    try {
      const healthResult = await performHealthChecks(3, 1000);
      if (healthResult.isHealthy) {
        setAppState('ready');
        healthMonitor.start((isHealthy) => {
          if (!isHealthy) setAppState('server-down');
        });
      } else {
        throw new Error(healthResult.error || 'Server health check failed');
      }
    } catch (error) {
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
  const isLandingPage = ['/', '/pricing', '/terms', '/privacy', '/refunds'].includes(location.pathname);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isLandingPage && (
        <Navbar
          pageTitle={!isAuthPage ? getPageTitle() : ''}
          user={user ? { username: user.username } : undefined}
          onSettingsClick={() => setShowSettings(true)}
          onThemeToggle={() => { console.log('Theme toggled'); }}
          onLogout={handleLogout}
          isAuthPage={isAuthPage}
          hasSubscription={hasSubscription}
        />
      )}

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
                <SubscriptionRoute>
                  <Companies />
                </SubscriptionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <SubscriptionRoute>
                  <Categories />
                </SubscriptionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <SubscriptionRoute>
                  <EmailHistory />
                </SubscriptionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/campaigns"
            element={
              <ProtectedRoute>
                <SubscriptionRoute>
                  <Campaigns onCampaignClick={handleCampaignClick} />
                </SubscriptionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/campaign/:campaignId"
            element={
              <ProtectedRoute>
                <SubscriptionRoute>
                  <CampaignWrapper onBack={handleBackToCampaigns} />
                </SubscriptionRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/attachments"
            element={
              <ProtectedRoute>
                <SubscriptionRoute>
                  <Attachments />
                </SubscriptionRoute>
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/refunds" element={<RefundPolicy />} />
          <Route path="*" element={<SmartRedirect />} />
        </Routes>
      </main>

      {!isLandingPage && <Footer />}
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
      <GlobalStyle />
      <AppRouterWithAuth />
    </ThemeProvider>
  </BrowserRouter>
);

export default App;