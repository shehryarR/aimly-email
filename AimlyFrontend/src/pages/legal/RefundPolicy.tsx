/**
 * RefundPolicy.tsx — fully theme-aware, no hardcoded colors
 */
import React, { useEffect } from 'react';
import styled from 'styled-components';
import { useTheme } from '../../theme/styles';
import Navbar from '../../template/navbar';
import Footer from '../../template/footer';
import { useAuth } from '../../App';

const Root = styled.div<{ theme: any }>`background: ${p => p.theme.colors.base[100]}; color: ${p => p.theme.colors.base.content}; min-height: 100vh;`;
const Hero = styled.div<{ theme: any }>`background: ${p => p.theme.colors.base[200]}; border-bottom: 1px solid ${p => p.theme.colors.base[300]}; padding: 3.5rem 2rem; text-align: center;`;
const HeroLabel = styled.div<{ theme: any }>`font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${p => p.theme.colors.accent.main}; margin-bottom: 0.75rem;`;
const HeroTitle = styled.h1<{ theme: any }>`font-size: 2.25rem; font-weight: 700; letter-spacing: -0.03em; margin: 0 0 0.5rem 0; color: ${p => p.theme.colors.base.content};`;
const HeroDate = styled.p<{ theme: any }>`font-size: 0.8125rem; opacity: 0.4; margin: 0; color: ${p => p.theme.colors.base.content};`;
const Body = styled.div`max-width: 760px; margin: 0 auto; padding: 4rem 2rem;`;
const Section = styled.section`margin-bottom: 2.75rem;`;
const SectionTitle = styled.h2<{ theme: any }>`font-size: 1.0625rem; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 0.875rem 0; color: ${p => p.theme.colors.base.content}; padding-bottom: 0.625rem; border-bottom: 1px solid ${p => p.theme.colors.base[300]};`;
const P = styled.p<{ theme: any }>`font-size: 0.9rem; line-height: 1.8; opacity: 0.65; margin: 0 0 0.875rem 0; color: ${p => p.theme.colors.base.content}; &:last-child { margin-bottom: 0; }`;
const Ul = styled.ul`padding-left: 1.25rem; margin: 0 0 0.875rem 0; display: flex; flex-direction: column; gap: 0.4rem;`;
const Li = styled.li<{ theme: any }>`font-size: 0.9rem; line-height: 1.7; opacity: 0.65; color: ${p => p.theme.colors.base.content};`;
const HighlightBox = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.accent.main}10;
  border: 1px solid ${p => p.theme.colors.accent.main}40;
  border-radius: ${p => p.theme.radius.box};
  padding: 1.25rem 1.5rem;
  margin-bottom: 2rem;
