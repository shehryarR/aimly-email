/**
 * TermsOfService.tsx — fully theme-aware, no hardcoded colors
 */
import React, { useEffect } from 'react';
import styled from 'styled-components';
import { useTheme } from '../../theme/styles';
import Navbar from '../../template/navbar';
import Footer from '../../template/footer';
import { useAuth } from '../../App';

const Root = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[100]};
  color: ${p => p.theme.colors.base.content};
  min-height: 100vh;
`;
const Hero = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  padding: 3.5rem 2rem;
  text-align: center;

  @media (max-width: 640px) { padding: 2.5rem 1.25rem; }
  @media (max-width: 480px) { padding: 2rem 1rem; }
`;
const HeroLabel = styled.div<{ theme: any }>`
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: ${p => p.theme.colors.accent.main}; margin-bottom: 0.75rem;
`;
const HeroTitle = styled.h1<{ theme: any }>`
  font-size: 2.25rem; font-weight: 700; letter-spacing: -0.03em;
  margin: 0 0 0.5rem 0; color: ${p => p.theme.colors.base.content};

  @media (max-width: 480px) { font-size: 1.5rem; }
`;
const HeroDate = styled.p<{ theme: any }>`
  font-size: 0.8125rem; opacity: 0.55; margin: 0; color: ${p => p.theme.colors.base.content};
`;
const Body = styled.div`
  max-width: 760px; margin: 0 auto; padding: 4rem 2rem;

  @media (max-width: 640px) { padding: 2.5rem 1.25rem; }
  @media (max-width: 480px) { padding: 1.75rem 1rem; }
`;
const Section = styled.section`margin-bottom: 2.75rem;`;
const SectionTitle = styled.h2<{ theme: any }>`
  font-size: 1.0625rem; font-weight: 700; letter-spacing: -0.01em;
  margin: 0 0 0.875rem 0; color: ${p => p.theme.colors.base.content};
  padding-bottom: 0.625rem; border-bottom: 1px solid ${p => p.theme.colors.base[300]};
`;
const P = styled.p<{ theme: any }>`
  font-size: 0.9375rem; font-weight: 400; line-height: 1.85; opacity: 0.85;
  margin: 0 0 0.875rem 0; color: ${p => p.theme.colors.base.content};
  &:last-child { margin-bottom: 0; }
`;
const Ul = styled.ul`padding-left: 1.25rem; margin: 0 0 0.875rem 0; display: flex; flex-direction: column; gap: 0.4rem;`;
const Li = styled.li<{ theme: any }>`
  font-size: 0.9375rem; font-weight: 400; line-height: 1.75; opacity: 0.85; color: ${p => p.theme.colors.base.content};
`;
const ContactBox = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]}; border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box}; padding: 1.5rem; margin-top: 1rem;
`;
const ContactLine = styled.p<{ theme: any }>`
  font-size: 0.9rem; opacity: 0.8; margin: 0 0 0.3rem 0;
  color: ${p => p.theme.colors.base.content}; &:last-child { margin: 0; }
