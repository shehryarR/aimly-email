/**
 * Navigation Bar Component for Aimly
 * Modern, professional design with auth page + landing page support
 * UPDATED: Full mobile responsiveness — hamburger menu, collapsible nav
 */
import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useTheme, typography } from '../theme/styles';
import { Link } from 'react-router-dom';

const NavbarContainer = styled.header<{ theme: any; $scrolled: boolean }>`
  background-color: ${props => props.$scrolled
    ? `${props.theme.colors.base[200]}ee`
    : props.theme.colors.base[200]};
  border-bottom: 1px solid ${props => props.$scrolled
    ? props.theme.colors.base[300]
    : props.theme.colors.base[300]};
  box-shadow: ${props => props.$scrolled
    ? '0 4px 24px rgba(0,0,0,0.12)'
    : 'none'};
  color: ${props => props.theme.colors.base.content};
  padding: 0 2rem;
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 1000;
  backdrop-filter: blur(${props => props.$scrolled ? '16px' : '8px'});
  transition: box-shadow 0.25s ease, background-color 0.25s ease, backdrop-filter 0.25s ease;

  @media (max-width: 640px) {
    padding: 0 1rem;
  }
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
  font-family: ${() => typography.fontDisplay};
  &::before {
    content: '•';
    margin-right: 0.75rem;
    opacity: 0.4;
  }

  @media (max-width: 480px) {
    display: none;
  }
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;

  @media (max-width: 640px) {
    gap: 0.5rem;
  }
`;

const ToggleSwitch = styled.button<{ theme: any; $isDark: boolean }>`
  width: 52px;
  height: 28px;
  border-radius: 14px;
  background-color: ${props => props.$isDark ? props.theme.colors.primary.main : props.theme.colors.base[300]};
  border: 2px solid transparent;
  position: relative;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-right: 0.5rem;
  flex-shrink: 0;

  &:focus { outline: none; box-shadow: 0 0 0 2px ${props => props.theme.colors.primary.main}40; }
  &:hover { opacity: 0.9; }

  @media (max-width: 640px) {
    margin-right: 0;
    width: 44px;
    height: 24px;
    border-radius: 12px;
  }
`;

