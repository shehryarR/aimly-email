/**
 * PrivacyPolicy.tsx — fully theme-aware, no hardcoded colors
 */
import React, { useEffect } from 'react';
import styled from 'styled-components';
import { useTheme } from '../../theme/styles';
import Navbar from '../../template/navbar';
import Footer from '../../template/footer';
import { useAuth } from '../../App';

const Root = styled.div<{ theme: any }>`background: ${p => p.theme.colors.base[100]}; color: ${p => p.theme.colors.base.content}; min-height: 100vh;`;
const Hero = styled.div<{ theme: any }>`background: ${p => p.theme.colors.base[200]}; border-bottom: 1px solid ${p => p.theme.colors.base[300]}; padding: 3.5rem 2rem; text-align: center; @media (max-width: 640px) { padding: 2.5rem 1.25rem; } @media (max-width: 480px) { padding: 2rem 1rem; }`;
const HeroLabel = styled.div<{ theme: any }>`font-size: 0.7rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${p => p.theme.colors.accent.main}; margin-bottom: 0.75rem;`;
const HeroTitle = styled.h1<{ theme: any }>`font-size: 2.25rem; font-weight: 700; letter-spacing: -0.03em; margin: 0 0 0.5rem 0; color: ${p => p.theme.colors.base.content}; @media (max-width: 480px) { font-size: 1.5rem; }`;
const HeroDate = styled.p<{ theme: any }>`font-size: 0.8125rem; opacity: 0.55; margin: 0; color: ${p => p.theme.colors.base.content};`;
const Body = styled.div`max-width: 760px; margin: 0 auto; padding: 4rem 2rem; @media (max-width: 640px) { padding: 2.5rem 1.25rem; } @media (max-width: 480px) { padding: 1.75rem 1rem; }`;
const Section = styled.section`margin-bottom: 2.75rem;`;
const SectionTitle = styled.h2<{ theme: any }>`font-size: 1.0625rem; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 0.875rem 0; color: ${p => p.theme.colors.base.content}; padding-bottom: 0.625rem; border-bottom: 1px solid ${p => p.theme.colors.base[300]};`;
const P = styled.p<{ theme: any }>`font-size: 0.9375rem; font-weight: 400; line-height: 1.85; opacity: 0.85; margin: 0 0 0.875rem 0; color: ${p => p.theme.colors.base.content}; &:last-child { margin-bottom: 0; }`;
const Ul = styled.ul`padding-left: 1.25rem; margin: 0 0 0.875rem 0; display: flex; flex-direction: column; gap: 0.4rem;`;
const Li = styled.li<{ theme: any }>`font-size: 0.9375rem; font-weight: 400; line-height: 1.75; opacity: 0.85; color: ${p => p.theme.colors.base.content};`;
const ContactBox = styled.div<{ theme: any }>`background: ${p => p.theme.colors.base[200]}; border: 1px solid ${p => p.theme.colors.base[300]}; border-radius: ${p => p.theme.radius.box}; padding: 1.5rem; margin-top: 1rem;`;
const ContactLine = styled.p<{ theme: any }>`font-size: 0.9rem; opacity: 0.8; margin: 0 0 0.3rem 0; color: ${p => p.theme.colors.base.content}; &:last-child { margin: 0; }`;

