/**
 * Paywall.tsx
 * Shown to authenticated users who don't have an active subscription.
 * Uses Paddle.js overlay checkout — no backend redirect needed.
 * On checkout.completed, calls refreshSubscription() to unlock the dashboard.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { useTheme } from '../../theme/styles';
import { useAuth } from '../../App';

// ── Paddle env vars ───────────────────────────────────────
const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN || '';
const PADDLE_ENABLED = import.meta.env.VITE_PADDLE_ENABLED !== 'false';
const PADDLE_PRICE_ID     = import.meta.env.VITE_PADDLE_PRICE_ID || '';
const PADDLE_SANDBOX      = import.meta.env.VITE_PADDLE_SANDBOX !== 'false';

// ── Paddle.js types (minimal) ─────────────────────────────
declare global {
  interface Window {
    Paddle: {
      Environment: { set: (env: string) => void };
      Initialize: (opts: { token: string; eventCallback?: (e: any) => void }) => void;
      Checkout: { open: (opts: any) => void };
    };
  }
}

// ── Animations ────────────────────────────────────────────
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.04); }
`;

// ── Styled Components ─────────────────────────────────────
const Overlay = styled.div<{ theme: any }>`
  min-height: 100vh;
  background: ${p => p.theme.colors.base[100]};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 80% 60% at 50% -10%,
      ${p => p.theme.colors.primary.main}14 0%,
      transparent 70%
    );
    pointer-events: none;
  }
`;

const Card = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 3rem 2.5rem;
  width: 100%;
  max-width: 480px;
  box-shadow: ${p => p.theme.colorScheme === 'dark'
    ? '0 24px 64px rgba(0,0,0,0.5)'
    : '0 24px 64px rgba(0,0,0,0.1)'};
  animation: ${fadeUp} 0.45s ease both;
  position: relative;
`;

const Badge = styled.div<{ theme: any }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  background: ${p => p.theme.colors.primary.main}18;
  border: 1px solid ${p => p.theme.colors.primary.main}40;
  color: ${p => p.theme.colors.primary.main};
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
`;

const Title = styled.h1`
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.1;
  margin: 0 0 0.75rem 0;
`;

const Subtitle = styled.p<{ theme: any }>`
  font-size: 0.9375rem;
  opacity: 0.6;
  margin: 0 0 2rem 0;
  line-height: 1.6;
  color: ${p => p.theme.colors.base.content};
`;

const PriceBox = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[400]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const PriceLeft = styled.div``;

const PriceLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.5;
  margin-bottom: 0.25rem;
`;

const PriceValue = styled.div`
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
`;

const PriceSub = styled.div`
  font-size: 0.75rem;
  opacity: 0.5;
  margin-top: 0.2rem;
`;

const TrialBadge = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.success?.main || '#22c55e'}15;
  border: 1px solid ${p => p.theme.colors.success?.main || '#22c55e'}50;
  color: ${p => p.theme.colors.success?.main || '#22c55e'};
  border-radius: ${p => p.theme.radius.field};
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 2rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
`;

const FeatureItem = styled.li<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.875rem;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.8;
`;

const CheckIcon = styled.span<{ theme: any }>`
  width: 18px;
  height: 18px;
  min-width: 18px;
  border-radius: 50%;
  background: ${p => p.theme.colors.primary.main}18;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.colors.primary.main};
  svg { width: 10px; height: 10px; }
`;

const CtaButton = styled.button<{ theme: any; $loading?: boolean; $disabled?: boolean }>`
  width: 100%;
  padding: 0.9rem 1.5rem;
  border-radius: ${p => p.theme.radius.field};
  border: none;
  background: ${p => p.$loading
    ? p.theme.colors.primary.main
    : `linear-gradient(135deg, ${p.theme.colors.primary.main}, ${p.theme.colors.primary.main}cc)`};
  color: ${p => p.theme.colors.primary.content};
  font-size: 0.9375rem;
  font-weight: 700;
  cursor: ${p => p.$loading ? 'not-allowed' : 'pointer'};
  opacity: ${p => p.$loading ? 0.75 : 1};
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  animation: ${p => !p.$loading ? pulse : 'none'} 3s ease infinite;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px ${p => p.theme.colors.primary.main}50;
  }
`;

const Disclaimer = styled.p<{ theme: any }>`
  font-size: 0.72rem;
  opacity: 0.4;
  text-align: center;
  margin: 1rem 0 0 0;
  line-height: 1.5;
  color: ${p => p.theme.colors.base.content};
`;

const ErrorMsg = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.error.main}12;
  border: 1px solid ${p => p.theme.colors.error.main}40;
  color: ${p => p.theme.colors.error.main};
  border-radius: ${p => p.theme.radius.field};
  padding: 0.6rem 0.875rem;
  font-size: 0.8125rem;
  margin-top: 0.75rem;
  text-align: center;
`;

const SpinnerEl = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`;

// ── Features list ─────────────────────────────────────────
const FEATURES = [
  'Unlimited AI-powered email campaigns',
  'Bulk email generation & scheduling',
  'Smart company discovery & management',
  'HTML & template email support',
  'Attachment management',
  'Email open tracking & analytics',
];


const LegalLinks = styled.p<{ theme: any }>`
  font-size: 0.7rem;
  opacity: 0.35;
  text-align: center;
  margin: 0.5rem 0 0 0;
  line-height: 1.6;
  color: ${p => p.theme.colors.base.content};
`;

const LegalLink = styled(Link)<{ theme: any }>`
  text-decoration: underline;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s;
  &:hover { opacity: 1; }
`;


const ComingSoonBanner = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.warning?.main || '#f59e0b'}15;
  border: 1px solid ${p => p.theme.colors.warning?.main || '#f59e0b'}50;
  color: ${p => p.theme.colors.warning?.main || '#f59e0b'};
  border-radius: ${p => p.theme.radius.field};
  padding: 0.65rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: center;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

// ── Component ─────────────────────────────────────────────
const Paywall: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { user, refreshSubscription } = useAuth();
  const [paddleReady, setPaddleReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load Paddle.js script and initialize
  useEffect(() => {
    if (window.Paddle) {
      initializePaddle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => initializePaddle();
    script.onerror = () => setError('Failed to load payment system. Please refresh.');
    document.head.appendChild(script);

    return () => {
      // Leave script in DOM — removing causes issues if component remounts
    };
  }, []);

  const initializePaddle = () => {
    try {
      // Set sandbox environment if configured
      if (PADDLE_SANDBOX) {
        window.Paddle.Environment.set('sandbox');
      }

      window.Paddle.Initialize({
        token: PADDLE_CLIENT_TOKEN,
        eventCallback: (event: any) => {
          if (event.name === 'checkout.completed') {
            // Paddle checkout finished — re-fetch subscription status
            // Small delay to allow Paddle webhook to reach our backend first
            setTimeout(() => {
              refreshSubscription();
            }, 2000);
          }
          if (event.name === 'checkout.closed') {
            setLoading(false);
          }
        },
      });

      setPaddleReady(true);
    } catch (err) {
      console.error('Paddle initialization failed:', err);
      setError('Payment system failed to initialize. Please refresh the page.');
    }
  };

  const handleSubscribe = () => {
    if (!paddleReady) {
      setError('Payment system is still loading. Please wait a moment.');
      return;
    }
    if (!PADDLE_PRICE_ID) {
      setError('Paddle price not configured. Please contact support.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      window.Paddle.Checkout.open({
        items: [
          {
            priceId: PADDLE_PRICE_ID,
            quantity: 1,
          },
        ],
        // Pass user_id so the webhook knows which user subscribed
        customData: {
          user_id: String(user?.user_id || ''),
        },
      });
    } catch (err) {
      console.error('Paddle checkout error:', err);
      setError('Failed to open checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Overlay theme={theme}>
      <Card theme={theme}>
        <Badge theme={theme}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          Subscription Required
        </Badge>

        <Title>Unlock Full Access</Title>
        <Subtitle theme={theme}>
          {PADDLE_ENABLED ? 'Start your 15-day free trial today. No charges until your trial ends — cancel anytime.' : 'You\'re in early access — payments are not yet active.'}
        </Subtitle>

        <PriceBox theme={theme}>
          <PriceLeft>
            <PriceLabel>{PADDLE_ENABLED ? 'After free trial' : 'Early Access'}</PriceLabel>
            <PriceValue>$29<span style={{ fontSize: '1rem', fontWeight: 500 }}>/mo</span></PriceValue>
            <PriceSub>Billed monthly · Cancel anytime</PriceSub>
          </PriceLeft>
          <TrialBadge theme={theme}>15 days free</TrialBadge>
        </PriceBox>

        <FeatureList>
          {FEATURES.map((feature) => (
            <FeatureItem key={feature} theme={theme}>
              <CheckIcon theme={theme}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </CheckIcon>
              {feature}
            </FeatureItem>
          ))}
        </FeatureList>

        {!PADDLE_ENABLED && (
          <ComingSoonBanner theme={theme}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Payments coming soon — access is currently free
          </ComingSoonBanner>
        )}
        <CtaButton
          theme={theme}
          $loading={loading}
          $disabled={!PADDLE_ENABLED}
          onClick={!PADDLE_ENABLED ? undefined : handleSubscribe}
          disabled={loading || !PADDLE_ENABLED}
        >
          {loading ? (
            <>
              <SpinnerEl />
              Opening checkout...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              {PADDLE_ENABLED ? 'Start Free Trial' : 'Early Access'}
            </>
          )}
        </CtaButton>

        {error && <ErrorMsg theme={theme}>{error}</ErrorMsg>}

        <Disclaimer theme={theme}>
          {PADDLE_ENABLED ? "Card required to start trial. You won't be charged for 15 days. Cancel before trial ends to avoid any charges." : 'No payment required. Payments will be activated soon.'}
        </Disclaimer>
        <LegalLinks theme={theme}>
          By subscribing you agree to our{' '}
          <LegalLink theme={theme} to="/terms">Terms of Service</LegalLink>
          {' and '}
          <LegalLink theme={theme} to="/privacy">Privacy Policy</LegalLink>
          {' and '}<LegalLink theme={theme} to="/refunds">Refund Policy</LegalLink>
        </LegalLinks>
      </Card>
    </Overlay>
  );
};

export default Paywall;