/**
 * BulkEmailModal.tsx
 *
 * Top tab bar  → Companies | Bulk Settings
 *
 * Companies tab:
 *   Left column  — vertical company list with status indicators
 *   Right column — per-company Email / Attachments / Branding tabs
 *
 * Bulk Settings tab:
 *   1. Generate All (Personalised / From Template)
 *   2. Inherit Attachments (checkbox + accordion when false)
 *   3. Inherit Branding (checkbox + accordion when false)
 *
 * Footer — Send All / Schedule All (always visible)
 */

import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { apiFetch } from '../../App';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Company { id: number; name: string; email: string; }
interface AttachmentOption { id: number; filename: string; file_size: number; }

interface BulkEmailEntry {
  company: Company;
  emailId: number | null;
  subject: string;
  body: string;
  phase: 'loading' | 'ready' | 'error';
  activeTab: 'email' | 'attachments' | 'branding';
  allAttachments: AttachmentOption[];
  linkedEmailAttachIds: Set<number>;
  attachSearch: string;
  attachSaving: boolean;
  attachMsg: { type: 'success' | 'error'; text: string } | null;
  attachLoading: boolean;
  uploadFile: File | null;
  uploading: boolean;
  uploadMsg: { type: 'success' | 'error'; text: string } | null;
  isDragOver: boolean;
  inheritCampaignAttachments: number;
  inheritCampaignBranding: number;
  inheritedAttachIds: number[];
  brandSignature: string;
  brandLogoData: string | null;
  campaignBrandSignature: string;
  campaignBrandLogoData: string | null;
  brandLogoUploading: boolean;
  brandSaving: boolean;
  brandMsg: { type: 'success' | 'error'; text: string } | null;
}

export interface BulkEmailModalProps {
  isOpen: boolean;
  companies: Company[];
  campaignId: number;
  theme: any;
  apiBase: string;
  onClose: () => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, msg: string) => void;
  hasTemplateEmail?: boolean;
}

// ─────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────
const spin   = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const fadeIn = keyframes`from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}`;

// ─────────────────────────────────────────────────────────────
// SHELL
// ─────────────────────────────────────────────────────────────
const Overlay = styled.div<{ $open: boolean }>`
  position:fixed;inset:0;z-index:1100;
  background:rgba(0,0,0,0.65);backdrop-filter:blur(5px);
  display:flex;align-items:center;justify-content:center;padding:1.5rem;
  opacity:${p => p.$open ? 1 : 0};pointer-events:${p => p.$open ? 'all' : 'none'};
  transition:opacity 0.22s ease;
`;
const ModalBox = styled.div<{ theme: any; $open: boolean }>`
  width:100%;max-width:1000px;height:calc(100vh - 3rem);
  background:${p => p.theme.colors.base[200]};
  border:1px solid ${p => p.theme.colors.base[300]};
  border-radius:16px;box-shadow:0 32px 80px rgba(0,0,0,0.45);
  display:flex;flex-direction:column;overflow:hidden;
  opacity:${p => p.$open ? 1 : 0};
  transform:${p => p.$open ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(20px)'};
  transition:opacity 0.25s ease,transform 0.25s ease;
`;
const ModalHeader = styled.div<{ theme: any }>`
  display:flex;align-items:center;justify-content:space-between;
  padding:1.1rem 1.5rem;border-bottom:1px solid ${p => p.theme.colors.base[300]};
  flex-shrink:0;background:${p => p.theme.colors.base[200]};
`;
const ModalTitle = styled.h2`
  margin:0;font-size:1rem;font-weight:700;letter-spacing:-0.02em;
  display:flex;align-items:center;gap:0.5rem;
`;
const CloseBtn = styled.button<{ theme: any }>`
  width:30px;height:30px;padding:0;border-radius:8px;
  border:1px solid ${p => p.theme.colors.base[300]};
  background:${p => p.theme.colors.base[400]};color:${p => p.theme.colors.base.content};
  cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;
  transition:all 0.15s;&:hover{background:${p => p.theme.colors.base[300]};border-color:${p => p.theme.colors.primary.main};color:${p => p.theme.colors.primary.main};}
`;

// ── TOP TAB BAR ──────────────────────────────────────────────
const TopTabBar = styled.div<{ theme: any }>`
  display:flex;border-bottom:1px solid ${p => p.theme.colors.base[300]};flex-shrink:0;
  background:${p => p.theme.colors.base[200]};
`;
const TopTab = styled.button<{ theme: any; $active: boolean }>`
  display:inline-flex;align-items:center;gap:0.45rem;padding:0.7rem 1.4rem;
  font-size:0.84rem;font-weight:${p => p.$active ? 700 : 500};
  border:none;border-bottom:2px solid ${p => p.$active ? p.theme.colors.primary.main : 'transparent'};
  background:none;cursor:pointer;
  color:${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base.content};
  opacity:${p => p.$active ? 1 : 0.55};transition:all 0.15s;margin-bottom:-1px;
  &:hover{opacity:1;color:${p => p.theme.colors.primary.main};}
  svg{width:14px;height:14px;}
`;

// ── COMPANIES LAYOUT ─────────────────────────────────────────
const TwoCol = styled.div`display:flex;flex:1;min-height:0;overflow:hidden;`;

const CompanyNav = styled.nav<{ theme: any }>`
  width:220px;flex-shrink:0;
  background:${p => p.theme.colors.base[200]};
  border-right:1px solid ${p => p.theme.colors.base[300]};
  overflow-y:auto;display:flex;flex-direction:column;padding:0.5rem 0;scrollbar-width:thin;
`;
const NavLabel = styled.div<{ theme: any }>`
  font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;
  opacity:0.4;padding:0.5rem 0.875rem 0.3rem;color:${p => p.theme.colors.base.content};
`;
const NavItem = styled.button<{ theme: any; $active: boolean }>`
  width:100%;padding:0.65rem 0.875rem;
  border:none;background:${p => p.$active ? p.theme.colors.primary.main+'18' : 'transparent'};
  color:${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base.content};
  cursor:pointer;text-align:left;display:flex;align-items:center;gap:0.6rem;
  font-size:0.8375rem;font-weight:${p => p.$active ? 600 : 500};
  border-left:3px solid ${p => p.$active ? p.theme.colors.primary.main : 'transparent'};
  transition:all 0.12s;
  &:hover{background:${p => p.$active ? p.theme.colors.primary.main+'22' : p.theme.colors.base[200]};}
`;
const NavName = styled.span`flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
const StatusDot = styled.span<{ theme: any; $phase: string }>`
  width:7px;height:7px;border-radius:50%;flex-shrink:0;
  background:${p =>
    p.$phase==='ready' ? p.theme.colors.primary.main :
    p.$phase==='error' ? (p.theme.colors.error?.main||'#ef4444') :
    p.theme.colors.base[300]};
`;
const LoadSpinner = styled.div<{ theme: any }>`
  width:44px;height:44px;border-radius:50%;flex-shrink:0;
  border:3px solid ${p => p.theme.colors.primary.main}30;
  border-top-color:${p => p.theme.colors.primary.main};
  animation:${spin} 0.7s linear infinite;
`;
const MiniSpinner = styled.div`
  width:10px;height:10px;flex-shrink:0;
  border:2px solid rgba(128,128,128,0.25);border-top-color:currentColor;
  border-radius:50%;animation:${spin} 0.7s linear infinite;
`;

// ── COMPANY EMAIL PANE ───────────────────────────────────────
const EmailPane = styled.div`flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;`;
const InnerTabBar = styled.div<{ theme: any }>`
  display:flex;border-bottom:1px solid ${p => p.theme.colors.base[300]};flex-shrink:0;
  background:${p => p.theme.colors.base[200]};
`;
const InnerTab = styled.button<{ theme: any; $active: boolean }>`
  display:inline-flex;align-items:center;gap:0.45rem;padding:0.65rem 1.2rem;
  font-size:0.8375rem;font-weight:${p => p.$active ? 700 : 500};
  border:none;border-bottom:2px solid ${p => p.$active ? p.theme.colors.primary.main : 'transparent'};
  background:none;cursor:pointer;
  color:${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base.content};
  opacity:${p => p.$active ? 1 : 0.55};transition:all 0.15s;margin-bottom:-1px;
  &:hover{opacity:1;color:${p => p.theme.colors.primary.main};}
  svg{width:14px;height:14px;}
`;
const Scroll = styled.div`flex:1;min-height:0;overflow-y:auto;padding:1.5rem;display:flex;flex-direction:column;gap:1rem;animation:${fadeIn} 0.15s ease;scrollbar-width:thin;`;
const ScrollFlush = styled(Scroll)`gap:0;padding:1.25rem 1.5rem;`;

// ── BULK SETTINGS PANE ───────────────────────────────────────
const BulkPane = styled.div`
  flex:1;overflow-y:auto;padding:1.5rem 1.75rem;
  display:flex;flex-direction:column;gap:1.25rem;
  animation:${fadeIn} 0.15s ease;
`;

// ── SETTINGS-STYLE COMPONENTS ─────────────────────────────────
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

const Msg = styled.div<{ theme: any; $type: 'success'|'error'|'info'|'checking'|'warning' }>`
  padding: 0.5rem 0.75rem;
  border-radius: ${p => p.theme.radius.field};
  font-size: 0.825rem; font-weight: 500; margin-top: 0.5rem;
  word-break: break-word; overflow-wrap: break-word;
  ${p => ({
    success:  `color:${p.theme.colors.success.main}; background:${p.theme.colors.base[200]}; border:1px solid ${p.theme.colors.success.main};`,
    error:    `color:${p.theme.colors.error.main}; background:${p.theme.colors.base[200]}; border:1px solid ${p.theme.colors.error.main};`,
    checking: `color:#60A5FA; background:${p.theme.colors.base[200]}; border:1px solid #60A5FA;`,
    warning:  `color:${p.theme.colors.warning?.main||'#F59E0B'}; background:${p.theme.colors.base[200]}; border:1px solid ${p.theme.colors.warning?.main||'#F59E0B'};`,
    info:     `color:${p.theme.colors.info.main}; background:${p.theme.colors.base[200]}; border:1px solid ${p.theme.colors.info.main};`,
  }[p.$type])}
`;

// Warning / info banners
const AlertBox = styled.div<{ theme: any; $variant: 'warn'|'info' }>`
  display:flex;align-items:flex-start;gap:0.65rem;
  padding:0.8rem 1rem;border-radius:${p => p.theme.radius.field};
  font-size:0.8125rem;line-height:1.55;margin-bottom:1.1rem;
  ${p => p.$variant==='warn'
    ? `background:${p.theme.colors.warning?.main||'#f59e0b'}12;border:1px solid ${p.theme.colors.warning?.main||'#f59e0b'}40;color:${p.theme.colors.warning?.main||'#f59e0b'};`
    : `background:${p.theme.colors.primary.main}0d;border:1px solid ${p.theme.colors.primary.main}30;color:${p.theme.colors.primary.main};`}
`;

// Progress
const ProgressTrack = styled.div<{ theme: any }>`
  height:4px;border-radius:2px;background:${p => p.theme.colors.base[300]};
  overflow:hidden;margin-top:0.75rem;
`;
const ProgressFill = styled.div<{ theme: any; $pct: number }>`
  height:100%;border-radius:2px;background:${p => p.theme.colors.primary.main};
  width:${p => p.$pct}%;transition:width 0.3s ease;
`;

// ── SHARED UI ────────────────────────────────────────────────
const Spinner = styled.div`
  width:26px;height:26px;
  border:3px solid rgba(128,128,128,0.2);border-top-color:currentColor;
  border-radius:50%;animation:${spin} 0.7s linear infinite;
`;
const LoadBox = styled.div`
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:0.75rem;padding:4rem 1.5rem;opacity:0.6;
`;
const FieldLbl = styled.div<{ theme: any }>`
  font-size:0.72rem;font-weight:600;opacity:0.5;margin-bottom:0.3rem;
  text-transform:uppercase;letter-spacing:0.04em;
`;
const MixedBadgeStyle = styled.span<{ theme: any }>`
  font-size: 0.67rem; font-weight: 600; padding: 1px 6px; border-radius: 999px;
  background: ${p => (p.theme.colors.warning?.main || '#f59e0b')}20;
  color: ${p => p.theme.colors.warning?.main || '#f59e0b'};
  border: 1px solid ${p => (p.theme.colors.warning?.main || '#f59e0b')}40;
  margin-left: 0.5rem;
