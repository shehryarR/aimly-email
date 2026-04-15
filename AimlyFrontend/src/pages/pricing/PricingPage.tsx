/**
 * PricingPage.tsx — fully theme-aware, no hardcoded colors
 */
import React, { useEffect } from 'react';
import styled, { keyframes, createGlobalStyle } from 'styled-components';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../../theme/styles';
import Navbar from '../../template/navbar';
import Footer from '../../template/footer';
import { useAuth } from '../../App';

const PADDLE_ENABLED = import.meta.env.VITE_PADDLE_ENABLED !== 'false';

const LandingFont = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');
`;

const fadeUp = keyframes`from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}`;
const glow   = keyframes`0%,100%{opacity:0.4}50%{opacity:0.7}`;

const Root = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[100]};
  color: ${p => p.theme.colors.base.content};
  font-family: 'DM Sans', sans-serif;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  &::before {
    content: '';
    position: fixed;
    top: -100px; left: 50%;
    transform: translateX(-50%);
    width: 700px; height: 500px;
    background: radial-gradient(ellipse,
      ${p => p.theme.colors.accent.main}18 0%,
      ${p => p.theme.colors.primary.main}12 40%,
      transparent 70%
    );
    animation: ${glow} 6s ease-in-out infinite;
    pointer-events: none; z-index: 0;
  }
`;

const Hero = styled.div`text-align: center; padding: 5rem 2rem 3rem; position: relative; z-index: 1;`;
const HeroLabel = styled.div<{ theme: any }>`font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${p => p.theme.colors.accent.main}; margin-bottom: 1rem; animation: ${fadeUp} 0.5s ease both;`;
const HeroTitle = styled.h1<{ theme: any }>`font-family: 'DM Serif Display', serif; font-size: clamp(2rem, 4vw, 3rem); font-weight: 400; letter-spacing: -0.02em; margin: 0 0 1rem 0; color: ${p => p.theme.colors.base.content}; animation: ${fadeUp} 0.5s 0.1s ease both;`;
const HeroSub = styled.p<{ theme: any }>`font-size: 1rem; opacity: 0.55; max-width: 460px; margin: 0 auto; line-height: 1.7; color: ${p => p.theme.colors.base.content}; animation: ${fadeUp} 0.5s 0.2s ease both;`;

const CardWrap = styled.div`display: flex; justify-content: center; padding: 3rem 2rem; position: relative; z-index: 1;`;

const Card = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.accent.main}50;
  border-radius: ${p => p.theme.radius.box};
  padding: 2.5rem; max-width: 460px; width: 100%;
  position: relative; overflow: hidden;
  box-shadow: 0 0 60px ${p => p.theme.colors.accent.main}12, 0 24px 48px rgba(0,0,0,0.15);
  animation: ${fadeUp} 0.6s 0.2s ease both;
  &::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, ${p => p.theme.colors.primary.main}, ${p => p.theme.colors.accent.main}, ${p => p.theme.colors.info.main});
  }
`;

const TrialBadge = styled.div<{ theme: any }>`
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.3rem 0.875rem; border-radius: 999px;
  background: ${p => p.theme.colors.accent.main}15;
  border: 1px solid ${p => p.theme.colors.accent.main}50;
  color: ${p => p.theme.colors.accent.main};
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; margin-bottom: 1.5rem;
`;

const PlanName = styled.div<{ theme: any }>`font-size: 0.8125rem; font-weight: 600; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.5rem; color: ${p => p.theme.colors.base.content};`;
const PriceRow = styled.div`display: flex; align-items: baseline; gap: 0.25rem; margin-bottom: 0.4rem;`;
const Currency = styled.span<{ theme: any }>`font-size: 1.25rem; font-weight: 600; opacity: 0.6; align-self: flex-start; margin-top: 0.6rem; color: ${p => p.theme.colors.base.content};`;
const Amount = styled.span<{ theme: any }>`font-family: 'DM Serif Display', serif; font-size: 4rem; font-weight: 400; line-height: 1; letter-spacing: -0.03em; color: ${p => p.theme.colors.base.content};`;
const Per = styled.span<{ theme: any }>`font-size: 0.875rem; opacity: 0.45; color: ${p => p.theme.colors.base.content};`;
const PriceSub = styled.p<{ theme: any }>`font-size: 0.8125rem; opacity: 0.4; margin: 0 0 2rem 0; color: ${p => p.theme.colors.base.content};`;
const Divider = styled.div<{ theme: any }>`height: 1px; background: ${p => p.theme.colors.base[300]}; margin-bottom: 1.5rem;`;

const FeatureList = styled.ul`list-style: none; padding: 0; margin: 0 0 2rem 0; display: flex; flex-direction: column; gap: 0.75rem;`;
const FeatureItem = styled.li<{ theme: any }>`display: flex; align-items: center; gap: 0.65rem; font-size: 0.875rem; opacity: 0.8; color: ${p => p.theme.colors.base.content};`;
const Check = styled.span<{ theme: any }>`
  width: 18px; height: 18px; min-width: 18px; border-radius: 50%;
  background: ${p => p.theme.colors.accent.main}20;
  border: 1px solid ${p => p.theme.colors.accent.main}50;
  display: flex; align-items: center; justify-content: center;
  color: ${p => p.theme.colors.accent.main}; svg { width: 9px; height: 9px; }
`;

const CtaBtn = styled(Link)<{ theme: any }>`
  text-decoration: none;
  width: 100%; padding: 0.9rem 1.5rem; border-radius: ${p => p.theme.radius.field};
  border: none; background: ${p => p.theme.colors.primary.main};
  color: ${p => p.theme.colors.primary.content};
  font-family: 'DM Sans', sans-serif; font-size: 0.9375rem; font-weight: 600;
  cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  &:hover { background: ${p => p.theme.colors.accent.main}; color: ${p => p.theme.colors.accent.content}; transform: translateY(-2px); box-shadow: 0 8px 28px ${p => p.theme.colors.accent.main}40; }