`;
const HighlightText = styled.p<{ theme: any }>`font-size: 0.9rem; line-height: 1.7; color: ${p => p.theme.colors.accent.main}; margin: 0; font-weight: 500;`;
const ContactBox = styled.div<{ theme: any }>`background: ${p => p.theme.colors.base[200]}; border: 1px solid ${p => p.theme.colors.base[300]}; border-radius: ${p => p.theme.radius.box}; padding: 1.5rem; margin-top: 1rem;`;
const ContactLine = styled.p<{ theme: any }>`font-size: 0.875rem; opacity: 0.6; margin: 0 0 0.3rem 0; color: ${p => p.theme.colors.base.content}; &:last-child { margin: 0; }`;

const RefundPolicy: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    document.body.style.backgroundColor = theme.colors.base[100];
    window.scrollTo(0, 0);
  }, [theme]);

  return (
    <Root theme={theme}>
      <Navbar isLandingPage user={user ? { username: user.username } : undefined} />
      <Hero theme={theme}>
        <HeroLabel theme={theme}>Legal</HeroLabel>
        <HeroTitle theme={theme}>Refund Policy</HeroTitle>
        <HeroDate theme={theme}>Last updated: January 1, 2025</HeroDate>
      </Hero>
      <Body>
        <HighlightBox theme={theme}>
          <HighlightText theme={theme}>Aimly offers a 15-day free trial. You will not be charged during the trial period. Cancel anytime before the trial ends to avoid any charges.</HighlightText>
        </HighlightBox>
        <Section>
          <SectionTitle theme={theme}>1. Free Trial</SectionTitle>
          <P theme={theme}>All new Aimly subscriptions include a 15-day free trial. During this period, you have full access to all platform features. You will not be charged until your trial ends.</P>
          <P theme={theme}>To avoid being charged, you must cancel your subscription before the trial period expires. Cancellation can be done at any time through the billing portal in your account settings.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>2. Cancellation Policy</SectionTitle>
          <P theme={theme}>You may cancel your Aimly subscription at any time. Cancellations take effect at the end of your current billing period — you will retain access to the platform until then.</P>
          <Ul>
            <Li theme={theme}>Cancellations must be made before the next billing date to avoid being charged</Li>
            <Li theme={theme}>Access continues until the end of the current billing period</Li>
            <Li theme={theme}>No partial refunds are issued for unused days within a billing period</Li>
            <Li theme={theme}>Canceling does not delete your account or data immediately</Li>
          </Ul>
        </Section>
        <Section>
          <SectionTitle theme={theme}>3. Refund Eligibility</SectionTitle>
          <P theme={theme}>As a general policy, we do not offer refunds for subscription payments once a billing period has started. However, we review refund requests on a case-by-case basis.</P>
          <P theme={theme}>Refunds may be considered in the following circumstances:</P>
          <Ul>
            <Li theme={theme}>You were charged due to a technical error on our part</Li>
            <Li theme={theme}>You were charged after canceling your subscription</Li>
            <Li theme={theme}>Duplicate charges occurred on your account</Li>
            <Li theme={theme}>The service was unavailable for an extended period due to our error</Li>
          </Ul>
          <P theme={theme}>Refund requests must be submitted within 7 days of the charge in question. Requests submitted after this window may not be eligible.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>4. Non-Refundable Situations</SectionTitle>
          <P theme={theme}>The following are not eligible for refunds:</P>
          <Ul>
            <Li theme={theme}>Forgetting to cancel before the trial period ends</Li>
            <Li theme={theme}>Not using the service during a paid billing period</Li>
            <Li theme={theme}>Dissatisfaction with AI-generated email quality</Li>
            <Li theme={theme}>Account termination due to violation of our Terms of Service</Li>
            <Li theme={theme}>Requests submitted more than 7 days after the charge date</Li>
          </Ul>
        </Section>
        <Section>
          <SectionTitle theme={theme}>5. How to Request a Refund</SectionTitle>
          <P theme={theme}>To request a refund, please contact us at the email below with the following information:</P>
          <Ul>
            <Li theme={theme}>Your registered email address</Li>
            <Li theme={theme}>The date and amount of the charge</Li>
            <Li theme={theme}>The reason for your refund request</Li>
          </Ul>
          <P theme={theme}>We aim to respond to all refund requests within 3 business days. Approved refunds are processed through Paddle and may take 5–10 business days to appear on your statement.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>6. Changes to This Policy</SectionTitle>
          <P theme={theme}>Orzeh Technologies reserves the right to modify this Refund Policy at any time. Changes will be posted on this page with an updated date. Continued use of the service constitutes acceptance of the updated policy.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>7. Contact Us</SectionTitle>
          <P theme={theme}>For refund requests or billing questions, please contact us:</P>
          <ContactBox theme={theme}>
            <ContactLine theme={theme}>Orzeh Technologies</ContactLine>
            <ContactLine theme={theme}>Product: Aimly</ContactLine>
            <ContactLine theme={theme}>Email: billing@aimly.online</ContactLine>
          </ContactBox>
        </Section>
      </Body>
      <Footer />
    </Root>
  );
};

export default RefundPolicy;