`;
const SubjectIn = styled.input<{ theme: any }>`
  width:100%;padding:0.65rem 0.9rem;
  border:1px solid ${p => p.theme.colors.base[300]};border-radius:${p => p.theme.radius.field};
  background:${p => p.theme.colors.base[400]};color:${p => p.theme.colors.base.content};
  font-size:0.9rem;font-weight:600;box-sizing:border-box;transition:border-color 0.15s;
  &:focus{outline:none;border-color:${p => p.theme.colors.primary.main};background:${p => p.theme.colors.base[100]};box-shadow:0 0 0 3px ${p => p.theme.colors.primary.main}20;}
`;
const BodyTA = styled.textarea<{ theme: any }>`
  width:100%;padding:0.75rem 0.9rem;
  border:1px solid ${p => p.theme.colors.base[300]};border-radius:${p => p.theme.radius.field};
  background:${p => p.theme.colors.base[400]};color:${p => p.theme.colors.base.content};
  font-size:0.875rem;font-family:inherit;resize:vertical;min-height:280px;
  box-sizing:border-box;transition:border-color 0.15s;line-height:1.6;
  &:focus{outline:none;border-color:${p => p.theme.colors.primary.main};background:${p => p.theme.colors.base[100]};box-shadow:0 0 0 3px ${p => p.theme.colors.primary.main}20;}
`;
const GenBtn = styled.button<{ theme: any }>`
  display:inline-flex;align-items:center;gap:0.4rem;padding:0.45rem 0.85rem;
  border-radius:${p => p.theme.radius.field};
  border:1px solid ${p => p.theme.colors.base[300]};
  background:${p => p.theme.colors.base[400]};color:${p => p.theme.colors.base.content};
  font-size:0.79rem;font-weight:600;cursor:pointer;transition:all 0.15s;
  &:hover:not(:disabled){border-color:${p => p.theme.colors.primary.main};color:${p => p.theme.colors.primary.main};background:${p => p.theme.colors.primary.main + '12'};}
  &:disabled{opacity:0.4;cursor:not-allowed;}
  svg{width:12px;height:12px;}
`;
const Btn = styled.button<{ theme: any; $v?: 'primary'|'warning'|'default' }>`
  display:inline-flex;align-items:center;gap:0.4rem;padding:0.55rem 1.2rem;
  border-radius:${p => p.theme.radius.field};border:none;
  font-size:0.8375rem;font-weight:600;cursor:pointer;transition:all 0.15s;
  background:${p =>
    p.$v==='primary'  ? p.theme.colors.primary.main :
    p.$v==='warning'  ? (p.theme.colors.warning?.main||'#f59e0b') :
    p.theme.colors.base[300]};
  color:${p =>
    p.$v==='primary' ? p.theme.colors.primary.content :
    p.$v==='warning' ? '#fff' :
    p.theme.colors.base.content};
  &:hover:not(:disabled){opacity:0.88;transform:translateY(-1px);}
  &:disabled{opacity:0.45;cursor:not-allowed;transform:none;}
  svg{width:14px;height:14px;}
`;


// Attachments
const AttachList = styled.div<{ theme: any }>`
  max-height:150px;overflow-y:auto;
  border:1px solid ${p => p.theme.colors.base[300]};border-radius:${p => p.theme.radius.field};
  background:${p => p.theme.colors.base[200]};
`;
const AttachRow = styled.div<{ theme: any; $checked: boolean }>`
  display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.75rem;
  cursor:pointer;font-size:0.8125rem;transition:background 0.1s;
  background:${p => p.$checked ? p.theme.colors.primary.main+'10' : 'transparent'};
  border-bottom:1px solid ${p => p.theme.colors.base[300]};
  &:last-child{border-bottom:none;}
  &:hover{background:${p => p.$checked ? p.theme.colors.primary.main+'18' : p.theme.colors.base[300]};}
