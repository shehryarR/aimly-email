/**
 * LandingPage.tsx — Aimly public marketing page
 * All styled components use theme prop from useTheme() — no hardcoded colors.
 * Responds correctly to dark/light theme toggle.
 */

import React, { useEffect } from 'react';
import styled, { keyframes, createGlobalStyle } from 'styled-components';
import { useNavigate, Link } from 'react-router-dom';

const PADDLE_ENABLED = import.meta.env.VITE_PADDLE_ENABLED !== 'false';
import { useTheme } from '../../theme/styles';
import Navbar from '../../template/navbar';
import Footer from '../../template/footer';
import { useAuth } from '../../App';

// ── Google Font ───────────────────────────────────────────
const LandingFont = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');
`;

// ── Animations ────────────────────────────────────────────
const fadeUp = keyframes`from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}`;
const glow   = keyframes`0%,100%{opacity:0.5;transform:scale(1)}50%{opacity:0.8;transform:scale(1.06)}`;
const float  = keyframes`0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}`;

// ── Root ──────────────────────────────────────────────────
const Root = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[100]};
  color: ${p => p.theme.colors.base.content};
  font-family: 'DM Sans', sans-serif;
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
`;

const Section = styled.section<{ $pad?: string }>`
  max-width: 1140px;
  margin: 0 auto;
  padding: ${p => p.$pad || '6rem 2rem'};
  position: relative;
  z-index: 1;
`;

// ── Hero ──────────────────────────────────────────────────
const HeroWrap = styled.div<{ theme: any }>`
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    top: -120px; left: 50%;
    transform: translateX(-50%);
    width: 800px; height: 600px;
    background: radial-gradient(ellipse at center,
      ${p => p.theme.colors.accent.main}22 0%,
      ${p => p.theme.colors.primary.main}18 35%,
      transparent 70%
    );
    animation: ${glow} 6s ease-in-out infinite;
    pointer-events: none;
  }
`;

const HeroInner = styled.div`
  max-width: 1140px;
  margin: 0 auto;
  padding: 7rem 2rem 5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  z-index: 1;
`;

const HeroBadge = styled.div<{ theme: any }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 1rem;
  border-radius: 999px;
  border: 1px solid ${p => p.theme.colors.accent.main}50;
  background: ${p => p.theme.colors.accent.main}10;
  color: ${p => p.theme.colors.accent.main};
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 2rem;
  animation: ${fadeUp} 0.5s ease both;
`;

const BadgeDot = styled.span<{ theme: any }>`
  width: 6px; height: 6px;
  border-radius: 50%;
  background: ${p => p.theme.colors.accent.main};
  animation: ${glow} 2s ease-in-out infinite;
