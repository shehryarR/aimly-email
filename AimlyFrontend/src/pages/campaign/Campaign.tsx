/**
 * Campaign.tsx - Single-file campaign page
 * Features:
 *   - Campaign stats card with ⚙️ settings gear icon (top-right)
 *   - Campaign Settings modal: left sidebar tabs + accordions per tab
 *     Tabs: Brand Identity · Campaign Strategy · Email Content · Branding · Attachments · Scheduling
 *   - Attachments tab: same upload zone + attached/not-attached lists as Settings.tsx
 *   - Two inheritance checkboxes: inherit_global_settings & inherit_global_attachments
 *   - Auto-schedule checkbox that opens scheduling accordion when checked
 *   - Companies list: clicking ANYWHERE on a row selects it
 *   - Unenroll uses UserMinus icon instead of trash
 *   - Add Companies modal (4 tabs: enroll existing / manual / CSV / AI search)
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../theme/styles';
import styled, { keyframes } from 'styled-components';
import BulkEmailModal from './BulkEmailModal';
import { apiFetch } from '../../App';

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
}

interface CampaignDetails {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

interface CampaignPreferences {
  bcc: string;
  business_name: string;
  business_info: string;
  goal: string;
  value_prop: string;
  tone: string;
  cta: string;
  extras: string;
  email_instruction: string;
  signature: string;
  logo_data?: string;
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
const contentFade  = keyframes`from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}`;

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
`;
const NavIconButton = styled.button<{ theme: any }>`
  position: relative;
  height: 32px;
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
  svg { width: 15px; height: 15px; flex-shrink: 0; }
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
// CAMPAIGN SETTINGS MODAL — NEW DESIGN: left sidebar + tabs
// ─────────────────────────────────────────────────────────────

// Shell — same proportions as Settings.tsx
const CsBackdrop = styled.div<{ $open: boolean }>`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
  z-index: 9998;
  opacity: ${p => p.$open ? 1 : 0};
  visibility: ${p => p.$open ? 'visible' : 'hidden'};
  transition: opacity 0.25s ease, visibility 0.25s ease;
`;
const CsModalWrap = styled.div<{ $open: boolean }>`
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; padding: 1.5rem;
  pointer-events: ${p => p.$open ? 'all' : 'none'};
`;
const CsModal = styled.div<{ theme: any; $open: boolean }>`
  width: 100%; max-width: 860px;
  height: min(700px, calc(100vh - 3rem));
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: 16px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.4);
  display: flex; flex-direction: column; overflow: hidden;
  opacity: ${p => p.$open ? 1 : 0};
  transform: ${p => p.$open ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(16px)'};
  transition: opacity 0.25s ease, transform 0.25s ease;
`;
const CsHead = styled.div<{ theme: any }>`
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  flex-shrink: 0;
`;
const CsTitle = styled.h2`
  margin: 0; font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em;
  display: flex; align-items: center; gap: 0.6rem;
  svg { width: 20px; height: 20px; opacity: 0.8; }
`;
const CsCloseBtn = styled.button<{ theme: any }>`
  width: 32px; height: 32px; padding: 0;
  border-radius: 8px;
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  cursor: pointer; font-size: 1.1rem;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
  &:hover { background: ${p => p.theme.colors.base[300]}; border-color: ${p => p.theme.colors.primary.main}; color: ${p => p.theme.colors.primary.main}; }
`;

// Left sidebar nav — mirrors Settings.tsx TabNav
const CsNavBody = styled.div`
  display: flex; flex: 1; min-height: 0;
`;
const CsNav = styled.nav<{ theme: any }>`
  width: 190px; flex-shrink: 0;
  background: ${p => p.theme.colors.base[200]};
  border-right: 1px solid ${p => p.theme.colors.base[300]};
  padding: 0.75rem 0.5rem;
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto;
`;
const CsNavGroupLabel = styled.div<{ theme: any }>`
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.4;
  padding: 0.25rem 0.75rem 0.4rem;
`;
const CsNavBtn = styled.button<{ theme: any; $active: boolean }>`
  width: 100%; padding: 0.6rem 0.75rem;
  border: none; border-radius: 8px; cursor: pointer;
  display: flex; align-items: center; gap: 0.6rem;
  font-size: 0.875rem; font-weight: ${p => p.$active ? 600 : 500};
  text-align: left; transition: all 0.15s;
  background: ${p => p.$active ? p.theme.colors.primary.main + '18' : 'transparent'};
  color: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base.content};
  &:hover { background: ${p => p.$active ? p.theme.colors.primary.main + '22' : p.theme.colors.base[300]}; }
  svg { width: 16px; height: 16px; flex-shrink: 0; opacity: ${p => p.$active ? 1 : 0.6}; }
`;
const CsNavLabel = styled.span`flex: 1;`;

// Tab content panel
const CsTabPanel = styled.div<{ theme: any }>`
  flex: 1; overflow-y: auto;
  padding: 1.75rem 2rem;
  color: ${p => p.theme.colors.base.content};
  animation: ${contentFade} 0.2s ease;
`;
const CsPanelTitle = styled.h3<{ theme: any }>`
  margin: 0 0 0.25rem 0;
  font-size: 1.05rem; font-weight: 700;
  color: ${p => p.theme.colors.base.content};
  letter-spacing: -0.02em;
`;
const CsPanelSubtitle = styled.p<{ theme: any }>`
  margin: 0 0 1.5rem 0;
  font-size: 0.85rem;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.55; line-height: 1.5;
`;



// Settings form fields
const SFG = styled.div`margin-bottom: 1.1rem;`;
const SLabel = styled.label<{ theme: any }>`
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.8rem; font-weight: 600;
  color: ${p => p.theme.colors.base.content};
  margin-bottom: 0.4rem; opacity: 0.85;
`;
const SInput = styled.input<{ theme: any }>`
  width: 100%; padding: 0.65rem 0.9rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.9rem; box-sizing: border-box; transition: border-color 0.15s;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; background: ${p => p.theme.colors.base[100]}; box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}20; }
  &::placeholder { opacity: 0.45; }
`;
const STextarea = styled.textarea<{ theme: any }>`
  width: 100%; padding: 0.65rem 0.9rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem; font-family: inherit;
  resize: vertical; min-height: 68px; box-sizing: border-box; transition: border-color 0.15s;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; background: ${p => p.theme.colors.base[100]}; box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}20; }
  &::placeholder { opacity: 0.45; }
`;
const SSelect = styled.select<{ theme: any }>`
  width: 100%; padding: 0.65rem 0.9rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.9rem; transition: border-color 0.15s;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }
`;
const SFormRow = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;`;
const SMsg = styled.div<{ theme: any; $type: 'success' | 'error' | 'warning' }>`
  padding: 0.5rem 0.75rem;
  border-radius: ${p => p.theme.radius.field};
  font-size: 0.825rem; font-weight: 500; margin-top: 0.5rem;
  word-break: break-word; overflow-wrap: break-word;
  ${p => p.$type === 'success'
    ? `color:${p.theme.colors.success.main};background:${p.theme.colors.base[200]};border:1px solid ${p.theme.colors.success.main};`
    : p.$type === 'warning'
    ? `color:${p.theme.colors.warning?.main||'#F59E0B'};background:${p.theme.colors.base[200]};border:1px solid ${p.theme.colors.warning?.main||'#F59E0B'};`
    : `color:${p.theme.colors.error.main};background:${p.theme.colors.base[200]};border:1px solid ${p.theme.colors.error.main};`}
`;
const SSaveRow = styled.div`display: flex; justify-content: flex-end; margin-top: 1.5rem;`;
const SBtn = styled.button<{ theme: any }>`
  padding: 0.65rem 1.4rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer;
  background: ${p => p.theme.colors.primary.main};
  color: ${p => p.theme.colors.primary.content};
  transition: all 0.15s;
  &:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 14px ${p => p.theme.colors.primary.main}44; }
  &:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
`;

// Inheritance / toggle rows
const InheritRow = styled.div<{ theme: any }>`
  display: flex; align-items: flex-start; gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  cursor: pointer; transition: all 0.2s; margin-bottom: 0.5rem;
  &:hover { border-color: ${p => p.theme.colors.primary.main}; background: ${p => p.theme.colors.primary.main + '08'}; }
`;
const InheritCheckbox = styled.div<{ theme: any; $on: boolean }>`
  width: 20px; height: 20px; min-width: 20px; border-radius: 4px; margin-top: 1px;
  border: 2px solid ${p => p.$on ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background: ${p => p.$on ? p.theme.colors.primary.main : 'transparent'};
  display: flex; align-items: center; justify-content: center; transition: all 0.2s;
  svg { width: 11px; height: 11px; color: white; display: ${p => p.$on ? 'block' : 'none'}; }
`;
const InheritText = styled.div`flex: 1;`;
const InheritTitle = styled.div`font-size: 0.875rem; font-weight: 600;`;
const InheritDesc  = styled.div`font-size: 0.775rem; opacity: 0.55; margin-top: 0.15rem; line-height: 1.4;`;


// Logo upload
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
  pointer-events: none; opacity: 0.4; font-size: 0.75rem;
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

// Attachment picker styles (mirrors settings.tsx exactly)
const AttachPickerSearch = styled.input<{ theme: any }>`
  width: 100%; padding: 0.5rem 0.75rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.8125rem; box-sizing: border-box;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }
  &::placeholder { opacity: 0.5; }
`;
const AttachList = styled.div<{ theme: any }>`
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
`;
const AttachItem = styled.div<{ theme: any; $checked: boolean }>`
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  cursor: pointer; font-size: 0.8125rem; transition: background 0.1s;
  background: ${p => p.$checked ? p.theme.colors.primary.main + '10' : 'transparent'};
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  &:last-child { border-bottom: none; }
  &:hover { background: ${p => p.$checked ? p.theme.colors.primary.main + '18' : p.theme.colors.base[300]}; }
`;
const AttachCheckbox = styled.div<{ theme: any; $checked: boolean }>`
  width: 16px; height: 16px; flex-shrink: 0; border-radius: 4px;
  border: 1.5px solid ${p => p.$checked ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background: ${p => p.$checked ? p.theme.colors.primary.main : 'transparent'};
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
  svg { width: 10px; height: 10px; color: ${p => p.theme.colors.primary.content}; }
`;
const AttachExtBadge = styled.span<{ $ext: string }>`
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 34px; height: 20px; padding: 0 5px;
  border-radius: 4px; font-size: 0.65rem; font-weight: 700;
  text-transform: uppercase; flex-shrink: 0;
  background: ${p => ({ pdf: '#ef444420', doc: '#3b82f620', docx: '#3b82f620', csv: '#22c55e20', txt: '#64748b20' }[p.$ext] || '#64748b20')};
  color: ${p => ({ pdf: '#ef4444', doc: '#3b82f6', docx: '#3b82f6', csv: '#22c55e', txt: '#64748b' }[p.$ext] || '#64748b')};
`;
const AttachName = styled.span`
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;
`;
const AttachEmpty = styled.div<{ theme: any }>`
  padding: 1.25rem; text-align: center; font-size: 0.8125rem; opacity: 0.5;
`;

const VALID_TONES = ['Professional', 'Professional but friendly', 'Enthusiastic', 'Concise', 'Formal', 'Casual'];
const ALLOWED_ATTACH_EXTS = ['.pdf', '.doc', '.docx', '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
const getExt = (filename: string) => filename.split('.').pop()?.toLowerCase() || '';

// ─────────────────────────────────────────────────────────────
// SVG ICONS
// ─────────────────────────────────────────────────────────────
const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const BuildingIcon = () => (
  <svg width="32" height="40" viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="30" height="38" rx="2"/>
    <rect x="5" y="6" width="7" height="7" rx="0.5"/>
    <rect x="20" y="6" width="7" height="7" rx="0.5"/>
    <rect x="5" y="17" width="7" height="7" rx="0.5"/>
    <rect x="20" y="17" width="7" height="7" rx="0.5"/>
    <rect x="11" y="29" width="10" height="10" rx="1"/>
  </svg>
);
const UserMinusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const EnrollIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);
const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>
  </svg>
);
const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const SparkleIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 4L20.5 13.5H30L22.5 19.5L25 29L18 23L11 29L13.5 19.5L6 13.5H15.5Z"/>
    <line x1="30" y1="6" x2="30" y2="10"/>
    <line x1="28" y1="8" x2="32" y2="8"/>
    <line x1="6" y1="26" x2="6" y2="29"/>
    <line x1="4.5" y1="27.5" x2="7.5" y2="27.5"/>
  </svg>
);
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const MagnifyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const SortIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="14" y2="12"/><line x1="3" y1="18" x2="8" y2="18"/>
  </svg>
);
const toolbarLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.3rem',
  fontSize: '0.75rem', fontWeight: 600, opacity: 0.45,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginRight: '0.25rem', flexShrink: 0,
};
const CheckSmallIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const PaperclipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);
const InheritIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
    <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────
// CAMPAIGN SETTINGS MODAL COMPONENT
// ─────────────────────────────────────────────────────────────
type CsTab = 'inherit' | 'brand' | 'strategy' | 'email' | 'branding' | 'attachments' | 'template';

// ─────────────────────────────────────────────────────────────
// TEMPLATE GENERATE DROPDOWN — mirrors company list GenBtn
// ─────────────────────────────────────────────────────────────
const TemplateGenDropdown: React.FC<{
  theme: any;
  generating: boolean;
  onGenerate: (htmlEmail: boolean) => void;
}> = ({ theme, generating, onGenerate }) => {
  const [open, setOpen] = useState(false);
  return (
    <GenBtn theme={theme} $disabled={generating}>
      <GenBtnLeft theme={theme} onClick={() => !generating && onGenerate(false)}>
        <GenBtnIcon>
          {generating
            ? <ESpinner style={{ width: 13, height: 13, borderWidth: 2 }} />
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          }
        </GenBtnIcon>
        <GenBtnLabel>
          {generating ? 'Generating…' : 'Plain Text'}
        </GenBtnLabel>
      </GenBtnLeft>
      <GenBtnDivider theme={theme} className="gen-divider" />
      <GenBtnChevron theme={theme} $open={open}
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </GenBtnChevron>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 2999 }}
            onClick={e => { e.stopPropagation(); setOpen(false); }} />
          <GenDropMenu theme={theme}>
            <GenDropItem theme={theme}
              onClick={e => { e.stopPropagation(); onGenerate(true); setOpen(false); }}>
              <HtmlIcon />HTML Email
            </GenDropItem>
          </GenDropMenu>
        </>
      )}
    </GenBtn>
  );
};

interface CampaignSettingsModalProps {
  isOpen: boolean;
  campaignId: number;
  theme: any;
  apiBase: string;
  onClose: () => void;
  onSaved: () => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, msg: string) => void;
}

const defaultPrefs = (): CampaignPreferences => ({
  bcc: '', business_name: '', business_info: '', goal: '',
  value_prop: '', tone: '', cta: '', extras: '', email_instruction: '',
  signature: '', inherit_global_settings: 1, inherit_global_attachments: 1,
});

const CampaignSettingsModal: React.FC<CampaignSettingsModalProps> = ({
  isOpen, campaignId, theme, apiBase, onClose, onSaved, onToast,
}) => {
  const [activeTab, setActiveTab] = useState<CsTab>('inherit');
  const [prefs, setPrefs]         = useState<CampaignPreferences>(defaultPrefs());
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [preferenceId, setPreferenceId]   = useState<number | null>(null);

  // ── Dirty-check snapshot ────────────────────────────────────
  const savedPrefs    = useRef<CampaignPreferences>(defaultPrefs());
  const savedTemplate = useRef({ subject: '', body: '' });
  const savedLinkedIds = useRef<Set<number>>(new Set());
  const [confirmClose, setConfirmClose] = useState(false);

  // ── Per-tab dirty tracking ────────────────────────────────
  const [dirtyTabs, setDirtyTabs] = useState<Partial<Record<CsTab, boolean>>>({});
  const markDirty  = (tab: CsTab) => setDirtyTabs(p => ({ ...p, [tab]: true }));
  const clearDirty = (tab: CsTab) => setDirtyTabs(p => ({ ...p, [tab]: false }));

  // ── Inherit snapshot (for dirty-check only) ─────────────
  const savedInherit = useRef({ settings: 1, attachments: 1 });

  // ── Pending logo (deferred until Save, like Settings.tsx) ─
  const [pendingLogo,        setPendingLogo]        = useState<File | 'remove' | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);

  // ── Template Email state ────────────────────────────────────
  const [templateSubject,    setTemplateSubject]    = useState('');
  const [templateBody,       setTemplateBody]       = useState('');
  const [templateHtmlEmail,  setTemplateHtmlEmail]  = useState(false);
  const [templateGenerating, setTemplateGenerating] = useState(false);
  const [templateSaving,     setTemplateSaving]     = useState(false);

  // ── Global settings state (for showing inherited content) ───
  const [globalLogoData,       setGlobalLogoData]       = useState<string | null>(null);
  const [globalSignature,      setGlobalSignature]      = useState('');
  const [globalAttachments,    setGlobalAttachments]    = useState<AttachmentOption[]>([]);
  const [globalBusinessName,   setGlobalBusinessName]   = useState('');
  const [globalBusinessInfo,   setGlobalBusinessInfo]   = useState('');
  const [globalGoal,           setGlobalGoal]           = useState('');
  const [globalTone,           setGlobalTone]           = useState('');
  const [globalValueProp,      setGlobalValueProp]      = useState('');
  const [globalEmailInstr,     setGlobalEmailInstr]     = useState('');
  const [globalCta,            setGlobalCta]            = useState('');
  const [globalExtras,         setGlobalExtras]         = useState('');
  const [globalBcc,            setGlobalBcc]            = useState('');

  // ── Attachment state (all hoisted — no hooks in callbacks) ──
  const [allAttachments,      setAllAttachments]      = useState<AttachmentOption[]>([]);
  const [linkedAttachmentIds, setLinkedAttachmentIds] = useState<Set<number>>(new Set());
  const [attachSearch,        setAttachSearch]        = useState('');
  const [attachSaving,        setAttachSaving]        = useState(false);
  const [attachLoading,       setAttachLoading]       = useState(false);
  const [uploadFile,          setUploadFile]          = useState<File | null>(null);
  const [uploading,           setUploading]           = useState(false);
  const [isDragOver,          setIsDragOver]          = useState(false);
  const uploadFileInputRef                             = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('inherit');
      setUploadFile(null);
      setIsDragOver(false);
      setAttachSearch('');
      setDirtyTabs({});
      setPendingLogo(null);
      setPendingLogoPreview(null);
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
      loadPrefs();
    }
  }, [isOpen]);

  const loadPrefs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${apiBase}/campaign/${campaignId}/campaign_preference/`);
      if (res.ok) {
        const d = await res.json();
        setPreferenceId(d.id ?? null);
        setPrefs({
          bcc: d.bcc ?? '', business_name: d.business_name ?? '',
          business_info: d.business_info ?? '', goal: d.goal ?? '',
          value_prop: d.value_prop ?? '', tone: d.tone ?? '',
          cta: d.cta ?? '', extras: d.extras ?? '',
          email_instruction: d.email_instruction ?? '', signature: d.signature ?? '',
          logo_data: d.logo_data ?? undefined,
          inherit_global_settings: d.inherit_global_settings ?? 1,
          inherit_global_attachments: d.inherit_global_attachments ?? 1,
        });
        const tmpl = d.template_email || '';
        if (tmpl) {
          const lines = tmpl.split('\n');
          const subjectLine = lines[0].startsWith('SUBJECT:') ? lines[0].replace('SUBJECT:', '').trim() : '';
          const body = subjectLine ? lines.slice(1).join('\n').trimStart() : tmpl;
          setTemplateSubject(subjectLine);
          setTemplateBody(body);
        } else {
          setTemplateSubject('');
          setTemplateBody('');
        }
        setTemplateHtmlEmail(!!(d.template_html_email));
        // snapshot for dirty detection
        const loadedSubj = tmpl ? (tmpl.split('\n')[0].startsWith('SUBJECT:') ? tmpl.split('\n')[0].replace('SUBJECT:', '').trim() : '') : '';
        const loadedBody = loadedSubj ? tmpl.split('\n').slice(1).join('\n').trimStart() : tmpl;
        savedTemplate.current = { subject: loadedSubj, body: loadedBody };
        savedPrefs.current = {
          bcc: d.bcc ?? '', business_name: d.business_name ?? '',
          business_info: d.business_info ?? '', goal: d.goal ?? '',
          value_prop: d.value_prop ?? '', tone: d.tone ?? '',
          cta: d.cta ?? '', extras: d.extras ?? '',
          email_instruction: d.email_instruction ?? '', signature: d.signature ?? '',
          logo_data: d.logo_data ?? undefined,
          inherit_global_settings: d.inherit_global_settings ?? 1,
          inherit_global_attachments: d.inherit_global_attachments ?? 1,
        };
        savedInherit.current = {
          settings: d.inherit_global_settings ?? 1,
          attachments: d.inherit_global_attachments ?? 1,
        };
        await loadAttachments(d.id ?? undefined);
        await loadGlobalSettings();
      } else if (res.status === 404) {
        setPrefs(defaultPrefs());
        savedPrefs.current = defaultPrefs();
        savedTemplate.current = { subject: '', body: '' };
        await loadAttachments();
        await loadGlobalSettings();
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // ── Global settings loader (for inherited content preview) ──
  const loadGlobalSettings = async () => {
    try {
      const settingsRes = await apiFetch(`${apiBase}/global_setting/`);
      if (!settingsRes.ok) return;
      const d = await settingsRes.json();
      setGlobalLogoData(d.logo_data || null);
      setGlobalSignature(d.signature || '');
      setGlobalBusinessName(d.business_name || '');
      setGlobalBusinessInfo(d.business_info || '');
      setGlobalGoal(d.goal || '');
      setGlobalTone(d.tone || '');
      setGlobalValueProp(d.value_prop || '');
      setGlobalEmailInstr(d.email_instruction || '');
      setGlobalCta(d.cta || '');
      setGlobalExtras(d.extras || '');
      setGlobalBcc(d.bcc || '');

      // Fetch global attachments using the settings id
      const attRes = await apiFetch(`${apiBase}/global-settings/${d.id}/attachments/`);
      if (attRes.ok) {
        const attData = await attRes.json();
        // Map name → filename to match AttachmentOption shape
        setGlobalAttachments((attData.attachments ?? []).map((a: any) => ({
          id: a.id, filename: a.name, file_size: a.file_size ?? null,
        })));
      }
    } catch { /* silent */ }
  };

  const loadAttachments = async (prefId?: number) => {
    const resolvedPrefId = prefId ?? preferenceId;
    setAttachLoading(true);
    try {
      // All user attachments
      const attRes = await apiFetch(`${apiBase}/attachments/?page=1&page_size=200`);
      if (attRes.ok) {
        const d = await attRes.json();
        setAllAttachments(d.attachments ?? []);
      }
      // Campaign-linked attachments
      if (resolvedPrefId) {
        const linkRes = await apiFetch(`${apiBase}/campaign-preference/${resolvedPrefId}/attachments/`);
        if (linkRes.ok) {
          const d = await linkRes.json();
          const ids = new Set<number>((d.attachments ?? []).map((a: any) => a.id as number));
          setLinkedAttachmentIds(ids);
          savedLinkedIds.current = new Set(ids);
        }
      }
    } catch (e) { console.error('Failed to load attachments', e); }
    finally { setAttachLoading(false); }
  };

  const saveAttachments = async () => {
    if (!preferenceId) { onToast('error', 'Attachments', 'Save campaign preferences first before managing attachments'); return; }
    setAttachSaving(true);
    try {
      const res = await apiFetch(`${apiBase}/campaign-preference/${preferenceId}/attachments/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.from(linkedAttachmentIds)),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed to save'); }
      savedLinkedIds.current = new Set(linkedAttachmentIds);
      clearDirty('attachments');
      onToast('success', 'Attachments', 'Attachments saved to campaign');
    } catch (err) {
      onToast('error', 'Attachments', err instanceof Error ? err.message : 'Failed to save attachments');
    } finally { setAttachSaving(false); }
  };

  const toggleAttachment = (id: number) => {
    setLinkedAttachmentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      // Dirty if different from last-saved set
      const saved = savedLinkedIds.current;
      const isDiff = saved.size !== next.size || [...next].some(i => !saved.has(i));
      setDirtyTabs(p => ({ ...p, attachments: isDiff }));
      return next;
    });
  };

  // ── File upload ─────────────────────────────────────────────
  const handleAttachFilePick = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_ATTACH_EXTS.includes(ext)) {
      onToast('error', 'Attachments', `Invalid file type. Allowed: ${ALLOWED_ATTACH_EXTS.join(', ')}`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onToast('error', 'Attachments', 'File size must be less than 5MB');
      return;
    }
    setUploadFile(file);
  };

  const handleAttachUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const uploadRes = await apiFetch(`${apiBase}/attachment/`, {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) { const e = await uploadRes.json(); throw new Error(e.detail || 'Upload failed'); }
      const uploadData = await uploadRes.json();
      const newId: number = uploadData.id;

      // Add to the full list and mark as linked locally (not saved to backend yet).
      // The user must click "Save Attachments" to persist the link.
      setAllAttachments(prev => {
        if (prev.some(a => a.id === newId)) return prev;
        return [...prev, { id: newId, filename: uploadData.filename, file_size: uploadData.file_size ?? 0 }];
      });
      setLinkedAttachmentIds(prev => {
        const next = new Set(prev);
        next.add(newId);
        setDirtyTabs(p => ({ ...p, attachments: true }));
        return next;
      });

      setUploadFile(null);
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
      onToast('info', 'Uploaded', `"${uploadData.filename}" uploaded — click Save Attachments to link it`);
    } catch (err) {
      onToast('error', 'Upload Failed', err instanceof Error ? err.message : 'Upload failed');
    } finally { setUploading(false); }
  };

  // ── Save preferences ────────────────────────────────────────
  const save = async (triggerTab: CsTab = 'brand') => {
    setSaving(true);
    try {
      const fd = new FormData();
      // Always send ALL text fields so backend clears them to NULL when empty
      const textFields: (keyof CampaignPreferences)[] = [
        'bcc', 'business_name', 'business_info', 'goal', 'value_prop',
        'tone', 'cta', 'extras', 'email_instruction', 'signature',
      ];
      textFields.forEach(k => fd.append(k as string, (prefs[k] as string | undefined) ?? ''));

      // Pending logo: deferred upload/remove
      if (pendingLogo === 'remove') {
        fd.append('logo', new File([], ''));
      } else if (pendingLogo instanceof File) {
        fd.append('logo', pendingLogo);
      }

      fd.append('inherit_global_settings',    String(prefs.inherit_global_settings));
      fd.append('inherit_global_attachments', String(prefs.inherit_global_attachments));

      const res = await apiFetch(`${apiBase}/campaign/${campaignId}/campaign_preference/`, {
        method: 'PUT', body: fd,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed to save'); }

      // Update snapshots
      savedPrefs.current = { ...prefs };
      savedInherit.current = {
        settings:    prefs.inherit_global_settings,
        attachments: prefs.inherit_global_attachments,
      };
      clearDirty(triggerTab);
      if (triggerTab !== 'inherit') clearDirty('inherit');

      // Reload if logo changed to get fresh logo_data from server
      if (pendingLogo) {
        setPendingLogo(null);
        setPendingLogoPreview(null);
        await loadPrefs();
      }

      onToast('success', 'Saved', 'Campaign preferences saved');
      onSaved();
    } catch (err) {
      onToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  const set = (k: keyof CampaignPreferences, v: string | number, tab?: CsTab) => {
    setPrefs(p => ({ ...p, [k]: v }));
    if (tab) markDirty(tab);
    // Changing inherit flags makes the inherit tab dirty AND invalidates the saved state
    if (k === 'inherit_global_settings' || k === 'inherit_global_attachments') {
      markDirty('inherit');
      }
  };


  // ── Template Email handlers ─────────────────────────────────
  const generateTemplate = async (htmlEmail: boolean) => {
    setTemplateGenerating(true);
    try {
      const res = await apiFetch(
        `${apiBase}/campaign/${campaignId}/campaign_preference/generate-template/?html_email=${htmlEmail}`,
        { method: 'POST' },
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Generation failed'); }
      const d = await res.json();
      const newSubject = d.subject || '';
      const newBody = d.content || '';
      setTemplateSubject(newSubject);
      setTemplateBody(newBody);
      // Mark dirty if the regenerated content differs from the last saved state
      if (newSubject !== savedTemplate.current.subject || newBody !== savedTemplate.current.body) {
        markDirty('template');
      }
      onToast('success', 'Template', 'Template generated');
    } catch (err) {
      onToast('error', 'Template', err instanceof Error ? err.message : 'Failed to generate');
    } finally { setTemplateGenerating(false); }
  };

  const saveTemplate = async () => {
    setTemplateSaving(true);
    try {
      const fd = new FormData();
      fd.append('template_email', `SUBJECT: ${templateSubject}\n\n${templateBody}`);
      fd.append('template_html_email', templateHtmlEmail ? '1' : '0');
      const res = await apiFetch(`${apiBase}/campaign/${campaignId}/campaign_preference/`, {
        method: 'PUT', body: fd,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed to save'); }
      savedTemplate.current = { subject: templateSubject, body: templateBody };
      clearDirty('template');
      onToast('success', 'Template', 'Template saved');
      onSaved();
    } catch (err) {
      onToast('error', 'Template', err instanceof Error ? err.message : 'Failed to save');
    } finally { setTemplateSaving(false); }
  };

  // ── Logo handlers — deferred until Save (like Settings.tsx) ────
  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) { onToast('error', 'Logo', 'Please select a valid image file'); return; }
    if (file.size > 5 * 1024 * 1024) { onToast('error', 'Logo', 'File size must be less than 5 MB'); return; }
    setPendingLogo(file);
    const reader = new FileReader();
    reader.onload = e => setPendingLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    markDirty('branding');
  };

  const handleLogoRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingLogo('remove');
    setPendingLogoPreview(null);
    markDirty('branding');
  };

  // ── Derived attachment lists ────────────────────────────────
  const filteredAttachments = allAttachments.filter(a =>
    a.filename.toLowerCase().includes(attachSearch.toLowerCase())
  );
  const attachedFiles    = filteredAttachments.filter(a =>  linkedAttachmentIds.has(a.id));
  const notAttachedFiles = filteredAttachments.filter(a => !linkedAttachmentIds.has(a.id));

  // ── Tab definitions ─────────────────────────────────────────
  const csTabs: { id: CsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'inherit',     label: 'Inheritance',    icon: <InheritIcon /> },
    { id: 'brand',       label: 'Brand Identity', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> },
    { id: 'strategy',    label: 'Strategy',       icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
    { id: 'email',       label: 'Email Content',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
    { id: 'template',    label: 'Template Email', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
    { id: 'branding',    label: 'Branding',       icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
    { id: 'attachments', label: 'Attachments',    icon: <PaperclipIcon /> },
  ];



  const isCsDirty = Object.values(dirtyTabs).some(Boolean) || pendingLogo !== null;

  // Use SAVED inherit values to drive inherited-vs-editable view in tabs.
  // This prevents tabs from flipping to editable fields just because the user
  // toggled the checkbox — the view only changes after Save is clicked.
  const viewInheritSettings     = !!savedInherit.current.settings;
  const viewInheritAttachments  = !!savedInherit.current.attachments;
  const handleCsClose = () => {
    if (isCsDirty) { setConfirmClose(true); return; }
    onClose();
  };

  return (
    <>
      <CsBackdrop $open={isOpen} onClick={handleCsClose} />
      <CsModalWrap $open={isOpen} onClick={handleCsClose}>
        <CsModal theme={theme} $open={isOpen} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <CsHead theme={theme}>
            <CsTitle><GearIcon />Campaign Preferences</CsTitle>
            <CsCloseBtn theme={theme} onClick={handleCsClose}>✕</CsCloseBtn>
          </CsHead>

          {/* Body: sidebar + content */}
          <CsNavBody>

            {/* Left sidebar */}
            <CsNav theme={theme}>
              <CsNavGroupLabel theme={theme}>Settings</CsNavGroupLabel>
              {csTabs.map(t => {
                const isDirty = dirtyTabs[t.id] || (t.id === 'branding' && pendingLogo !== null);
                return (
                  <CsNavBtn
                    key={t.id}
                    theme={theme}
                    $active={activeTab === t.id}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.icon}
                    <CsNavLabel>{t.label}</CsNavLabel>
                    {isDirty && (
                      <span style={{
                        fontSize: '0.85rem', fontWeight: 700, lineHeight: 1, flexShrink: 0,
                        color: activeTab === t.id ? theme.colors.primary.main : '#F59E0B',
                      }}>*</span>
                    )}
                  </CsNavBtn>
                );
              })}
            </CsNav>

            {/* ── INHERIT tab ──────────────────────────────── */}
            {activeTab === 'inherit' && (
              <CsTabPanel theme={theme} key="inherit">
                <CsPanelTitle theme={theme}>Inheritance</CsPanelTitle>
                <CsPanelSubtitle theme={theme}>
                  Control whether this campaign falls back to your global settings and attachments.
                </CsPanelSubtitle>

                <InheritRow theme={theme} onClick={() => set('inherit_global_settings', prefs.inherit_global_settings ? 0 : 1, 'inherit')}>
                  <InheritCheckbox theme={theme} $on={!!prefs.inherit_global_settings}>
                    <CheckSmallIcon />
                  </InheritCheckbox>
                  <InheritText>
                    <InheritTitle>Inherit Global Settings</InheritTitle>
                    <InheritDesc>Use your global settings as defaults for any field not explicitly set on this campaign.</InheritDesc>
                  </InheritText>
                </InheritRow>

                <InheritRow theme={theme} onClick={() => set('inherit_global_attachments', prefs.inherit_global_attachments ? 0 : 1, 'inherit')}>
                  <InheritCheckbox theme={theme} $on={!!prefs.inherit_global_attachments}>
                    <CheckSmallIcon />
                  </InheritCheckbox>
                  <InheritText>
                    <InheritTitle>Inherit Global Attachments</InheritTitle>
                    <InheritDesc>Include files linked in your global settings for emails sent in this campaign.</InheritDesc>
                  </InheritText>
                </InheritRow>

                <SSaveRow>
                  <SBtn theme={theme} onClick={() => save('inherit')} disabled={saving || loading}>
                    {saving ? 'Saving…' : 'Save'}
                  </SBtn>
                </SSaveRow>
              </CsTabPanel>
            )}

            {/* ── BRAND IDENTITY tab ───────────────────────── */}
            {activeTab === 'brand' && (
              <CsTabPanel theme={theme} key="brand">
                <CsPanelTitle theme={theme}>Brand Identity</CsPanelTitle>
                <CsPanelSubtitle theme={theme}>
                  Override your business name and description for this campaign.
                </CsPanelSubtitle>

                {viewInheritSettings ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.5rem 0.75rem', background: theme.colors.primary.main + '12', border: `1px solid ${theme.colors.primary.main}30`, borderRadius: theme.radius.field }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span style={{ fontSize: '0.75rem', color: theme.colors.primary.main, fontWeight: 600 }}>Inherited from global settings — disable inheritance to edit</span>
                    </div>
                    <SFG>
                      <SLabel theme={theme}>Business Name</SLabel>
                      <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, minHeight: '2.5rem' }}>
                        {globalBusinessName || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set in global settings</span>}
                      </div>
                    </SFG>
                    <SFG style={{ marginBottom: 0 }}>
                      <SLabel theme={theme}>Business Info</SLabel>
                      <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, whiteSpace: 'pre-wrap', lineHeight: 1.5, minHeight: '4rem' }}>
                        {globalBusinessInfo || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set in global settings</span>}
                      </div>
                    </SFG>
                  </>
                ) : (
                  <>
                    <SFG>
                      <SLabel theme={theme}>Business Name</SLabel>
                      <SInput theme={theme} placeholder="Acme Corp" value={prefs.business_name}
                        onChange={e => set('business_name', e.target.value, 'brand')} />
                    </SFG>
                    <SFG style={{ marginBottom: 0 }}>
                      <SLabel theme={theme}>Business Info</SLabel>
                      <STextarea theme={theme} rows={3} placeholder="Brief description of your business…"
                        value={prefs.business_info} onChange={e => set('business_info', e.target.value, 'brand')} />
                    </SFG>
                    <SSaveRow>
                      <SBtn theme={theme} onClick={() => save('brand')} disabled={saving || loading}>
                        {saving ? 'Saving…' : 'Save'}
                      </SBtn>
                    </SSaveRow>
                  </>
                )}
              </CsTabPanel>
            )}

            {/* ── STRATEGY tab ─────────────────────────────── */}
            {activeTab === 'strategy' && (
              <CsTabPanel theme={theme} key="strategy">
                <CsPanelTitle theme={theme}>Campaign Strategy</CsPanelTitle>
                <CsPanelSubtitle theme={theme}>
                  Define the goal, tone, and value proposition specific to this campaign.
                </CsPanelSubtitle>

                {viewInheritSettings ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.5rem 0.75rem', background: theme.colors.primary.main + '12', border: `1px solid ${theme.colors.primary.main}30`, borderRadius: theme.radius.field }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span style={{ fontSize: '0.75rem', color: theme.colors.primary.main, fontWeight: 600 }}>Inherited from global settings — disable inheritance to edit</span>
                    </div>
                    <SFormRow>
                      <SFG>
                        <SLabel theme={theme}>Goal</SLabel>
                        <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, minHeight: '2.5rem' }}>
                          {globalGoal || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set</span>}
                        </div>
                      </SFG>
                      <SFG>
                        <SLabel theme={theme}>Tone</SLabel>
                        <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, minHeight: '2.5rem' }}>
                          {globalTone || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set</span>}
                        </div>
                      </SFG>
                    </SFormRow>
                    <SFG style={{ marginBottom: 0 }}>
                      <SLabel theme={theme}>Value Proposition</SLabel>
                      <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, minHeight: '2.5rem' }}>
                        {globalValueProp || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set</span>}
                      </div>
                    </SFG>
                  </>
                ) : (
                  <>
                    <SFormRow>
                      <SFG>
                        <SLabel theme={theme}>Goal</SLabel>
                        <SInput theme={theme} placeholder="Book a 15-min call" value={prefs.goal}
                          onChange={e => set('goal', e.target.value, 'strategy')} />
                      </SFG>
                      <SFG>
                        <SLabel theme={theme}>Tone</SLabel>
                        <SSelect theme={theme} value={prefs.tone} onChange={e => set('tone', e.target.value, 'strategy')}>
                          <option value="">— Select —</option>
                          {VALID_TONES.map(t => <option key={t} value={t}>{t}</option>)}
                        </SSelect>
                      </SFG>
                    </SFormRow>
                    <SFG style={{ marginBottom: 0 }}>
                      <SLabel theme={theme}>Value Proposition</SLabel>
                      <SInput theme={theme} placeholder="We reduce churn by 30% in 90 days"
                        value={prefs.value_prop} onChange={e => set('value_prop', e.target.value, 'strategy')} />
                    </SFG>
                    <SSaveRow>
                      <SBtn theme={theme} onClick={() => save('strategy')} disabled={saving || loading}>
                        {saving ? 'Saving…' : 'Save'}
                      </SBtn>
                    </SSaveRow>
                  </>
                )}
              </CsTabPanel>
            )}

            {/* ── EMAIL CONTENT tab ────────────────────────── */}
            {activeTab === 'email' && (
              <CsTabPanel theme={theme} key="email">
                <CsPanelTitle theme={theme}>Email Content</CsPanelTitle>
                <CsPanelSubtitle theme={theme}>
                  Writing instructions, CTA, and extras specific to this campaign's emails.
                </CsPanelSubtitle>

                {viewInheritSettings ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.5rem 0.75rem', background: theme.colors.primary.main + '12', border: `1px solid ${theme.colors.primary.main}30`, borderRadius: theme.radius.field }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span style={{ fontSize: '0.75rem', color: theme.colors.primary.main, fontWeight: 600 }}>Inherited from global settings — disable inheritance to edit</span>
                    </div>
                    <SFG>
                      <SLabel theme={theme}>Writing Instructions</SLabel>
                      <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, whiteSpace: 'pre-wrap', lineHeight: 1.5, minHeight: '4rem' }}>
                        {globalEmailInstr || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set</span>}
                      </div>
                    </SFG>
                    <SFG>
                      <SLabel theme={theme}>Call to Action</SLabel>
                      <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, minHeight: '2.5rem' }}>
                        {globalCta || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set</span>}
                      </div>
                    </SFG>
                    <SFG>
                      <SLabel theme={theme}>Extra Instructions</SLabel>
                      <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, whiteSpace: 'pre-wrap', lineHeight: 1.5, minHeight: '3rem' }}>
                        {globalExtras || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set</span>}
                      </div>
                    </SFG>
                    <SFG style={{ marginBottom: 0 }}>
                      <SLabel theme={theme}>BCC Address</SLabel>
                      <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, minHeight: '2.5rem' }}>
                        {globalBcc || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set</span>}
                      </div>
                    </SFG>
                  </>
                ) : (
                  <>
                    <SFG>
                      <SLabel theme={theme}>Writing Instructions</SLabel>
                      <STextarea theme={theme} rows={3}
                        placeholder="Start with a genuine compliment… never use 'I hope this finds you well'…"
                        value={prefs.email_instruction} onChange={e => set('email_instruction', e.target.value, 'email')} />
                    </SFG>
                    <SFG>
                      <SLabel theme={theme}>Call to Action</SLabel>
                      <SInput theme={theme} placeholder="Would you be open to a quick call this week?"
                        value={prefs.cta} onChange={e => set('cta', e.target.value, 'email')} />
                    </SFG>
                    <SFG>
                      <SLabel theme={theme}>Extra Instructions</SLabel>
                      <STextarea theme={theme} rows={2} placeholder="Never mention competitors. Keep emails under 150 words."
                        value={prefs.extras} onChange={e => set('extras', e.target.value, 'email')} />
                    </SFG>
                    <SFG style={{ marginBottom: 0 }}>
                      <SLabel theme={theme}>BCC Address</SLabel>
                      <SInput theme={theme} type="email" placeholder="hubspot@bcc.hubspot.com"
                        value={prefs.bcc} onChange={e => set('bcc', e.target.value, 'email')} />
                    </SFG>
                    <SSaveRow>
                      <SBtn theme={theme} onClick={() => save('email')} disabled={saving || loading}>
                        {saving ? 'Saving…' : 'Save'}
                      </SBtn>
                    </SSaveRow>
                  </>
                )}
              </CsTabPanel>
            )}

            {/* ── TEMPLATE EMAIL tab ───────────────────────────── */}
            {activeTab === 'template' && (
              <CsTabPanel theme={theme} key="template">
                <CsPanelTitle theme={theme}>Template Email</CsPanelTitle>
                <CsPanelSubtitle theme={theme}>
                  A fixed email sent to all companies. Use <code style={{ fontSize: '0.78rem', background: 'rgba(128,128,128,0.15)', padding: '1px 5px', borderRadius: 4 }}>{'{{company_name}}'}</code> as a placeholder.
                </CsPanelSubtitle>

                {/* Toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                      <TemplateGenDropdown
                        theme={theme}
                        generating={templateGenerating}
                        onGenerate={(html) => {
                          setTemplateHtmlEmail(html);
                          generateTemplate(html);
                        }}
                      />
                    </div>

                    {/* Subject */}
                    <SFG>
                      <SLabel theme={theme}>Subject</SLabel>
                      <SInput
                        theme={theme}
                        placeholder="A quick idea for {{company_name}}"
                        value={templateSubject}
                        onChange={e => { setTemplateSubject(e.target.value); markDirty('template'); }}
                      />
                    </SFG>

                    {/* Body */}
                    <SFG style={{ marginBottom: 0 }}>
                      <SLabel theme={theme}>Body</SLabel>
                      <STextarea
                        theme={theme}
                        rows={10}
                        placeholder={'Hi {{company_name}} team,\n\nI wanted to reach out…'}
                        value={templateBody}
                        onChange={e => { setTemplateBody(e.target.value); markDirty('template'); }}
                        style={{ fontFamily: "'SF Mono', 'Monaco', 'Courier New', monospace", fontSize: '0.83rem', lineHeight: 1.65 }}
                      />
                    </SFG>

                    {/* HTML Template toggle */}
                    <div
                      onClick={() => { setTemplateHtmlEmail(v => !v); markDirty('template'); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', userSelect: 'none', marginTop: '0.75rem' }}
                    >
                      <div style={{
                        width: 36, height: 20, borderRadius: 999, flexShrink: 0,
                        background: templateHtmlEmail ? theme.colors.primary.main : theme.colors.base[300],
                        position: 'relative', transition: 'background 0.2s',
                        border: `1px solid ${templateHtmlEmail ? theme.colors.primary.main : theme.colors.base[300]}`,
                      }}>
                        <div style={{
                          position: 'absolute', top: 2, left: templateHtmlEmail ? 17 : 2,
                          width: 14, height: 14, borderRadius: '50%',
                          background: '#fff', transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.75 }}>HTML Template</span>
                    </div>

                    <SSaveRow>
                      <SBtn theme={theme} onClick={saveTemplate} disabled={templateSaving || templateGenerating}>
                        {templateSaving ? 'Saving…' : 'Save Template'}
                      </SBtn>
                    </SSaveRow>
              </CsTabPanel>
            )}

            {/* ── BRANDING tab ─────────────────────────────── */}
            {activeTab === 'branding' && (
              <CsTabPanel theme={theme} key="branding">
                <CsPanelTitle theme={theme}>Branding</CsPanelTitle>
                <CsPanelSubtitle theme={theme}>
                  Campaign-specific logo and email signature.
                </CsPanelSubtitle>

                {viewInheritSettings ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.5rem 0.75rem', background: theme.colors.primary.main + '12', border: `1px solid ${theme.colors.primary.main}30`, borderRadius: theme.radius.field }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span style={{ fontSize: '0.75rem', color: theme.colors.primary.main, fontWeight: 600 }}>Inherited from global settings — disable inheritance to edit</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Global Logo</div>
                        {globalLogoData ? (
                          <div style={{ display: 'inline-block', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, padding: '0.4rem', background: theme.colors.base[200] }}>
                            <img src={globalLogoData} alt="Global logo" style={{ maxHeight: 40, maxWidth: 160, objectFit: 'contain', display: 'block' }} />
                          </div>
                        ) : <div style={{ fontSize: '0.78rem', opacity: 0.38, fontStyle: 'italic' }}>No logo set</div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Global Signature</div>
                        {globalSignature ? (
                          <div style={{ background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, padding: '0.5rem 0.75rem', fontSize: '0.8rem', whiteSpace: 'pre-wrap', lineHeight: 1.5, opacity: 0.75 }}>{globalSignature}</div>
                        ) : <div style={{ fontSize: '0.78rem', opacity: 0.38, fontStyle: 'italic' }}>No signature set</div>}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <SFG>
                      <SLabel theme={theme}>
                        Logo
                        <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.5, marginLeft: '0.25rem' }}>PNG, JPG, GIF or WebP · max 5 MB</span>
                      </SLabel>
                      {/* Show pending preview, or current saved logo, or placeholder */}
                      {(() => {
                        const displaySrc = pendingLogo instanceof File
                          ? pendingLogoPreview
                          : pendingLogo === 'remove'
                          ? null
                          : (prefs.logo_data ?? null);
                        const hasLogo = !!displaySrc;
                        return (
                          <LogoArea
                            theme={theme}
                            $hasLogo={hasLogo}
                            onClick={() => (document.getElementById('campaign-logo-upload') as HTMLInputElement)?.click()}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleLogoFile(f); }}
                          >
                            {hasLogo ? (
                              <>
                                <LogoImg src={displaySrc!} alt="Campaign logo" />
                                <LogoRemove theme={theme} type="button"
                                  onClick={handleLogoRemove}
                                  title="Remove logo (saved when you click Save)"
                                >✕</LogoRemove>
                              </>
                            ) : (
                              <LogoPlaceholder>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <span>Click or drag to upload</span>
                              </LogoPlaceholder>
                            )}
                          </LogoArea>
                        );
                      })()}
                      {pendingLogo && (
                        <div style={{ fontSize: '0.75rem', marginTop: '0.35rem', color: '#F59E0B', fontWeight: 500 }}>
                          {pendingLogo === 'remove' ? '⚠ Logo will be removed when you Save' : '⚠ Logo will be uploaded when you Save'}
                        </div>
                      )}
                      <input id="campaign-logo-upload" type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = ''; }} />
                    </SFG>
                    <SFG style={{ marginBottom: 0 }}>
                      <SLabel theme={theme}>Email Signature</SLabel>
                      <STextarea theme={theme} rows={4} placeholder={'Best,\nJohn Smith\nAcme Corp'}
                        value={prefs.signature} onChange={e => set('signature', e.target.value, 'branding')} />
                    </SFG>
                    <SSaveRow>
                      <SBtn theme={theme} onClick={() => save('branding')} disabled={saving || loading}>
                        {saving ? 'Saving…' : 'Save'}
                      </SBtn>
                    </SSaveRow>
                  </>
                )}
              </CsTabPanel>
            )}

            {/* ── ATTACHMENTS tab ──────────────────────────── */}
            {activeTab === 'attachments' && (
              <CsTabPanel theme={theme} key="attachments">
                <CsPanelTitle theme={theme}>Attachments</CsPanelTitle>
                <CsPanelSubtitle theme={theme}>
                  Files uploaded here will automatically be added to this campaign. You can also select from previously uploaded files below.
                </CsPanelSubtitle>

                {viewInheritAttachments ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: theme.colors.primary.main + '12', border: `1px solid ${theme.colors.primary.main}30`, borderRadius: theme.radius.field }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span style={{ fontSize: '0.75rem', color: theme.colors.primary.main, fontWeight: 600 }}>Inherited from global settings — disable inheritance to edit</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, background: theme.colors.primary.main + '20', color: theme.colors.primary.main, border: `1px solid ${theme.colors.primary.main}40`, borderRadius: '999px', padding: '1px 7px', marginLeft: 'auto' }}>{globalAttachments.length} global</span>
                    </div>
                    <AttachList theme={theme}>
                      {globalAttachments.length === 0 ? (
                        <AttachEmpty theme={theme}>No attachments set in global settings</AttachEmpty>
                      ) : globalAttachments.map(att => {
                        const ext = getExt(att.filename);
                        const sizeKb = att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : '';
                        return (
                          <AttachItem key={att.id} theme={theme} $checked={false} style={{ cursor: 'default' }} onClick={() => {}}>
                            <AttachExtBadge $ext={ext}>{ext || '?'}</AttachExtBadge>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <AttachName>{att.filename}</AttachName>
                              {sizeKb && <div style={{ fontSize: '0.7rem', opacity: 0.45, marginTop: '1px' }}>{sizeKb}</div>}
                            </div>
                          </AttachItem>
                        );
                      })}
                    </AttachList>
                  </>
                ) : (
                  <>
                    {/* ── Upload zone ── */}
                    <div style={{ marginBottom: '1.25rem' }}>
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
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                          background: uploadFile ? theme.colors.primary.main + '15' : theme.colors.base[300],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: uploadFile ? theme.colors.primary.main : theme.colors.base.content,
                          opacity: uploadFile ? 1 : 0.4,
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
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {uploadFile ? (
                            <>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {uploadFile.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '1px' }}>
                                {(uploadFile.size / 1024).toFixed(0)} KB · Click to change
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.65 }}>Click or drag to upload</div>
                              <div style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '1px' }}>PDF, DOC, DOCX, TXT, CSV · Max 5MB</div>
                            </>
                          )}
                        </div>
                        {uploadFile && !uploading && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setUploadFile(null);
                              if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
                            }}
                            style={{
                              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                              border: `1px solid ${theme.colors.base[300]}`,
                              background: theme.colors.base[100],
                              color: theme.colors.base.content,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.65rem', opacity: 0.6,
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

                      {uploadFile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.6rem' }}>
                          <SBtn theme={theme} onClick={handleAttachUpload} disabled={uploading} style={{ minWidth: 120, padding: '0.5rem 1rem', fontSize: '0.825rem' }}>
                            {uploading ? 'Uploading…' : 'Upload & Attach'}
                          </SBtn>
                        </div>
                      )}
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: theme.colors.base[300], marginBottom: '1rem' }} />

                    {/* Attached / Not Attached lists */}
                    {attachLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', opacity: 0.5, fontSize: '0.875rem' }}>
                        Loading attachments…
                      </div>
                    ) : allAttachments.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', gap: '0.5rem', opacity: 0.5 }}>
                        <PaperclipIcon />
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>No files uploaded yet</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Use the upload area above to add your first file.</div>
                      </div>
                    ) : (<>

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
                          style={{ paddingLeft: '2rem' }}
                        />
                      </div>

                      {/* ATTACHED */}
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
                              onClick={() => { setLinkedAttachmentIds(new Set()); }}
                              style={{
                                marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600,
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: theme.colors.base.content, opacity: 0.4, padding: '2px 6px', borderRadius: '4px',
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
                                  <AttachCheckbox theme={theme} $checked={true}>
                                    <CheckSmallIcon />
                                  </AttachCheckbox>
                                  <AttachExtBadge $ext={ext}>{ext || '?'}</AttachExtBadge>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <AttachName>{att.filename}</AttachName>
                                    {sizeKb && <div style={{ fontSize: '0.7rem', opacity: 0.45, marginTop: '1px' }}>{sizeKb}</div>}
                                  </div>
                                  <span style={{ fontSize: '0.7rem', opacity: 0.35, flexShrink: 0 }}>click to detach</span>
                                </AttachItem>
                              );
                            })
                          )}
                        </AttachList>
                      </div>

                      {/* NOT ATTACHED */}
                      <div style={{ marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                               strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                          </svg>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.45 }}>
                            Not Attached
                          </span>
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, background: theme.colors.base[300], borderRadius: '999px', padding: '1px 6px', opacity: 0.55 }}>
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
                                  <span style={{ fontSize: '0.7rem', opacity: 0.35, flexShrink: 0 }}>click to attach</span>
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
                        <SBtn theme={theme} onClick={saveAttachments} disabled={attachSaving} style={{ padding: '0.5rem 1.2rem', fontSize: '0.825rem' }}>
                          {attachSaving ? 'Saving…' : 'Save'}
                        </SBtn>
                      </div>

                    </>)}
                  </>
                )}
              </CsTabPanel>
            )}


          </CsNavBody>



        </CsModal>
      </CsModalWrap>
      <UnsavedChangesDialog
        open={confirmClose}
        theme={theme}
        onKeep={() => setConfirmClose(false)}
        onDiscard={() => { setConfirmClose(false); onClose(); }}
      />
    </>
  );
};

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
  const [catCompanyMap, setCatCompanyMap]      = useState<Map<number, Set<number>>>(new Map());
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
    setCategories([]); setCatCompanyMap(new Map());
    setCatDropOpen(false); setCatDropSearch('');
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
      let allCos: EnrollableCompany[] = [], page = 1, total = Infinity;
      while (allCos.length < total) {
        const r = await apiFetch(`${apiBase}/company/?page=${page}&size=${PAGE_SIZE}${s}`, { });
        if (!r.ok) break;
        const d = await r.json(); total = d.total || 0;
        allCos = [...allCos, ...(d.companies || [])];
        if (allCos.length >= total) break; page++;
      }
      let enrolled: EnrollableCompany[] = []; page = 1; total = Infinity;
      while (enrolled.length < total) {
        const r = await apiFetch(`${apiBase}/campaign/${campaignId}/company/?page=${page}&size=${PAGE_SIZE}`, { });
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

  useEffect(() => { if (tab === 'enroll' && isOpen) loadEnrollList(''); }, [tab, isOpen, campaignId]);
  useEffect(() => {
    if (tab !== 'enroll' || !isOpen) return;
    if (enrollDebounce.current) clearTimeout(enrollDebounce.current);
    enrollDebounce.current = setTimeout(() => loadEnrollList(enrollSearch), 350);
    return () => { if (enrollDebounce.current) clearTimeout(enrollDebounce.current); };
  }, [enrollSearch]);

  // Load categories + build cat→company map once when enroll tab opens
  const loadCategories = async () => {
    setCatsLoading(true);
    try {
      const r = await apiFetch(`${apiBase}/category/`, {});
      if (!r.ok) return;
      const d = await r.json();
      const cats: Category[] = d.categories || d || [];
      setCategories(cats);
      // Build map: categoryId → Set<companyId>
      const map = new Map<number, Set<number>>();
      await Promise.all(cats.map(async (cat) => {
        try {
          let allIds: number[] = [], page = 1, total = Infinity;
          while (allIds.length < total) {
            const cr = await apiFetch(`${apiBase}/category/${cat.id}/company/?page=${page}&size=200`, {});
            if (!cr.ok) break;
            const cd = await cr.json();
            total = cd.total || 0;
            allIds = [...allIds, ...(cd.companies || []).map((c: any) => c.id)];
            if (allIds.length >= total) break; page++;
          }
          map.set(cat.id, new Set(allIds));
        } catch { map.set(cat.id, new Set()); }
      }));
      setCatCompanyMap(map);
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
        const r = await apiFetch(`${apiBase}/campaign/${campaignId}/company/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toEnroll),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail || 'Failed to enroll');
      }
      if (toUnenroll.length > 0) {
        const r = await apiFetch(`${apiBase}/campaign/${campaignId}/company/?ids=${toUnenroll.join(',')}`, {
          method: 'DELETE',
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
    // Close modal and show spinner immediately, then fire request in background
    resetAll(); onSuccess(0); onClose();
    const fd = new FormData(); fd.append('file', csvFile); fd.append('campaign_id', String(campaignId));
    apiFetch(`${apiBase}/company/`, { method: 'POST', body: fd })
      .catch(() => { /* silent — polling will stop naturally */ });
  };

  const submitAi = async () => {
    if (!aiQuery.trim()) { setResult({ type: 'error', text: 'Enter a search query' }); return; }
    // Close modal and show spinner immediately, then fire request in background
    resetAll(); onSuccess(0); onClose();
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
                  const filtered = selectedCatIds.size === 0
                    ? enrollList
                    : catFilterMode === 'any'
                      ? enrollList.filter(c => Array.from(selectedCatIds).some(cid => catCompanyMap.get(cid)?.has(c.id)))
                      : enrollList.filter(c => Array.from(selectedCatIds).every(cid => catCompanyMap.get(cid)?.has(c.id)));
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
// EMAIL MODAL STYLES
// ─────────────────────────────────────────────────────────────
const EmailModalBackdrop = styled.div<{ $open: boolean }>`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
  z-index: 9998;
  opacity: ${p => p.$open ? 1 : 0};
  visibility: ${p => p.$open ? 'visible' : 'hidden'};
  transition: opacity 0.25s ease, visibility 0.25s ease;
`;
const EmailModalWrap = styled.div<{ $open: boolean }>`
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; padding: 1.5rem;
  pointer-events: ${p => p.$open ? 'all' : 'none'};
`;
const EmailModalBox = styled.div<{ theme: any; $open: boolean }>`
  width: 100%; max-width: 720px;
  max-height: calc(100vh - 3rem);
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: 16px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.4);
  display: flex; flex-direction: column; overflow: hidden;
  opacity: ${p => p.$open ? 1 : 0};
  transform: ${p => p.$open ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(16px)'};
  transition: opacity 0.25s ease, transform 0.25s ease;
`;
const EmailModalHead = styled.div<{ theme: any }>`
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  flex-shrink: 0;
`;
const EmailModalTitle = styled.h2`
  margin: 0; font-size: 1rem; font-weight: 700; letter-spacing: -0.02em;
  display: flex; align-items: center; gap: 0.5rem;
`;
const EmailModalBody = styled.div`
  flex: 1; overflow-y: auto; padding: 1.5rem;
  display: flex; flex-direction: column; gap: 1rem;
`;
const EmailModalFoot = styled.div<{ theme: any }>`
  padding: 1.25rem 1.5rem;
  border-top: 1px solid ${p => p.theme.colors.base[300]};
  display: flex; gap: 0.75rem; justify-content: flex-end; align-items: center;
  flex-shrink: 0;
`;
const ESubjectInput = styled.input<{ theme: any }>`
  width: 100%; padding: 0.65rem 0.9rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.9rem; font-weight: 600; box-sizing: border-box;
  transition: border-color 0.15s;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }
`;
const EBodyTextarea = styled.textarea<{ theme: any }>`
  width: 100%; padding: 0.75rem 0.9rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem; font-family: inherit;
  resize: vertical; min-height: 260px; box-sizing: border-box;
  transition: border-color 0.15s; line-height: 1.6;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }
`;
const EFieldLabel = styled.div<{ theme: any }>`
  font-size: 0.75rem; font-weight: 600; opacity: 0.55; margin-bottom: 0.35rem;
  text-transform: uppercase; letter-spacing: 0.04em;
`;
const EGenBtn = styled.button<{ theme: any; $active?: boolean }>`
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background: ${p => p.$active ? p.theme.colors.primary.main + '15' : p.theme.colors.base[200]};
  color: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base.content};
  font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
  &:hover:not(:disabled) { border-color: ${p => p.theme.colors.primary.main}; color: ${p => p.theme.colors.primary.main}; background: ${p => p.theme.colors.primary.main}10; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
  svg { width: 13px; height: 13px; }
`;
const EActionBtn = styled.button<{ theme: any; $variant?: 'primary' | 'success' | 'warning' | 'default' }>`
  display: inline-flex; align-items: center; gap: 0.4rem;
  height: 34px; padding: 0 1.1rem;
  border-radius: ${p => p.theme.radius.field};
  border: none; font-size: 0.8375rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
  background: ${p =>
    p.$variant === 'primary' ? p.theme.colors.primary.main :
    p.$variant === 'success' ? (p.theme.colors.success?.main || '#22c55e') :
    p.$variant === 'warning' ? (p.theme.colors.warning?.main || '#f59e0b') :
    p.theme.colors.base[300]};
  color: ${p =>
    p.$variant === 'primary' ? p.theme.colors.primary.content :
    p.$variant === 'success' ? '#fff' :
    p.$variant === 'warning' ? '#fff' :
    p.theme.colors.base.content};
  &:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  &:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
  svg { width: 14px; height: 14px; }
`;
const EStatusBadge = styled.span<{ $status: string }>`
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.2rem 0.6rem; border-radius: 999px;
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  ${p => {
    const s = p.$status;
    if (s === 'sent')      return 'background:#22c55e20;color:#22c55e;border:1px solid #22c55e40;';
    if (s === 'draft')     return 'background:#3b82f620;color:#3b82f6;border:1px solid #3b82f640;';
    if (s === 'scheduled') return 'background:#f59e0b20;color:#f59e0b;border:1px solid #f59e0b40;';
    if (s === 'primary')   return 'background:#8b5cf620;color:#8b5cf6;border:1px solid #8b5cf640;';
    if (s === 'sending')   return 'background:#06b6d420;color:#06b6d4;border:1px solid #06b6d440;';
    return 'background:#64748b20;color:#64748b;border:1px solid #64748b40;';
  }}
`;
const ELoadingBox = styled.div`
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.75rem; padding: 3rem 1.5rem; opacity: 0.6;
`;
const ESpinner = styled.div`
  width: 28px; height: 28px;
  border: 3px solid rgba(128,128,128,0.2); border-top-color: currentColor;
  border-radius: 50%; animation: ${spin} 0.7s linear infinite;
`;


// Email modal tab bar
const ETabBar = styled.div<{ theme: any }>`
  display: flex; gap: 0;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  flex-shrink: 0;
  background: ${p => p.theme.colorScheme === 'dark' ? p.theme.colors.base[200] : p.theme.colors.base[100]};
`;
const ETabBtn = styled.button<{ theme: any; $active: boolean }>`
  display: inline-flex; align-items: center; gap: 0.45rem;
  padding: 0.7rem 1.25rem;
  font-size: 0.8375rem; font-weight: ${p => p.$active ? 700 : 500};
  border: none; border-bottom: 2px solid ${p => p.$active ? p.theme.colors.primary.main : 'transparent'};
  background: none; cursor: pointer;
  color: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base.content};
  opacity: ${p => p.$active ? 1 : 0.55};
  transition: all 0.15s; margin-bottom: -1px;
  &:hover { opacity: 1; color: ${p => p.theme.colors.primary.main}; }
  svg { width: 14px; height: 14px; }
`;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const formatDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
};

// Extra icons for email modal
const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const RegenerateIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const PersonalizedIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const TemplateIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
  </svg>
);
const HtmlIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);
const PlainIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────
// REGENERATE DROPDOWN — matches TemplateGenDropdown / GenBtn UI
// ─────────────────────────────────────────────────────────────
const RegenDropdown: React.FC<{
  theme: any;
  acting: boolean;
  hasTemplateEmail: boolean;
  onRegenerate: (queryType: 'plain' | 'html' | 'template') => void;
}> = ({ theme, acting, hasTemplateEmail, onRegenerate }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const chevronRef = useRef<HTMLSpanElement>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = chevronRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.right });
    setOpen(v => !v);
  };

  return (
    <GenBtn theme={theme} $disabled={acting}>
      <GenBtnLeft theme={theme} onClick={() => !acting && onRegenerate('plain')}>
        <GenBtnIcon>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </GenBtnIcon>
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
            transform: 'translateX(-100%)',
            zIndex: 9999,
            background: theme.colors.base[200],
            border: `1px solid ${theme.colors.base[300]}`,
            borderRadius: theme.radius.field,
            boxShadow: theme.colorScheme === 'dark' ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.13)',
            minWidth: 130, overflow: 'hidden',
          }}>
            <GenDropItem theme={theme}
              onClick={e => { e.stopPropagation(); onRegenerate('html'); setOpen(false); }}>
              <HtmlIcon />HTML Email
            </GenDropItem>
            <GenDropItem theme={theme}
              onClick={e => { e.stopPropagation(); if (hasTemplateEmail) { onRegenerate('template'); setOpen(false); } }}
              style={!hasTemplateEmail ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
              title={!hasTemplateEmail ? 'No template set — configure in Campaign Settings' : undefined}>
              <TemplateIcon />From Template
            </GenDropItem>
          </div>
        </>,
        document.body
      )}
    </GenBtn>
  );
};