`;
const Disclaimer = styled.p<{ theme: any }>`font-size: 0.72rem; opacity: 0.35; text-align: center; margin: 0.875rem 0 0 0; line-height: 1.5; color: ${p => p.theme.colors.base.content};`;

const FaqSection = styled.div`max-width: 640px; margin: 0 auto; padding: 2rem 2rem 5rem; position: relative; z-index: 1;`;
const FaqTitle = styled.h2<{ theme: any }>`font-family: 'DM Serif Display', serif; font-size: 1.5rem; font-weight: 400; letter-spacing: -0.02em; text-align: center; margin: 0 0 2.5rem 0; color: ${p => p.theme.colors.base.content};`;
const FaqItem = styled.div<{ theme: any }>`border-bottom: 1px solid ${p => p.theme.colors.base[300]}; padding: 1.25rem 0; &:first-of-type { border-top: 1px solid ${p => p.theme.colors.base[300]}; }`;
const FaqQ = styled.h3<{ theme: any }>`font-size: 0.9375rem; font-weight: 600; margin: 0 0 0.5rem 0; letter-spacing: -0.01em; color: ${p => p.theme.colors.base.content};`;
const FaqA = styled.p<{ theme: any }>`font-size: 0.875rem; line-height: 1.7; opacity: 0.55; margin: 0; color: ${p => p.theme.colors.base.content};`;


const ComingSoonBanner = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.warning?.main || '#f59e0b'}15;
  border: 1px solid ${p => p.theme.colors.warning?.main || '#f59e0b'}50;
  color: ${p => p.theme.colors.warning?.main || '#f59e0b'};
  border-radius: ${p => p.theme.radius.field};
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: center;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const FEATURES = [
  'Unlimited AI-powered email campaigns',
  'Bulk email generation & scheduling',
  'Smart company discovery & management',
  'HTML & template email support',
  'Attachment management',
  'Email open tracking & analytics',
  'Smart scheduling with stagger control',
  'Google OAuth sign-in',
  'Priority email support',
];

const FAQS = [
  { q: 'Do I need a credit card to start?', a: 'Yes, a credit card is required to start the free trial. You will not be charged during the 15-day trial period. Cancel anytime before it ends to avoid charges.' },
  { q: 'Can I cancel anytime?', a: 'Yes. You can cancel your subscription at any time through your account settings. Cancellation takes effect at the end of your current billing period.' },
  { q: 'What happens when my trial ends?', a: 'After the 15-day trial, your subscription automatically becomes active and you are billed $29/month. You will receive an email reminder before the trial ends.' },
  { q: 'Do you offer refunds?', a: 'We review refund requests on a case-by-case basis. See our Refund Policy for full details. Technical errors and duplicate charges are always refunded.' },
  { q: 'What AI model powers the email generation?', a: 'Aimly uses state-of-the-art large language models to generate personalized emails. The model can be configured per user based on your API key settings.' },
  { q: 'Is there a limit on the number of companies or campaigns?', a: 'No. Your subscription includes unlimited campaigns and companies. There are no hidden caps or per-email charges.' },
];

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    document.body.style.backgroundColor = theme.colors.base[100];
    window.scrollTo(0, 0);
  }, [theme]);

  return (
    <>
      <LandingFont />
      <Root theme={theme}>
        <Navbar isLandingPage user={user ? { username: user.username } : undefined} />
        <Hero>
          <HeroLabel theme={theme}>Pricing</HeroLabel>
          <HeroTitle theme={theme}>Simple, transparent pricing</HeroTitle>
          <HeroSub theme={theme}>{PADDLE_ENABLED ? 'One plan. Everything included. Start with a 15-day free trial — no charge until it ends.' : 'One plan. Everything included. Early access — currently free while payments are being set up.'}</HeroSub>
        </Hero>
        <CardWrap>
          <Card theme={theme}>
            {!PADDLE_ENABLED && (
              <ComingSoonBanner theme={theme}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Payments not yet active — access is currently free
              </ComingSoonBanner>
            )}
            <TrialBadge theme={theme}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              {PADDLE_ENABLED ? '15-day free trial' : 'Early Access'}
            </TrialBadge>
            <PlanName theme={theme}>Aimly Pro</PlanName>
            <PriceRow>
              <Currency theme={theme}>$</Currency>
              <Amount theme={theme}>29</Amount>
              <Per theme={theme}>/month</Per>
            </PriceRow>
            <PriceSub theme={theme}>Billed monthly · Cancel anytime</PriceSub>
            <Divider theme={theme} />
            <FeatureList>
              {FEATURES.map(f => (
                <FeatureItem key={f} theme={theme}>
                  <Check theme={theme}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </Check>
                  {f}
                </FeatureItem>
              ))}
            </FeatureList>
            <CtaBtn theme={theme} to="/auth?tab=register">
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              Get Started
            </CtaBtn>
            <Disclaimer theme={theme}>{PADDLE_ENABLED ? 'Card required. No charge for 15 days. Cancel before trial ends to avoid billing.' : 'No payment required during early access.'}</Disclaimer>
          </Card>
        </CardWrap>
        <FaqSection>
          <FaqTitle theme={theme}>Frequently asked questions</FaqTitle>
          {FAQS.map(faq => (
            <FaqItem key={faq.q} theme={theme}>
              <FaqQ theme={theme}>{faq.q}</FaqQ>
              <FaqA theme={theme}>{faq.a}</FaqA>
            </FaqItem>
          ))}
        </FaqSection>
        <Footer />
      </Root>
    </>
  );
};

export default PricingPage;