/**
 * CampaignPreferenceModal.tsx
 * Segregated from Campaign.tsx
 *
 * Contains:
 *   - All styled components exclusive to the Campaign Settings / Preferences modal
 *   - TemplateGenDropdown helper component
 *   - CampaignSettingsModal component (exported)
 *   - Supporting types: CsTab, CampaignSettingsModalProps
 */

import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { apiFetch } from '../../App';

// ─────────────────────────────────────────────────────────────
// RE-USED TYPES (import these from a shared types file if you have one)
// ─────────────────────────────────────────────────────────────
interface CampaignPreferences {
  bcc: string;
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

// ─────────────────────────────────────────────────────────────
// ANIMATIONS (shared — import from a central animations file if desired)
// ─────────────────────────────────────────────────────────────
const spin       = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const contentFade = keyframes`from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}`;

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — MODAL SHELL
// ─────────────────────────────────────────────────────────────
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
const CsModal = styled.div<{ theme: any; $open: boolean; $wide?: boolean }>`
  width: 100%; max-width: ${p => p.$wide ? '1200px' : '860px'};
  height: min(700px, calc(100vh - 3rem));
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: 16px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.4);
  display: flex; flex-direction: column; overflow: hidden;
  opacity: ${p => p.$open ? 1 : 0};
  transform: ${p => p.$open ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(16px)'};
  transition: opacity 0.25s ease, transform 0.25s ease, max-width 0.25s ease;
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

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — LEFT SIDEBAR NAV
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — TAB CONTENT PANEL
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — SETTINGS FORM FIELDS
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — INHERITANCE TOGGLE ROWS
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
const InheritDesc  = styled.div`font-size: 0.775rem; opacity: 0.55; margin-top: 0.15rem; line-height: 1.4;`;

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — ATTACHMENT PICKER
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — GENERATE BUTTON (shared with CompanyGenBtn)
// ─────────────────────────────────────────────────────────────
const GenBtn = styled.button<{ theme: any; $disabled?: boolean }>`
  display: inline-flex; align-items: stretch; position: relative;
  border-radius: ${(p: any) => p.theme.radius.field};
  border: 1px solid ${(p: any) => p.theme.colors.primary.main};
  background: transparent; padding: 0; cursor: ${(p: any) => p.$disabled ? 'not-allowed' : 'pointer'};
  opacity: ${(p: any) => p.$disabled ? 0.6 : 1};
  overflow: visible; transition: all 0.15s;
  &:hover:not([disabled]) { box-shadow: 0 3px 10px ${(p: any) => p.theme.colors.primary.main}33; }
`;
const GenBtnLeft = styled.span<{ theme: any }>`
  display: flex; align-items: center; gap: 0.45rem;
  padding: 0.45rem 0.75rem; color: ${(p: any) => p.theme.colors.primary.main};
  font-size: 0.8rem; font-weight: 600; white-space: nowrap;
`;
const GenBtnIcon = styled.span`display: flex; align-items: center; flex-shrink: 0;`;
const GenBtnLabel = styled.span``;
const GenBtnDivider = styled.span<{ theme: any }>`
  width: 1px; background: ${(p: any) => p.theme.colors.primary.main}40; flex-shrink: 0;
`;
const GenBtnChevron = styled.span<{ theme: any; $open: boolean }>`
  display: flex; align-items: center; justify-content: center;
  padding: 0 0.45rem;
  color: ${(p: any) => p.theme.colors.primary.main};
  transition: transform 0.15s;
  transform: ${(p: any) => p.$open ? 'rotate(180deg)' : 'rotate(0deg)'};
  svg { width: 12px; height: 12px; }
`;
const GenDropMenu = styled.div<{ theme: any }>`
  position: absolute; top: calc(100% + 6px); left: 0;
  background: ${(p: any) => p.theme.colors.base[200]};
  border: 1px solid ${(p: any) => p.theme.colors.base[300]};
  border-radius: ${(p: any) => p.theme.radius.field};
  box-shadow: 0 8px 24px rgba(0,0,0,0.18); z-index: 3000; min-width: 140px; overflow: hidden;
`;
const GenDropItem = styled.button<{ theme: any; $active?: boolean }>`
  width: 100%; padding: 0.55rem 0.875rem;
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.8rem; font-weight: 500; border: none; cursor: pointer; text-align: left;
  background: ${(p: any) => p.$active ? p.theme.colors.primary.main + '14' : 'transparent'};
  color: ${(p: any) => p.theme.colors.base.content};
  transition: background 0.1s;
  &:hover { background: ${(p: any) => p.theme.colors.base[300]}; }
  svg { width: 13px; height: 13px; flex-shrink: 0; }
`;

// ESpinner used by TemplateGenDropdown
const ESpinner = styled.div`
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.35); border-top-color: currentColor;
  border-radius: 50%; animation: ${spin} 0.65s linear infinite; flex-shrink: 0;