// ─────────────────────────────────────────────────────────────
// EMAIL MODAL COMPONENT
// ─────────────────────────────────────────────────────────────
interface EmailData {
  id: number;
  email_subject: string | null;
  email_content: string;
  recipient_email: string | null;
  status: string;
  attachment_ids?: number[];
  html_email?: number; // 0 = plain, 1 = html
}

interface EmailModalProps {
  isOpen: boolean;
  company: Company | null;
  campaignId: number;
  theme: any;
  apiBase: string;
  onClose: () => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, msg: string) => void;
  hasTemplateEmail?: boolean;
  initialHtmlEmail?: boolean;
  initialQueryType?: 'plain' | 'html' | 'template';
}

const EmailModal: React.FC<EmailModalProps> = ({
  isOpen, company, campaignId, theme, apiBase, onClose, onToast, hasTemplateEmail, initialHtmlEmail = false, initialQueryType,
}) => {
  type ETab = 'email' | 'attachments' | 'branding';
  const [activeTab, setActiveTab]   = useState<ETab>('email');
  const [phase, setPhase]           = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMsg, setLoadingMsg] = useState('Loading email…');
  const [email, setEmail]           = useState<EmailData | null>(null);
  const [subject, setSubject]       = useState('');
  const [body, setBody]             = useState('');
  const [acting, setActing]         = useState<string | null>(null);
  const [htmlEmail, setHtmlEmail]   = useState(false);
  const htmlEmailRef = useRef(false);

  // ── Attachment tab state (mirrors CampaignSettingsModal exactly) ─────────────
  const [allAttachments,       setAllAttachments]      = useState<AttachmentOption[]>([]);
  const [linkedEmailAttachIds, setLinkedEmailAttachIds] = useState<Set<number>>(new Set());
  const [attachSearch,         setAttachSearch]        = useState('');
  const [attachSaving,         setAttachSaving]        = useState(false);
  const [attachMsg,            setAttachMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [attachLoading,        setAttachLoading]       = useState(false);
  const [uploadFile,           setUploadFile]          = useState<File | null>(null);
  const [uploading,            setUploading]           = useState(false);
  const [uploadMsg,            setUploadMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragOver,           setIsDragOver]          = useState(false);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const [inheritCampaignAttachments, setInheritCampaignAttachments] = useState(1);
  const [inheritSaving,              setInheritSaving]              = useState(false);
  const [inheritedAttachIds,         setInheritedAttachIds]         = useState<number[]>([]);

  // ── Branding tab state ────────────────────────────────────────────────────────
  const [inheritCampaignBranding, setInheritCampaignBranding] = useState(1);
  const [brandSignature,          setBrandSignature]          = useState('');
  const [brandLogoData,           setBrandLogoData]           = useState<string | null>(null);
  const [brandLogoUploading,      setBrandLogoUploading]      = useState(false);
  const brandLogoInputRef = useRef<HTMLInputElement>(null);


  // ── Reset + load on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !company) return;
    setActiveTab('email');
    setPhase('loading');
    setLoadingMsg('Loading email…');
    setActing(null);
    setHtmlEmail(initialHtmlEmail);
    htmlEmailRef.current = initialHtmlEmail;
    setAttachSearch('');
    setAttachMsg(null);
    setUploadMsg(null);
    setUploadFile(null);
    setIsDragOver(false);
    if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
    setBrandSignature('');
    setBrandLogoData(null);
    loadPrimaryEmail();
    loadAllAttachments();
    loadInheritFlag();
  }, [isOpen, company?.id]);

  // ── Load all user attachments ─────────────────────────────────────────────────
  const loadAllAttachments = async () => {
    setAttachLoading(true);
    try {
      const res = await apiFetch(`${apiBase}/attachments/?page=1&page_size=200`);
      if (res.ok) { const d = await res.json(); setAllAttachments(d.attachments ?? []); }
    } catch { /* silent */ } finally { setAttachLoading(false); }
  };

  // ── Load inherit flags from campaign_company ──────────────────────────────────
  const loadInheritFlag = async () => {
    if (!company) return;
    try {
      const res = await apiFetch(`${apiBase}/campaign/${campaignId}/company/${company.id}/`);
      if (res.ok) {
        const d = await res.json();
        setInheritCampaignAttachments(d.inherit_campaign_attachments ?? 1);
        setInheritCampaignBranding(d.inherit_campaign_branding ?? 1);
      }
    } catch { /* silent — defaults stay 1 */ }
  };

  const saveInheritFlag = async (attachVal: number, brandVal: number) => {
    if (!company) return;
    setInheritSaving(true);
    try {
      await apiFetch(`${apiBase}/campaign/${campaignId}/company/${company.id}/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inherit_campaign_attachments: attachVal, inherit_campaign_branding: brandVal }),
      });
    } catch { /* silent */ } finally { setInheritSaving(false); }
  };

  // ── Load email-linked attachments (called after email is populated) ───────────
  const loadEmailLinkedAttachments = async (emailId: number) => {
    try {
      const res = await apiFetch(`${apiBase}/email/${emailId}/attachments/`);
      if (res.ok) {
        const d = await res.json();
        setLinkedEmailAttachIds(new Set((d.attachments ?? []).map((a: any) => a.id)));
      }
    } catch { /* silent */ }
  };

  // ── Primary email load / generate ────────────────────────────────────────────
  const loadPrimaryEmail = async () => {
    if (!company) return;
    await generateEmail(null);
  };

  const populateEmail = (d: EmailData) => {
    setEmail(d);
    setSubject(d.email_subject || '');
    setBody(d.email_content || '');
    setHtmlEmail(!!(d.html_email));
    setBrandSignature((d as any).signature || '');
    setBrandLogoData((d as any).logo_data || null);
    setInheritedAttachIds(d.attachment_ids ?? []);
    setPhase('ready');
    loadEmailLinkedAttachments(d.id);
  };

  const generateEmail = async (queryType: 'plain' | 'html' | 'template' | null) => {
    if (!company) return;
    const isInitialLoad = queryType === null;
    // On initial load, derive query_type from initialQueryType prop or htmlEmailRef
    const resolvedType: 'plain' | 'html' | 'template' = queryType ?? (
      initialQueryType === 'template' ? 'template' :
      (initialQueryType === 'html' || htmlEmailRef.current) ? 'html' : 'plain'
    );
    setPhase('loading');
    setLoadingMsg(
      isInitialLoad
        ? 'Loading email…'
        : resolvedType === 'template' ? 'Generating from template…' : `Generating ${resolvedType === 'html' ? 'HTML' : 'plain'} email…`
    );
    try {
      const genRes = await apiFetch(
        `${apiBase}/email/campaign/${campaignId}/company/${company.id}/generate-email/?query_type=${resolvedType}&force=${!isInitialLoad}`,
        { method: 'POST' },
      );
      if (!genRes.ok) {
        const e = await genRes.json();
        onToast('error', 'Generation Failed', e.detail || 'Failed to generate email');
        if (isInitialLoad) { onClose(); return; }
        setPhase('ready');
        return;
      }
      const primRes = await apiFetch(`${apiBase}/email/campaign/${campaignId}/company/${company.id}/primary/`);
      if (primRes.ok) {
        const d = await primRes.json();
        populateEmail(d);
        if (!isInitialLoad) onToast('success', 'Generated', `Email regenerated (${resolvedType}) successfully`);
      } else {
        if (isInitialLoad) { onClose(); return; }
        setPhase('error');
      }
    } catch (err) {
      onToast('error', 'Error', err instanceof Error ? err.message : 'Generation failed');
      if (isInitialLoad) { onClose(); return; }
      setPhase('error');
    }
  };

  // ── Email edits / actions ─────────────────────────────────────────────────────
  const saveEdits = async (): Promise<boolean> => {
    if (!email) return false;
    try {
      const res = await apiFetch(`${apiBase}/email/${email.id}/update/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_subject: subject, email_content: body }),
      });
      return res.ok;
    } catch { return false; }
  };

  const handleSend = async () => {
    if (!email || acting) return;
    setActing('send'); await saveEdits();
    try {
      const res = await apiFetch(`${apiBase}/email/${email.id}/send/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Send failed');
      onToast('success', 'Email Sent', `Email sent to ${company?.email}`);
      onClose();
    } catch (err) {
      onToast('error', 'Send Failed', err instanceof Error ? err.message : 'Failed to send');
    } finally { setActing(null); }
  };

  // ── Attachment tab helpers (mirrors settings modal exactly) ───────────────────
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
    if (!uploadFile || !email) return;
    setUploading(true); setUploadMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const uploadRes = await apiFetch(`${apiBase}/attachment/`, {
        method: 'POST', body: formData,
      });
      if (!uploadRes.ok) { const e = await uploadRes.json(); throw new Error(e.detail || 'Upload failed'); }
      const uploadData = await uploadRes.json();
      const newId: number = uploadData.id;
      // Auto-attach to this email
      const newIds = Array.from(new Set([...Array.from(linkedEmailAttachIds), newId]));
      const attachRes = await apiFetch(`${apiBase}/email/${email.id}/attachments/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIds),
      });
      if (attachRes.ok) setLinkedEmailAttachIds(new Set(newIds));
      await loadAllAttachments();
      setUploadFile(null);
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
      setUploadMsg({ type: 'success', text: `"${uploadData.filename}" uploaded and attached` });
    } catch (err) {
      setUploadMsg({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' });
    } finally { setUploading(false); }
  };

  const toggleAttachment = async (id: number) => {
    if (!email) return;
    const next = new Set(linkedEmailAttachIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setLinkedEmailAttachIds(next);
    try {
      await apiFetch(`${apiBase}/email/${email.id}/attachments/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.from(next)),
      });
    } catch { /* silent */ }
  };

  const saveAttachments = async () => {
    if (!email) return;
    setAttachSaving(true); setAttachMsg(null);
    try {
      const res = await apiFetch(`${apiBase}/email/${email.id}/attachments/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.from(linkedEmailAttachIds)),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed to save'); }
      setAttachMsg({ type: 'success', text: 'Attachments saved' });
    } catch (err) {
      setAttachMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save attachments' });
    } finally { setAttachSaving(false); }
  };

  // ── Branding helpers ─────────────────────────────────────────────────────────
  const doSaveBranding = async (logoData: string | null, signature: string) => {
    if (!email) return;
    try {
      await saveInheritFlag(inheritCampaignAttachments, inheritCampaignBranding);
      await apiFetch(`${apiBase}/email/${email.id}/update/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: signature ?? '',
          ...(logoData ? { logo_data: logoData } : { logo_clear: true }),
        }),
      });
    } catch { /* silent */ }
  };

  const handleBrandLogoFile = async (file: File) => {
    const MAX = 5 * 1024 * 1024;
    if (file.size > MAX) return;
    setBrandLogoUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const data = reader.result as string;
        setBrandLogoData(data);
        setBrandLogoUploading(false);
        await doSaveBranding(data, brandSignature);
      };
      reader.onerror = () => { setBrandLogoUploading(false); };
      reader.readAsDataURL(file);
    } catch { setBrandLogoUploading(false); }
  };

  // ── Derived attachment lists ──────────────────────────────────────────────────
  const filteredAttachments = allAttachments.filter(a =>
    a.filename.toLowerCase().includes(attachSearch.toLowerCase())
  );
  const attachedFiles    = filteredAttachments.filter(a =>  linkedEmailAttachIds.has(a.id));
  const notAttachedFiles = filteredAttachments.filter(a => !linkedEmailAttachIds.has(a.id));

  if (!company) return null;

  const handleClose = () => {
    if (email) {
      saveEdits();
      if (!inheritCampaignBranding) doSaveBranding(brandLogoData, brandSignature);
    }
    onClose();
  };

  return (
    <>
      <EmailModalBackdrop $open={isOpen} onClick={handleClose} />
      <EmailModalWrap $open={isOpen} onClick={handleClose}>
        <EmailModalBox theme={theme} $open={isOpen} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <EmailModalHead theme={theme}>
            <EmailModalTitle>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              {company.name}
              <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.5 }}>· {company.email}</span>
              {email && email.status !== 'primary' && <EStatusBadge $status={email.status}>{email.status}</EStatusBadge>}
            </EmailModalTitle>
            <CsCloseBtn theme={theme} onClick={handleClose}>✕</CsCloseBtn>
          </EmailModalHead>

          {/* Tab bar — only shown when email is ready */}
          {phase === 'ready' && (
            <ETabBar theme={theme}>
              <ETabBtn theme={theme} $active={activeTab === 'email'} onClick={() => {
                if (activeTab === 'branding' && !inheritCampaignBranding) doSaveBranding(brandLogoData, brandSignature);
                setActiveTab('email');
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                Email
              </ETabBtn>
              <ETabBtn
                theme={theme}
                $active={activeTab === 'attachments'}
                onClick={() => {
                  if (activeTab === 'branding' && !inheritCampaignBranding) doSaveBranding(brandLogoData, brandSignature);
                  setActiveTab('attachments');
                }}
              >
                <PaperclipIcon />
                Attachments
                {!inheritCampaignAttachments && linkedEmailAttachIds.size > 0 && (
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700,
                    background: theme.colors.primary.main + '20', color: theme.colors.primary.main,
                    border: `1px solid ${theme.colors.primary.main}40`,
                    borderRadius: '999px', padding: '1px 6px', marginLeft: '1px',
                  }}>
                    {linkedEmailAttachIds.size}
                  </span>
                )}
              </ETabBtn>
              <ETabBtn
                theme={theme}
                $active={activeTab === 'branding'}
                onClick={() => setActiveTab('branding')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                Branding
              </ETabBtn>
            </ETabBar>
          )}

          {/* Body */}
          <EmailModalBody style={{ gap: (activeTab === 'attachments' || activeTab === 'branding') ? 0 : '1rem' }}>

            {phase === 'loading' && (
              <ELoadingBox>
                <ESpinner />
                <div style={{ fontSize: '0.875rem' }}>{loadingMsg}</div>
              </ELoadingBox>
            )}

            {phase === 'error' && (
              <div style={{ padding: '2rem', textAlign: 'center', color: theme.colors.error.main }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠️</div>
                <div style={{ fontWeight: 600 }}>Failed to load email</div>
                <button
                  onClick={() => generateEmail(null)}
                  style={{ marginTop: '1rem', padding: '0.5rem 1.2rem', borderRadius: theme.radius.field, border: 'none', background: theme.colors.primary.main, color: theme.colors.primary.content, cursor: 'pointer', fontWeight: 600 }}
                >
                  Retry
                </button>
              </div>
            )}

            {phase === 'ready' && activeTab === 'email' && (
              <>
                {/* Subject */}
                <div>
                  <EFieldLabel theme={theme}>Subject</EFieldLabel>
                  <ESubjectInput theme={theme} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject…" />
                </div>

                {/* Body */}
                <div>
                  <EFieldLabel theme={theme}>Body</EFieldLabel>
                  <EBodyTextarea theme={theme} value={body} onChange={e => setBody(e.target.value)} placeholder="Email body…" />
                </div>

                {/* HTML Email toggle */}
                <div
                  onClick={() => {
                    const next = !htmlEmail;
                    setHtmlEmail(next);
                    htmlEmailRef.current = next;
                    if (email) {
                      apiFetch(`${apiBase}/email/${email.id}/update/`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ html_email: next }),
                      }).catch(() => {/* silent */});
                    }
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                    cursor: 'pointer', userSelect: 'none', width: 'fit-content',
                  }}
                >
                  <div style={{
                    width: 36, height: 20, borderRadius: 999, flexShrink: 0,
                    background: htmlEmail ? theme.colors.primary.main : theme.colors.base[300],
                    position: 'relative', transition: 'background 0.2s',
                    border: `1px solid ${htmlEmail ? theme.colors.primary.main : theme.colors.base[300]}`,
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, left: htmlEmail ? 17 : 2,
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.75 }}>
                    HTML Email
                  </span>
                </div>
              </>
            )}

            {/* ── ATTACHMENTS TAB — mirrors settings modal exactly ── */}
            {phase === 'ready' && activeTab === 'attachments' && (
              <>
                {/* inherit_campaign_attachments toggle — always visible */}
                <InheritRow
                  theme={theme}
                  onClick={() => {
                    const newVal = inheritCampaignAttachments ? 0 : 1;
                    setInheritCampaignAttachments(newVal);
                    saveInheritFlag(newVal, inheritCampaignBranding);
                  }}
                  style={{ marginBottom: '1.25rem' }}
                >
                  <InheritCheckbox theme={theme} $on={!!inheritCampaignAttachments}>
                    <CheckSmallIcon />
                  </InheritCheckbox>
                  <InheritText>
                    <InheritTitle>Inherit Campaign Attachments</InheritTitle>
                    <InheritDesc>Include all attachments from campaign preferences when this email is sent</InheritDesc>
                  </InheritText>
                  {inheritSaving && <ESpinner style={{ width: 14, height: 14, borderWidth: 2, flexShrink: 0 }} />}
                </InheritRow>

                {/* Inherited state — show read-only list of baked-in attachments */}
                {inheritCampaignAttachments ? (() => {
                  const inheritedFiles = allAttachments.filter(a => inheritedAttachIds.includes(a.id));
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                             strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}>
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.colors.primary.main }}>
                          Inherited Attachments
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, background: theme.colors.primary.main + '20', color: theme.colors.primary.main, border: `1px solid ${theme.colors.primary.main}40`, borderRadius: '999px', padding: '1px 6px' }}>
                          {inheritedFiles.length}
                        </span>
                      </div>
                      <AttachList theme={theme}>
                        {attachLoading ? (
                          <AttachEmpty theme={theme}>Loading…</AttachEmpty>
                        ) : inheritedFiles.length === 0 ? (
                          <AttachEmpty theme={theme}>No attachments inherited from campaign</AttachEmpty>
                        ) : inheritedFiles.map(att => {
                          const ext = getExt(att.filename);
                          const sizeKb = att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : '';
                          return (
                            <AttachItem key={att.id} theme={theme} $checked={false} style={{ cursor: 'default' }} onClick={() => {}}>
                              <AttachExtBadge $ext={ext}>{ext || '?'}</AttachExtBadge>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <AttachName>{att.filename}</AttachName>
                                {sizeKb && <div style={{ fontSize: '0.7rem', opacity: 0.45, marginTop: '1px' }}>{sizeKb}</div>}
                              </div>
                            </AttachItem>
                          );
                        })}
                      </AttachList>
                      <div style={{ fontSize: '0.78rem', opacity: 0.45, lineHeight: 1.5 }}>
                        Disable <strong>Inherit Campaign Attachments</strong> above to manage per-email files.
                      </div>
                    </div>
                  );
                })() : (<>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={e => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f && !uploading) handleAttachFilePick(f); }}
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
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: uploadFile ? theme.colors.primary.main + '15' : theme.colors.base[300],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: uploadFile ? theme.colors.primary.main : theme.colors.base.content,
                      opacity: uploadFile ? 1 : 0.4,
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {uploadFile ? (
                        <>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadFile.name}</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '1px' }}>{(uploadFile.size / 1024).toFixed(0)} KB · Click to change</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.65 }}>Click or drag to upload</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: '1px' }}>PDF, DOC, DOCX, TXT, CSV · Max 5MB</div>
                        </>
                      )}
                    </div>
                    {uploadFile && !uploading && (
                      <button
                        onClick={e => { e.stopPropagation(); setUploadFile(null); setUploadMsg(null); if (uploadFileInputRef.current) uploadFileInputRef.current.value = ''; }}
                        style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, border: `1px solid ${theme.colors.base[300]}`, background: theme.colors.base[100], color: theme.colors.base.content, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', opacity: 0.6 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = theme.colors.error.main; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = theme.colors.error.main; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = theme.colors.base[100]; e.currentTarget.style.color = theme.colors.base.content; e.currentTarget.style.borderColor = theme.colors.base[300]; }}
                      >✕</button>
                    )}
                    <input ref={uploadFileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachFilePick(f); }} disabled={uploading} />
                  </div>

                  {uploadFile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.6rem' }}>
                      <SBtn theme={theme} onClick={handleAttachUpload} disabled={uploading} style={{ minWidth: 120, padding: '0.5rem 1rem', fontSize: '0.825rem' }}>
                        {uploading ? 'Uploading…' : 'Upload & Attach'}
                      </SBtn>
                    </div>
                  )}
                  {uploadMsg && <SMsg theme={theme} $type={uploadMsg.type} style={{ marginTop: '0.5rem' }}>{uploadMsg.text}</SMsg>}
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: theme.colors.base[300], marginBottom: '1rem' }} />

                {/* Attached / Not Attached lists */}
                {attachLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', opacity: 0.5, fontSize: '0.875rem' }}>
                    Loading attachments…
                  </div>
                ) : allAttachments.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', gap: '0.5rem', opacity: 0.5 }}>
                    <PaperclipIcon />
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>No files uploaded yet</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Use the upload area above to add your first file.</div>
                  </div>
                ) : (<>

                  {/* Search */}
                  <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         strokeLinecap="round" strokeLinejoin="round"
                         style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <AttachPickerSearch theme={theme} placeholder="Search attachments…" value={attachSearch}
                      onChange={e => setAttachSearch(e.target.value)} style={{ paddingLeft: '2rem' }} />
                  </div>

                  {/* ATTACHED */}
                  <div style={{ marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                           strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}>
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.colors.primary.main }}>
                        Attached
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, background: theme.colors.primary.main + '20', color: theme.colors.primary.main, border: `1px solid ${theme.colors.primary.main}40`, borderRadius: '999px', padding: '1px 6px' }}>
                        {attachedFiles.length}
                      </span>
                      {attachedFiles.length > 0 && (
                        <button
                          onClick={async () => {
                            setLinkedEmailAttachIds(new Set());
                            if (email) {
                              try {
                                await apiFetch(`${apiBase}/email/${email.id}/attachments/`, {
                                  method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify([]),
                                });
                              } catch { /* silent */ }
                            }
                          }}
                          style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.base.content, opacity: 0.4, padding: '2px 6px', borderRadius: '4px' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                        >Detach all</button>
                      )}
                    </div>
                    <AttachList theme={theme}>
                      {attachedFiles.length === 0 ? (
                        <AttachEmpty theme={theme}>
                          {attachSearch ? `No attached files match "${attachSearch}"` : 'No files attached — check items below to attach them'}
                        </AttachEmpty>
                      ) : attachedFiles.map(att => {
                        const ext = getExt(att.filename);
                        const sizeKb = att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : '';
                        return (
                          <AttachItem key={att.id} theme={theme} $checked={true} onClick={() => toggleAttachment(att.id)}>
                            <AttachCheckbox theme={theme} $checked={true}><CheckSmallIcon /></AttachCheckbox>
                            <AttachExtBadge $ext={ext}>{ext || '?'}</AttachExtBadge>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <AttachName>{att.filename}</AttachName>
                              {sizeKb && <div style={{ fontSize: '0.7rem', opacity: 0.45, marginTop: '1px' }}>{sizeKb}</div>}
                            </div>
                            <span style={{ fontSize: '0.7rem', opacity: 0.35, flexShrink: 0 }}>click to detach</span>
                          </AttachItem>
                        );
                      })}
                    </AttachList>
                  </div>

                  {/* NOT ATTACHED */}
                  <div style={{ marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                           strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.45 }}>
                        Not Attached
                      </span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, background: theme.colors.base[300], borderRadius: '999px', padding: '1px 6px', opacity: 0.55 }}>
                        {notAttachedFiles.length}
                      </span>
                    </div>
                    <AttachList theme={theme}>
                      {notAttachedFiles.length === 0 ? (
                        <AttachEmpty theme={theme}>
                          {attachSearch ? `No unattached files match "${attachSearch}"` : 'All files are attached'}
                        </AttachEmpty>
                      ) : notAttachedFiles.map(att => {
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
                            <span style={{ fontSize: '0.7rem', opacity: 0.35, flexShrink: 0 }}>click to attach</span>
                          </AttachItem>
                        );
                      })}
                    </AttachList>
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                      {filteredAttachments.length < allAttachments.length
                        ? `Showing ${filteredAttachments.length} of ${allAttachments.length} files`
                        : `${allAttachments.length} file${allAttachments.length !== 1 ? 's' : ''} total`}
                    </span>
                  </div>
                </>)}
                </>)}
              </>
            )}

            {/* ── BRANDING TAB ─────────────────────────────────────────── */}
            {phase === 'ready' && activeTab === 'branding' && (
              <>
                {/* inherit_campaign_branding toggle — always visible */}
                <InheritRow
                  theme={theme}
                  onClick={async () => {
                    const newVal = inheritCampaignBranding ? 0 : 1;
                    setInheritCampaignBranding(newVal);
                    await saveInheritFlag(inheritCampaignAttachments, newVal);
                    // Reload primary email to get correctly resolved branding in both directions
                    if (company) {
                      try {
                          const res = await apiFetch(`${apiBase}/email/campaign/${campaignId}/company/${company.id}/primary/`);
                          if (res.ok) {
                            const d = await res.json();
                            setBrandSignature((d as any).signature || '');
                            setBrandLogoData((d as any).logo_data || null);
                          }
                        } catch { /* silent */ }
                    }
                  }}
                  style={{ marginBottom: '1.25rem' }}
                >
                  <InheritCheckbox theme={theme} $on={!!inheritCampaignBranding}>
                    <CheckSmallIcon />
                  </InheritCheckbox>
                  <InheritText>
                    <InheritTitle>Inherit Campaign Branding</InheritTitle>
                    <InheritDesc>Use the logo and signature from campaign preferences for this email</InheritDesc>
                  </InheritText>
                  {inheritSaving && <ESpinner style={{ width: 14, height: 14, borderWidth: 2, flexShrink: 0 }} />}
                </InheritRow>

                {/* Inherited state — show read-only baked branding */}
                {inheritCampaignBranding ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                           strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}>
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.colors.primary.main }}>
                        Inherited Branding
                      </span>
                    </div>

                    {/* Baked logo preview */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.55, marginBottom: '0.4rem' }}>Logo</div>
                      {brandLogoData ? (
                        <div style={{ display: 'inline-block', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, padding: '0.5rem', background: theme.colors.base[200] }}>
                          <img src={brandLogoData} alt="Inherited logo" style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', display: 'block' }} />
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', opacity: 0.4, fontStyle: 'italic' }}>No logo set</div>
                      )}
                    </div>

                    {/* Baked signature preview */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.55, marginBottom: '0.4rem' }}>Signature</div>
                      {brandSignature ? (
                        <div style={{
                          background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`,
                          borderRadius: theme.radius.field, padding: '0.6rem 0.8rem',
                          fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: 1.55, opacity: 0.75,
                        }}>{brandSignature}</div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', opacity: 0.4, fontStyle: 'italic' }}>No signature set</div>
                      )}
                    </div>

                    <div style={{ fontSize: '0.78rem', opacity: 0.45, lineHeight: 1.5 }}>
                      Disable <strong>Inherit Campaign Branding</strong> above to set a per-email logo and signature.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Logo */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', opacity: 0.85 }}>
                        Logo
                        <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.5, marginLeft: '0.25rem' }}>PNG, JPG, GIF or WebP · max 5 MB</span>
                      </div>
                      <LogoArea
                        theme={theme}
                        $hasLogo={!!brandLogoData}
                        onClick={() => !brandLogoUploading && brandLogoInputRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); if (!brandLogoUploading) { const f = e.dataTransfer.files[0]; if (f) handleBrandLogoFile(f); } }}
                        style={{ cursor: brandLogoUploading ? 'not-allowed' : 'pointer', opacity: brandLogoUploading ? 0.6 : 1 }}
                      >
                        {brandLogoData ? (
                          <>
                            <LogoImg src={brandLogoData} alt="Email logo" />
                            <LogoRemove theme={theme} type="button"
                              onClick={e => { e.stopPropagation(); setBrandLogoData(null); doSaveBranding(null, brandSignature); }}
                              disabled={brandLogoUploading}
                              title="Remove logo"
                            >✕</LogoRemove>
                          </>
                        ) : (
                          <LogoPlaceholder>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                            </svg>
                            <span>{brandLogoUploading ? 'Processing…' : 'Click or drag to upload'}</span>
                          </LogoPlaceholder>
                        )}
                      </LogoArea>
                      <input ref={brandLogoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f && !brandLogoUploading) handleBrandLogoFile(f); e.target.value = ''; }}
                        disabled={brandLogoUploading} />
                    </div>

                    {/* Signature */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', opacity: 0.85 }}>Email Signature</div>
                      <STextarea
                        theme={theme}
                        rows={4}
                        placeholder={'Best,\nJohn Smith\nAcme Corp'}
                        value={brandSignature}
                        onChange={e => setBrandSignature(e.target.value)}
                        onBlur={() => { if (!inheritCampaignBranding) doSaveBranding(brandLogoData, brandSignature); }}
                      />
                    </div>
                  </>
                )}
              </>
            )}

          </EmailModalBody>

          {/* Footer actions — only on email tab */}
          {phase === 'ready' && activeTab === 'email' && (
            <EmailModalFoot theme={theme}>
              <RegenDropdown
                theme={theme}
                acting={!!acting}
                hasTemplateEmail={!!hasTemplateEmail}
                onRegenerate={generateEmail}
              />
              {acting === 'regenerate' && <ESpinner style={{ width: 16, height: 16, borderWidth: 2 }} />}
              <EActionBtn theme={theme} $variant="primary" disabled={!!acting} onClick={handleSend}>
                {acting === 'send' ? <ESpinner style={{ width: 14, height: 14, borderWidth: 2 }} /> : <SendIcon />}
                Send
              </EActionBtn>
            </EmailModalFoot>
          )}

        </EmailModalBox>
      </EmailModalWrap>
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