const ToggleThumb = styled.div<{ theme: any; $isDark: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${props => props.theme.colors.base[100]};
  transform: translateX(${props => props.$isDark ? '24px' : '0'});
  transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px ${props => props.theme.colors.base[300]};
  svg { width: 14px; height: 14px; color: ${props => props.$isDark ? props.theme.colors.primary.main : props.theme.colors.warning.main}; }

  @media (max-width: 640px) {
    width: 20px;
    height: 20px;
    transform: translateX(${props => props.$isDark ? '20px' : '0'});
    svg { width: 12px; height: 12px; }
  }
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
  flex-shrink: 0;
  &:hover {
    box-shadow: 0 0 0 2px ${props => props.theme.colors.base[100]},
                0 0 0 4px ${props => props.theme.colors.primary.main};
  }

  @media (max-width: 640px) {
    width: 32px;
    height: 32px;
    font-size: 0.8rem;
  }
`;

const NavTextBtn = styled(Link)<{ theme: any }>`
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: ${props => props.theme.radius.field};
  border: 1px solid transparent;
  background: transparent;
  color: ${props => props.theme.colors.base.content};
  font-family: ${() => typography.fontDisplay};
  &:hover {
    opacity: 1;
    border-color: ${props => props.theme.colors.base[300]};
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const NavOutlineBtn = styled(Link)<{ theme: any }>`
  text-decoration: none;
  padding: 0.5rem 1.1rem;
  border-radius: ${props => props.theme.radius.field};
  border: 1px solid ${props => props.theme.colors.base[300]};
  background: transparent;
  color: ${props => props.theme.colors.base.content};
  font-family: ${() => typography.fontDisplay};
  &:hover {
    opacity: 1;
    border-color: ${props => props.theme.colors.primary.main};
    color: ${props => props.theme.colors.primary.main};
  }

  @media (max-width: 768px) {
    display: none;
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
  white-space: nowrap;
  &:hover {
    opacity: 0.88;
    transform: translateY(-1px);
    box-shadow: 0 4px 14px ${props => props.theme.colors.primary.main}60;
  }

  @media (max-width: 768px) {
    display: none;
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

  @media (max-width: 480px) {
    padding: 0.4rem 0.75rem;
    font-size: 0.8125rem;
    span { display: none; }
  }
`;

// ── Hamburger button (landing page mobile only) ────────────────────────────────
const HamburgerBtn = styled.button<{ theme: any }>`
  display: none;
  width: 36px;
  height: 36px;
  border-radius: ${props => props.theme.radius.field};
  border: 1px solid ${props => props.theme.colors.base[300]};
  background: transparent;
  color: ${props => props.theme.colors.base.content};
  cursor: pointer;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: ${props => props.theme.colors.base[300]};
  }

  @media (max-width: 768px) {
    display: flex;
  }

  svg { width: 18px; height: 18px; }
`;

// ── Mobile dropdown menu (landing only) ───────────────────────────────────────
const MobileMenuOverlay = styled.div<{ $open: boolean }>`
  display: none;

  @media (max-width: 768px) {
    display: ${p => p.$open ? 'block' : 'none'};
    position: fixed;
    inset: 0;
    z-index: 999;
    background: transparent;
  }
`;

const MobileMenu = styled.div<{ theme: any; $open: boolean }>`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 4rem;
    left: 0;
    right: 0;
    z-index: 1001;
    background: ${props => props.theme.colors.base[200]};
    border-bottom: 1px solid ${props => props.theme.colors.base[300]};
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    padding: 0.75rem 1rem;
    gap: 0.5rem;
    /* Slide + fade — visibility ensures it's truly gone when closed */
    transform: translateY(${p => p.$open ? '0' : '-8px'});
    opacity: ${p => p.$open ? 1 : 0};
    visibility: ${p => p.$open ? 'visible' : 'hidden'};
    pointer-events: ${p => p.$open ? 'auto' : 'none'};
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.2s ease,
                visibility 0s linear ${p => p.$open ? '0s' : '0.22s'};
  }
`;

const MobileMenuLink = styled(Link)<{ theme: any }>`
  text-decoration: none;
  padding: 0.75rem 1rem;
  border-radius: ${props => props.theme.radius.field};
  color: ${props => props.theme.colors.base.content};
  font-family: ${() => typography.fontDisplay};
  font-weight: 400;
  letter-spacing: 0.01em;
  transition: background 0.15s;
  display: block;

  &:hover {
    background: ${props => props.theme.colors.base[300]};
  }
`;

const MobileMenuPrimaryLink = styled(Link)<{ theme: any }>`
  text-decoration: none;
  padding: 0.75rem 1rem;
  border-radius: ${props => props.theme.radius.field};
  background: ${props => props.theme.colors.primary.main};
  color: ${props => props.theme.colors.primary.content};
  font-size: 0.9375rem;
  font-weight: 600;
  text-align: center;
  display: block;
  transition: opacity 0.15s;

  &:hover { opacity: 0.88; }
`;

const MobileDivider = styled.div<{ theme: any }>`
  height: 1px;
  background: ${props => props.theme.colors.base[300]};
  margin: 0.25rem 0;
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleThemeToggle = () => {
    toggleTheme();
    onThemeToggle?.();
  };

  // Close mobile menu on outside click — but NOT when clicking the hamburger itself
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (hamburgerRef.current && hamburgerRef.current.contains(e.target as Node)) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <NavbarContainer theme={theme} $scrolled={scrolled}>
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
            $isDark={themeMode === 'dark'}
            onClick={handleThemeToggle}
            title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            <ToggleThumb theme={theme} $isDark={themeMode === 'dark'}>
              {themeMode === 'dark' ? <MoonIcon /> : <SunIcon />}
            </ToggleThumb>
          </ToggleSwitch>

          {/* Landing page — not logged in */}
          {isLandingPage && !user && (
            <>
              {/* Desktop links */}
              <NavTextBtn theme={theme} to="/pricing">Pricing</NavTextBtn>
              <NavOutlineBtn theme={theme} to="/auth?tab=login">Login</NavOutlineBtn>
              <NavPrimaryBtn theme={theme} to="/auth?tab=register">Get Started</NavPrimaryBtn>
              {/* Mobile hamburger */}
              <HamburgerBtn
                theme={theme}
                ref={hamburgerRef}
                onClick={() => setMobileMenuOpen(p => !p)}
                aria-label="Open menu"
              >
                {mobileMenuOpen ? (
                  <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                ) : (
                  <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                )}
              </HamburgerBtn>
            </>
          )}

          {/* Landing page — already logged in */}
          {isLandingPage && user && (
            <NavPrimaryBtn theme={theme} to="/campaigns">Go to Dashboard</NavPrimaryBtn>
          )}

          {/* Dashboard — subscribed */}
          {!isAuthPage && !isLandingPage && user && hasSubscription && (
            <UserAvatar theme={theme} onClick={onSettingsClick} title={user.username}>
              {user.username.charAt(0).toUpperCase()}
            </UserAvatar>
          )}

          {/* Dashboard — no subscription */}
          {!isAuthPage && !isLandingPage && user && !hasSubscription && (
            <LogoutBtn theme={theme} onClick={onLogout}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Logout</span>
            </LogoutBtn>
          )}
        </RightSection>
      </NavbarContainer>

      {/* Mobile menu — landing page only */}
      {isLandingPage && !user && (
        <>
          <MobileMenuOverlay $open={mobileMenuOpen} onClick={closeMobileMenu} />
          <MobileMenu theme={theme} $open={mobileMenuOpen} ref={menuRef}>
            <MobileMenuLink theme={theme} to="/pricing" onClick={closeMobileMenu}>Pricing</MobileMenuLink>
            <MobileDivider theme={theme} />
            <MobileMenuLink theme={theme} to="/auth?tab=login" onClick={closeMobileMenu}>Login</MobileMenuLink>
            <MobileMenuPrimaryLink theme={theme} to="/auth?tab=register" onClick={closeMobileMenu}>Get Started</MobileMenuPrimaryLink>
          </MobileMenu>
        </>
      )}
    </>
  );
};

export default Navbar;