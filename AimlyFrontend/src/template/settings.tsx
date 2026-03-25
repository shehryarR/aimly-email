/**
 * Settings — Full-screen tabbed modal
 * Tabs: LLM · Email · Tavily · Global Settings · Attachments · Account
 * COMPLETE VERSION WITH LOGO UPLOAD, EXPANDABLE SUBSECTIONS, ATTACHMENT UPLOAD
 * FIXED: All hooks hoisted to component level (no IIFE hooks violations)
 */

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import styled, { keyframes, css } from 'styled-components';
import { useTheme } from '../theme/styles';
import { HelpTooltip } from './helptooltip';
import { LogoutIcon, RobotIcon, EmailIcon, SearchIcon, SettingsIconSvg, EyeIcon, EyeOffIcon } from '../theme/icons';
import { apiFetch } from '../App';

// ── Animations ─────────────────────────────────────────────────────────────────

const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const slideUp = keyframes`from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); }`;

// ── Modal shell ────────────────────────────────────────────────────────────────

const Backdrop = styled.div<{ $isOpen: boolean }>`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  z-index: 9998;
  opacity: ${p => p.$isOpen ? 1 : 0};
  visibility: ${p => p.$isOpen ? 'visible' : 'hidden'};
  transition: opacity 0.25s ease, visibility 0.25s ease;
`;

const ModalWrapper = styled.div<{ $isOpen: boolean }>`
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
  pointer-events: ${p => p.$isOpen ? 'all' : 'none'};
  padding: 1.5rem;
`;

const Modal = styled.div<{ theme: any; $isOpen: boolean }>`
  width: 100%; max-width: 860px;
  height: min(680px, calc(100vh - 3rem));
  background: ${p => p.theme.colors.base[100]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: 16px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.4);
  display: flex; flex-direction: column;
  overflow: hidden;
  opacity: ${p => p.$isOpen ? 1 : 0};
  transform: ${p => p.$isOpen ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(16px)'};
  transition: opacity 0.25s ease, transform 0.25s ease;
`;

// ── Modal header ───────────────────────────────────────────────────────────────

const ModalHeader = styled.div<{ theme: any }>`
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  flex-shrink: 0;
`;

const ModalTitle = styled.h2<{ theme: any }>`
  margin: 0; font-size: 1.1rem; font-weight: 700;
  color: ${p => p.theme.colors.base.content};
  display: flex; align-items: center; gap: 0.6rem;
  letter-spacing: -0.02em;
  svg { width: 20px; height: 20px; opacity: 0.8; }
`;

const HeaderRight = styled.div`display: flex; align-items: center; gap: 0.75rem;`;

const UserChip = styled.div<{ theme: any }>`
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.3rem 0.75rem 0.3rem 0.3rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: 9999px;
  background: ${p => p.theme.colors.base[200]};
`;

const UserAvatar = styled.div<{ theme: any }>`
  width: 26px; height: 26px; border-radius: 50%;
  background: ${p => p.theme.colors.primary.main};
  color: ${p => p.theme.colors.primary.content};
  font-size: 0.7rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
`;

const UserName = styled.span<{ theme: any }>`
  font-size: 0.8rem; font-weight: 600;
  color: ${p => p.theme.colors.base.content};
`;

const LogoutBtn = styled.button<{ theme: any }>`
  width: 28px; height: 28px; padding: 0; border-radius: 50%;
  border: none; background: none;
  color: ${p => p.theme.colors.error.main};
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
  &:hover { background: ${p => p.theme.colors.error.main}18; }
  svg { width: 16px; height: 16px; }
`;

const CloseBtn = styled.button<{ theme: any }>`
  width: 32px; height: 32px; padding: 0;
  border-radius: 8px;
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[100]};
  color: ${p => p.theme.colors.base.content};
  cursor: pointer; font-size: 1.1rem;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  &:hover { background: ${p => p.theme.colors.base[200]}; }
`;

// ── Body layout (sidebar + content) ───────────────────────────────────────────

const ModalBody = styled.div`
  display: flex; flex: 1; min-height: 0;
`;

// ── Left tab nav ───────────────────────────────────────────────────────────────

const TabNav = styled.nav<{ theme: any }>`
  width: 190px; flex-shrink: 0;
  background: ${p => p.theme.colors.base[200]};
  border-right: 1px solid ${p => p.theme.colors.base[300]};
  padding: 0.75rem 0.5rem;
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto;
`;

const NavGroup = styled.div`
  margin-bottom: 0.5rem;
  &:not(:first-child) { margin-top: 0.5rem; }
`;

const NavGroupLabel = styled.div<{ theme: any }>`
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.4;
  padding: 0.25rem 0.75rem 0.4rem;
`;

const TabButton = styled.button<{ theme: any; $active: boolean }>`
  width: 100%; padding: 0.6rem 0.75rem;
  border: none; border-radius: 8px; cursor: pointer;
  display: flex; align-items: center; gap: 0.6rem;
  font-size: 0.875rem; font-weight: ${p => p.$active ? 600 : 500};
  text-align: left;
  transition: all 0.15s;
  background: ${p => p.$active ? p.theme.colors.primary.main + '18' : 'transparent'};
  color: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base.content};

  &:hover {
    background: ${p => p.$active ? p.theme.colors.primary.main + '22' : p.theme.colors.base[300]};
  }

  & > svg { width: 16px; height: 16px; flex-shrink: 0; opacity: ${p => p.$active ? 1 : 0.6}; }
`;

const TabLabel = styled.span`flex: 1;`;

const StatusDot = styled.div<{ $status: 'green'|'orange'|'red'|'gray'|'checking' }>`
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  display: inline-block;
  background: ${p => p.$status === 'green' ? '#10B981' : p.$status === 'orange' ? '#F59E0B' : p.$status === 'red' ? '#EF4444' : p.$status === 'checking' ? '#60A5FA' : '#9CA3AF'};
  box-shadow: 0 0 6px 1px ${p => p.$status === 'green' ? 'rgba(16,185,129,.7)' : p.$status === 'orange' ? 'rgba(245,158,11,.7)' : p.$status === 'red' ? 'rgba(239,68,68,.7)' : p.$status === 'checking' ? 'rgba(96,165,250,.7)' : 'transparent'};
  ${p => p.$status === 'checking' ? css`animation: ${fadeIn} 1s ease-in-out infinite alternate;` : ''}
`;

const DirtyAsterisk = styled.span<{ theme: any; $active: boolean }>`
  font-size: 0.85rem; font-weight: 700; flex-shrink: 0; line-height: 1;
  color: ${p => p.$active ? p.theme.colors.primary.main : '#F59E0B'};
  opacity: 0.9;
`;

// ── Tab content panel ──────────────────────────────────────────────────────────

const TabPanel = styled.div<{ theme: any }>`
  flex: 1; overflow-y: auto;
  padding: 1.75rem 2rem;
  color: ${p => p.theme.colors.base.content};
  animation: ${slideUp} 0.2s ease;
`;

const PanelTitle = styled.h3<{ theme: any }>`
  margin: 0 0 0.25rem 0;
  font-size: 1.05rem; font-weight: 700;
  color: ${p => p.theme.colors.base.content};
  letter-spacing: -0.02em;
`;

const PanelSubtitle = styled.p<{ theme: any }>`
  margin: 0 0 1.5rem 0;
  font-size: 0.85rem;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.55;
  line-height: 1.5;
`;

// ── Form primitives ────────────────────────────────────────────────────────────

const FormGroup = styled.div`margin-bottom: 1.1rem;`;
const FormRow   = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;`;

const Label = styled.label<{ theme: any }>`
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.8rem; font-weight: 600;
  color: ${p => p.theme.colors.base.content};
  margin-bottom: 0.4rem;
  opacity: 0.85;
`;

const RequiredStar = styled.span`color: #EF4444;`;

const Input = styled.input<{ theme: any }>`
  width: 100%; padding: 0.65rem 0.9rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.9rem; box-sizing: border-box;
  transition: border-color 0.15s;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }
  &::placeholder { opacity: 0.45; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Textarea = styled.textarea<{ theme: any }>`
  width: 100%; padding: 0.65rem 0.9rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem; font-family: inherit;
  resize: vertical; min-height: 68px; box-sizing: border-box;
  transition: border-color 0.15s;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }
  &::placeholder { opacity: 0.45; }
`;

const Select = styled.select<{ theme: any }>`
  width: 100%; padding: 0.65rem 0.9rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.9rem;
  transition: border-color 0.15s;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }
`;

const PasswordWrapper = styled.div`position: relative; display: flex; align-items: center;`;
const PasswordInput   = styled(Input)`padding-right: 2.75rem;`;

const EyeButton = styled.button<{ theme: any }>`
  position: absolute; right: 0.7rem;
  background: none; border: none; padding: 0; cursor: pointer;
  color: ${p => p.theme.colors.base.content}; opacity: 0.45;
  display: flex; align-items: center; line-height: 0;
  transition: opacity 0.15s;
  &:hover { opacity: 1; }
`;

const Btn = styled.button<{ theme: any; $variant?: 'primary'|'secondary'|'danger' }>`
  padding: 0.65rem 1.4rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer;
  transition: all 0.15s;
  ${p => p.$variant === 'secondary' ? `
    background: ${p.theme.colors.base[200]};
    color: ${p.theme.colors.base.content};
    border: 1px solid ${p.theme.colors.base[300]};
    &:hover:not(:disabled) { background: ${p.theme.colors.base[300]}; }
  ` : p.$variant === 'danger' ? `
    background: ${p.theme.colors.error.main};
    color: ${p.theme.colors.error.content || '#fff'};
    &:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  ` : `
    background: ${p.theme.colors.primary.main};
    color: ${p.theme.colors.primary.content};
    &:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 14px ${p.theme.colors.primary.main}44; }
  `}
  &:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
`;

const Msg = styled.div<{ theme: any; $type: 'success'|'error'|'info'|'checking'|'warning' }>`
  padding: 0.5rem 0.75rem;
  border-radius: ${p => p.theme.radius.field};
  font-size: 0.875rem; font-weight: 500; margin-top: 0.5rem;
  ${p => ({
    success:  `color:${p.theme.colors.success.main}; background:${p.theme.colors.base[200]}; border:1px solid ${p.theme.colors.success.main};`,
    error:    `color:${p.theme.colors.error.main}; background:${p.theme.colors.base[200]}; border:1px solid ${p.theme.colors.error.main};`,
    checking: `color:#60A5FA; background:${p.theme.colors.base[200]}; border:1px solid #60A5FA;`,
    warning:  `color:${p.theme.colors.error.main}; background:${p.theme.colors.base[200]}; border:1px solid ${p.theme.colors.error.main};`,
    info:     `color:${p.theme.colors.info.main}; background:${p.theme.colors.base[200]}; border:1px solid ${p.theme.colors.info.main};`,
  }[p.$type])}
`;

const SaveRow = styled.div`
  display: flex; justify-content: flex-end; margin-top: 1.5rem;
