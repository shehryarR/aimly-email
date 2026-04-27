/**
 * LandingPage.tsx — Aimly public marketing page
 * All styled components use theme prop from useTheme() — no hardcoded colors.
 * Responds correctly to dark/light theme toggle.
 */

import React, { useEffect } from 'react';
import styled, { keyframes, createGlobalStyle } from 'styled-components';
import { Link } from 'react-router-dom';

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
`;

const Section = styled.section<{ $pad?: string }>`
  max-width: 1140px;
  margin: 0 auto;
  padding: ${p => p.$pad || '6rem 2rem'};
  position: relative;
  z-index: 1;

  @media (max-width: 768px) { padding: ${p => p.$pad ? '3rem 1.25rem' : '4rem 1.25rem'}; }
  @media (max-width: 480px) { padding: ${p => p.$pad ? '2.5rem 1rem' : '3rem 1rem'}; }
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

  @media (max-width: 768px) { padding: 4.5rem 1.25rem 3.5rem; }
  @media (max-width: 480px) { padding: 3.5rem 1rem 2.5rem; }
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
  font-weight: 400;
  line-height: 1.75;
  opacity: 0.8;
  max-width: 540px;
  margin: 0 0 2.75rem 0;
  color: ${p => p.theme.colors.base.content};
  animation: ${fadeUp} 0.6s 0.2s ease both;

  @media (max-width: 480px) { font-size: 1rem; margin-bottom: 2rem; }
`;

const HeroCtas = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
  animation: ${fadeUp} 0.6s 0.3s ease both;

  @media (max-width: 480px) {
    width: 100%;
    flex-direction: column;
    gap: 0.75rem;
    a { width: 100%; justify-content: center; }
  }
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
  opacity: 0.9;
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

  @media (max-width: 768px) { margin-top: 2.5rem; }
  @media (max-width: 480px) { display: none; }
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

  @media (max-width: 640px) { grid-template-columns: 1fr; gap: 0.625rem; padding: 1rem; }
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
  opacity: 0.55;
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

  @media (max-width: 580px) {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
`;

const StatItem = styled.div<{ theme: any }>`
  flex: 1;
  padding: 1.5rem 2rem;
  text-align: center;
  border-right: 1px solid ${p => p.theme.colors.base[300]};
  &:last-child { border-right: none; }

  @media (max-width: 580px) {
    padding: 1.25rem 1rem;
    border-right: 1px solid ${p => p.theme.colors.base[300]};
    border-bottom: 1px solid ${p => p.theme.colors.base[300]};
    /* Remove right border on even items (right column), remove bottom border on last two */
    &:nth-child(2n) { border-right: none; }
    &:nth-last-child(-n+2) { border-bottom: none; }
  }
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
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
  color: ${p => p.theme.colors.base.content};
`;

// ── Trust Strip ───────────────────────────────────────────
const TrustStrip = styled.div<{ theme: any }>`
  border-top: 1px solid ${p => p.theme.colors.base[300]};
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[200]};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0;
  position: relative;
  z-index: 1;
`;

const TrustItem = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  border-right: 1px solid ${p => p.theme.colors.base[300]};
  font-size: 0.8rem;
  font-weight: 500;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.75;
  &:last-child { border-right: none; }
  svg { color: ${p => p.theme.colors.accent.main}; flex-shrink: 0; }

  @media (max-width: 640px) {
    padding: 0.875rem 1.25rem;
    border-right: none;
    border-bottom: 1px solid ${p => p.theme.colors.base[300]};
    width: 100%;
    justify-content: center;
    &:last-child { border-bottom: none; }
  }
`;
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
  font-weight: 400;
  line-height: 1.75;
  opacity: 0.8;
  max-width: 520px;
  margin: 0;
  color: ${p => p.theme.colors.base.content};

  @media (max-width: 480px) { font-size: 0.9375rem; }
`;