`;

const HeroTitle = styled.h1<{ theme: any }>`
  font-family: 'DM Serif Display', serif;
  font-size: clamp(2.8rem, 6vw, 4.5rem);
  font-weight: 400;
  line-height: 1.08;
  letter-spacing: -0.02em;
  margin: 0 0 1.5rem 0;
  max-width: 800px;
  color: ${p => p.theme.colors.base.content};
  animation: ${fadeUp} 0.6s 0.1s ease both;
  em {
    font-style: italic;
    background: linear-gradient(135deg, ${p => p.theme.colors.accent.main}, ${p => p.theme.colors.info.main});
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
`;

const HeroSub = styled.p<{ theme: any }>`
  font-size: 1.125rem;
  line-height: 1.7;
  opacity: 0.6;
  max-width: 540px;
  margin: 0 0 2.75rem 0;
  color: ${p => p.theme.colors.base.content};
  animation: ${fadeUp} 0.6s 0.2s ease both;
`;

const HeroCtas = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
  animation: ${fadeUp} 0.6s 0.3s ease both;
`;

const PrimaryBtn = styled(Link)<{ theme: any }>`
  text-decoration: none;
  padding: 0.875rem 2rem;
  border-radius: ${p => p.theme.radius.field};
  border: none;
  background: ${p => p.theme.colors.primary.main};
  color: ${p => p.theme.colors.primary.content};
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  &:hover {
    background: ${p => p.theme.colors.accent.main};
    color: ${p => p.theme.colors.accent.content};
    transform: translateY(-2px);
    box-shadow: 0 8px 28px ${p => p.theme.colors.accent.main}40;
  }
`;

const SecondaryBtn = styled(Link)<{ theme: any }>`
  text-decoration: none;
  padding: 0.875rem 1.75rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: transparent;
  color: ${p => p.theme.colors.base.content};
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.75;
  &:hover {
    opacity: 1;
    border-color: ${p => p.theme.colors.primary.main};
    color: ${p => p.theme.colors.primary.main};
    background: ${p => p.theme.colors.primary.main}10;
  }
`;

// ── Dashboard preview mockup ──────────────────────────────
const PreviewWrap = styled.div<{ theme: any }>`
  margin-top: 4rem;
  width: 100%;
  max-width: 900px;
  position: relative;
  animation: ${fadeUp} 0.7s 0.4s ease both;
  &::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 120px;
    background: linear-gradient(to top, ${p => p.theme.colors.base[100]}, transparent);
    pointer-events: none;
  }
`;

const PreviewFrame = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0,0,0,0.3), 0 0 60px ${p => p.theme.colors.accent.main}12;
  animation: ${float} 8s ease-in-out infinite;
`;

const PreviewBar = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[300]};
  padding: 0.65rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PreviewDot = styled.span<{ $c: string }>`
  width: 10px; height: 10px;
  border-radius: 50%;
  background: ${p => p.$c};
`;

const PreviewContent = styled.div`
  padding: 1.5rem;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
