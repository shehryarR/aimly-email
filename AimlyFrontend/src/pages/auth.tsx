/**
 * Authentication Page Component for AI Aimly Pro
 * Handles login and registration with backend integration
 */

import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import styled from 'styled-components';
import { useTheme } from '../theme/styles';
import { EyeIcon, EyeOffIcon } from '../theme/icons';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
// Styled Components using theme
const AuthContainer = styled.div<{ theme: any }>`
  min-height: 100vh;
  background-color: ${props => props.theme.colors.base[100]};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;

  @media (max-width: 480px) {
    align-items: flex-start;
    padding: 1rem 0.75rem 2rem;
  }
`;

const AuthCard = styled.div<{ theme: any }>`
  background-color: ${props => props.theme.colors.base[200]};
  border: 1px solid ${props => props.theme.colors.base[300]};
  border-radius: ${props => props.theme.radius.box};
  color: ${props => props.theme.colors.base.content};
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);

  @media (max-width: 480px) {
    padding: 1.5rem 1.25rem;
    border-radius: ${props => props.theme.radius.box};
  }

  @media (max-width: 360px) {
    padding: 1.25rem 1rem;
  }
`;


const AuthSubtitle = styled.p<{ theme: any }>`
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  text-transform: none; // important: allow normal capitalization
  opacity: 0.7;
  text-align: center;
  margin: 0 0 1.5rem 0;
  font-weight: 500;
  color: ${props => props.theme.colors.primary.main};
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 2rem;
`;

const Tab = styled.button<{ theme: any; isActive: boolean }>`
  flex: 1;
  padding: 0.75rem;
  border: none;
  background: ${props => props.isActive ? props.theme.colors.primary.main : props.theme.colors.base[400]};
  color: ${props => props.isActive ? props.theme.colors.primary.content : props.theme.colors.base.content};
  border-radius: ${props => props.theme.radius.field};
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;

  &:hover {
    opacity: 0.8;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Input = styled.input<{ theme: any }>`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid ${props => props.theme.colors.base[300]};
  border-radius: ${props => props.theme.radius.field};
  background-color: ${props => props.theme.colors.base[400]};
  color: ${props => props.theme.colors.base.content};
  font-size: 1rem;
  transition: all 0.2s ease;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary.main};
    background-color: ${props => props.theme.colors.base[400]};
  }

  &::placeholder {
    color: ${props => props.theme.colors.base.content};
    opacity: 0.6;
  }

  @media (max-width: 360px) {
    font-size: 0.9375rem;
    padding: 0.675rem 0.875rem;
  }
`;

const PasswordInputWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const TogglePasswordButton = styled.button<{ theme: any }>`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: ${props => props.theme.colors.base.content};
  opacity: 0.6;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;

  &:hover {
    opacity: 1;
  }
  
  &:focus {
    outline: none;
  }
`;



const Button = styled.button<{ theme: any; variant?: 'primary' | 'secondary' }>`
  width: 100%;
  padding: 0.75rem 1.5rem;
  border-radius: ${props => props.theme.radius.field};
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 0.5rem;
  
  ${props => props.variant === 'secondary' ? `
    background-color: ${props.theme.colors.secondary.main};
    color: ${props.theme.colors.secondary.content};
  ` : `
    background-color: ${props.theme.colors.primary.main};
    color: ${props.theme.colors.primary.content};
  `}

  &:hover {
    opacity: 0.8;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
  cursor: pointer;
`;

const Checkbox = styled.div<{ theme: any; $checked: boolean }>`
  width: 16px;
  height: 16px;
  min-width: 16px;
  border-radius: 3px;
  border: 2px solid ${props => props.$checked ? props.theme.colors.primary.main : props.theme.colors.base[400]};
  background-color: ${props => props.$checked ? props.theme.colors.primary.main : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${props => props.theme.colors.primary.main};
  }

  &:after {
    content: '';
    display: ${props => props.$checked ? 'block' : 'none'};
    width: 3px;
    height: 6px;
    border: solid ${props => props.theme.colors.primary.content};
    border-width: 0 2px 2px 0;
    transform: rotate(45deg) translate(-1px, -1px);
  }
`;

const CheckboxLabel = styled.label<{ theme: any }>`
  color: ${props => props.theme.colors.base.content};
  font-size: 0.875rem;
  cursor: pointer;
`;

const ValidationMessage = styled.div<{ theme: any; type: 'success' | 'error' | 'neutral' }>`
  padding: 0.5rem 0.75rem;
  border-radius: ${props => props.theme.radius.field};
  font-size: 0.875rem;
  font-weight: 500;
  margin-top: 0.5rem;
  
  ${props => {
    switch (props.type) {
      case 'success':
        return `
          color: ${props.theme.colors.success.main};
          background-color: ${props.theme.colors.base[100]};
          border: 1px solid ${props.theme.colors.success.main};
        `;
      case 'error':
        return `
          color: ${props.theme.colors.error.main};
          background-color: ${props.theme.colors.base[100]};
          border: 1px solid ${props.theme.colors.error.main};
        `;
      default:
        return `
          color: ${props.theme.colors.base.content};
          opacity: 0.8;
          background-color: ${props.theme.colors.base[100]};
          border: 1px solid ${props.theme.colors.base[300]};
        `;
    }
  }}
`;

const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  color: white;
  font-size: 1.2rem;
`;

const ForgotPasswordContainer = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  margin-top: 0.25rem;
`;

const ForgotPasswordButton = styled.button<{ theme: any; $disabled: boolean }>`
  background: none;
  border: none;
  color: ${props => props.$disabled ? props.theme.colors.base.content : props.theme.colors.primary.main};
  opacity: ${props => props.$disabled ? 0.4 : 1};
  font-size: 0.875rem;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  text-decoration: underline;
  padding: 0.25rem 0.5rem;
  border-radius: ${props => props.theme.radius.field};
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    opacity: 0.8;
  }

  &:focus {
    outline: none;
  }