// ── Features ──────────────────────────────────────────────
const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  margin-top: 3.5rem;

  @media (max-width: 768px) { grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-top: 2.5rem; }
  @media (max-width: 480px) { grid-template-columns: 1fr; gap: 0.875rem; margin-top: 2rem; }
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
  font-size: 0.9375rem;
  font-weight: 400;
  line-height: 1.75;
  opacity: 0.8;
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

  @media (max-width: 768px) { grid-template-columns: 1fr; gap: 2.5rem; margin-top: 2.5rem; }
  @media (max-width: 480px) { gap: 2rem; margin-top: 2rem; }
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
  font-size: 0.9375rem;
  font-weight: 400;
  line-height: 1.75;
  opacity: 0.8;
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
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
`;

const PricingWrap = styled.div`
  display: flex;
  justify-content: center;
  gap: 1.25rem;
  margin-top: 3.5rem;
  flex-wrap: wrap;

  @media (max-width: 768px) { gap: 1rem; margin-top: 2rem; }
  @media (max-width: 480px) { flex-direction: column; align-items: stretch; gap: 0.875rem; }
`;

const PricingCard = styled.div<{ theme: any; $highlighted: boolean }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.$highlighted
    ? p.theme.colors.accent.main + '60'
    : p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 2rem 1.75rem;
  width: 280px;
  position: relative;
  overflow: hidden;
  box-shadow: ${p => p.$highlighted
    ? `0 0 60px ${p.theme.colors.accent.main}12, 0 20px 40px rgba(0,0,0,0.15)`
    : '0 4px 16px rgba(0,0,0,0.06)'};
  animation: ${fadeUp} 0.6s 0.2s ease both;
  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: ${p => p.$highlighted
      ? `linear-gradient(90deg, ${p.theme.colors.primary.main}, ${p.theme.colors.accent.main}, ${p.theme.colors.info.main})`
      : p.theme.colors.base[300]};
  }

  @media (max-width: 860px) { width: 240px; padding: 1.75rem 1.375rem; }
  @media (max-width: 480px) { width: 100%; padding: 1.5rem 1.25rem; }
`;

const PricingPopularBadge = styled.div<{ theme: any }>`
  position: absolute;
  top: 12px; right: 12px;
  background: ${p => p.theme.colors.accent.main};
  color: ${p => p.theme.colors.accent.content};
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
`;

const PricingBadge = styled.div<{ theme: any }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: ${p => p.theme.colors.accent.main}15;
  border: 1px solid ${p => p.theme.colors.accent.main}50;
  color: ${p => p.theme.colors.accent.main};
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 1.1rem;
`;

const PricingPlanName = styled.div<{ theme: any }>`
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.6;
  margin-bottom: 0.15rem;
  color: ${p => p.theme.colors.base.content};
`;

const PricingIdealFor = styled.div<{ theme: any }>`
  font-size: 0.72rem;
  opacity: 0.4;
  margin-bottom: 0.9rem;
  color: ${p => p.theme.colors.base.content};
`;

const PricingAmount = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  margin-bottom: 0.25rem;
`;

const PricingCurrency = styled.span<{ theme: any }>`
  font-size: 1.1rem;
  font-weight: 600;
  opacity: 0.7;
  align-self: flex-start;
  margin-top: 0.4rem;
  color: ${p => p.theme.colors.base.content};
`;

const PricingNumber = styled.span<{ theme: any }>`
  font-family: 'DM Serif Display', serif;
  font-size: 3rem;
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.03em;
  color: ${p => p.theme.colors.base.content};
`;

const PricingPer = styled.span<{ theme: any }>`
  font-size: 0.8125rem;
  opacity: 0.55;
  color: ${p => p.theme.colors.base.content};
`;

const PricingSub = styled.p<{ theme: any }>`
  font-size: 0.75rem;
  opacity: 0.55;
  margin: 0 0 1rem 0;
  color: ${p => p.theme.colors.base.content};
`;



const PricingHr = styled.div<{ theme: any }>`
  height: 1px;
  background: ${p => p.theme.colors.base[300]};
  margin-bottom: 1rem;
`;

const PricingFeatures = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const PricingFeature = styled.li<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.8125rem;
  opacity: 0.85;
  color: ${p => p.theme.colors.base.content};
`;

const PricingCheck = styled.span<{ theme: any }>`
  width: 15px; height: 15px; min-width: 15px;
  border-radius: 50%;
  background: ${p => p.theme.colors.accent.main}20;
  border: 1px solid ${p => p.theme.colors.accent.main}50;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.colors.accent.main};
  svg { width: 8px; height: 8px; }
