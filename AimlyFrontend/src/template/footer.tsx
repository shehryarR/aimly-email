/**
 * Footer Component for Aimly
 * Includes links to legal pages and pricing
 */
import React from 'react';
import styled from 'styled-components';
import { useTheme } from '../theme/styles';
import { Link } from 'react-router-dom';

const FooterContainer = styled.footer<{ theme: any }>`
  background-color: ${props => props.theme.colors.base[100]}f0;
  border-top: 1px solid ${props => props.theme.colors.base[300]};
  color: ${props => props.theme.colors.base.content};
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  min-height: 3rem;
`;

const CopyrightText = styled.span<{ theme: any }>`
  font-size: 0.8rem;
  color: ${props => props.theme.colors.base.content};
  opacity: 0.45;
  font-weight: 400;
`;

const LinkGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
`;

const FooterLink = styled(Link)<{ theme: any }>`
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.78rem;
  color: ${props => props.theme.colors.base.content};
  opacity: 0.4;
  font-weight: 400;
  padding: 0;
  transition: opacity 0.15s;
  font-family: inherit;

  &:hover {
    opacity: 0.85;
    color: ${props => props.theme.colors.primary.main};
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
        <FooterLink theme={theme} to="/pricing">
          Pricing
        </FooterLink>
        <FooterLink theme={theme} to="/terms">
          Terms of Service
        </FooterLink>
        <FooterLink theme={theme} to="/privacy">
          Privacy Policy
        </FooterLink>
        <FooterLink theme={theme} to="/refunds">
          Refund Policy
        </FooterLink>
      </LinkGroup>
    </FooterContainer>
  );
};

export default Footer;