`;

// ── Logo upload ────────────────────────────────────────────────────────────────

const LogoArea = styled.div<{ theme: any; $hasLogo: boolean }>`
  width: 100%; height: ${p => p.$hasLogo ? '96px' : '82px'};
  border: 2px dashed ${p => p.$hasLogo ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; position: relative; overflow: hidden;
  transition: border-color 0.15s;
  &:hover { border-color: ${p => p.theme.colors.primary.main}; }
`;

const LogoImg = styled.img`max-height: 72px; max-width: 92%; object-fit: contain; border-radius: 4px;`;

const LogoPlaceholder = styled.div`
  display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
  pointer-events: none; opacity: 0.4;
  font-size: 0.75rem;
`;

const LogoRemove = styled.button<{ theme: any }>`
  position: absolute; top: 5px; right: 5px;
  width: 20px; height: 20px; border-radius: 50%;
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[100]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.6rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; opacity: 0.75;
  &:hover { background: ${p => p.theme.colors.error.main}; color: #fff; border-color: ${p => p.theme.colors.error.main}; opacity: 1; }
`;

// ── Expandable section components ──────────────────────────────────────────────

const SectionHeader = styled.div<{ theme: any; $isExpanded: boolean }>`
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem;
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p =>
    p.$isExpanded ? p.theme.colors.primary.main + '80' : p.theme.colors.base[300]};
  border-radius: ${p =>
    p.$isExpanded
      ? `${p.theme.radius.field} ${p.theme.radius.field} 0 0`
      : p.theme.radius.field};
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  margin-bottom: 0;

  &:hover {
    background: ${p => p.theme.colors.base[250] ?? p.theme.colors.base[200]};
    border-color: ${p => p.theme.colors.primary.main};
  }

  &:not(:first-child) {
    margin-top: 0.5rem;
  }
`;

const SectionTitle = styled.div<{ theme: any; $isExpanded?: boolean }>`
  font-weight: 600; font-size: 0.9rem;
  color: ${p => p.$isExpanded ? p.theme.colors.primary.main : p.theme.colors.base.content};
  display: flex; align-items: center; gap: 0.5rem;
  transition: color 0.2s ease;
  svg { 
    width: 14px; height: 14px; 
    opacity: ${p => p.$isExpanded ? 1 : 0.8};
    transition: opacity 0.2s ease;
  }
`;

const SectionIcon = styled.div<{ theme: any; $isExpanded: boolean }>`
  color: ${p => p.$isExpanded ? p.theme.colors.primary.main : p.theme.colors.base.content};
  opacity: ${p => p.$isExpanded ? 1 : 0.6}; 
  transition: transform 0.2s ease, color 0.2s ease, opacity 0.2s ease;
  transform: ${p => p.$isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};
  svg { width: 16px; height: 16px; }
`;

const SectionContent = styled.div<{ $isExpanded: boolean }>`
  display: ${p => p.$isExpanded ? 'block' : 'none'};
  padding: 1.25rem 1rem 1rem 1rem;
  margin-bottom: ${p => p.$isExpanded ? '0.5rem' : '0'};
  border: 1px solid ${() => 'transparent'};

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  animation: ${p => p.$isExpanded ? 'fadeIn 0.2s ease' : 'none'};
`;

// ── Attachment picker styles ───────────────────────────────────────────────────

const AttachPickerSearch = styled.input<{ theme: any }>`
  width: 100%; padding: 0.5rem 0.75rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[300]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.8125rem; box-sizing: border-box;
  margin-bottom: 0.5rem;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }
  &::placeholder { opacity: 0.5; }
`;

const AttachList = styled.div<{ theme: any }>`
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
`;

const AttachItem = styled.div<{ theme: any; $checked: boolean }>`
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  cursor: pointer;
  font-size: 0.8125rem;
  transition: background 0.1s;
  background: ${p => p.$checked ? p.theme.colors.primary.main + '10' : 'transparent'};
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  &:last-child { border-bottom: none; }
  &:hover { background: ${p => p.$checked ? p.theme.colors.primary.main + '18' : p.theme.colors.base[300]}; }
`;

const AttachCheckbox = styled.div<{ theme: any; $checked: boolean }>`
  width: 16px; height: 16px; flex-shrink: 0;
  border-radius: 4px;
  border: 1.5px solid ${p => p.$checked ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background: ${p => p.$checked ? p.theme.colors.primary.main : 'transparent'};
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  svg { width: 10px; height: 10px; color: ${p => p.theme.colors.primary.content}; }
`;

const AttachExtBadge = styled.span<{ $ext: string }>`
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 34px; height: 20px; padding: 0 5px;
  border-radius: 4px; font-size: 0.65rem; font-weight: 700;
  text-transform: uppercase; flex-shrink: 0;
  background: ${p => ({
    pdf: '#ef444420', doc: '#3b82f620', docx: '#3b82f620',
    csv: '#22c55e20', txt: '#64748b20',
  }[p.$ext] || '#64748b20')};
  color: ${p => ({
    pdf: '#ef4444', doc: '#3b82f6', docx: '#3b82f6',
    csv: '#22c55e', txt: '#64748b',
  }[p.$ext] || '#64748b')};
`;

const AttachName = styled.span`
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 500;
`;

const AttachEmpty = styled.div<{ theme: any }>`
  padding: 1.5rem; text-align: center;
  font-size: 0.8125rem; opacity: 0.5;
`;

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6,9 12,15 18,9"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ── Inline SVG icons ───────────────────────────────────────────────────────────

const PaperclipTabIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);

const GlobalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const AccountIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'llm' | 'email' | 'tavily' | 'global' | 'account' | 'attachments';
type StatusColor = 'green' | 'orange' | 'red' | 'gray' | 'checking';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  user?: { username: string };
  onLogout?: () => void;
  onSettingsStatus?: (hasErrors: boolean) => void;
}

interface KeySettings {
  llmModel: string; llmApiKey: string;
  emailAddress: string; emailPassword: string;
  smtpHost: string; smtpPort: string; selectedProvider: string;
  tavilyApiKey: string;
}

interface Statuses { llm: StatusColor; email: StatusColor; tavily: StatusColor; }
interface Messages { llm: string; email: string; tavily: string; }

interface GlobalSettings {
  bcc: string; business_name: string; business_info: string;
  goal: string; value_prop: string; tone: string;
  cta: string; extras: string; email_instruction: string;
  signature: string; logo_data?: string;
}

interface AccountForm { username: string; email: string; password: string; }

interface AttachmentOption {
  id: number;
  filename: string;
  file_size: number;
}

const VALID_TONES = ['Professional', 'Professional but friendly', 'Enthusiastic', 'Concise', 'Formal', 'Casual'];
const ALLOWED_ATTACH_EXTS = ['.pdf', '.doc', '.docx', '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp'];

const BACKEND_URL  = import.meta.env.VITE_BACKEND_URL  || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE     = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

const mapCode = (c: number): 'green'|'orange'|'red'|'gray' =>
  ({ 1:'green', 2:'orange', 3:'red' } as any)[c] ?? 'gray';

const statusLabel = (s: StatusColor) =>
  ({ green:'Working', orange:'Limit exceeded', red:'Error', checking:'Checking…', gray:'Not configured' }[s]);

const getExt = (filename: string) => filename.split('.').pop()?.toLowerCase() || '';


// ── Unsaved changes dialog ─────────────────────────────────────────────────────

const UnsavedOverlay = styled.div<{ $open: boolean }>`
  position: fixed; inset: 0; z-index: 11000;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: ${p => p.$open ? 'flex' : 'none'};
  align-items: center; justify-content: center;
`;
const UnsavedBox = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 1.5rem; max-width: 420px; width: 90%;
  box-shadow: 0 20px 40px rgba(0,0,0,0.4);
`;
const UnsavedActions = styled.div`display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;`;
const KeepBtn = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem; border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]}; color: ${p => p.theme.colors.base.content};
  border: 1px solid ${p => p.theme.colors.base[300]};
  font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: all 0.2s;
  &:hover { background: ${p => p.theme.colors.base[300]}; }
`;
const DiscardBtn = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem; border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.error.main}; color: ${p => p.theme.colors.error.content};
  border: none; font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: all 0.2s;
  &:hover { opacity: 0.9; }
`;

const UnsavedDialog: React.FC<{ open: boolean; theme: any; onKeep: () => void; onDiscard: () => void }> = ({ open, theme, onKeep, onDiscard }) => (
  <UnsavedOverlay $open={open} onClick={onKeep}>
    <UnsavedBox theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: (theme.colors.warning?.main || '#f59e0b') + '18', color: theme.colors.warning?.main || '#f59e0b', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.2rem' }}>Unsaved changes</div>
          <div style={{ fontSize: '0.8125rem', opacity: 0.6, lineHeight: 1.4 }}>You have unsaved changes. Closing will discard them.</div>
        </div>
      </div>
      <UnsavedActions>
        <KeepBtn theme={theme} onClick={onKeep}>Keep editing</KeepBtn>
        <DiscardBtn theme={theme} onClick={onDiscard}>Discard changes</DiscardBtn>
      </UnsavedActions>
    </UnsavedBox>
  </UnsavedOverlay>
);