`;

const PreviewCard = styled.div<{ theme: any; $accent?: string }>`
  background: ${p => p.theme.colors.base[400]};
  border: 1px solid ${p => p.$accent ? p.$accent + '40' : p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  padding: 1rem;
`;

const PreviewLabel = styled.div<{ theme: any }>`
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.4;
  margin-bottom: 0.4rem;
  color: ${p => p.theme.colors.base.content};
`;

const PreviewValue = styled.div<{ $color?: string }>`
  font-size: 1.5rem;
  font-weight: 700;
  font-family: 'DM Serif Display', serif;
  color: ${p => p.$color || 'inherit'};
  letter-spacing: -0.02em;
`;

const PreviewBar2 = styled.div`
  padding: 0 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const PreviewRow = styled.div<{ theme?: any; $w: string; $color?: string }>`
  height: 8px;
  border-radius: 4px;
  background: ${p => p.$color || p.theme.colors.base[300]};
  width: ${p => p.$w};
  opacity: 0.7;
`;

// ── Stats Strip ───────────────────────────────────────────
const StatsStrip = styled.div<{ theme: any }>`
  border-top: 1px solid ${p => p.theme.colors.base[300]};
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[200]};
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
`;

const StatItem = styled.div<{ theme: any }>`
  flex: 1;
  padding: 1.5rem 2rem;
  text-align: center;
  border-right: 1px solid ${p => p.theme.colors.base[300]};
  &:last-child { border-right: none; }
`;

const StatNum = styled.div<{ theme: any }>`
  font-family: 'DM Serif Display', serif;
  font-size: 1.75rem;
  font-weight: 400;
  color: ${p => p.theme.colors.accent.main};
  letter-spacing: -0.02em;
  line-height: 1;
  margin-bottom: 0.25rem;
`;

const StatDesc = styled.div<{ theme: any }>`
  font-size: 0.75rem;
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
  color: ${p => p.theme.colors.base.content};
`;

// ── Section Header ────────────────────────────────────────
const SectionLabel = styled.div<{ theme: any }>`
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${p => p.theme.colors.accent.main};
  margin-bottom: 1rem;
`;

const SectionTitle = styled.h2<{ theme: any }>`
  font-family: 'DM Serif Display', serif;
  font-size: clamp(1.8rem, 3.5vw, 2.75rem);
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin: 0 0 1rem 0;
  color: ${p => p.theme.colors.base.content};
  em { font-style: italic; color: ${p => p.theme.colors.accent.main}; }
`;

const SectionSub = styled.p<{ theme: any }>`
  font-size: 1rem;
  line-height: 1.7;
  opacity: 0.55;
  max-width: 520px;
  margin: 0;
  color: ${p => p.theme.colors.base.content};
`;

// ── Features ──────────────────────────────────────────────
const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  margin-top: 3.5rem;
  @media (max-width: 768px) { grid-template-columns: 1fr; }
`;

const FeatureCard = styled.div<{ theme: any; $delay: string }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 1.75rem;
  transition: all 0.25s;
  animation: ${fadeUp} 0.6s ${p => p.$delay} ease both;
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, ${p => p.theme.colors.accent.main}60, transparent);
    opacity: 0;
    transition: opacity 0.3s;
  }
  &:hover {
    border-color: ${p => p.theme.colors.primary.main}80;
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.15), 0 0 0 1px ${p => p.theme.colors.primary.main}30;
    &::before { opacity: 1; }
  }
`;

const FeatureIcon = styled.div<{ theme: any }>`
  width: 40px; height: 40px;
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.primary.main}20;
  border: 1px solid ${p => p.theme.colors.primary.main}40;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.1rem;
  color: ${p => p.theme.colors.accent.main};
  svg { width: 18px; height: 18px; }
`;

const FeatureTitle = styled.h3<{ theme: any }>`
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.01em;
  color: ${p => p.theme.colors.base.content};
`;

const FeatureDesc = styled.p<{ theme: any }>`
  font-size: 0.8375rem;
  line-height: 1.65;
  opacity: 0.55;
  margin: 0;
  color: ${p => p.theme.colors.base.content};
`;

// ── How It Works ──────────────────────────────────────────
const HowGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin-top: 3.5rem;
  position: relative;
  @media (max-width: 768px) { grid-template-columns: 1fr; }
`;

const HowStep = styled.div<{ $delay: string }>`
  text-align: center;
  animation: ${fadeUp} 0.6s ${p => p.$delay} ease both;
`;

const StepNumber = styled.div<{ theme: any }>`
  width: 56px; height: 56px;
  border-radius: 50%;
  border: 1px solid ${p => p.theme.colors.accent.main}60;
  background: ${p => p.theme.colors.base[200]};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.25rem;
  font-family: 'DM Serif Display', serif;
  font-size: 1.25rem;
  color: ${p => p.theme.colors.accent.main};
  position: relative;
  z-index: 1;
  box-shadow: 0 0 0 4px ${p => p.theme.colors.base[100]};
`;

const StepTitle = styled.h3<{ theme: any }>`
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: ${p => p.theme.colors.base.content};
`;

const StepDesc = styled.p<{ theme: any }>`
  font-size: 0.8375rem;
  line-height: 1.65;
  opacity: 0.5;
  margin: 0;
  color: ${p => p.theme.colors.base.content};
`;

// ── Divider ───────────────────────────────────────────────
const Divider = styled.div<{ theme: any }>`
  height: 1px;
  background: linear-gradient(90deg, transparent, ${p => p.theme.colors.base[300]}, transparent);
  max-width: 1140px;
  margin: 0 auto;
`;

// ── Pricing ───────────────────────────────────────────────
const ComingSoonBanner = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.warning?.main || '#f59e0b'}15;
  border: 1px solid ${p => p.theme.colors.warning?.main || '#f59e0b'}50;
  color: ${p => p.theme.colors.warning?.main || '#f59e0b'};
  border-radius: ${p => p.theme.radius.field};
  padding: 0.65rem 0.875rem;
  font-size: 0.8rem;
  font-weight: 500;
  text-align: center;
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const PricingWrap = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 3.5rem;
`;

const PricingCard = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.accent.main}50;
  border-radius: ${p => p.theme.radius.box};
  padding: 2.5rem;
  max-width: 440px;
  width: 100%;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 60px ${p => p.theme.colors.accent.main}12, 0 20px 40px rgba(0,0,0,0.15);
  animation: ${fadeUp} 0.6s 0.2s ease both;
  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg,
      ${p => p.theme.colors.primary.main},
      ${p => p.theme.colors.accent.main},
      ${p => p.theme.colors.info.main}
    );
  }