`;

const PricingCta = styled(Link)<{ theme: any; $primary: boolean }>`
  width: 100%;
  padding: 0.75rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  border: ${p => p.$primary ? 'none' : `1px solid ${p.theme.colors.base[300]}`};
  background: ${p => p.$primary ? p.theme.colors.primary.main : 'transparent'};
  color: ${p => p.$primary ? p.theme.colors.primary.content : p.theme.colors.base.content};
  font-family: 'DM Sans', sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  opacity: ${p => p.$primary ? 1 : 0.7};
  text-decoration: none;
  &:hover {
    background: ${p => p.$primary ? p.theme.colors.accent.main : p.theme.colors.base[300]};
    color: ${p => p.$primary ? p.theme.colors.accent.content : p.theme.colors.base.content};
    transform: translateY(-1px);
    opacity: 1;
    box-shadow: ${p => p.$primary ? `0 6px 20px ${p.theme.colors.accent.main}40` : 'none'};
  }
`;

const PricingDisclaimer = styled.p<{ theme: any }>`
  font-size: 0.7rem;
  opacity: 0.5;
  text-align: center;
  margin: 2rem auto 0;
  line-height: 1.5;
  color: ${p => p.theme.colors.base.content};
  max-width: 400px;
`;

const ViewAllLink = styled(Link)<{ theme: any }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: ${p => p.theme.colors.accent.main};
  text-decoration: none;
  font-weight: 500;
  opacity: 0.8;
  transition: opacity 0.15s;
  &:hover { opacity: 1; }
`;

// ── Features & Pricing data ───────────────────────────────
const FEATURES = () => [
  {
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    title: 'AI Lead Discovery',
    desc: 'Find businesses matching your ideal profile using AI agents that search public data sources.',
  },
  {
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v4H3z"/><path d="M3 10h18v4H3z"/><path d="M3 17h18v4H3z"/></svg>,
    title: 'Bulk Campaign Sending',
    desc: 'Send to hundreds of companies in one action. Generate, review, and dispatch bulk emails with configurable scheduling.',
  },
  {
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    title: 'Smart Scheduling',
    desc: 'Schedule emails with smart staggering — set start time, interval, and increment to avoid spam filters.',
  },
];

const LANDING_PLANS = [
  {
    slug: 'solo', name: 'Solo', price: 29, idealFor: 'Solopreneurs',
    dailyCap: '500 emails / day', maxBrands: '1 brand profile', support: 'Email (48h)',
    highlighted: false,
    features: ['1 branding profile', '500 emails per day', 'AI email generation', 'Bulk scheduling', 'Open tracking'],
  },
  {
    slug: 'studio', name: 'Studio', price: 79, idealFor: 'Growing Teams',
    dailyCap: '2,500 emails / day', maxBrands: 'Up to 5 brand profiles', support: 'Priority Email (24h)',
    highlighted: true,
    features: ['5 branding profiles', '2,500 emails per day', 'AI email generation', 'Bulk scheduling', 'Open tracking'],
  },
  {
    slug: 'agency', name: 'Agency', price: 199, idealFor: 'Client Agencies',
    dailyCap: '7,500 emails / day', maxBrands: 'Unlimited brand profiles', support: 'Slack / Discord',
    highlighted: false,
    features: ['Unlimited brand profiles', '7,500 emails per day', 'AI email generation', 'Bulk scheduling', 'Open tracking'],
  },
];