`;

const TermsOfService: React.FC = () => {
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
        <HeroTitle theme={theme}>Terms of Service</HeroTitle>
        <HeroDate theme={theme}>Last updated: April 27, 2026</HeroDate>
      </Hero>
      <Body>
        <Section>
          <SectionTitle theme={theme}>1. Acceptance of Terms</SectionTitle>
          <P theme={theme}>By accessing or using Aimly, a product of Orzeh Technologies, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.</P>
          <P theme={theme}>These terms apply to all users of the platform, including visitors, registered users, and subscribers. Orzeh Technologies reserves the right to update these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>2. Description of Service</SectionTitle>
          <P theme={theme}>Aimly is an AI-powered email outreach platform that allows users to generate, manage, and track personalized email campaigns. The service includes features such as bulk email generation, company management, scheduling, and analytics.</P>
          <P theme={theme}>We reserve the right to modify, suspend, or discontinue any part of the service at any time without prior notice.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>3. Account Registration</SectionTitle>
          <P theme={theme}>To use Aimly, you must create an account. You agree to:</P>
          <Ul>
            <Li theme={theme}>Provide accurate and complete information during registration</Li>
            <Li theme={theme}>Maintain the security of your account credentials</Li>
            <Li theme={theme}>Notify us immediately of any unauthorized access to your account</Li>
            <Li theme={theme}>Be responsible for all activities that occur under your account</Li>
          </Ul>
          <P theme={theme}>You must be at least 18 years old to create an account. By registering, you confirm that you meet this requirement.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>4. Subscription and Billing</SectionTitle>
          <P theme={theme}>Aimly operates on a subscription basis. By subscribing, you agree to pay the applicable fees as described on our pricing page. Subscriptions include a 15-day free trial period, after which billing commences automatically.</P>
          <P theme={theme}>All payments are processed securely through Paddle, our payment provider. We do not store your payment card information on our servers.</P>
          <Ul>
            <Li theme={theme}>Subscription fees are billed monthly</Li>
            <Li theme={theme}>You may cancel your subscription at any time</Li>
            <Li theme={theme}>Cancellation takes effect at the end of the current billing period</Li>
            <Li theme={theme}>No partial refunds are issued for unused portions of a billing period</Li>
          </Ul>
        </Section>
        <Section>
          <SectionTitle theme={theme}>5. Acceptable Use</SectionTitle>
          <P theme={theme}>You agree not to use Aimly to:</P>
          <Ul>
            <Li theme={theme}>Send spam, unsolicited bulk email, or messages that violate anti-spam laws</Li>
            <Li theme={theme}>Engage in any illegal activity or violate any applicable laws or regulations</Li>
            <Li theme={theme}>Attempt to gain unauthorized access to our systems or other users' accounts</Li>
            <Li theme={theme}>Transmit any malicious code, viruses, or harmful content</Li>
            <Li theme={theme}>Impersonate any person or entity</Li>
            <Li theme={theme}>Violate the intellectual property rights of any third party</Li>
          </Ul>
          <P theme={theme}>We reserve the right to terminate accounts that violate these terms without prior notice.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>6. Intellectual Property</SectionTitle>
          <P theme={theme}>All content, features, and functionality of Aimly — including but not limited to software, text, graphics, logos, and design — are the exclusive property of Orzeh Technologies and are protected by applicable intellectual property laws.</P>
          <P theme={theme}>You retain ownership of any content you create using the platform. By using Aimly, you grant Orzeh Technologies a limited license to process your content solely for the purpose of providing the service.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>7. Limitation of Liability</SectionTitle>
          <P theme={theme}>To the fullest extent permitted by law, Orzeh Technologies shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of Aimly or inability to use the service.</P>
          <P theme={theme}>Our total liability to you for any claims arising from these terms or your use of the service shall not exceed the amount you paid us in the 12 months preceding the claim.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>8. Termination</SectionTitle>
          <P theme={theme}>You may terminate your account at any time by canceling your subscription through the billing portal. We may terminate or suspend your access immediately, without prior notice, for conduct that we believe violates these terms or is harmful to other users, us, or third parties.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>9. Anti-Spam &amp; Acceptable Use of Outreach</SectionTitle>
          <P theme={theme}><strong>9.1 Compliance with Laws.</strong> You agree to comply with all applicable laws governing electronic communications, including but not limited to the CAN-SPAM Act (US), GDPR (EU), PECR (UK), and CASL (Canada).</P>
          <P theme={theme}><strong>9.2 Consent and Legitimate Interest.</strong> You represent and warrant that:</P>
          <Ul>
            <Li theme={theme}>All contacts are sourced from publicly available business information or you have obtained appropriate consent.</Li>
            <Li theme={theme}>You have a legitimate business interest in contacting each recipient prior to engaging them.</Li>
            <Li theme={theme}>You will not use Aimly to send unsolicited bulk commercial messages (spam).</Li>
          </Ul>
          <P theme={theme}><strong>9.3 Mandatory Opt-Out.</strong> Every message sent through Aimly includes a mandatory one-click unsubscribe mechanism. Unsubscribed addresses are automatically suppressed from future communications. This feature is enforced at the platform level and cannot be removed or disabled by users.</P>
          <P theme={theme}><strong>9.4 Prohibited Activities.</strong> You may not:</P>
          <Ul>
            <Li theme={theme}>Send emails to purchased or scraped lists not verified as public business contacts.</Li>
            <Li theme={theme}>Email individuals who have previously opted out.</Li>
            <Li theme={theme}>Engage in spoofing, phishing, or deceptive practices.</Li>
            <Li theme={theme}>Misrepresent your identity or the purpose of your communication.</Li>
            <Li theme={theme}>Circumvent sending limits or platform safeguards.</Li>
          </Ul>
          <P theme={theme}><strong>9.5 Enforcement.</strong> Violations may result in immediate account suspension or termination. We reserve the right to report illegal activity to relevant authorities.</P>
          <P theme={theme}><strong>9.6 Reporting Abuse.</strong> Report spam or abuse to abuse@aimly.online. We investigate all reports within 48 hours.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>10. Governing Law</SectionTitle>
          <P theme={theme}>These terms are governed by and construed in accordance with applicable laws. Any disputes arising from these terms shall be resolved through binding arbitration.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>11. Contact Us</SectionTitle>
          <P theme={theme}>If you have any questions about these Terms of Service, please contact us:</P>
          <ContactBox theme={theme}>
            <ContactLine theme={theme}>Orzeh Technologies</ContactLine>
            <ContactLine theme={theme}>Product: Aimly</ContactLine>
            <ContactLine theme={theme}>Email: legal@aimly.online</ContactLine>
          </ContactBox>
        </Section>
      </Body>
      <Footer />
    </Root>
  );
};

export default TermsOfService;