// ── Main component ─────────────────────────────────────────────────────────────

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, user, onLogout, onSettingsStatus }) => {
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<Tab>('llm');

  const [showLlmKey,      setShowLlmKey]      = useState(false);
  const [showEmailPwd,    setShowEmailPwd]    = useState(false);
  const [showTavilyKey,   setShowTavilyKey]   = useState(false);
  const [showAccPwd,      setShowAccPwd]      = useState(false);
  const [llmMasked,       setLlmMasked]       = useState(false);
  const llmWasMasked    = React.useRef(false);   // tracks if key was configured when settings opened
  const tavilyWasMasked = React.useRef(false);   // tracks if key was configured when settings opened
  const [emailPwdMasked,  setEmailPwdMasked]  = useState(false);
  const [tavilyMasked,    setTavilyMasked]    = useState(false);

  const [keysLoading,   setKeysLoading]   = useState(false);
  const [hasInitStatus, setHasInitStatus] = useState(false);

  const [keys, setKeys] = useState<KeySettings>({
    llmModel: 'gemini-2.5-flash', llmApiKey: '',
    emailAddress: '', emailPassword: '',
    smtpHost: 'smtp.gmail.com', smtpPort: '587', selectedProvider: 'Gmail',
    tavilyApiKey: '',
  });

  const [statuses, setStatuses] = useState<Statuses>({ llm:'checking', email:'checking', tavily:'checking' });
  const [messages, setMessages] = useState<Messages>({
    llm:'Checking status…', email:'Checking status…', tavily:'Checking status…',
  });
  const [keyMsg, setKeyMsg] = useState<{ tab: Tab; type: 'success'|'error'; text: string }|null>(null);

  const [global, setGlobal]               = useState<GlobalSettings>({ bcc:'', business_name:'', business_info:'', goal:'', value_prop:'', tone:'', cta:'', extras:'', email_instruction:'', signature:'', logo_data:undefined });
  const [globalLoading,    setGlobalLoading]    = useState(false);
  const [globalLoaded,     setGlobalLoaded]     = useState(false);
  const [globalMsg,        setGlobalMsg]        = useState<{ type:'success'|'error'; text:string }|null>(null);
  const [globalSettingsId, setGlobalSettingsId] = useState<number | null>(null);
  const [pendingLogo,      setPendingLogo]      = useState<File | 'remove' | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);

  // ── Attachment state ──────────────────────────────────────────
  const [allAttachments,      setAllAttachments]      = useState<AttachmentOption[]>([]);
  const [linkedAttachmentIds, setLinkedAttachmentIds] = useState<Set<number>>(new Set());
  const [attachSearch,        setAttachSearch]        = useState('');
  const [attachSaving,        setAttachSaving]        = useState(false);
  const [attachMsg,           setAttachMsg]           = useState<{ type: 'success'|'error'; text: string }|null>(null);
  const [attachLoading,       setAttachLoading]       = useState(false);

  // ── Upload state (hoisted — never inside IIFE or callbacks) ───
  const [uploadFile,    setUploadFile]    = useState<File | null>(null);
  const [uploading,     setUploading]     = useState(false);
  const [uploadMsg,     setUploadMsg]     = useState<{ type: 'success'|'error'; text: string }|null>(null);
  const [isDragOver,    setIsDragOver]    = useState(false);
  const uploadFileInputRef                 = useRef<HTMLInputElement>(null);

  // ── Per-tab dirty tracking ────────────────────────────────────
  const [dirtyTabs, setDirtyTabs] = useState<Partial<Record<Tab, boolean>>>({});
  const [confirmClose, setConfirmClose] = useState(false);
  const savedKeys              = useRef<KeySettings | null>(null);
  const savedGlobal            = useRef<GlobalSettings | null>(null);
  const savedLinkedIds         = useRef<Set<number>>(new Set());
  const isDirty = Object.values(dirtyTabs).some(Boolean);
  const clearDirty = (tab: Tab) => setDirtyTabs(p => ({ ...p, [tab]: false }));

  // Smart dirty check: re-evaluate a tab after every change and auto-clear if
  // the current values match the last-saved snapshot.
  const recheckKeys = (next: typeof keys, tab: Tab) => {
    const saved = savedKeys.current;
    if (!saved) return;
    const same = (Object.keys(next) as (keyof typeof next)[]).every(k => next[k] === saved[k]);
    setDirtyTabs(p => ({ ...p, [tab]: !same }));
  };
  const recheckGlobal = (next: typeof global) => {
    const saved = savedGlobal.current;
    if (!saved) return;
    const same = (Object.keys(next) as (keyof typeof next)[]).every(k => next[k] === saved[k]);
    const logoSame = pendingLogo === null; // pending logo change always means dirty
    setDirtyTabs(p => ({ ...p, global: !(same && logoSame) }));
  };
  const recheckAttachments = (next: Set<number>) => {
    const saved = savedLinkedIds.current;
    const same = saved.size === next.size && [...next].every(id => saved.has(id));
    setDirtyTabs(p => ({ ...p, attachments: !same }));
  };
  const recheckAccount = (nextAcc: typeof accForm, nextPwd: typeof pwdForm) => {
    // Account fields start empty; any non-empty value means unsaved changes
    const accClean = !nextAcc.username && !nextAcc.email && !nextAcc.password;
    const pwdClean = !nextPwd.current && !nextPwd.next && !nextPwd.confirm;
    setDirtyTabs(p => ({ ...p, account: !(accClean && pwdClean) }));
  };
  const handleClose = () => {
    if (isDirty) { setConfirmClose(true); return; }
    onClose();
  };

  const [accForm,    setAccForm]    = useState<AccountForm>({ username:'', email:'', password:'' });
  const [accLoading, setAccLoading] = useState(false);
  const [accMsg,     setAccMsg]     = useState<{ section:'profile'|'password'; type:'success'|'error'|'warning'; text:string }|null>(null);
  const [delConfirm, setDelConfirm] = useState(false);

  const [pwdForm,     setPwdForm]     = useState({ current:'', next:'', confirm:'' });
  const [pwdLoading,  setPwdLoading]  = useState(false);
  const [showCurrPwd, setShowCurrPwd] = useState(false);
  const [showNewPwd,  setShowNewPwd]  = useState(false);
  const [showConfPwd, setShowConfPwd] = useState(false);

  const [passwordValidation, setPasswordValidation] = useState({
    message: 'Password must contain: uppercase, lowercase, number, special character (8+ chars)',
    type: 'neutral' as 'success' | 'error' | 'neutral',
  });
  const [matchValidation, setMatchValidation] = useState({
    message: '',
    type: 'neutral' as 'success' | 'error' | 'neutral',
  });

  const [deleteAccountForm, setDeleteAccountForm] = useState({ password: '' });
  const [showDeletePwd,     setShowDeletePwd]     = useState(false);

  // ── Google account detection ───────────────────────────────
  const [isGoogleUser, setIsGoogleUser] = useState(false);

  useEffect(() => {
    if (isOpen) {
      apiFetch(`${API_BASE}/auth/me/`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setIsGoogleUser(d.is_google === true); })
        .catch(() => {});
    }
  }, [isOpen]);

  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState({
    profile: true,
    password: false,
    danger: false,
    company: true,
    strategy: false,
    emailContent: false,
    branding: false,
    attachments: false,
  });

  const emailProviders: Record<string, { host: string; port: string }> = {
    'Gmail':      { host:'smtp.gmail.com',        port:'587' },
    'Outlook':    { host:'smtp-mail.outlook.com', port:'587' },
    'Yahoo':      { host:'smtp.mail.yahoo.com',   port:'587' },
    'Office 365': { host:'smtp.office365.com',    port:'587' },
    'SendGrid':   { host:'smtp.sendgrid.net',     port:'587' },
    'Custom':     { host:'',                      port:''    },
  };

  // ── Load attachments + current links ──────────────────────────
  const loadAttachments = async (gsId: number | null) => {
    setAttachLoading(true);
    try {
      const attRes = await apiFetch(`${API_BASE}/attachments/?page=1&page_size=200`);
      if (attRes.ok) {
        const d = await attRes.json();
        setAllAttachments(d.attachments ?? []);
      }
      const id = gsId ?? globalSettingsId;
      if (id) {
        const linkRes = await apiFetch(`${API_BASE}/global-settings/${id}/attachments/`);
        if (linkRes.ok) {
          const d = await linkRes.json();
          const loadedIds = new Set<number>((d.attachments ?? []).map((a: any) => a.id as number));
          setLinkedAttachmentIds(loadedIds);
          savedLinkedIds.current = loadedIds;
        }
      }
    } catch (e) {
      console.error('Failed to load attachments', e);
    } finally {
      setAttachLoading(false);
    }
  };

  // ── Save attachment links ──────────────────────────────────────
  const saveAttachments = async () => {
    if (!globalSettingsId) {
      setAttachMsg({ type: 'error', text: 'Save Global Settings first to enable attachment linking.' });
      return;
    }
    setAttachSaving(true);
    setAttachMsg(null);
    try {
      const res = await apiFetch(`${API_BASE}/global-settings/${globalSettingsId}/attachments/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.from(linkedAttachmentIds)),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || 'Failed to save');
      }
      setAttachMsg({ type: 'success', text: 'Attachments saved to global settings' });
      savedLinkedIds.current = new Set(linkedAttachmentIds);
      clearDirty('attachments');
    } catch (err) {
      setAttachMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save attachments' });
    } finally {
      setAttachSaving(false);
    }
  };

  const toggleAttachment = (id: number) => {
    setLinkedAttachmentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      recheckAttachments(next);
      return next;
    });
    setAttachMsg(null);
  };

  // ── Attachment upload ──────────────────────────────────────────
  const handleAttachFilePick = (file: File) => {
    setUploadMsg(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_ATTACH_EXTS.includes(ext)) {
      setUploadMsg({ type: 'error', text: `Invalid file type. Allowed: ${ALLOWED_ATTACH_EXTS.join(', ')}` });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadMsg({ type: 'error', text: 'File size must be less than 5MB' });
      return;
    }
    setUploadFile(file);
  };

  const handleAttachUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      // 1. Upload the file
      const formData = new FormData();
      formData.append('file', uploadFile);
      const uploadRes = await apiFetch(`${API_BASE}/attachment/`, {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) {
        const e = await uploadRes.json();
        throw new Error(e.detail || 'Upload failed');
      }
      const uploadData = await uploadRes.json();
      const newId: number = uploadData.id;

      // 2. Build the new linked set
      const newLinkedIds = new Set([...Array.from(linkedAttachmentIds), newId]);

      // 3. Auto-save the link immediately if we have a globalSettingsId
      if (globalSettingsId) {
        const linkRes = await apiFetch(`${API_BASE}/global-settings/${globalSettingsId}/attachments/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Array.from(newLinkedIds)),
        });
        if (!linkRes.ok) {
          const e = await linkRes.json();
          throw new Error(e.detail || 'Upload succeeded but linking failed');
        }
        // Sync saved ref and clear dirty since it's already persisted
        savedLinkedIds.current = newLinkedIds;
        clearDirty('attachments');
      }

      // 4. Update local state
      setLinkedAttachmentIds(newLinkedIds);

      // 5. Refresh the full attachments list (without overwriting linkedAttachmentIds)
      const attRes = await apiFetch(`${API_BASE}/attachments/?page=1&page_size=200`);
      if (attRes.ok) {
        const d = await attRes.json();
        setAllAttachments(d.attachments ?? []);
      }

      setUploadFile(null);
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
      setUploadMsg({ type: 'success', text: `"${uploadData.filename}" uploaded and linked` });
    } catch (err) {
      setUploadMsg({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  // ── Logo handling ───────────────────────────────────────────────
  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setGlobalMsg({ type: 'error', text: 'Please select a valid image file' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setGlobalMsg({ type: 'error', text: 'File size must be less than 5MB' });
      return;
    }
    // Store file locally and show preview — API call deferred to saveGlobal
    setPendingLogo(file);
    const reader = new FileReader();
    reader.onload = e => setPendingLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setDirtyTabs(p => ({ ...p, global: true }));
    setGlobalMsg(null);
  };

  const handleLogoRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Mark removal locally — API call deferred to saveGlobal
    setPendingLogo('remove');
    setPendingLogoPreview(null);
    setDirtyTabs(p => ({ ...p, global: true }));
    setGlobalMsg(null);
  };

  // ── Initial status ──────────────────────────────────────────
  useEffect(() => {
    if (!hasInitStatus && user) {
      (async () => {
        try {
          const res = await apiFetch(`${API_BASE}/user_keys/status/`, { headers: {} });
          let err = true;
          if (res.ok) {
            const d = await res.json();
            err = mapCode(d.llm?.status_code) !== 'green'
               || mapCode(d.email?.status_code) !== 'green'
               || mapCode(d.tavily?.status_code) !== 'green';
          }
          if (onSettingsStatus) onSettingsStatus(err);
        } catch { if (onSettingsStatus) onSettingsStatus(true); }
        setHasInitStatus(true);
      })();
    }
  }, [user, hasInitStatus]);

  // ── Load on open / reset on close ─────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setActiveTab('llm');
      loadKeys();
      loadGlobal();
    } else {
      setShowLlmKey(false); setShowEmailPwd(false);
      setShowTavilyKey(false); setShowAccPwd(false);
      setShowCurrPwd(false); setShowNewPwd(false); setShowConfPwd(false);
      setLlmMasked(false); setEmailPwdMasked(false); setTavilyMasked(false);
      llmWasMasked.current = false; tavilyWasMasked.current = false;
      setDelConfirm(false); setAccMsg(null); setGlobalMsg(null); setKeyMsg(null);
      setAttachMsg(null); setAttachSearch('');
      setUploadFile(null); setUploading(false); setUploadMsg(null); setIsDragOver(false);
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
      setAccForm({ username:'', email:'', password:'' });
      setPwdForm({ current:'', next:'', confirm:'' });
      setDeleteAccountForm({ password: '' });
      setPasswordValidation({
        message: 'Password must contain: uppercase, lowercase, number, special character (8+ chars)',
        type: 'neutral',
      });
      setMatchValidation({ message: '', type: 'neutral' });
      setDirtyTabs({}); setConfirmClose(false);
      setPendingLogo(null); setPendingLogoPreview(null);
      savedKeys.current = null; savedGlobal.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'llm' || activeTab === 'email' || activeTab === 'tavily') loadKeys();
    if (activeTab === 'global' && !globalLoaded) loadGlobal();
    if (activeTab === 'attachments' && !globalLoaded) loadGlobal();
    setKeyMsg(null);
  }, [activeTab]);

  // ── API: load user_keys ────────────────────────────────────────
  const loadKeys = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/user_keys/`, { headers: {} });
      if (res.ok) {
        const d = await res.json();
        const smtpHost = d.smtp_host || 'smtp.gmail.com';
        // Show * placeholder of length 32 when key is configured so user knows
        // a key is set. Empty means not configured. Never send these back to backend.
        const llmConfigured    = !!d.llm_api_key_masked;
        const tavilyConfigured = !!d.tavily_api_key_masked;
        const snap = {
          llmModel: d.llm_model || 'gemini-2.5-flash',
          llmApiKey: llmConfigured ? '•'.repeat(32) : '',
          emailAddress: d.email_address || '',
          emailPassword: d.email_password_masked || '',
          smtpHost,
          smtpPort: d.smtp_port ? String(d.smtp_port) : '587',
          selectedProvider: Object.keys(emailProviders).find(k => emailProviders[k].host === smtpHost) || 'Custom',
          tavilyApiKey: tavilyConfigured ? '•'.repeat(32) : '',
        };
        setKeys(snap);
        savedKeys.current = snap;
        setLlmMasked(!!d.llm_api_key_masked);
        setEmailPwdMasked(!!d.email_password_masked);
        setTavilyMasked(!!d.tavily_api_key_masked);
        llmWasMasked.current    = !!d.llm_api_key_masked;
        tavilyWasMasked.current = !!d.tavily_api_key_masked;
      }
      await refreshStatuses(false);
    } catch (e) { console.error(e); }
  };

  const refreshStatuses = async (autoTab = false) => {
    setStatuses({ llm:'checking', email:'checking', tavily:'checking' });
    setMessages({ llm:'Checking status…', email:'Checking status…', tavily:'Checking status…' });
    try {
      let ls: StatusColor='gray', es: StatusColor='gray', ts: StatusColor='gray';
      let lm='No API key configured', em='Email credentials not configured', tm='No API key configured';
      const res = await apiFetch(`${API_BASE}/user_keys/status/`, { headers: {} });
      if (res.ok) {
        const d = await res.json();
        ls = mapCode(d.llm?.status_code??0);    lm = d.llm?.status_text   || lm;
        es = mapCode(d.email?.status_code??0);  em = d.email?.status_text  || em;
        ts = mapCode(d.tavily?.status_code??0); tm = d.tavily?.status_text || tm;
      }
      setStatuses({ llm:ls, email:es, tavily:ts });
      setMessages({ llm:lm, email:em, tavily:tm });
      if (onSettingsStatus) onSettingsStatus(ls!=='green'||es!=='green'||ts!=='green');
      if (autoTab && ls!=='green') setActiveTab('llm');
      else if (autoTab && es!=='green') setActiveTab('email');
    } catch (e) { console.error(e); }
  };

  const saveLlm = async () => {
    setKeysLoading(true); setKeyMsg(null);
    try {
      const isNewKey   = !!keys.llmApiKey && !keys.llmApiKey.startsWith('•');
      const isClearKey = !keys.llmApiKey && llmWasMasked.current; // was configured, now cleared
      const body: Record<string, any> = { llm_model: keys.llmModel || 'gemini-2.0-flash' };
      if (isNewKey)   body.llm_api_key = keys.llmApiKey;
      if (isClearKey) body.llm_api_key = '';  // empty string signals backend to delete cookie
      const res = await apiFetch(`${API_BASE}/user_keys/`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const e = await res.json();
        const msg = Array.isArray(e?.detail) ? e.detail[0]?.msg : (e?.detail || 'Failed to save LLM settings');
        throw new Error(msg);
      }
      if (isNewKey)   { setLlmMasked(true);  llmWasMasked.current = true;  setKeys(p => ({ ...p, llmApiKey: '•'.repeat(32) })); }
      if (isClearKey) { setLlmMasked(false); llmWasMasked.current = false; }
      await refreshStatuses(false);
      setKeyMsg({ tab:'llm', type:'success', text: isClearKey ? 'LLM key removed' : 'LLM settings saved' });
      savedKeys.current = { ...keys }; clearDirty('llm');
    } catch (err) { setKeyMsg({ tab:'llm', type:'error', text: err instanceof Error ? err.message : 'Failed to save LLM settings' }); }
    finally { setKeysLoading(false); }
  };

  const saveEmail = async () => {
    setKeysLoading(true); setKeyMsg(null);
    try {
      const res = await apiFetch(`${API_BASE}/user_keys/`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email_address: keys.emailAddress, email_password: keys.emailPassword, smtp_host: keys.smtpHost, smtp_port: keys.smtpPort ? parseInt(keys.smtpPort,10) : 587 }) });
      if (!res.ok) {
        const e = await res.json();
        const msg = Array.isArray(e?.detail) ? e.detail[0]?.msg : (e?.detail || 'Failed to save email settings');
        throw new Error(msg);
      }
      await refreshStatuses(false);
      setKeyMsg({ tab:'email', type:'success', text:'Email settings saved' });
      savedKeys.current = { ...keys }; clearDirty('email');
    } catch (err) { setKeyMsg({ tab:'email', type:'error', text: err instanceof Error ? err.message : 'Failed to save email settings' }); }
    finally { setKeysLoading(false); }
  };

  const saveTavily = async () => {
    setKeysLoading(true); setKeyMsg(null);
    try {
      const isNewKey   = !!keys.tavilyApiKey && !keys.tavilyApiKey.startsWith('•');
      const isClearKey = !keys.tavilyApiKey && tavilyWasMasked.current; // was configured, now cleared
      if (!isNewKey && !isClearKey && !tavilyMasked) {
        setKeyMsg({ tab:'tavily', type:'error', text:'Please enter a Tavily API key' });
        return;
      }
      const body: Record<string, any> = {};
      if (isNewKey)   body.tavily_api_key = keys.tavilyApiKey;
      if (isClearKey) body.tavily_api_key = '';  // empty string signals backend to delete cookie
      const res = await apiFetch(`${API_BASE}/user_keys/`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const e = await res.json();
        const msg = Array.isArray(e?.detail) ? e.detail[0]?.msg : (e?.detail || 'Failed to save Tavily key');
        throw new Error(msg);
      }
      if (isNewKey)   { setTavilyMasked(true);  tavilyWasMasked.current = true;  setKeys(p => ({ ...p, tavilyApiKey: '•'.repeat(32) })); }
      if (isClearKey) { setTavilyMasked(false); tavilyWasMasked.current = false; }
      await refreshStatuses(false);
      setKeyMsg({ tab:'tavily', type:'success', text: isClearKey ? 'Tavily key removed' : 'Tavily key saved' });
      savedKeys.current = { ...keys }; clearDirty('tavily');
    } catch (err) { setKeyMsg({ tab:'tavily', type:'error', text: err instanceof Error ? err.message : 'Failed to save Tavily key' }); }
    finally { setKeysLoading(false); }
  };

  const loadGlobal = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/global_setting/`, { headers: {} });
      if (res.ok) {
        const d = await res.json();
        const gsId = d.id ?? null;
        setGlobalSettingsId(gsId);
        const snap: GlobalSettings = {
          bcc: d.bcc ?? '',
          business_name: d.business_name ?? '',
          business_info: d.business_info ?? '',
          goal: d.goal ?? '',
          value_prop: d.value_prop ?? '',
          tone: d.tone ?? '',
          cta: d.cta ?? '',
          extras: d.extras ?? '',
          email_instruction: d.email_instruction ?? '',
          signature: d.signature ?? '',
          logo_data: d.logo_data ?? undefined,
        };
        setGlobal(snap);
        savedGlobal.current = snap;
        await loadAttachments(gsId);
      }
      setGlobalLoaded(true);
    } catch { setGlobalLoaded(true); }
  };

  const saveGlobal = async () => {
    setGlobalLoading(true); setGlobalMsg(null);
    try {
      const formData = new FormData();
      const fieldsToSave: (keyof GlobalSettings)[] = [
        'bcc', 'business_name', 'business_info', 'goal',
        'value_prop', 'tone', 'cta', 'extras',
        'email_instruction', 'signature'
      ];
      // Always send every field — empty string signals backend to clear (set NULL).
      // We intentionally do NOT skip empty fields; the backend relies on receiving
      // them to know the user cleared the value.
      fieldsToSave.forEach(k => {
        const raw = global[k] as string | undefined;
        const value = (raw ?? '').trim();
        formData.append(k, value);  // "" sent → FastAPI gets None → stored as NULL
      });
      // Include pending logo change
      if (pendingLogo === 'remove') {
        formData.append('logo', new File([], ''));
      } else if (pendingLogo instanceof File) {
        formData.append('logo', pendingLogo);
      }
      const res = await apiFetch(`${API_BASE}/global_setting/`, {
        method:'PUT',
        body: formData
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail||'Failed to save');
      }
      const result = await res.json();
      if (result.id) setGlobalSettingsId(result.id);
      // Clear pending logo state and reload to get fresh logo_data from server
      if (pendingLogo) {
        setPendingLogo(null);
        setPendingLogoPreview(null);
        await loadGlobal();
      }
      setGlobalMsg({ type:'success', text: result.message || 'Global settings saved' });
      savedGlobal.current = { ...global }; clearDirty('global'); clearDirty('attachments');
    } catch (err) {
      setGlobalMsg({ type:'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally { setGlobalLoading(false); }
  };

  const saveAccount = async () => {
    if (!accForm.password) { setAccMsg({ section:'profile', type:'warning', text:'Current password is required' }); return; }
    if (!accForm.username && !accForm.email) { setAccMsg({ section:'profile', type:'warning', text:'Enter a new username and/or email' }); return; }
    setAccLoading(true); setAccMsg(null);
    try {
      const body: Record<string, string> = { password: accForm.password };
      if (accForm.username.trim()) body.username = accForm.username.trim();
      if (accForm.email.trim())    body.email    = accForm.email.trim();
      const res = await apiFetch(`${API_BASE}/user/`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail||'Update failed'); }
      setAccMsg({ section:'profile', type:'success', text:'Account updated. Re-login if you changed your username.' });
      setAccForm({ username:'', email:'', password:'' });
      clearDirty('account');
    } catch (err) {
      setAccMsg({ section:'profile', type:'error', text: err instanceof Error ? err.message : 'Failed to update' });
    } finally { setAccLoading(false); }
  };

  const savePassword = async () => {
    if (!pwdForm.current) { setAccMsg({ section:'password', type:'warning', text:'Current password is required' }); return; }
    if (!pwdForm.next)    { setAccMsg({ section:'password', type:'warning', text:'New password is required' }); return; }
    if (!validatePassword(pwdForm.next)) {
      setAccMsg({ section:'password', type:'error', text:'New password does not meet requirements' });
      return;
    }
    if (pwdForm.next !== pwdForm.confirm) { setAccMsg({ section:'password', type:'warning', text:'New passwords do not match' }); return; }
    setPwdLoading(true); setAccMsg(null);
    try {
      const res = await apiFetch(`${API_BASE}/user/`, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ password: pwdForm.current, new_password: pwdForm.next }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail||'Failed to update password'); }
      const result = await res.json();
      setAccMsg({ section:'password', type:'success', text: result.message || 'Password updated successfully' });
      setPwdForm({ current:'', next:'', confirm:'' });
      setPasswordValidation({ message: '', type: 'neutral' });
      setMatchValidation({ message: '', type: 'neutral' });
      clearDirty('account');
    } catch (err) {
      setAccMsg({ section:'password', type:'error', text: err instanceof Error ? err.message : 'Failed to update password' });
    } finally { setPwdLoading(false); }
  };

  const deleteAccount = async () => {
    if (!deleteAccountForm.password) {
      setAccMsg({ section:'profile', type:'warning', text:'Password is required to delete account' });
      return;
    }
    setAccLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/user/`, {
        method:'DELETE',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ password: deleteAccountForm.password })
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail||'Delete failed');
      }
      if (onLogout) onLogout();
    } catch (err) {
      setAccMsg({ section:'profile', type:'error', text: err instanceof Error ? err.message : 'Failed to delete account' });
    } finally { setAccLoading(false); }
  };

  const handleProviderChange = (provider: string) => {
    const cfg = emailProviders[provider];
    setKeys(p => ({ ...p, selectedProvider: provider, ...(provider !== 'Custom' && cfg ? { smtpHost: cfg.host, smtpPort: cfg.port } : {}) }));
  };

  const validatePassword = (password: string) => {
    if (!password) {
      setPasswordValidation({
        message: 'Password must contain: uppercase, lowercase, number, special character (8+ chars)',
        type: 'neutral',
      });
      return false;
    }
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};:"\\|,.<>?]/.test(password),
    };
    const isValid = Object.values(checks).every(Boolean);
    if (isValid) {
      setPasswordValidation({ message: 'Password meets requirements ✅', type: 'success' });
    } else {
      const missing = [];
      if (!checks.length) missing.push('8+ characters');
      if (!checks.uppercase) missing.push('uppercase letter');
      if (!checks.lowercase) missing.push('lowercase letter');
      if (!checks.number) missing.push('number');
      if (!checks.special) missing.push('special character');
      setPasswordValidation({ message: `Password needs: ${missing.join(', ')}`, type: 'error' });
    }
    return isValid;
  };

  const validateMatch = (pass: string, confirm: string) => {
    if (!confirm) { setMatchValidation({ message: '', type: 'neutral' }); return; }
    if (pass === confirm) {
      setMatchValidation({ message: 'Passwords match ✅', type: 'success' });
    } else {
      setMatchValidation({ message: 'Passwords do not match ❌', type: 'error' });
    }
  };

  const clearSuccessMessage = (section: string) => {
    if (section === 'global' && globalMsg?.type === 'success') setGlobalMsg(null);
    else if (section === 'keys' && keyMsg?.type === 'success') setKeyMsg(null);
    else if (section === 'profile' && accMsg?.section === 'profile' && accMsg.type === 'success') setAccMsg(null);
    else if (section === 'password' && accMsg?.section === 'password' && accMsg.type === 'success') setAccMsg(null);
  };

  const toggleSection = (sectionKey: string, tabType: 'account' | 'global') => {
    setExpandedSections(prev => {
      const newState = { ...prev };
      if (tabType === 'account') {
        newState.profile = false;
        newState.password = false;
        newState.danger = false;
        newState[sectionKey as keyof typeof newState] = !prev[sectionKey as keyof typeof prev];
      } else if (tabType === 'global') {
        newState.company = false;
        newState.strategy = false;
        newState.emailContent = false;
        newState.branding = false;
        newState.attachments = false;
        newState[sectionKey as keyof typeof newState] = !prev[sectionKey as keyof typeof prev];
      }
      return newState;
    });
  };

  // Filtered attachments for search
  const filteredAttachments = allAttachments.filter(a =>
    a.filename.toLowerCase().includes(attachSearch.toLowerCase())
  );
  const attachedFiles    = filteredAttachments.filter(a =>  linkedAttachmentIds.has(a.id));
  const notAttachedFiles = filteredAttachments.filter(a => !linkedAttachmentIds.has(a.id));

  // ── Tab definitions ────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode; status?: StatusColor }[] = [
    { id:'llm',         label:'LLM',            icon:<RobotIcon />,       status: statuses.llm   },
    { id:'email',       label:'Email',          icon:<EmailIcon />,       status: statuses.email },
    { id:'tavily',      label:'Tavily Search',  icon:<SearchIcon />,      status: statuses.tavily },
    { id:'global',      label:'Global Settings',icon:<GlobalIcon />       },
    { id:'attachments', label:'Attachments',    icon:<PaperclipTabIcon /> },
    { id:'account',     label:'Account',        icon:<AccountIcon />      },
  ];

  // ── Render ─────────────────────────────────────────────────────
  return ReactDOM.createPortal(
    <>
      <Backdrop $isOpen={isOpen} onClick={handleClose} />
      <ModalWrapper $isOpen={isOpen} onClick={handleClose}>
        <Modal theme={theme} $isOpen={isOpen} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <ModalHeader theme={theme}>
            <ModalTitle theme={theme}><SettingsIconSvg />Settings</ModalTitle>
            <HeaderRight>
              {user && (
                <UserChip theme={theme}>
                  <UserAvatar theme={theme}>{user.username.charAt(0).toUpperCase()}</UserAvatar>
                  <UserName theme={theme}>{user.username}</UserName>
                  <LogoutBtn theme={theme} onClick={onLogout} title="Logout"><LogoutIcon /></LogoutBtn>
                </UserChip>
              )}
              <CloseBtn theme={theme} onClick={handleClose}>✕</CloseBtn>
            </HeaderRight>
          </ModalHeader>

          {/* Body */}
          <ModalBody>

            {/* Tab nav */}
            <TabNav theme={theme}>
              <NavGroup>
                <NavGroupLabel theme={theme}>Integrations</NavGroupLabel>
                {tabs.filter(t => ['llm','email','tavily'].includes(t.id)).map(t => (
                  <TabButton key={t.id} theme={theme} $active={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
                    {t.icon}
                    <TabLabel>{t.label}</TabLabel>
                    {dirtyTabs[t.id] && <DirtyAsterisk theme={theme} $active={activeTab === t.id} title="Unsaved changes">*</DirtyAsterisk>}
                    {t.status && <StatusDot $status={t.status} title={statusLabel(t.status)} />}
                  </TabButton>
                ))}
              </NavGroup>
              <NavGroup>
                <NavGroupLabel theme={theme}>Configuration</NavGroupLabel>
                {tabs.filter(t => ['global','attachments','account'].includes(t.id)).map(t => (
                  <TabButton key={t.id} theme={theme} $active={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
                    {t.icon}
                    <TabLabel>{t.label}</TabLabel>
                    {dirtyTabs[t.id] && <DirtyAsterisk theme={theme} $active={activeTab === t.id} title="Unsaved changes">*</DirtyAsterisk>}
                  </TabButton>
                ))}
              </NavGroup>
            </TabNav>

            {/* ── LLM tab ─────────────────────────────────── */}
            {activeTab === 'llm' && (
              <TabPanel theme={theme} key="llm">
                <PanelTitle theme={theme}>LLM Configuration</PanelTitle>
                <PanelSubtitle theme={theme}>The AI model that reads company data and writes personalised emails. Requires a Google Gemini API key.</PanelSubtitle>

                <FormGroup>
                  <Label theme={theme}>AI Model <RequiredStar>*</RequiredStar>
                    <HelpTooltip theme={theme} instructions={<div><strong>Gemini Flash Models:</strong><ul style={{paddingLeft:'1.2rem',marginTop:'5px'}}><li><code>gemini-2.5-flash</code> — recommended, best quality.</li><li><code>gemini-2.0-flash</code> — faster, lower cost.</li></ul></div>} />
                  </Label>
                  <Select theme={theme} value={keys.llmModel} onChange={e => { setKeys(p => { const n = { ...p, llmModel: e.target.value }; recheckKeys(n, 'llm'); return n; }); }}>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  </Select>
                </FormGroup>

                <FormGroup>
                  <Label theme={theme}>API Key <RequiredStar>*</RequiredStar>
                    <HelpTooltip theme={theme} instructions={<div><strong>How to get your key:</strong><ol style={{paddingLeft:'1.2rem',marginTop:'5px'}}><li>Go to <a href="https://aistudio.google.com/" target="_blank" style={{color:theme.colors.primary.main}}>aistudio.google.com</a></li><li>Click <b>"Get API key"</b>.</li><li>Click <b>"Create API key"</b>.</li><li>Copy and paste here.</li></ol></div>} />
                  </Label>
                  <PasswordWrapper>
                    <PasswordInput theme={theme}
                      type={llmMasked ? 'text' : (showLlmKey ? 'text' : 'password')}
                      placeholder="AIza..."
                      value={keys.llmApiKey}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (llmMasked) { setLlmMasked(false); setShowLlmKey(false); setKeys(p => { const n = { ...p, llmApiKey:'' }; recheckKeys(n, 'llm'); return n; }); }
                        else setKeys(p => { const n = { ...p, llmApiKey: e.target.value }; recheckKeys(n, 'llm'); return n; });
                      }}
                    
                        autoComplete="new-password"
                        readOnly
                        onFocus={e => e.currentTarget.removeAttribute('readOnly')} />
                    {!llmMasked && <EyeButton theme={theme} type="button" onClick={() => setShowLlmKey(p=>!p)}>{showLlmKey ? <EyeOffIcon /> : <EyeIcon />}</EyeButton>}
                  </PasswordWrapper>
                </FormGroup>

                {statuses.llm !== 'checking' && statuses.llm !== 'gray' && !keyMsg && (
                  <Msg theme={theme} $type={statuses.llm === 'green' ? 'success' : statuses.llm === 'orange' ? 'warning' : 'error'}>
                    {messages.llm}
                  </Msg>
                )}
                {keyMsg?.tab === 'llm' && <Msg theme={theme} $type={keyMsg.type}>{keyMsg.text}</Msg>}
                <SaveRow>
                  <Btn theme={theme} onClick={saveLlm} disabled={keysLoading || llmMasked}>
                    {keysLoading ? 'Saving…' : 'Save'}
                  </Btn>
                </SaveRow>
              </TabPanel>
            )}

            {/* ── Email tab ────────────────────────────────── */}
            {activeTab === 'email' && (
              <TabPanel theme={theme} key="email">
                <PanelTitle theme={theme}>Email Configuration</PanelTitle>
                <PanelSubtitle theme={theme}>Connect your email account so the app can send personalised outreach directly from your inbox.</PanelSubtitle>

                <FormGroup>
                  <Label theme={theme}>Email Provider <RequiredStar>*</RequiredStar></Label>
                  <Select theme={theme} value={keys.selectedProvider} onChange={e => { handleProviderChange(e.target.value); setDirtyTabs(p => ({ ...p, email: true })); }}>
                    {Object.keys(emailProviders).map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </FormGroup>

                <FormGroup>
                  <Label theme={theme}>Email Address <RequiredStar>*</RequiredStar></Label>
                  <Input theme={theme} type="email" placeholder="you@example.com" autoComplete="off" value={keys.emailAddress}
                    onChange={e => { setKeys(p => { const n = { ...p, emailAddress: e.target.value }; recheckKeys(n, 'email'); return n; }); }} />
                </FormGroup>

                <FormGroup>
                  <Label theme={theme}>App Password <RequiredStar>*</RequiredStar>
                    <HelpTooltip theme={theme} instructions="Use an app-specific password, not your regular login password. Gmail: Google Account → Security → App passwords." />
                  </Label>
                  <PasswordWrapper>
                    <PasswordInput theme={theme}
                      type={emailPwdMasked ? 'text' : (showEmailPwd ? 'text' : 'password')}
                      placeholder="App-specific password"
                      value={keys.emailPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (emailPwdMasked) { setEmailPwdMasked(false); setShowEmailPwd(false); setKeys(p => { const n = { ...p, emailPassword:'' }; recheckKeys(n, 'email'); return n; }); }
                        else setKeys(p => { const n = { ...p, emailPassword: e.target.value }; recheckKeys(n, 'email'); return n; });
                      }}
                    
                        autoComplete="new-password"
                        readOnly
                        onFocus={e => e.currentTarget.removeAttribute('readOnly')} />
                    {!emailPwdMasked && <EyeButton theme={theme} type="button" onClick={() => setShowEmailPwd(p=>!p)}>{showEmailPwd ? <EyeOffIcon /> : <EyeIcon />}</EyeButton>}
                  </PasswordWrapper>
                </FormGroup>

                <FormRow>
                  <FormGroup>
                    <Label theme={theme}>SMTP Host <RequiredStar>*</RequiredStar>
                      <HelpTooltip theme={theme} instructions="Gmail: smtp.gmail.com · Outlook: smtp.office365.com" />
                    </Label>
                    <Input theme={theme} type="text" placeholder="smtp.gmail.com" autoComplete="off" value={keys.smtpHost}
                      onChange={e => { setKeys(p => { const n = { ...p, smtpHost: e.target.value }; recheckKeys(n, 'email'); return n; }); }}
                      disabled={keys.selectedProvider !== 'Custom'} />
                  </FormGroup>
                  <FormGroup>
                    <Label theme={theme}>SMTP Port <RequiredStar>*</RequiredStar>
                      <HelpTooltip theme={theme} instructions="587 for TLS (recommended) · 465 for SSL" />
                    </Label>
                    <Input theme={theme} type="text" placeholder="587" autoComplete="off" value={keys.smtpPort}
                      onChange={e => { setKeys(p => { const n = { ...p, smtpPort: e.target.value }; recheckKeys(n, 'email'); return n; }); }}
                      disabled={keys.selectedProvider !== 'Custom'} />
                  </FormGroup>
                </FormRow>

                {statuses.email !== 'checking' && statuses.email !== 'gray' && !keyMsg && (
                  <Msg theme={theme} $type={statuses.email === 'green' ? 'success' : statuses.email === 'orange' ? 'warning' : 'error'}>
                    {messages.email}
                  </Msg>
                )}
                {keyMsg?.tab === 'email' && <Msg theme={theme} $type={keyMsg.type}>{keyMsg.text}</Msg>}
                <SaveRow>
                  <Btn theme={theme} onClick={saveEmail} disabled={keysLoading || emailPwdMasked}>
                    {keysLoading ? 'Saving…' : 'Save'}
                  </Btn>
                </SaveRow>
              </TabPanel>
            )}

            {/* ── Tavily tab ───────────────────────────────── */}
            {activeTab === 'tavily' && (
              <TabPanel theme={theme} key="tavily">
                <PanelTitle theme={theme}>Tavily Search API</PanelTitle>
                <PanelSubtitle theme={theme}>Gives the AI real-time web search so it can find recent news, LinkedIn updates and product launches for each prospect — keeping emails from sounding generic or outdated.</PanelSubtitle>

                <FormGroup>
                  <Label theme={theme}>Tavily API Key <RequiredStar>*</RequiredStar>
                    <HelpTooltip theme={theme} instructions={<div>Get your key at <a href="https://tavily.com" target="_blank" style={{color:theme.colors.primary.main}}>tavily.com</a>. Free tier available.</div>} />
                  </Label>
                  <PasswordWrapper>
                    <PasswordInput theme={theme}
                      type={tavilyMasked ? 'text' : (showTavilyKey ? 'text' : 'password')}
                      placeholder="tvly-xxxxxxxxxx"
                      value={keys.tavilyApiKey}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (tavilyMasked) { setTavilyMasked(false); setShowTavilyKey(false); setKeys(p => { const n = { ...p, tavilyApiKey:'' }; recheckKeys(n, 'tavily'); return n; }); }
                        else setKeys(p => { const n = { ...p, tavilyApiKey: e.target.value }; recheckKeys(n, 'tavily'); return n; });
                      }}
                    
                        autoComplete="new-password"
                        readOnly
                        onFocus={e => e.currentTarget.removeAttribute('readOnly')} />
                    {!tavilyMasked && <EyeButton theme={theme} type="button" onClick={() => setShowTavilyKey(p=>!p)}>{showTavilyKey ? <EyeOffIcon /> : <EyeIcon />}</EyeButton>}
                  </PasswordWrapper>
                </FormGroup>

                {statuses.tavily !== 'checking' && statuses.tavily !== 'gray' && !keyMsg && (
                  <Msg theme={theme} $type={statuses.tavily === 'green' ? 'success' : statuses.tavily === 'orange' ? 'warning' : 'error'}>
                    {messages.tavily}
                  </Msg>
                )}
                {keyMsg?.tab === 'tavily' && <Msg theme={theme} $type={keyMsg.type}>{keyMsg.text}</Msg>}
                <SaveRow>
                  <Btn theme={theme} onClick={saveTavily} disabled={keysLoading || tavilyMasked}>
                    {keysLoading ? 'Saving…' : 'Save'}
                  </Btn>
                </SaveRow>
              </TabPanel>
            )}

            {/* ── Global Settings tab ──────────────────────── */}
            {activeTab === 'global' && (
              <TabPanel theme={theme} key="global">
                <PanelTitle theme={theme}>Global Settings</PanelTitle>
                <PanelSubtitle theme={theme}>Default values used across all campaigns. Individual campaigns can override any of these.</PanelSubtitle>

                {/* Inheritance notice */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  padding: '0.65rem 0.9rem',
                  marginBottom: '1.25rem',
                  borderRadius: theme.radius.field,
                  background: theme.colors.info.main + '12',
                  border: `1px solid ${theme.colors.info.main}40`,
                  fontSize: '0.8rem',
                  color: theme.colors.info.main,
                  lineHeight: 1.55,
                }}>
                  <svg style={{ flexShrink: 0, marginTop: '1px' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>
                    <strong style={{ fontWeight: 700 }}>Inheritance: </strong>
                    All settings configured here are automatically inherited by every campaign. A campaign can override any individual setting, or stop inheriting entirely — in which case only its own values apply.
                  </span>
                </div>

                {/* 1. Brand Identity */}
                <SectionHeader theme={theme} $isExpanded={expandedSections.company} onClick={() => toggleSection('company', 'global')}>
                  <SectionTitle theme={theme} $isExpanded={expandedSections.company}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                    </svg>
                    Brand Identity
                  </SectionTitle>
                  <SectionIcon theme={theme} $isExpanded={expandedSections.company}><ChevronDownIcon /></SectionIcon>
                </SectionHeader>
                <SectionContent $isExpanded={expandedSections.company}>
                  <FormGroup>
                    <Label theme={theme}>Business Name</Label>
                    <Input theme={theme} type="text" placeholder="Acme Corp" autoComplete="off" value={global.business_name}
                      onChange={e => { setGlobal(p => { const n = { ...p, business_name: e.target.value }; recheckGlobal(n); return n; }); clearSuccessMessage('global'); }} />
                  </FormGroup>
                  <FormGroup>
                    <Label theme={theme}>Business Info <HelpTooltip theme={theme} instructions="Brief description of your business. The AI uses this to tailor every email." /></Label>
                    <Textarea theme={theme} rows={3}
                      placeholder="We help B2B SaaS companies grow their pipeline through hyper-personalized outreach…"
                      value={global.business_info}
                      onChange={e => { setGlobal(p => { const n = { ...p, business_info: e.target.value }; recheckGlobal(n); return n; }); clearSuccessMessage('global'); }} />
                  </FormGroup>
                </SectionContent>

                {/* 2. Campaign Strategy */}
                <SectionHeader theme={theme} $isExpanded={expandedSections.strategy} onClick={() => toggleSection('strategy', 'global')}>
                  <SectionTitle theme={theme} $isExpanded={expandedSections.strategy}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    Campaign Strategy
                  </SectionTitle>
                  <SectionIcon theme={theme} $isExpanded={expandedSections.strategy}><ChevronDownIcon /></SectionIcon>
                </SectionHeader>
                <SectionContent $isExpanded={expandedSections.strategy}>
                  <FormRow>
                    <FormGroup>
                      <Label theme={theme}>Goal <HelpTooltip theme={theme} instructions="What action do you want the recipient to take?" /></Label>
                      <Input theme={theme} type="text" placeholder="Book a 15-min discovery call" autoComplete="off" value={global.goal}
                        onChange={e => { setGlobal(p => { const n = { ...p, goal: e.target.value }; recheckGlobal(n); return n; }); clearSuccessMessage('global'); }} />
                    </FormGroup>
                    <FormGroup>
                      <Label theme={theme}>Tone</Label>
                      <Select theme={theme} value={global.tone} onChange={e => { setGlobal(p => { const n = { ...p, tone: e.target.value }; recheckGlobal(n); return n; }); clearSuccessMessage('global'); }}>
                        <option value="">— Select —</option>
                        {VALID_TONES.map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </FormGroup>
                  </FormRow>
                  <FormGroup>
                    <Label theme={theme}>Value Proposition <HelpTooltip theme={theme} instructions="The core benefit you offer — one punchy sentence." /></Label>
                    <Input theme={theme} type="text" placeholder="We reduce churn by 30% in 90 days — guaranteed" autoComplete="off" value={global.value_prop}
                      onChange={e => { setGlobal(p => { const n = { ...p, value_prop: e.target.value }; recheckGlobal(n); return n; }); clearSuccessMessage('global'); }} />
                  </FormGroup>
                </SectionContent>

                {/* 3. Email Content */}
                <SectionHeader theme={theme} $isExpanded={expandedSections.emailContent} onClick={() => toggleSection('emailContent', 'global')}>
                  <SectionTitle theme={theme} $isExpanded={expandedSections.emailContent}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                    </svg>
                    Email Content
                  </SectionTitle>
                  <SectionIcon theme={theme} $isExpanded={expandedSections.emailContent}><ChevronDownIcon /></SectionIcon>
                </SectionHeader>
                <SectionContent $isExpanded={expandedSections.emailContent}>
                  <FormGroup>
                    <Label theme={theme}>Email Writing Instructions <HelpTooltip theme={theme} instructions="Tell the AI exactly how to structure and write each email." /></Label>
                    <Textarea theme={theme} rows={3}
                      placeholder="Start with a genuine compliment about the company. Use short paragraphs. Never use 'I hope this email finds you well'…"
                      value={global.email_instruction}
                      onChange={e => { setGlobal(p => { const n = { ...p, email_instruction: e.target.value }; recheckGlobal(n); return n; }); clearSuccessMessage('global'); }} />
                  </FormGroup>
                  <FormGroup>
                    <Label theme={theme}>Call to Action <HelpTooltip theme={theme} instructions="The closing ask for every email." /></Label>
                    <Input theme={theme} type="text" placeholder="Would you be open to a quick call this week?" autoComplete="off" value={global.cta}
                      onChange={e => { setGlobal(p => { const n = { ...p, cta: e.target.value }; recheckGlobal(n); return n; }); clearSuccessMessage('global'); }} />
                  </FormGroup>
                  <FormGroup>
                    <Label theme={theme}>Extra Instructions <HelpTooltip theme={theme} instructions="Additional rules for the AI. e.g. 'Never mention competitors.'" /></Label>
                    <Textarea theme={theme} rows={2} placeholder="Never mention price. Keep emails under 150 words." value={global.extras}
                      onChange={e => { setGlobal(p => { const n = { ...p, extras: e.target.value }; recheckGlobal(n); return n; }); clearSuccessMessage('global'); }} />
                  </FormGroup>
                  <FormGroup>
                    <Label theme={theme}>BCC Address <HelpTooltip theme={theme} instructions="Silently BCC'd on every email — e.g. HubSpot BCC for CRM logging." /></Label>
                    <Input theme={theme} type="email" placeholder="hubspot@bcc.hubspot.com" autoComplete="off" value={global.bcc}
                      onChange={e => { setGlobal(p => { const n = { ...p, bcc: e.target.value }; recheckGlobal(n); return n; }); clearSuccessMessage('global'); }} />
                  </FormGroup>
                </SectionContent>

                {/* 4. Branding */}
                <SectionHeader theme={theme} $isExpanded={expandedSections.branding} onClick={() => toggleSection('branding', 'global')}>
                  <SectionTitle theme={theme} $isExpanded={expandedSections.branding}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Branding
                  </SectionTitle>
                  <SectionIcon theme={theme} $isExpanded={expandedSections.branding}><ChevronDownIcon /></SectionIcon>
                </SectionHeader>
                <SectionContent $isExpanded={expandedSections.branding}>
                  <FormGroup>
                    <Label theme={theme}>Logo <HelpTooltip theme={theme} instructions="PNG, JPG, GIF, or WebP. Max 5MB. Saved when you click Save Settings." /></Label>
                    <LogoArea theme={theme} $hasLogo={!!(pendingLogoPreview || (pendingLogo !== 'remove' && global.logo_data))}
                      onClick={() => !globalLoading && (document.getElementById('logo-upload') as HTMLInputElement)?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); if (!globalLoading) { const f = e.dataTransfer.files[0]; if (f) handleLogoFile(f); } }}
                      style={{ cursor: globalLoading ? 'not-allowed' : 'pointer', opacity: globalLoading ? 0.6 : 1 }}
                    >
                      {pendingLogoPreview ? (
                        <>
                          <LogoImg src={pendingLogoPreview} alt="Logo preview" />
                          <LogoRemove theme={theme} type="button" onClick={handleLogoRemove}
                            disabled={globalLoading} title="Remove logo">✕</LogoRemove>
                          <div style={{ position:'absolute', bottom:4, left:0, right:0, textAlign:'center', fontSize:'0.65rem', opacity:0.6 }}>Unsaved — click Save Settings</div>
                        </>
                      ) : pendingLogo !== 'remove' && global.logo_data ? (
                        <>
                          <LogoImg src={global.logo_data} alt="Logo" />
                          <LogoRemove theme={theme} type="button" onClick={handleLogoRemove}
                            disabled={globalLoading} title="Remove logo">✕</LogoRemove>
                        </>
                      ) : (
                        <LogoPlaceholder>
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                          </svg>
                          <span>{globalLoading ? 'Loading...' : pendingLogo === 'remove' ? 'Logo removed — click Save Settings' : 'Click or drag to upload'}</span>
                        </LogoPlaceholder>
                      )}
                    </LogoArea>
                    <input id="logo-upload" type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f && !globalLoading) handleLogoFile(f); e.target.value = ''; }}
                      disabled={globalLoading} />
                  </FormGroup>
                  <FormGroup>
                    <Label theme={theme}>Email Signature</Label>
                    <Textarea theme={theme} rows={4} placeholder={'Best,\nJohn Smith\nHead of Sales | Acme Corp\n+1 (555) 000-0000'}
                      value={global.signature}
                      onChange={e => { setGlobal(p => { const n = { ...p, signature: e.target.value }; recheckGlobal(n); return n; }); clearSuccessMessage('global'); }} />
                  </FormGroup>
                </SectionContent>

                {globalMsg && <Msg theme={theme} $type={globalMsg.type}>{globalMsg.text}</Msg>}
                <SaveRow>
                  <Btn theme={theme} onClick={saveGlobal} disabled={globalLoading}>
                    {globalLoading ? 'Saving…' : 'Save Global Settings'}
                  </Btn>
                </SaveRow>
              </TabPanel>
            )}

            {/* ── Attachments tab ─────────────────────────── */}
            {activeTab === 'attachments' && (
              <TabPanel theme={theme} key="attachments">
                <PanelTitle theme={theme}>Attachments</PanelTitle>
                <PanelSubtitle theme={theme}>
                  Files uploaded here are auto-attached to Global Settings and inherited by all campaigns. Campaigns can override or stop inheriting at any time.
                </PanelSubtitle>

                {/* ── Upload section ── */}
                <div style={{ marginBottom: '1.25rem' }}>
                  {/* Drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={e => {
                      e.preventDefault(); setIsDragOver(false);
                      const f = e.dataTransfer.files[0];
                      if (f && !uploading) handleAttachFilePick(f);
                    }}
                    onClick={() => !uploading && uploadFileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${isDragOver ? theme.colors.primary.main : uploadFile ? theme.colors.primary.main + '80' : theme.colors.base[300]}`,
                      borderRadius: theme.radius.field,
                      background: isDragOver ? theme.colors.primary.main + '08' : theme.colors.base[200],
                      padding: '0.9rem 1.1rem',
                      cursor: uploading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: '0.85rem',
                      opacity: uploading ? 0.65 : 1,
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: uploadFile ? theme.colors.primary.main + '15' : theme.colors.base[300],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: uploadFile ? theme.colors.primary.main : theme.colors.base.content,
                      opacity: uploadFile ? 1 : 0.4, transition: 'all 0.15s',
                    }}>
                      {uploadFile ? (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                      ) : (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                      )}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {uploadFile ? (
                        <>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: theme.colors.base.content, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {uploadFile.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '1px' }}>
                            {(uploadFile.size / 1024).toFixed(0)} KB · Click to change
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: theme.colors.base.content, opacity: 0.65 }}>
                            Click or drag to upload
                          </div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '1px' }}>
                            PDF, DOC, DOCX, TXT, CSV · Max 5MB
                          </div>
                        </>
                      )}
                    </div>

                    {/* Clear selected file */}
                    {uploadFile && !uploading && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setUploadFile(null); setUploadMsg(null);
                          if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
                        }}
                        style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          border: `1px solid ${theme.colors.base[300]}`,
                          background: theme.colors.base[100],
                          color: theme.colors.base.content,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', opacity: 0.6, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.background = theme.colors.error.main;
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.borderColor = theme.colors.error.main;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.opacity = '0.6';
                          e.currentTarget.style.background = theme.colors.base[100];
                          e.currentTarget.style.color = theme.colors.base.content;
                          e.currentTarget.style.borderColor = theme.colors.base[300];
                        }}
                      >✕</button>
                    )}

                    <input
                      ref={uploadFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
                      style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachFilePick(f); }}
                      disabled={uploading}
                    />
                  </div>

                  {/* Upload button + hint */}
                  {uploadFile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.6rem' }}>
                      <Btn theme={theme} onClick={handleAttachUpload} disabled={uploading} style={{ minWidth: 120 }}>
                        {uploading ? 'Uploading…' : 'Upload & Attach'}
                      </Btn>
                      {!globalSettingsId && (
                        <span style={{ fontSize: '0.775rem', opacity: 0.45 }}>
                          Save Global Settings first to auto-attach
                        </span>
                      )}
                    </div>
                  )}
                  {uploadMsg && (
                    <Msg theme={theme} $type={uploadMsg.type} style={{ marginTop: '0.5rem' }}>
                      {uploadMsg.text}
                    </Msg>
                  )}
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: theme.colors.base[300], marginBottom: '1.1rem' }} />

                {/* ── Attached / Not Attached lists ── */}
                {attachLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', opacity: 0.5, fontSize: '0.875rem' }}>
                    Loading attachments…
                  </div>
                ) : allAttachments.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.6rem', opacity: 0.5 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>No files uploaded yet</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Use the upload area above to add your first file.</div>
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                           strokeLinecap="round" strokeLinejoin="round"
                           style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}>
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <AttachPickerSearch
                        theme={theme}
                        placeholder="Search attachments…"
                        value={attachSearch}
                        onChange={e => setAttachSearch(e.target.value)}
                        style={{ paddingLeft: '2rem', marginBottom: 0 }}
                      />
                    </div>

                    {/* ── ATTACHED sub-section ── */}
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                             strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}>
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.colors.primary.main }}>
                          Attached
                        </span>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 600,
                          background: theme.colors.primary.main + '20', color: theme.colors.primary.main,
                          border: `1px solid ${theme.colors.primary.main}40`,
                          borderRadius: '999px', padding: '1px 6px',
                        }}>
                          {attachedFiles.length}
                        </span>
                        {attachedFiles.length > 0 && (
                          <button
                            onClick={() => { setLinkedAttachmentIds(new Set()); setAttachMsg(null); }}
                            style={{
                              marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600,
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: theme.colors.base.content, opacity: 0.4, padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                          >
                            Detach all
                          </button>
                        )}
                      </div>
                      <AttachList theme={theme}>
                        {attachedFiles.length === 0 ? (
                          <AttachEmpty theme={theme}>
                            {attachSearch ? `No attached files match "${attachSearch}"` : 'No files attached — check items below to attach them'}
                          </AttachEmpty>
                        ) : (
                          attachedFiles.map(att => {
                            const ext = getExt(att.filename);
                            const sizeKb = att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : '';
                            return (
                              <AttachItem key={att.id} theme={theme} $checked={true} onClick={() => toggleAttachment(att.id)}>
                                <AttachCheckbox theme={theme} $checked={true}><CheckIcon /></AttachCheckbox>
                                <AttachExtBadge $ext={ext}>{ext || '?'}</AttachExtBadge>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <AttachName>{att.filename}</AttachName>
                                  {sizeKb && <div style={{ fontSize: '0.7rem', opacity: 0.45, marginTop: '1px' }}>{sizeKb}</div>}
                                </div>
                                <span style={{ fontSize: '0.7rem', opacity: 0.35, flexShrink: 0, color: theme.colors.base.content }}>
                                  click to detach
                                </span>
                              </AttachItem>
                            );
                          })
                        )}
                      </AttachList>
                    </div>

                    {/* ── NOT ATTACHED sub-section ── */}
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                             strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.colors.base.content, opacity: 0.45 }}>
                          Not Attached
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, background: theme.colors.base[300], color: theme.colors.base.content, borderRadius: '999px', padding: '1px 6px', opacity: 0.55 }}>
                          {notAttachedFiles.length}
                        </span>
                      </div>
                      <AttachList theme={theme}>
                        {notAttachedFiles.length === 0 ? (
                          <AttachEmpty theme={theme}>
                            {attachSearch ? `No unattached files match "${attachSearch}"` : 'All files are attached'}
                          </AttachEmpty>
                        ) : (
                          notAttachedFiles.map(att => {
                            const ext = getExt(att.filename);
                            const sizeKb = att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : '';
                            return (
                              <AttachItem key={att.id} theme={theme} $checked={false} onClick={() => toggleAttachment(att.id)}>
                                <AttachCheckbox theme={theme} $checked={false} />
                                <AttachExtBadge $ext={ext}>{ext || '?'}</AttachExtBadge>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <AttachName>{att.filename}</AttachName>
                                  {sizeKb && <div style={{ fontSize: '0.7rem', opacity: 0.45, marginTop: '1px' }}>{sizeKb}</div>}
                                </div>
                                <span style={{ fontSize: '0.7rem', opacity: 0.35, flexShrink: 0, color: theme.colors.base.content }}>
                                  click to attach
                                </span>
                              </AttachItem>
                            );
                          })
                        )}
                      </AttachList>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                        {filteredAttachments.length < allAttachments.length
                          ? `Showing ${filteredAttachments.length} of ${allAttachments.length} files`
                          : `${allAttachments.length} file${allAttachments.length !== 1 ? 's' : ''} total`}
                      </span>
                      <Btn theme={theme} onClick={saveAttachments} disabled={attachSaving || !globalSettingsId}>
                        {attachSaving ? 'Saving…' : 'Save'}
                      </Btn>
                    </div>

                    {!globalSettingsId && (
                      <Msg theme={theme} $type="warning" style={{ marginTop: '0.5rem' }}>
                        Save your Global Settings first to enable attachment linking.
                      </Msg>
                    )}
                    {attachMsg && (
                      <Msg theme={theme} $type={attachMsg.type} style={{ marginTop: '0.5rem' }}>
                        {attachMsg.text}
                      </Msg>
                    )}
                  </>
                )}
              </TabPanel>
            )}

            {/* ── Account tab ──────────────────────────────── */}
            {activeTab === 'account' && (
              <TabPanel theme={theme} key="account">
                <PanelTitle theme={theme}>Account</PanelTitle>
                <PanelSubtitle theme={theme}>Manage your profile and credentials. Your current password is required to confirm any changes.</PanelSubtitle>

                {/* Google account notice */}
                {isGoogleUser && (
                  <Msg theme={theme} $type="info" style={{ marginBottom: '1rem' }}>
                    Your account is managed by Google. Profile and password changes are not available for Google sign-in accounts.
                  </Msg>
                )}

                {/* Profile Update — hidden for Google users */}
                {!isGoogleUser && (<>
                <SectionHeader theme={theme} $isExpanded={expandedSections.profile} onClick={() => toggleSection('profile', 'account')}>
                  <SectionTitle theme={theme} $isExpanded={expandedSections.profile}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    Update Profile
                  </SectionTitle>
                  <SectionIcon theme={theme} $isExpanded={expandedSections.profile}><ChevronDownIcon /></SectionIcon>
                </SectionHeader>
                <SectionContent $isExpanded={expandedSections.profile}>
                  <FormRow>
                    <FormGroup>
                      <Label theme={theme}>New Username</Label>
                      <Input theme={theme} type="text" placeholder={user?.username || 'Leave blank to keep current'} autoComplete="off"
                        value={accForm.username}
                        onChange={e => { setAccForm(p => { const n = { ...p, username: e.target.value }; recheckAccount(n, pwdForm); return n; }); if (accMsg?.section === 'profile' && accMsg.type === 'success') setAccMsg(null); }} />
                    </FormGroup>
                    <FormGroup>
                      <Label theme={theme}>New Email</Label>
                      <Input theme={theme} type="text" placeholder="Leave blank to keep current" autoComplete="off"
                        value={accForm.email}
                        onChange={e => { setAccForm(p => { const n = { ...p, email: e.target.value }; recheckAccount(n, pwdForm); return n; }); if (accMsg?.section === 'profile' && accMsg.type === 'success') setAccMsg(null); }} />
                    </FormGroup>
                  </FormRow>
                  <FormGroup>
                    <Label theme={theme}>Current Password <RequiredStar>*</RequiredStar></Label>
                    <PasswordWrapper>
                      <PasswordInput theme={theme} type={showAccPwd ? 'text' : 'password'} placeholder="Required to save changes"
                        value={accForm.password}
                        onChange={e => { setAccForm(p => { const n = { ...p, password: e.target.value }; recheckAccount(n, pwdForm); return n; }); if (accMsg?.section === 'profile' && accMsg.type === 'success') setAccMsg(null); }} 
                        autoComplete="new-password"
                        readOnly
                        onFocus={e => e.currentTarget.removeAttribute('readOnly')} />
                      <EyeButton theme={theme} type="button" onClick={() => setShowAccPwd(p=>!p)}>{showAccPwd ? <EyeOffIcon /> : <EyeIcon />}</EyeButton>
                    </PasswordWrapper>
                  </FormGroup>
                  {accMsg?.section === 'profile' && <Msg theme={theme} $type={accMsg.type}>{accMsg.text}</Msg>}
                  <Btn theme={theme} onClick={saveAccount} disabled={accLoading} style={{width:'100%'}}>
                    {accLoading ? 'Saving…' : 'Update Profile'}
                  </Btn>
                </SectionContent>

                {/* Change Password — hidden for Google users */}
                <SectionHeader theme={theme} $isExpanded={expandedSections.password} onClick={() => toggleSection('password', 'account')}>
                  <SectionTitle theme={theme} $isExpanded={expandedSections.password}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Change Password
                  </SectionTitle>
                  <SectionIcon theme={theme} $isExpanded={expandedSections.password}><ChevronDownIcon /></SectionIcon>
                </SectionHeader>
                <SectionContent $isExpanded={expandedSections.password}>
                  <FormGroup>
                    <Label theme={theme}>Current Password <RequiredStar>*</RequiredStar></Label>
                    <PasswordWrapper>
                      <PasswordInput theme={theme} type={showCurrPwd ? 'text' : 'password'} placeholder="Your current password"
                        value={pwdForm.current}
                        onChange={e => { setPwdForm(p => { const n = { ...p, current: e.target.value }; recheckAccount(accForm, n); return n; }); if (accMsg?.section === 'password' && accMsg.type === 'success') setAccMsg(null); }} 
                        autoComplete="new-password"
                        readOnly
                        onFocus={e => e.currentTarget.removeAttribute('readOnly')} />
                      <EyeButton theme={theme} type="button" onClick={() => setShowCurrPwd(v=>!v)}>{showCurrPwd ? <EyeOffIcon /> : <EyeIcon />}</EyeButton>
                    </PasswordWrapper>
                  </FormGroup>
                  <FormRow>
                    <FormGroup>
                      <Label theme={theme}>New Password <RequiredStar>*</RequiredStar></Label>
                      <PasswordWrapper>
                        <PasswordInput theme={theme} type={showNewPwd ? 'text' : 'password'} placeholder="Min 8 characters"
                          value={pwdForm.next}
                          onChange={e => {
                            const v = e.target.value;
                            setPwdForm(p => { const n = { ...p, next: v }; recheckAccount(accForm, n); return n; });
                            if (accMsg?.section === 'password' && accMsg.type === 'success') setAccMsg(null);
                            if (v) validatePassword(v); else setPasswordValidation({ message: 'Password must contain: uppercase, lowercase, number, special character (8+ chars)', type: 'neutral' });
                            if (pwdForm.confirm) validateMatch(v, pwdForm.confirm);
                          }} 
                        autoComplete="new-password"
                        readOnly
                        onFocus={e => e.currentTarget.removeAttribute('readOnly')} />
                        <EyeButton theme={theme} type="button" onClick={() => setShowNewPwd(v=>!v)}>{showNewPwd ? <EyeOffIcon /> : <EyeIcon />}</EyeButton>
                      </PasswordWrapper>
                    </FormGroup>
                    <FormGroup>
                      <Label theme={theme}>Confirm Password <RequiredStar>*</RequiredStar></Label>
                      <PasswordWrapper>
                        <PasswordInput theme={theme} type={showConfPwd ? 'text' : 'password'} placeholder="Repeat new password"
                          value={pwdForm.confirm}
                          onChange={e => {
                            const v = e.target.value;
                            setPwdForm(p => { const n = { ...p, confirm: v }; recheckAccount(accForm, n); return n; });
                            if (accMsg?.section === 'password' && accMsg.type === 'success') setAccMsg(null);
                            if (v || pwdForm.next) validateMatch(pwdForm.next, v);
                          }} 
                        autoComplete="new-password"
                        readOnly
                        onFocus={e => e.currentTarget.removeAttribute('readOnly')} />
                        <EyeButton theme={theme} type="button" onClick={() => setShowConfPwd(v=>!v)}>{showConfPwd ? <EyeOffIcon /> : <EyeIcon />}</EyeButton>
                      </PasswordWrapper>
                    </FormGroup>
                  </FormRow>
                  {passwordValidation.message && (
                    <Msg theme={theme} $type={passwordValidation.type === 'success' ? 'success' : passwordValidation.type === 'error' ? 'error' : 'info'}>
                      {passwordValidation.message}
                    </Msg>
                  )}
                  {matchValidation.message && (
                    <Msg theme={theme} $type={matchValidation.type === 'success' ? 'success' : 'error'}>
                      {matchValidation.message}
                    </Msg>
                  )}
                  {accMsg?.section === 'password' && <Msg theme={theme} $type={accMsg.type}>{accMsg.text}</Msg>}
                  <Btn theme={theme} onClick={savePassword} disabled={pwdLoading} style={{width:'100%', marginTop:'1rem'}}>
                    {pwdLoading ? 'Saving…' : 'Change Password'}
                  </Btn>
                </SectionContent>
                </>)}

                {/* Danger Zone — always shown, password input hidden for Google users */}
                <SectionHeader theme={theme} $isExpanded={expandedSections.danger} onClick={() => toggleSection('danger', 'account')}
                  style={{ borderColor: theme.colors.error.main + '50', background: theme.colors.error.main + '08' }}>
                  <SectionTitle theme={theme} $isExpanded={expandedSections.danger} style={{ color: expandedSections.danger ? theme.colors.error.main : theme.colors.error.main + 'CC' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                    Delete Account
                  </SectionTitle>
                  <SectionIcon theme={theme} $isExpanded={expandedSections.danger} style={{ color: expandedSections.danger ? theme.colors.error.main : theme.colors.error.main + 'CC' }}>
                    <ChevronDownIcon />
                  </SectionIcon>
                </SectionHeader>
                <SectionContent $isExpanded={expandedSections.danger}>
                  {!delConfirm ? (
                    <div>
                      <Msg theme={theme} $type="warning">
                        This action is irreversible. All your data, campaigns, and settings will be permanently deleted.
                      </Msg>
                      <Btn theme={theme} $variant="danger" onClick={() => setDelConfirm(true)} style={{width:'100%', marginTop:'1rem'}}>
                        Delete My Account
                      </Btn>
                    </div>
                  ) : (
                    <>
                      <Msg theme={theme} $type="error">This permanently deletes your account and all data. This cannot be undone.</Msg>
                      {!isGoogleUser && (
                        <FormGroup style={{ marginTop: '1rem' }}>
                          <Label theme={theme}>Enter your password to confirm <RequiredStar>*</RequiredStar></Label>
                          <PasswordWrapper>
                            <PasswordInput theme={theme} type={showDeletePwd ? 'text' : 'password'} placeholder="Current password required"
                              value={deleteAccountForm.password}
                              onChange={e => { setDeleteAccountForm(p => ({ ...p, password: e.target.value })); if (accMsg?.section === 'profile' && (accMsg.type === 'error' || accMsg.type === 'warning')) setAccMsg(null); }} 
                          autoComplete="new-password"
                          readOnly
                          onFocus={e => e.currentTarget.removeAttribute('readOnly')} />
                            <EyeButton theme={theme} type="button" onClick={() => setShowDeletePwd(v=>!v)}>
                              {showDeletePwd ? <EyeOffIcon /> : <EyeIcon />}
                            </EyeButton>
                          </PasswordWrapper>
                        </FormGroup>
                      )}
                      {accMsg?.section === 'profile' && (accMsg.type === 'error' || accMsg.type === 'warning') && (
                        <Msg theme={theme} $type={accMsg.type}>{accMsg.text}</Msg>
                      )}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', marginTop:'0.75rem' }}>
                        <Btn theme={theme} $variant="secondary" onClick={() => { setDelConfirm(false); setDeleteAccountForm({ password: '' }); if (accMsg?.section === 'profile' && (accMsg.type === 'error' || accMsg.type === 'warning')) setAccMsg(null); }}>Cancel</Btn>
                        <Btn theme={theme} $variant="danger" onClick={deleteAccount} disabled={accLoading || (!isGoogleUser && !deleteAccountForm.password)}>
                          {accLoading ? 'Deleting…' : 'Yes, Delete'}
                        </Btn>
                      </div>
                    </>
                  )}
                </SectionContent>

              </TabPanel>
            )}

          </ModalBody>
        </Modal>
      </ModalWrapper>
      <UnsavedDialog
        open={confirmClose}
        theme={theme}
        onKeep={() => setConfirmClose(false)}
        onDiscard={() => { setConfirmClose(false); setDirtyTabs({}); onClose(); }}
      />
    </>,
    document.body
  );
};

export default Settings;