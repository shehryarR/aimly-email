/**
 * Paywall.tsx
 * Shown to authenticated users who don't have an active subscription.
 * Uses Paddle.js overlay checkout — no backend redirect needed.
 * On checkout.completed, calls refreshSubscription() to unlock the dashboard.
 *
 * Supports 3 plans: Solo / Studio / Agency, each with its own Paddle price ID.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { useTheme } from '../../theme/styles';
import { useAuth } from '../../App';

// ── Paddle env vars ───────────────────────────────────────
const PADDLE_CLIENT_TOKEN  = import.meta.env.VITE_PADDLE_CLIENT_TOKEN  || '';
const PADDLE_ENABLED       = import.meta.env.VITE_PADDLE_ENABLED !== 'false';
const PADDLE_SANDBOX       = import.meta.env.VITE_PADDLE_SANDBOX !== 'false';
const PADDLE_PRICE_ID_SOLO   = import.meta.env.VITE_PADDLE_PRICE_ID_SOLO   || '';
const PADDLE_PRICE_ID_STUDIO = import.meta.env.VITE_PADDLE_PRICE_ID_STUDIO || '';
const PADDLE_PRICE_ID_AGENCY = import.meta.env.VITE_PADDLE_PRICE_ID_AGENCY || '';

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

// ── Plan definitions ──────────────────────────────────────
interface PlanDef {
  slug:          'solo' | 'studio' | 'agency';
  name:          string;
  price:         number;
  priceId:       string;
  maxBrands:     string;
  dailyCap:      string;
  support:       string;
  idealFor:      string;
  highlighted:   boolean;
  features:      string[];
}

const PLANS: PlanDef[] = [
  {
    slug:        'solo',
    name:        'Solo',
    price:       29,
    priceId:     PADDLE_PRICE_ID_SOLO,
    maxBrands:   '1 brand profile',
    dailyCap:    '500 emails / day',
    support:     'Email (48h)',
    idealFor:    'Solopreneurs',
    highlighted: false,
    features: [
      '1 branding profile',
      '500 emails per day',
      'AI-powered email generation',
      'Bulk scheduling & smart stagger',
      'Email read tracking',
      'Attachment management',
      'Email support (48h)',
    ],
  },
  {
    slug:        'studio',
    name:        'Studio',
    price:       79,
    priceId:     PADDLE_PRICE_ID_STUDIO,
    maxBrands:   'Up to 5 brand profiles',
    dailyCap:    '2,500 emails / day',
    support:     'Priority Email (24h)',
    idealFor:    'Growing Teams',
    highlighted: true,
    features: [
      'Up to 5 branding profiles',
      '2,500 emails per day',
      'AI-powered email generation',
      'Bulk scheduling & smart stagger',
      'Email read tracking',
      'Attachment management',
      'Priority email support (24h)',
    ],
  },
  {
    slug:        'agency',
    name:        'Agency',
    price:       199,
    priceId:     PADDLE_PRICE_ID_AGENCY,
    maxBrands:   'Unlimited brand profiles',
    dailyCap:    '7,500 emails / day',
    support:     'Slack / Discord',
    idealFor:    'Client Agencies',
    highlighted: false,
    features: [
      'Unlimited branding profiles',
      '7,500 emails per day',
      'AI-powered email generation',
      'Bulk scheduling & smart stagger',
      'Email read tracking',
      'Attachment management',
      'Slack / Discord support',
    ],
  },
];

// ── Animations ────────────────────────────────────────────
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.02); }
`;

// ── Styled Components ─────────────────────────────────────
const Overlay = styled.div<{ theme: any }>`
  min-height: 100vh;
  background: ${p => p.theme.colors.base[100]};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
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

const Header = styled.div`
  text-align: center;
  margin-bottom: 2.5rem;
  animation: ${fadeUp} 0.4s ease both;
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
  margin-bottom: 1rem;
`;

const Title = styled.h1<{ theme: any }>`
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.1;
  margin: 0 0 0.5rem 0;
  color: ${p => p.theme.colors.base.content};
`;

const Subtitle = styled.p<{ theme: any }>`
  font-size: 0.9375rem;
  opacity: 0.6;
  margin: 0;
  line-height: 1.6;
  color: ${p => p.theme.colors.base.content};
`;

const PlansGrid = styled.div`
  display: flex;
  gap: 1.25rem;
  align-items: stretch;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
  max-width: 980px;
`;

const PlanCard = styled.div<{ theme: any; $highlighted: boolean; $selected: boolean }>`
  background: ${p => p.theme.colors.base[200]};
  border: 2px solid ${p =>
    p.$selected
      ? p.theme.colors.primary.main
      : p.$highlighted
        ? p.theme.colors.accent.main + '60'
        : p.theme.colors.base[300]
  };
  border-radius: ${p => p.theme.radius.box};
  padding: 1.75rem 1.5rem;
  width: 280px;
  position: relative;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  animation: ${fadeUp} 0.5s ease both;
  box-shadow: ${p => p.$selected
    ? `0 0 0 4px ${p.theme.colors.primary.main}20, 0 16px 40px rgba(0,0,0,0.15)`
    : p.$highlighted
      ? `0 8px 32px rgba(0,0,0,0.12)`
      : 'none'
  };
  &:hover {
    border-color: ${p => p.$selected ? p.theme.colors.primary.main : p.theme.colors.accent.main};
    transform: translateY(-2px);
  }
  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 3px;
    border-radius: ${p => p.theme.radius.box} ${p => p.theme.radius.box} 0 0;
    background: ${p => p.$selected || p.$highlighted
      ? `linear-gradient(90deg, ${p.theme.colors.primary.main}, ${p.theme.colors.accent.main})`
      : 'transparent'
    };
  }
`;

const PopularBadge = styled.div<{ theme: any }>`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: ${p => p.theme.colors.accent.main};
  color: ${p => p.theme.colors.accent.content};
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  white-space: nowrap;
`;

const PlanName = styled.div<{ theme: any }>`
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.6;
  margin-bottom: 0.4rem;
  color: ${p => p.theme.colors.base.content};
`;

const PlanIdealFor = styled.div<{ theme: any }>`
  font-size: 0.75rem;
  opacity: 0.45;
  margin-bottom: 1rem;
  color: ${p => p.theme.colors.base.content};
`;

const PriceRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  margin-bottom: 1rem;
`;

const Currency = styled.span<{ theme: any }>`
  font-size: 1.1rem;
  font-weight: 600;
  opacity: 0.7;
  align-self: flex-start;
  margin-top: 0.5rem;
  color: ${p => p.theme.colors.base.content};
`;

const Amount = styled.span<{ theme: any }>`
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: ${p => p.theme.colors.base.content};
`;

const Per = styled.span<{ theme: any }>`
  font-size: 0.8125rem;
  opacity: 0.55;
  color: ${p => p.theme.colors.base.content};
`;


const Divider = styled.div<{ theme: any }>`
  height: 1px;
  background: ${p => p.theme.colors.base[300]};
  margin-bottom: 1rem;
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FeatureItem = styled.li<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.8125rem;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.8;
`;

const CheckIcon = styled.span<{ theme: any }>`
  width: 16px;
  height: 16px;
  min-width: 16px;
  border-radius: 50%;
  background: ${p => p.theme.colors.primary.main}18;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.colors.primary.main};
  svg { width: 9px; height: 9px; }
`;

const SelectedIndicator = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 1.25rem;
  padding: 0.5rem;
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.primary.main}15;
  color: ${p => p.theme.colors.primary.main};
  font-size: 0.775rem;
  font-weight: 600;
`;

const CtaArea = styled.div`
  width: 100%;
  max-width: 480px;
  margin-top: 2rem;
  animation: ${fadeUp} 0.5s 0.2s ease both;
`;

const CtaButton = styled.button<{ theme: any; $loading?: boolean }>`
  width: 100%;
  padding: 0.9rem 1.5rem;
  border-radius: ${p => p.theme.radius.field};
  border: none;
  background: ${p => p.theme.colors.primary.main};
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
    opacity: 0.88;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px ${p => p.theme.colors.primary.main}50;
  }
`;

const Disclaimer = styled.p<{ theme: any }>`
  font-size: 0.72rem;
  opacity: 0.4;
  text-align: center;
  margin: 0.875rem 0 0 0;
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
  width: 100%;
  max-width: 480px;
`;

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

// ── Component ─────────────────────────────────────────────
const Paywall: React.FC = () => {
  const { theme }  = useTheme();
  const { user, refreshSubscription } = useAuth();
  const [paddleReady,    setPaddleReady]    = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [selectedSlug,   setSelectedSlug]   = useState<'solo' | 'studio' | 'agency'>('studio');

  const selectedPlan = PLANS.find(p => p.slug === selectedSlug)!;

  // Load Paddle.js and initialize
  useEffect(() => {
    if (window.Paddle) { initializePaddle(); return; }
    const script = document.createElement('script');
    script.src   = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload  = () => initializePaddle();
    script.onerror = () => setError('Failed to load payment system. Please refresh.');
    document.head.appendChild(script);
  }, []);

  const initializePaddle = () => {
    try {
      if (PADDLE_SANDBOX) window.Paddle.Environment.set('sandbox');
      window.Paddle.Initialize({
        token: PADDLE_CLIENT_TOKEN,
        eventCallback: (event: any) => {
          if (event.name === 'checkout.completed') {
            setTimeout(() => { refreshSubscription(); }, 2000);
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
    if (!paddleReady) { setError('Payment system is still loading. Please wait a moment.'); return; }
    if (!selectedPlan.priceId) { setError(`Price not configured for ${selectedPlan.name}. Please contact support.`); return; }

    setError('');
    setLoading(true);
    try {
      window.Paddle.Checkout.open({
        items: [{ priceId: selectedPlan.priceId, quantity: 1 }],
        customData: { user_id: String(user?.user_id || '') },
      });
    } catch (err) {
      console.error('Paddle checkout error:', err);
      setError('Failed to open checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Overlay theme={theme}>
      <Header>
        <Badge theme={theme}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          Subscription Required
        </Badge>
        <Title theme={theme}>Choose your plan</Title>
        <Subtitle theme={theme}>
          {PADDLE_ENABLED
            ? 'All plans include a 15-day free trial. No charges until your trial ends — cancel anytime.'
            : "You're in early access — payments are not yet active."
          }
        </Subtitle>
      </Header>

      {/* Plan cards */}
      {!PADDLE_ENABLED && (
        <ComingSoonBanner theme={theme} style={{ maxWidth: '900px' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Payments not yet active — access is currently free
        </ComingSoonBanner>
      )}
      <PlansGrid>
        {PLANS.map((plan, i) => (
          <PlanCard
            key={plan.slug}
            theme={theme}
            $highlighted={plan.highlighted}
            $selected={selectedSlug === plan.slug}
            onClick={() => setSelectedSlug(plan.slug)}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            {plan.highlighted && (
              <PopularBadge theme={theme}>Most Popular</PopularBadge>
            )}
            <PlanName theme={theme}>{plan.name}</PlanName>
            <PlanIdealFor theme={theme}>{plan.idealFor}</PlanIdealFor>
            <PriceRow>
              <Currency theme={theme}>$</Currency>
              <Amount theme={theme}>{plan.price}</Amount>
              <Per theme={theme}>/mo</Per>
            </PriceRow>
            <Divider theme={theme} />
            <FeatureList>
              {plan.features.map(f => (
                <FeatureItem key={f} theme={theme}>
                  <CheckIcon theme={theme}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </CheckIcon>
                  {f}
                </FeatureItem>
              ))}
            </FeatureList>
            {selectedSlug === plan.slug && (
              <SelectedIndicator theme={theme}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Selected
              </SelectedIndicator>
            )}
          </PlanCard>
        ))}
      </PlansGrid>

      {/* CTA area */}
      <CtaArea>


        <CtaButton
          theme={theme}
          $loading={loading}
          onClick={!PADDLE_ENABLED ? undefined : handleSubscribe}
          disabled={loading || !PADDLE_ENABLED}
        >
          {loading ? (
            <><SpinnerEl /> Opening checkout...</>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              {PADDLE_ENABLED
                ? `Start Free Trial — ${selectedPlan.name} $${selectedPlan.price}/mo`
                : 'Early Access'
              }
            </>
          )}
        </CtaButton>

        {error && <ErrorMsg theme={theme}>{error}</ErrorMsg>}

        <Disclaimer theme={theme}>
          {PADDLE_ENABLED
            ? "Card required to start trial. You won't be charged for 15 days. Cancel before trial ends to avoid any charges."
            : 'No payment required. Payments will be activated soon.'
          }
        </Disclaimer>
        <LegalLinks theme={theme}>
          By subscribing you agree to our{' '}
          <LegalLink theme={theme} to="/terms">Terms of Service</LegalLink>
          {' and '}
          <LegalLink theme={theme} to="/privacy">Privacy Policy</LegalLink>
          {' and '}
          <LegalLink theme={theme} to="/refunds">Refund Policy</LegalLink>
        </LegalLinks>
      </CtaArea>
    </Overlay>
  );
};

export default Paywall;