`;
const AttachBox = styled.div<{ theme: any; $checked: boolean }>`
  width:15px;height:15px;flex-shrink:0;border-radius:3px;
  border:1.5px solid ${p => p.$checked ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background:${p => p.$checked ? p.theme.colors.primary.main : 'transparent'};
  display:flex;align-items:center;justify-content:center;
  svg{width:9px;height:9px;color:${p => p.theme.colors.primary.content};}
`;
const ExtBadge = styled.span<{ $ext: string }>`
  display:inline-flex;align-items:center;justify-content:center;
  min-width:32px;height:19px;padding:0 4px;border-radius:4px;
  font-size:0.62rem;font-weight:700;text-transform:uppercase;flex-shrink:0;
  background:${p => ({pdf:'#ef444420',doc:'#3b82f620',docx:'#3b82f620',csv:'#22c55e20',txt:'#64748b20'}[p.$ext]||'#64748b20')};
  color:${p => ({pdf:'#ef4444',doc:'#3b82f6',docx:'#3b82f6',csv:'#22c55e',txt:'#64748b'}[p.$ext]||'#64748b')};
`;
const AttachName  = styled.span`flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;`;
const AttachEmpty = styled.div<{ theme: any }>`padding:1.1rem;text-align:center;font-size:0.8rem;opacity:0.5;`;
const AttachSearch = styled.input<{ theme: any }>`
  width:100%;padding:0.45rem 0.75rem 0.45rem 2rem;
  border:1px solid ${p => p.theme.colors.base[300]};border-radius:${p => p.theme.radius.field};
  background:${p => p.theme.colors.base[400]};color:${p => p.theme.colors.base.content};
  font-size:0.8rem;box-sizing:border-box;
  &:focus{outline:none;border-color:${p => p.theme.colors.primary.main};}
  &::placeholder{opacity:0.5;}
`;

// Logo
const LogoZone = styled.div<{ theme: any; $has: boolean }>`
  width:100%;height:${p => p.$has ? '92px' : '78px'};
  border:2px dashed ${p => p.$has ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  border-radius:${p => p.theme.radius.field};background:${p => p.theme.colors.base[200]};
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;position:relative;overflow:hidden;transition:border-color 0.15s;
  &:hover{border-color:${p => p.theme.colors.primary.main};}
`;
const LogoImg = styled.img`max-height:68px;max-width:90%;object-fit:contain;border-radius:4px;`;
const LogoHint = styled.div`
  display:flex;flex-direction:column;align-items:center;gap:0.3rem;
  pointer-events:none;opacity:0.38;font-size:0.73rem;
`;
const LogoRemoveButton = styled.button<{ theme: any }>`
  position: absolute; top: 5px; right: 5px;
  width: 20px; height: 20px; border-radius: 50%;
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[100]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.6rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; opacity: 0.75;
  &:hover { 
    background: ${p => p.theme.colors.error.main}; 
    color: #fff; 
    border-color: ${p => p.theme.colors.error.main}; 
    opacity: 1; 
  }
`;

// Misc
const SaveBtn = styled.button<{ theme: any }>`
  padding:0.55rem 1.3rem;border-radius:${p => p.theme.radius.field};
  font-weight:600;font-size:0.84rem;border:none;cursor:pointer;
  background:${p => p.theme.colors.primary.main};color:${p => p.theme.colors.primary.content};
  transition:all 0.15s;
  &:hover:not(:disabled){opacity:0.88;transform:translateY(-1px);}
  &:disabled{opacity:0.45;cursor:not-allowed;transform:none;}
`;
const MsgLine = styled.div<{ theme: any; $ok: boolean }>`
  padding:0.45rem 0.7rem;border-radius:${p => p.theme.radius.field};font-size:0.8rem;font-weight:500;
  color:${p => p.$ok ? (p.theme.colors.success?.main||'#22c55e') : p.theme.colors.error.main};
  background:${p => p.theme.colors.base[200]};
  border:1px solid ${p => p.$ok ? (p.theme.colors.success?.main||'#22c55e') : p.theme.colors.error.main};
`;
const InlineBanner = styled.div<{ theme: any; $t:'success'|'error'|'info' }>`
  padding:0.55rem 0.8rem;border-radius:${p => p.theme.radius.field};
  font-size:0.8rem;font-weight:500;margin-top:0.5rem;
  ${p => p.$t==='success'
    ? `background:${p.theme.colors.success?.main||'#22c55e'}12;border:1px solid ${p.theme.colors.success?.main||'#22c55e'}60;color:${p.theme.colors.success?.main||'#22c55e'};`
    : p.$t==='info'
    ? `background:${p.theme.colors.primary.main}10;border:1px solid ${p.theme.colors.primary.main}40;color:${p.theme.colors.primary.main};`
    : `background:${p.theme.colors.error.main}12;border:1px solid ${p.theme.colors.error.main}60;color:${p.theme.colors.error.main};`}
`;

// Inherit toggle row (original)
const InheritRow = styled.div<{ theme: any }>`
  display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem 1rem;
  border:1px solid ${p => p.theme.colors.base[300]};
  border-radius:${p => p.theme.radius.field};
  background:${p => p.theme.colors.base[200]};
  cursor:pointer;transition:all 0.2s;margin-bottom:1rem;
  &:hover{border-color:${p => p.theme.colors.primary.main};background:${p => p.theme.colors.primary.main + '08'};}
`;
const InheritCheck = styled.div<{ theme: any; $on: boolean; $mixed?: boolean }>`
  width:18px;height:18px;min-width:18px;border-radius:4px;margin-top:1px;flex-shrink:0;
  border:2px solid ${p => p.$on ? p.theme.colors.primary.main : p.$mixed ? (p.theme.colors.warning?.main||'#f59e0b') : p.theme.colors.base[300]};
  background:${p => p.$on ? p.theme.colors.primary.main : 'transparent'};
  display:flex;align-items:center;justify-content:center;transition:all 0.2s;
  svg{width:10px;height:10px;color:white;display:${p => p.$on ? 'block' : 'none'};}
`;
const InheritText  = styled.div`flex:1;`;
const InheritLabel = styled.div`font-size:0.875rem;font-weight:600;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;`;
const InheritSub   = styled.div`font-size:0.775rem;opacity:0.55;margin-top:0.1rem;line-height:1.4;`;

const Footer = styled.div<{ theme: any }>`
  padding:1.25rem 1.5rem;border-top:1px solid ${p => p.theme.colors.base[300]};
  display:flex;align-items:center;gap:0.75rem;justify-content:flex-end;flex-shrink:0;
  background:${p => p.theme.colors.base[200]};
`;
const SplitGroup = styled.div`position:relative;display:inline-flex;`;
const SplitMain = styled.button<{ theme: any }>`
  display:inline-flex;align-items:center;gap:0.4rem;
  padding:0.55rem 0.9rem;
  border-radius:${p => p.theme.radius.field} 0 0 ${p => p.theme.radius.field};
  border:none;border-right:1px solid rgba(0,0,0,0.15);
  font-size:0.8375rem;font-weight:600;cursor:pointer;transition:all 0.15s;
  background:${p => p.theme.colors.base[300]};color:${p => p.theme.colors.base.content};
  &:hover:not(:disabled){opacity:0.88;transform:translateY(-1px);}
  &:disabled{opacity:0.45;cursor:not-allowed;transform:none;}
  svg{width:14px;height:14px;}
`;
const SplitChevron = styled.button<{ theme: any; $open: boolean }>`
  display:inline-flex;align-items:center;justify-content:center;padding:0.55rem 0.45rem;
  border-radius:0 ${p => p.theme.radius.field} ${p => p.theme.radius.field} 0;
  border:none;font-size:0.8375rem;font-weight:600;cursor:pointer;transition:all 0.15s;
  background:${p => p.$open ? p.theme.colors.base[200] : p.theme.colors.base[300]};
  color:${p => p.theme.colors.base.content};
  &:hover:not(:disabled){opacity:0.88;}
  &:disabled{opacity:0.45;cursor:not-allowed;}
  svg{width:11px;height:11px;transition:transform 0.15s;transform:rotate(${p => p.$open ? '180deg' : '0deg'});}
`;
const SplitMenu = styled.div<{ theme: any }>`
  position:absolute;bottom:calc(100% + 6px);right:0;min-width:170px;
  background:${p => p.theme.colors.base[100]};border:1px solid ${p => p.theme.colors.base[300]};
  border-radius:${p => p.theme.radius.field};box-shadow:0 8px 24px rgba(0,0,0,0.18);
  overflow:hidden;z-index:10;
`;
const SplitMenuItem = styled.button<{ theme: any }>`
  width:100%;padding:0.6rem 0.9rem;border:none;background:transparent;
  color:${p => p.theme.colors.base.content};font-size:0.8125rem;font-weight:500;
  cursor:pointer;text-align:left;display:flex;align-items:center;gap:0.5rem;transition:background 0.12s;
  &:hover{background:${p => p.theme.colors.base[300]};}
  svg{width:13px;height:13px;opacity:0.6;}
`;


// ─────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────
const IcoEmail     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const IcoClip      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>;
const IcoBrand     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IcoRegen     = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const IcoPersonal  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IcoTemplate  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>;
const IcoSend      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IcoCal       = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>;
const IcoCheck     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoUpload    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IcoSearch    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoWarn      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoLogoPlaceholder = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;

const ConfirmOverlay = styled.div<{ $open: boolean }>`
  position:fixed;inset:0;z-index:11000;
  background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
  display:${p => p.$open ? 'flex' : 'none'};
  align-items:center;justify-content:center;
`;
const ConfirmDialog = styled.div<{ theme: any }>`
  background:${p => p.theme.colors.base[200]};
  border:1px solid ${p => p.theme.colors.base[300]};
  border-radius:${p => p.theme.radius.box};
  padding:1.5rem;max-width:420px;width:90%;
  box-shadow:0 20px 40px rgba(0,0,0,0.4);
`;
const ConfirmActions = styled.div`display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;`;
const KeepBtn = styled.button<{ theme: any }>`
  padding:0.625rem 1.25rem;border-radius:${p => p.theme.radius.field};
  background:${p => p.theme.colors.base[200]};color:${p => p.theme.colors.base.content};
  border:1px solid ${p => p.theme.colors.base[300]};
  font-weight:500;font-size:0.875rem;cursor:pointer;transition:all 0.2s;
  &:hover{background:${p => p.theme.colors.base[300]};}
`;
const DiscardBtn = styled.button<{ theme: any }>`
  padding:0.625rem 1.25rem;border-radius:${p => p.theme.radius.field};
  background:${p => p.theme.colors.error.main};color:${p => p.theme.colors.error.content};
  border:none;font-weight:500;font-size:0.875rem;cursor:pointer;transition:all 0.2s;
  &:hover{opacity:0.9;}
`;

const UnsavedDialog: React.FC<{ open: boolean; theme: any; onKeep: () => void; onDiscard: () => void }> = ({ open, theme, onKeep, onDiscard }) => (
  <ConfirmOverlay $open={open} onClick={onKeep}>
    <ConfirmDialog theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem' }}>
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:36, height:36, borderRadius:'50%', background:(theme.colors.warning?.main||'#f59e0b')+'18', color:theme.colors.warning?.main||'#f59e0b', flexShrink:0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </span>
        <div>
          <div style={{ fontWeight:700, fontSize:'0.95rem', marginBottom:'0.2rem' }}>Unsaved changes</div>
          <div style={{ fontSize:'0.8125rem', opacity:0.6, lineHeight:1.4 }}>You have unsaved changes. Closing will discard them.</div>
        </div>
      </div>
      <ConfirmActions>
        <KeepBtn theme={theme} onClick={onKeep}>Keep editing</KeepBtn>
        <DiscardBtn theme={theme} onClick={onDiscard}>Discard changes</DiscardBtn>
      </ConfirmActions>
    </ConfirmDialog>
  </ConfirmOverlay>
);


const getExt = (f: string) => f.split('.').pop()?.toLowerCase() || '';

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
const BulkEmailModal: React.FC<BulkEmailModalProps> = ({
  isOpen, companies, campaignId, theme, apiBase, onClose, onToast, hasTemplateEmail,
}) => {
  // top-level view
  const [topTab, setTopTab] = useState<'companies'|'bulk-generation'|'bulk-attachments'|'bulk-branding'>('companies');

  // per-company state
  const [entries,    setEntries]    = useState<BulkEmailEntry[]>([]);
  const [activeIdx,  setActiveIdx]  = useState(0);

  // footer state
  const [bulkActing, setBulkActing] = useState<'send'|'schedule'|'gen-p'|'gen-t'|null>(null);
  const [schedTime,  setSchedTime]  = useState('');
  const [genProg,    setGenProg]    = useState({ done:0, total:0 });

  // bulk settings — attachment inheritance
  const [bulkAttachInherit, setBulkAttachInherit] = useState<true|false|'mixed'|null>(null);
  const [bulkAttachSaving,  setBulkAttachSaving]  = useState(false);
  const [bulkUploadFile,    setBulkUploadFile]    = useState<File|null>(null);
  const [bulkUploading,     setBulkUploading]     = useState(false);
  const [bulkUploadMsg,     setBulkUploadMsg]     = useState<{ok:boolean;text:string}|null>(null);
  const [bulkDrag,          setBulkDrag]          = useState(false);
  const [bulkAttachSearch,  setBulkAttachSearch]  = useState('');

  // bulk settings — branding inheritance
  const [bulkBrandInherit,  setBulkBrandInherit]  = useState<true|false|'mixed'|null>(null);
  const [bulkBrandSaving,   setBulkBrandSaving]   = useState(false);
  const [bulkSig,           setBulkSig]           = useState('');
  const [bulkLogo,          setBulkLogo]          = useState<string|null>(null);
  const [bulkBrandApplying, setBulkBrandApplying] = useState(false);
  const [bulkBrandApplyMsg, setBulkBrandApplyMsg] = useState<{ok:boolean;text:string}|null>(null);

  // Single combined message for inheritance toggles
  const [bulkInheritMsg, setBulkInheritMsg] = useState<{ok: boolean; text: string} | null>(null);

  // Confirmation gates — user must agree before bulk inheritance is applied
  const [attachConfirmed, setAttachConfirmed] = useState(false);
  const [brandConfirmed,  setBrandConfirmed]  = useState(false);
  // Track whether any individual-level change was made AFTER a bulk op was confirmed
  const [attachIndividualChanged, setAttachIndividualChanged] = useState(false);
  const [brandIndividualChanged,  setBrandIndividualChanged]  = useState(false);



  const schedRef      = useRef<HTMLInputElement>(null);
  const schedDropRef  = useRef<HTMLDivElement>(null);
  const uploadRefs    = useRef<(HTMLInputElement|null)[]>([]);
  const logoRefs      = useRef<(HTMLInputElement|null)[]>([]);
  const bulkUpRef     = useRef<HTMLInputElement>(null);
  const bulkLogoRef   = useRef<HTMLInputElement>(null);

  // smart schedule state
  const [showSmartSched,    setShowSmartSched]    = useState(false);
  const [showSched,         setShowSched]         = useState(false);
  const [schedDropOpen,     setSchedDropOpen]     = useState(false);
  const [smartStartTime,    setSmartStartTime]    = useState('');
  const [smartInitial,      setSmartInitial]      = useState('5');
  const [smartInterval,     setSmartInterval]     = useState('30');
  const [smartIntervalUnit, setSmartIntervalUnit] = useState<'minutes'|'hours'|'days'|'weeks'>('minutes');
  const [smartIncrement,    setSmartIncrement]    = useState('2');

  // ── dirty tracking ───────────────────────────────────────────
  const [isDirty,      setIsDirty]      = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const markDirty = () => setIsDirty(true);
  const handleClose = () => {
    if (isDirty) { setConfirmClose(true); return; }
    onClose();
  };

  const upd = (i: number, p: Partial<BulkEmailEntry>) => setEntries(prev => prev.map((e, j) => j===i ? {...e,...p} : e));
  const b64 = (f: File): Promise<string> => new Promise((res,rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });

  // ── init ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || companies.length===0) return;
    setTopTab('companies'); setActiveIdx(0);
    setShowSched(false); setSchedTime(''); setBulkActing(null);
    setShowSmartSched(false); setSmartStartTime(''); setSmartInitial('5'); setSmartInterval('30'); setSmartIntervalUnit('minutes'); setSmartIncrement('2'); setSchedDropOpen(false);
    setBulkAttachInherit(null); setBulkBrandInherit(null);
    setBulkInheritMsg(null); setBulkUploadFile(null); setBulkUploadMsg(null); setBulkAttachSearch('');
    setAttachConfirmed(false); setBrandConfirmed(false);
    setAttachIndividualChanged(false); setBrandIndividualChanged(false);
    setBulkSig(''); setBulkLogo(null); setBulkBrandApplyMsg(null);
    setIsDirty(false); setConfirmClose(false);
    const init: BulkEmailEntry[] = companies.map(c => ({
      company:c, emailId:null, subject:'', body:'', phase:'loading', activeTab:'email',
      allAttachments:[], linkedEmailAttachIds:new Set(), attachSearch:'',
      attachSaving:false, attachMsg:null, attachLoading:false,
      uploadFile:null, uploading:false, uploadMsg:null, isDragOver:false,
      inheritCampaignAttachments:1, inheritCampaignBranding:1, inheritedAttachIds:[],
      brandSignature:'', brandLogoData:null,
      campaignBrandSignature:'', campaignBrandLogoData:null,
      brandLogoUploading:false,
      brandSaving:false, brandMsg:null,
    }));
    setEntries(init);
    companies.forEach((c,i) => loadEntry(i,c));

  }, [isOpen, companies.map(c=>c.id).join(',')]);

  // sync bulk inherit toggles after entries load
  useEffect(() => {
    const ready = entries.filter(e => e.phase==='ready');
    if (!ready.length) return;
    const aOn = ready.every(e => e.inheritCampaignAttachments===1);
    const aOff= ready.every(e => e.inheritCampaignAttachments===0);
    setBulkAttachInherit(aOn ? true : aOff ? false : 'mixed');
    const bOn = ready.every(e => e.inheritCampaignBranding===1);
    const bOff= ready.every(e => e.inheritCampaignBranding===0);
    setBulkBrandInherit(bOn ? true : bOff ? false : 'mixed');
  }, [entries]);

  // close schedule dropdown on outside click
  useEffect(() => {
    if (!schedDropOpen) return;
    const h = (e: MouseEvent) => {
      if (schedDropRef.current && !schedDropRef.current.contains(e.target as Node))
        setSchedDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [schedDropOpen]);

  // ── load / populate / generate entry ────────────────────────
  const loadEntry = async (idx: number, company: Company) => {
    try {
      const r = await apiFetch(`${apiBase}/email/campaign/${campaignId}/company/${company.id}/primary/`);
      if (r.ok) {
        const d = await r.json();
        if (d.email_content?.trim()) await populateEntry(idx, company, d);
        else await generateEntry(idx, company, null);
      } else if (r.status===404) { await generateEntry(idx, company, null); }
      else { setEntries(p => p.map((e,i) => i===idx ? {...e,phase:'error'} : e)); }
    } catch { setEntries(p => p.map((e,i) => i===idx ? {...e,phase:'error'} : e)); }
  };

  const populateEntry = async (idx: number, company: Company, d: any) => {
    let all:AttachmentOption[]=[], linked=new Set<number>(), iA=1, iB=1;
    try {
      const [ar,lr,ir] = await Promise.all([
        apiFetch(`${apiBase}/attachments/?page=1&page_size=200`),
        apiFetch(`${apiBase}/email/${d.id}/attachments/`,        {}),
        apiFetch(`${apiBase}/campaign/${campaignId}/company/${company.id}/`),
      ]);
      if (ar.ok) { const ad=await ar.json(); all=ad.attachments??[]; }
      if (lr.ok) { const ld=await lr.json(); linked=new Set((ld.attachments??[]).map((a:any)=>a.id)); }
      if (ir.ok) { const id=await ir.json(); iA=id.inherit_campaign_attachments??1; iB=id.inherit_campaign_branding??1; }
    } catch {}
    setEntries(p => p.map((e,i) => i===idx ? {
      ...e, emailId:d.id, subject:d.email_subject||'', body:d.email_content||'',
      // When inheriting, store API values as campaign branding; own branding stays empty
      // When not inheriting, store API values as own branding
      brandSignature: iB===1 ? (e.brandSignature||'') : (d.signature||''),
      brandLogoData:  iB===1 ? (e.brandLogoData??null) : (d.logo_data||null),
      campaignBrandSignature: iB===1 ? (d.signature||'') : (e.campaignBrandSignature||d.signature||''),
      campaignBrandLogoData:  iB===1 ? (d.logo_data||null) : (e.campaignBrandLogoData??d.logo_data??null),
      inheritedAttachIds:d.attachment_ids??[], phase:'ready',
      allAttachments:all, linkedEmailAttachIds:linked,
      inheritCampaignAttachments:iA, inheritCampaignBranding:iB,
    } : e));
  };

  const generateEntry = async (idx: number, company: Company, personalized: boolean|null) => {
    setEntries(p => p.map((e,i) => i===idx ? {...e,phase:'loading'} : e));
    try {
      const qp = personalized===null ? '/' : `/?personalized=${personalized}`;
      const gr = await apiFetch(`${apiBase}/email/campaign/${campaignId}/company/${company.id}/generate-email${qp}`, {method:'POST'});
      if (!gr.ok) {
        const err=await gr.json();
        onToast('error','Generation Failed', err.detail||`Failed for ${company.name}`);
        setEntries(p => p.map((e,i) => i===idx ? {...e,phase:'error'} : e)); return;
      }
      const pr = await apiFetch(`${apiBase}/email/campaign/${campaignId}/company/${company.id}/primary/`);
      if (pr.ok) { await populateEntry(idx, company, await pr.json()); if (personalized!==null) onToast('success','Generated',`Email for ${company.name} regenerated`); }
      else { setEntries(p => p.map((e,i) => i===idx ? {...e,phase:'error'} : e)); }
    } catch { setEntries(p => p.map((e,i) => i===idx ? {...e,phase:'error'} : e)); }
  };

  // ── send / schedule ──────────────────────────────────────────
  const handleSendAll = async () => {
    if (bulkActing) return;
    setBulkActing('send')
    let sent=0,fail=0;
    await Promise.all(entries.filter(e=>e.phase==='ready'&&e.emailId).map(async e=>{
      try {
        await apiFetch(`${apiBase}/email/${e.emailId}/update/`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({email_subject:e.subject,email_content:e.body})});
        const r=await apiFetch(`${apiBase}/email/${e.emailId}/send/`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
        r.ok?sent++:fail++;
      } catch {fail++;}
    }));
    setBulkActing(null);
    if (sent>0) onToast('success','Emails Sent',`${sent} email${sent>1?'s':''} sent${fail?`, ${fail} failed`:''}`);
    else onToast('error','Send Failed',`All ${fail} failed`);
    onClose();
  };

  const handleScheduleAll = async () => {
    if (!schedTime||bulkActing) return;
    setBulkActing('schedule')
    const iso=new Date(schedTime).toISOString();
    let ok=0,fail=0;
    await Promise.all(entries.filter(e=>e.phase==='ready'&&e.emailId).map(async e=>{
      try {
        await apiFetch(`${apiBase}/email/${e.emailId}/update/`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({email_subject:e.subject,email_content:e.body})});
        const r=await apiFetch(`${apiBase}/email/${e.emailId}/send/`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({time:iso})});
        r.ok?ok++:fail++;
      } catch {fail++;}
    }));
    setBulkActing(null);
    if (ok>0) onToast('success','Scheduled',`${ok} email${ok>1?'s':''} scheduled${fail?`, ${fail} failed`:''}`);
    else onToast('error','Schedule Failed',`All ${fail} failed`);
    onClose();
  };

  const handleSmartSchedule = async () => {
    if (!smartStartTime || bulkActing) return;
    const readyIds = entries.filter(e => e.phase === 'ready' && e.emailId).map(e => e.emailId as number);
    if (!readyIds.length) return;
    setBulkActing('schedule');
    try {
      // Save any unsaved edits first
      await Promise.all(entries.filter(e => e.phase === 'ready' && e.emailId).map(async e => {
        try {
          await apiFetch(`${apiBase}/email/${e.emailId}/update/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email_subject: e.subject, email_content: e.body }),
          });
        } catch { /* best effort */ }
      }));
      const r = await apiFetch(`${apiBase}/email/smart-schedule/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify((() => {
          const unitMultiplier = smartIntervalUnit === 'hours' ? 60 : smartIntervalUnit === 'days' ? 1440 : smartIntervalUnit === 'weeks' ? 10080 : 1;
          return {
            email_ids:          readyIds,
            start_time:         new Date(smartStartTime).toISOString(),
            initial_companies:  Math.max(1, parseInt(smartInitial,  10) || 1),
            interval_minutes:   Math.max(1, parseInt(smartInterval,  10) || 1) * unitMultiplier,
            increment:          Math.max(0, parseInt(smartIncrement, 10) || 0),
          };
        })()),
      });
      if (r.ok) {
        const d = await r.json();
        onToast('success', 'Smart Schedule', d.message);
        onClose();
      } else {
        const err = await r.json();
        onToast('error', 'Smart Schedule Failed', err.detail || 'Failed to schedule');
      }
    } catch {
      onToast('error', 'Smart Schedule Failed', 'Unexpected error');
    }
    setBulkActing(null);
  };

  // ── bulk generate all ────────────────────────────────────────
  const handleBulkGen = async (personalized: boolean) => {
    const key = personalized?'gen-p':'gen-t';
    if (bulkActing) return;
    setBulkActing(key as any); setGenProg({done:0,total:entries.length});
    for (let i=0;i<entries.length;i++) {
      await generateEntry(i, entries[i].company, personalized);
      setGenProg(p=>({...p,done:p.done+1}));
    }
    setBulkActing(null);
    onToast('success','Regenerated',`All ${entries.length} emails regenerated (${personalized?'Personalised':'From Template'})`);
  };

  // ── bulk attachment inherit toggle ───────────────────────────
  const handleBulkAttachInherit = async (on: boolean) => {
    if (bulkAttachSaving) return;
    setBulkAttachInherit(on); 
    setBulkAttachSaving(true); 
    setBulkInheritMsg(null); // Clear any previous messages
    let ok = 0, fail = 0;
    await Promise.all(entries.map(async(e,i)=>{
      try {
        await apiFetch(`${apiBase}/campaign/${campaignId}/company/${e.company.id}/`,{
          method:'PUT', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({inherit_campaign_attachments:on?1:0, inherit_campaign_branding:e.inheritCampaignBranding}),
        });
        upd(i,{inheritCampaignAttachments:on?1:0}); ok++;
      } catch {fail++;}
    }));
    setBulkAttachSaving(false);
    
    // Only set message if this is the only operation or combine with branding if needed
    if (!bulkBrandSaving) {
      if (fail === 0) {
        setBulkInheritMsg({
          ok: true, 
          text: `Attachment inheritance ${on ? 'enabled' : 'disabled'} for all ${ok} companies`
        });
      } else {
        setBulkInheritMsg({
          ok: false, 
          text: `Failed to update attachment inheritance for ${fail} companies`
        });
      }
    }
  };

  // bulk upload — replaces all existing per-email attachments
  const handleBulkUpload = async () => {
    if (!bulkUploadFile) return;
    setBulkUploading(true); setBulkUploadMsg(null);
    try {
      const fd=new FormData(); fd.append('file',bulkUploadFile);
      const ur=await apiFetch(`${apiBase}/attachment/`,{method:'POST',body:fd});
      if(!ur.ok){const e=await ur.json();throw new Error(e.detail||'Upload failed');}
      const ud=await ur.json();
      let ok=0,fail=0;
      await Promise.all(entries.filter(e=>e.phase==='ready'&&e.emailId).map(async(e,_)=>{
        const i=entries.indexOf(e);
        try {
          // replace (not append) — clears previous attachments
          await apiFetch(`${apiBase}/email/${e.emailId}/attachments/`,{
            method:'PUT', headers:{'Content-Type':'application/json'},
            body:JSON.stringify([ud.id]),
          });
          upd(i,{linkedEmailAttachIds:new Set([ud.id])}); ok++;
        } catch {fail++;}
      }));
      // refresh global attachment list in all entries
      const aRes=await apiFetch(`${apiBase}/attachments/?page=1&page_size=200`,{});
      if(aRes.ok){const all=(await aRes.json()).attachments??[]; setEntries(p=>p.map(e=>({...e,allAttachments:all})));}
      setBulkUploadFile(null); if(bulkUpRef.current) bulkUpRef.current.value='';
      setBulkUploadMsg({ok:true,text:`"${ud.filename}" uploaded and applied to ${ok} email${ok!==1?'s':''}${fail?` (${fail} failed)`:''}`});
    } catch(e){
      setBulkUploadMsg({ok:false,text:e instanceof Error?e.message:'Upload failed'});
    }
    setBulkUploading(false);
  };

  const pickBulkFile = (f: File) => {
    const ext='.'+f.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)){setBulkUploadMsg({ok:false,text:`Invalid type. Allowed: ${ALLOWED_EXTS.join(', ')}`});return;}
    if (f.size>5*1024*1024){setBulkUploadMsg({ok:false,text:'File must be under 5 MB'});return;}
    setBulkUploadFile(f); setBulkUploadMsg(null); markDirty();
  };

  // ── bulk branding inherit toggle ─────────────────────────────
  const handleBulkBrandInherit = async (on: boolean) => {
    if (bulkBrandSaving) return;
    setBulkBrandInherit(on); 
    setBulkBrandSaving(true); 
    setBulkInheritMsg(null); // Clear any previous messages
    let ok = 0, fail = 0;
    await Promise.all(entries.map(async(e,i)=>{
      try {
        await apiFetch(`${apiBase}/campaign/${campaignId}/company/${e.company.id}/`,{
          method:'PUT', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({inherit_campaign_attachments:e.inheritCampaignAttachments, inherit_campaign_branding:on?1:0}),
        });
        upd(i,{inheritCampaignBranding:on?1:0}); ok++;
      } catch {fail++;}
    }));
    setBulkBrandSaving(false);
    
    // Only set message if this is the only operation or combine with attachments if needed
    if (!bulkAttachSaving) {
      if (fail === 0) {
        setBulkInheritMsg({
          ok: true, 
          text: `Branding inheritance ${on ? 'enabled' : 'disabled'} for all ${ok} companies`
        });
      } else {
        setBulkInheritMsg({
          ok: false, 
          text: `Failed to update branding inheritance for ${fail} companies`
        });
      }
    }
  };

  // bulk branding apply — overwrites logo + signature on all emails
  const handleBulkBrandApply = async () => {
    if (!bulkSig && !bulkLogo) return;
    setBulkBrandApplying(true); setBulkBrandApplyMsg(null);
    let ok=0,fail=0;
    await Promise.all(entries.filter(e=>e.phase==='ready'&&e.emailId).map(async(e,_)=>{
      const i=entries.indexOf(e);
      try {
        await apiFetch(`${apiBase}/email/${e.emailId}/update/`,{
          method:'PUT', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({signature:bulkSig,...(bulkLogo?{logo_data:bulkLogo}:{logo_clear:true})}),
        });
        upd(i,{brandSignature:bulkSig,brandLogoData:bulkLogo}); ok++;
      } catch {fail++;}
    }));
    setBulkBrandApplying(false);
    setBulkBrandApplyMsg(fail===0
      ? {ok:true,  text:`Branding applied to ${ok} email${ok!==1?'s':''}`}
      : {ok:false, text:`${fail} failed to update`});
  };

  // ── per-company helpers ──────────────────────────────────────
  const pickFile = (idx: number, f: File) => {
    const ext='.'+f.name.split('.').pop()?.toLowerCase();
    if(!ALLOWED_EXTS.includes(ext)){upd(idx,{uploadMsg:{type:'error',text:`Invalid type. Allowed: ${ALLOWED_EXTS.join(', ')}`}});return;}
    if(f.size>5*1024*1024){upd(idx,{uploadMsg:{type:'error',text:'File must be under 5 MB'}});return;}
    upd(idx,{uploadFile:f,uploadMsg:null}); markDirty();
  };
  const uploadFile = async (idx: number) => {
    const e=entries[idx]; if(!e.uploadFile||!e.emailId) return;
    upd(idx,{uploading:true,uploadMsg:null});
    try {
      const fd=new FormData(); fd.append('file',e.uploadFile);
      const ur=await apiFetch(`${apiBase}/attachment/`,{method:'POST',body:fd});
      if(!ur.ok){const err=await ur.json();throw new Error(err.detail||'Upload failed');}
      const ud=await ur.json();
      const ids=[...new Set([...Array.from(e.linkedEmailAttachIds),ud.id])];
      await apiFetch(`${apiBase}/email/${e.emailId}/attachments/`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(ids)});
      const ar=await apiFetch(`${apiBase}/attachments/?page=1&page_size=200`,{});
      const all=ar.ok?(await ar.json()).attachments??[]:e.allAttachments;
      upd(idx,{uploading:false,uploadFile:null,linkedEmailAttachIds:new Set(ids),allAttachments:all,uploadMsg:{type:'success',text:`"${ud.filename}" uploaded and attached`}});
      if(uploadRefs.current[idx]) uploadRefs.current[idx]!.value='';
      // Individual change after bulk — force re-confirmation
      if (attachConfirmed) { setAttachConfirmed(false); setAttachIndividualChanged(true); }
    } catch(err){upd(idx,{uploading:false,uploadMsg:{type:'error',text:err instanceof Error?err.message:'Upload failed'}});}
  };
  const toggleAttach=(idx:number,id:number)=>{const n=new Set(entries[idx].linkedEmailAttachIds);n.has(id)?n.delete(id):n.add(id);upd(idx,{linkedEmailAttachIds:n,attachMsg:null});};
  const saveAttachments=async(idx:number)=>{
    const e=entries[idx];if(!e.emailId) return;
    upd(idx,{attachSaving:true,attachMsg:null});
    try{
      const r=await apiFetch(`${apiBase}/email/${e.emailId}/attachments/`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify([...e.linkedEmailAttachIds])});
      if(!r.ok){const err=await r.json();throw new Error(err.detail||'Failed');}
      upd(idx,{attachSaving:false,attachMsg:{type:'success',text:'Attachments saved'}});
      // Individual change after bulk — force re-confirmation
      if (attachConfirmed) { setAttachConfirmed(false); setAttachIndividualChanged(true); }
    }catch(err){upd(idx,{attachSaving:false,attachMsg:{type:'error',text:err instanceof Error?err.message:'Failed'}});}
  };
  const saveInherit=async(idx:number,aV:number,bV:number)=>{
    const e=entries[idx];
    try{await apiFetch(`${apiBase}/campaign/${campaignId}/company/${e.company.id}/`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({inherit_campaign_attachments:aV,inherit_campaign_branding:bV})});}catch{}
  };
  const saveBranding=async(idx:number)=>{
    const e=entries[idx];if(!e.emailId) return;
    upd(idx,{brandSaving:true,brandMsg:null});
    try{
      await saveInherit(idx,e.inheritCampaignAttachments,e.inheritCampaignBranding);
      const r=await apiFetch(`${apiBase}/email/${e.emailId}/update/`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({signature:e.brandSignature??'',...(e.brandLogoData?{logo_data:e.brandLogoData}:{logo_clear:true})})});
      if(!r.ok){const err=await r.json();throw new Error(err.detail||'Failed');}
      upd(idx,{brandSaving:false,brandMsg:{type:'success',text:'Branding saved'}});
      // Individual change after bulk — force re-confirmation
      if (brandConfirmed) { setBrandConfirmed(false); setBrandIndividualChanged(true); }
    }catch(err){upd(idx,{brandSaving:false,brandMsg:{type:'error',text:err instanceof Error?err.message:'Failed'}});}
  };

  // ── derived ──────────────────────────────────────────────────
  const minDT = (() => {
    const d=new Date(Date.now()+60000), z=(n:number)=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
  })();
  const readyCount  = entries.filter(e=>e.phase==='ready'&&e.emailId).length;
  const entry       = entries[activeIdx];
  const isGenning   = bulkActing==='gen-p'||bulkActing==='gen-t';
  const genPct      = genProg.total>0 ? Math.round(genProg.done/genProg.total*100) : 0;
  const allSettled  = entries.length > 0 && entries.every(e => e.phase === 'ready' || e.phase === 'error');
  const doneCount   = entries.filter(e => e.phase === 'ready' || e.phase === 'error').length;
  const ALLOWED_EXTS = ['.pdf', '.doc', '.docx', '.txt', '.csv'];

  if (!isOpen) return null;

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <Overlay $open={isOpen} onClick={!allSettled ? undefined : handleClose}>
      {!allSettled ? (
        /* ── Loading overlay — wait for all emails to generate ── */
        <ModalBox theme={theme} $open={isOpen} onClick={e=>e.stopPropagation()}
          style={{maxWidth:400, height:'auto', padding:'2.5rem 2rem', alignItems:'center', justifyContent:'center', gap:'1.25rem'}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'1rem',textAlign:'center'}}>
            <LoadSpinner theme={theme} />
            <div>
              <div style={{fontWeight:700,fontSize:'0.95rem',marginBottom:'0.3rem'}}>Preparing emails…</div>
              <div style={{fontSize:'0.8rem',opacity:0.5}}>{doneCount} of {entries.length} done</div>
            </div>
            {/* Progress bar */}
            <div style={{width:'100%',height:4,borderRadius:999,background:theme.colors.base[300],overflow:'hidden'}}>
              <div style={{
                height:'100%',borderRadius:999,
                background:theme.colors.primary.main,
                width:`${entries.length > 0 ? Math.round(doneCount/entries.length*100) : 0}%`,
                transition:'width 0.3s ease',
              }}/>
            </div>
          </div>
        </ModalBox>
      ) : (
      <>
      <ModalBox theme={theme} $open={isOpen} onClick={e=>e.stopPropagation()}>

        {/* ── header ── */}
        <ModalHeader theme={theme}>
          <ModalTitle>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            Bulk Email
            <span style={{fontSize:'0.75rem',fontWeight:400,opacity:0.45}}>· {companies.length} compan{companies.length!==1?'ies':'y'}</span>
          </ModalTitle>
          <CloseBtn theme={theme} onClick={handleClose}>✕</CloseBtn>
        </ModalHeader>

        {/* ── top tab bar ── */}
        <TopTabBar theme={theme}>
          <TopTab theme={theme} $active={topTab==='companies'} onClick={()=>setTopTab('companies')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
            </svg>
            Companies
            <span style={{fontSize:'0.65rem',fontWeight:700,background:theme.colors.primary.main+'20',color:theme.colors.primary.main,border:`1px solid ${theme.colors.primary.main}40`,borderRadius:'999px',padding:'1px 6px'}}>
              {entries.length}
            </span>
          </TopTab>
          <TopTab theme={theme} $active={topTab==='bulk-generation'} onClick={()=>setTopTab('bulk-generation')}>
            <IcoRegen />
            Bulk Generation
          </TopTab>
          <TopTab theme={theme} $active={topTab==='bulk-attachments'} onClick={()=>setTopTab('bulk-attachments')}>
            <IcoClip />
            Bulk Attachments
          </TopTab>
          <TopTab theme={theme} $active={topTab==='bulk-branding'} onClick={()=>setTopTab('bulk-branding')}>
            <IcoBrand />
            Bulk Branding
          </TopTab>
        </TopTabBar>

        {/* ════════════════════════════════════════════
            COMPANIES TAB
        ════════════════════════════════════════════ */}
        {topTab==='companies' && (
          <TwoCol>
            {/* left nav */}
            <CompanyNav theme={theme}>
              <NavLabel theme={theme}>Companies</NavLabel>
              {entries.map((e,idx)=>(
                <NavItem key={e.company.id} theme={theme} $active={idx===activeIdx} onClick={()=>setActiveIdx(idx)}>
                  {e.phase==='loading' ? <MiniSpinner /> : e.phase==='error' ? <span style={{fontSize:'0.72rem',color:theme.colors.error?.main||'#ef4444'}}>⚠</span> : <StatusDot theme={theme} $phase={e.phase}/>}
                  <NavName>{e.company.name}</NavName>
                </NavItem>
              ))}
            </CompanyNav>

            {/* right pane */}
            <EmailPane>
              {entry ? (
                <>
                  {entry.phase==='ready' && (
                    <InnerTabBar theme={theme}>
                      <InnerTab theme={theme} $active={entry.activeTab==='email'} onClick={()=>upd(activeIdx,{activeTab:'email'})}>
                        <IcoEmail/>Email
                      </InnerTab>
                      <InnerTab theme={theme} $active={entry.activeTab==='attachments'} onClick={()=>upd(activeIdx,{activeTab:'attachments'})}>
                        <IcoClip/>Attachments
                        {!entry.inheritCampaignAttachments&&entry.linkedEmailAttachIds.size>0&&(
                          <span style={{fontSize:'0.63rem',fontWeight:700,background:theme.colors.primary.main+'20',color:theme.colors.primary.main,border:`1px solid ${theme.colors.primary.main}40`,borderRadius:'999px',padding:'1px 5px'}}>
                            {entry.linkedEmailAttachIds.size}
                          </span>
                        )}
                      </InnerTab>
                      <InnerTab theme={theme} $active={entry.activeTab==='branding'} onClick={()=>upd(activeIdx,{activeTab:'branding'})}>
                        <IcoBrand/>Branding
                      </InnerTab>
                    </InnerTabBar>
                  )}

                  {entry.phase==='loading' && <LoadBox><Spinner/><div style={{fontSize:'0.875rem'}}>Loading email for {entry.company.name}…</div></LoadBox>}
                  {entry.phase==='error'   && (
                    <div style={{padding:'3rem',textAlign:'center',color:theme.colors.error?.main||'#ef4444'}}>
                      <div style={{fontSize:'1.5rem',marginBottom:'0.5rem'}}>⚠️</div>
                      <div style={{fontWeight:600,marginBottom:'0.75rem'}}>Failed to load email for {entry.company.name}</div>
                      <button onClick={()=>loadEntry(activeIdx,entry.company)} style={{padding:'0.5rem 1.2rem',borderRadius:theme.radius.field,border:'none',background:theme.colors.primary.main,color:theme.colors.primary.content,cursor:'pointer',fontWeight:600}}>Retry</button>
                    </div>
                  )}

                  {/* EMAIL TAB */}
                  {entry.phase==='ready'&&entry.activeTab==='email'&&(
                    <Scroll>
                      <div style={{display:'flex',alignItems:'center',gap:'0.5rem',flexWrap:'wrap'}}>
                        <span style={{fontSize:'0.72rem',fontWeight:600,opacity:0.4,textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>Regenerate:</span>
                        <GenBtn theme={theme} disabled={!!bulkActing} onClick={()=>generateEntry(activeIdx,entry.company,true)}>
                          <IcoRegen/><IcoPersonal/> Personalised
                        </GenBtn>
                        <span title={!hasTemplateEmail?'No template email set':undefined} style={{display:'inline-flex'}}>
                          <GenBtn theme={theme} disabled={!!bulkActing||!hasTemplateEmail} onClick={()=>hasTemplateEmail&&generateEntry(activeIdx,entry.company,false)} style={!hasTemplateEmail?{opacity:0.38,cursor:'not-allowed'}:{}}>
                            <IcoRegen/><IcoTemplate/> From Template
                          </GenBtn>
                        </span>
                      </div>
                      <div><FieldLbl theme={theme}>Subject</FieldLbl><SubjectIn theme={theme} value={entry.subject} onChange={e=>{upd(activeIdx,{subject:e.target.value});markDirty();}} placeholder="Email subject…"/></div>
                      <div><FieldLbl theme={theme}>Body</FieldLbl><BodyTA theme={theme} value={entry.body} onChange={e=>{upd(activeIdx,{body:e.target.value});markDirty();}} placeholder="Email body…"/></div>
                    </Scroll>
                  )}

                  {/* ATTACHMENTS TAB */}
                  {entry.phase==='ready'&&entry.activeTab==='attachments'&&(()=>{
                    const filtered=entry.allAttachments.filter(a=>a.filename.toLowerCase().includes(entry.attachSearch.toLowerCase()));
                    const attached=filtered.filter(a=>entry.linkedEmailAttachIds.has(a.id));
                    const notAtt=filtered.filter(a=>!entry.linkedEmailAttachIds.has(a.id));
                    const inherited=entry.allAttachments.filter(a=>entry.inheritedAttachIds.includes(a.id));
                    return (
                      <ScrollFlush>
                        <InheritRow theme={theme} onClick={()=>{
                          const v=entry.inheritCampaignAttachments?0:1;
                          upd(activeIdx,{inheritCampaignAttachments:v});
                          saveInherit(activeIdx,v,entry.inheritCampaignBranding);
                          // Reset bulk attachments confirmation gate
                          setAttachConfirmed(false);
                          setAttachIndividualChanged(true);
                        }}>
                          <InheritCheck theme={theme} $on={!!entry.inheritCampaignAttachments}><IcoCheck/></InheritCheck>
                          <InheritText><InheritLabel>Inherit Campaign Attachments</InheritLabel><InheritSub>Include all attachments from campaign preferences when sent</InheritSub></InheritText>
                        </InheritRow>
                        {entry.inheritCampaignAttachments?(
                          <div style={{display:'flex',flexDirection:'column',gap:'0.6rem'}}>
                            <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.06em',color:theme.colors.primary.main,opacity:0.8}}>Inherited ({inherited.length})</div>
                            <AttachList theme={theme}>
                              {inherited.length===0?<AttachEmpty theme={theme}>No attachments inherited from campaign</AttachEmpty>
                                :inherited.map(a=>{const ext=getExt(a.filename);return(<AttachRow key={a.id} theme={theme} $checked={false} style={{cursor:'default'}} onClick={()=>{}}><ExtBadge $ext={ext}>{ext||'?'}</ExtBadge><AttachName>{a.filename}</AttachName></AttachRow>);})}
                            </AttachList>
                          </div>
                        ):(
                          <>
                            <div style={{marginBottom:'1rem'}}>
                              <div onDragOver={e=>{e.preventDefault();upd(activeIdx,{isDragOver:true});}} onDragLeave={()=>upd(activeIdx,{isDragOver:false})}
                                onDrop={e=>{e.preventDefault();upd(activeIdx,{isDragOver:false});const f=e.dataTransfer.files[0];if(f&&!entry.uploading)pickFile(activeIdx,f);}}
                                onClick={()=>!entry.uploading&&uploadRefs.current[activeIdx]?.click()}
                                style={{border:`2px dashed ${entry.isDragOver?theme.colors.primary.main:entry.uploadFile?theme.colors.primary.main+'80':theme.colors.base[300]}`,borderRadius:theme.radius.field,background:entry.isDragOver?theme.colors.primary.main+'08':theme.colors.base[200],padding:'0.85rem 1rem',cursor:entry.uploading?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:'0.75rem',opacity:entry.uploading?0.65:1}}>
                                <div style={{width:34,height:34,borderRadius:7,flexShrink:0,background:entry.uploadFile?theme.colors.primary.main+'15':theme.colors.base[300],display:'flex',alignItems:'center',justifyContent:'center',color:entry.uploadFile?theme.colors.primary.main:theme.colors.base.content,opacity:entry.uploadFile?1:0.4}}><IcoUpload/></div>
                                <div style={{flex:1,minWidth:0}}>
                                  {entry.uploadFile?<><div style={{fontSize:'0.84rem',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{entry.uploadFile.name}</div><div style={{fontSize:'0.73rem',opacity:0.5}}>{(entry.uploadFile.size/1024).toFixed(0)} KB</div></>
                                    :<><div style={{fontSize:'0.84rem',fontWeight:600,opacity:0.65}}>Click or drag to upload</div><div style={{fontSize:'0.73rem',opacity:0.4,marginTop:'1px'}}>PDF, DOC, DOCX, TXT, CSV · Max 5 MB</div></>}
                                </div>
                                <input ref={el=>{uploadRefs.current[activeIdx]=el;}} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)pickFile(activeIdx,f);e.target.value='';}} disabled={entry.uploading}/>
                              </div>
                              {entry.uploadFile&&<div style={{marginTop:'0.5rem'}}><SaveBtn theme={theme} onClick={()=>uploadFile(activeIdx)} disabled={entry.uploading} style={{padding:'0.45rem 0.9rem',fontSize:'0.8rem'}}>{entry.uploading?'Uploading…':'Upload & Attach'}</SaveBtn></div>}
                              {entry.uploadMsg&&<InlineBanner theme={theme} $t={entry.uploadMsg.type}>{entry.uploadMsg.text}</InlineBanner>}
                            </div>
                            <div style={{height:1,background:theme.colors.base[300],marginBottom:'0.9rem'}}/>
                            <div style={{position:'relative',marginBottom:'0.75rem'}}>
                              <span style={{position:'absolute',left:'0.6rem',top:'50%',transform:'translateY(-50%)',opacity:0.4,display:'flex',pointerEvents:'none'}}><IcoSearch/></span>
                              <AttachSearch theme={theme} placeholder="Search files…" value={entry.attachSearch} onChange={e=>upd(activeIdx,{attachSearch:e.target.value})}
                                style={{paddingLeft:'2rem'}}/>
                            </div>
                            <div style={{marginBottom:'0.75rem'}}>
                              <div style={{display:'flex',alignItems:'center',gap:'0.45rem',marginBottom:'0.3rem'}}>
                                <span style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.06em',color:theme.colors.primary.main}}>Attached</span>
                                <span style={{fontSize:'0.66rem',fontWeight:600,background:theme.colors.primary.main+'20',color:theme.colors.primary.main,border:`1px solid ${theme.colors.primary.main}40`,borderRadius:'999px',padding:'1px 5px'}}>{attached.length}</span>
                              </div>
                              <AttachList theme={theme}>
                                {attached.length===0?<AttachEmpty theme={theme}>No files attached</AttachEmpty>
                                  :attached.map(a=>{const ext=getExt(a.filename);return(<AttachRow key={a.id} theme={theme} $checked onClick={()=>toggleAttach(activeIdx,a.id)}><AttachBox theme={theme} $checked><IcoCheck/></AttachBox><ExtBadge $ext={ext}>{ext||'?'}</ExtBadge><AttachName>{a.filename}</AttachName><span style={{fontSize:'0.68rem',opacity:0.35}}>detach</span></AttachRow>);})}
                              </AttachList>
                            </div>
                            <div style={{marginBottom:'0.75rem'}}>
                              <div style={{display:'flex',alignItems:'center',gap:'0.45rem',marginBottom:'0.3rem'}}>
                                <span style={{fontSize:'0.7rem',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.06em',opacity:0.45}}>Not Attached</span>
                                <span style={{fontSize:'0.66rem',fontWeight:600,background:theme.colors.base[300],borderRadius:'999px',padding:'1px 5px',opacity:0.55}}>{notAtt.length}</span>
                              </div>
                              <AttachList theme={theme}>
                                {notAtt.length===0?<AttachEmpty theme={theme}>All files are attached</AttachEmpty>
                                  :notAtt.map(a=>{const ext=getExt(a.filename);return(<AttachRow key={a.id} theme={theme} $checked={false} onClick={()=>toggleAttach(activeIdx,a.id)}><AttachBox theme={theme} $checked={false}/><ExtBadge $ext={ext}>{ext||'?'}</ExtBadge><AttachName>{a.filename}</AttachName><span style={{fontSize:'0.68rem',opacity:0.35}}>attach</span></AttachRow>);})}
                              </AttachList>
                            </div>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'0.25rem'}}>
                              <span style={{fontSize:'0.78rem',opacity:0.45}}>{entry.allAttachments.length} file{entry.allAttachments.length!==1?'s':''} total</span>
                              <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
                                {entry.attachMsg&&<MsgLine theme={theme} $ok={entry.attachMsg.type==='success'}>{entry.attachMsg.text}</MsgLine>}
                                <SaveBtn theme={theme} onClick={()=>saveAttachments(activeIdx)} disabled={entry.attachSaving} style={{padding:'0.45rem 1rem',fontSize:'0.8rem'}}>{entry.attachSaving?'Saving…':'Save'}</SaveBtn>
                              </div>
                            </div>
                          </>
                        )}
                      </ScrollFlush>
                    );
                  })()}

                  {/* BRANDING TAB */}
                  {entry.phase==='ready'&&entry.activeTab==='branding'&&(
                    <ScrollFlush>
                      <InheritRow theme={theme} onClick={()=>{
                        const v=entry.inheritCampaignBranding?0:1;
                        upd(activeIdx,{inheritCampaignBranding:v});
                        saveInherit(activeIdx,entry.inheritCampaignAttachments,v);
                        // Reset bulk branding confirmation gate so bulk changes re-confirm
                        setBrandConfirmed(false);
                        setBrandIndividualChanged(true);
                      }}>
                        <InheritCheck theme={theme} $on={!!entry.inheritCampaignBranding}><IcoCheck/></InheritCheck>
                        <InheritText><InheritLabel>Inherit Campaign Branding</InheritLabel><InheritSub>Use campaign logo and signature for this email</InheritSub></InheritText>
                      </InheritRow>
                      {entry.inheritCampaignBranding?(
                        <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
                          <div style={{fontSize:'0.8rem',fontWeight:600,opacity:0.75}}>Logo</div>
                          {entry.campaignBrandLogoData?<div style={{display:'inline-block',border:`1px solid ${theme.colors.base[300]}`,borderRadius:theme.radius.field,padding:'0.4rem',background:theme.colors.base[200]}}><img src={entry.campaignBrandLogoData} alt="Logo" style={{maxHeight:44,maxWidth:160,objectFit:'contain',display:'block'}}/></div>:<div style={{fontSize:'0.8rem',opacity:0.38,fontStyle:'italic'}}>No logo set</div>}
                          <div style={{fontSize:'0.8rem',fontWeight:600,opacity:0.75}}>Signature</div>
                          {entry.campaignBrandSignature?<div style={{background:theme.colors.base[200],border:`1px solid ${theme.colors.base[300]}`,borderRadius:theme.radius.field,padding:'0.55rem 0.75rem',fontSize:'0.82rem',whiteSpace:'pre-wrap',lineHeight:1.55,opacity:0.75}}>{entry.campaignBrandSignature}</div>:<div style={{fontSize:'0.8rem',opacity:0.38,fontStyle:'italic'}}>No signature set</div>}
                          <div style={{fontSize:'0.77rem',opacity:0.43}}>Disable <strong>Inherit Campaign Branding</strong> above to set per-email logo and signature.</div>
                        </div>
                      ):(
                        <>
                          <div style={{marginBottom:'1.1rem'}}>
                            <div style={{fontSize:'0.8rem',fontWeight:600,marginBottom:'0.35rem',opacity:0.8}}>Logo <span style={{fontSize:'0.7rem',fontWeight:400,opacity:0.5}}>PNG, JPG, GIF or WebP · max 5 MB</span></div>
                            <LogoZone theme={theme} $has={!!entry.brandLogoData} onClick={()=>!entry.brandLogoUploading&&logoRefs.current[activeIdx]?.click()} onDragOver={e=>e.preventDefault()} onDrop={async e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&!entry.brandLogoUploading){const d=await b64(f);upd(activeIdx,{brandLogoData:d});}}}>
                              {entry.brandLogoData?<><LogoImg src={entry.brandLogoData} alt="Logo"/><LogoRemoveButton theme={theme} type="button" onClick={e=>{e.stopPropagation();upd(activeIdx,{brandLogoData:null});}}>✕</LogoRemoveButton></>:<LogoHint><IcoLogoPlaceholder/><span>Click or drag to upload</span></LogoHint>}
                            </LogoZone>
                            <input ref={el=>{logoRefs.current[activeIdx]=el;}} type="file" accept="image/*" style={{display:'none'}} onChange={async e=>{const f=e.target.files?.[0];if(f){const d=await b64(f);upd(activeIdx,{brandLogoData:d});}e.target.value='';}}/>
                          </div>
                          <div style={{marginBottom:'1.1rem'}}>
                            <div style={{fontSize:'0.8rem',fontWeight:600,marginBottom:'0.35rem',opacity:0.8}}>Email Signature</div>
                            <textarea rows={4} placeholder={'Best,\nJohn Smith\nAcme Corp'} value={entry.brandSignature} onChange={e=>{upd(activeIdx,{brandSignature:e.target.value,brandMsg:null});markDirty();}}
                              style={{width:'100%',padding:'0.65rem 0.9rem',border:`1px solid ${theme.colors.base[300]}`,borderRadius:theme.radius.field,background:theme.colors.base[200],color:theme.colors.base.content,fontSize:'0.875rem',fontFamily:'inherit',resize:'vertical' as const,minHeight:80,boxSizing:'border-box' as const}}/>
                          </div>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:'0.6rem'}}>
                            {entry.brandMsg&&<MsgLine theme={theme} $ok={entry.brandMsg.type==='success'}>{entry.brandMsg.text}</MsgLine>}
                            <SaveBtn theme={theme} onClick={()=>saveBranding(activeIdx)} disabled={entry.brandSaving} style={{padding:'0.45rem 1rem',fontSize:'0.8rem'}}>{entry.brandSaving?'Saving…':'Save'}</SaveBtn>
                          </div>
                        </>
                      )}
                    </ScrollFlush>
                  )}
                </>
              ):(
                <LoadBox><Spinner/></LoadBox>
              )}
            </EmailPane>
          </TwoCol>
        )}

        {/* ════════════════════════════════════════════
            BULK ACTIONS TAB - WITH CLEAN SPACING
        ════════════════════════════════════════════ */}
        {/* ════ BULK GENERATION TAB ════ */}
        {topTab === 'bulk-generation' && (
          <BulkPane>
            <PanelTitle theme={theme} style={{ marginBottom: '0.25rem' }}>Generate All Emails</PanelTitle>
            <PanelSubtitle theme={theme} style={{ marginBottom: '1.25rem' }}>
              Regenerate emails for all {entries.length} companies at once
            </PanelSubtitle>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Btn theme={theme} $v="primary" disabled={!!bulkActing} onClick={() => handleBulkGen(true)} style={{ minWidth: '140px' }}>
                {bulkActing === 'gen-p' ? <MiniSpinner /> : <><IcoRegen /><IcoPersonal /></>}
                {bulkActing === 'gen-p' && genProg.total > 0 ? `${genProg.done}/${genProg.total}…` : 'Personalised'}
              </Btn>
              <Btn theme={theme} $v={hasTemplateEmail ? 'primary' : 'default'} disabled={!!bulkActing || !hasTemplateEmail}
                onClick={() => hasTemplateEmail && handleBulkGen(false)}
                style={{ minWidth: '140px', opacity: !hasTemplateEmail ? 0.5 : 1, cursor: !hasTemplateEmail ? 'not-allowed' : 'pointer' }}>
                {bulkActing === 'gen-t' ? <MiniSpinner /> : <><IcoRegen /><IcoTemplate /></>}
                {bulkActing === 'gen-t' && genProg.total > 0 ? `${genProg.done}/${genProg.total}…` : 'From Template'}
              </Btn>
            </div>
            {isGenning && (
              <div style={{ marginTop: '1rem' }}>
                <ProgressTrack theme={theme}><ProgressFill theme={theme} $pct={genPct} /></ProgressTrack>
                <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{genProg.done} of {genProg.total} generated</span>
                  <span>{genPct}%</span>
                </div>
              </div>
            )}
          </BulkPane>
        )}

        {/* ════ BULK ATTACHMENTS TAB ════ */}
        {topTab === 'bulk-attachments' && !attachConfirmed && (
          <BulkPane>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 520 }}>
              <PanelTitle theme={theme}>Bulk Attachments</PanelTitle>
              {attachIndividualChanged ? (
                <>
                  <PanelSubtitle theme={theme} style={{ marginBottom: 0 }}>
                    You've made individual attachment changes to one or more companies since the last bulk operation.
                    Proceeding will overwrite those individual changes across all {entries.length} companies.
                  </PanelSubtitle>
                  <AlertBox theme={theme} $variant="warn">
                    <IcoWarn />
                    <div><strong>Individual changes will be lost.</strong> Some companies had their attachments updated individually — bulk settings will replace them all.</div>
                  </AlertBox>
                </>
              ) : (
                <>
                  <PanelSubtitle theme={theme} style={{ marginBottom: 0 }}>
                    This lets you set the same attachment inheritance and files across all {entries.length} companies at once.
                    Each company's current attachment setting will be overwritten.
                  </PanelSubtitle>
                  <AlertBox theme={theme} $variant="warn">
                    <IcoWarn />
                    <div><strong>This will overwrite all companies.</strong> Their individual attachment settings will be replaced with whatever you set here.</div>
                  </AlertBox>
                </>
              )}
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <Btn theme={theme} $v="primary" onClick={() => {
                  setAttachConfirmed(true);
                  setAttachIndividualChanged(false);
                  const firstReady = entries.find(e => e.phase === 'ready');
                  if (firstReady) handleBulkAttachInherit(firstReady.inheritCampaignAttachments === 1);
                }}>
                  {attachIndividualChanged ? 'Yes, overwrite individual changes' : 'Yes, manage bulk attachments'}
                </Btn>
                <Btn theme={theme} onClick={() => setTopTab('companies')}>Cancel</Btn>
              </div>
            </div>
          </BulkPane>
        )}
        {topTab === 'bulk-attachments' && attachConfirmed && (
          <ScrollFlush>
            {bulkInheritMsg && (
              <Msg theme={theme} $type={bulkInheritMsg.ok ? 'success' : 'error'} style={{ marginBottom: '1rem' }}>
                {bulkInheritMsg.text}
              </Msg>
            )}

            {/* Inherit toggle row */}
            <InheritRow theme={theme} onClick={() => !bulkAttachSaving && handleBulkAttachInherit(bulkAttachInherit !== true)}
              style={{ cursor: bulkAttachSaving ? 'not-allowed' : 'pointer', opacity: bulkAttachSaving ? 0.6 : 1 }}>
              <InheritCheck theme={theme} $on={bulkAttachInherit === true} $mixed={bulkAttachInherit === 'mixed'}>
                {bulkAttachInherit === true && <IcoCheck />}
                {bulkAttachInherit === 'mixed' && <span style={{ color: theme.colors.warning?.main || '#f59e0b', fontSize: '0.75rem', lineHeight: 1 }}>—</span>}
              </InheritCheck>
              <InheritText>
                <InheritLabel>
                  Inherit Campaign Attachments
                  {bulkAttachInherit === 'mixed' && <MixedBadgeStyle theme={theme}>Mixed</MixedBadgeStyle>}
                </InheritLabel>
                <InheritSub>
                  {bulkAttachInherit === true && 'Enabled — all companies inherit from campaign preferences'}
                  {bulkAttachInherit === false && 'Disabled — companies use their own attachment lists'}
                  {bulkAttachInherit === 'mixed' && 'Mixed — click to sync for all companies'}
                  {bulkAttachInherit === null && 'Loading…'}
                </InheritSub>
              </InheritText>
              {bulkAttachSaving && <MiniSpinner />}
            </InheritRow>

            {/* Inherit ON: show inherited files */}
            {bulkAttachInherit === true && (() => {
              const firstReady = entries.find(e => e.phase === 'ready');
              const inherited = firstReady ? firstReady.allAttachments.filter(a => firstReady.inheritedAttachIds.includes(a.id)) : [];
              return (
                <>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: theme.colors.primary.main, opacity: 0.8, marginBottom: '0.4rem' }}>
                    Inherited from Campaign ({inherited.length})
                  </div>
                  <AttachList theme={theme}>
                    {inherited.length === 0
                      ? <AttachEmpty theme={theme}>No attachments set in campaign preferences</AttachEmpty>
                      : inherited.map(a => { const ext = getExt(a.filename); return (
                          <AttachRow key={a.id} theme={theme} $checked={false} style={{ cursor: 'default' }} onClick={() => {}}>
                            <ExtBadge $ext={ext}>{ext || '?'}</ExtBadge>
                            <AttachName>{a.filename}</AttachName>
                          </AttachRow>
                        ); })}
                  </AttachList>
                </>
              );
            })()}

            {/* Inherit OFF: upload + attached/not-attached lists */}
            {bulkAttachInherit === false && (() => {
              const allFiles = entries.find(e => e.phase === 'ready')?.allAttachments ?? [];
              const readyEntries = entries.filter(e => e.phase === 'ready' && e.emailId);
              const filteredFiles = allFiles.filter(a => a.filename.toLowerCase().includes(bulkAttachSearch.toLowerCase()));
              const attachedToAll = filteredFiles.filter(a => readyEntries.length > 0 && readyEntries.every(e => e.linkedEmailAttachIds.has(a.id)));
              const notAttachedToAll = filteredFiles.filter(a => !readyEntries.every(e => e.linkedEmailAttachIds.has(a.id)));
              const toggleBulkAttach = (id: number, attach: boolean) => {
                setEntries(prev => prev.map(e => {
                  if (e.phase !== 'ready') return e;
                  const s = new Set(e.linkedEmailAttachIds);
                  attach ? s.add(id) : s.delete(id);
                  return { ...e, linkedEmailAttachIds: s, attachMsg: null };
                }));
              };
              const saveBulkAttachments = async () => {
                setBulkAttachSaving(true);
                let ok = 0, fail = 0;
                await Promise.all(readyEntries.map(async e => {
                  try {
                    await apiFetch(`${apiBase}/email/${e.emailId}/attachments/`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([...e.linkedEmailAttachIds]) });
                    ok++;
                  } catch { fail++; }
                }));
                setBulkAttachSaving(false);
                setBulkInheritMsg(fail === 0
                  ? { ok: true, text: `Attachments saved for ${ok} email${ok !== 1 ? 's' : ''}` }
                  : { ok: false, text: `${fail} failed to save` });
              };
              return (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <div
                      onDragOver={e => { e.preventDefault(); setBulkDrag(true); }}
                      onDragLeave={() => setBulkDrag(false)}
                      onDrop={e => { e.preventDefault(); setBulkDrag(false); const f = e.dataTransfer.files[0]; if (f && !bulkUploading) pickBulkFile(f); }}
                      onClick={() => !bulkUploading && bulkUpRef.current?.click()}
                      style={{ border: `2px dashed ${bulkDrag ? theme.colors.primary.main : bulkUploadFile ? theme.colors.primary.main + '80' : theme.colors.base[300]}`, borderRadius: theme.radius.field, background: bulkDrag ? theme.colors.primary.main + '08' : theme.colors.base[200], padding: '0.85rem 1rem', cursor: bulkUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: bulkUploading ? 0.65 : 1 }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 7, flexShrink: 0, background: bulkUploadFile ? theme.colors.primary.main + '15' : theme.colors.base[300], display: 'flex', alignItems: 'center', justifyContent: 'center', color: bulkUploadFile ? theme.colors.primary.main : theme.colors.base.content, opacity: bulkUploadFile ? 1 : 0.4 }}><IcoUpload /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {bulkUploadFile
                          ? <><div style={{ fontSize: '0.84rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bulkUploadFile.name}</div><div style={{ fontSize: '0.73rem', opacity: 0.5 }}>{(bulkUploadFile.size / 1024).toFixed(0)} KB</div></>
                          : <><div style={{ fontSize: '0.84rem', fontWeight: 600, opacity: 0.65 }}>Click or drag to upload</div><div style={{ fontSize: '0.73rem', opacity: 0.4, marginTop: '1px' }}>PDF, DOC, DOCX, TXT, CSV · Max 5 MB</div></>}
                      </div>
                      <input ref={bulkUpRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) pickBulkFile(f); e.target.value = ''; }} disabled={bulkUploading} />
                    </div>
                    {bulkUploadFile && <div style={{ marginTop: '0.5rem' }}><SaveBtn theme={theme} onClick={handleBulkUpload} disabled={bulkUploading} style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}>{bulkUploading ? 'Uploading…' : 'Upload & Attach to All'}</SaveBtn></div>}
                    {bulkUploadMsg && <InlineBanner theme={theme} $t={bulkUploadMsg.ok ? 'success' : 'error'}>{bulkUploadMsg.text}</InlineBanner>}
                  </div>
                  <div style={{ height: 1, background: theme.colors.base[300], marginBottom: '0.9rem' }} />
                  <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                    <span style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, display: 'flex', pointerEvents: 'none' }}><IcoSearch /></span>
                    <AttachSearch theme={theme} placeholder="Search files…" value={bulkAttachSearch} onChange={e => setBulkAttachSearch(e.target.value)} style={{ paddingLeft: '2rem' }} />
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: theme.colors.primary.main }}>Attached to All</span>
                      <span style={{ fontSize: '0.66rem', fontWeight: 600, background: theme.colors.primary.main + '20', color: theme.colors.primary.main, border: `1px solid ${theme.colors.primary.main}40`, borderRadius: '999px', padding: '1px 5px' }}>{attachedToAll.length}</span>
                    </div>
                    <AttachList theme={theme}>
                      {attachedToAll.length === 0
                        ? <AttachEmpty theme={theme}>No files attached to all emails</AttachEmpty>
                        : attachedToAll.map(a => { const ext = getExt(a.filename); return (<AttachRow key={a.id} theme={theme} $checked onClick={() => toggleBulkAttach(a.id, false)}><AttachBox theme={theme} $checked><IcoCheck /></AttachBox><ExtBadge $ext={ext}>{ext || '?'}</ExtBadge><AttachName>{a.filename}</AttachName><span style={{ fontSize: '0.68rem', opacity: 0.35 }}>detach all</span></AttachRow>); })}
                    </AttachList>
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', opacity: 0.45 }}>Not Attached to All</span>
                      <span style={{ fontSize: '0.66rem', fontWeight: 600, background: theme.colors.base[300], borderRadius: '999px', padding: '1px 5px', opacity: 0.55 }}>{notAttachedToAll.length}</span>
                    </div>
                    <AttachList theme={theme}>
                      {notAttachedToAll.length === 0
                        ? <AttachEmpty theme={theme}>All files attached to all emails</AttachEmpty>
                        : notAttachedToAll.map(a => { const ext = getExt(a.filename); return (<AttachRow key={a.id} theme={theme} $checked={false} onClick={() => toggleBulkAttach(a.id, true)}><AttachBox theme={theme} $checked={false} /><ExtBadge $ext={ext}>{ext || '?'}</ExtBadge><AttachName>{a.filename}</AttachName><span style={{ fontSize: '0.68rem', opacity: 0.35 }}>attach all</span></AttachRow>); })}
                    </AttachList>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.78rem', opacity: 0.45 }}>{allFiles.length} file{allFiles.length !== 1 ? 's' : ''} total</span>
                    <SaveBtn theme={theme} onClick={saveBulkAttachments} disabled={bulkAttachSaving} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>{bulkAttachSaving ? 'Saving…' : 'Save All'}</SaveBtn>
                  </div>
                </>
              );
            })()}
          </ScrollFlush>
        )}

        {/* ════ BULK BRANDING TAB ════ */}
        {topTab === 'bulk-branding' && !brandConfirmed && (
          <BulkPane>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 520 }}>
              <PanelTitle theme={theme}>Bulk Branding</PanelTitle>
              {brandIndividualChanged ? (
                <>
                  <PanelSubtitle theme={theme} style={{ marginBottom: 0 }}>
                    You've made individual branding changes to one or more companies since the last bulk operation.
                    Proceeding will overwrite those individual changes across all {entries.length} companies.
                  </PanelSubtitle>
                  <AlertBox theme={theme} $variant="warn">
                    <IcoWarn />
                    <div><strong>Individual changes will be lost.</strong> Some companies had their branding updated individually — bulk settings will replace them all.</div>
                  </AlertBox>
                </>
              ) : (
                <>
                  <PanelSubtitle theme={theme} style={{ marginBottom: 0 }}>
                    This lets you set the same branding inheritance across all {entries.length} companies at once.
                    Each company's current branding setting will be overwritten.
                  </PanelSubtitle>
                  <AlertBox theme={theme} $variant="warn">
                    <IcoWarn />
                    <div><strong>This will overwrite all companies.</strong> Their individual branding settings will be replaced with whatever you set here.</div>
                  </AlertBox>
                </>
              )}
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <Btn theme={theme} $v="primary" onClick={() => {
                  setBrandConfirmed(true);
                  setBrandIndividualChanged(false);
                  const firstReady = entries.find(e => e.phase === 'ready');
                  if (firstReady) handleBulkBrandInherit(firstReady.inheritCampaignBranding === 1);
                }}>
                  {brandIndividualChanged ? 'Yes, overwrite individual changes' : 'Yes, manage bulk branding'}
                </Btn>
                <Btn theme={theme} onClick={() => setTopTab('companies')}>Cancel</Btn>
              </div>
            </div>
          </BulkPane>
        )}
        {topTab === 'bulk-branding' && brandConfirmed && (
          <ScrollFlush>
            {bulkInheritMsg && (
              <Msg theme={theme} $type={bulkInheritMsg.ok ? 'success' : 'error'} style={{ marginBottom: '1rem' }}>
                {bulkInheritMsg.text}
              </Msg>
            )}

            {/* Inherit toggle row */}
            <InheritRow theme={theme} onClick={() => !bulkBrandSaving && handleBulkBrandInherit(bulkBrandInherit !== true)}
              style={{ cursor: bulkBrandSaving ? 'not-allowed' : 'pointer', opacity: bulkBrandSaving ? 0.6 : 1 }}>
              <InheritCheck theme={theme} $on={bulkBrandInherit === true} $mixed={bulkBrandInherit === 'mixed'}>
                {bulkBrandInherit === true && <IcoCheck />}
                {bulkBrandInherit === 'mixed' && <span style={{ color: theme.colors.warning?.main || '#f59e0b', fontSize: '0.75rem', lineHeight: 1 }}>—</span>}
              </InheritCheck>
              <InheritText>
                <InheritLabel>
                  Inherit Campaign Branding
                  {bulkBrandInherit === 'mixed' && <MixedBadgeStyle theme={theme}>Mixed</MixedBadgeStyle>}
                </InheritLabel>
                <InheritSub>
                  {bulkBrandInherit === true && 'Enabled — all companies inherit logo & signature from campaign'}
                  {bulkBrandInherit === false && 'Disabled — companies use their own logo and signature'}
                  {bulkBrandInherit === 'mixed' && 'Mixed — click to sync for all companies'}
                  {bulkBrandInherit === null && 'Loading…'}
                </InheritSub>
              </InheritText>
              {bulkBrandSaving && <MiniSpinner />}
            </InheritRow>

            {/* Inherit ON: campaign branding preview */}
            {bulkBrandInherit === true && (() => {
              const ref = entries.find(e => e.phase === 'ready');
              const logo = ref?.campaignBrandLogoData ?? null;
              const sig  = ref?.campaignBrandSignature ?? '';
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.75, marginBottom: '0.35rem' }}>Logo</div>
                    {logo
                      ? <div style={{ display: 'inline-block', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, padding: '0.4rem', background: theme.colors.base[200] }}>
                          <img src={logo} alt="Logo" style={{ maxHeight: 44, maxWidth: 160, objectFit: 'contain' as const, display: 'block' }} />
                        </div>
                      : <div style={{ fontSize: '0.8rem', opacity: 0.38, fontStyle: 'italic' }}>No logo set in campaign</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.75, marginBottom: '0.35rem' }}>Signature</div>
                    {sig
                      ? <div style={{ background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, padding: '0.55rem 0.75rem', fontSize: '0.82rem', whiteSpace: 'pre-wrap' as const, lineHeight: 1.55, opacity: 0.75 }}>
                          {sig}
                        </div>
                      : <div style={{ fontSize: '0.8rem', opacity: 0.38, fontStyle: 'italic' }}>No signature set in campaign</div>}
                  </div>
                  <div style={{ fontSize: '0.77rem', opacity: 0.43 }}>
                    Disable <strong>Inherit Campaign Branding</strong> above to set a custom logo and signature for all companies.
                  </div>
                </div>
              );
            })()}

            {/* Inherit OFF: custom logo + signature editor */}
            {bulkBrandInherit === false && (
              <>
                <div style={{ marginBottom: '1.1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', opacity: 0.8 }}>
                    Logo <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.5 }}>PNG, JPG, GIF or WebP · max 5 MB</span>
                  </div>
                  <LogoZone theme={theme} $has={!!bulkLogo} onClick={() => bulkLogoRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={async e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const d = await b64(f); setBulkLogo(d); markDirty(); } }}>
                    {bulkLogo
                      ? <><LogoImg src={bulkLogo} alt="Logo" /><LogoRemoveButton theme={theme} type="button" onClick={e => { e.stopPropagation(); setBulkLogo(null); }}>✕</LogoRemoveButton></>
                      : <LogoHint><IcoLogoPlaceholder /><span>Click or drag to upload</span></LogoHint>}
                  </LogoZone>
                  <input ref={bulkLogoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; if (f) { const d = await b64(f); setBulkLogo(d); markDirty(); } e.target.value = ''; }} />
                </div>
                <div style={{ marginBottom: '1.1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', opacity: 0.8 }}>Email Signature</div>
                  <textarea rows={4} placeholder={'Best,\nJohn Smith\nAcme Corp'} value={bulkSig}
                    onChange={e => { setBulkSig(e.target.value); setBulkBrandApplyMsg(null); markDirty(); }}
                    style={{ width: '100%', padding: '0.65rem 0.9rem', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, background: theme.colors.base[200], color: theme.colors.base.content, fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical' as const, minHeight: 80, boxSizing: 'border-box' as const }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem' }}>
                  {bulkBrandApplyMsg && <MsgLine theme={theme} $ok={bulkBrandApplyMsg.ok}>{bulkBrandApplyMsg.text}</MsgLine>}
                  <SaveBtn theme={theme} onClick={handleBulkBrandApply} disabled={bulkBrandApplying || (!bulkSig && !bulkLogo)} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
                    {bulkBrandApplying ? 'Applying…' : 'Apply to All'}
                  </SaveBtn>
                </div>
              </>
            )}
          </ScrollFlush>
        )}


        {/* ── Footer (always visible) ──*/}
        <Footer theme={theme}>
          {/* Ready count on left always */}
          <span style={{fontSize:'0.78rem',opacity:0.42,marginRight:'auto'}}>
            {readyCount} of {entries.length} email{entries.length!==1?'s':''} ready
          </span>

          {showSmartSched ? (
            <>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem',flexWrap:'wrap'}}>
                <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                  <span style={{fontSize:'0.67rem',opacity:0.5,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Start</span>
                  <input type="datetime-local" min={minDT} value={smartStartTime}
                    onChange={e=>setSmartStartTime(e.target.value)}
                    style={{padding:'0.35rem 0.5rem',fontSize:'0.8rem',border:`1px solid ${theme.colors.base[300]}`,borderRadius:theme.radius.field,background:theme.colors.base[200],color:theme.colors.base.content,boxSizing:'border-box' as const}}
                  />
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                  <span style={{fontSize:'0.67rem',opacity:0.5,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Initial</span>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={smartInitial}
                    onChange={e=>{ if(/^\d*$/.test(e.target.value)) setSmartInitial(e.target.value); }}
                    onBlur={()=>setSmartInitial(String(Math.max(1, parseInt(smartInitial,10)||1)))}
                    style={{width:60,padding:'0.35rem 0.5rem',fontSize:'0.8rem',border:`1px solid ${theme.colors.base[300]}`,borderRadius:theme.radius.field,background:theme.colors.base[200],color:theme.colors.base.content,boxSizing:'border-box' as const}}
                  />
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                  <span style={{fontSize:'0.67rem',opacity:0.5,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Interval</span>
                  <div style={{display:'flex',gap:'4px'}}>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={smartInterval}
                      onChange={e=>{ if(/^\d*$/.test(e.target.value)) setSmartInterval(e.target.value); }}
                      onBlur={()=>setSmartInterval(String(Math.max(1, parseInt(smartInterval,10)||1)))}
                      style={{width:52,padding:'0.35rem 0.5rem',fontSize:'0.8rem',border:`1px solid ${theme.colors.base[300]}`,borderRadius:theme.radius.field,background:theme.colors.base[200],color:theme.colors.base.content,boxSizing:'border-box' as const}}
                    />
                    <select value={smartIntervalUnit} onChange={e=>setSmartIntervalUnit(e.target.value as any)}
                      style={{padding:'0.35rem 0.4rem',fontSize:'0.8rem',border:`1px solid ${theme.colors.base[300]}`,borderRadius:theme.radius.field,background:theme.colors.base[200],color:theme.colors.base.content,cursor:'pointer'}}>
                      <option value="minutes">min</option>
                      <option value="hours">hrs</option>
                      <option value="days">days</option>
                      <option value="weeks">wks</option>
                    </select>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                  <span style={{fontSize:'0.67rem',opacity:0.5,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>Increment</span>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={smartIncrement}
                    onChange={e=>{ if(/^\d*$/.test(e.target.value)) setSmartIncrement(e.target.value); }}
                    onBlur={()=>setSmartIncrement(String(Math.max(0, parseInt(smartIncrement,10)||0)))}
                    style={{width:72,padding:'0.35rem 0.5rem',fontSize:'0.8rem',border:`1px solid ${theme.colors.base[300]}`,borderRadius:theme.radius.field,background:theme.colors.base[200],color:theme.colors.base.content,boxSizing:'border-box' as const}}
                  />
                </div>
              </div>
              <Btn theme={theme} disabled={!!bulkActing} onClick={()=>{setShowSmartSched(false);}}>Cancel</Btn>
              <Btn theme={theme} $v="warning" disabled={!smartStartTime||!!bulkActing||readyCount===0} onClick={handleSmartSchedule}>
                {bulkActing==='schedule'?<MiniSpinner/>:<IcoCal/>}Confirm
              </Btn>
            </>
          ) : showSched ? (
            <>
              <input ref={schedRef} type="datetime-local" min={minDT} value={schedTime}
                onChange={e=>setSchedTime(e.target.value)}
                style={{padding:'0.4rem 0.6rem',fontSize:'0.8125rem',border:`1px solid ${theme.colors.base[300]}`,borderRadius:theme.radius.field,background:theme.colors.base[200],color:theme.colors.base.content,boxSizing:'border-box' as const}}
              />
              <Btn theme={theme} disabled={!!bulkActing} onClick={()=>{setShowSched(false);setSchedTime('');}}>Cancel</Btn>
              <Btn theme={theme} $v="warning" disabled={!schedTime||!!bulkActing||readyCount===0} onClick={handleScheduleAll}>
                {bulkActing==='schedule'?<MiniSpinner/>:<IcoCal/>}Confirm
              </Btn>
            </>
          ) : (
            <>
              {/* Split schedule button */}
              <SplitGroup ref={schedDropRef}>
                <SplitMain theme={theme} disabled={!!bulkActing||readyCount===0}
                  onClick={()=>{setTopTab('companies');setShowSched(true);setTimeout(()=>schedRef.current?.focus(),80);}}>
                  <IcoCal/>Schedule
                </SplitMain>
                <SplitChevron theme={theme} $open={schedDropOpen} disabled={!!bulkActing||readyCount===0}
                  onClick={()=>setSchedDropOpen(p=>!p)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </SplitChevron>
                {schedDropOpen && (
                  <SplitMenu theme={theme}>
                    <SplitMenuItem theme={theme} onClick={()=>{setSchedDropOpen(false);setTopTab('companies');setShowSched(true);setTimeout(()=>schedRef.current?.focus(),80);}}>
                      <IcoCal/>At a specific time
                    </SplitMenuItem>
                    <SplitMenuItem theme={theme} onClick={()=>{setSchedDropOpen(false);setTopTab('companies');setShowSmartSched(true);}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Smart schedule
                    </SplitMenuItem>
                  </SplitMenu>
                )}
              </SplitGroup>
              {/* Send All */}
              <Btn theme={theme} $v="primary" disabled={!!bulkActing||readyCount===0} onClick={handleSendAll}>
                {bulkActing==='send'?<MiniSpinner/>:<IcoSend/>}
                Send All ({readyCount})
              </Btn>
            </>
          )}
        </Footer>

      </ModalBox>
      <UnsavedDialog
        open={confirmClose}
        theme={theme}
        onKeep={() => setConfirmClose(false)}
        onDiscard={() => { setConfirmClose(false); setIsDirty(false); onClose(); }}
      />
      </>
      )}
    </Overlay>
  );
};

export default BulkEmailModal;