`;

const GoogleButton = styled.button<{ theme: any }>`
  width: 100%;
  padding: 0.7rem 1.5rem;
  border-radius: ${props => props.theme.radius.field};
  font-weight: 600;
  border: 1.5px solid ${props => props.theme.colors.base[300]};
  background-color: ${props => props.theme.colors.base[200]};
  color: ${props => props.theme.colors.base.content};
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  font-size: 0.9rem;
  letter-spacing: 0.01em;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);

  &:hover {
    background-color: ${props => props.theme.colors.base[300]};
    border-color: ${props => props.theme.colors.primary.main};
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const OrDivider = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 0.4rem 0 0.4rem 0;
  color: ${props => props.theme.colors.base.content};
  opacity: 0.35;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;

  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${props => props.theme.colors.base[300]};
  }
`;


interface AuthProps {
  onLoginSuccess?: (user: { username: string; user_id: number }) => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;

// Use port only if defined and not empty
const API_BASE = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;


const RecaptchaDisclosure = styled.p<{ theme: any }>`
  font-size: 0.7rem;
  text-align: center;
  opacity: 0.35;
  margin: 1.25rem 0 0 0;
  line-height: 1.6;
  color: \${props => props.theme.colors.base.content};
  a {
    color: inherit;
    text-decoration: underline;
    &:hover { opacity: 0.7; }
  }
