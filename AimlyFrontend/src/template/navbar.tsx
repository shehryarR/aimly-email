/**
 * Navigation Bar Component for AI Aimly Pro
 * Modern, professional design with auth page support
 */
import React from 'react';
import styled from 'styled-components';
import { useTheme } from '../theme/styles';

const NavbarContainer = styled.header<{ theme: any }>`
  background-color: ${props => props.theme.colors.base[100]};
  border-bottom: 1px solid ${props => props.theme.colors.base[300]};
  color: ${props => props.theme.colors.base.content};
  padding: 0 2rem;
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 1000;
  backdrop-filter: blur(8px);
  background-color: ${props => props.theme.colors.base[100]}f0;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
`;

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const LogoImage = styled.img`
  height: 32px;
  width: auto;
`;

const AppName = styled.h1<{ theme: any }>`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: ${props => props.theme.colors.base.content};
  letter-spacing: -0.025em;
`;

const PageTitle = styled.span<{ theme: any }>`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.base.content};
  opacity: 0.6;
  font-weight: 500;
  
  &::before {
    content: '•';
    margin-right: 0.75rem;
    opacity: 0.4;
  }
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const IconButton = styled.button<{ theme: any }>`
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: ${props => props.theme.radius.field};
  border: 1px solid ${props => props.theme.colors.base[300]};
  background: ${props => props.theme.colors.base[100]};
  color: ${props => props.theme.colors.base.content};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 1.125rem;

  &:hover {
    background-color: ${props => props.theme.colors.base[200]};
    border-color: ${props => props.theme.colors.primary.main};
    color: ${props => props.theme.colors.primary.main};
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const ToggleSwitch = styled.button<{ theme: any; isDark: boolean }>`
  width: 52px;
  height: 28px;
  border-radius: 14px;
  background-color: ${props => props.isDark ? props.theme.colors.primary.main : props.theme.colors.base[300]};
  border: 2px solid transparent;
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-right: 0.5rem;
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${props => props.theme.colors.primary.main}40;
  }

  &:hover {
    opacity: 0.9;
  }
`;

const ToggleThumb = styled.div<{ theme: any; isDark: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${props => props.theme.colors.base[100]};
  transform: translateX(${props => props.isDark ? '24px' : '0'});
  transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  
  svg {
    width: 14px;
    height: 14px;
    color: ${props => props.isDark ? props.theme.colors.primary.main : '#f59e0b'};
  }
`;

const UserInfo = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: ${props => props.theme.radius.field};
  background-color: ${props => props.theme.colors.base[200]};
  border: 1px solid ${props => props.theme.colors.base[300]};
`;

const UserAvatar = styled.div<{ theme: any }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${props => props.theme.colors.primary.main};
  color: ${props => props.theme.colors.primary.content};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
`;

const Username = styled.span<{ theme: any }>`
  color: ${props => props.theme.colors.base.content};
  font-size: 0.875rem;
  font-weight: 500;
`;

// SVG Icons
const SettingsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SunIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const MoonIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

interface NavbarProps {
  pageTitle?: string;
  user?: {
    username: string;
  };
  onSettingsClick?: () => void;
  onThemeToggle?: () => void;
  isAuthPage?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  pageTitle = '',
  user,
  onSettingsClick,
  onThemeToggle,
  isAuthPage = false,
}) => {
  const { theme, themeMode, toggleTheme } = useTheme();

  const handleThemeToggle = () => {
    toggleTheme();
    onThemeToggle?.();
  };

  return (
    <NavbarContainer theme={theme}>
      <LeftSection>
        <LogoContainer>
          <LogoImage src="/logo.png" alt="Aimly" />
          <AppName theme={theme}>Aimly</AppName>
        </LogoContainer>
        {!isAuthPage && pageTitle && pageTitle !== 'Dashboard' && (
          <PageTitle theme={theme}>{pageTitle}</PageTitle>
        )}
      </LeftSection>

      <RightSection>
        <ToggleSwitch 
          theme={theme}
          isDark={themeMode === 'dark'}
          onClick={handleThemeToggle}
          title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          <ToggleThumb theme={theme} isDark={themeMode === 'dark'}>
            {themeMode === 'dark' ? <MoonIcon /> : <SunIcon />}
          </ToggleThumb>
        </ToggleSwitch>

        {!isAuthPage && user && onSettingsClick && (
          <IconButton 
            theme={theme}
            onClick={onSettingsClick}
            title="Settings"
          >
            <SettingsIcon />
          </IconButton>
        )}

        {!isAuthPage && user && (
          <UserInfo theme={theme}>
            <UserAvatar theme={theme}>
              {user.username.charAt(0).toUpperCase()}
            </UserAvatar>
            <Username theme={theme}>{user.username}</Username>
          </UserInfo>
        )}
      </RightSection>
    </NavbarContainer>
  );
};

export default Navbar;