const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({ company, isOpen, theme, apiBase, onClose, onDownload }) => {
  const [detailCampaigns, setDetailCampaigns] = useState<{ id: number; name: string }[]>([]);
  const [detailCategories, setDetailCategories] = useState<{ id: number; name: string }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !company) return;
    setDetailCampaigns([]); setDetailCategories([]); setDetailLoading(true);
    (async () => {
      try {
        // Campaigns this company belongs to
        const cr = await apiFetch(`${apiBase}/company/${company.id}/campaign/`, {});
        if (cr.ok) { const d = await cr.json(); setDetailCampaigns(d.campaigns || []); }
        // Categories: fetch all, check membership
        const catr = await apiFetch(`${apiBase}/category/`, {});
        if (catr.ok) {
          const cd = await catr.json();
          const allCats: { id: number; name: string }[] = cd.categories || cd || [];
          const memberOf: { id: number; name: string }[] = [];
          await Promise.all(allCats.map(async (cat) => {
            try {
              const r = await apiFetch(`${apiBase}/category/${cat.id}/company/`, {});
              if (!r.ok) return;
              const d = await r.json();
              const ids: number[] = (d.companies || []).map((c: any) => c.id);
              if (ids.includes(company.id)) memberOf.push(cat);
            } catch { /* silent */ }
          }));
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
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const chevronRef = useRef<HTMLSpanElement>(null);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const rect = chevronRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ top: rect.bottom + 4, left: rect.right });
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
            transform: 'translateX(-100%)',
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
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const rect = chevronRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.right });
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
            position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-100%)',
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
  const [pageCatCompanyMap, setPageCatCompanyMap]   = useState<Map<number, Set<number>>>(new Map());
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
      const r = await apiFetch(`${API_BASE}/campaign/${campaignId}/company/?page=1&size=${selectedCompanies.size}&ids=${ids}${s}`);
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
        const r = await apiFetch(`${API_BASE}/stats/${campaignId}/`, { });
        if (r.ok) { const d = await r.json(); setCampaignStats(d); }
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
        const r = await apiFetch(`${API_BASE}/campaign/${campaignId}/company/?page=${currentPage}&size=${pageSize}${s}${sortQ}`, { });
        if (r.ok) {
          const d = await r.json();
          setTotalCompanies(d.total || 0);
          let cos: Company[] = d.companies || [];
          if (selCatIds.size > 0) {
            cos = catPageFilterMode === 'any'
              ? cos.filter(c => Array.from(selCatIds).some(cid => pageCatCompanyMap.get(cid)?.has(c.id)))
              : cos.filter(c => Array.from(selCatIds).every(cid => pageCatCompanyMap.get(cid)?.has(c.id)));
          }
          setCompanies(cos);
        }
      } catch { /* silent */ }
      // Refresh stats on every companies reload
      try {
        const r = await apiFetch(`${API_BASE}/stats/${campaignId}/`, { });
        if (r.ok) { const d = await r.json(); setCampaignStats(d); }
      } catch { /* silent */ }
    })();
  }, [campaignId, refresh, currentPage, pageSize, searchTerm, sortKey, sortDir, selCatIds, catPageFilterMode, pageCatCompanyMap]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortKey, sortDir, selCatIds, catPageFilterMode]);

  // Fetch categories + build company map for filter
  useEffect(() => {
    if (!campaignId) return;
    (async () => {
      try {
        const r = await apiFetch(`${API_BASE}/category/`, {});
        if (!r.ok) return;
        const d = await r.json();
        const cats: Category[] = d.categories || d || [];
        setPageCategories(cats);
        const map = new Map<number, Set<number>>();
        await Promise.all(cats.map(async (cat) => {
          try {
            let ids: number[] = [], page = 1, total = Infinity;
            while (ids.length < total) {
              const cr = await apiFetch(`${API_BASE}/category/${cat.id}/company/?page=${page}&size=200`, {});
              if (!cr.ok) break;
              const cd = await cr.json(); total = cd.total || 0;
              ids = [...ids, ...(cd.companies || []).map((c: any) => c.id)];
              if (ids.length >= total) break; page++;
            }
            map.set(cat.id, new Set(ids));
          } catch { map.set(cat.id, new Set()); }
        }));
        setPageCatCompanyMap(map);
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
      const r = await apiFetch(`${API_BASE}/campaign/${campaignId}/company/?page=1&size=${totalCompanies || 1000}${s}`);
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
          const r = await apiFetch(`${API_BASE}/campaign/${campaignId}/company/?ids=${company.id}`, {
            method: 'DELETE',
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
          const ids = Array.from(selectedCompanies).join(',');
          const r = await apiFetch(`${API_BASE}/campaign/${campaignId}/company/?ids=${ids}`, {
            method: 'DELETE',
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
            <HeaderIconBtn theme={theme} onClick={handleBack} title="Back to campaigns">
              <ArrowLeftIcon />
            </HeaderIconBtn>

            <CampaignTitleSection style={{ textAlign: 'center' }}>
              <CampaignTitle>{campaign.name}</CampaignTitle>
              <CampaignMeta>Created {formatDate(campaign.created_at)}</CampaignMeta>
            </CampaignTitleSection>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <NavIconButton theme={theme} onClick={() => navigate('/companies')} title="Companies">
                <svg width="12" height="15" viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
        onSuccess={(active: number) => { setCompanyAdditionActive(active); if (active !== 0) startPollingAdditionStatus(); }}
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
      />

    </PageWrapper>
  );
};

export default Campaign;