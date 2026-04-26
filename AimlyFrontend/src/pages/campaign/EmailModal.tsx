/**
 * EmailModal.tsx
 * Standalone single-email modal extracted from Campaign.tsx.
 * Self-contained — all styled components defined here.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled, { keyframes } from 'styled-components';
import { apiFetch } from '../../App';
import { CsCloseBtn } from './CampaignPreferenceModal';

// ── Mobile detection ───────────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
};

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export interface Company {
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

interface AttachmentOption {
  id: number;
  filename: string;
  file_size: number;
  linked_global?: boolean;
}

interface AttachmentEntry {
  id: number;
  name: string;
  source?: 'campaign' | 'global';           // single source (legacy)
  sources?: ('campaign' | 'global')[];       // all sources — used when in both
}

interface EmailData {
  id: number;
  email_subject: string | null;
  email_content: string;
  recipient_email: string | null;
  status: string;
  own_attachments?: AttachmentEntry[];
  inherited_attachments?: AttachmentEntry[];  // always present, empty [] if nothing configured
  linked_attachment_ids?: number[];  // legacy, kept for safety
  html_email?: number;
  inherit_campaign_attachments?: number;
  inherit_global_attachments?: number;
  signature?: string | null;
  logo_data?: string | null;  // base64 data URL: "data:image/png;base64,..."
}

export interface EmailModalProps {
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

// ─────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────
const spin = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — MODAL SHELL
// ─────────────────────────────────────────────────────────────
const EmailModalBackdrop = styled.div<{ $open: boolean }>`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
  z-index: 9000;
  opacity: ${p => p.$open ? 1 : 0};
  visibility: ${p => p.$open ? 'visible' : 'hidden'};
  transition: opacity 0.2s, visibility 0.2s;
`;
const EmailModalWrap = styled.div<{ $open: boolean }>`
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  z-index: 9001; padding: 1.5rem;
  pointer-events: ${p => p.$open ? 'all' : 'none'};

  @media (max-width: 520px) {
    padding: 0;
    align-items: flex-end;
  }
`;
const EmailModalBox = styled.div<{ theme: any; $open: boolean; $wide?: boolean }>`
  width: 100%; max-width: ${p => p.$wide ? '1100px' : '720px'};
  height: min(680px, calc(100vh - 3rem));
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: 16px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.4);
  display: flex; flex-direction: column; overflow: hidden;
  opacity: ${p => p.$open ? 1 : 0};
  transform: ${p => p.$open ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(16px)'};
  transition: opacity 0.2s, transform 0.2s, max-width 0.25s;

  @media (max-width: 520px) {
    max-width: 100%;
    height: 92vh;
    border-radius: 16px 16px 0 0;
    transform: ${p => p.$open ? 'translateY(0)' : 'translateY(100%)'};
  }
`;
const EmailModalHead = styled.div<{ theme: any }>`
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  flex-shrink: 0;

  @media (max-width: 480px) { padding: 0.875rem 1rem; }
`;
const EmailModalTitle = styled.h2`
  margin: 0; font-size: 1rem; font-weight: 700; letter-spacing: -0.02em;
  display: flex; align-items: center; gap: 0.5rem;
  svg { width: 16px; height: 16px; opacity: 0.7; }
`;
const EmailModalBody = styled.div`
  flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;
`;
const EmailModalFoot = styled.div<{ theme: any }>`
  padding: 1.1rem 1.5rem;
  border-top: 1px solid ${p => p.theme.colors.base[300]};
  display: flex; gap: 0.75rem; justify-content: flex-end; align-items: center;
  flex-shrink: 0; background: ${p => p.theme.colors.base[200]};
  flex-wrap: wrap;

  @media (max-width: 480px) {
    padding: 0.875rem 1rem;
    flex-direction: column-reverse;
    align-items: stretch;
    button { width: 100%; justify-content: center; }
  }
`;

// Scroll areas — mirrors BulkEmailModal's Scroll / ScrollFlush
const EScroll = styled.div`
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;
  scrollbar-width: thin;
`;
const EScrollFlush = styled.div`
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0;
  scrollbar-width: thin;
`;

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — EMAIL FIELDS
// ─────────────────────────────────────────────────────────────
const ESubjectInput = styled.input<{ theme: any }>`
  width: 100%; padding: 0.65rem 0.9rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.9rem; font-weight: 600; box-sizing: border-box; transition: border-color 0.15s;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; background: ${p => p.theme.colors.base[100]}; box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}20; }
  &::placeholder { opacity: 0.4; font-weight: 400; }
`;
const EBodyTextarea = styled.textarea<{ theme: any }>`
  width: 100%; padding: 0.75rem 0.9rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem; font-family: inherit;
  resize: vertical; min-height: 280px; line-height: 1.6;
  box-sizing: border-box; transition: border-color 0.15s;
  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; background: ${p => p.theme.colors.base[100]}; box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}20; }
  &::placeholder { opacity: 0.4; }
`;
const EFieldLabel = styled.div<{ theme: any }>`
  font-size: 0.72rem; font-weight: 600; opacity: 0.5;
  margin-bottom: 0.3rem; text-transform: uppercase; letter-spacing: 0.04em;
  color: ${p => p.theme.colors.base.content};
`;
const EActionBtn = styled.button<{ theme: any; $variant?: 'primary' | 'success' | 'warning' | 'default' }>`
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 1rem; border-radius: ${p => p.theme.radius.field};
  font-size: 0.8125rem; font-weight: 600; border: none; cursor: pointer;
  transition: all 0.15s;
  background: ${p => p.$variant === 'primary' ? p.theme.colors.primary.main : p.$variant === 'success' ? p.theme.colors.success?.main || '#22c55e' : p.$variant === 'warning' ? p.theme.colors.warning?.main || '#f59e0b' : p.theme.colors.base[400]};
  color: ${p => p.$variant && p.$variant !== 'default' ? '#fff' : p.theme.colors.base.content};
  border: 1px solid ${p => p.$variant && p.$variant !== 'default' ? 'transparent' : p.theme.colors.base[300]};
  &:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
  &:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
`;
const EStatusBadge = styled.span<{ $status: string }>`
  display: inline-flex; align-items: center;
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  padding: 2px 7px; border-radius: 999px; letter-spacing: 0.05em;
  background: ${p => p.$status === 'sent' ? '#22c55e20' : p.$status === 'draft' ? '#3b82f620' : p.$status === 'scheduled' ? '#f59e0b20' : '#64748b20'};
  color: ${p => p.$status === 'sent' ? '#22c55e' : p.$status === 'draft' ? '#3b82f6' : p.$status === 'scheduled' ? '#f59e0b' : '#64748b'};
`;
const ESpinner = styled.div`
  width: 22px; height: 22px;
  border: 2.5px solid rgba(128,128,128,0.2); border-top-color: currentColor;
  border-radius: 50%; animation: ${spin} 0.65s linear infinite;
`;
const ETabBar = styled.div<{ theme: any }>`
  display: flex; gap: 2px; padding: 0.5rem 1.25rem 0;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  flex-shrink: 0;
`;
const ETabBtn = styled.button<{ theme: any; $active: boolean }>`
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 0.85rem; border: none; border-radius: 8px 8px 0 0;
  font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
  background: ${p => p.$active ? p.theme.colors.base[200] : 'transparent'};
  color: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base.content};
  opacity: ${p => p.$active ? 1 : 0.55};
  border-bottom: 2px solid ${p => p.$active ? p.theme.colors.primary.main : 'transparent'};
  svg { width: 13px; height: 13px; }
  &:hover { opacity: 1; background: ${p => p.theme.colors.base[300]}; }
`;

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — ATTACHMENT PICKER (self-contained)
// ─────────────────────────────────────────────────────────────
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
const InheritDesc = styled.div`font-size: 0.775rem; opacity: 0.55; margin-top: 0.15rem; line-height: 1.4;`;

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
  max-height: 160px; overflow-y: auto;
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
const SBtn = styled.button<{ theme: any }>`
  padding: 0.65rem 1.4rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer;
  background: ${p => p.theme.colors.primary.main};
  color: ${p => p.theme.colors.primary.content};
  transition: all 0.15s;
  &:hover:not(:disabled) { opacity: 0.88; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — GENERATE BUTTON
// ─────────────────────────────────────────────────────────────
const GenBtn = styled.button<{ theme: any; $disabled?: boolean }>`
  display: inline-flex; align-items: stretch; position: relative;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.primary.main};
  background: transparent; padding: 0; cursor: ${p => p.$disabled ? 'not-allowed' : 'pointer'};
  opacity: ${p => p.$disabled ? 0.6 : 1}; overflow: visible; transition: all 0.15s;
  &:hover:not([disabled]) { box-shadow: 0 3px 10px ${p => p.theme.colors.primary.main}33; }
`;
const GenBtnLeft = styled.span<{ theme: any }>`
  display: flex; align-items: center; gap: 0.45rem;
  padding: 0.45rem 0.75rem; color: ${p => p.theme.colors.primary.main};
  font-size: 0.8rem; font-weight: 600; white-space: nowrap;
`;
const GenBtnIcon = styled.span`display: flex; align-items: center; flex-shrink: 0;`;
const GenBtnLabel = styled.span``;
const GenBtnDivider = styled.span<{ theme: any }>`
  width: 1px; background: ${p => p.theme.colors.primary.main}40; flex-shrink: 0;
`;
const GenBtnChevron = styled.span<{ theme: any; $open: boolean }>`
  display: flex; align-items: center; justify-content: center; padding: 0 0.45rem;
  color: ${p => p.theme.colors.primary.main};
  transition: transform 0.15s;
  transform: ${p => p.$open ? 'rotate(180deg)' : 'rotate(0deg)'};
  svg { width: 12px; height: 12px; }
`;
const GenDropItem = styled.button<{ theme: any; $active?: boolean }>`
  width: 100%; padding: 0.55rem 0.875rem;
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.8rem; font-weight: 500; border: none; cursor: pointer; text-align: left;
  background: ${p => p.$active ? p.theme.colors.primary.main + '14' : 'transparent'};
  color: ${p => p.theme.colors.base.content};
  transition: background 0.1s;
  &:hover { background: ${p => p.theme.colors.base[300]}; }
  svg { width: 13px; height: 13px; flex-shrink: 0; }
`;

// ─────────────────────────────────────────────────────────────
// SEND SPLIT BUTTON (mobile only)
// Primary action: Send Now. Dropdown: Schedule, Draft
// ─────────────────────────────────────────────────────────────
const SendSplitBtn: React.FC<{
  theme: any;
  acting: string | null;
  onSend: () => void;
  onSchedule: () => void;
  onDraft: () => void;
  fullWidth?: boolean;
}> = ({ theme, acting, onSend, onSchedule, onDraft, fullWidth }) => {
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
    const rect = chevronRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < 110;
      setMenuPos({ top: openUpward ? rect.top : rect.bottom + 4, left: rect.right, openUpward });
    }
    setOpen(v => !v);
  };

  const disabled = !!acting;

  // Send icon
  const SendIco = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
  // Schedule icon
  const SchedIco = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
  // Draft icon
  const DraftIco = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );

  return (
    <div style={{ display: 'inline-flex', alignItems: 'stretch', position: 'relative',
      width: fullWidth ? '100%' : undefined,
      borderRadius: theme.radius.field,
      border: `1px solid ${theme.colors.primary.main}`,
      opacity: disabled ? 0.6 : 1,
      overflow: 'visible',
    }}>
      {/* Left: Send Now */}
      <button
        onClick={() => !disabled && onSend()}
        disabled={disabled}
        style={{
          flex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
          padding: '0.55rem 0.85rem',
          background: theme.colors.primary.main,
          color: theme.colors.primary.content,
          border: 'none', borderRadius: `${theme.radius.field} 0 0 ${theme.radius.field}`,
          fontSize: '0.8rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {acting === 'send'
          ? <ESpinner style={{ width: 13, height: 13, borderWidth: 2, borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} />
          : <SendIco />
        }
        Send
      </button>

      {/* Divider */}
      <div style={{ width: 1, background: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />

      {/* Right: chevron dropdown */}
      <span
        ref={chevronRef}
        onClick={openMenu}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 0.5rem',
          background: theme.colors.primary.main,
          color: theme.colors.primary.content,
          borderRadius: `0 ${theme.radius.field} ${theme.radius.field} 0`,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'opacity 0.15s',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="11" height="11"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </span>

      {/* Dropdown portal */}
      {open && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'fixed',
            top: menuPos.openUpward ? menuPos.top : menuPos.top,
            left: menuPos.left,
            transform: menuPos.openUpward
              ? 'translateX(-100%) translateY(-100%)'
              : 'translateX(-100%)',
            zIndex: 9999,
            background: theme.colors.base[200],
            border: `1px solid ${theme.colors.base[300]}`,
            borderRadius: theme.radius.field,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            minWidth: 140, overflow: 'hidden',
          }}>
            <GenDropItem theme={theme} onClick={() => { onSchedule(); setOpen(false); }}>
              <SchedIco /> Schedule
            </GenDropItem>
            <GenDropItem theme={theme} onClick={() => { onDraft(); setOpen(false); }}>
              <DraftIco /> Save as Draft
            </GenDropItem>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
const CheckSmallIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const PaperclipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);
const HtmlIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);
const TemplateIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const getExt = (filename: string) => filename.split('.').pop()?.toLowerCase() || '';

// ─────────────────────────────────────────────────────────────
// REGENERATE DROPDOWN
// ─────────────────────────────────────────────────────────────
const RegenDropdown: React.FC<{
  theme: any;
  acting: boolean;
  hasTemplateEmail: boolean;
  onRegenerate: (queryType: 'plain' | 'html' | 'template') => void;
  fullWidth?: boolean;
}> = ({ theme, acting, hasTemplateEmail, onRegenerate, fullWidth }) => {
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
    const rect = chevronRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < 96;
      setMenuPos({ top: openUpward ? rect.top : rect.bottom + 4, left: rect.right, openUpward });
    }
    setOpen(v => !v);
  };

  return (
    <GenBtn theme={theme} $disabled={acting} style={fullWidth ? { width: '100%' } : undefined}>
      <GenBtnLeft theme={theme} style={fullWidth ? { flex: 1, justifyContent: 'center' } : undefined} onClick={() => !acting && onRegenerate('plain')}>
        <GenBtnIcon>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </GenBtnIcon>
        <GenBtnLabel>Plain Text</GenBtnLabel>
      </GenBtnLeft>
      <GenBtnDivider theme={theme} />
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
            zIndex: 9999, background: theme.colors.base[200],
            border: `1px solid ${theme.colors.base[300]}`,
            borderRadius: theme.radius.field,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            minWidth: 130, overflow: 'hidden',
          }}>
            <GenDropItem theme={theme} onClick={e => { e.stopPropagation(); onRegenerate('html'); setOpen(false); }}>
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
const EmailModal: React.FC<EmailModalProps> = ({
  isOpen, company, campaignId, theme, apiBase, onClose, onToast,
  hasTemplateEmail, initialHtmlEmail = false, initialQueryType,
}) => {
  type ETab = 'email' | 'attachments';
  const [activeTab, setActiveTab]   = useState<ETab>('email');
  const [phase, setPhase]           = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMsg, setLoadingMsg] = useState('Loading email…');
  const [email, setEmail]           = useState<EmailData | null>(null);
  const [subject, setSubject]       = useState('');
  const [body, setBody]             = useState('');
  const [acting, setActing]         = useState<string | null>(null);
  const [htmlEmail, setHtmlEmail]   = useState(false);
  const htmlEmailRef                = useRef(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const dragStateRef = useRef<{ dragging: boolean; startX: number; startRatio: number; containerW: number }>({ dragging: false, startX: 0, startRatio: 0.5, containerW: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<'email' | 'preview'>('email');

  // Reset mobileView when html mode changes or a new email opens
  useEffect(() => { setMobileView('email'); }, [htmlEmail, email?.id]);

  useEffect(() => { if (!htmlEmail) setSplitRatio(0.5); }, [htmlEmail]);

  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const containerW = containerRef.current?.offsetWidth ?? 800;
    dragStateRef.current = { dragging: true, startX: e.clientX, startRatio: splitRatio, containerW };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const cleanup = () => {
      dragStateRef.current.dragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.getSelection()?.removeAllRanges();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragStateRef.current.dragging) return;
      if (ev.buttons === 0) { cleanup(); return; }
      const { startX, startRatio, containerW: cW } = dragStateRef.current;
      const newRatio = Math.min(0.85, Math.max(0.15, startRatio - (ev.clientX - startX) / cW));
      setSplitRatio(newRatio);
    };
    const onUp = () => cleanup();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const [showSched, setShowSched] = useState(false);
  const [schedTime, setSchedTime] = useState('');
  const schedInputRef = useRef<HTMLInputElement>(null);

  // ── Attachment state ──────────────────────────────────────────────────────────
  const [allAttachments,       setAllAttachments]      = useState<AttachmentOption[]>([]);
  const [linkedEmailAttachIds, setLinkedEmailAttachIds] = useState<Set<number>>(new Set());
  const [attachSearch,         setAttachSearch]        = useState('');
  const [_attachSaving,         _setAttachSaving]        = useState(false);
  const [attachLoading,        setAttachLoading]       = useState(false);
  const [uploadFile,           setUploadFile]          = useState<File | null>(null);
  const [uploading,            setUploading]           = useState(false);
  const [isDragOver,           setIsDragOver]          = useState(false);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const [inheritCampaignAttachments, setInheritCampaignAttachments] = useState(1);
  const [inheritSaving,              setInheritSaving]              = useState(false);
  const [inheritedAttachments,       setInheritedAttachments]       = useState<AttachmentEntry[]>([]);
  const [brandSignature,             setBrandSignature]             = useState<string | null>(null);
  const [brandLogoData,              setBrandLogoData]              = useState<string | null>(null);

  // ── Reset + load on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !company) return;
    setActiveTab('email');
    setPhase('loading');
    setLoadingMsg('Loading email…');
    setActing(null);
    setShowSched(false);
    setSchedTime('');
    setHtmlEmail(initialHtmlEmail);
    htmlEmailRef.current = initialHtmlEmail;
    setAttachSearch('');
    setUploadFile(null);
    setIsDragOver(false);
    if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
    loadPrimaryEmail();
    loadAllAttachments();
  }, [isOpen, company?.id]);

  const loadAllAttachments = async () => {
    setAttachLoading(true);
    try {
      const res = await apiFetch(`${apiBase}/attachments/?page=1&page_size=200`);
      if (res.ok) {
        const d = await res.json();
        const list = d.attachments ?? [];
        setAllAttachments(list);
      }
    } catch { /* silent */ } finally { setAttachLoading(false); }
  };

  const saveInheritFlag = async (val: number) => {
    if (!company) return;
    setInheritSaving(true);
    try {
      await apiFetch(`${apiBase}/campaign/${campaignId}/company/inherit/bulk/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ company_id: company.id, inherit_campaign_attachments: val }] }),
      });
    } catch { /* silent */ } finally { setInheritSaving(false); }
  };

  const loadPrimaryEmail = async () => { if (company) await generateEmail(null); };

  const populateEmail = (d: EmailData) => {
    setEmail(d);
    setSubject(d.email_subject || '');
    setBody(d.email_content || '');
    setHtmlEmail(!!(d.html_email));
    // own_attachments: files directly linked to this email (checkboxes in the picker)
    setLinkedEmailAttachIds(new Set<number>((d.own_attachments ?? []).map(a => a.id)));
    // inherited_attachments: always an array — [] if nothing configured
    setInheritedAttachments(d.inherited_attachments ?? []);
    setInheritCampaignAttachments(d.inherit_campaign_attachments ?? 1);
    setBrandSignature(d.signature ?? null);
    setBrandLogoData(d.logo_data ?? null);
    setPhase('ready');
  };

  const generateEmail = async (queryType: 'plain' | 'html' | 'template' | null) => {
    if (!company) return;
    const isInitialLoad = queryType === null;
    const resolvedType: 'plain' | 'html' | 'template' = queryType ?? (
      initialQueryType === 'template' ? 'template' :
      (initialQueryType === 'html' || htmlEmailRef.current) ? 'html' : 'plain'
    );
    setPhase('loading');
    setLoadingMsg(isInitialLoad ? 'Loading email…' : resolvedType === 'template' ? 'Generating from template…' : `Generating ${resolvedType === 'html' ? 'HTML' : 'plain'} email…`);
    try {
      const genRes = await apiFetch(`${apiBase}/email/campaign/${campaignId}/bulk-generate/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_ids: [company.id], query_type: resolvedType, force: !isInitialLoad }),
      });
      if (!genRes.ok) {
        const e = await genRes.json();
        onToast('error', 'Generation Failed', e.detail || 'Failed to generate email');
        if (isInitialLoad) { onClose(); return; }
        setPhase('ready'); return;
      }
      const genData = await genRes.json();
      if (genData.generated === 0) {
        const reason = genData.errors?.[0]?.reason || 'Failed to generate email';
        onToast('error', 'Generation Failed', reason);
        if (isInitialLoad) { onClose(); return; }
        setPhase('ready'); return;
      }
      const primRes = await apiFetch(`${apiBase}/email/campaign/${campaignId}/primaries/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_ids: [company.id] }),
      });
      if (primRes.ok) {
        const pd = await primRes.json();
        const d = pd.primaries?.[0];
        if (d) { populateEmail(d); }
        else { if (isInitialLoad) { onClose(); return; } setPhase('error'); }
      } else { if (isInitialLoad) { onClose(); return; } setPhase('error'); }
    } catch (err) {
      onToast('error', 'Error', err instanceof Error ? err.message : 'Generation failed');
      if (isInitialLoad) { onClose(); return; }
      setPhase('error');
    }
  };

  const saveEdits = async (): Promise<boolean> => {
    if (!email) return false;
    try {
      const res = await apiFetch(`${apiBase}/email/bulk-update/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ email_id: email.id, email_subject: subject, email_content: body }] }),
      });
      return res.ok;
    } catch { return false; }
  };

  const handleSend = async () => {
    if (!email || acting) return;
    setActing('send'); await saveEdits();
    try {
      const res = await apiFetch(`${apiBase}/email/bulk-send/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_ids: [email.id] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Send failed');
      if (d.sent > 0) { onToast('success', 'Email Sent', `Email sent to ${company?.email}`); onClose(); }
      else throw new Error(d.errors?.[0]?.reason || 'Failed to send');
    } catch (err) {
      onToast('error', 'Send Failed', err instanceof Error ? err.message : 'Failed to send');
    } finally { setActing(null); }
  };

  const handleSchedule = async () => {
    if (!email || acting || !schedTime) return;
    setActing('schedule'); await saveEdits();
    try {
      const res = await apiFetch(`${apiBase}/email/bulk-send/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_ids: [email.id], time: new Date(schedTime).toISOString() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Schedule failed');
      if (d.sent > 0) { onToast('success', 'Email Scheduled', `Email scheduled for ${company?.email}`); onClose(); }
      else throw new Error(d.errors?.[0]?.reason || 'Failed to schedule');
    } catch (err) {
      onToast('error', 'Schedule Failed', err instanceof Error ? err.message : 'Failed to schedule');
    } finally { setActing(null); }
  };

  const handleDraft = async () => {
    if (!email || acting) return;
    setActing('draft'); await saveEdits();
    try {
      const res = await apiFetch(`${apiBase}/email/draft/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_ids: [email.id] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Draft failed');
      if (d.drafted > 0) { onToast('success', 'Draft Saved', `Draft saved for ${company?.email}`); onClose(); }
      else throw new Error(d.errors?.[0]?.reason || 'Failed to save draft');
    } catch (err) {
      onToast('error', 'Draft Failed', err instanceof Error ? err.message : 'Failed to save draft');
    } finally { setActing(null); }
  };

  // ── Attachment helpers ────────────────────────────────────────────────────────
  const handleAttachFilePick = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { onToast('error', 'Attachments', 'File size must be less than 5MB'); return; }
    setUploadFile(file);
  };

  const handleAttachUpload = async () => {
    if (!uploadFile || !email) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const uploadRes = await apiFetch(`${apiBase}/attachment/`, { method: 'POST', body: formData });
      if (!uploadRes.ok) { const e = await uploadRes.json(); throw new Error(e.detail || 'Upload failed'); }
      const uploadData = await uploadRes.json();
      const newId: number = uploadData.id;
      const newIds = Array.from(new Set([...Array.from(linkedEmailAttachIds), newId]));
      const attachRes = await apiFetch(`${apiBase}/email/bulk-attachments/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ email_id: email.id, attachment_ids: newIds }] }),
      });
      if (attachRes.ok) setLinkedEmailAttachIds(new Set(newIds));
      await loadAllAttachments();
      setUploadFile(null);
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
    } catch (err) {
      onToast('error', 'Upload Failed', err instanceof Error ? err.message : 'Upload failed');
    } finally { setUploading(false); }
  };

  const toggleAttachment = async (id: number) => {
    if (!email) return;
    const next = new Set(linkedEmailAttachIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setLinkedEmailAttachIds(next);
    try {
      await apiFetch(`${apiBase}/email/bulk-attachments/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ email_id: email.id, attachment_ids: Array.from(next) }] }),
      });
    } catch { /* silent */ }
  };

  // ── Derived lists ─────────────────────────────────────────────────────────────
  // Merge own_attachments into allAttachments entries so the "Attached" section
  // always shows correctly even if the /attachments/ list hasn't loaded yet.
  const ownAttachEntries: AttachmentOption[] = email?.own_attachments
    ? email.own_attachments
        .filter(a => !allAttachments.some(x => x.id === a.id))
        .map(a => ({ id: a.id, filename: a.name, file_size: 0 }))
    : [];
  const mergedAttachments   = [...allAttachments, ...ownAttachEntries];
  // Inherited attachment IDs should not appear in the email-level picker at all —
  // they are already shown in the "Include campaign attachments" section above.
  const filteredAttachments = mergedAttachments.filter(a => a.filename.toLowerCase().includes(attachSearch.toLowerCase()));
  const attachedFiles       = filteredAttachments.filter(a =>  linkedEmailAttachIds.has(a.id));
  const notAttachedFiles    = filteredAttachments.filter(a => !linkedEmailAttachIds.has(a.id));


  if (!company) return null;

  const handleClose = () => { if (email) saveEdits(); onClose(); };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <EmailModalBackdrop $open={isOpen} onClick={handleClose} />
      <EmailModalWrap $open={isOpen} onClick={handleClose}>
        <EmailModalBox theme={theme} $open={isOpen} $wide={htmlEmail && activeTab === 'email' && !isMobile} onClick={e => e.stopPropagation()}>

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

          {/* Tab bar */}
          {phase === 'ready' && (
            <ETabBar theme={theme}>
              <ETabBtn theme={theme} $active={activeTab === 'email'} onClick={() => setActiveTab('email')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                Email
              </ETabBtn>
              <ETabBtn theme={theme} $active={activeTab === 'attachments'} onClick={() => setActiveTab('attachments')}>
                <PaperclipIcon />
                Attachments
                {linkedEmailAttachIds.size > 0 && (
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, background: theme.colors.primary.main + '20', color: theme.colors.primary.main, border: `1px solid ${theme.colors.primary.main}40`, borderRadius: '999px', padding: '1px 6px', marginLeft: '1px' }}>
                    {linkedEmailAttachIds.size}
                  </span>
                )}
              </ETabBtn>

              {/* Mobile-only Edit ↔ Preview toggle — shown when HTML mode is on */}
              {isMobile && htmlEmail && activeTab === 'email' && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: '0.75rem', gap: '0.25rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    background: theme.colors.base[400],
                    border: `1px solid ${theme.colors.base[300]}`,
                    borderRadius: '999px',
                    padding: '0.2rem',
                    gap: '0.15rem',
                  }}>
                    {(['email', 'preview'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setMobileView(v)}
                        style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: '999px',
                          border: 'none',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          background: mobileView === v ? theme.colors.primary.main : 'transparent',
                          color: mobileView === v ? theme.colors.primary.content : theme.colors.base.content,
                          opacity: mobileView === v ? 1 : 0.5,
                        }}
                      >
                        {v === 'email' ? 'Edit' : 'Preview'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </ETabBar>
          )}

          {/* Body */}
          <EmailModalBody>

            {phase === 'loading' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', opacity: 0.6 }}>
                <ESpinner />
                <div style={{ fontSize: '0.875rem' }}>{loadingMsg}</div>
              </div>
            )}

            {phase === 'error' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', color: theme.colors.error.main }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠️</div>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Failed to load email</div>
                <button onClick={() => generateEmail(null)} style={{ padding: '0.5rem 1.2rem', borderRadius: theme.radius.field, border: 'none', background: theme.colors.primary.main, color: theme.colors.primary.content, cursor: 'pointer', fontWeight: 600 }}>
                  Retry
                </button>
              </div>
            )}

            {/* ── EMAIL TAB ── */}
            {phase === 'ready' && activeTab === 'email' && (
              <div ref={containerRef} style={{
                flex: 1, minHeight: 0, display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                overflow: isMobile ? 'auto' : 'hidden',
              }}>

                {/* Editor column — hidden on mobile when previewing */}
                {(!isMobile || mobileView === 'email') && (
                <EScroll style={{ flex: isMobile ? '1 1 auto' : 1, minWidth: 0, overflowY: isMobile ? 'visible' : 'auto' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <EFieldLabel theme={theme} style={{ margin: 0 }}>Subject</EFieldLabel>
                      {/* HTML toggle — inline with Subject label */}
                      <div
                        onClick={() => {
                          const next = !htmlEmail;
                          setHtmlEmail(next);
                          htmlEmailRef.current = next;
                          if (email) {
                            apiFetch(`${apiBase}/email/bulk-update/`, {
                              method: 'PUT', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ updates: [{ email_id: email.id, html_email: next }] }),
                            }).catch(() => {});
                          }
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>HTML</span>
                        <div style={{ width: 32, height: 18, borderRadius: 999, flexShrink: 0, background: htmlEmail ? theme.colors.primary.main : theme.colors.base[300], position: 'relative', transition: 'background 0.2s', border: `1px solid ${htmlEmail ? theme.colors.primary.main : theme.colors.base[300]}` }}>
                          <div style={{ position: 'absolute', top: 2, left: htmlEmail ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </div>
                      </div>
                    </div>
                    <ESubjectInput theme={theme} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject…" />
                  </div>
                  <div>
                    <EFieldLabel theme={theme}>Body</EFieldLabel>
                    <EBodyTextarea theme={theme} value={body} onChange={e => setBody(e.target.value)} placeholder="Email body…" />
                  </div>

                  {/* ── Signature (read-only) ── */}
                  {brandSignature && (
                    <div>
                      <EFieldLabel theme={theme}>Signature</EFieldLabel>
                      <div style={{
                        padding: '0.65rem 0.9rem',
                        border: `1px solid ${theme.colors.base[300]}`,
                        borderRadius: theme.radius.field,
                        background: theme.colors.base[400],
                        fontSize: '0.875rem', lineHeight: 1.6,
                        whiteSpace: 'pre-wrap', opacity: 0.8,
                      }}>
                        {brandSignature}
                      </div>
                    </div>
                  )}

                  {/* ── Logo (read-only) ── */}
                  {brandLogoData && (
                    <div>
                      <EFieldLabel theme={theme}>Logo</EFieldLabel>
                      <div style={{
                        padding: '0.65rem 0.9rem',
                        border: `1px solid ${theme.colors.base[300]}`,
                        borderRadius: theme.radius.field,
                        background: theme.colors.base[400],
                      }}>
                        <img src={brandLogoData} alt="Logo" style={{ maxHeight: 48, maxWidth: 180, objectFit: 'contain', display: 'block' }} />
                      </div>
                    </div>
                  )}
                </EScroll>
                )}

                {/* Drag divider — desktop only */}
                {htmlEmail && !isMobile && (
                  <div onMouseDown={onDividerMouseDown} style={{ width: 6, flexShrink: 0, cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }}>
                    <div style={{ width: 2, height: '40px', borderRadius: 2, background: theme.colors.base[300] }} />
                  </div>
                )}

                {/* Preview — side panel on desktop, full-pane on mobile when mobileView === 'preview' */}
                {htmlEmail && (!isMobile || mobileView === 'preview') && (
                  <div style={isMobile ? {
                    flex: '1 1 auto', display: 'flex', flexDirection: 'column', padding: '1rem',
                  } : {
                    width: `${splitRatio * 100}%`, flexShrink: 0,
                    display: 'flex', flexDirection: 'column',
                    padding: '1.5rem 1.5rem 1.5rem 0.75rem', overflow: 'hidden',
                  }}>
                    {!isMobile && (
                      <EFieldLabel theme={theme} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
                        </svg>
                        Live Preview
                      </EFieldLabel>
                    )}
                    <div style={{
                      flex: 1, minHeight: isMobile ? 0 : 200,
                      border: `1px solid ${theme.colors.base[300]}`,
                      borderRadius: theme.radius.field,
                      overflow: 'hidden', background: '#fff',
                    }}>
                      {body.trim() ? (
                        <iframe
                          key={body}
                          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:14px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#111;word-break:break-word;}img{max-width:100%;height:auto;}a{color:#6366f1;}</style></head><body>${body}</body></html>`}
                          style={{ width: '100%', height: '100%', border: 'none', display: 'block', minHeight: 200 }}
                          sandbox="allow-same-origin"
                          title="Email HTML Preview"
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, fontSize: '0.75rem', opacity: 0.35, fontStyle: 'italic' }}>
                          Preview will appear here…
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ATTACHMENTS TAB ── */}
            {phase === 'ready' && activeTab === 'attachments' && (
              <EScrollFlush>
                {/* ── Include campaign attachments toggle ── */}
                <InheritRow
                  theme={theme}
                  onClick={() => { const v = inheritCampaignAttachments ? 0 : 1; setInheritCampaignAttachments(v); saveInheritFlag(v); }}
                  style={(() => {
                    const hasInherited = !!inheritCampaignAttachments;
                    return {
                      marginBottom: hasInherited ? '0' : '1.25rem',
                      borderRadius: hasInherited ? `${theme.radius?.field ?? '8px'} ${theme.radius?.field ?? '8px'} 0 0` : undefined,
                    };
                  })()}
                >
                  <InheritCheckbox theme={theme} $on={!!inheritCampaignAttachments}>
                    <CheckSmallIcon />
                  </InheritCheckbox>
                  <InheritText>
                    <InheritTitle>Include campaign attachments</InheritTitle>
                    <InheritDesc>Include attachments from campaign preferences when this email is sent</InheritDesc>
                  </InheritText>
                  {inheritSaving && <ESpinner style={{ width: 14, height: 14, borderWidth: 2, flexShrink: 0 }} />}
                </InheritRow>

                {/* ── Campaign attachments list (shown when toggle ON) ── */}
                {!!inheritCampaignAttachments && (() => {
                  if (attachLoading) return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderTop: 'none', borderRadius: `0 0 ${theme.radius?.field ?? '8px'} ${theme.radius?.field ?? '8px'}`, fontSize: '0.8rem', opacity: 0.5, marginBottom: '1.25rem' }}>Loading…</div>
                  );

                  // inheritedAttachments comes directly from the server — no cross-referencing needed.
                  // null  = toggle is OFF (shouldn't reach here but guard anyway)
                  // []    = toggle ON but nothing configured at campaign/global level
                  // [...] = the actual list with source tags
                  const inherited = inheritedAttachments;

                  if (inherited.length === 0) return (
                    <div style={{ borderTop: 'none', border: `1px solid ${theme.colors.base[300]}`, borderRadius: `0 0 ${theme.radius?.field ?? '8px'} ${theme.radius?.field ?? '8px'}`, padding: '0.85rem 0.75rem', fontSize: '0.8125rem', opacity: 0.5, marginBottom: '1.25rem', background: theme.colors.base[200] }}>
                      No campaign attachments configured
                    </div>
                  );
                  return (
                    <div style={{
                      border: `1px solid ${theme.colors.base[300]}`,
                      borderTop: `1px solid ${theme.colors.base[300]}`,
                      borderRadius: `0 0 ${theme.radius?.field ?? '8px'} ${theme.radius?.field ?? '8px'}`,
                      marginBottom: '1.25rem',
                      background: theme.colors.base[300] + '60',
                      flexShrink: 0,
                    }}>
                      {inherited.map((att, i) => {
                        const ext = getExt(att.name);
                        const meta = allAttachments.find(a => a.id === att.id);
                        const sizeKb = meta?.file_size ? `${(meta.file_size / 1024).toFixed(0)} KB` : '';
                        return (
                          <div key={att.id} style={{
                            display: 'flex', alignItems: 'center', gap: '0.6rem',
                            padding: '0.55rem 0.75rem', fontSize: '0.8125rem',
                            borderBottom: i < inherited.length - 1 ? `1px solid ${theme.colors.base[300]}` : 'none',
                          }}>
                            <AttachExtBadge $ext={ext}>{ext || '?'}</AttachExtBadge>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <AttachName>{att.name}</AttachName>
                              {sizeKb && <div style={{ fontSize: '0.7rem', opacity: 0.45, marginTop: '1px' }}>{sizeKb}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                              {(att.sources ?? [att.source]).includes('campaign') && (
                                <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '1px 6px', borderRadius: '999px', background: theme.colors.primary.main + '18', color: theme.colors.primary.main, border: `1px solid ${theme.colors.primary.main}30` }}>campaign</span>
                              )}
                              {(att.sources ?? [att.source]).includes('global') && (
                                <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '1px 6px', borderRadius: '999px', background: theme.colors.base[300], color: theme.colors.base.content, border: `1px solid ${theme.colors.base[300]}`, opacity: 0.8 }}>global</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ── Divider ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem' }}>
                  <div style={{ flex: 1, height: 1, background: theme.colors.base[300] }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.35 }}>Email Attachments</span>
                  <div style={{ flex: 1, height: 1, background: theme.colors.base[300] }} />
                </div>

                {/* ── Upload zone — always shown ── */}
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
                      padding: '0.9rem 1.1rem', cursor: uploading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.85rem',
                      opacity: uploading ? 0.65 : 1,
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: uploadFile ? theme.colors.primary.main + '15' : theme.colors.base[300], display: 'flex', alignItems: 'center', justifyContent: 'center', color: uploadFile ? theme.colors.primary.main : theme.colors.base.content, opacity: uploadFile ? 1 : 0.4 }}>
                      {uploadFile ? (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      ) : (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
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
                        onClick={e => { e.stopPropagation(); setUploadFile(null); if (uploadFileInputRef.current) uploadFileInputRef.current.value = ''; }}
                        style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, border: `1px solid ${theme.colors.base[300]}`, background: theme.colors.base[100], color: theme.colors.base.content, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', opacity: 0.6 }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = theme.colors.error.main; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = theme.colors.base[100]; e.currentTarget.style.color = theme.colors.base.content; }}
                      >✕</button>
                    )}
                    <input ref={uploadFileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachFilePick(f); }} disabled={uploading} />
                  </div>
                  {uploadFile && (
                    <div style={{ marginTop: '0.6rem' }}>
                      <SBtn theme={theme} onClick={handleAttachUpload} disabled={uploading} style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}>
                        {uploading ? 'Uploading…' : 'Upload & Attach'}
                      </SBtn>
                    </div>
                  )}
                </div>

                <div style={{ height: 1, background: theme.colors.base[300], marginBottom: '1rem' }} />

                {/* ── Attached / Not Attached lists — always shown ── */}
                {attachLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', opacity: 0.5, fontSize: '0.875rem' }}>Loading attachments…</div>
                ) : mergedAttachments.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', gap: '0.5rem', opacity: 0.5 }}>
                    <PaperclipIcon />
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>No files uploaded yet</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>Use the upload area above to add your first file.</div>
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}>
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <AttachPickerSearch theme={theme} placeholder="Search attachments…" value={attachSearch} onChange={e => setAttachSearch(e.target.value)} style={{ paddingLeft: '2rem' }} />
                    </div>

                    {/* Attached */}
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}>
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.colors.primary.main }}>Attached to Email</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, background: theme.colors.primary.main + '20', color: theme.colors.primary.main, border: `1px solid ${theme.colors.primary.main}40`, borderRadius: '999px', padding: '1px 6px' }}>{attachedFiles.length}</span>
                        {attachedFiles.length > 0 && (
                          <button
                            onClick={async () => {
                              setLinkedEmailAttachIds(new Set());
                              if (email) { try { await apiFetch(`${apiBase}/email/bulk-attachments/`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: [{ email_id: email.id, attachment_ids: [] }] }) }); } catch { /* silent */ } }
                            }}
                            style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.base.content, opacity: 0.4, padding: '2px 6px', borderRadius: '4px' }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                          >Detach all</button>
                        )}
                      </div>
                      <AttachList theme={theme}>
                        {attachedFiles.length === 0 ? (
                          <AttachEmpty theme={theme}>{attachSearch ? `No attached files match "${attachSearch}"` : 'No files attached — check items below to attach them'}</AttachEmpty>
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

                    {/* Not Attached */}
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.45 }}>Not Attached</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, background: theme.colors.base[300], borderRadius: '999px', padding: '1px 6px', opacity: 0.55 }}>{notAttachedFiles.length}</span>
                      </div>
                      <AttachList theme={theme}>
                        {notAttachedFiles.length === 0 ? (
                          <AttachEmpty theme={theme}>{attachSearch ? `No unattached files match "${attachSearch}"` : 'All files are attached'}</AttachEmpty>
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

                    <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>
                      {filteredAttachments.length < mergedAttachments.length
                        ? `Showing ${filteredAttachments.length} of ${mergedAttachments.length} files`
                        : `${mergedAttachments.length} file${mergedAttachments.length !== 1 ? 's' : ''} total`}
                    </div>
                  </>
                )}
              </EScrollFlush>
            )}

          </EmailModalBody>

          {/* Footer — email tab only */}
          {phase === 'ready' && activeTab === 'email' && (
            <EmailModalFoot theme={theme}>
              {acting === 'regenerate' && <ESpinner style={{ width: 16, height: 16, borderWidth: 2 }} />}
              {showSched ? (
                <>
                  <RegenDropdown theme={theme} acting={!!acting} hasTemplateEmail={!!hasTemplateEmail} onRegenerate={generateEmail} />
                  <input
                    ref={schedInputRef}
                    type="datetime-local"
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    value={schedTime}
                    onChange={e => setSchedTime(e.target.value)}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, background: theme.colors.base[200], color: theme.colors.base.content, boxSizing: 'border-box' as const }}
                  />
                  <EActionBtn theme={theme} disabled={!!acting} onClick={() => { setShowSched(false); setSchedTime(''); }}>Cancel</EActionBtn>
                  <EActionBtn theme={theme} $variant="warning" disabled={!schedTime || !!acting} onClick={handleSchedule}>
                    {acting === 'schedule' ? <ESpinner style={{ width: 14, height: 14, borderWidth: 2 }} /> : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    )}
                    Confirm
                  </EActionBtn>
                </>
              ) : isMobile ? (
                /* Mobile: regen left, send right — equal width so chevrons align */
                <div style={{ display: 'flex', width: '100%', gap: '0.5rem' }}>
                  <div style={{ flex: 1, display: 'flex' }}>
                    <RegenDropdown theme={theme} acting={!!acting} hasTemplateEmail={!!hasTemplateEmail} onRegenerate={generateEmail} fullWidth />
                  </div>
                  <div style={{ flex: 1, display: 'flex' }}>
                    <SendSplitBtn
                      theme={theme}
                      acting={acting}
                      onSend={handleSend}
                      onSchedule={() => { setShowSched(true); setTimeout(() => schedInputRef.current?.focus(), 80); }}
                      onDraft={handleDraft}
                      fullWidth
                    />
                  </div>
                </div>
              ) : (
                /* Desktop: regen + three separate buttons */
                <>
                  <RegenDropdown theme={theme} acting={!!acting} hasTemplateEmail={!!hasTemplateEmail} onRegenerate={generateEmail} />
                  {acting === 'regenerate' && <ESpinner style={{ width: 16, height: 16, borderWidth: 2 }} />}
                  <EActionBtn theme={theme} disabled={!!acting} onClick={handleDraft}>
                    {acting === 'draft' ? <ESpinner style={{ width: 14, height: 14, borderWidth: 2 }} /> : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                      </svg>
                    )}
                    Draft
                  </EActionBtn>
                  <EActionBtn theme={theme} disabled={!!acting} onClick={() => { setShowSched(true); setTimeout(() => schedInputRef.current?.focus(), 80); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Schedule
                  </EActionBtn>
                  <EActionBtn theme={theme} $variant="primary" disabled={!!acting} onClick={handleSend}>
                    {acting === 'send' ? <ESpinner style={{ width: 14, height: 14, borderWidth: 2 }} /> : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    )}
                    Send
                  </EActionBtn>
                </>
              )}
            </EmailModalFoot>
          )}

        </EmailModalBox>
      </EmailModalWrap>
    </>
  );
};

export default EmailModal;