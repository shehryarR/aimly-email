/**
 * Campaign.tsx - Single-file campaign page
 * Features:
 *   - Campaign stats card with ⚙️ settings gear icon (top-right)
 *   - Campaign Settings modal: segregated into CampaignPreferenceModal.tsx
 *   - Attachments tab: same upload zone + attached/not-attached lists as Settings.tsx
 *   - Two inheritance checkboxes: inherit_global_settings & inherit_global_attachments
 *   - Auto-schedule checkbox that opens scheduling accordion when checked
 *   - Companies list: clicking ANYWHERE on a row selects it
 *   - Unenroll uses UserMinus icon instead of trash
 *   - Add Companies modal (4 tabs: enroll existing / manual / CSV / AI search)
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTheme } from '../../theme/styles';
import styled, { keyframes } from 'styled-components';
import BulkEmailModal from './BulkEmailModal';
import { apiFetch } from '../../App';
import CampaignSettingsModal, { CsCloseBtn } from './CampaignPreferenceModal';
import EmailModal from './EmailModal';
// ─────────────────────────────────────────────────────────────
// ENV
// ─────────────────────────────────────────────────────────────
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Company {
  id: number;
  user_id: number;
  name: string;
  email: string;
  phone_number?: string;
  address?: string;
  company_info?: string;
  created_at: string;
  optedOut?: boolean;
  category_ids?: number[];
}

interface CampaignDetails {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

interface CampaignPreferences {
  brand_id: number | null;
  goal: string;
  value_prop: string;
  tone: string;
  cta: string;
  additional_notes: string;
  writing_guidelines: string;
  template_email?: string;
  template_html_email?: number;
  inherit_global_settings: number;
  inherit_global_attachments: number;
}

interface AttachmentOption {
  id: number;
  filename: string;
  file_size: number;
}

interface ToastNotification {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  isExiting?: boolean;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  variant?: 'danger' | 'default';
}

interface CampaignStats {
  campaign_id: number;
  campaign_name: string;
  companies_count: number;
  emails: {
    sent: number;
    read: number;
    failed: number;
    draft: number;
    scheduled: number;
    primary: number;
    total: number;
  };
  read_rate: number;
}

// ─────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────
const spin      = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const AdditionSpinner = styled.span`
  width: 18px; height: 18px; display: inline-block;
  border: 2px solid transparent;
  border-color: ${(p: any) => p.theme.colors.primary.main}40;
  border-top-color: ${(p: any) => p.theme.colors.primary.main};
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;
const fadeSlide = keyframes`from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}`;
const slideIn   = keyframes`from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}`;
const slideOut  = keyframes`from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(100%)}`;
const pulse     = keyframes`0%,100%{opacity:1}50%{opacity:0.5}`;
const modalSlideUp = keyframes`from{opacity:0;transform:scale(0.96) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}`;

// ─────────────────────────────────────────────────────────────
// LAYOUT
// ─────────────────────────────────────────────────────────────
const PageWrapper = styled.div<{ theme: any }>`
  background-color: ${p => p.theme.colors.base[100]};
  min-height: 100vh;
  color: ${p => p.theme.colors.base.content};
`;
const PageContent = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

// ─────────────────────────────────────────────────────────────
// CARD BASE
// ─────────────────────────────────────────────────────────────
const Card = styled.div<{ theme: any }>`
  background-color: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  color: ${p => p.theme.colors.base.content};
  box-shadow: ${p => p.theme.colorScheme === 'dark'
    ? '0 2px 8px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)'
    : '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)'};
`;

// ─────────────────────────────────────────────────────────────
// STATS CARD
// ─────────────────────────────────────────────────────────────
const StatsCard = styled(Card)`
  overflow: hidden;
  position: relative;
  &::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 260px; height: 260px;
    background: radial-gradient(
      circle,
      ${p => p.theme.colors.primary.main}12 0%,
      transparent 70%
    );
    pointer-events: none;
  }
`;
const StatsHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.75rem 2rem 1.5rem;
  gap: 1rem;
`;
const HeaderIconBtn = styled.button<{ theme: any }>`
  width: 36px; height: 36px; padding: 0; flex-shrink: 0;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
  &:hover {
    background: ${p => p.theme.colors.base[400]};
    border-color: ${p => p.theme.colors.primary.main};
    color: ${p => p.theme.colors.primary.main};
  }
  svg { width: 18px; height: 18px; }
  text-decoration: none;
`;
const NavIconButton = styled.button<{ theme: any }>`
  position: relative;
  height: 36px;
  padding: 0 0.6rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background-color: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.75;
  flex-shrink: 0;
  svg { width: 16px; height: 16px; flex-shrink: 0; }
  text-decoration: none;
  &:hover {
    border-color: ${p => p.theme.colors.primary.main};
    color: ${p => p.theme.colors.primary.main};
    background-color: ${p => p.theme.colors.base[400]};
    opacity: 1;
  }
`;
const NavIconCount = styled.span`
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  opacity: 0.8;
  line-height: 1;
`;
const CampaignTitleSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
`;
const CampaignTitle = styled.h1`
  font-size: 2rem; font-weight: 800; margin: 0;
  letter-spacing: -0.045em; line-height: 1;
  text-align: center;
`;
const CampaignMeta = styled.p`
  margin: 0; opacity: 0.4; font-size: 0.7rem;
  text-transform: uppercase; letter-spacing: 0.12em;
  text-align: center;
`;
const StatsGrid = styled.div<{ theme: any }>`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  border-top: 1px solid ${p => p.theme.colors.base[300]};
`;
const StatBox = styled.div<{ theme: any }>`
  padding: 1rem 1.5rem;
  border-right: 1px solid ${p => p.theme.colors.base[300]};
  display: flex; flex-direction: column; gap: 0.2rem;
  transition: background-color 0.15s ease;
  &:last-child { border-right: none; }
  &:hover {
    background-color: ${p => p.theme.colorScheme === 'dark'
      ? p.theme.colors.base[300]
      : p.theme.colors.base[200]};
  }
`;
const StatLabel = styled.div`
  font-size: 0.6rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.08em; opacity: 0.5;
`;
const StatValue = styled.div<{ $color?: string }>`
  font-size: 1.5rem; font-weight: 700; letter-spacing: -0.03em;
  line-height: 1;
  color: ${p => p.$color || 'inherit'};
`;
const StatSub = styled.div<{ $color?: string }>`
  font-size: 0.6rem; font-weight: 500;
  color: ${p => p.$color || 'inherit'}; opacity: 0.8;
`;

// ─────────────────────────────────────────────────────────────
// COMPANIES SECTION
// ─────────────────────────────────────────────────────────────
const SectionCard = styled(Card)`padding: 2rem;`;
const SectionHeader = styled.div<{ theme: any }>`
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1.5rem; padding-bottom: 1rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
`;
const SectionTitle = styled.h2`
  font-size: 1.125rem; font-weight: 600; margin: 0;
  display: flex; align-items: center; gap: 0.5rem;
  svg { width: 20px; height: 20px; }
`;
const AddBtn = styled.button<{ theme: any }>`
  width: 36px; height: 36px;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.primary.main};
  background: ${p => p.theme.colors.primary.main};
  color: ${p => p.theme.colors.primary.content};
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; font-size: 1.25rem; font-weight: 300;
  &:hover { transform: scale(1.05); box-shadow: 0 4px 12px ${p => p.theme.colors.primary.main}40; }
`;
const SearchWrapper = styled.div`position: relative; display: flex; align-items: center; margin-bottom: 0.75rem;`;
const SearchIconWrap = styled.div<{ theme: any }>`
  position: absolute; left: 0.875rem; display: flex; align-items: center;
  pointer-events: none; color: ${p => p.theme.colors.base.content}; opacity: 0.35;
  svg { width: 15px; height: 15px; }
`;
const SearchClearBtn = styled.button<{ theme: any }>`
  position: absolute; right: 0.625rem; display: flex; align-items: center;
  justify-content: center; width: 20px; height: 20px; border-radius: 50%;
  border: none; background: ${p => p.theme.colors.base[300]};
  color: ${p => p.theme.colors.base.content}; cursor: pointer; opacity: 0.55;
  transition: opacity 0.15s, background 0.15s; padding: 0; flex-shrink: 0;
  svg { width: 10px; height: 10px; }
  &:hover { opacity: 1; background: ${p => p.theme.colors.base[400]}; }
`;
const SearchInput = styled.input<{ theme: any }>`
  width: 100%; padding: 0.75rem 2.25rem 0.75rem 2.375rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem; transition: all 0.2s; box-sizing: border-box;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; background: ${p => p.theme.colors.base[100]}; box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}20; }
  &::placeholder { opacity: 0.5; }
`;
const BulkBar = styled.div<{ theme: any; $visible: boolean }>`
  background: ${p => p.theme.colors.base[400]};
  border: 1px solid ${p => p.$visible ? p.theme.colors.primary.main : 'transparent'};
  border-radius: ${p => p.theme.radius.field};
  padding: ${p => p.$visible ? '0.75rem 1rem' : '0'};
  margin-bottom: ${p => p.$visible ? '0.75rem' : '0'};
  display: flex; align-items: center; justify-content: space-between;
  font-weight: 500; font-size: 0.875rem;
  opacity: ${p => p.$visible ? 1 : 0};
  pointer-events: ${p => p.$visible ? 'auto' : 'none'};
  height: ${p => p.$visible ? 'auto' : 0};
  overflow: hidden;
  animation: ${p => p.$visible ? 'bulkSlideDown 0.2s ease' : 'none'};
  @keyframes bulkSlideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;
const Checkbox = styled.div<{ theme: any; $checked: boolean }>`
  width: 18px; height: 18px; min-width: 18px;
  border-radius: 4px;
  border: 2px solid ${p => p.$checked ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background: ${p => p.$checked ? p.theme.colors.primary.main : 'transparent'};
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s;
  &:hover { border-color: ${p => p.theme.colors.primary.main}; }
  &::after {
    content: '';
    display: ${p => p.$checked ? 'block' : 'none'};
    width: 4px; height: 8px;
    border: solid ${p => p.theme.colors.primary.content};
    border-width: 0 2px 2px 0;
    transform: rotate(45deg) translate(-1px, -1px);
  }
`;
const CompanyCardItem = styled(Card)<{ theme: any; $selected?: boolean }>`
  padding: 1.25rem; margin-bottom: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
  border-color: ${p => p.$selected ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background: ${p => p.$selected
    ? `${p.theme.colors.primary.main}08`
    : p.theme.colors.base[400]};
  &:hover {
    border-color: ${p => p.theme.colors.primary.main};
    transform: translateY(-1px);
    box-shadow: ${p => p.theme.colorScheme === 'dark' ? '0 8px 24px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)'};
  }
  &:last-child { margin-bottom: 0; }
`;
const CompanyCardHeader = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
`;
const CompanyCardInfo = styled.div`flex: 1; min-width: 0;`;
const CompanyCardName = styled.h3`
  font-size: 0.9375rem; font-weight: 600; margin: 0 0 0.375rem 0; letter-spacing: -0.01em;
`;
const CompanyCardEmail = styled.span`
  font-size: 0.8125rem; opacity: 0.6; font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
`;
const OptedOutBadge = styled.span`
  display: inline-flex; align-items: center; gap: 0.25rem;
  font-size: 0.68rem; font-weight: 600; letter-spacing: 0.03em;
  color: #ef4444; background: #ef444415; border: 1px solid #ef444430;
  border-radius: 999px; padding: 1px 7px 1px 5px; margin-left: 0.5rem;
  vertical-align: middle;
`;
const ActionBtns = styled.div`display: flex; align-items: center; gap: 0.375rem;`;
const IconBtn = styled.button<{ theme: any; $variant?: 'danger' | 'default' }>`
  padding: 0.5rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[200]};
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
  color: ${p => p.$variant === 'danger' ? p.theme.colors.error.main : p.theme.colors.base.content};
  &:hover {
    background: ${p => p.$variant === 'danger' ? p.theme.colors.error.main : p.theme.colors.primary.main};
    color: ${p => p.$variant === 'danger' ? p.theme.colors.error.content : p.theme.colors.primary.content};
    border-color: ${p => p.$variant === 'danger' ? p.theme.colors.error.main : p.theme.colors.primary.main};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
  svg { width: 16px; height: 16px; }
`;
// Single generate button with mode label + dropdown arrow
// Layout: [✦ icon]  [Plain Text / HTML Email]  [▾]
const GenBtn = styled.button<{ theme: any; $disabled?: boolean }>`
  position: relative;
  display: inline-flex; align-items: center;
  height: 34px;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[200]};
  color: ${p => p.theme.colors.base.content};
  opacity: ${p => p.$disabled ? 0.3 : 1};
  pointer-events: ${p => p.$disabled ? 'none' : 'auto'};
  cursor: pointer; overflow: visible;
  transition: border-color 0.15s;
  padding: 0;
  &:hover { border-color: ${p => p.theme.colors.primary.main}; }
`;
const GenBtnIcon = styled.span`
  display: flex; align-items: center; justify-content: center;
  padding: 0 0.45rem;
  svg { width: 15px; height: 15px; }
`;
const GenBtnLabel = styled.span`
  font-size: 0.75rem; font-weight: 600;
  padding: 0 0.3rem 0 0; white-space: nowrap;
`;
// Left clickable section (icon + label) — highlights on hover
const GenBtnLeft = styled.span<{ theme: any }>`
  display: inline-flex; align-items: center; align-self: stretch;
  border-radius: ${p => p.theme.radius.field} 0 0 ${p => p.theme.radius.field};
  transition: background 0.15s, color 0.15s;
  &:hover { background: ${p => p.theme.colors.primary.main}; color: ${p => p.theme.colors.primary.content}; }
  &:hover + .gen-divider { background: ${p => p.theme.colors.primary.main}60; }
`;
const GenBtnDivider = styled.span<{ theme: any }>`
  width: 1px; height: 18px; flex-shrink: 0;
  background: ${p => p.theme.colors.base[300]};
  transition: background 0.15s;
`;
const GenBtnChevron = styled.span<{ theme: any; $open: boolean }>`
  display: flex; align-items: center; justify-content: center;
  align-self: stretch;
  padding: 0 0.55rem;
  min-width: 28px;
  border-radius: 0 ${p => p.theme.radius.field} ${p => p.theme.radius.field} 0;
  transition: background 0.15s, color 0.15s;
  svg { width: 10px; height: 10px; transition: transform 0.15s; transform: ${p => p.$open ? 'rotate(180deg)' : 'none'}; }
  &:hover { background: ${p => p.theme.colors.primary.main}; color: ${p => p.theme.colors.primary.content}; }
`;
const GenDropMenu = styled.div<{ theme: any }>`
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 3000;
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  box-shadow: ${p => p.theme.colorScheme === 'dark' ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.13)'};
  min-width: 130px; overflow: hidden;
  animation: ${fadeSlide} 0.15s ease;
`;
const GenDropItem = styled.button<{ theme: any; $active?: boolean }>`
  width: 100%; display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: none; background: ${p => p.$active ? p.theme.colors.primary.main + '12' : 'transparent'};
  color: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base.content};
  font-size: 0.8rem; font-weight: ${p => p.$active ? 600 : 500}; cursor: pointer; text-align: left;
  transition: background 0.1s;
  svg { width: 13px; height: 13px; opacity: 0.7; flex-shrink: 0; }
  &:hover { background: ${p => p.theme.colors.primary.main + '15'}; color: ${p => p.theme.colors.primary.main}; }
  &:hover svg { opacity: 1; }
`;

// ─────────────────────────────────────────────────────────────
// SHARED ICONS & HELPERS
// ─────────────────────────────────────────────────────────────
const formatDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
};

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const BuildingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/>
  </svg>
);
const CheckSmallIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const EnrollIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);
const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const GearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const HtmlIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);
const MagnifyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const PaperclipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);
const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const SortIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/>
  </svg>
);
const SparkleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);
const TemplateIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
  </svg>
);
const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const UserMinusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);
const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const Pagination = styled.div<{ theme: any }>`
  display: flex; align-items: center; justify-content: center;
  gap: 0.5rem; padding: 1.5rem 0;
  border-top: 1px solid ${p => p.theme.colors.base[300]};
  margin-top: 1rem;
`;
const PageBtn = styled.button<{ theme: any; $active?: boolean }>`
  min-width: 36px; height: 36px; padding: 0 0.75rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base[400]};
  color: ${p => p.$active ? p.theme.colors.primary.content : p.theme.colors.base.content};
  cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.2s;
  display: flex; align-items: center; justify-content: center;
  &:hover:not(:disabled) { background: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.primary.main + '12'}; border-color: ${p => p.theme.colors.primary.main}; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const PageInfo = styled.span<{ theme: any }>`font-size: 0.875rem; opacity: 0.7; margin: 0 0.75rem;`;
const PageSizeSelect = styled.select<{ theme: any }>`
  padding: 0.5rem 0.75rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem; cursor: pointer; margin-left: 1rem;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }
`;
const EmptyState = styled.div`
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 4rem 2rem; text-align: center;
`;

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────
const ToastWrapper = styled.div<{ $visible: boolean }>`
  position: fixed; top: 24px; right: 24px; z-index: 10000;
  display: flex; flex-direction: column; gap: 0.75rem;
  pointer-events: ${p => p.$visible ? 'auto' : 'none'};
`;
const ToastItem = styled.div<{ theme: any; $type: string; $exiting?: boolean }>`
  display: flex; align-items: flex-start; gap: 0.75rem;
  padding: 1rem 1.25rem; min-width: 320px; max-width: 450px;
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.$type === 'success' ? p.theme.colors.success.main : p.$type === 'error' ? p.theme.colors.error.main : p.$type === 'warning' ? (p.theme.colors.warning?.main || '#f59e0b') : p.theme.colors.primary.main};
  border-left: 4px solid ${p => p.$type === 'success' ? p.theme.colors.success.main : p.$type === 'error' ? p.theme.colors.error.main : p.$type === 'warning' ? (p.theme.colors.warning?.main || '#f59e0b') : p.theme.colors.primary.main};
  border-radius: ${p => p.theme.radius.box};
  box-shadow: ${p => p.theme.colorScheme === 'dark' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.15)'};
  animation: ${p => p.$exiting ? slideOut : slideIn} 0.3s ease forwards;
`;

// ─────────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────
const Overlay = styled.div<{ $open: boolean }>`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: ${p => p.$open ? 'flex' : 'none'};
  align-items: center; justify-content: center; z-index: 10001;
`;
const Dialog = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 1.5rem; max-width: 420px; width: 90%;
  box-shadow: ${p => p.theme.colorScheme === 'dark' ? '0 20px 40px rgba(0,0,0,0.5)' : '0 20px 40px rgba(0,0,0,0.15)'};
`;
const DialogActions = styled.div`display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;`;
const CancelBtn = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  color: ${p => p.theme.colors.base.content};
  border: 1px solid ${p => p.theme.colors.base[300]};
  font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: all 0.2s;
  &:hover { background: ${p => p.theme.colors.base[300]}; }
`;
const ConfirmBtn = styled.button<{ theme: any; $danger?: boolean }>`
  padding: 0.625rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.$danger ? p.theme.colors.error.main : p.theme.colors.primary.main};
  color: ${p => p.$danger ? p.theme.colors.error.content : p.theme.colors.primary.content};
  border: none; font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: all 0.2s;
  &:hover { opacity: 0.9; transform: translateY(-1px); }
`;

// ─────────────────────────────────────────────────────────────
// UNSAVED CHANGES DIALOG
// ─────────────────────────────────────────────────────────────
const UnsavedChangesDialog: React.FC<{
  open: boolean;
  theme: any;
  onDiscard: () => void;
  onKeep: () => void;
}> = ({ open, theme, onDiscard, onKeep }) => (
  <Overlay $open={open} onClick={onKeep} style={{ zIndex: 11000 }}>
    <Dialog theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '50%',
          background: (theme.colors.warning?.main || '#f59e0b') + '18',
          color: theme.colors.warning?.main || '#f59e0b', flexShrink: 0,
        }}>
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
      <DialogActions>
        <CancelBtn theme={theme} onClick={onKeep}>Keep editing</CancelBtn>
        <ConfirmBtn theme={theme} $danger onClick={onDiscard}>Discard changes</ConfirmBtn>
      </DialogActions>
    </Dialog>
  </Overlay>
);

// ─────────────────────────────────────────────────────────────
// ADD COMPANIES MODAL
// ─────────────────────────────────────────────────────────────
const ModalOverlay = styled.div<{ $open: boolean }>`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
  z-index: 9999;
  display: ${p => p.$open ? 'flex' : 'none'};
  align-items: center; justify-content: center; padding: 1rem;
`;
const ModalBox = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border-radius: ${p => p.theme.radius.box};
  width: 100%; max-width: 600px; max-height: 90vh;
  overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: ${modalSlideUp} 0.25s ease;
`;
const ModalHead = styled.div<{ theme: any }>`
  padding: 1.5rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  display: flex; align-items: center; justify-content: space-between;
`;
const ModalTitle = styled.h3`margin: 0; font-size: 1.125rem; font-weight: 600;`;
const ModalCloseBtn = styled.button<{ theme: any }>`
  padding: 0.375rem; border: none; background: transparent;
  color: ${p => p.theme.colors.base.content}; cursor: pointer;
  border-radius: ${p => p.theme.radius.field}; opacity: 0.6; transition: all 0.2s;
  &:hover { opacity: 1; background: ${p => p.theme.colors.base[200]}; }
  svg { width: 20px; height: 20px; display: block; }
`;
const ModalBody = styled.div`padding: 1.5rem; overflow-y: auto; flex: 1;`;
const ModalFoot = styled.div<{ theme: any }>`
  padding: 1.25rem 1.5rem;
  border-top: 1px solid ${p => p.theme.colors.base[300]};
  display: flex; justify-content: flex-end;
`;
const TabBar = styled.div<{ theme: any }>`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  margin-bottom: 1.5rem;
`;
const TabBtn = styled.button<{ theme: any; $active: boolean }>`
  flex: 1; padding: 0.7rem 0.35rem;
  font-size: 0.775rem; font-weight: ${p => p.$active ? 600 : 500};
  cursor: pointer; border: none;
  border-bottom: 2px solid ${p => p.$active ? p.theme.colors.primary.main : 'transparent'};
  background: transparent;
  color: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base.content};
  opacity: ${p => p.$active ? 1 : 0.55};
  display: flex; align-items: center; justify-content: center; gap: 0.35rem;
  transition: all 0.15s; margin-bottom: -1px; white-space: nowrap;
  &:hover { opacity: 1; color: ${p => p.theme.colors.primary.main}; }
  svg { width: 13px; height: 13px; }
`;
const FG = styled.div`margin-bottom: 1rem;`;
const FL = styled.label<{ theme: any }>`
  display: block; font-size: 0.8rem; font-weight: 600; opacity: 0.75;
  margin-bottom: 0.375rem; color: ${p => p.theme.colors.base.content};
`;
const FI = styled.input<{ theme: any }>`
  width: 100%; padding: 0.65rem 0.875rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem; box-sizing: border-box; transition: all 0.15s;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; background: ${p => p.theme.colors.base[100]}; box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}18; }
  &::placeholder { opacity: 0.4; }
`;
const FTA = styled.textarea<{ theme: any }>`
  width: 100%; padding: 0.65rem 0.875rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem; font-family: inherit; box-sizing: border-box;
  resize: vertical; min-height: 72px; transition: all 0.15s;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; background: ${p => p.theme.colors.base[100]}; box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}18; }
  &::placeholder { opacity: 0.4; }
`;
const SubmitBtn = styled.button<{ theme: any }>`
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.65rem 1.5rem;
  border-radius: ${p => p.theme.radius.field}; border: none;
  background: ${p => p.theme.colors.primary.main};
  color: ${p => p.theme.colors.primary.content};
  font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
  &:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 14px ${p => p.theme.colors.primary.main}44; }
  &:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
  svg { width: 15px; height: 15px; }
`;
const BtnSpinner = styled.div`
  width: 15px; height: 15px;
  border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
  border-radius: 50%; animation: ${spin} 0.65s linear infinite; flex-shrink: 0;
`;
const SelectAllSpinner = styled.div<{ theme: any }>`
  width: 16px; height: 16px; flex-shrink: 0;
  border: 2px solid ${p => p.theme.colors.base[300]};
  border-top-color: ${p => p.theme.colors.primary.main};
  border-radius: 50%; animation: ${spin} 0.7s linear infinite;
`;
const DropZone = styled.div<{ theme: any; $drag: boolean; $file: boolean }>`
  border: 2px dashed ${p => p.$file || p.$drag ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.$file || p.$drag ? `${p.theme.colors.primary.main}08` : p.theme.colors.base[200]};
  padding: 2rem 1.5rem; text-align: center; cursor: pointer; transition: all 0.2s;
  &:hover { border-color: ${p => p.theme.colors.primary.main}; }
`;
const CodeHint = styled.code<{ theme: any }>`
  display: block; padding: 0.6rem 0.875rem;
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  font-size: 0.75rem; font-family: 'Courier New', monospace;
  color: ${p => p.theme.colors.base.content};
  margin-top: 0.5rem; line-height: 1.6; opacity: 0.8;
`;
const TavilyBox = styled.div<{ theme: any; $st: 'checking' | 'ok' | 'error' }>`
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 1rem; padding: 2.5rem 1.5rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.$st === 'ok' ? (p.theme.colors.success?.main || '#22c55e') + '60' : p.$st === 'error' ? p.theme.colors.error.main + '60' : p.theme.colors.base[300]};
  background: ${p => p.$st === 'ok' ? (p.theme.colors.success?.main || '#22c55e') + '08' : p.$st === 'error' ? p.theme.colors.error.main + '06' : p.theme.colors.base[200]};
  text-align: center; animation: ${fadeSlide} 0.2s ease;
`;
const CheckSpinner = styled.div<{ theme: any }>`
  width: 32px; height: 32px;
  border: 3px solid ${p => p.theme.colors.base[300]};
  border-top-color: ${p => p.theme.colors.primary.main};
  border-radius: 50%; animation: ${spin} 0.75s linear infinite;
`;
const ImproveSpinner = styled.div<{ theme: any }>`
  width: 12px; height: 12px;
  border: 2px solid ${p => p.theme.colors.primary.main}40;
  border-top-color: ${p => p.theme.colors.primary.main};
  border-radius: 50%;
  animation: ${spin} 0.65s linear infinite;
  flex-shrink: 0;
`;
const Banner = styled.div<{ theme: any; $t: 'success' | 'warning' | 'error' | 'info' }>`
  padding: 0.625rem 0.875rem;
  border-radius: ${p => p.theme.radius.field};
  font-size: 0.825rem; font-weight: 500; margin-top: 0.75rem;
  animation: ${fadeSlide} 0.2s ease;
  ${p => p.$t === 'success' ? `background:${p.theme.colors.success.main}12;border:1px solid ${p.theme.colors.success.main}60;color:${p.theme.colors.success.main};`
    : p.$t === 'warning' ? `background:${p.theme.colors.warning?.main || '#f59e0b'}12;border:1px solid ${p.theme.colors.warning?.main || '#f59e0b'}60;color:${p.theme.colors.warning?.main || '#f59e0b'};`
    : p.$t === 'info'    ? `background:${p.theme.colors.primary.main}10;border:1px solid ${p.theme.colors.primary.main}40;color:${p.theme.colors.primary.main};`
    : `background:${p.theme.colors.error.main}12;border:1px solid ${p.theme.colors.error.main}60;color:${p.theme.colors.error.main};`}
`;
const EnrollList = styled.div<{ theme: any }>`
  max-height: 260px; overflow-y: auto;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  scrollbar-width: thin;
`;
const EnrollRow = styled.div<{ theme: any; $sel: boolean; $enrolled?: boolean }>`
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  cursor: ${p => p.$enrolled ? 'default' : 'pointer'};
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.$enrolled ? `${p.theme.colors.success?.main || '#22c55e'}0a` : p.$sel ? `${p.theme.colors.primary.main}10` : 'transparent'};
  transition: background 0.1s;
  opacity: ${p => p.$enrolled ? 0.65 : 1};
  &:last-child { border-bottom: none; }
  &:hover { background: ${p => p.$enrolled ? `${p.theme.colors.success?.main || '#22c55e'}0a` : p.$sel ? `${p.theme.colors.primary.main}18` : p.theme.colors.base[300]}; }
`;
const RowCheck = styled.div<{ theme: any; $on: boolean; $enrolled?: boolean }>`
  width: 16px; height: 16px; flex-shrink: 0; border-radius: 4px;
  border: 1.5px solid ${p => p.$enrolled ? (p.theme.colors.success?.main || '#22c55e') : p.$on ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background: ${p => p.$enrolled ? (p.theme.colors.success?.main || '#22c55e') : p.$on ? p.theme.colors.primary.main : 'transparent'};
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
`;
const SelectBadge = styled.span<{ theme: any }>`
  font-size: 0.725rem; font-weight: 600;
  color: ${p => p.theme.colors.primary.main};
  background: ${p => p.theme.colors.primary.main}18;
  border: 1px solid ${p => p.theme.colors.primary.main}40;
  border-radius: 999px; padding: 1px 7px; margin-left: 6px;
`;
const SearchWrap = styled.div`position: relative; margin-bottom: 0.5rem;`;
const SIconWrap = styled.div`
  position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%);
  opacity: 0.4; pointer-events: none; display: flex;
  svg { width: 13px; height: 13px; }
`;
const EnrollSearch = styled(FI)`padding-left: 2rem !important;`;
const PulseRow = styled.div`
  padding: 2rem; text-align: center; font-size: 0.8125rem; opacity: 0.45;
  animation: ${pulse} 1.5s ease infinite;
`;

// ── Enroll dropdown filter ─────────────────────────────────────
const EnrollDropWrap = styled.div`position: relative; display: inline-block;`;
const EnrollDropTrigger = styled.button<{ theme: any; $active: boolean }>`
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.3rem 0.7rem; border-radius: 999px;
  font-size: 0.8rem; font-weight: 500; cursor: pointer;
  transition: all 0.15s; white-space: nowrap;
  border: 1px solid ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base[400]};
  color: ${p => p.$active ? p.theme.colors.primary.content : p.theme.colors.base.content};
  &:hover {
    border-color: ${p => p.theme.colors.primary.main};
    background: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.primary.main + '12'};
    color: ${p => p.$active ? p.theme.colors.primary.content : p.theme.colors.primary.main};
  }
  svg { width: 12px; height: 12px; flex-shrink: 0; }
`;
const EnrollDropBadge = styled.span<{ theme: any }>`
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 15px; height: 15px; padding: 0 3px; border-radius: 999px;
  font-size: 0.62rem; font-weight: 700;
  background: ${p => p.theme.colors.primary.content};
  color: ${p => p.theme.colors.primary.main};
`;
const EnrollDropMenu = styled.div<{ theme: any }>`
  position: absolute; top: calc(100% + 5px); left: 0; z-index: 2000;
  min-width: 200px; max-height: 260px; overflow-y: auto;
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  box-shadow: ${p => p.theme.colorScheme === 'dark' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)'};
  padding: 0.35rem;
`;
const EnrollDropSearch = styled.input<{ theme: any }>`
  width: 100%; padding: 0.45rem 0.65rem; box-sizing: border-box;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.8rem; margin-bottom: 0.3rem;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }
  &::placeholder { opacity: 0.5; }
`;
const EnrollDropItem = styled.div<{ theme: any; $checked: boolean }>`
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.45rem 0.55rem; border-radius: ${p => p.theme.radius.field};
  cursor: pointer; font-size: 0.8rem; font-weight: 500; transition: background 0.1s;
  background: ${p => p.$checked ? p.theme.colors.primary.main + '10' : 'transparent'};
  &:hover { background: ${p => p.$checked ? p.theme.colors.primary.main + '18' : p.theme.colors.base[400]}; }
  svg { width: 12px; height: 12px; flex-shrink: 0; opacity: 0.55; }
`;


// ─────────────────────────────────────────────────────────────
// ADD COMPANIES MODAL
// ─────────────────────────────────────────────────────────────
type ModalTab = 'enroll' | 'manual' | 'csv' | 'ai';
type TavilyStatus = 'idle' | 'checking' | 'ok' | 'error';
interface AddModalResult { type: 'success' | 'warning' | 'error' | 'info'; text: string; }
interface EnrollableCompany { id: number; name: string; email: string; }
interface Category { id: number; name: string; }

interface AddCompaniesModalProps {
  isOpen: boolean;
  campaignId: number;
  theme: any;
  apiBase: string;
  onClose: () => void;
  onSuccess: (active: number) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

const AddCompaniesModal: React.FC<AddCompaniesModalProps> = ({
  isOpen, campaignId, theme, apiBase, onClose, onSuccess, onToast,
}) => {
  const [tab, setTab]         = useState<ModalTab>('enroll');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<AddModalResult | null>(null);

  const [enrollSearch, setEnrollSearch]   = useState('');
  const [enrollList, setEnrollList]       = useState<EnrollableCompany[]>([]);
  const [enrollTotal, setEnrollTotal]     = useState(0);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrolledIds, setEnrolledIds]     = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set());
  const [toRemoveIds, setToRemoveIds]     = useState<Set<number>>(new Set());
  const enrollDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [categories, setCategories]           = useState<Category[]>([]);
  const [selectedCatIds, setSelectedCatIds]   = useState<Set<number>>(new Set());
  const [catFilterMode, setCatFilterMode]       = useState<'any' | 'all'>('any');
  const [catsLoading, setCatsLoading]         = useState(false);
  const [catDropOpen, setCatDropOpen]         = useState(false);
  const [catDropSearch, setCatDropSearch]     = useState('');
  const catDropRef = useRef<HTMLDivElement>(null);

  const [man, setMan] = useState({ name: '', email: '', phone_number: '', address: '', company_info: '' });

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isDrag, setIsDrag]   = useState(false);
  const fileRef               = useRef<HTMLInputElement>(null);

  const [aiQuery, setAiQuery] = useState('');
  const [aiLimit, setAiLimit] = useState(10);
  const [aiLimitRaw, setAiLimitRaw] = useState('10');
  const [aiIncludePhone,   setAiIncludePhone]   = useState(true);
  const [aiIncludeAddress, setAiIncludeAddress] = useState(true);
  const [aiIncludeInfo,    setAiIncludeInfo]    = useState(true);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [tvStatus, setTvStatus] = useState<TavilyStatus>('idle');
  const [tvMsg, setTvMsg]       = useState('');
  const [tvStatusCode, setTvStatusCode] = useState<number>(0);
  const [llmMsg, setLlmMsg]     = useState('');
  const [llmStatusCode, setLlmStatusCode] = useState<number>(0);


  const resetAll = () => {
    setTab('enroll'); setResult(null);
    setEnrollSearch(''); setEnrollList([]); setEnrolledIds(new Set()); setSelectedIds(new Set()); setToRemoveIds(new Set());
    setCategories([]); setCatDropOpen(false); setCatDropSearch('');
    setSelectedCatIds(new Set()); setCatFilterMode('any');
    setMan({ name: '', email: '', phone_number: '', address: '', company_info: '' });
    setCsvFile(null); setIsDrag(false);
    setAiQuery(''); setAiLimit(10); setAiLimitRaw('10'); setAiIncludePhone(true); setAiIncludeAddress(true); setAiIncludeInfo(true); setIsImprovingPrompt(false); setTvStatus('idle'); setTvMsg('');
  };

  useEffect(() => { if (isOpen) resetAll(); }, [isOpen]);

  const [confirmClose, setConfirmClose] = useState(false);
  const isDirty = (
    tab === 'manual' ? (man.name.trim() !== '' || man.email.trim() !== '' || man.phone_number.trim() !== '' || man.address.trim() !== '' || man.company_info.trim() !== '') :
    tab === 'csv'    ? csvFile !== null :
    tab === 'ai'     ? aiQuery.trim() !== '' :
    tab === 'enroll' ? (selectedIds.size > 0 || toRemoveIds.size > 0) :
    false
  );
  const handleClose = () => {
    if (isDirty) { setConfirmClose(true); return; }
    resetAll(); onClose();
  };

  // Close cat dropdown on outside click
  useEffect(() => {
    if (!catDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (catDropRef.current && !catDropRef.current.contains(e.target as Node)) {
        setCatDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catDropOpen]);

  // ── Improve AI prompt ─────────────────────────────────────
  const improvePrompt = async () => {
    if (!aiQuery.trim() || isImprovingPrompt) return;
    setIsImprovingPrompt(true);
    try {
      const res = await apiFetch(`${apiBase}/company/improve-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiQuery.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed to improve prompt');
      setAiQuery(d.improved);
    } catch (err) {
      setResult({ type: 'error', text: err instanceof Error ? err.message : 'Failed to improve prompt' });
    } finally {
      setIsImprovingPrompt(false);
    }
  };

  const loadEnrollList = async (search: string) => {
    setEnrollLoading(true);
    try {
      const PAGE_SIZE = 100;
      const s = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
      const catQ = selectedCatIds.size > 0
        ? `&filter_categories=${Array.from(selectedCatIds).join(',')}&category_filter_mode=${catFilterMode}`
        : '';
      let allCos: EnrollableCompany[] = [], page = 1, total = Infinity;
      while (allCos.length < total) {
        const r = await apiFetch(`${apiBase}/company/?page=${page}&size=${PAGE_SIZE}${s}${catQ}`, { });
        if (!r.ok) break;
        const d = await r.json(); total = d.total || 0;
        allCos = [...allCos, ...(d.companies || [])];
        if (allCos.length >= total) break; page++;
      }
      let enrolled: EnrollableCompany[] = []; page = 1; total = Infinity;
      while (enrolled.length < total) {
        const r = await apiFetch(`${apiBase}/company/?page=${page}&size=${PAGE_SIZE}&filter_campaigns=${campaignId}`, { });
        if (!r.ok) break;
        const d = await r.json(); total = d.total || 0;
        enrolled = [...enrolled, ...(d.companies || [])];
        if (enrolled.length >= total) break; page++;
      }
      const eIds = new Set<number>(enrolled.map(c => c.id));
      setEnrolledIds(eIds); setEnrollTotal(allCos.length);
      setEnrollList([
        ...allCos.filter(c => eIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)),
        ...allCos.filter(c => !eIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)),
      ]);
    } catch { /* silent */ } finally { setEnrollLoading(false); }
  };

  useEffect(() => { if (tab === 'enroll' && isOpen) loadEnrollList(''); }, [tab, isOpen, campaignId, selectedCatIds, catFilterMode]);
  useEffect(() => {
    if (tab !== 'enroll' || !isOpen) return;
    if (enrollDebounce.current) clearTimeout(enrollDebounce.current);
    enrollDebounce.current = setTimeout(() => loadEnrollList(enrollSearch), 350);
    return () => { if (enrollDebounce.current) clearTimeout(enrollDebounce.current); };
  }, [enrollSearch]);

  // Load categories for filter dropdown
  const loadCategories = async () => {
    setCatsLoading(true);
    try {
      const r = await apiFetch(`${apiBase}/category/`, {});
      if (!r.ok) return;
      const d = await r.json();
      setCategories(d.categories || d || []);
    } catch { /* silent */ } finally { setCatsLoading(false); }
  };

  useEffect(() => { if (tab === 'enroll' && isOpen) loadCategories(); }, [tab, isOpen]);

  const checkTavily = async () => {
    setTvStatus('checking'); setTvMsg(''); setTvStatusCode(0); setLlmMsg(''); setLlmStatusCode(0);
    try {
      const r = await apiFetch(`${apiBase}/user_keys/status/`, { });
      const d = await r.json();
      const tvCode: number = d.tavily?.status_code ?? 0;
      const llmCode: number = d.llm?.status_code ?? 0;
      setTvStatusCode(tvCode);
      setTvMsg(d.tavily?.status_text || '');
      setLlmStatusCode(llmCode);
      setLlmMsg(d.llm?.status_text || '');
      if (tvCode === 1 && llmCode === 1) { setTvStatus('ok'); }
      else { setTvStatus('error'); }
    } catch { setTvStatus('error'); setTvMsg('Could not reach server to verify keys'); setTvStatusCode(3); }
  };
  useEffect(() => { if (tab === 'ai' && tvStatus === 'idle') checkTavily(); }, [tab]);

  const submitEnroll = async () => {
    const toEnroll = Array.from(selectedIds).filter(id => !enrolledIds.has(id));
    const toUnenroll = Array.from(toRemoveIds);
    if (toEnroll.length === 0 && toUnenroll.length === 0) {
      setResult({ type: 'error', text: selectedIds.size > 0 ? 'Selected companies are already enrolled' : 'No changes to save' });
      return;
    }
    setLoading(true); setResult(null);
    try {
      if (toEnroll.length > 0) {
        const r = await apiFetch(`${apiBase}/campaign/bulk-enroll/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_ids: toEnroll, campaign_ids: [campaignId] }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail || 'Failed to enroll');
      }
      if (toUnenroll.length > 0) {
        const r = await apiFetch(`${apiBase}/campaign/bulk-unenroll/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_ids: toUnenroll, campaign_ids: [campaignId] }),
        });
        if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed to unenroll'); }
      }
      const parts = [];
      if (toEnroll.length > 0)   parts.push(`${toEnroll.length} enrolled`);
      if (toUnenroll.length > 0) parts.push(`${toUnenroll.length} unenrolled`);
      onToast('success', 'Saved', parts.join(', '));
    } catch (err) { onToast('error', 'Failed', err instanceof Error ? err.message : 'Failed to save'); }
    finally { setLoading(false); }
  };

  const submitManual = async () => {
    if (!man.name.trim() || !man.email.trim()) { setResult({ type: 'error', text: 'Name and email are required' }); return; }
    setLoading(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('companies', JSON.stringify([{ name: man.name.trim(), email: man.email.trim(), phone_number: man.phone_number.trim() || null, address: man.address.trim() || null, company_info: man.company_info.trim() || null }]));
      fd.append('campaign_id', String(campaignId));
      const r = await apiFetch(`${apiBase}/company/`, { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Failed');
      if (d.created === 0) { onToast('warning', 'Skipped', 'Company already exists (duplicate email)'); return; }
      onToast('success', 'Added', `"${man.name}" added and enrolled`);
    } catch (err) { onToast('error', 'Failed', err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  const submitCsv = async () => {
    if (!csvFile) { setResult({ type: 'error', text: 'Select a CSV file first' }); return; }
    const fileSnapshot = csvFile;
    // Close modal and show spinner immediately, then fire request in background
    resetAll(); onSuccess(1); onClose();
    const fd = new FormData(); fd.append('file', fileSnapshot); fd.append('campaign_id', String(campaignId));
    try {
      const r = await apiFetch(`${apiBase}/company/`, { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        onToast('success', 'Imported', `${d.created ?? 0} compan${(d.created ?? 0) === 1 ? 'y' : 'ies'} imported`);
      } else {
        onToast('error', 'Import Failed', d.detail || 'CSV import failed');
      }
    } catch {
      onToast('error', 'Import Failed', 'An error occurred during CSV import');
    } finally {
      onSuccess(0); // signals completion → triggers setRefresh in parent
    }
  };

  const submitAi = async () => {
    if (!aiQuery.trim()) { setResult({ type: 'error', text: 'Enter a search query' }); return; }
    // Close modal and show spinner immediately, then fire request in background
    resetAll(); onSuccess(1); onClose();
    const fd = new FormData(); fd.append('ai_search', JSON.stringify({ query: aiQuery.trim(), limit: aiLimit, include_phone: aiIncludePhone, include_address: aiIncludeAddress, include_company_info: aiIncludeInfo })); fd.append('campaign_id', String(campaignId));
    apiFetch(`${apiBase}/company/`, { method: 'POST', body: fd })
      .catch(() => { /* silent — polling will stop naturally */ });
  };

  const handleSubmit = () => {
    onSuccess(0); onClose();
    if (tab === 'enroll') submitEnroll();
    else if (tab === 'manual') submitManual();
    else if (tab === 'csv') submitCsv();
    else submitAi();
  };

  const toggleSelect = (id: number) => {
    if (enrolledIds.has(id)) return;
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setResult(null);
  };

  const toggleRemove = (id: number) => {
    setToRemoveIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setResult(null);
  };

  const newSelectionCount = Array.from(selectedIds).filter(id => !enrolledIds.has(id)).length;
  const removeCount = toRemoveIds.size;
  const enrollHasChanges = newSelectionCount > 0 || removeCount > 0;
  const submitLabel = loading ? 'Processing…'
    : tab !== 'enroll' ? (tab === 'manual' ? 'Add & Enroll' : tab === 'csv' ? 'Import & Enroll' : 'Search & Enroll')
    : newSelectionCount > 0 && removeCount > 0 ? `Save (+${newSelectionCount} / -${removeCount})`
    : newSelectionCount > 0 ? `Enroll (${newSelectionCount})`
    : removeCount > 0 ? `Unenroll (${removeCount})`
    : 'Enroll';

  return (
    <>
    <ModalOverlay $open={isOpen} onClick={handleClose}>
      <ModalBox theme={theme} onClick={e => e.stopPropagation()}>
        <ModalHead theme={theme}>
          <ModalTitle>Add Companies to Campaign</ModalTitle>
          <ModalCloseBtn theme={theme} onClick={handleClose}><XIcon /></ModalCloseBtn>
        </ModalHead>

        <ModalBody>
          <TabBar theme={theme}>
            {([['enroll', <EnrollIcon />, 'Enroll Existing'], ['manual', <PencilIcon />, 'Manual'], ['csv', <FileIcon />, 'CSV Upload'], ['ai', <SparkleIcon />, 'AI Search']] as [ModalTab, React.ReactNode, string][]).map(([t, icon, label]) => (
              <TabBtn key={t} theme={theme} $active={tab === t} onClick={() => { setTab(t); setResult(null); }}>
                {icon} {label}
              </TabBtn>
            ))}
          </TabBar>

          {tab === 'enroll' && (
            <div>
              {/* Header row: filter dropdown + label + total */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                {/* Category filter dropdown */}
                {(categories.length > 0 || catsLoading) && (
                  <EnrollDropWrap ref={catDropRef}>
                    <EnrollDropTrigger theme={theme} $active={selectedCatIds.size > 0}
                      onClick={() => { setCatDropOpen(p => !p); setCatDropSearch(''); }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                      Category
                      {selectedCatIds.size > 0 && <EnrollDropBadge theme={theme}>{selectedCatIds.size}</EnrollDropBadge>}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </EnrollDropTrigger>
                    {catDropOpen && (
                      <EnrollDropMenu theme={theme}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
                          <EnrollDropSearch theme={theme} placeholder="Search categories…"
                            value={catDropSearch} autoFocus
                            onChange={e => setCatDropSearch(e.target.value)}
                            onClick={e => e.stopPropagation()} />
                          {selectedCatIds.size > 0 && (
                            <button onClick={e => { e.stopPropagation(); setSelectedCatIds(new Set()); setCatFilterMode('any'); setCatDropOpen(false); }}
                              style={{ flexShrink: 0, padding: '0 0.45rem', height: '28px', border: 'none', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: theme.colors.error.main, whiteSpace: 'nowrap' }}>
                              Clear
                            </button>
                          )}
                        </div>
                        {catsLoading ? (
                          <div style={{ padding: '0.5rem', fontSize: '0.8rem', opacity: 0.45, textAlign: 'center' }}>Loading…</div>
                        ) : categories.filter(c => c.name.toLowerCase().includes(catDropSearch.toLowerCase())).length === 0 ? (
                          <div style={{ padding: '0.5rem', fontSize: '0.8rem', opacity: 0.45, textAlign: 'center' }}>No categories found</div>
                        ) : categories.filter(c => c.name.toLowerCase().includes(catDropSearch.toLowerCase())).map(cat => (
                          <EnrollDropItem key={cat.id} theme={theme} $checked={selectedCatIds.has(cat.id)}
                            onClick={() => { setSelectedCatIds(prev => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; }); }}>
                            <div style={{
                              width: 14, height: 14, minWidth: 14, borderRadius: 3, flexShrink: 0,
                              border: `1.5px solid ${selectedCatIds.has(cat.id) ? theme.colors.primary.main : theme.colors.base[300]}`,
                              background: selectedCatIds.has(cat.id) ? theme.colors.primary.main : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                            }}>
                              {selectedCatIds.has(cat.id) && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" width="8" height="8"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            {cat.name}
                          </EnrollDropItem>
                        ))}
                      </EnrollDropMenu>
                    )}
                  </EnrollDropWrap>
                )}
                {/* Any / All toggle — shown when 2+ categories selected */}
                {selectedCatIds.size >= 2 && (
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${theme.colors.base[300]}`, borderRadius: '999px', overflow: 'hidden', flexShrink: 0 }}>
                    {(['any', 'all'] as const).map(mode => (
                      <button key={mode} onClick={() => setCatFilterMode(mode)} style={{
                        padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        cursor: 'pointer', border: 'none',
                        background: catFilterMode === mode ? theme.colors.primary.main : 'transparent',
                        color: catFilterMode === mode ? theme.colors.primary.content : theme.colors.base.content,
                        opacity: catFilterMode === mode ? 1 : 0.45,
                        transition: 'all 0.15s',
                      }}>{mode}</button>
                    ))}
                  </div>
                )}
                <div style={{ flex: 1 }} />
                {selectedIds.size > 0 && <SelectBadge theme={theme}>{selectedIds.size} selected</SelectBadge>}
                <span style={{ fontSize: '0.75rem', opacity: 0.45 }}>{enrollTotal} total</span>
              </div>

              <SearchWrap>
                <SIconWrap><MagnifyIcon /></SIconWrap>
                <EnrollSearch theme={theme} placeholder="Search by name or email…" value={enrollSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnrollSearch(e.target.value)} />
              </SearchWrap>
              <EnrollList theme={theme}>
                {enrollLoading ? (
                  <PulseRow>Loading companies…</PulseRow>
                ) : enrollList.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.45, fontSize: '0.8125rem' }}>
                    {enrollSearch ? `No companies match "${enrollSearch}"` : 'No companies found. Add some first.'}
                  </div>
                ) : (() => {
                  const filtered = enrollList;
                  const eOnes = filtered.filter(c => enrolledIds.has(c.id));
                  const uOnes = filtered.filter(c => !enrolledIds.has(c.id));

                  if (filtered.length === 0) return (
                    <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.45, fontSize: '0.8125rem' }}>
                      No companies match this filter{enrollSearch ? ` and "${enrollSearch}"` : ''}.
                    </div>
                  );

                  // Select-all for unenrolled companies in current filtered view
                  const selectableIds = uOnes.map(c => c.id);
                  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));
                  const someSelected = selectableIds.some(id => selectedIds.has(id));

                  return (<>
                    {/* Select all row — only shown when there are unenrolled companies */}
                    {uOnes.length > 0 && (
                      <div
                        onClick={() => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (allSelected) { selectableIds.forEach(id => next.delete(id)); }
                            else { selectableIds.forEach(id => next.add(id)); }
                            return next;
                          });
                          setResult(null);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.5rem 0.875rem', cursor: 'pointer',
                          borderBottom: `1px solid ${theme.colors.primary.main}30`,
                          background: allSelected || someSelected
                            ? theme.colors.primary.main + '14'
                            : theme.colors.primary.main + '08',
                          fontSize: '0.8rem', fontWeight: 600,
                          color: theme.colors.primary.main,
                        }}>
                        <div style={{
                          width: 16, height: 16, minWidth: 16, borderRadius: 4, flexShrink: 0,
                          border: `1.5px solid ${allSelected || someSelected ? theme.colors.primary.main : theme.colors.base[300]}`,
                          background: allSelected ? theme.colors.primary.main : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                          boxSizing: 'border-box' as const,
                        }}>
                          {allSelected && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" width="9" height="9"><polyline points="20 6 9 17 4 12"/></svg>}
                          {!allSelected && someSelected && <div style={{ width: 8, height: 2, background: theme.colors.primary.main, borderRadius: 1 }} />}
                        </div>
                        Select all ({uOnes.length})
                      </div>
                    )}
                    {eOnes.length > 0 && (<>
                      <div style={{ padding: '0.35rem 0.875rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, borderBottom: `1px solid ${theme.colors.base[300]}`, background: (theme.colors.success?.main || '#22c55e') + '08' }}>
                        ✓ Already enrolled ({eOnes.length})
                      </div>
                      {eOnes.map(c => {
                        const markedForRemoval = toRemoveIds.has(c.id);
                        return (
                          <EnrollRow
                            key={c.id} theme={theme}
                            $sel={markedForRemoval}
                            $enrolled={!markedForRemoval}
                            onClick={() => toggleRemove(c.id)}
                            style={{ cursor: 'pointer', opacity: markedForRemoval ? 0.55 : 0.65 }}
                          >
                            <RowCheck theme={theme} $on={!markedForRemoval} $enrolled={!markedForRemoval}>
                              {markedForRemoval
                                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="10" height="10"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                : <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>
                              }
                            </RowCheck>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.8375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: markedForRemoval ? 'line-through' : 'none' }}>{c.name}</div>
                              <div style={{ fontSize: '0.75rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                            </div>
                            <span style={{
                              fontSize: '0.7rem', fontWeight: 600, flexShrink: 0,
                              color: markedForRemoval ? (theme.colors.error?.main || '#ef4444') : (theme.colors.success?.main || '#22c55e'),
                              background: markedForRemoval ? (theme.colors.error?.main || '#ef4444') + '18' : (theme.colors.success?.main || '#22c55e') + '18',
                              border: `1px solid ${markedForRemoval ? (theme.colors.error?.main || '#ef4444') : (theme.colors.success?.main || '#22c55e')}40`,
                              borderRadius: '999px', padding: '1px 7px',
                            }}>{markedForRemoval ? 'unenroll' : 'enrolled'}</span>
                          </EnrollRow>
                        );
                      })}
                    </>)}
                    {eOnes.length > 0 && uOnes.length > 0 && (
                      <div style={{ padding: '0.35rem 0.875rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, borderBottom: `1px solid ${theme.colors.base[300]}` }}>
                        Not enrolled ({uOnes.length})
                      </div>
                    )}
                    {uOnes.map(c => (
                      <EnrollRow key={c.id} theme={theme} $sel={selectedIds.has(c.id)} onClick={() => toggleSelect(c.id)}>
                        <RowCheck theme={theme} $on={selectedIds.has(c.id)}>
                          {selectedIds.has(c.id) && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>}
                        </RowCheck>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.8375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                        </div>
                      </EnrollRow>
                    ))}
                    {uOnes.length === 0 && eOnes.length > 0 && !enrollSearch && (
                      <div style={{ padding: '1rem 0.875rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>All companies are already enrolled</div>
                    )}
                  </>);
                })()}
              </EnrollList>
            </div>
          )}

          {tab === 'manual' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FG><FL theme={theme}>Company Name *</FL><FI theme={theme} value={man.name} autoFocus placeholder="Acme Corp" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMan(p => ({ ...p, name: e.target.value }))} /></FG>
              <FG><FL theme={theme}>Email *</FL><FI theme={theme} type="email" value={man.email} placeholder="contact@acme.com" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMan(p => ({ ...p, email: e.target.value }))} /></FG>
              <FG><FL theme={theme}>Phone</FL><FI theme={theme} value={man.phone_number} placeholder="+1 (555) 000-0000" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMan(p => ({ ...p, phone_number: e.target.value }))} /></FG>
              <FG style={{ gridColumn: '1 / -1' }}><FL theme={theme}>Address</FL><FI theme={theme} value={man.address} placeholder="123 Main St, City, State" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMan(p => ({ ...p, address: e.target.value }))} /></FG>
              <FG style={{ gridColumn: '1 / -1' }}><FL theme={theme}>Company Info</FL><FTA theme={theme} rows={3} value={man.company_info} placeholder="Brief description…" onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMan(p => ({ ...p, company_info: e.target.value }))} /></FG>
              <Banner theme={theme} $t="info" style={{ gridColumn: '1 / -1', marginTop: 0 }}>ℹ️ Company will be added to your pool, then enrolled in this campaign.</Banner>
            </div>
          )}

          {tab === 'csv' && (
            <div>
              <DropZone theme={theme} $drag={isDrag} $file={!!csvFile}
                onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
                onDragLeave={() => setIsDrag(false)}
                onDrop={e => { e.preventDefault(); setIsDrag(false); const f = e.dataTransfer.files[0]; f?.name.endsWith('.csv') ? (setCsvFile(f), setResult(null)) : setResult({ type: 'error', text: 'Only .csv files accepted' }); }}
                onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }}>{csvFile ? '✅' : '📄'}</div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{csvFile ? csvFile.name : 'Drop your CSV here or click to browse'}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : 'Only .csv files accepted'}</div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setCsvFile(f); setResult(null); } e.target.value = ''; }} />
              </DropZone>
              <div style={{ marginTop: '1.25rem' }}>
                <FL theme={theme}>Required CSV format</FL>
                <CodeHint theme={theme}>company_name, email, phone_number, address, company_info{'\n'}Acme Corp, contact@acme.com, +1555000, "123 Main St", "B2B SaaS"</CodeHint>
                <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.4rem' }}>Only <strong>company_name</strong> and <strong>email</strong> are required. Duplicates are skipped automatically.</div>
              </div>
            </div>
          )}

          {tab === 'ai' && (
            <div>
              {tvStatus === 'checking' && (
                <TavilyBox theme={theme} $st="checking">
                  <CheckSpinner theme={theme} />
                  <div style={{ fontWeight: 600 }}>Checking API keys…</div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Verifying Tavily and LLM keys are configured and working.</div>
                </TavilyBox>
              )}
              {tvStatus === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Both not set — show single combined message */}
                  {tvStatusCode === 0 && llmStatusCode === 0 ? (
                    <TavilyBox theme={theme} $st="error">
                      <div style={{ fontSize: '2rem' }}>🔑</div>
                      <div style={{ fontWeight: 600, color: theme.colors.error.main }}>API Keys Not Configured</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7, maxWidth: '320px', lineHeight: 1.5 }}>
                        AI search requires both a Tavily and an LLM API key. Get a free Tavily key at{' '}
                        <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>tavily.com</a>.
                      </div>
                    </TavilyBox>
                  ) : (
                    <>
                      {/* Tavily error only */}
                      {tvStatusCode !== 1 && (
                        <TavilyBox theme={theme} $st="error">
                          <div style={{ fontSize: '2rem' }}>{tvStatusCode === 0 ? '🔑' : tvStatusCode === 2 ? '⚠️' : '❌'}</div>
                          <div style={{ fontWeight: 600, color: theme.colors.error.main }}>
                            {tvStatusCode === 0 ? 'Tavily API Key Not Set'
                              : tvStatusCode === 2 ? 'Tavily Usage Limit Reached'
                              : 'Tavily API Key Not Working'}
                          </div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.7, maxWidth: '320px', lineHeight: 1.5 }}>
                            {tvMsg || 'AI search requires a Tavily API key.'}{' '}
                            {tvStatusCode === 0 && <>Get a free key at{' '}
                              <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>tavily.com</a>.</>}
                          </div>
                        </TavilyBox>
                      )}
                      {/* LLM error only */}
                      {llmStatusCode !== 1 && (
                        <TavilyBox theme={theme} $st="error">
                          <div style={{ fontSize: '2rem' }}>{llmStatusCode === 0 ? '🔑' : llmStatusCode === 2 ? '⚠️' : '❌'}</div>
                          <div style={{ fontWeight: 600, color: theme.colors.error.main }}>
                            {llmStatusCode === 0 ? 'LLM API Key Not Set'
                              : llmStatusCode === 2 ? 'LLM Usage Limit Reached'
                              : 'LLM API Key Not Working'}
                          </div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.7, maxWidth: '320px', lineHeight: 1.5 }}>
                            {llmMsg || 'AI search requires an LLM API key to generate company profiles.'}
                          </div>
                        </TavilyBox>
                      )}
                    </>
                  )}
                </div>
              )}
              {tvStatus === 'ok' && (<>
                <div style={{ fontSize: '0.775rem', opacity: 0.5, lineHeight: 1.5, marginBottom: '1rem', color: theme.colors.base.content }}>
                  Company search uses a fixed model — Gemini 2.5 Flash with custom tools. Your selected model is used for email generation only.
                </div>
                <FG>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <FL theme={theme} style={{ marginBottom: 0 }}>Search Query *</FL>
                    <button
                      type="button"
                      onClick={improvePrompt}
                      disabled={!aiQuery.trim() || isImprovingPrompt}
                      title="Optimize prompt with AI"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem', fontWeight: 600,
                        border: `1px solid ${theme.colors.primary.main}50`,
                        borderRadius: theme.radius?.field || '6px',
                        background: aiQuery.trim() && !isImprovingPrompt
                          ? `${theme.colors.primary.main}12`
                          : theme.colors.base[200],
                        color: aiQuery.trim() && !isImprovingPrompt
                          ? theme.colors.primary.main
                          : `${theme.colors.base.content}40`,
                        cursor: aiQuery.trim() && !isImprovingPrompt ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s',
                        flexShrink: 0,
                      }}
                    >
                      {isImprovingPrompt ? (
                        <><ImproveSpinner theme={theme} />Optimizing...</>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
                            <path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75z"/>
                          </svg>
                          Optimize
                        </>
                      )}
                    </button>
                  </div>
                  <FTA theme={theme} rows={3} value={aiQuery} autoFocus
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAiQuery(e.target.value)}
                    placeholder={'"B2B SaaS companies in Berlin with 50-200 employees"'} />
                </FG>
                <FG><FL theme={theme}>Number of companies</FL>
                  <input type="number" min={1} max={1000} value={aiLimitRaw}
                    onChange={e => setAiLimitRaw(e.target.value)}
                    onBlur={() => {
                      const clamped = Math.min(1000, Math.max(1, parseInt(aiLimitRaw, 10) || 1));
                      setAiLimit(clamped);
                      setAiLimitRaw(String(clamped));
                    }}
                    style={{ width: '100%', padding: '0.65rem 0.9rem', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, background: theme.colors.base[200], color: theme.colors.base.content, fontSize: '0.875rem', boxSizing: 'border-box' as const }}
                  /></FG>
                <FG><FL theme={theme}>Include fields</FL>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const, marginTop: '0.35rem' }}>
                    {([
                      { label: 'Phone',        val: aiIncludePhone,   set: setAiIncludePhone },
                      { label: 'Address',      val: aiIncludeAddress, set: setAiIncludeAddress },
                      { label: 'Company Info', val: aiIncludeInfo,    set: setAiIncludeInfo },
                    ] as const).map(({ label, val, set }) => (
                      <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' as const }}>
                        <div onClick={() => set(!val)} style={{
                          width: 16, height: 16, minWidth: 16, borderRadius: 4, flexShrink: 0,
                          border: `2px solid ${val ? theme.colors.primary.main : theme.colors.base[300]}`,
                          background: val ? theme.colors.primary.main : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s', cursor: 'pointer',
                        }}>
                          {val && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        {label}
                      </label>
                    ))}
                  </div>
                </FG>
                <Banner theme={theme} $t="warning" style={{ marginTop: '1.25rem' }}>
                  ⚠️ Search time varies depending on the number of companies requested. Discovered companies will be added to your pool and enrolled.
                </Banner>
              </>)}
            </div>
          )}

          {result && (
            <Banner theme={theme} $t={result.type} style={{ marginTop: '1rem' }}>
              {result.type === 'success' ? '✓ ' : result.type === 'warning' ? '⚠ ' : result.type === 'info' ? 'ℹ ' : '✕ '}
              {result.text}
            </Banner>
          )}
        </ModalBody>

        <ModalFoot theme={theme}>
          <SubmitBtn theme={theme} onClick={handleSubmit} disabled={loading || (tab === 'ai' && tvStatus !== 'ok') || (tab === 'enroll' && !enrollHasChanges)}>
            {loading ? <BtnSpinner /> : <UploadIcon />}
            {submitLabel}
          </SubmitBtn>
        </ModalFoot>
      </ModalBox>
    </ModalOverlay>
    <UnsavedChangesDialog
      open={confirmClose}
      theme={theme}
      onKeep={() => setConfirmClose(false)}
      onDiscard={() => { setConfirmClose(false); resetAll(); onClose(); }}
    />
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// COMPANY DETAIL MODAL (read-only)
// ─────────────────────────────────────────────────────────────
const DetailOverlay = styled.div<{ $open: boolean }>`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
  z-index: 9999;
  display: ${p => p.$open ? 'flex' : 'none'};
  align-items: center; justify-content: center; padding: 1rem;
`;
const DetailBox = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  width: 100%; max-width: 520px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  animation: ${modalSlideUp} 0.25s ease;
  overflow: hidden;
`;
const DetailHead = styled.div<{ theme: any }>`
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  display: flex; align-items: center; justify-content: space-between;
`;
const DetailBody = styled.div`padding: 1.5rem;`;
const DetailRow = styled.div<{ theme: any }>`
  display: flex; flex-direction: column; gap: 0.25rem;
  padding: 0.875rem 0;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  &:last-child { border-bottom: none; }
`;
const DetailLabel = styled.span`
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; opacity: 0.45;
`;
const DetailValue = styled.span<{ theme: any; $mono?: boolean }>`
  font-size: 0.9rem; font-weight: 500;
  font-family: ${p => p.$mono ? "'SF Mono', 'Monaco', 'Courier New', monospace" : 'inherit'};
  color: ${p => p.theme.colors.base.content};
  word-break: break-word;
`;
const DetailEmpty = styled.span`font-size: 0.85rem; opacity: 0.3; font-style: italic;`;

interface CompanyDetailModalProps {
  company: Company | null;
  isOpen: boolean;
  theme: any;
  apiBase: string;
  onClose: () => void;
  onDownload: (company: Company) => void;
  campaigns?: { id: number; name: string }[];
}

const CAMPAIGN_TAG_PALETTE = [
  { bg: '#6366f1', color: '#fff' }, { bg: '#f59e0b', color: '#1a1000' },
  { bg: '#10b981', color: '#fff' }, { bg: '#ef4444', color: '#fff' },
  { bg: '#3b82f6', color: '#fff' }, { bg: '#ec4899', color: '#fff' },
  { bg: '#14b8a6', color: '#fff' }, { bg: '#f97316', color: '#fff' },
  { bg: '#8b5cf6', color: '#fff' }, { bg: '#06b6d4', color: '#fff' },
];
const CATEGORY_TAG_PALETTE = [
  { bg: '#0ea5e9', color: '#fff' }, { bg: '#d946ef', color: '#fff' },
  { bg: '#84cc16', color: '#1a2200' }, { bg: '#f43f5e', color: '#fff' },
  { bg: '#22d3ee', color: '#003344' }, { bg: '#a78bfa', color: '#fff' },
  { bg: '#fb923c', color: '#fff' }, { bg: '#34d399', color: '#003322' },
  { bg: '#e879f9', color: '#fff' }, { bg: '#38bdf8', color: '#001a2e' },
];
const getCampaignTagColor = (id: number) => CAMPAIGN_TAG_PALETTE[id % CAMPAIGN_TAG_PALETTE.length];
const getCategoryTagColor = (id: number) => CATEGORY_TAG_PALETTE[id % CATEGORY_TAG_PALETTE.length];

const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({ company, isOpen, theme, apiBase, onClose, onDownload, campaigns = [] }) => {
  const [detailCampaigns, setDetailCampaigns] = useState<{ id: number; name: string }[]>([]);
  const [detailCategories, setDetailCategories] = useState<{ id: number; name: string }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !company) return;
    setDetailCampaigns([]); setDetailCategories([]); setDetailLoading(true);
    // Campaigns: use campaign_ids on company mapped against passed campaigns list
    const memberCampaignIds = new Set<number>(company.campaign_ids ?? []);
    setDetailCampaigns(campaigns.filter(c => memberCampaignIds.has(c.id)));
    // Categories: use category_ids already on the company object
    (async () => {
      try {
        const catr = await apiFetch(`${apiBase}/category/`, {});
        if (catr.ok) {
          const cd = await catr.json();
          const allCats: { id: number; name: string }[] = cd.categories || cd || [];
          const memberIds = new Set<number>(company.category_ids ?? []);
          const memberOf = allCats.filter(cat => memberIds.has(cat.id));
          setDetailCategories(memberOf.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch { /* silent */ }
      finally { setDetailLoading(false); }
    })();
  }, [isOpen, company?.id]);

  if (!company) return null;
  return (
    <DetailOverlay $open={isOpen} onClick={onClose}>
      <DetailBox theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <DetailHead theme={theme}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>{company.name}</div>
              {company.optedOut && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  fontSize: '0.68rem', fontWeight: 600, color: '#ef4444',
                  background: '#ef444415', border: '1px solid #ef444430',
                  borderRadius: '999px', padding: '1px 7px 1px 5px', marginTop: '2px',
                }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                  Opted out
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <ModalCloseBtn theme={theme} title="Download CSV" onClick={() => onDownload(company)} style={{ opacity: 0.7 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </ModalCloseBtn>
            <ModalCloseBtn theme={theme} onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </ModalCloseBtn>
          </div>
        </DetailHead>
        <DetailBody>
          <DetailRow theme={theme}>
            <DetailLabel>Email</DetailLabel>
            <DetailValue theme={theme} $mono>{company.email}</DetailValue>
          </DetailRow>
          {company.phone_number && (
            <DetailRow theme={theme}>
              <DetailLabel>Phone</DetailLabel>
              <DetailValue theme={theme}>{company.phone_number}</DetailValue>
            </DetailRow>
          )}
          {company.address && (
            <DetailRow theme={theme}>
              <DetailLabel>Address</DetailLabel>
              <DetailValue theme={theme}>{company.address}</DetailValue>
            </DetailRow>
          )}
          {company.company_info && (
            <DetailRow theme={theme}>
              <DetailLabel>Company Info</DetailLabel>
              <DetailValue theme={theme} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{company.company_info}</DetailValue>
            </DetailRow>
          )}
          <DetailRow theme={theme}>
            <DetailLabel>Added</DetailLabel>
            <DetailValue theme={theme}>{new Date(company.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</DetailValue>
          </DetailRow>

          {/* Campaigns */}
          <DetailRow theme={theme} style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <DetailLabel>
              Campaigns {!detailLoading && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.7 }}>({detailCampaigns.length})</span>}
            </DetailLabel>
            {detailLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', opacity: 0.45 }}>
                <AdditionSpinner theme={theme} /> Loading…
              </div>
            ) : detailCampaigns.length === 0 ? (
              <DetailEmpty>Not enrolled in any campaigns</DetailEmpty>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {detailCampaigns.map((c) => {
                  const { bg, color } = getCampaignTagColor(c.id);
                  const label = c.name.length > 24 ? c.name.slice(0, 24) + '…' : c.name;
                  return (
                    <span key={c.id} title={c.name} style={{
                      display: 'inline-flex', alignItems: 'center',
                      fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px',
                      borderRadius: '999px', whiteSpace: 'nowrap', letterSpacing: '0.01em',
                      border: 'none', background: bg, color,
                    }}>{label}</span>
                  );
                })}
              </div>
            )}
          </DetailRow>

          {/* Categories */}
          <DetailRow theme={theme} style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <DetailLabel>
              Categories {!detailLoading && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.7 }}>({detailCategories.length})</span>}
            </DetailLabel>
            {detailLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', opacity: 0.45 }}>
                <AdditionSpinner theme={theme} /> Loading…
              </div>
            ) : detailCategories.length === 0 ? (
              <DetailEmpty>Not assigned to any categories</DetailEmpty>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {detailCategories.map((cat) => {
                  const { bg, color } = getCategoryTagColor(cat.id);
                  const label = cat.name.length > 24 ? cat.name.slice(0, 24) + '…' : cat.name;
                  return (
                    <span key={cat.id} title={cat.name} style={{
                      display: 'inline-flex', alignItems: 'center',
                      fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px',
                      borderRadius: '999px', whiteSpace: 'nowrap', letterSpacing: '0.01em',
                      border: 'none', background: bg, color,
                    }}>{label}</span>
                  );
                })}
              </div>
            )}
          </DetailRow>
        </DetailBody>
      </DetailBox>
    </DetailOverlay>
  );
};

// ─────────────────────────────────────────────────────────────
// COMPANY GEN BUTTON — portal-based dropdown to escape z-index/
// transform stacking context of CompanyCardItem
// ─────────────────────────────────────────────────────────────
const CompanyGenBtn: React.FC<{
  company: Company;
  theme: any;
  disabled: boolean;
  hasTemplateEmail: boolean;
  mode: 'plain' | 'html' | 'template';
  onModeChange: (mode: 'plain' | 'html' | 'template', company: Company) => void;
  onOpen: (company: Company) => void;
}> = ({ company, theme, disabled, hasTemplateEmail, mode, onModeChange, onOpen }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, openUpward: false });
  const chevronRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const rect = chevronRef.current?.getBoundingClientRect();
    if (rect) {
      const menuHeight = 88;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < menuHeight + 8;
      setMenuPos({
        top: openUpward ? rect.top : rect.bottom + 4,
        left: rect.right,
        openUpward,
      });
    }
    setOpen(v => !v);
  };

  return (
    <GenBtn
      theme={theme}
      $disabled={disabled}
      title={disabled ? (company.optedOut ? 'Company has opted out of emails' : 'Deselect all to use individual actions') : 'Generate / view email'}
    >
      <GenBtnLeft theme={theme} onClick={e => { e.stopPropagation(); if (!disabled) onOpen(company); }}>
        <GenBtnIcon><SparkleIcon /></GenBtnIcon>
        <GenBtnLabel>Plain Text</GenBtnLabel>
      </GenBtnLeft>
      <GenBtnDivider theme={theme} className="gen-divider" />
      <GenBtnChevron ref={chevronRef} theme={theme} $open={open} onClick={openMenu}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </GenBtnChevron>
      {open && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={e => { e.stopPropagation(); setOpen(false); }} />
          <div style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            transform: menuPos.openUpward ? 'translateX(-100%) translateY(-100%)' : 'translateX(-100%)',
            zIndex: 9999,
            background: theme.colors.base[200],
            border: `1px solid ${theme.colors.base[300]}`,
            borderRadius: theme.radius.field,
            boxShadow: theme.colorScheme === 'dark' ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.13)',
            minWidth: 130, overflow: 'hidden',
          }}>
            <GenDropItem theme={theme} $active={mode === 'html'}
              onClick={e => { e.stopPropagation(); setOpen(false); onModeChange('html', company); }}>
              <HtmlIcon />HTML Email
            </GenDropItem>
            <GenDropItem theme={theme} $active={mode === 'template'}
              onClick={e => { e.stopPropagation(); setOpen(false); if (hasTemplateEmail) onModeChange('template', company); }}
              style={!hasTemplateEmail ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
              title={!hasTemplateEmail ? 'No template set — configure in Campaign Settings' : undefined}>
              <TemplateIcon />Template
            </GenDropItem>
          </div>
        </>,
        document.body
      )}
    </GenBtn>
  );
};

// ─────────────────────────────────────────────────────────────
// DOWNLOAD HELPERS
// ─────────────────────────────────────────────────────────────
const companyToCSVRow = (c: Company) => [
  c.name, c.email, c.phone_number || '', c.address || '', c.company_info || '',
  c.optedOut ? 'Yes' : 'No', c.created_at,
].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');

const downloadCSV = (companies: Company[], filename: string) => {
  const header = 'Name,Email,Phone,Address,Company Info,Opted Out,Created At';
  const rows   = companies.map(companyToCSVRow).join('\n');
  const blob   = new Blob([`${header}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────
// BULK GEN BUTTON — split-button for bulk email action bar
// ─────────────────────────────────────────────────────────────
const BulkGenBtn: React.FC<{
  theme: any;
  disabled: boolean;
  hasTemplateEmail: boolean;
  onOpen: (queryType: 'plain' | 'html' | 'template') => void;
}> = ({ theme, disabled, hasTemplateEmail, onOpen }) => {
  const [open, setOpen] = useState(false);
  const chevronRef = useRef<HTMLSpanElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, openUpward: false });

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const rect = chevronRef.current?.getBoundingClientRect();
    if (rect) {
      const menuHeight = 88;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < menuHeight + 8;
      setMenuPos({
        top: openUpward ? rect.top : rect.bottom + 4,
        left: rect.right,
        openUpward,
      });
    }
    setOpen(v => !v);
  };

  return (
    <GenBtn theme={theme} $disabled={disabled} title={disabled ? 'All selected companies have opted out' : 'Email selected companies'}>
      <GenBtnLeft theme={theme} onClick={e => { e.stopPropagation(); if (!disabled) onOpen('plain'); }}>
        <GenBtnIcon><SparkleIcon /></GenBtnIcon>
        <GenBtnLabel>Plain Text</GenBtnLabel>
      </GenBtnLeft>
      <GenBtnDivider theme={theme} className="gen-divider" />
      <GenBtnChevron ref={chevronRef} theme={theme} $open={open} onClick={openMenu}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </GenBtnChevron>
      {open && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setOpen(false); }} />
          <div style={{
            position: 'fixed', top: menuPos.top, left: menuPos.left,
            transform: menuPos.openUpward ? 'translateX(-100%) translateY(-100%)' : 'translateX(-100%)',
            zIndex: 9999, background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`,
            borderRadius: theme.radius.field,
            boxShadow: theme.colorScheme === 'dark' ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.13)',
            minWidth: 130, overflow: 'hidden',
          }}>
            <GenDropItem theme={theme} onClick={e => { e.stopPropagation(); setOpen(false); onOpen('html'); }}>
              <HtmlIcon />HTML Email
            </GenDropItem>
            <GenDropItem theme={theme}
              onClick={e => { e.stopPropagation(); if (hasTemplateEmail) { setOpen(false); onOpen('template'); } }}
              style={!hasTemplateEmail ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
              title={!hasTemplateEmail ? 'No template set — configure in Campaign Settings' : undefined}>
              <TemplateIcon />Template
            </GenDropItem>
          </div>
        </>,
        document.body
      )}
    </GenBtn>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN CAMPAIGN COMPONENT
// ─────────────────────────────────────────────────────────────
interface CampaignProps {
  campaignId?: number;
  onBack?: () => void;
}

// Shared style for sort/filter toolbar icon labels
const toolbarLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  opacity: 0.45,
  flexShrink: 0,
};

const Campaign: React.FC<CampaignProps> = ({ campaignId: propId, onBack }) => {
  const { theme } = useTheme();
  const navigate  = useNavigate();
  const { campaignId: urlId } = useParams<{ campaignId: string }>();
  const campaignId = propId || (urlId ? parseInt(urlId, 10) : null);

  const [campaign, setCampaign]       = useState<CampaignDetails | null>(null);
  const [companies, setCompanies]     = useState<Company[]>([]);
  const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [refresh, setRefresh]         = useState(0);

  const [selectedCompanies, setSelectedCompanies] = useState<Set<number>>(new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  // Cache of full company objects for selected IDs (needed for cross-page bulk actions)
  const allSelectedCompanies = useRef<Map<number, Company>>(new Map());
  const [searchTerm, setSearchTerm]               = useState('');
  type SortKey = 'name' | 'created_at';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setCurrentPage(1);
  };

  // Category filter state
  const [pageCategories, setPageCategories]         = useState<Category[]>([]);
  const [selCatIds, setSelCatIds]                   = useState<Set<number>>(new Set());
  const [catPageFilterMode, setCatPageFilterMode]   = useState<'any' | 'all'>('any');
  const [catPageDropOpen, setCatPageDropOpen]       = useState(false);
  const [catPageDropSearch, setCatPageDropSearch]   = useState('');
  const catPageDropRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const s = localStorage.getItem('campaign_page_size');
    return s ? parseInt(s, 10) : 20;
  });
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalAllCompanies, setTotalAllCompanies] = useState(0);
  const totalPages = Math.ceil(totalCompanies / pageSize);

  const [showAddModal,      setShowAddModal]      = useState(false);
  const [companyAdditionActive, setCompanyAdditionActive] = useState<number | null>(null);
  const [additionCampaignId, setAdditionCampaignId] = useState<number | null>(null);
  const [cancellingSearch, setCancellingSearch] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [emailModal, setEmailModal] = useState<{ open: boolean; company: Company | null; initialHtmlEmail?: boolean; initialQueryType?: 'plain' | 'html' | 'template' }>({ open: false, company: null });
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkGenQueryType, setBulkGenQueryType] = useState<'plain'|'html'|'template'>('plain');
  const [hasTemplateEmail, setHasTemplateEmail]   = useState(false);

  // Company detail modal
  const [detailModal, setDetailModal] = useState<{ open: boolean; company: Company | null }>({ open: false, company: null });
  const openDetailModal  = (company: Company) => setDetailModal({ open: true, company });
  const closeDetailModal = () => setDetailModal(p => ({ ...p, open: false }));

  // Download handlers
  const handleDownloadOne = (company: Company) => {
    downloadCSV([company], `${company.name.replace(/[^a-z0-9]/gi, '_')}.csv`);
  };
  const handleBulkDownload = async () => {
    // If we already have all selected companies cached, use that
    if (selectedCompaniesList.length === selectedCompanies.size) {
      downloadCSV(selectedCompaniesList, `${campaign?.name || 'campaign'}_companies.csv`);
      return;
    }
    // Otherwise fetch all
    try {
      const s = searchTerm.trim() ? `&search=${encodeURIComponent(searchTerm.trim())}` : '';
      const ids = Array.from(selectedCompanies).join(',');
      const r = await apiFetch(`${API_BASE}/company/?page=1&size=${selectedCompanies.size}&ids=${ids}${s}&filter_campaigns=${campaignId}`);
      if (r.ok) { const d = await r.json(); downloadCSV(d.companies || [], `${campaign?.name || 'campaign'}_companies.csv`); }
    } catch { downloadCSV(selectedCompaniesList, `${campaign?.name || 'campaign'}_companies.csv`); }
  };

  const openEmailModal  = (company: Company, initialHtmlEmail = false, initialQueryType?: 'plain' | 'html' | 'template') => setEmailModal({ open: true, company, initialHtmlEmail, initialQueryType });
  const closeEmailModal = () => setEmailModal(p => ({ ...p, open: false }));

  const [genEmailModes, setGenEmailModes] = useState<Record<number, 'plain' | 'html' | 'template'>>({});

  const selectedCompaniesList = Array.from(selectedCompanies)
    .map(id => allSelectedCompanies.current.get(id))
    .filter((c): c is Company => !!c);

  const selectedNonOptedOut = selectedCompaniesList.filter(c => !c.optedOut);
  const allSelectedOptedOut = selectedCompaniesList.length > 0 && selectedNonOptedOut.length === 0;

  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const toastIdRef = useRef(0);

  const showToast = (type: ToastNotification['type'], title: string, message: string, duration = 5000) => {
    const id = ++toastIdRef.current;
    setToasts(p => [...p, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(p => p.map(t => t.id === id ? { ...t, isExiting: true } : t));
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 300);
    }, duration);
  };

  const dismissToast = (id: number) => {
    setToasts(p => p.map(t => t.id === id ? { ...t, isExiting: true } : t));
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 300);
  };

  const [confirm, setConfirm] = useState<ConfirmState>({
    isOpen: false, title: '', message: '', onConfirm: () => {},
  });
  const showConfirm = (title: string, message: string, onConfirm: () => void, opts?: { confirmText?: string; variant?: 'danger' | 'default' }) =>
    setConfirm({ isOpen: true, title, message, onConfirm, ...opts });
  const closeConfirm = () => setConfirm(p => ({ ...p, isOpen: false }));


  const startPollingAdditionStatus = () => {
    if (pollRef.current) return; // already polling
    pollRef.current = setInterval(async () => {
      try {
        const r = await apiFetch(`${API_BASE}/company/addition-status`);
        if (r.ok) {
          const d = await r.json();
          setCompanyAdditionActive(d.company_addition_active);
          setAdditionCampaignId(d.campaign_id ?? null);
          if (d.company_addition_active === 0) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setRefresh(p => p + 1);
          }
        }
      } catch { /* silent */ }
    }, 2000);
  };

  const handleCancelSearch = async () => {
    setCancellingSearch(true);
    try {
      const r = await apiFetch(`${API_BASE}/company/cancel-ai-search`, { method: 'POST' });
      if (r.ok) {
        setCompanyAdditionActive(0);
        setAdditionCampaignId(null);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setRefresh(p => p + 1);
        showToast('info', 'Cancelled', 'AI search has been cancelled');
      } else {
        showToast('error', 'Error', 'Failed to cancel search');
      }
    } catch {
      showToast('error', 'Error', 'Failed to cancel search');
    } finally {
      setCancellingSearch(false);
    }
  };

  useEffect(() => {
    (async () => {
      setPageLoading(true);
      try {
        const r = await apiFetch(`${API_BASE}/campaign/?ids=${campaignId}`, { });
        if (!r.ok) throw new Error('Failed to fetch campaign');
        const d = await r.json();
        if (d.campaigns?.length) setCampaign(d.campaigns[0]);
        else throw new Error('Campaign not found');
      } catch (err) {
        showToast('error', 'Error', err instanceof Error ? err.message : 'Failed to load campaign');
      } finally { setPageLoading(false); }
      // Fetch global companies count for nav badge
      try {
        const r = await apiFetch(`${API_BASE}/company/?page=1&size=1`, { });
        if (r.ok) { const d = await r.json(); setTotalAllCompanies(d.total || 0); }
      } catch { /* silent */ }
      // Also load campaign preferences to know if template_email is set
      try {
        const r = await apiFetch(`${API_BASE}/campaign/${campaignId}/campaign_preference/`, { });
        if (r.ok) { const d = await r.json(); setHasTemplateEmail(!!(d.template_email && d.template_email.trim())); }
      } catch { /* silent */ }
      // Load campaign stats
      try {
        const r = await apiFetch(`${API_BASE}/stats/?campaign_ids=${campaignId}`, { });
        if (r.ok) { const d = await r.json(); setCampaignStats(d.campaigns?.[0] ?? null); }
      } catch { /* silent */ }
      // Check if company addition is already in progress (e.g. after page reload)
      try {
        const r = await apiFetch(`${API_BASE}/company/addition-status`);
        if (r.ok) {
          const d = await r.json();
          setCompanyAdditionActive(d.company_addition_active);
          setAdditionCampaignId(d.campaign_id ?? null);
          if (d.company_addition_active !== 0) {
            startPollingAdditionStatus();
          } else {
            setCompanyAdditionActive(0);
          }
        }
      } catch { setCompanyAdditionActive(0); }
    })();
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    (async () => {
      try {
        const s = searchTerm.trim() ? `&search=${encodeURIComponent(searchTerm.trim())}` : '';
        const sortQ = sortKey ? `&sort_by=${sortKey}&sort_order=${sortDir}` : '';
        const catQ = selCatIds.size > 0 ? `&filter_categories=${Array.from(selCatIds).join(',')}&category_filter_mode=${catPageFilterMode}` : '';
        const r = await apiFetch(`${API_BASE}/company/?page=${currentPage}&size=${pageSize}&filter_campaigns=${campaignId}${s}${sortQ}${catQ}`, { });
        if (r.ok) {
          const d = await r.json();
          setTotalCompanies(d.total || 0);
          setCompanies(d.companies || []);
        }
      } catch { /* silent */ }
      // Refresh stats on every companies reload
      try {
        const r = await apiFetch(`${API_BASE}/stats/?campaign_ids=${campaignId}`, { });
        if (r.ok) { const d = await r.json(); setCampaignStats(d.campaigns?.[0] ?? null); }
      } catch { /* silent */ }
    })();
  }, [campaignId, refresh, currentPage, pageSize, searchTerm, sortKey, sortDir, selCatIds, catPageFilterMode]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortKey, sortDir, selCatIds, catPageFilterMode]);

  // Fetch categories for filter dropdown
  useEffect(() => {
    if (!campaignId) return;
    (async () => {
      try {
        const r = await apiFetch(`${API_BASE}/category/`, {});
        if (!r.ok) return;
        const d = await r.json();
        setPageCategories(d.categories || d || []);
      } catch { /* silent */ }
    })();
  }, [campaignId]);

  // Click-outside for category dropdown
  useEffect(() => {
    if (!catPageDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (catPageDropRef.current && !catPageDropRef.current.contains(e.target as Node))
        setCatPageDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catPageDropOpen]);

  // Keep the company-object cache up to date as pages load
  useEffect(() => {
    companies.forEach(c => { if (selectedCompanies.has(c.id)) allSelectedCompanies.current.set(c.id, c); });
  }, [companies, selectedCompanies]);

  const handleBack = () => { if (onBack) onBack(); else navigate('/campaigns'); };

  const handleSelectAll = async () => {
    // If everything is already selected (across all pages), deselect all
    if (selectedCompanies.size === totalCompanies && totalCompanies > 0) {
      setSelectedCompanies(new Set());
      allSelectedCompanies.current.clear();
      return;
    }
    // Fetch all company IDs across all pages (respects current search filter)
    setSelectingAll(true);
    try {
      const s = searchTerm.trim() ? `&search=${encodeURIComponent(searchTerm.trim())}` : '';
      const r = await apiFetch(`${API_BASE}/company/?page=1&size=${totalCompanies || 1000}&filter_campaigns=${campaignId}${s}`);
      if (r.ok) {
        const d = await r.json();
        const all: Company[] = d.companies || [];
        all.forEach(c => allSelectedCompanies.current.set(c.id, c));
        setSelectedCompanies(new Set(all.map(c => c.id)));
      }
    } catch { /* silent — fall back to current page */ setSelectedCompanies(new Set(companies.map(c => c.id))); }
    finally { setSelectingAll(false); }
  };

  const handleSelectCompany = (id: number) =>
    setSelectedCompanies(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleUnenroll = (company: Company, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm(
      'Unenroll Company',
      `Remove "${company.name}" from this campaign? The company will remain in your company pool.`,
      async () => {
        try {
          const r = await apiFetch(`${API_BASE}/campaign/bulk-unenroll/`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company_ids: [company.id], campaign_ids: [campaignId] }),
          });
          if (!r.ok) throw new Error('Failed to unenroll company');
          showToast('success', 'Unenrolled', `"${company.name}" removed from campaign`);
          setSelectedCompanies(p => { const n = new Set(p); n.delete(company.id); return n; });
          allSelectedCompanies.current.delete(company.id);
          setRefresh(p => p + 1);
        } catch (err) { showToast('error', 'Error', err instanceof Error ? err.message : 'Failed to unenroll'); }
      },
      { confirmText: 'Unenroll', variant: 'danger' }
    );
  };

  const handleBulkUnenroll = () => {
    if (selectedCompanies.size === 0) return;
    showConfirm(
      'Unenroll Companies',
      `Remove ${selectedCompanies.size} compan${selectedCompanies.size > 1 ? 'ies' : 'y'} from this campaign? They will remain in your company pool.`,
      async () => {
        try {
          const ids = Array.from(selectedCompanies);
          const r = await apiFetch(`${API_BASE}/campaign/bulk-unenroll/`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company_ids: ids, campaign_ids: [campaignId] }),
          });
          if (!r.ok) throw new Error('Failed to unenroll companies');
          showToast('success', 'Unenrolled', `${selectedCompanies.size} companies removed from campaign`);
          setSelectedCompanies(new Set());
          allSelectedCompanies.current.clear();
          setRefresh(p => p + 1);
        } catch (err) { showToast('error', 'Error', err instanceof Error ? err.message : 'Failed to unenroll'); }
      },
      { confirmText: 'Unenroll All', variant: 'danger' }
    );
  };

  const renderPageButtons = () => {
    const pages: React.ReactNode[] = [];
    const max = 5;
    let start = Math.max(1, currentPage - Math.floor(max / 2));
    let end   = Math.min(totalPages, start + max - 1);
    if (end - start + 1 < max) start = Math.max(1, end - max + 1);

    if (start > 1) {
      pages.push(<PageBtn key={1} theme={theme} onClick={() => setCurrentPage(1)}>1</PageBtn>);
      if (start > 2) pages.push(<PageInfo key="e1" theme={theme}>…</PageInfo>);
    }
    for (let i = start; i <= end; i++) {
      pages.push(<PageBtn key={i} theme={theme} $active={currentPage === i} onClick={() => setCurrentPage(i)}>{i}</PageBtn>);
    }
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push(<PageInfo key="e2" theme={theme}>…</PageInfo>);
      pages.push(<PageBtn key={totalPages} theme={theme} onClick={() => setCurrentPage(totalPages)}>{totalPages}</PageBtn>);
    }
    return pages;
  };

  if (pageLoading && !campaign) {
    return (
      <PageWrapper theme={theme}>
        <PageContent>
          <EmptyState>
            <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }}>⏳</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600, opacity: 0.7 }}>Loading campaign…</div>
          </EmptyState>
        </PageContent>
      </PageWrapper>
    );
  }

  if (!campaign) {
    return (
      <PageWrapper theme={theme}>
        <PageContent>
          <div style={{ padding: '1rem 1.25rem', background: theme.colors.error.main + '15', border: `1px solid ${theme.colors.error.main}40`, borderRadius: theme.radius.box, color: theme.colors.error.main }}>
            ⚠️ Campaign not found
          </div>
          <button onClick={handleBack} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', borderRadius: theme.radius.field, border: 'none', background: theme.colors.primary.main, color: theme.colors.primary.content, cursor: 'pointer', fontWeight: 500 }}>
            Back to Campaigns
          </button>
        </PageContent>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper theme={theme} onClick={() => { if (selectedCompanies.size > 0) { setSelectedCompanies(new Set()); allSelectedCompanies.current.clear(); } }}>

      {/* Toasts */}
      <ToastWrapper $visible={toasts.length > 0}>
        {toasts.map(t => (
          <ToastItem key={t.id} theme={theme} $type={t.type} $exiting={t.isExiting}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: t.type === 'success' ? theme.colors.success.main + '20' : t.type === 'error' ? theme.colors.error.main + '20' : t.type === 'warning' ? (theme.colors.warning?.main || '#f59e0b') + '20' : theme.colors.primary.main + '20',
              color: t.type === 'success' ? theme.colors.success.main : t.type === 'error' ? theme.colors.error.main : t.type === 'warning' ? (theme.colors.warning?.main || '#f59e0b') : theme.colors.primary.main,
              fontSize: 14, fontWeight: 600,
            }}>
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '!' : 'i'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: t.type === 'success' ? theme.colors.success.main : t.type === 'error' ? theme.colors.error.main : t.type === 'warning' ? (theme.colors.warning?.main || '#f59e0b') : theme.colors.primary.main, marginBottom: '0.25rem' }}>{t.title}</div>
              <div style={{ fontSize: '0.8125rem', opacity: 0.9 }}>{t.message}</div>
            </div>
            <button onClick={() => dismissToast(t.id)} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', opacity: 0.5, color: theme.colors.base.content }}
              onMouseOver={e => (e.currentTarget.style.opacity = '1')} onMouseOut={e => (e.currentTarget.style.opacity = '0.5')}>
              <XIcon />
            </button>
          </ToastItem>
        ))}
      </ToastWrapper>

      {/* Confirm dialog */}
      <Overlay $open={confirm.isOpen} onClick={closeConfirm}>
        <Dialog theme={theme} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, minWidth: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: confirm.variant === 'danger' ? theme.colors.error.main + '15' : theme.colors.primary.main + '15', color: confirm.variant === 'danger' ? theme.colors.error.main : theme.colors.primary.main }}>
              <AlertIcon />
            </div>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: 600 }}>{confirm.title}</h3>
              <p style={{ margin: 0, fontSize: '0.9375rem', opacity: 0.85, lineHeight: 1.5 }}>{confirm.message}</p>
            </div>
          </div>
          <DialogActions>
            <CancelBtn theme={theme} onClick={closeConfirm}>Cancel</CancelBtn>
            <ConfirmBtn theme={theme} $danger={confirm.variant === 'danger'} onClick={() => { confirm.onConfirm(); closeConfirm(); }}>
              {confirm.confirmText || 'Confirm'}
            </ConfirmBtn>
          </DialogActions>
        </Dialog>
      </Overlay>

      <PageContent>

        {/* Stats card — Hero Banner */}
        <StatsCard theme={theme}>

          {/* Top row: back (left) · campaign name (centre) · settings (right) */}
          <StatsHeader>
            <HeaderIconBtn theme={theme} as={Link} to="/campaigns" title="Back to campaigns">
              <ArrowLeftIcon />
            </HeaderIconBtn>

            <CampaignTitleSection style={{ textAlign: 'center' }}>
              <CampaignTitle>{campaign.name}</CampaignTitle>
              <CampaignMeta>Created {formatDate(campaign.created_at)}</CampaignMeta>
            </CampaignTitleSection>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <NavIconButton theme={theme} as={Link} to="/companies" title="Companies">
                <svg width="16" height="16" viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="1" width="30" height="38" rx="2"/>
                  <rect x="5" y="6" width="7" height="7" rx="0.5"/>
                  <rect x="20" y="6" width="7" height="7" rx="0.5"/>
                  <rect x="5" y="17" width="7" height="7" rx="0.5"/>
                  <rect x="20" y="17" width="7" height="7" rx="0.5"/>
                  <rect x="11" y="29" width="10" height="10" rx="1"/>
                </svg>
                <NavIconCount>{totalAllCompanies}</NavIconCount>
              </NavIconButton>
              <HeaderIconBtn theme={theme} onClick={() => setShowSettingsModal(true)} title="Campaign preferences">
                <GearIcon />
              </HeaderIconBtn>
            </div>
          </StatsHeader>

          {/* Stats strip */}
          <StatsGrid theme={theme}>
            <StatBox theme={theme}>
              <StatValue>{totalCompanies}</StatValue>
              <StatLabel>Companies</StatLabel>
            </StatBox>
            <StatBox theme={theme}>
              <StatValue $color={theme.colors.success?.main}>{campaignStats?.emails.sent ?? 0}</StatValue>
              <StatLabel>Sent</StatLabel>
            </StatBox>
            <StatBox theme={theme}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                <StatValue $color={theme.colors.info?.main || theme.colors.primary.main}>{campaignStats?.emails.read ?? 0}</StatValue>
                <StatSub $color={theme.colors.info?.main || theme.colors.primary.main}>{campaignStats?.read_rate ?? 0}%</StatSub>
              </div>
              <StatLabel>Read</StatLabel>
            </StatBox>
            <StatBox theme={theme}>
              <StatValue $color={theme.colors.error?.main}>{campaignStats?.emails.failed ?? 0}</StatValue>
              <StatLabel>Failed</StatLabel>
            </StatBox>
            <StatBox theme={theme}>
              <StatValue $color={theme.colors.warning?.main}>{campaignStats?.emails.draft ?? 0}</StatValue>
              <StatLabel>Drafts</StatLabel>
            </StatBox>
            <StatBox theme={theme}>
              <StatValue $color={theme.colors.primary.main}>{campaignStats?.emails.scheduled ?? 0}</StatValue>
              <StatLabel>Scheduled</StatLabel>
            </StatBox>
          </StatsGrid>

        </StatsCard>

        {/* Companies section */}
        <SectionCard theme={theme} onClick={e => e.stopPropagation()}>
          <SectionHeader theme={theme}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {companies.length > 0 && (
                selectingAll
                  ? <SelectAllSpinner theme={theme} />
                  : <Checkbox
                      theme={theme}
                      $checked={selectedCompanies.size === totalCompanies && totalCompanies > 0}
                      onClick={handleSelectAll}
                      title={selectedCompanies.size === totalCompanies && totalCompanies > 0 ? 'Deselect all' : `Select all ${totalCompanies} companies`}
                      style={{ flexShrink: 0 }}
                    />
              )}
              <SectionTitle>
                <BuildingIcon />
                Companies
                {selectedCompanies.size > 0 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: theme.colors.primary.main, background: `${theme.colors.primary.main}18`, border: `1px solid ${theme.colors.primary.main}40`, borderRadius: '999px', padding: '1px 8px', marginLeft: '2px' }}>
                    {selectedCompanies.size} selected
                  </span>
                )}
              </SectionTitle>
            </div>
            {companyAdditionActive === null ? null
              : companyAdditionActive !== 0
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, fontSize: '0.8rem', fontWeight: 500, color: theme.colors.primary.main }}>
                    <AdditionSpinner theme={theme} />
                    {companyAdditionActive > 0 && additionCampaignId === Number(campaignId)
                      ? `Finding companies… ${companyAdditionActive} remaining`
                      : 'Company finder is busy'
                    }
                    {companyAdditionActive > 0 && additionCampaignId === Number(campaignId) && (
                      <button
                        onClick={handleCancelSearch}
                        disabled={cancellingSearch}
                        style={{
                          marginLeft: '0.25rem',
                          padding: '0.2rem 0.6rem',
                          fontSize: '0.72rem', fontWeight: 600,
                          borderRadius: '999px', cursor: cancellingSearch ? 'not-allowed' : 'pointer',
                          border: `1px solid ${theme.colors.error.main}60`,
                          background: `${theme.colors.error.main}12`,
                          color: theme.colors.error.main,
                          opacity: cancellingSearch ? 0.5 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        {cancellingSearch ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </span>
                : <AddBtn theme={theme} onClick={() => setShowAddModal(true)} title="Add Companies">+</AddBtn>
            }
          </SectionHeader>

          <SearchWrapper>
            <SearchIconWrap theme={theme}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </SearchIconWrap>
            <SearchInput theme={theme} type="text" placeholder="Search companies…" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} />
            {searchTerm && (
              <SearchClearBtn theme={theme} onClick={() => setSearchTerm('')} title="Clear search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </SearchClearBtn>
            )}
          </SearchWrapper>

          {/* Sort bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' as const, marginBottom: '0.75rem' }}>
            <span style={toolbarLabelStyle}><SortIcon /></span>
            {([
              { key: 'name' as const,       label: 'Alphabetical' },
              { key: 'created_at' as const, label: 'Date Added'   },
            ]).map(({ key, label }) => {
              const active = sortKey === key;
              return (
                <button key={key} onClick={() => handleSort(key)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.3rem 0.7rem', borderRadius: '999px',
                  fontSize: '0.8125rem', fontWeight: active ? 600 : 500, cursor: 'pointer',
                  border: `1px solid ${active ? theme.colors.primary.main : theme.colors.base[300]}`,
                  background: active ? theme.colors.primary.main : theme.colors.base[400],
                  color: active ? theme.colors.primary.content : theme.colors.base.content,
                  transition: 'all 0.15s',
                }}>
                  {label}
                  {active && <span style={{ fontSize: '0.7rem', opacity: 0.9 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              );
            })}
            {sortKey && (
              <button onClick={() => { setSortKey(null); setSortDir('asc'); setCurrentPage(1); }} style={{
                padding: '0.3rem 0.6rem', borderRadius: '999px',
                fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                border: `1px solid ${theme.colors.base[300]}`,
                background: theme.colors.base[400], color: theme.colors.base.content, opacity: 0.55,
                transition: 'all 0.15s',
              }}>✕ Clear</button>
            )}
          </div>

          {/* Filter bar */}
          {pageCategories.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' as const, marginBottom: '0.75rem' }}>
              <span style={toolbarLabelStyle}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              </span>
              <EnrollDropWrap ref={catPageDropRef}>
                <EnrollDropTrigger theme={theme} $active={selCatIds.size > 0}
                  onClick={() => { setCatPageDropOpen(p => !p); setCatPageDropSearch(''); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                  Categories
                  {selCatIds.size > 0 && <EnrollDropBadge theme={theme}>{selCatIds.size}</EnrollDropBadge>}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </EnrollDropTrigger>
                {catPageDropOpen && (
                  <EnrollDropMenu theme={theme}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
                      <EnrollDropSearch theme={theme} placeholder="Search categories…" value={catPageDropSearch} autoFocus
                        onChange={e => setCatPageDropSearch(e.target.value)}
                        onClick={e => e.stopPropagation()} />
                      {selCatIds.size > 0 && (
                        <button onClick={e => { e.stopPropagation(); setSelCatIds(new Set()); setCatPageFilterMode('any'); setCatPageDropOpen(false); }}
                          style={{ flexShrink: 0, padding: '0 0.45rem', height: '28px', border: 'none', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: theme.colors.error.main, whiteSpace: 'nowrap' }}>
                          Clear
                        </button>
                      )}
                    </div>
                    {pageCategories.filter(c => c.name.toLowerCase().includes(catPageDropSearch.toLowerCase())).length === 0 ? (
                      <div style={{ padding: '0.5rem', fontSize: '0.8rem', opacity: 0.45, textAlign: 'center' }}>No categories found</div>
                    ) : pageCategories.filter(c => c.name.toLowerCase().includes(catPageDropSearch.toLowerCase())).map(cat => (
                      <EnrollDropItem key={cat.id} theme={theme} $checked={selCatIds.has(cat.id)}
                        onClick={() => setSelCatIds(prev => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; })}>
                        <div style={{
                          width: 14, height: 14, minWidth: 14, borderRadius: 3, flexShrink: 0,
                          border: `1.5px solid ${selCatIds.has(cat.id) ? theme.colors.primary.main : theme.colors.base[300]}`,
                          background: selCatIds.has(cat.id) ? theme.colors.primary.main : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                        }}>
                          {selCatIds.has(cat.id) && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" width="8" height="8"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        {cat.name}
                      </EnrollDropItem>
                    ))}
                  </EnrollDropMenu>
                )}
              </EnrollDropWrap>
              {/* Any / All toggle */}
              {selCatIds.size >= 2 && (
                <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${theme.colors.base[300]}`, borderRadius: '999px', overflow: 'hidden', flexShrink: 0 }}>
                  {(['any', 'all'] as const).map(mode => (
                    <button key={mode} onClick={() => setCatPageFilterMode(mode)} style={{
                      padding: '0.2rem 0.6rem', fontSize: '0.7rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      cursor: 'pointer', border: 'none',
                      background: catPageFilterMode === mode ? theme.colors.primary.main : 'transparent',
                      color: catPageFilterMode === mode ? theme.colors.primary.content : theme.colors.base.content,
                      opacity: catPageFilterMode === mode ? 1 : 0.45,
                      transition: 'all 0.15s',
                    }}>{mode}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          <BulkBar theme={theme} $visible={selectedCompanies.size > 0}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', fontWeight: 500 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '20px', height: '20px', padding: '0 5px',
                borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                background: theme.colors.primary.main,
                color: theme.colors.primary.content,
              }}>{selectedCompanies.size}</span>
              of {totalCompanies} selected
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <BulkGenBtn
                theme={theme}
                disabled={allSelectedOptedOut}
                hasTemplateEmail={hasTemplateEmail}
                onOpen={(queryType) => {
                  setBulkGenQueryType(queryType);
                  setBulkEmailOpen(true);
                }}
              />
              <IconBtn theme={theme} title="Download Selected as CSV" onClick={handleBulkDownload}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </IconBtn>
              <IconBtn theme={theme} $variant="danger" onClick={handleBulkUnenroll} title="Unenroll Selected">
                <UserMinusIcon />
              </IconBtn>
            </div>
          </BulkBar>

          {companies.length === 0 ? (
            <EmptyState>
              <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '1rem' }}><BuildingIcon /></div>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, opacity: 0.7, marginBottom: '0.5rem' }}>No companies found</div>
              <div style={{ opacity: 0.5, fontSize: '0.875rem' }}>
                {searchTerm ? 'Try adjusting your search' : 'Add companies to get started'}
              </div>
            </EmptyState>
          ) : (
            companies.map(company => (
              <CompanyCardItem
                key={company.id}
                theme={theme}
                $selected={selectedCompanies.has(company.id)}
                onClick={() => handleSelectCompany(company.id)}
              >
                <CompanyCardHeader>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Checkbox
                      theme={theme}
                      $checked={selectedCompanies.has(company.id)}
                      onClick={e => { e.stopPropagation(); handleSelectCompany(company.id); }}
                    />
                    <CompanyCardInfo>
                      <CompanyCardName>{company.name}</CompanyCardName>
                      <CompanyCardEmail>{company.email}</CompanyCardEmail>{company.optedOut && (
                        <OptedOutBadge>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                          </svg>
                          Opted out
                        </OptedOutBadge>
                      )}
                      {(company.phone_number || company.address) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.2rem' }}>
                          {company.phone_number && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', opacity: 0.65 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.08 6.08l1.08-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                              </svg>
                              {company.phone_number}
                            </span>
                          )}
                          {company.address && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', opacity: 0.65 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                              </svg>
                              {company.address}
                            </span>
                          )}
                        </div>
                      )}
                    </CompanyCardInfo>
                  </div>
                  <ActionBtns onClick={e => e.stopPropagation()}>
                    <IconBtn theme={theme}
                      disabled={selectedCompanies.size > 0}
                      onClick={e => { e.stopPropagation(); openDetailModal(company); }}
                      title={selectedCompanies.size > 0 ? 'Deselect all to use individual actions' : 'View company details'}
                      style={selectedCompanies.size > 0 ? { opacity: 0.3, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </IconBtn>
                    <IconBtn theme={theme}
                      disabled={selectedCompanies.size > 0}
                      onClick={e => { e.stopPropagation(); handleDownloadOne(company); }}
                      title={selectedCompanies.size > 0 ? 'Deselect all to use individual actions' : 'Download as CSV'}
                      style={selectedCompanies.size > 0 ? { opacity: 0.3, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </IconBtn>
                    <CompanyGenBtn
                      company={company}
                      theme={theme}
                      disabled={selectedCompanies.size > 0 || !!company.optedOut}
                      hasTemplateEmail={hasTemplateEmail}
                      mode={genEmailModes[company.id] ?? 'plain'}
                      onModeChange={(mode, co) => {
                        setGenEmailModes(m => ({ ...m, [co.id]: mode }));
                        openEmailModal(co, mode === 'html', mode === 'template' ? 'template' : undefined);
                      }}
                      onOpen={(co) => {
                        openEmailModal(co, false, 'plain');
                      }}
                    />
                    <IconBtn theme={theme} $variant="danger"
                      disabled={selectedCompanies.size > 0}
                      onClick={e => handleUnenroll(company, e)}
                      title={selectedCompanies.size > 0 ? 'Deselect all to use individual actions' : 'Unenroll from campaign'}
                      style={selectedCompanies.size > 0 ? { opacity: 0.3, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}>
                      <UserMinusIcon />
                    </IconBtn>
                  </ActionBtns>
                </CompanyCardHeader>
              </CompanyCardItem>
            ))
          )}

          {totalCompanies > 0 && (
            <Pagination theme={theme}>
              <PageBtn theme={theme} onClick={() => setCurrentPage(1)} disabled={currentPage === 1} title="First">««</PageBtn>
              <PageBtn theme={theme} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} title="Previous">«</PageBtn>
              {renderPageButtons()}
              <PageBtn theme={theme} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} title="Next">»</PageBtn>
              <PageBtn theme={theme} onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} title="Last">»»</PageBtn>
              <PageInfo theme={theme}>
                {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalCompanies)} of {totalCompanies}
              </PageInfo>
              <PageSizeSelect theme={theme} value={pageSize} onChange={e => { const v = Number(e.target.value); setPageSize(v); localStorage.setItem('campaign_page_size', String(v)); setCurrentPage(1); }}>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={200}>200 / page</option>
              </PageSizeSelect>
            </Pagination>
          )}
        </SectionCard>
      </PageContent>

      <AddCompaniesModal
        isOpen={showAddModal}
        campaignId={campaignId!}
        theme={theme}
        apiBase={API_BASE}
        onClose={() => setShowAddModal(false)}
        onSuccess={(active: number) => { setCompanyAdditionActive(active); if (active !== 0) startPollingAdditionStatus(); else setRefresh(p => p + 1); }}
        onToast={showToast}
      />

      <CampaignSettingsModal
        isOpen={showSettingsModal}
        campaignId={campaignId!}
        theme={theme}
        apiBase={API_BASE}
        onClose={() => setShowSettingsModal(false)}
        onToast={showToast}
        onSaved={async () => {
          try {
            const r = await apiFetch(`${API_BASE}/campaign/${campaignId}/campaign_preference/`, { });
            if (r.ok) { const d = await r.json(); setHasTemplateEmail(!!(d.template_email && d.template_email.trim())); }
          } catch { /* silent */ }
        }}
      />

      <EmailModal
        isOpen={emailModal.open}
        company={emailModal.company}
        campaignId={campaignId!}
        theme={theme}
        apiBase={API_BASE}
        onClose={closeEmailModal}
        onToast={showToast}
        hasTemplateEmail={hasTemplateEmail}
        initialHtmlEmail={emailModal.initialHtmlEmail ?? false}
        initialQueryType={emailModal.initialQueryType}
      />

      <BulkEmailModal
        isOpen={bulkEmailOpen}
        companies={selectedNonOptedOut}
        campaignId={campaignId!}
        theme={theme}
        apiBase={API_BASE}
        onClose={() => setBulkEmailOpen(false)}
        onToast={showToast}
        hasTemplateEmail={hasTemplateEmail}
        initialQueryType={bulkGenQueryType}
      />

      <CompanyDetailModal
        isOpen={detailModal.open}
        company={detailModal.company}
        theme={theme}
        apiBase={API_BASE}
        onClose={closeDetailModal}
        onDownload={handleDownloadOne}
        campaigns={campaign ? [{ id: campaign.id, name: campaign.name }] : []}
      />

    </PageWrapper>
  );
};

export default Campaign;