const PrivacyPolicy: React.FC = () => {
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
        <HeroTitle theme={theme}>Privacy Policy</HeroTitle>
        <HeroDate theme={theme}>Last updated: January 1, 2025</HeroDate>
      </Hero>
      <Body>
        <Section>
          <SectionTitle theme={theme}>1. Introduction</SectionTitle>
          <P theme={theme}>Orzeh Technologies ("we", "us", "our") operates Aimly. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.</P>
          <P theme={theme}>By using Aimly, you agree to the collection and use of information in accordance with this policy. We take your privacy seriously and are committed to protecting your personal data.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>2. Information We Collect</SectionTitle>
          <P theme={theme}>We collect the following types of information:</P>
          <Ul>
            <Li theme={theme}><strong>Account information</strong> — username, email address, and password hash when you register</Li>
            <Li theme={theme}><strong>Usage data</strong> — how you interact with the platform, features used, and actions taken</Li>
            <Li theme={theme}><strong>Campaign data</strong> — companies, emails, attachments, and content you create within the platform</Li>
            <Li theme={theme}><strong>Payment information</strong> — billing details processed by our payment provider Paddle (we do not store card data)</Li>
            <Li theme={theme}><strong>Technical data</strong> — IP address, browser type, device information, and cookies</Li>
          </Ul>
        </Section>
        <Section>
          <SectionTitle theme={theme}>3. How We Use Your Information</SectionTitle>
          <P theme={theme}>We use the information we collect to:</P>
          <Ul>
            <Li theme={theme}>Provide, operate, and maintain the Aimly platform</Li>
            <Li theme={theme}>Process transactions and manage your subscription</Li>
            <Li theme={theme}>Send administrative emails such as account confirmation and billing notifications</Li>
            <Li theme={theme}>Respond to your support requests and inquiries</Li>
            <Li theme={theme}>Improve and develop new features for the platform</Li>
            <Li theme={theme}>Monitor platform usage and detect security threats</Li>
            <Li theme={theme}>Comply with legal obligations</Li>
          </Ul>
        </Section>
        <Section>
          <SectionTitle theme={theme}>4. Data Storage and Security</SectionTitle>
          <P theme={theme}>Your data is stored on secure servers. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</P>
          <P theme={theme}>Authentication tokens are stored in HttpOnly cookies to prevent client-side access. Passwords are stored as secure hashes and are never stored in plain text.</P>
          <P theme={theme}>While we take all reasonable precautions, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security of your data.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>5. Third-Party Services</SectionTitle>
          <P theme={theme}>We use the following third-party services that may process your data:</P>
          <Ul>
            <Li theme={theme}><strong>Paddle</strong> — payment processing and subscription management</Li>
            <Li theme={theme}><strong>Google</strong> — optional Google OAuth sign-in</Li>
            <Li theme={theme}><strong>reCAPTCHA</strong> — bot protection on authentication forms</Li>
          </Ul>
          <P theme={theme}>Each of these services has their own privacy policy governing their use of your data. We encourage you to review their policies.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>6. Cookies</SectionTitle>
          <P theme={theme}>We use cookies to maintain your session and authentication state. These are essential cookies required for the platform to function — they cannot be disabled without affecting core functionality.</P>
          <P theme={theme}>We do not use tracking cookies for advertising purposes. Your theme preference is stored in localStorage for your convenience.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>7. Data Retention</SectionTitle>
          <P theme={theme}>We retain your personal data for as long as your account is active or as needed to provide the service. If you delete your account, we will delete your personal data within 30 days, except where we are required to retain it for legal purposes.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>8. Your Rights</SectionTitle>
          <P theme={theme}>You have the right to:</P>
          <Ul>
            <Li theme={theme}>Access the personal data we hold about you</Li>
            <Li theme={theme}>Request correction of inaccurate data</Li>
            <Li theme={theme}>Request deletion of your data</Li>
            <Li theme={theme}>Export your data in a portable format</Li>
            <Li theme={theme}>Withdraw consent at any time where processing is based on consent</Li>
          </Ul>
          <P theme={theme}>To exercise any of these rights, please contact us using the details below.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>9. Children's Privacy</SectionTitle>
          <P theme={theme}>Aimly is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child, we will take steps to delete that information promptly.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>10. Changes to This Policy</SectionTitle>
          <P theme={theme}>We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page and updating the "Last updated" date. Continued use of the service after changes constitutes acceptance of the updated policy.</P>
        </Section>
        <Section>
          <SectionTitle theme={theme}>11. Contact Us</SectionTitle>
          <P theme={theme}>If you have any questions about this Privacy Policy, please contact us:</P>
          <ContactBox theme={theme}>
            <ContactLine theme={theme}>Orzeh Technologies</ContactLine>
            <ContactLine theme={theme}>Product: Aimly</ContactLine>
            <ContactLine theme={theme}>Email: privacy@aimly.online</ContactLine>
          </ContactBox>
        </Section>
      </Body>
      <Footer />
    </Root>
  );
};

export default PrivacyPolicy;