`;

const PricingBadge = styled.div<{ theme: any }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.875rem;
  border-radius: 999px;
  background: ${p => p.theme.colors.accent.main}15;
  border: 1px solid ${p => p.theme.colors.accent.main}50;
  color: ${p => p.theme.colors.accent.main};
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
`;

const PricingAmount = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
`;

const PricingCurrency = styled.span<{ theme: any }>`
  font-size: 1.25rem;
  font-weight: 600;
  opacity: 0.6;
  align-self: flex-start;
  margin-top: 0.5rem;
  color: ${p => p.theme.colors.base.content};
`;

const PricingNumber = styled.span<{ theme: any }>`
  font-family: 'DM Serif Display', serif;
  font-size: 3.5rem;
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.03em;
  color: ${p => p.theme.colors.base.content};
`;

const PricingPer = styled.span<{ theme: any }>`
  font-size: 0.875rem;
  opacity: 0.45;
  color: ${p => p.theme.colors.base.content};
`;

const PricingSub = styled.p<{ theme: any }>`
  font-size: 0.8125rem;
  opacity: 0.4;
  margin: 0 0 1.75rem 0;
  color: ${p => p.theme.colors.base.content};
`;

const PricingFeatures = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 2rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
`;

const PricingFeature = styled.li<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.875rem;
  opacity: 0.8;
  color: ${p => p.theme.colors.base.content};
`;

const PricingCheck = styled.span<{ theme: any }>`
  width: 18px; height: 18px; min-width: 18px;
  border-radius: 50%;
  background: ${p => p.theme.colors.accent.main}20;
  border: 1px solid ${p => p.theme.colors.accent.main}50;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.colors.accent.main};
  svg { width: 9px; height: 9px; }
`;

const PricingCta = styled(Link)<{ theme: any }>`
  width: 100%;
  padding: 0.9rem 1.5rem;
  border-radius: ${p => p.theme.radius.field};
  border: none;
  background: ${p => p.theme.colors.primary.main};
  color: ${p => p.theme.colors.primary.content};
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  &:hover {
    background: ${p => p.theme.colors.accent.main};
    color: ${p => p.theme.colors.accent.content};
    transform: translateY(-2px);
    box-shadow: 0 8px 28px ${p => p.theme.colors.accent.main}40;
  }
`;

const PricingDisclaimer = styled.p<{ theme: any }>`
  font-size: 0.72rem;
  opacity: 0.35;
  text-align: center;
  margin: 1rem 0 0 0;
  line-height: 1.5;
  color: ${p => p.theme.colors.base.content};
