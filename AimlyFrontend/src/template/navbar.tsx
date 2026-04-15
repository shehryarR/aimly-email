/**
 * Navigation Bar Component for Aimly
 * Modern, professional design with auth page + landing page support
 */
import React from 'react';
import styled from 'styled-components';
import { useTheme } from '../theme/styles';
import { useNavigate, Link } from 'react-router-dom';

const NavbarContainer = styled.header<{ theme: any }>`
  background-color: ${props => props.theme.colors.base[100]}f0;
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
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
`;

const LogoContainer = styled(Link)`
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
`;

const LogoImage = styled.img`
  height: 32px;
  width: auto;
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
  gap: 0.75rem;
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
  &:focus { outline: none; box-shadow: 0 0 0 2px ${props => props.theme.colors.primary.main}40; }
  &:hover { opacity: 0.9; }
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
  svg { width: 14px; height: 14px; color: ${props => props.isDark ? props.theme.colors.primary.main : '#f59e0b'}; }
`;

const UserAvatar = styled.div<{ theme: any }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: ${props => props.theme.colors.primary.main};
  color: ${props => props.theme.colors.primary.content};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: box-shadow 0.2s ease;
  &:hover {
    box-shadow: 0 0 0 2px ${props => props.theme.colors.base[100]},
                0 0 0 4px ${props => props.theme.colors.primary.main};
  }
`;

const NavTextBtn = styled(Link)<{ theme: any }>`
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: ${props => props.theme.radius.field};
  border: 1px solid transparent;
  background: transparent;
  color: ${props => props.theme.colors.base.content};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.65;
  font-family: inherit;
  &:hover {
    opacity: 1;
    border-color: ${props => props.theme.colors.base[300]};
  }
`;

const NavOutlineBtn = styled(Link)<{ theme: any }>`
  text-decoration: none;
  padding: 0.5rem 1.1rem;
  border-radius: ${props => props.theme.radius.field};
  border: 1px solid ${props => props.theme.colors.base[300]};
  background: transparent;
  color: ${props => props.theme.colors.base.content};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.8;
  font-family: inherit;
  &:hover {
    opacity: 1;
    border-color: ${props => props.theme.colors.primary.main};
    color: ${props => props.theme.colors.primary.main};
  }
`;

const NavPrimaryBtn = styled(Link)<{ theme: any }>`
  text-decoration: none;
  padding: 0.5rem 1.25rem;
  border-radius: ${props => props.theme.radius.field};
  border: none;
  background: ${props => props.theme.colors.primary.main};
  color: ${props => props.theme.colors.primary.content};
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  &:hover {
    opacity: 0.88;
    transform: translateY(-1px);
    box-shadow: 0 4px 14px ${props => props.theme.colors.primary.main}60;
  }
`;


const LogoutBtn = styled.button<{ theme: any }>`
  padding: 0.5rem 1.1rem;
  border-radius: ${props => props.theme.radius.field};
  border: 1px solid ${props => props.theme.colors.base[300]};
  background: transparent;
  color: ${props => props.theme.colors.base.content};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.75;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  svg { width: 14px; height: 14px; }
  &:hover {
    opacity: 1;
    border-color: ${props => props.theme.colors.error.main};
    color: ${props => props.theme.colors.error.main};
  }
`;

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
  user?: { username: string };
  onSettingsClick?: () => void;
  onThemeToggle?: () => void;
  onLogout?: () => void;
  isAuthPage?: boolean;
  isLandingPage?: boolean;
  hasSubscription?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  pageTitle = '',
  user,
  onSettingsClick,
  onThemeToggle,
  onLogout,
  isAuthPage = false,
  isLandingPage = false,
  hasSubscription = true,
}) => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleThemeToggle = () => {
    toggleTheme();
    onThemeToggle?.();
  };

  return (
    <NavbarContainer theme={theme}>
      <LeftSection>
        <LogoContainer to="/">
          <LogoImage src="/logo.png" alt="Aimly" />
        </LogoContainer>
        {!isAuthPage && !isLandingPage && pageTitle && pageTitle !== 'Dashboard' && (
          <PageTitle theme={theme}>{pageTitle}</PageTitle>
        )}
      </LeftSection>

      <RightSection>
        {/* Theme toggle — always visible */}
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

        {/* Landing page — not logged in */}
        {isLandingPage && !user && (
          <>
            <NavTextBtn theme={theme} to="/pricing">
              Pricing
            </NavTextBtn>
            <NavOutlineBtn theme={theme} to="/auth?tab=login">
              Login
            </NavOutlineBtn>
            <NavPrimaryBtn theme={theme} to="/auth?tab=register">
              Get Started
            </NavPrimaryBtn>
          </>
        )}

        {/* Landing page — already logged in */}
        {isLandingPage && user && (
          <NavPrimaryBtn theme={theme} to="/campaigns">
            Go to Dashboard
          </NavPrimaryBtn>
        )}

        {/* Dashboard — subscribed: show avatar. Not subscribed: show logout only */}
        {!isAuthPage && !isLandingPage && user && hasSubscription && (
          <UserAvatar theme={theme} onClick={onSettingsClick} title={user.username}>
            {user.username.charAt(0).toUpperCase()}
          </UserAvatar>
        )}
        {!isAuthPage && !isLandingPage && user && !hasSubscription && (
          <LogoutBtn theme={theme} onClick={onLogout}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </LogoutBtn>
        )}
      </RightSection>
    </NavbarContainer>
  );
};

export default Navbar;