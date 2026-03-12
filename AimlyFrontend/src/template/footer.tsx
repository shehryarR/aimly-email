/**
 * Footer Component for Aimly
 * Simple, minimal design matching navbar style
 */
import React from 'react';
import styled from 'styled-components';
import { useTheme } from '../theme/styles';

const FooterContainer = styled.footer<{ theme: any }>`
  background-color: ${props => props.theme.colors.base[100]}f0;
  border-top: 1px solid ${props => props.theme.colors.base[300]};
  color: ${props => props.theme.colors.base.content};
  padding: 0 2rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CopyrightText = styled.span<{ theme: any }>`
  font-size: 0.8rem;
  color: ${props => props.theme.colors.base.content};
  opacity: 0.5;
  font-weight: 400;
`;

export const Footer: React.FC = () => {
  const { theme } = useTheme();
  const year = new Date().getFullYear();

  return (
    <FooterContainer theme={theme}>
      <CopyrightText theme={theme}>
        © {year} Orzeh Technologies · Aimly
      </CopyrightText>
    </FooterContainer>
  );
};

export default Footer;