`;

// ── Features & Pricing data ───────────────────────────────
const FEATURES = (theme: any) => [
  {
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/></svg>,
    title: 'AI Email Generation',
    desc: 'Generate plain text, HTML, and template emails per company — personalized using your campaign settings and company data.',
  },
  {
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>,
    title: 'Bulk Campaigns',
    desc: 'Send to hundreds of companies in one action. Generate, review, and dispatch bulk emails with configurable scheduling.',
  },
  {
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    title: 'Smart Scheduling',
    desc: 'Schedule emails with smart staggering — set start time, interval, and increment to avoid spam filters.',
  },
  {
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    title: 'Open Tracking',
    desc: 'Track sent, read, failed, draft, and scheduled emails in real time. Campaign-level and company-level read rates.',
  },
  {
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    title: 'Company Management',
    desc: 'Organize companies by categories. Import via CSV, add manually, or let AI discover prospects for you.',
  },
  {
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
    title: 'Attachment Management',
    desc: 'Attach files to campaigns globally or per company. Inherit settings automatically or configure per campaign.',
  },
];

const PRICING_FEATURES = [
  'Unlimited AI-powered email campaigns',
  'Bulk email generation & scheduling',
  'Smart company discovery & management',
  'HTML & template email support',
  'Attachment management',
  'Email open tracking & analytics',
  'Smart scheduling with stagger control',
];

// ── Component ─────────────────────────────────────────────
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = theme.colors.base[100];
    return () => { document.body.style.backgroundColor = prev; };
  }, [theme]);



  return (
    <>
      <LandingFont />
      <Root theme={theme}>
        <Navbar isLandingPage user={user ? { username: user.username } : undefined} />

        {/* ── Hero ── */}
        <HeroWrap theme={theme}>
          <HeroInner>
            <HeroBadge theme={theme}>
              <BadgeDot theme={theme} />
              AI-Powered Outreach Platform
            </HeroBadge>

            <HeroTitle theme={theme}>
              Personalized outreach<br />
              at scale. <em>AI writes</em><br />
              you close.
            </HeroTitle>

            <HeroSub theme={theme}>
              Generate personalized emails for every company in your pipeline.
              Manage campaigns, track opens, and schedule sends — all from one place.
            </HeroSub>

            <HeroCtas>
              <PrimaryBtn theme={theme} to="/auth?tab=register">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                Get Started
              </PrimaryBtn>
              <SecondaryBtn theme={theme} to="/auth?tab=login">
                Login
              </SecondaryBtn>
            </HeroCtas>

            {/* Dashboard mockup */}
            <PreviewWrap theme={theme}>
              <PreviewFrame theme={theme}>
                <PreviewBar theme={theme}>
                  <PreviewDot $c="#ff5f57" />
                  <PreviewDot $c="#ffbd2e" />
                  <PreviewDot $c="#28ca41" />
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', opacity: 0.3, fontFamily: 'DM Sans', color: theme.colors.base.content }}>
                    app.aimly.io/campaigns
                  </span>
                </PreviewBar>
                <PreviewContent>
                  <PreviewCard theme={theme} $accent={theme.colors.success.main}>
                    <PreviewLabel theme={theme}>Sent</PreviewLabel>
                    <PreviewValue $color={theme.colors.success.main}>2,841</PreviewValue>
                  </PreviewCard>
                  <PreviewCard theme={theme} $accent={theme.colors.info.main}>
                    <PreviewLabel theme={theme}>Read Rate</PreviewLabel>
                    <PreviewValue $color={theme.colors.info.main}>34.2%</PreviewValue>
                  </PreviewCard>
                  <PreviewCard theme={theme} $accent={theme.colors.accent.main}>
                    <PreviewLabel theme={theme}>Campaigns</PreviewLabel>
                    <PreviewValue $color={theme.colors.accent.main}>12</PreviewValue>
                  </PreviewCard>
                </PreviewContent>
                <PreviewBar2>
                  <PreviewRow $w="85%" $color={theme.colors.primary.main + '60'} />
                  <PreviewRow $w="62%" $color={theme.colors.accent.main + '50'} />
                  <PreviewRow $w="43%" $color={theme.colors.info.main + '50'} />
                  <PreviewRow $w="71%" $color={theme.colors.primary.main + '40'} />
                </PreviewBar2>
              </PreviewFrame>
            </PreviewWrap>
          </HeroInner>
        </HeroWrap>

        {/* ── Stats Strip ── */}
        <StatsStrip theme={theme}>
          {[
            { num: PADDLE_ENABLED ? '15-day' : 'Early', desc: PADDLE_ENABLED ? 'Free Trial' : 'Access' },
            { num: '∞',      desc: 'Campaigns'  },
            { num: 'AI',     desc: 'Powered'    },
            { num: '$0',     desc: 'Setup Fee'  },
          ].map(({ num, desc }) => (
            <StatItem key={desc} theme={theme}>
              <StatNum theme={theme}>{num}</StatNum>
              <StatDesc theme={theme}>{desc}</StatDesc>
            </StatItem>
          ))}
        </StatsStrip>

        {/* ── Features ── */}
        <Section>
          <SectionLabel theme={theme}>Features</SectionLabel>
          <SectionTitle theme={theme}>
            Everything you need to<br />
            <em>run outreach at scale</em>
          </SectionTitle>
          <SectionSub theme={theme}>
            Built for sales teams and founders who want results.
            Not another tool to babysit — Aimly does the heavy lifting.
          </SectionSub>

          <FeaturesGrid>
            {FEATURES(theme).map((f, i) => (
              <FeatureCard key={f.title} theme={theme} $delay={`${0.1 + i * 0.07}s`}>
                <FeatureIcon theme={theme}>{f.icon}</FeatureIcon>
                <FeatureTitle theme={theme}>{f.title}</FeatureTitle>
                <FeatureDesc theme={theme}>{f.desc}</FeatureDesc>
              </FeatureCard>
            ))}
          </FeaturesGrid>
        </Section>

        <Divider theme={theme} />

        {/* ── How It Works ── */}
        <Section>
          <SectionLabel theme={theme}>How It Works</SectionLabel>
          <SectionTitle theme={theme}>
            Up and running<br />
            <em>in minutes</em>
          </SectionTitle>
          <SectionSub theme={theme}>
            No complex setup. No long onboarding.
            Three steps and you're sending personalized emails at scale.
          </SectionSub>

          <HowGrid>
            {[
              { n: '1', title: 'Add Your Companies',  desc: 'Import manually, upload a CSV, or let our AI discover prospects based on your target criteria.', delay: '0.1s' },
              { n: '2', title: 'Generate AI Emails',   desc: 'Set your campaign tone, goal, and CTA. Aimly writes a personalized email for every company automatically.', delay: '0.2s' },
              { n: '3', title: 'Send & Track',          desc: 'Send instantly or schedule with smart staggering. Watch read rates and engagement in real time.', delay: '0.3s' },
            ].map(s => (
              <HowStep key={s.n} $delay={s.delay}>
                <StepNumber theme={theme}>{s.n}</StepNumber>
                <StepTitle theme={theme}>{s.title}</StepTitle>
                <StepDesc theme={theme}>{s.desc}</StepDesc>
              </HowStep>
            ))}
          </HowGrid>
        </Section>

        <Divider theme={theme} />

        {/* ── Pricing ── */}
        <Section $pad="5rem 2rem 6rem">
          <div style={{ textAlign: 'center' }}>
            <SectionLabel theme={theme}>Pricing</SectionLabel>
            <SectionTitle theme={theme}>Simple, transparent pricing</SectionTitle>
            <SectionSub theme={theme} style={{ margin: '0 auto' }}>
              One plan. Everything included. Start free, cancel anytime.
            </SectionSub>
          </div>

          <PricingWrap>
            <PricingCard theme={theme}>
              {!PADDLE_ENABLED && (
                <ComingSoonBanner theme={theme}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Payments not yet active — access is currently free
                </ComingSoonBanner>
              )}
              <PricingBadge theme={theme}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {PADDLE_ENABLED ? '15-day free trial' : 'Early Access'}
              </PricingBadge>

              <PricingAmount>
                <PricingCurrency theme={theme}>$</PricingCurrency>
                <PricingNumber theme={theme}>29</PricingNumber>
                <PricingPer theme={theme}>/month</PricingPer>
              </PricingAmount>
              <PricingSub theme={theme}>Billed monthly · Cancel anytime</PricingSub>

              <PricingFeatures>
                {PRICING_FEATURES.map(f => (
                  <PricingFeature key={f} theme={theme}>
                    <PricingCheck theme={theme}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </PricingCheck>
                    {f}
                  </PricingFeature>
                ))}
              </PricingFeatures>

              <PricingCta theme={theme} to="/auth?tab=register">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                Get Started
              </PricingCta>
              <PricingDisclaimer theme={theme}>
                Card required. No charge for 15 days.
              </PricingDisclaimer>
            </PricingCard>
          </PricingWrap>
        </Section>

        <Footer />
      </Root>
    </>
  );
};

export default LandingPage;