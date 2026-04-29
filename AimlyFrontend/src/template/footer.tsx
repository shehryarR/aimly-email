/**
 * Footer Component for Aimly
 * UPDATED: Mobile-responsive stacked layout
 */
import React from 'react';
import styled from 'styled-components';
import { useTheme, typography } from '../theme/styles';
import { Link } from 'react-router-dom';

const FooterContainer = styled.footer<{ theme: any }>`
  background-color: ${props => props.theme.colors.base[200]};
  border-top: 1px solid ${props => props.theme.colors.base[300]};
  color: ${props => props.theme.colors.base.content};
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  min-height: 3rem;

  @media (max-width: 640px) {
    padding: 0.875rem 1rem;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
  }
`;

const CopyrightText = styled.span<{ theme: any }>`
  font-family: ${() => typography.fontDisplay};
  font-style: italic;
  font-size: 0.8rem;
  font-weight: 400;
  letter-spacing: 0.01em;
  color: ${props => props.theme.colors.base.content};
  opacity: 0.65;

  @media (max-width: 640px) {
    font-size: 0.75rem;
  }
`;

const LinkGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;

  @media (max-width: 640px) {
    gap: 0.875rem;
    justify-content: center;
  }
`;

const FooterLink = styled(Link)<{ theme: any }>`
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  font-family: ${() => typography.fontDisplay};
  font-style: italic;
  font-size: 0.8rem;
  font-weight: 400;
  letter-spacing: 0.01em;
  color: ${props => props.theme.colors.base.content};
  opacity: 0.6;
  padding: 0;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
    color: ${props => props.theme.colors.primary.main};
  }

  @media (max-width: 640px) {
    font-size: 0.75rem;
  }
`;

export const Footer: React.FC = () => {
  const { theme } = useTheme();
  const year = new Date().getFullYear();

  return (
    <FooterContainer theme={theme}>
      <CopyrightText theme={theme}>
        © {year} Orzeh Technologies · Aimly
      </CopyrightText>

      <LinkGroup>
        <FooterLink theme={theme} to="/pricing">Pricing</FooterLink>
        <FooterLink theme={theme} to="/terms">Terms of Service</FooterLink>
        <FooterLink theme={theme} to="/privacy">Privacy Policy</FooterLink>
        <FooterLink theme={theme} to="/refunds">Refund Policy</FooterLink>
      </LinkGroup>
    </FooterContainer>
  );
};

export default Footer;