`;

const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const { theme } = useTheme();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [searchParams] = useSearchParams();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(
    searchParams.get('tab') === 'register' ? 'register' : 'login'
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'neutral'; text: string } | null>(null);
  
  // Password visibility state
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Forgot password state
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  
  // Login form state — "identifier" accepts username or email
  const [loginData, setLoginData] = useState({
    identifier: '',
    password: '',
    keep_me_logged_in: true, // Updated field name to match backend
  });

  // Registration form state
  const [registerData, setRegisterData] = useState({
    username: '',
    email: '',
    password: '',
    confirm_password: '', // Updated field name to match backend
  });

  // Password validation state
  const [passwordValidation, setPasswordValidation] = useState({
    message: 'Password must contain: uppercase, lowercase, number, special character (8+ chars)',
    type: 'neutral' as 'success' | 'error' | 'neutral',
  });

  // Password match validation state
  const [matchValidation, setMatchValidation] = useState({
    message: '',
    type: 'neutral' as 'success' | 'error' | 'neutral',
  });

  // ── Google OAuth callback handler (runs on page load if ?code= is in URL) ──
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Remove code from URL immediately so it can't be reused on refresh
    window.history.replaceState({}, document.title, window.location.pathname);

    const handleGoogleCallback = async () => {
      setLoading(true);
      setMessage({ type: 'neutral', text: 'Signing in with Google...' });
      try {
        const response = await fetch(`${API_BASE}/auth/google/callback/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || 'Google sign-in failed. Please try again.');
        }

        // Tokens are set as HttpOnly cookies by the backend automatically.
        // We only store non-sensitive user info for UI display.
        const user = { username: data.username, user_id: data.user_id };
        localStorage.setItem('user', JSON.stringify(user));

        onLoginSuccess?.({ username: data.username, user_id: data.user_id });
      } catch (error) {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Google sign-in failed. Please try again.',
        });
      } finally {
        setLoading(false);
      }
    };

    handleGoogleCallback();
  }, []);

  // ── Google OAuth initiation ────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/auth/google/`);
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error('Failed to initiate Google sign-in. Please try again.');
      }
      window.location.href = data.url;
    } catch (error) {
      setLoading(false);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Google sign-in failed. Please try again.',
      });
    }
  };

  // Clear messages when switching tabs
  const handleTabSwitch = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setMessage(null);
    setPasswordValidation({
      message: 'Password must contain: uppercase, lowercase, number, special character (8+ chars)',
      type: 'neutral',
    });
    setMatchValidation({ message: '', type: 'neutral' });
  };

  // Password validation function
  const validatePassword = (password: string) => {
    if (!password) {
      setPasswordValidation({
        message: 'Password must contain: uppercase, lowercase, number, special character (8+ chars)',
        type: 'neutral',
      });
      return false;
    }

    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};:"\\|,.<>?]/.test(password),
    };

    const isValid = Object.values(checks).every(Boolean);

    if (isValid) {
      setPasswordValidation({
        message: 'Password meets requirements ✅',
        type: 'success',
      });
    } else {
      const missing = [];
      if (!checks.length) missing.push('8+ characters');
      if (!checks.uppercase) missing.push('uppercase letter');
      if (!checks.lowercase) missing.push('lowercase letter');
      if (!checks.number) missing.push('number');
      if (!checks.special) missing.push('special character');

      setPasswordValidation({
        message: `Password needs: ${missing.join(', ')}`,
        type: 'error',
      });
    }

    return isValid;
  };

  // Check password match
  const validateMatch = (pass: string, confirm: string) => {
    if (!confirm) {
      setMatchValidation({ message: '', type: 'neutral' });
      return;
    }
    
    if (pass === confirm) {
      setMatchValidation({ message: 'Passwords match ✅', type: 'success' });
    } else {
      setMatchValidation({ message: 'Passwords do not match ❌', type: 'error' });
    }
  };

  // Email validation utility
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // Forgot password handler
  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail || !isValidEmail(forgotPasswordEmail)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    if (!executeRecaptcha) {
      setMessage({ type: 'error', text: 'reCAPTCHA not ready. Please try again.' });
      return;
    }

    setForgotPasswordLoading(true);
    setMessage(null);

    try {
      const captchaToken = await executeRecaptcha('forgot_password');

      const response = await fetch(`${API_BASE}/auth/forget_password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: forgotPasswordEmail,
          captcha_token: captchaToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle different error cases
        if (response.status === 404) {
          throw new Error('Email address not found in our system');
        } else if (response.status === 500) {
          throw new Error(errorData.detail || 'Server error. Please try again later');
        } else {
          throw new Error(errorData.detail || 'Failed to send reset email');
        }
      }

      const data = await response.json();
      setMessage({
        type: 'success',
        text: data.message || 'A new password has been sent to your email address',
      });

      // Reset the forgot password email field on success
      setForgotPasswordEmail('');

    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send reset email. Please try again.',
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginData.identifier || !loginData.password) {
      setMessage({ type: 'error', text: 'Username/email and password are required' });
      return;
    }

    if (!executeRecaptcha) {
      setMessage({ type: 'error', text: 'reCAPTCHA not ready. Please try again.' });
      return;
    }
    
    setLoading(true);
    setMessage(null);

    try {
      const captchaToken = await executeRecaptcha('login');

      const response = await fetch(`${API_BASE}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          identifier: loginData.identifier,
          password: loginData.password,
          keep_me_logged_in: loginData.keep_me_logged_in,
          captcha_token: captchaToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();

      // Tokens are set as HttpOnly cookies by the backend automatically.
      // We only store non-sensitive user info for UI display.
      const user = {
        username: data.username,
        user_id:  data.user_id,
      };
      localStorage.setItem('user', JSON.stringify(user));

      // Notify parent component
      onLoginSuccess?.(user);

    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Login failed. Please check your credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Registration handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate first, then show consent modal before proceeding
    if (!registerData.username || !registerData.email || !registerData.password || !registerData.confirm_password) {
      setMessage({ type: 'error', text: 'All fields are required' });
      return;
    }
    if (!validatePassword(registerData.password)) {
      setMessage({ type: 'error', text: 'Password does not meet requirements' });
      return;
    }
    if (registerData.password !== registerData.confirm_password) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    // Show consent modal — actual registration runs in handleConsentAccept
    setShowConsentModal(true);
    return;
  };

  const handleConsentAccept = async () => {
    setShowConsentModal(false);
    
    if (!executeRecaptcha) {
      setMessage({ type: 'error', text: 'reCAPTCHA not ready. Please try again.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Execute reCAPTCHA v3 silently — no user interaction needed
      const captchaToken = await executeRecaptcha('register');

      const response = await fetch(`${API_BASE}/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: registerData.username,
          email: registerData.email,
          password: registerData.password,
          confirm_password: registerData.confirm_password,
          captcha_token: captchaToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      setMessage({
        type: 'success',
        text: 'Registration successful! Please login.',
      });

      // Reset form
      setRegisterData({ username: '', email: '', password: '', confirm_password: '' });
      setPasswordValidation({
        message: 'Password must contain: uppercase, lowercase, number, special character (8+ chars)',
        type: 'neutral',
      });
      setMatchValidation({ message: '', type: 'neutral' });

      // Switch to login tab after a delay
      setTimeout(() => {
        setActiveTab('login');
        setMessage(null);
      }, 2000);

    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Registration failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (value: string) => {
    setRegisterData(prev => ({ ...prev, password: value }));
    validatePassword(value);
    if (registerData.confirm_password) {
      validateMatch(value, registerData.confirm_password);
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setRegisterData(prev => ({ ...prev, confirm_password: value }));
    validateMatch(registerData.password, value);
  };

  return (
    <>
      <AuthContainer theme={theme}>
        <AuthCard theme={theme}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <img src="/favicon.png" alt="Aimly" style={{ height: '44px', width: 'auto' }} />
          </div>
        <AuthSubtitle theme={theme}>
          <span style={{ fontWeight: 600 }}>Aimly Email</span>: email the AI way
        </AuthSubtitle>
          
          <TabContainer>
            <Tab 
              theme={theme}
              isActive={activeTab === 'login'}
              onClick={() => handleTabSwitch('login')}
              type="button"
            >
              Login
            </Tab>
            <Tab 
              theme={theme}
              isActive={activeTab === 'register'}
              onClick={() => handleTabSwitch('register')}
              type="button"
            >
              Register
            </Tab>
          </TabContainer>

          {/* Global message */}
          {message && (
            <ValidationMessage theme={theme} type={message.type}>
              {message.text}
            </ValidationMessage>
          )}

          {activeTab === 'login' ? (
            <Form onSubmit={handleLoginSubmit}>
              <Input
                theme={theme}
                type="text"
                placeholder="Enter username or email"
                value={loginData.identifier}
                onChange={(e) => {
                  const value = e.target.value;
                  setLoginData(prev => ({ ...prev, identifier: value }));
                  // Update forgot password email if it looks like an email
                  if (isValidEmail(value)) {
                    setForgotPasswordEmail(value);
                  } else {
                    setForgotPasswordEmail('');
                  }
                }}
                required
              />
              
              <PasswordInputWrapper>
                <Input
                  theme={theme}
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={loginData.password}
                  onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
                <TogglePasswordButton 
                  theme={theme} 
                  type="button" 
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                >
                  {showLoginPassword ? <EyeOffIcon /> : <EyeIcon />}
                </TogglePasswordButton>
              </PasswordInputWrapper>
              
              <CheckboxContainer onClick={() => setLoginData(prev => ({ ...prev, keep_me_logged_in: !prev.keep_me_logged_in }))}>
                <Checkbox
                  theme={theme}
                  $checked={loginData.keep_me_logged_in}
                />
                <CheckboxLabel theme={theme}>Keep me logged in</CheckboxLabel>
              </CheckboxContainer>
              
              <Button theme={theme} type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>

              {/* Google Sign-In */}
              <OrDivider theme={theme}>or</OrDivider>
              <GoogleButton theme={theme} type="button" onClick={handleGoogleSignIn} disabled={loading}>
                <svg width="17" height="17" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </GoogleButton>

              {/* Forgot Password Button */}
              <ForgotPasswordContainer>
                <ForgotPasswordButton
                  theme={theme}
                  type="button"
                  $disabled={!isValidEmail(forgotPasswordEmail) || forgotPasswordLoading}
                  onClick={() => {
                    if (!isValidEmail(forgotPasswordEmail) || forgotPasswordLoading) {
                      return;
                    }
                    handleForgotPassword();
                  }}
                  onMouseEnter={() => {
                    if (!isValidEmail(forgotPasswordEmail) && !forgotPasswordLoading) {
                      setShowTooltip(true);
                    }
                  }}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  {forgotPasswordLoading ? 'Sending...' : 'Forgot Password?'}
                </ForgotPasswordButton>
                
                {showTooltip && !isValidEmail(forgotPasswordEmail) && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#333',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    zIndex: 9999,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                  }}>
                    Enter a valid email address to reset password
                  </div>
                )}
              </ForgotPasswordContainer>
            </Form>
          ) : (
            <Form onSubmit={handleRegisterSubmit}>
              <Input
                theme={theme}
                type="text"
                placeholder="Choose username"
                value={registerData.username}
                onChange={(e) => setRegisterData(prev => ({ ...prev, username: e.target.value }))}
                required
              />

              <Input
                theme={theme}
                type="email"
                placeholder="Enter email address"
                value={registerData.email}
                onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
              
              <PasswordInputWrapper>
                <Input
                  theme={theme}
                  type={showRegisterPassword ? "text" : "password"}
                  placeholder="Choose password"
                  value={registerData.password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  required
                />
                <TogglePasswordButton 
                  theme={theme} 
                  type="button" 
                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                >
                  {showRegisterPassword ? <EyeOffIcon /> : <EyeIcon />}
                </TogglePasswordButton>
              </PasswordInputWrapper>
              
              <PasswordInputWrapper>
                <Input
                  theme={theme}
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={registerData.confirm_password}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                  required
                />
                <TogglePasswordButton 
                  theme={theme} 
                  type="button" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </TogglePasswordButton>
              </PasswordInputWrapper>
              
              {matchValidation.message && (
                <ValidationMessage theme={theme} type={matchValidation.type}>
                  {matchValidation.message}
                </ValidationMessage>
              )}
              
              <ValidationMessage theme={theme} type={passwordValidation.type}>
                {passwordValidation.message}
              </ValidationMessage>
              
              <Button theme={theme} type="submit" disabled={loading}>
                {loading ? 'Registering...' : 'Register'}
              </Button>

              {/* Google Sign-In */}
              <OrDivider theme={theme}>or</OrDivider>
              <GoogleButton theme={theme} type="button" onClick={handleGoogleSignIn} disabled={loading}>
                <svg width="17" height="17" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </GoogleButton>
            </Form>
          )}
          <RecaptchaDisclosure theme={theme}>
            This site is protected by reCAPTCHA and the Google{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            {' '}and{' '}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            {' '}apply.
          </RecaptchaDisclosure>
        </AuthCard>
      </AuthContainer>

      {/* ── Consent Modal ── */}
      {showConsentModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
          onClick={() => setShowConsentModal(false)}
        >
          <div style={{
            background: theme.colors.base[200],
            border: `1px solid ${theme.colors.base[300]}`,
            borderRadius: theme.radius.box,
            padding: '2rem',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            margin: '0 0.75rem',
          }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, borderRadius: '50%',
                background: theme.colors.primary.main + '18',
                color: theme.colors.primary.main, flexShrink: 0,
              }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.15rem' }}>
                  Before you continue
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                  Please review and accept our policies
                </div>
              </div>
            </div>

            {/* Body */}
            <p style={{ fontSize: '0.875rem', lineHeight: 1.7, opacity: 0.65, marginBottom: '1.5rem' }}>
              By creating an account you agree to our{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer"
                style={{ color: theme.colors.primary.main, textDecoration: 'underline' }}>
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer"
                style={{ color: theme.colors.primary.main, textDecoration: 'underline' }}>
                Privacy Policy
              </Link>
              . These documents explain your rights and how we handle your data.
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowConsentModal(false)}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: theme.radius.field,
                  border: `1px solid ${theme.colors.base[300]}`,
                  background: 'transparent',
                  color: theme.colors.base.content,
                  cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConsentAccept}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: theme.radius.field,
                  border: 'none',
                  background: theme.colors.primary.main,
                  color: theme.colors.primary.content,
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                  fontFamily: 'inherit',
                }}
              >
                I Agree & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <LoadingOverlay>
          Loading...
        </LoadingOverlay>
        )}
    </>
  );
};

export default Auth;