`;

// ─────────────────────────────────────────────────────────────
// STYLED COMPONENTS — UNSAVED CHANGES DIALOG
// ─────────────────────────────────────────────────────────────
const Overlay = styled.div<{ $open: boolean }>`
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  opacity: ${p => p.$open ? 1 : 0};
  visibility: ${p => p.$open ? 'visible' : 'hidden'};
  transition: opacity 0.15s, visibility 0.15s;
`;
const Dialog = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 1.75rem; max-width: 420px; width: 90%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
`;
const DialogActions = styled.div`display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;`;
const CancelBtn = styled.button<{ theme: any }>`
  padding: 0.6rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 0.15s;
  &:hover { border-color: ${p => p.theme.colors.primary.main}; }
`;
const ConfirmBtn = styled.button<{ theme: any; $danger?: boolean }>`
  padding: 0.6rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  border: none;
  background: ${p => p.$danger ? p.theme.colors.error.main : p.theme.colors.primary.main};
  color: #fff;
  font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
  &:hover { opacity: 0.88; }
`;

// ─────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────
const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
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
const HtmlIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const VALID_TONES = ['Professional', 'Professional but friendly', 'Enthusiastic', 'Concise', 'Formal', 'Casual'];
const getExt = (filename: string) => filename.split('.').pop()?.toLowerCase() || '';

// ─────────────────────────────────────────────────────────────
// UNSAVED CHANGES DIALOG
// ─────────────────────────────────────────────────────────────
const UnsavedChangesDialog: React.FC<{
  open: boolean;
  theme: any;
  onKeep: () => void;
  onDiscard: () => void;
}> = ({ open, theme, onKeep, onDiscard }) => (
  <Overlay $open={open}>
    <Dialog theme={theme}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700 }}>Unsaved Changes</h3>
      <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.65 }}>
        You have unsaved changes. Are you sure you want to close without saving?
      </p>
      <DialogActions>
        <CancelBtn theme={theme} onClick={onKeep}>Keep Editing</CancelBtn>
        <ConfirmBtn theme={theme} $danger onClick={onDiscard}>Discard Changes</ConfirmBtn>
      </DialogActions>
    </Dialog>
  </Overlay>
);

// ─────────────────────────────────────────────────────────────
// TEMPLATE GENERATE DROPDOWN
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
        <GenBtnLabel>{generating ? 'Generating…' : 'Plain Text'}</GenBtnLabel>
      </GenBtnLeft>
      <GenBtnDivider theme={theme} />
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

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export type CsTab = 'inherit' | 'brand' | 'strategy' | 'email' | 'branding' | 'attachments' | 'template';

export interface CampaignSettingsModalProps {
  isOpen: boolean;
  campaignId: number;
  theme: any;
  apiBase: string;
  onClose: () => void;
  onSaved: () => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, msg: string) => void;
}

const defaultPrefs = (): CampaignPreferences => ({
  bcc: '', brand_id: null, goal: '',
  value_prop: '', tone: '', cta: '', additional_notes: '', writing_guidelines: '',
  inherit_global_settings: 1, inherit_global_attachments: 1,
});