// ── Component ─────────────────────────────────────────────
const LandingPage: React.FC = () => {
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
              AI-Powered B2B Lead Intelligence
            </HeroBadge>

            <HeroTitle theme={theme}>
              AI-Powered B2B{' '}
              Lead Intelligence &amp; <em>Nurturing</em>{' '}
              Platform
            </HeroTitle>

            <HeroSub theme={theme}>
              Discover verified business leads from public sources. Generate personalized outreach emails with AI and send them at scale.
            </HeroSub>

            <HeroCtas>
              {user ? (
                <PrimaryBtn theme={theme} to="/campaigns">
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  Go to Dashboard
                </PrimaryBtn>
              ) : (
                <>
                  <PrimaryBtn theme={theme} to="/auth?tab=register">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    Get Started
                  </PrimaryBtn>
                  <SecondaryBtn theme={theme} to="/auth?tab=login">
                    Login
                  </SecondaryBtn>
                </>
              )}
            </HeroCtas>

            {/* Dashboard mockup */}
            <PreviewWrap theme={theme}>
              <PreviewFrame theme={theme}>
                <PreviewBar theme={theme}>
                  <PreviewDot $c="#ff5f57" />
                  <PreviewDot $c="#ffbd2e" />
                  <PreviewDot $c="#28ca41" />
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', opacity: 0.5, fontFamily: 'DM Sans', color: theme.colors.base.content }}>
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
            Everything you need to <em>run outreach at scale</em>
          </SectionTitle>
          <SectionSub theme={theme}>
            Built for sales teams and founders who want results.
            Not another tool to babysit — Aimly does the heavy lifting.
          </SectionSub>

          <FeaturesGrid>
            {FEATURES().map((f, i) => (
              <FeatureCard key={f.title} theme={theme} $delay={`${0.1 + i * 0.07}s`}>
                <FeatureIcon theme={theme}>{f.icon}</FeatureIcon>
                <FeatureTitle theme={theme}>{f.title}</FeatureTitle>
                <FeatureDesc theme={theme}>{f.desc}</FeatureDesc>
              </FeatureCard>
            ))}
          </FeaturesGrid>
        </Section>

        {/* ── Trust Strip ── */}
        <TrustStrip theme={theme}>
          {[
            {
              icon: <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
              label: 'Mandatory opt-out on every email, enforced by platform',
            },
            {
              icon: <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
              label: 'CAN-SPAM & GDPR compliant',
            },
            {
              icon: <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
              label: 'No spam facilitation',
            },
            {
              icon: <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
              label: 'API keys never stored on our servers',
            },
          ].map(({ icon, label }) => (
            <TrustItem key={label} theme={theme}>
              {icon}{label}
            </TrustItem>
          ))}
        </TrustStrip>

        <Divider theme={theme} />

        {/* ── How It Works ── */}
        <Section>
          <SectionLabel theme={theme}>How It Works</SectionLabel>
          <SectionTitle theme={theme}>
            Up and running <em>in minutes</em>
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
              Three plans to fit every stage. Start free, cancel anytime.
            </SectionSub>
          </div>

          {!PADDLE_ENABLED && (
            <ComingSoonBanner theme={theme} style={{ maxWidth: '960px', margin: '0 auto 1.5rem' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Payments not yet active — access is currently free
            </ComingSoonBanner>
          )}
          <PricingWrap>
            {LANDING_PLANS.map((plan, i) => (
              <PricingCard key={plan.slug} theme={theme} $highlighted={plan.highlighted} style={{ animationDelay: `${i * 0.1}s` }}>
                {plan.highlighted && <PricingPopularBadge theme={theme}>Most Popular</PricingPopularBadge>}
                <PricingBadge theme={theme}>
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  {PADDLE_ENABLED ? '15-day trial' : 'Early Access'}
                </PricingBadge>
                <PricingPlanName theme={theme}>{plan.name}</PricingPlanName>
                <PricingIdealFor theme={theme}>{plan.idealFor}</PricingIdealFor>
                <PricingAmount>
                  <PricingCurrency theme={theme}>$</PricingCurrency>
                  <PricingNumber theme={theme}>{plan.price}</PricingNumber>
                  <PricingPer theme={theme}>/mo</PricingPer>
                </PricingAmount>
                <PricingSub theme={theme}>Billed monthly · Cancel anytime</PricingSub>
                <PricingHr theme={theme} />
                <PricingFeatures>
                  {plan.features.map(f => (
                    <PricingFeature key={f} theme={theme}>
                      <PricingCheck theme={theme}>
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </PricingCheck>
                      {f}
                    </PricingFeature>
                  ))}
                </PricingFeatures>
                <PricingCta theme={theme} $primary={plan.highlighted} to={user ? '/campaigns' : '/auth?tab=register'}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  {user ? 'Go to Dashboard' : 'Get Started'}
                </PricingCta>
              </PricingCard>
            ))}
          </PricingWrap>
          <div style={{ textAlign: 'center' }}>
            <PricingDisclaimer theme={theme}>
              {PADDLE_ENABLED ? 'All plans include a 15-day free trial. No charges until your trial ends.' : 'No payment required during early access.'}
            </PricingDisclaimer>
            <ViewAllLink theme={theme} to="/pricing">
              Compare all plans in detail
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </ViewAllLink>
          </div>
        </Section>

        <Footer />
      </Root>
    </>
  );
};

export default LandingPage;