// ─────────────────────────────────────────────────────────────
// CAMPAIGN SETTINGS / PREFERENCE MODAL
// ─────────────────────────────────────────────────────────────
const CampaignSettingsModal: React.FC<CampaignSettingsModalProps> = ({
  isOpen, campaignId, theme, apiBase, onClose, onSaved, onToast,
}) => {
  const [activeTab, setActiveTab] = useState<CsTab>('inherit');
  const [prefs, setPrefs]         = useState<CampaignPreferences>(defaultPrefs());
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [preferenceId, setPreferenceId]   = useState<number | null>(null);

  // ── Dirty-check snapshot ────────────────────────────────────
  const savedPrefs     = useRef<CampaignPreferences>(defaultPrefs());
  const savedTemplate  = useRef({ subject: '', body: '' });
  const savedLinkedIds = useRef<Set<number>>(new Set());
  const [confirmClose, setConfirmClose] = useState(false);

  // ── Per-tab dirty tracking ────────────────────────────────
  const [dirtyTabs, setDirtyTabs] = useState<Partial<Record<CsTab, boolean>>>({});
  const markDirty  = (tab: CsTab) => setDirtyTabs(p => ({ ...p, [tab]: true }));
  const clearDirty = (tab: CsTab) => setDirtyTabs(p => ({ ...p, [tab]: false }));

  // ── Inherit snapshot (for dirty-check only) ─────────────
  const savedInherit = useRef({ settings: 1, attachments: 1 });

  // ── Template Email state ────────────────────────────────────
  const [templateSubject,    setTemplateSubject]    = useState('');
  const [templateBody,       setTemplateBody]       = useState('');
  const [templateHtmlEmail,  setTemplateHtmlEmail]  = useState(false);
  const [templateGenerating, setTemplateGenerating] = useState(false);
  const [templateSaving,     setTemplateSaving]     = useState(false);
  const [templateEnabled,    setTemplateEnabled]    = useState(false);

  // ── Template preview resize ──────────────────────────────────
  const [tplSplitRatio, setTplSplitRatio] = useState(0.5);
  const tplDragRef = useRef<{ dragging: boolean; startX: number; startRatio: number; containerW: number }>({ dragging: false, startX: 0, startRatio: 0.5, containerW: 0 });
  const tplContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!templateHtmlEmail) setTplSplitRatio(0.5);
  }, [templateHtmlEmail]);

  const onTplDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const containerW = tplContainerRef.current?.offsetWidth ?? 700;
    tplDragRef.current = { dragging: true, startX: e.clientX, startRatio: tplSplitRatio, containerW };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const cleanup = () => {
      tplDragRef.current.dragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.getSelection()?.removeAllRanges();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    const onMove = (ev: MouseEvent) => {
      if (!tplDragRef.current.dragging) return;
      if (ev.buttons === 0) { cleanup(); return; }
      const { startX, startRatio, containerW: cW } = tplDragRef.current;
      const delta = ev.clientX - startX;
      const newRatio = Math.min(0.85, Math.max(0.15, startRatio - delta / cW));
      setTplSplitRatio(newRatio);
    };
    const onUp = () => cleanup();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Global settings state ───────────────────────────────────
  const [globalGoal,               setGlobalGoal]               = useState('');
  const [globalTone,               setGlobalTone]               = useState('');
  const [globalValueProp,          setGlobalValueProp]          = useState('');
  const [globalWritingGuidelines,  setGlobalWritingGuidelines]  = useState('');
  const [globalCta,                setGlobalCta]                = useState('');
  const [globalAdditionalNotes,    setGlobalAdditionalNotes]    = useState('');
  const [globalBcc,                setGlobalBcc]                = useState('');

  // ── Brands state ────────────────────────────────────────────
  const [brands, setBrands] = useState<{ id: number; name: string; business_name?: string; email_address?: string; is_default: number }[]>([]);

  // ── Attachment state ─────────────────────────────────────────
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
          bcc: d.bcc ?? '',
          brand_id: d.brand_id ?? null,
          goal: d.goal ?? '',
          value_prop: d.value_prop ?? '', tone: d.tone ?? '',
          cta: d.cta ?? '', additional_notes: d.additional_notes ?? '',
          writing_guidelines: d.writing_guidelines ?? '',
          inherit_global_settings: d.inherit_global_settings ?? 1,
          inherit_global_attachments: d.inherit_global_attachments ?? 1,
        });
        const tmpl = d.template_email || '';
        if (tmpl) {
          const lines = tmpl.split('\n');
          const hasSubjectLine = lines[0].startsWith('SUBJECT:');
          const subjectLine = hasSubjectLine ? lines[0].replace('SUBJECT:', '').trim() : '';
          const body = hasSubjectLine ? lines.slice(1).join('\n').trimStart() : tmpl;
          setTemplateSubject(subjectLine);
          setTemplateBody(body);
          setTemplateEnabled(true);
        } else {
          setTemplateSubject('');
          setTemplateBody('');
          setTemplateEnabled(false);
        }
        setTemplateHtmlEmail(!!(d.template_html_email));
        const firstLine = tmpl.split('\n')[0];
        const hasSubjectLine2 = firstLine.startsWith('SUBJECT:');
        const loadedSubj = hasSubjectLine2 ? firstLine.replace('SUBJECT:', '').trim() : '';
        const loadedBody = hasSubjectLine2 ? tmpl.split('\n').slice(1).join('\n').trimStart() : tmpl;
        savedTemplate.current = { subject: loadedSubj, body: loadedBody };
        savedPrefs.current = {
          bcc: d.bcc ?? '',
          brand_id: d.brand_id ?? null,
          goal: d.goal ?? '',
          value_prop: d.value_prop ?? '', tone: d.tone ?? '',
          cta: d.cta ?? '', additional_notes: d.additional_notes ?? '',
          writing_guidelines: d.writing_guidelines ?? '',
          inherit_global_settings: d.inherit_global_settings ?? 1,
          inherit_global_attachments: d.inherit_global_attachments ?? 1,
        };
        savedInherit.current = {
          settings: d.inherit_global_settings ?? 1,
          attachments: d.inherit_global_attachments ?? 1,
        };
        await loadAttachments(d.id ?? undefined);
        await loadGlobalSettings();
        await loadBrandsForCampaign();
      } else if (res.status === 404) {
        setPrefs(defaultPrefs());
        savedPrefs.current = defaultPrefs();
        savedTemplate.current = { subject: '', body: '' };
        await loadAttachments();
        await loadGlobalSettings();
        await loadBrandsForCampaign();
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const loadBrandsForCampaign = async () => {
    try {
      const res = await apiFetch(`${apiBase}/brands/`);
      if (res.ok) { const d = await res.json(); setBrands(d.brands ?? d ?? []); }
    } catch { /* silent */ }
  };

  const loadGlobalSettings = async () => {
    try {
      const settingsRes = await apiFetch(`${apiBase}/global_setting/`);
      if (!settingsRes.ok) return;
      const d = await settingsRes.json();
      setGlobalGoal(d.goal || '');
      setGlobalTone(d.tone || '');
      setGlobalValueProp(d.value_prop || '');
      setGlobalWritingGuidelines(d.writing_guidelines || '');
      setGlobalCta(d.cta || '');
      setGlobalAdditionalNotes(d.additional_notes || '');
      setGlobalBcc(d.bcc || '');
    } catch { /* silent */ }
  };

  const loadAttachments = async (_prefId?: number) => {
    setAttachLoading(true);
    try {
      const attRes = await apiFetch(`${apiBase}/attachments/?page=1&page_size=200`);
      if (attRes.ok) {
        const d = await attRes.json();
        const list = d.attachments ?? [];
        setAllAttachments(list);
        const numericCampaignId = Number(campaignId);
        const ids = new Set<number>(
          list
            .filter((a: any) =>
              (a.linked_campaigns ?? []).some((c: any) => c.id === numericCampaignId)
            )
            .map((a: any) => a.id as number)
        );
        setLinkedAttachmentIds(ids);
        savedLinkedIds.current = new Set(ids);
      }
    } catch (e) { console.error('Failed to load attachments', e); }
    finally { setAttachLoading(false); }
  };

  const saveAttachments = async () => {
    setAttachSaving(true);
    try {
      const allIds = allAttachments.map((a: any) => a.id as number);
      const linked = Array.from(linkedAttachmentIds);
      const unlinked = allIds.filter(id => !linkedAttachmentIds.has(id));
      const numericCampaignId = Number(campaignId);

      if (linked.length > 0) {
        await apiFetch(`${apiBase}/attachments/bulk-links/`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attachment_ids: linked, link_global: false, campaign_ids: [numericCampaignId] }),
        });
      }
      if (unlinked.length > 0) {
        await apiFetch(`${apiBase}/attachments/bulk-links/`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attachment_ids: unlinked, link_global: false, campaign_ids: [] }),
        });
      }
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
      const saved = savedLinkedIds.current;
      const isDiff = saved.size !== next.size || [...next].some(i => !saved.has(i));
      setDirtyTabs(p => ({ ...p, attachments: isDiff }));
      return next;
    });
  };

  const handleAttachFilePick = (file: File) => {
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
      const uploadRes = await apiFetch(`${apiBase}/attachment/`, { method: 'POST', body: formData });
      if (!uploadRes.ok) { const e = await uploadRes.json(); throw new Error(e.detail || 'Upload failed'); }
      const uploadData = await uploadRes.json();
      const newId: number = uploadData.id;
      const newLinkedIds = new Set([...Array.from(linkedAttachmentIds), newId]);

      if (preferenceId) {
        const newLinkedArr = Array.from(newLinkedIds);
        const linkRes = await apiFetch(`${apiBase}/attachments/bulk-links/`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attachment_ids: newLinkedArr, link_global: false, campaign_ids: [Number(campaignId)] }),
        });
        if (!linkRes.ok) { const e = await linkRes.json(); throw new Error(e.detail || 'Upload succeeded but linking failed'); }
        savedLinkedIds.current = newLinkedIds;
        clearDirty('attachments');
      }

      setLinkedAttachmentIds(newLinkedIds);
      setAllAttachments(prev => {
        if (prev.some(a => a.id === newId)) return prev;
        return [...prev, { id: newId, filename: uploadData.filename, file_size: uploadData.file_size ?? 0 }];
      });
      setUploadFile(null);
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
      onToast('success', 'Uploaded', `"${uploadData.filename}" uploaded and linked`);
    } catch (err) {
      onToast('error', 'Upload Failed', err instanceof Error ? err.message : 'Upload failed');
    } finally { setUploading(false); }
  };

  const save = async (triggerTab: CsTab = 'brand') => {
    setSaving(true);
    try {
      const fd = new FormData();
      const textFields: (keyof CampaignPreferences)[] = [
        'bcc', 'goal', 'value_prop', 'tone', 'cta', 'additional_notes', 'writing_guidelines',
      ];
      textFields.forEach(k => fd.append(k as string, (prefs[k] as string | undefined) ?? ''));
      fd.append('brand_id', prefs.brand_id != null ? String(prefs.brand_id) : '');
      fd.append('inherit_global_settings',    String(prefs.inherit_global_settings));
      fd.append('inherit_global_attachments', String(prefs.inherit_global_attachments));

      const res = await apiFetch(`${apiBase}/campaign/${campaignId}/campaign_preference/`, {
        method: 'PUT', body: fd,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed to save'); }

      savedPrefs.current = { ...prefs };
      savedInherit.current = {
        settings:    prefs.inherit_global_settings,
        attachments: prefs.inherit_global_attachments,
      };
      clearDirty(triggerTab);
      if (triggerTab !== 'inherit') clearDirty('inherit');

      onToast('success', 'Saved', 'Campaign preferences saved');
      onSaved();
    } catch (err) {
      onToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  const set = (k: keyof CampaignPreferences, v: string | number, tab?: CsTab) => {
    setPrefs(p => ({ ...p, [k]: v }));
    if (tab) markDirty(tab);
    if (k === 'inherit_global_settings' || k === 'inherit_global_attachments') {
      markDirty('inherit');
    }
  };

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
      const subjectTrimmed = templateSubject.trim();
      const bodyTrimmed = templateBody.trim();
      const templateEmailValue = !bodyTrimmed
        ? ''
        : subjectTrimmed
          ? `SUBJECT: ${subjectTrimmed}\n\n${bodyTrimmed}`
          : bodyTrimmed;
      fd.append('template_email', templateEmailValue);
      fd.append('template_html_email', templateHtmlEmail ? '1' : '0');
      const res = await apiFetch(`${apiBase}/campaign/${campaignId}/campaign_preference/`, {
        method: 'PUT', body: fd,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed to save'); }
      clearDirty('template');
      await loadPrefs();
      onToast('success', 'Template', 'Template saved');
      onSaved();
    } catch (err) {
      onToast('error', 'Template', err instanceof Error ? err.message : 'Failed to save');
    } finally { setTemplateSaving(false); }
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
    { id: 'brand',       label: 'Brand',          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> },
    { id: 'strategy',    label: 'Strategy',       icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
    { id: 'email',       label: 'Email Content',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
    { id: 'template',    label: 'Template Email', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
    { id: 'branding',    label: 'Branding',       icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
    { id: 'attachments', label: 'Attachments',    icon: <PaperclipIcon /> },
  ];

  const isCsDirty = Object.values(dirtyTabs).some(Boolean);
  const viewInheritSettings    = !!savedInherit.current.settings;
  const viewInheritAttachments = !!savedInherit.current.attachments;

  const handleCsClose = () => {
    if (isCsDirty) { setConfirmClose(true); return; }
    onClose();
  };

  // ── Inline read-only field helper ───────────────────────────
  const ReadOnly = ({ value }: { value: string }) => (
    <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, minHeight: '2.5rem' }}>
      {value || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set</span>}
    </div>
  );
  const InheritBanner = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.5rem 0.75rem', background: theme.colors.primary.main + '12', border: `1px solid ${theme.colors.primary.main}30`, borderRadius: theme.radius.field }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <span style={{ fontSize: '0.75rem', color: theme.colors.primary.main, fontWeight: 600 }}>Inherited from global settings — disable inheritance to edit</span>
    </div>
  );

  return (
    <>
      <CsBackdrop $open={isOpen} onClick={handleCsClose} />
      <CsModalWrap $open={isOpen} onClick={handleCsClose}>
        <CsModal theme={theme} $open={isOpen} $wide={activeTab === 'template' && templateHtmlEmail && templateEnabled} onClick={e => e.stopPropagation()}>

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
                const isDirty = dirtyTabs[t.id];
                return (
                  <CsNavBtn key={t.id} theme={theme} $active={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
                    {t.icon}
                    <CsNavLabel>{t.label}</CsNavLabel>
                    {isDirty && (
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1, flexShrink: 0, color: activeTab === t.id ? theme.colors.primary.main : '#F59E0B' }}>*</span>
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

            {/* ── BRAND tab ───────────────────────────────── */}
            {activeTab === 'brand' && (
              <CsTabPanel theme={theme} key="brand">
                <CsPanelTitle theme={theme}>Brand</CsPanelTitle>
                <CsPanelSubtitle theme={theme}>
                  Select which brand to use for this campaign. The selected brand's SMTP credentials, logo, and signature will be used for email sending.
                </CsPanelSubtitle>

                {brands.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.85rem', opacity: 0.6 }}>
                    No brands configured. Go to <strong>Settings → Brands</strong> to create one.
                  </div>
                ) : (
                  <SFG>
                    <SLabel theme={theme}>Selected Brand</SLabel>
                    <SSelect theme={theme}
                      value={prefs.brand_id ?? ''}
                      onChange={e => set('brand_id', e.target.value ? Number(e.target.value) : (null as any), 'brand')}>
                      <option value="">— Use default brand —</option>
                      {brands.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name}{b.is_default ? ' (default)' : ''}{b.email_address ? ` — ${b.email_address}` : ''}
                        </option>
                      ))}
                    </SSelect>
                    {prefs.brand_id && (() => {
                      const selected = brands.find(b => b.id === prefs.brand_id);
                      return selected ? (
                        <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.9rem', background: theme.colors.primary.main + '08', border: `1px solid ${theme.colors.primary.main}30`, borderRadius: theme.radius.field, fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{selected.name}</div>
                          {selected.business_name && <div style={{ opacity: 0.7 }}>{selected.business_name}</div>}
                          {selected.email_address && <div style={{ opacity: 0.55, fontSize: '0.75rem', fontFamily: 'monospace' }}>{selected.email_address}</div>}
                        </div>
                      ) : null;
                    })()}
                  </SFG>
                )}

                <SSaveRow>
                  <SBtn theme={theme} onClick={() => save('brand')} disabled={saving || loading}>
                    {saving ? 'Saving…' : 'Save'}
                  </SBtn>
                </SSaveRow>
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
                    <InheritBanner />
                    <SFormRow>
                      <SFG><SLabel theme={theme}>Goal</SLabel><ReadOnly value={globalGoal} /></SFG>
                      <SFG><SLabel theme={theme}>Tone</SLabel><ReadOnly value={globalTone} /></SFG>
                    </SFormRow>
                    <SFG style={{ marginBottom: 0 }}>
                      <SLabel theme={theme}>Value Proposition</SLabel>
                      <ReadOnly value={globalValueProp} />
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
                    <InheritBanner />
                    <SFG><SLabel theme={theme}>Writing Guidelines</SLabel>
                      <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, whiteSpace: 'pre-wrap', lineHeight: 1.5, minHeight: '4rem' }}>
                        {globalWritingGuidelines || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set</span>}
                      </div>
                    </SFG>
                    <SFG><SLabel theme={theme}>Call to Action</SLabel><ReadOnly value={globalCta} /></SFG>
                    <SFG>
                      <SLabel theme={theme}>Additional Notes</SLabel>
                      <div style={{ padding: '0.6rem 0.9rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.75, whiteSpace: 'pre-wrap', lineHeight: 1.5, minHeight: '3rem' }}>
                        {globalAdditionalNotes || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not set</span>}
                      </div>
                    </SFG>
                    <SFG style={{ marginBottom: 0 }}><SLabel theme={theme}>BCC Address</SLabel><ReadOnly value={globalBcc} /></SFG>
                  </>
                ) : (
                  <>
                    <SFG>
                      <SLabel theme={theme}>Writing Guidelines</SLabel>
                      <STextarea theme={theme} rows={3}
                        placeholder="Start with a genuine compliment… never use 'I hope this finds you well'…"
                        value={prefs.writing_guidelines} onChange={e => set('writing_guidelines', e.target.value, 'email')} />
                    </SFG>
                    <SFG>
                      <SLabel theme={theme}>Call to Action</SLabel>
                      <SInput theme={theme} placeholder="Would you be open to a quick call this week?"
                        value={prefs.cta} onChange={e => set('cta', e.target.value, 'email')} />
                    </SFG>
                    <SFG>
                      <SLabel theme={theme}>Additional Notes</SLabel>
                      <STextarea theme={theme} rows={2} placeholder="Never mention competitors. Keep emails under 150 words."
                        value={prefs.additional_notes} onChange={e => set('additional_notes', e.target.value, 'email')} />
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

            {/* ── TEMPLATE EMAIL tab ───────────────────────── */}
            {activeTab === 'template' && (
              <CsTabPanel theme={theme} key="template">
                <CsPanelTitle theme={theme}>Template Email</CsPanelTitle>
                <CsPanelSubtitle theme={theme}>
                  When enabled, you can generate the same templatized email for all companies in this campaign. Use <code style={{ fontSize: '0.78rem', background: 'rgba(128,128,128,0.15)', padding: '1px 5px', borderRadius: 4 }}>{'{{company_name}}'}</code> as a placeholder.
                </CsPanelSubtitle>

                {/* Enable / Disable toggle */}
                <div
                  onClick={async () => {
                    if (templateEnabled) {
                      setTemplateEnabled(false);
                      setTemplateSubject('');
                      setTemplateBody('');
                      markDirty('template');
                      setTemplateSaving(true);
                      try {
                        const fd = new FormData();
                        fd.append('template_email', '');
                        await apiFetch(`${apiBase}/campaign/${campaignId}/campaign_preference/`, { method: 'PUT', body: fd });
                        savedTemplate.current = { subject: '', body: '' };
                        clearDirty('template');
                        onToast('success', 'Template', 'Template cleared');
                        onSaved();
                      } catch { onToast('error', 'Template', 'Failed to clear template'); }
                      finally { setTemplateSaving(false); }
                    } else {
                      setTemplateEnabled(true);
                      setTemplateHtmlEmail(false);
                      setTemplateGenerating(true);
                      try {
                        const res = await apiFetch(
                          `${apiBase}/campaign/${campaignId}/campaign_preference/generate-template/?html_email=false`,
                          { method: 'POST' },
                        );
                        if (!res.ok) throw new Error('Generation failed');
                        const d = await res.json();
                        setTemplateSubject(d.subject || '');
                        setTemplateBody(d.content || '');
                      } catch {
                        setTemplateSubject('A quick note for {{company_name}}');
                        setTemplateBody("Hi {{company_name}} team,\n\nI wanted to reach out and introduce ourselves. We'd love to explore how we can help you.\n\nWould you be open to a quick call this week?");
                        onToast('warning', 'Template', 'AI generation failed — default template applied');
                      } finally {
                        setTemplateGenerating(false);
                      }
                      markDirty('template');
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', cursor: templateSaving ? 'not-allowed' : 'pointer', userSelect: 'none', marginBottom: '1.25rem', opacity: templateSaving ? 0.5 : 1 }}
                >
                  <div style={{ width: 36, height: 20, borderRadius: 999, flexShrink: 0, background: templateEnabled ? theme.colors.primary.main : theme.colors.base[300], position: 'relative', transition: 'background 0.2s', border: `1px solid ${templateEnabled ? theme.colors.primary.main : theme.colors.base[300]}` }}>
                    <div style={{ position: 'absolute', top: 2, left: templateEnabled ? 17 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.75 }}>
                    {templateGenerating ? 'Generating…' : templateEnabled ? 'Template enabled' : 'Enable template email'}
                  </span>
                </div>

                {templateEnabled && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                      <TemplateGenDropdown
                        theme={theme}
                        generating={templateGenerating}
                        onGenerate={(html) => { setTemplateHtmlEmail(html); generateTemplate(html); }}
                      />
                    </div>

                    <div ref={tplContainerRef} style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', width: '100%' }}>

                      {/* Editor column */}
                      <div style={{ flex: `0 0 calc(${templateHtmlEmail ? (1 - tplSplitRatio) * 100 : 100}% - ${templateHtmlEmail ? '3px' : '0px'})`, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflow: 'hidden' }}>
                        <SFG style={{ marginBottom: 0 }}>
                          <SLabel theme={theme}>Subject</SLabel>
                          <SInput theme={theme} placeholder="A quick idea for {{company_name}}" value={templateSubject}
                            onChange={e => { setTemplateSubject(e.target.value); markDirty('template'); }} />
                        </SFG>

                        <SFG style={{ marginBottom: 0 }}>
                          <SLabel theme={theme}>Body</SLabel>
                          <STextarea theme={theme} rows={10}
                            placeholder={'Hi {{company_name}} team,\n\nI wanted to reach out…'}
                            value={templateBody}
                            onChange={e => { setTemplateBody(e.target.value); markDirty('template'); }}
                            style={{ fontFamily: "'SF Mono', 'Monaco', 'Courier New', monospace", fontSize: '0.83rem', lineHeight: 1.65 }}
                          />
                        </SFG>

                        {/* HTML toggle */}
                        <div onClick={() => { setTemplateHtmlEmail(v => !v); markDirty('template'); }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', userSelect: 'none' }}>
                          <div style={{ width: 36, height: 20, borderRadius: 999, flexShrink: 0, background: templateHtmlEmail ? theme.colors.primary.main : theme.colors.base[300], position: 'relative', transition: 'background 0.2s', border: `1px solid ${templateHtmlEmail ? theme.colors.primary.main : theme.colors.base[300]}` }}>
                            <div style={{ position: 'absolute', top: 2, left: templateHtmlEmail ? 17 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.75 }}>HTML Template</span>
                        </div>

                        <SSaveRow style={{ marginTop: '0.25rem' }}>
                          <SBtn theme={theme} onClick={saveTemplate} disabled={templateSaving || templateGenerating}>
                            {templateSaving ? 'Saving…' : 'Save Template'}
                          </SBtn>
                        </SSaveRow>
                      </div>

                      {/* Drag divider + live preview */}
                      {templateHtmlEmail && (
                        <>
                          <div onMouseDown={onTplDividerMouseDown} style={{ width: 6, flexShrink: 0, cursor: 'col-resize', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 0.5rem' }}>
                            <div style={{ width: 2, height: '40px', borderRadius: 2, background: theme.colors.base[300] }} />
                          </div>
                          <div style={{ flex: `0 0 calc(${tplSplitRatio * 100}% - 3px)`, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <SLabel theme={theme} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
                              </svg>
                              Live Preview
                            </SLabel>
                            <div style={{ border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, overflow: 'hidden', background: '#fff', minHeight: 340 }}>
                              {templateBody.trim() ? (
                                <iframe
                                  key={templateBody}
                                  srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111;word-break:break-word;}img{max-width:100%;height:auto;}a{color:#6366f1;}</style></head><body>${templateBody}</body></html>`}
                                  style={{ width: '100%', height: '100%', border: 'none', display: 'block', minHeight: 340 }}
                                  sandbox="allow-same-origin"
                                  title="Template HTML Preview"
                                />
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 340, fontSize: '0.8rem', opacity: 0.35, fontStyle: 'italic' }}>
                                  Preview will appear here…
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </CsTabPanel>
            )}

            {/* ── BRANDING tab ─────────────────────────────── */}
            {activeTab === 'branding' && (
              <CsTabPanel theme={theme} key="branding">
                <CsPanelTitle theme={theme}>Branding</CsPanelTitle>
                <CsPanelSubtitle theme={theme}>
                  Logo and signature now come from the selected brand. Use the <strong>Brand</strong> tab to change which brand is linked to this campaign, or go to <strong>Settings → Brands</strong> to manage brands.
                </CsPanelSubtitle>

                {(() => {
                  const selectedBrand = brands.find(b => b.id === prefs.brand_id) || brands.find(b => b.is_default) || null;
                  return selectedBrand ? (
                    <div style={{ padding: '1rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.6rem' }}>
                        {prefs.brand_id ? 'Campaign Brand' : 'Default Brand (fallback)'}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{selectedBrand.name}</div>
                      {selectedBrand.email_address && <div style={{ fontSize: '0.8rem', opacity: 0.6, fontFamily: 'monospace' }}>{selectedBrand.email_address}</div>}
                    </div>
                  ) : (
                    <div style={{ padding: '1.25rem', background: theme.colors.base[200], border: `1px dashed ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.85rem', opacity: 0.55, textAlign: 'center' }}>
                      No brand selected — go to <strong>Settings → Brands</strong> to create one, then select it in the Brand tab.
                    </div>
                  );
                })()}
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
                    </div>
                    <AttachEmpty theme={theme}>Global attachments are managed in Settings → Attachments.</AttachEmpty>
                  </>
                ) : (
                  <>
                    {/* Upload zone */}
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
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = theme.colors.error.main; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = theme.colors.error.main; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = theme.colors.base[100]; e.currentTarget.style.color = theme.colors.base.content; e.currentTarget.style.borderColor = theme.colors.base[300]; }}
                          >✕</button>
                        )}
                        <input ref={uploadFileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachFilePick(f); }} disabled={uploading} />
                      </div>

                      {uploadFile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.6rem' }}>
                          <SBtn theme={theme} onClick={handleAttachUpload} disabled={uploading} style={{ minWidth: 120, padding: '0.5rem 1rem', fontSize: '0.825rem' }}>
                            {uploading ? 'Uploading…' : 'Upload & Attach'}
                          </SBtn>
                        </div>
                      )}
                    </div>

                    <div style={{ height: 1, background: theme.colors.base[300], marginBottom: '1rem' }} />

                    {attachLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', opacity: 0.5, fontSize: '0.875rem' }}>Loading attachments…</div>
                    ) : allAttachments.length === 0 ? (
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
                          <AttachPickerSearch theme={theme} placeholder="Search attachments…" value={attachSearch}
                            onChange={e => setAttachSearch(e.target.value)} style={{ paddingLeft: '2rem' }} />
                        </div>

                        {/* Attached list */}
                        <div style={{ marginBottom: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main, flexShrink: 0 }}>
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                            </svg>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.colors.primary.main }}>Attached</span>
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, background: theme.colors.primary.main + '20', color: theme.colors.primary.main, border: `1px solid ${theme.colors.primary.main}40`, borderRadius: '999px', padding: '1px 6px' }}>{attachedFiles.length}</span>
                            {attachedFiles.length > 0 && (
                              <button onClick={() => setLinkedAttachmentIds(new Set())}
                                style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.base.content, opacity: 0.4, padding: '2px 6px', borderRadius: '4px' }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}>
                                Detach all
                              </button>
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

                        {/* Not Attached list */}
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
                      </>
                    )}
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

export default CampaignSettingsModal;