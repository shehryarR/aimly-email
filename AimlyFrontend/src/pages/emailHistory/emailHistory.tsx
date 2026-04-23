// ============================================================
// emailHistory.tsx — Unified Email History (all campaigns + companies)
// Route: /history
//
// Fully self-contained — EmailDetailModal, EmailDetailModal.styles,
// and EmailListItem (dual-tag variant) are all embedded here.
// Zero external component imports needed.
//
// API:
//   GET  /email/                       — list all emails
//   GET  /campaign/?page&size&search   — campaigns dropdown
//   GET  /company/?page&size&search    — companies dropdown
//   GET  /email/{id}/attachments/      — linked attachments
//   GET  /attachments/?page&page_size  — all attachments
//   PUT  /email/{id}/update/           — update draft/scheduled + branding
//   PUT  /email/{id}/attachments/      — save attachment links
//   POST /email/{id}/send/             — send now or schedule
//   POST /email/{id}/draft/            — copy as new draft
//   POST /attachment/                  — upload new file
//   DELETE /email/{id}/delete/         — delete email
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../../theme/styles';
import { apiFetch } from '../../App';

import {
  PageContainer, MainContent,
  HeaderCard, HeaderRow, HeaderCenter, HeaderTitle, HeaderSubtitle,
  ListSection, SectionHeader, SectionTitle, CountBadge,
  BulkActionsBar, BulkLeft, BulkRight,
  EmailCard, EmailRow, EmailInfo, EmailSubject, EmailMeta, EmailMetaItem, EmailPreview,
  BadgeRow, StatusBadge, CompanyTag, ActionButtons,
  Checkbox, IconButton,
  EmptyState, EmptyIcon, EmptyTitle, EmptySubtitle,
  SearchWrapper, SearchIconWrap, SearchClearBtn, SearchInput, FilterBar, FilterChip,
  ToastContainer, ToastItem, ToastBody, ToastTitle, ToastMsg,
  ConfirmOverlay, ConfirmBox, ConfirmHeader, ConfirmIconWrap, ConfirmContent,
  ConfirmTitle, ConfirmMessage, ConfirmActions,
  CancelButton, DangerButton, PrimaryButton,
  BtnSpinner,
  PaginationContainer, PaginationButton, PaginationInfo, PageSizeSelect,
  DropdownTrigger, DropdownMenu, DropdownSearch, DropdownItem,
} from './emailHistory.styles';

// ─── env ──────────────────────────────────────────────────────────────────────
const BACKEND_URL  = import.meta.env.VITE_BACKEND_URL  || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE     = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

// ─── types ────────────────────────────────────────────────────────────────────
type EmailStatus = 'sent' | 'draft' | 'scheduled' | 'failed';

interface EmailAttachment {
  id: number;
  filename: string;
  file_size: number;
  created_at: string | null;
}

interface EmailRecord {
  id: number;
  email_subject: string;
  email_content: string;
  recipient_email: string;
  status: EmailStatus;
  sent_at?: string;
  read_at?: string;
  created_at?: string;
  company_id: number;
  company_name: string;
  campaign_id: number;
  campaign_name: string;
  html_email?: boolean;
  signature?: string;
  logo_data?: string | null;
  failed_reason?: string;
  // Baked-in from GET /email/ — no separate fetch needed.
  // To download, use GET /attachments/download/?ids=1,2,3
  attachments: EmailAttachment[];
}

interface AttachOption {
  id: number;
  filename: string;
  file_size: number | null;
}

interface ToastState {
  visible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  isExiting?: boolean;
}

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  danger?: boolean;
  confirmLabel?: string;
}

interface DropdownOption { id: number; name: string; }

// ─── Back button ──────────────────────────────────────────────────────────────
const BackBtn = styled.button<{ theme: any }>`
  text-decoration: none;
  position: absolute;
  left: 0;
  width: 36px; height: 36px;
  padding: 0;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background-color: ${p => p.theme.colors.base[400]};
    border-color: ${p => p.theme.colors.primary.main};
    color: ${p => p.theme.colors.primary.main};
  }
  svg { width: 18px; height: 18px; }
`;

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// EMBEDDED STYLES  (from EmailDetailModal.styles.ts)
// ═══════════════════════════════════════════════════════════════════════════════

const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;

const modalUp = keyframes`
  from { opacity: 0; transform: scale(0.96) translateY(16px); }
  to   { opacity: 1; transform: scale(1)    translateY(0);    }
`;

const ModalOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: ${p => p.$isOpen ? 'flex' : 'none'};
  align-items: center; justify-content: center;
  padding: 1rem;
`;

const ModalContent = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border-radius: ${p => p.theme.radius.box};
  width: 100%; max-width: 680px; max-height: 88vh;
  overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: ${modalUp} 0.25s ease;
`;

const ModalHeader = styled.div<{ theme: any }>`
  padding: 1.5rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  display: flex; align-items: center; justify-content: space-between;
`;

const ModalTitle = styled.h3`margin: 0; font-size: 1.125rem; font-weight: 600;`;

const CloseButton = styled.button<{ theme: any }>`
  padding: 0.375rem; border: none; background: transparent;
  color: ${p => p.theme.colors.base.content}; cursor: pointer;
  border-radius: ${p => p.theme.radius.field};
  display: flex; align-items: center; justify-content: center;
  opacity: 0.6; transition: all 0.2s ease;
  &:hover { opacity: 1; background: ${p => p.theme.colors.base[100]}; }
  svg { width: 20px; height: 20px; }
`;

const ModalStatusBadge = styled.span<{ theme: any; $status: EmailStatus }>`
  display: inline-flex; align-items: center;
  font-size: 0.6875rem; font-weight: 700;
  padding: 3px 10px; border-radius: 999px;
  white-space: nowrap; letter-spacing: 0.01em; text-transform: uppercase;
  ${p => {
    const m: Record<string, string> = {
      sent:      `background:${p.theme.emailStatus.sent.background};color:${p.theme.emailStatus.sent.color};`,
      draft:     `background:${p.theme.emailStatus.draft.background};color:${p.theme.emailStatus.draft.color};`,
      scheduled: `background:${p.theme.emailStatus.scheduled.background};color:${p.theme.emailStatus.scheduled.color};`,
      failed:    `background:${p.theme.emailStatus.failed.background};color:${p.theme.emailStatus.failed.color};`,
    };
    return m[p.$status];
  }}
`;

const FormGroup = styled.div``;

const FormLabel = styled.label<{ theme: any }>`
  display: block; font-size: 0.75rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  opacity: 0.45; margin-bottom: 0.375rem;
  color: ${p => p.theme.colors.base.content};
`;

const FormInput = styled.input<{ theme: any }>`
  width: 100%; padding: 0.75rem 1rem;
  border: 1px solid ${p => p.theme.colors.base[400] || p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem; transition: all 0.2s ease; box-sizing: border-box;
  &:focus {
    outline: none; border-color: ${p => p.theme.colors.primary.main};
    background: ${p => p.theme.colors.base[400]};
    box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}20;
  }
  &::placeholder { opacity: 0.4; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const FormTextarea = styled.textarea<{ theme: any }>`
  width: 100%; padding: 0.75rem 1rem;
  border: 1px solid ${p => p.theme.colors.base[400] || p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem; font-family: inherit; resize: vertical;
  min-height: 220px; line-height: 1.6; transition: all 0.2s ease; box-sizing: border-box;
  &:focus {
    outline: none; border-color: ${p => p.theme.colors.primary.main};
    background: ${p => p.theme.colors.base[400]};
    box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}20;
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ReadBlock = styled.div<{ theme: any }>`
  padding: 0.75rem 1rem; font-size: 0.875rem; line-height: 1.6;
  background: ${p => p.theme.colors.base[400]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field}; white-space: pre-wrap;
`;

const ModalSpinner = styled.div<{ theme: any; $size?: number }>`
  width: ${p => p.$size || 16}px; height: ${p => p.$size || 16}px;
  border: 2px solid ${p => p.theme.colors.base[300]};
  border-top-color: ${p => p.theme.colors.primary.main};
  border-radius: 50%; animation: ${spin} 0.65s linear infinite; flex-shrink: 0;
`;

const AutoSaveNote = styled.span`
  font-size: 0.75rem; opacity: 0.5; margin-right: auto;
  display: flex; align-items: center; gap: 0.35rem;
`;

// ─── attachment ext colours ────────────────────────────────────────────────────
const EXT_BG: Record<string, string> = {
  pdf: '#ef444420', doc: '#3b82f620', docx: '#3b82f620', csv: '#22c55e20', txt: '#64748b20',
};
const EXT_COLOR: Record<string, string> = {
  pdf: '#ef4444', doc: '#3b82f6', docx: '#3b82f6', csv: '#22c55e', txt: '#64748b',
};
const getExt = (fn: string) => fn.split('.').pop()?.toLowerCase() || '';

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════════

const XIcon         = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const SendIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const ScheduleIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const TrashIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const DraftIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>;
const AlertCircle   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const CheckIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>;
const SortIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="14" y2="12"/><line x1="3" y1="18" x2="8" y2="18"/></svg>;
const FilterIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
const ChevronDown   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11"><polyline points="6 9 12 15 18 9"/></svg>;
const MailIcon      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const MailSmIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const BuildingIcon  = () => <svg width="13" height="16" viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="30" height="38" rx="2"/><rect x="5" y="6" width="7" height="7" rx="0.5"/><rect x="20" y="6" width="7" height="7" rx="0.5"/><rect x="5" y="17" width="7" height="7" rx="0.5"/><rect x="20" y="17" width="7" height="7" rx="0.5"/><rect x="11" y="29" width="10" height="10" rx="1"/></svg>;
const CampaignIcon  = () => <svg width="15" height="13" viewBox="0 0 38 34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11H13L28 3V31L13 23H5C3.9 23 3 22.1 3 21V13C3 11.9 3.9 11 5 11Z"/><path d="M32 9C34.5 11.5 35.5 14.5 35.5 17C35.5 19.5 34.5 22.5 32 25"/><path d="M13 23L15 31H20L18 23"/></svg>;

const MiniSpinner: React.FC<{ theme: any }> = ({ theme }) => <ModalSpinner theme={theme} $size={14} />;

// ═══════════════════════════════════════════════════════════════════════════════
// EMBEDDED: EmailDetailModal
// ═══════════════════════════════════════════════════════════════════════════════

interface EmailDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeEmail: EmailRecord | null;
  titleLabel: string;
  editSubject: string;
  editContent: string;
  editRecipient: string;
  onSubjectChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onRecipientChange: (v: string) => void;
  autoSaving: boolean;
  schedOpen: boolean; schedTime: string;
  onSchedOpen: () => void; onSchedClose: () => void;
  onSchedTimeChange: (v: string) => void; onScheduleSubmit: () => void;
  reschedOpen: boolean; reschedTime: string;
  onReschedOpen: () => void; onReschedClose: () => void;
  onReschedTimeChange: (v: string) => void; onRescheduleSubmit: () => void;
  actionLoading: boolean;
  onSend: (email: EmailRecord) => void;
  onSaveDraft: (email: EmailRecord) => void;
  onDelete: (id: number, label?: string) => void;
  tab: 'email' | 'attachments';
  onTabChange: (t: 'email' | 'attachments') => void;
  attachLoading: boolean;
  allAttachments: AttachOption[];
  linkedAttachIds: Set<number>;
  attachSearch: string;
  onAttachSearchChange: (v: string) => void;
  onToggleAttachment: (id: number) => void;
  onSaveAttachments: () => void;
  attachSaving: boolean;
  attachMsg: { type: 'success' | 'error'; text: string } | null;
  uploadFile: File | null;
  onFilePick: (file: File) => void;
  onUpload: () => void;
  uploading: boolean;
  uploadMsg: { type: 'success' | 'error'; text: string } | null;
  isDragOver: boolean;
  onDragOver: () => void; onDragLeave: () => void;
  onDrop: (file: File) => void; onClearUploadFile: () => void;
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
  onDownloadAttachments: (ids: number[], filenames: string[]) => void;
  formatDT: (s?: string) => string;
  minDT: string;
  theme: any;
  isDirty?: boolean;
}

const EmailDetailModal: React.FC<EmailDetailModalProps> = ({
  isOpen, onClose, activeEmail, titleLabel,
  editSubject, editContent, editRecipient,
  onSubjectChange, onContentChange, onRecipientChange, autoSaving,
  schedOpen, schedTime, onSchedOpen, onSchedClose, onSchedTimeChange, onScheduleSubmit,
  reschedOpen, reschedTime, onReschedOpen, onReschedClose, onReschedTimeChange, onRescheduleSubmit,
  actionLoading, onSend, onSaveDraft, onDelete,
  tab, onTabChange,
  attachLoading, allAttachments, linkedAttachIds, attachSearch,
  onAttachSearchChange, onToggleAttachment, onSaveAttachments, attachSaving, attachMsg,
  uploadFile, onFilePick, onUpload, uploading, uploadMsg,
  isDragOver, onDragOver, onDragLeave, onDrop, onClearUploadFile, uploadInputRef,
  onDownloadAttachments,
  formatDT, minDT, theme, isDirty = false,
}) => {
  const [confirmClose, setConfirmClose] = useState(false);
  const [htmlEmail, setHtmlEmail] = useState<boolean>(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const dragStateRef = useRef<{ dragging: boolean; startX: number; startRatio: number; containerW: number }>({ dragging: false, startX: 0, startRatio: 0.5, containerW: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync htmlEmail whenever the modal opens a different email
  useEffect(() => {
    setHtmlEmail(!!activeEmail?.html_email);
    setSplitRatio(0.5);
  }, [activeEmail?.id]);

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
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragStateRef.current.dragging) return;
      if (ev.buttons === 0) { cleanup(); return; }
      const { startX, startRatio, containerW: cW } = dragStateRef.current;
      const newRatio = Math.min(0.75, Math.max(0.25, startRatio + (ev.clientX - startX) / cW));
      setSplitRatio(newRatio);
    };
    const onUp = () => cleanup();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleClose = () => {
    if (isDirty) { setConfirmClose(true); return; }
    onClose();
  };

  if (!activeEmail) return null;

  const isDraft     = activeEmail.status === 'draft';
  const isScheduled = activeEmail.status === 'scheduled';
  const isSent      = activeEmail.status === 'sent';
  const isFailed    = activeEmail.status === 'failed';

  const filteredAtts    = allAttachments.filter(a => a.filename.toLowerCase().includes(attachSearch.toLowerCase()));
  const attachedFiles   = filteredAtts.filter(a =>  linkedAttachIds.has(a.id));
  const unattachedFiles = filteredAtts.filter(a => !linkedAttachIds.has(a.id));

  const tabDef = [
    { id: 'email' as const,       label: 'Email',       icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
    { id: 'attachments' as const, label: 'Attachments', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg> },
  ];

  return (
    <>
    <ModalOverlay $isOpen={isOpen} onClick={handleClose}>
      <ModalContent theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: htmlEmail && tab === 'email' ? 1100 : 680, transition: 'max-width 0.25s' }}>

        {/* Header */}
        <ModalHeader theme={theme}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ModalTitle>{titleLabel}</ModalTitle>
            <ModalStatusBadge theme={theme} $status={activeEmail.status}>{activeEmail.status}</ModalStatusBadge>
          </div>
          <CloseButton theme={theme} onClick={handleClose}><XIcon /></CloseButton>
        </ModalHeader>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.colors.base[300]}`, background: theme.colors.base[200], flexShrink: 0 }}>
          {tabDef.map(t => (
            <button key={t.id} onClick={() => onTabChange(t.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.7rem 1.25rem', fontSize: '0.8375rem',
              fontWeight: tab === t.id ? 700 : 500,
              border: 'none', borderBottom: `2px solid ${tab === t.id ? theme.colors.primary.main : 'transparent'}`,
              background: 'none', cursor: 'pointer',
              color: tab === t.id ? theme.colors.primary.main : theme.colors.base.content,
              opacity: tab === t.id ? 1 : 0.55, transition: 'all 0.15s', marginBottom: '-1px',
            }}>
              {t.icon} {t.label}
              {t.id === 'attachments' && linkedAttachIds.size > 0 && (
                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '999px', background: theme.colors.primary.main + '20', color: theme.colors.primary.main, border: `1px solid ${theme.colors.primary.main}40` }}>
                  {linkedAttachIds.size}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── EMAIL TAB ── */}
        {tab === 'email' && (<>
          <div ref={containerRef} style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

            {/* Editor column */}
            <ModalBody style={{ flex: `0 0 ${htmlEmail ? `${(1 - splitRatio) * 100}%` : '100%'}`, transition: htmlEmail ? 'none' : 'flex 0.25s' }}>
              <FormGroup>
                <FormLabel theme={theme}>Recipient</FormLabel>
                {(isDraft || isScheduled)
                  ? <FormInput theme={theme} value={editRecipient} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onRecipientChange(e.target.value)} placeholder="recipient@example.com" />
                  : <ReadBlock theme={theme} style={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.825rem' }}>{activeEmail.recipient_email}</ReadBlock>
                }
              </FormGroup>
              <FormGroup>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <FormLabel theme={theme} style={{ margin: 0 }}>Subject</FormLabel>
                  {/* HTML toggle — inline with Subject label */}
                  {(isDraft || isScheduled) ? (
                    <div
                      onClick={async () => {
                        if (!activeEmail) return;
                        const next = !htmlEmail;
                        setHtmlEmail(next);
                        if (!next) setSplitRatio(0.5);
                        try {
                          await apiFetch(`${API_BASE}/email/bulk-update/`, {
                            method: 'PUT', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ updates: [{ email_id: activeEmail.id, html_email: next }] }),
                          });
                        } catch { /* silent */ }
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', userSelect: 'none' }}
                    >
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>HTML</span>
                      <div style={{ width: 32, height: 18, borderRadius: 999, flexShrink: 0, background: htmlEmail ? theme.colors.primary.main : theme.colors.base[300], position: 'relative', transition: 'background 0.2s', border: `1px solid ${htmlEmail ? theme.colors.primary.main : theme.colors.base[300]}` }}>
                        <div style={{ position: 'absolute', top: 2, left: htmlEmail ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{htmlEmail ? 'HTML' : 'Plain'}</span>
                  )}
                </div>
                {(isDraft || isScheduled)
                  ? <FormInput theme={theme} value={editSubject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSubjectChange(e.target.value)} placeholder="Email subject" />
                  : <ReadBlock theme={theme}>{activeEmail.email_subject}</ReadBlock>
                }
              </FormGroup>
              <FormGroup>
                <FormLabel theme={theme}>Content</FormLabel>
                {(isDraft || isScheduled)
                  ? <FormTextarea theme={theme} value={editContent} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onContentChange(e.target.value)} placeholder="Email body…" />
                  : <ReadBlock theme={theme}>{activeEmail.email_content}</ReadBlock>
                }
              </FormGroup>

              {/* ── Signature (read-only) ── */}
              {activeEmail.signature && (
                <FormGroup>
                  <FormLabel theme={theme}>Signature</FormLabel>
                  <ReadBlock theme={theme} style={{ whiteSpace: 'pre-wrap' }}>{activeEmail.signature}</ReadBlock>
                </FormGroup>
              )}

              {/* ── Logo (read-only) ── */}
              {activeEmail.logo_data && (
                <FormGroup>
                  <FormLabel theme={theme}>Logo</FormLabel>
                  <div style={{ padding: '0.65rem 1rem', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, background: theme.colors.base[400] }}>
                    <img src={activeEmail.logo_data} alt="Logo" style={{ maxHeight: 48, maxWidth: 180, objectFit: 'contain', display: 'block' }} />
                  </div>
                </FormGroup>
              )}

              {(activeEmail.status === 'draft' || activeEmail.status === 'failed')
                ? activeEmail.created_at && (
                  <FormGroup>
                    <FormLabel theme={theme}>Created At</FormLabel>
                    <ReadBlock theme={theme} style={{ fontSize: '0.825rem' }}>{formatDT(activeEmail.created_at)}</ReadBlock>
                  </FormGroup>
                )
              : activeEmail.sent_at && (
                  <FormGroup>
                    <FormLabel theme={theme}>{isScheduled ? 'Scheduled For' : 'Sent At'}</FormLabel>
                    <ReadBlock theme={theme} style={{ fontSize: '0.825rem' }}>{formatDT(activeEmail.sent_at)}</ReadBlock>
                  </FormGroup>
                )
            }

            {isSent && activeEmail.read_at && (
              <FormGroup>
                <FormLabel theme={theme} style={{ color: theme.colors.success?.main || '#22c55e', opacity: 1 }}>
                  Read At
                </FormLabel>
                <ReadBlock theme={theme} style={{
                  fontSize: '0.825rem',
                  borderColor: (theme.colors.success?.main || '#22c55e') + '40',
                  background:  (theme.colors.success?.main || '#22c55e') + '0d',
                  color:        theme.colors.success?.main || '#22c55e',
                }}>
                  {formatDT(activeEmail.read_at)}
                </ReadBlock>
              </FormGroup>
            )}

            {/* ── FIX: render failure reason for failed emails ── */}
            {isFailed && (
              <FormGroup>
                <FormLabel theme={theme} style={{ color: theme.colors.error?.main || '#ef4444', opacity: 1 }}>
                  Failure Reason
                </FormLabel>
                <ReadBlock theme={theme} style={{
                  fontSize: '0.825rem',
                  borderColor: (theme.colors.error?.main || '#ef4444') + '40',
                  background:  (theme.colors.error?.main || '#ef4444') + '0d',
                  color:        theme.colors.error?.main || '#ef4444',
                  whiteSpace: 'pre-wrap',
                }}>
                  {activeEmail.failed_reason || 'No reason provided'}
                </ReadBlock>
              </FormGroup>
            )}
          </ModalBody>

          {/* Drag divider + live preview — only when HTML is on */}
          {htmlEmail && (
            <>
              <div onMouseDown={onDividerMouseDown} style={{ width: 6, flexShrink: 0, cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }}>
                <div style={{ width: 2, height: 40, borderRadius: 2, background: theme.colors.base[300] }} />
              </div>
              <div style={{ flex: `0 0 ${splitRatio * 100}%`, display: 'flex', flexDirection: 'column', padding: '1.5rem 1.5rem 1.5rem 0.75rem', overflow: 'hidden', minWidth: 0 }}>
                <FormLabel theme={theme} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
                  </svg>
                  Live Preview
                </FormLabel>
                <div style={{ flex: 1, border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, overflow: 'hidden', background: '#fff', minHeight: 200 }}>
                  {(isDraft || isScheduled ? editContent : activeEmail.email_content).trim() ? (
                    <iframe
                      srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:14px;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:#111;word-break:break-word;}img{max-width:100%;height:auto;}a{color:#6366f1;}</style></head><body>${isDraft || isScheduled ? editContent : activeEmail.email_content}</body></html>`}
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
            </>
          )}
          </div>

          <ModalFooter theme={theme}>
            {(isDraft || isScheduled) && autoSaving && <AutoSaveNote><MiniSpinner theme={theme} />Saving…</AutoSaveNote>}

            {isDraft && (<>
              {schedOpen ? (<>
                <AutoSaveNote style={{ opacity: 1, marginRight: 'auto' }}>
                  <FormInput theme={theme} type="datetime-local" value={schedTime} min={minDT}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSchedTimeChange(e.target.value)}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem', marginBottom: 0 }} />
                </AutoSaveNote>
                <CancelButton theme={theme} disabled={actionLoading} onClick={onSchedClose}>Cancel</CancelButton>
                <PrimaryButton theme={theme} disabled={!schedTime || actionLoading} onClick={onScheduleSubmit}>
                  {actionLoading ? <BtnSpinner /> : <ScheduleIcon />} Confirm
                </PrimaryButton>
              </>) : (<>
                <CancelButton theme={theme} disabled={actionLoading} onClick={onSchedOpen}><ScheduleIcon /> Schedule</CancelButton>
                <PrimaryButton theme={theme} disabled={actionLoading} onClick={() => onSend(activeEmail)}>
                  {actionLoading ? <BtnSpinner /> : <SendIcon />} Send Now
                </PrimaryButton>
              </>)}
            </>)}

            {isScheduled && (<>
              {reschedOpen ? (<>
                <AutoSaveNote style={{ opacity: 1, marginRight: 'auto' }}>
                  <FormInput theme={theme} type="datetime-local" value={reschedTime} min={minDT}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onReschedTimeChange(e.target.value)}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem', marginBottom: 0 }} />
                </AutoSaveNote>
                <CancelButton theme={theme} disabled={actionLoading} onClick={onReschedClose}>Cancel</CancelButton>
                <PrimaryButton theme={theme} disabled={!reschedTime || actionLoading} onClick={onRescheduleSubmit}>
                  {actionLoading ? <BtnSpinner /> : <ScheduleIcon />} Confirm
                </PrimaryButton>
              </>) : (<>
                <CancelButton theme={theme} disabled={actionLoading} onClick={() => onSaveDraft(activeEmail)}><DraftIcon /> Save as Draft</CancelButton>
                <CancelButton theme={theme} disabled={actionLoading} onClick={onReschedOpen}><ScheduleIcon /> Reschedule</CancelButton>
                <PrimaryButton theme={theme} disabled={actionLoading} onClick={() => onSend(activeEmail)}>
                  {actionLoading ? <BtnSpinner /> : <SendIcon />} Send Now
                </PrimaryButton>
              </>)}
            </>)}

            {isSent && (<>
              <DangerButton theme={theme} disabled={actionLoading} onClick={() => onDelete(activeEmail.id, `"${activeEmail.email_subject}"`)}>
                {actionLoading ? <BtnSpinner /> : <TrashIcon />} Delete
              </DangerButton>
              <PrimaryButton theme={theme} disabled={actionLoading} onClick={() => onSaveDraft(activeEmail)}>
                {actionLoading ? <BtnSpinner /> : <DraftIcon />} Save as Draft
              </PrimaryButton>
            </>)}

            {isFailed && (<>
              {reschedOpen ? (<>
                <AutoSaveNote style={{ opacity: 1, marginRight: 'auto' }}>
                  <FormInput theme={theme} type="datetime-local" value={reschedTime} min={minDT}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onReschedTimeChange(e.target.value)}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem', marginBottom: 0 }} />
                </AutoSaveNote>
                <CancelButton theme={theme} disabled={actionLoading} onClick={onReschedClose}>Cancel</CancelButton>
                <PrimaryButton theme={theme} disabled={!reschedTime || actionLoading} onClick={onRescheduleSubmit}>
                  {actionLoading ? <BtnSpinner /> : <ScheduleIcon />} Confirm
                </PrimaryButton>
              </>) : (<>
                <CancelButton theme={theme} disabled={actionLoading} onClick={onReschedOpen}><ScheduleIcon /> Reschedule</CancelButton>
                <PrimaryButton theme={theme} disabled={actionLoading} onClick={() => onSend(activeEmail)}>
                  {actionLoading ? <BtnSpinner /> : <SendIcon />} Send Now
                </PrimaryButton>
              </>)}
            </>)}
          </ModalFooter>
        </>)}

        {/* ── ATTACHMENTS TAB ── */}
        {tab === 'attachments' && (
          <ModalBody style={{ gap: '0.75rem' }}>
            {attachLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', opacity: 0.5, fontSize: '0.875rem' }}>Loading…</div>
            ) : (isDraft || isScheduled) ? (<>
              {/* Upload zone */}
              <div>
                <div
                  onDragOver={e => { e.preventDefault(); onDragOver(); }}
                  onDragLeave={onDragLeave}
                  onDrop={e => { e.preventDefault(); onDragLeave(); const f = e.dataTransfer.files[0]; if (f && !uploading) onDrop(f); }}
                  onClick={() => !uploading && uploadInputRef.current?.click()}
                  style={{ border: `2px dashed ${isDragOver ? theme.colors.primary.main : uploadFile ? theme.colors.primary.main + '80' : theme.colors.base[300]}`, borderRadius: theme.radius.field, background: isDragOver ? theme.colors.primary.main + '08' : theme.colors.base[400], padding: '0.85rem 1rem', cursor: uploading ? 'not-allowed' : 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.85rem', opacity: uploading ? 0.65 : 1 }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: uploadFile ? theme.colors.primary.main + '15' : theme.colors.base[300], display: 'flex', alignItems: 'center', justifyContent: 'center', color: uploadFile ? theme.colors.primary.main : theme.colors.base.content, opacity: uploadFile ? 1 : 0.4 }}>
                    {uploadFile
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {uploadFile
                      ? <><div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadFile.name}</div><div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: 1 }}>{(uploadFile.size/1024).toFixed(0)} KB · Click to change</div></>
                      : <><div style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.65 }}>Click or drag to upload</div><div style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: 1 }}>PDF, DOC, DOCX, TXT, CSV · Max 5 MB</div></>
                    }
                  </div>
                  {uploadFile && !uploading && (
                    <button onClick={e => { e.stopPropagation(); onClearUploadFile(); }} style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, border: `1px solid ${theme.colors.base[300]}`, background: theme.colors.base[400], color: theme.colors.base.content, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', opacity: 0.6 }}>✕</button>
                  )}
                  <input ref={uploadInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onFilePick(f); }} disabled={uploading} />
                </div>
                {uploadFile && <div style={{ marginTop: '0.5rem' }}><PrimaryButton theme={theme} onClick={onUpload} disabled={uploading} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>{uploading ? <BtnSpinner /> : null} {uploading ? 'Uploading…' : 'Upload & Attach'}</PrimaryButton></div>}
                {uploadMsg && <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', fontWeight: 500, color: uploadMsg.type === 'success' ? (theme.colors.success?.main || '#22c55e') : theme.colors.error.main }}>{uploadMsg.text}</div>}
              </div>

              <div style={{ height: 1, background: theme.colors.base[300] }} />

              {allAttachments.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', gap: '0.4rem', opacity: 0.5, textAlign: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="26" height="26"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>No files uploaded yet</div>
                  <div style={{ fontSize: '0.8rem' }}>Use the upload area above to add files.</div>
                </div>
              ) : (<>
                <input type="text" placeholder="Search files…" value={attachSearch} onChange={e => onAttachSearchChange(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.8125rem', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, background: theme.colors.base[400], color: theme.colors.base.content, outline: 'none' }} />

                {/* Attached */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.45 }}>Attached</span>
                    <span style={{ fontSize: '0.67rem', fontWeight: 600, background: theme.colors.primary.main + '20', color: theme.colors.primary.main, borderRadius: '999px', padding: '1px 6px' }}>{attachedFiles.length}</span>
                  </div>
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, background: theme.colors.base[400] }}>
                    {attachedFiles.length === 0
                      ? <div style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.8rem', opacity: 0.5 }}>{attachSearch ? `No attached files match "${attachSearch}"` : 'No files attached yet'}</div>
                      : attachedFiles.map(att => { const ext = getExt(att.filename); return (
                          <div key={att.id} onClick={() => onToggleAttachment(att.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: `1px solid ${theme.colors.base[300]}` }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, background: theme.colors.primary.main, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 18, padding: '0 4px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0, background: EXT_BG[ext] || '#64748b20', color: EXT_COLOR[ext] || '#64748b' }}>{ext || '?'}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem', fontWeight: 500 }}>{att.filename}</span>
                            {att.file_size != null && <span style={{ fontSize: '0.7rem', opacity: 0.4, flexShrink: 0 }}>{(att.file_size / 1024).toFixed(0)} KB</span>}
                            <span style={{ fontSize: '0.68rem', opacity: 0.35, flexShrink: 0 }}>detach</span>
                          </div>
                        );})
                    }
                  </div>
                </div>

                {/* Not Attached */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.45 }}>Not Attached</span>
                    <span style={{ fontSize: '0.67rem', fontWeight: 600, background: theme.colors.base[300], borderRadius: '999px', padding: '1px 6px', opacity: 0.55 }}>{unattachedFiles.length}</span>
                  </div>
                  <div style={{ maxHeight: 140, overflowY: 'auto', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, background: theme.colors.base[400] }}>
                    {unattachedFiles.length === 0
                      ? <div style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.8rem', opacity: 0.5 }}>{attachSearch ? `No unattached files match "${attachSearch}"` : 'All files are attached'}</div>
                      : unattachedFiles.map(att => { const ext = getExt(att.filename); return (
                          <div key={att.id} onClick={() => onToggleAttachment(att.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: `1px solid ${theme.colors.base[300]}` }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${theme.colors.base[300]}`, flexShrink: 0 }} />
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 18, padding: '0 4px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0, background: EXT_BG[ext] || '#64748b20', color: EXT_COLOR[ext] || '#64748b' }}>{ext || '?'}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem', fontWeight: 500 }}>{att.filename}</span>
                            {att.file_size != null && <span style={{ fontSize: '0.7rem', opacity: 0.4, flexShrink: 0 }}>{(att.file_size / 1024).toFixed(0)} KB</span>}
                            <span style={{ fontSize: '0.68rem', opacity: 0.35, flexShrink: 0 }}>attach</span>
                          </div>
                        );})
                    }
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{allAttachments.length} file{allAttachments.length !== 1 ? 's' : ''} total</span>
                  <PrimaryButton theme={theme} onClick={onSaveAttachments} disabled={attachSaving} style={{ padding: '0.5rem 1.1rem', fontSize: '0.8rem' }}>
                    {attachSaving ? <BtnSpinner /> : null} {attachSaving ? 'Saving…' : 'Save'}
                  </PrimaryButton>
                </div>
                {attachMsg && <div style={{ fontSize: '0.8rem', fontWeight: 500, color: attachMsg.type === 'success' ? (theme.colors.success?.main || '#22c55e') : theme.colors.error.main }}>{attachMsg.text}</div>}
              </>)}
            </>) : (
              /* Read-only sent/failed */
              (() => {
                const sentAtts = allAttachments.filter(a => linkedAttachIds.has(a.id));
                return sentAtts.length === 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 2rem', gap: '0.5rem', opacity: 0.45, textAlign: 'center' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No attachments</div>
                      <div style={{ fontSize: '0.8rem' }}>This email was sent without any attachments.</div>
                    </div>
                  : <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.45 }}>{sentAtts.length} attachment{sentAtts.length !== 1 ? 's' : ''}</div>
                        {sentAtts.length > 1 && (
                          <button
                            onClick={() => onDownloadAttachments(sentAtts.map(a => a.id), sentAtts.map(a => a.filename))}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.65rem', borderRadius: theme.radius.field, border: `1px solid ${theme.colors.base[300]}`, background: 'transparent', color: theme.colors.base.content, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, opacity: 0.65 }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download all
                          </button>
                        )}
                      </div>
                      <div style={{ border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, overflow: 'hidden' }}>
                        {sentAtts.map((att, i) => { const ext = getExt(att.filename); return (
                          <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 0.85rem', background: i % 2 === 0 ? theme.colors.base[100] : 'transparent', borderBottom: i < sentAtts.length - 1 ? `1px solid ${theme.colors.base[300]}` : 'none' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 34, height: 20, padding: '0 5px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0, background: EXT_BG[ext] || '#64748b20', color: EXT_COLOR[ext] || '#64748b' }}>{ext || '?'}</span>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8375rem', fontWeight: 500 }}>{att.filename}</span>
                            {att.file_size != null && <span style={{ fontSize: '0.75rem', opacity: 0.4, flexShrink: 0 }}>{(att.file_size / 1024).toFixed(0)} KB</span>}
                            <button
                              onClick={() => onDownloadAttachments([att.id], [att.filename])}
                              title="Download"
                              style={{ flexShrink: 0, padding: '3px 6px', borderRadius: 4, border: `1px solid ${theme.colors.base[300]}`, background: 'transparent', color: theme.colors.base.content, cursor: 'pointer', opacity: 0.55, display: 'flex', alignItems: 'center' }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </button>
                          </div>
                        );})}
                      </div>
                    </div>;
              })()
            )}
          </ModalBody>
        )}


      </ModalContent>
    </ModalOverlay>

    {confirmClose && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setConfirmClose(false)}>
        <div style={{ background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.box, padding: '1.5rem', maxWidth: 420, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button onClick={() => setConfirmClose(false)} style={{ padding: '0.625rem 1.25rem', borderRadius: theme.radius.field, background: theme.colors.base[200], color: theme.colors.base.content, border: `1px solid ${theme.colors.base[300]}`, fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer' }}>
              Keep editing
            </button>
            <button onClick={() => { setConfirmClose(false); onClose(); }} style={{ padding: '0.625rem 1.25rem', borderRadius: theme.radius.field, background: theme.colors.error.main, color: theme.colors.error.content, border: 'none', fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer' }}>
              Discard changes
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

// ── ModalBody helper (needs to be after styled components) ────────────────────
const ModalBody = styled.div`
  padding: 1.5rem; overflow-y: auto; flex: 1;
  display: flex; flex-direction: column; gap: 1.25rem;
`;

const ModalFooter = styled.div<{ theme: any }>`
  padding: 1.25rem 1.5rem;
  border-top: 1px solid ${p => p.theme.colors.base[300]};
  display: flex; gap: 0.75rem; justify-content: flex-end; align-items: center;
`;

// ═══════════════════════════════════════════════════════════════════════════════
// EMBEDDED: DualTagEmailListItem  — shows company + campaign tags on one card
// ═══════════════════════════════════════════════════════════════════════════════

interface DualTagEmailListItemProps {
  email: EmailRecord;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDelete: (id: number, label: string) => void;
  formatDT: (s?: string) => string;
  theme: any;
}

const DualTagEmailListItem: React.FC<DualTagEmailListItemProps> = ({
  email, selected, onSelect, onOpen, onDelete, formatDT, theme,
}) => {
  const isDraftOrFailed = email.status === 'draft' || email.status === 'failed';
  const isScheduled     = email.status === 'scheduled';
  const dateLabel = isDraftOrFailed
    ? email.created_at ? <EmailMetaItem>🕐 {formatDT(email.created_at)}</EmailMetaItem> : null
    : email.sent_at   ? <EmailMetaItem>{isScheduled ? '⏰ ' : ''}{formatDT(email.sent_at)}</EmailMetaItem> : null;

  return (
    <EmailCard theme={theme} $selected={selected} onClick={onSelect} style={{ cursor: 'pointer' }}>
      <EmailRow>
        <Checkbox theme={theme} $checked={selected}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          style={{ flexShrink: 0, marginRight: '0.25rem' }} />

        <EmailInfo>
          <BadgeRow style={{ marginBottom: '0.375rem', flexWrap: 'wrap' }}>
            <EmailSubject>{email.email_subject || '(No subject)'}</EmailSubject>
            <StatusBadge theme={theme} $status={email.status}>{email.status}</StatusBadge>
            <CompanyTag theme={theme} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <BuildingIcon /> {email.company_name}
            </CompanyTag>
            <CompanyTag theme={theme} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', opacity: 0.7 }}>
              <CampaignIcon /> {email.campaign_name}
            </CompanyTag>
          </BadgeRow>
          <EmailMeta>
            <EmailMetaItem>{email.recipient_email}</EmailMetaItem>
            {dateLabel}
            {email.status === 'sent' && email.read_at && (
              <EmailMetaItem style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: theme.colors.success?.main || '#22c55e', opacity: 0.85 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {formatDT(email.read_at)}
              </EmailMetaItem>
            )}
          </EmailMeta>
          <EmailPreview>{email.email_content.slice(0, 130)}</EmailPreview>
        </EmailInfo>

        <ActionButtons onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <IconButton theme={theme} $size="md" title="View email" onClick={onOpen}><MailSmIcon /></IconButton>
          <IconButton theme={theme} $variant="danger" $size="md" title="Delete"
            onClick={() => onDelete(email.id, `"${email.email_subject}"`)}><TrashIcon /></IconButton>
        </ActionButtons>
      </EmailRow>
    </EmailCard>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// useDropdown — multi-select dropdown with server search + infinite scroll
// ═══════════════════════════════════════════════════════════════════════════════

function useDropdown(fetchFn: (page: number, search: string) => Promise<void>) {
  const [isOpen,  setIsOpen]  = useState(false);
  const [search,  setSearch]  = useState('');
  const [options, setOptions] = useState<DropdownOption[]>([]);
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState<Set<number>>(new Set());
  const [names,   setNames]   = useState<Map<number, string>>(new Map());
  const dropRef     = useRef<HTMLDivElement>(null);
  const menuRef     = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMore = options.length < total;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (isOpen) { setOptions([]); setPage(1); setTotal(0); fetchFn(1, search); }
    else        { setSearch(''); setOptions([]); setPage(1); setTotal(0); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setOptions([]); setPage(1); setTotal(0); fetchFn(1, search); }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const onScroll = () => {
      if (loading || !hasMore) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) fetchFn(page + 1, search);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loading, hasMore, page, search]);

  const toggle = (opt: DropdownOption) => {
    setFilter(p => { const n = new Set(p); n.has(opt.id) ? n.delete(opt.id) : n.add(opt.id); return n; });
    setNames(p  => { const n = new Map(p); n.has(opt.id) ? n.delete(opt.id) : n.set(opt.id, opt.name); return n; });
  };
  const remove = (id: number) => {
    setFilter(p => { const n = new Set(p); n.delete(id); return n; });
    setNames(p  => { const n = new Map(p); n.delete(id); return n; });
  };

  return { isOpen, setIsOpen, search, setSearch, options, setOptions, page, setPage, total, setTotal, loading, setLoading, filter, names, hasMore, dropRef, menuRef, toggle, remove };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const EmailHistory: React.FC = () => {
  const { theme } = useTheme();
  const navigate  = useNavigate();

  // data
  const [emails,        setEmails]        = useState<EmailRecord[]>([]);
  const [serverTotal,   setServerTotal]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize,    setPageSize]    = useState(() => Number(localStorage.getItem('email_history_page_size') || 20));

  // filter / sort
  type SortKey = 'date' | 'subject';
  type SortDir = 'asc' | 'desc';
  const [sortKey,      setSortKey]      = useState<SortKey | null>(null);
  const [sortDir,      setSortDir]      = useState<SortDir>('asc');
  const [statusFilter, setStatusFilter] = useState<EmailStatus | null>(null);
  const [search,       setSearch]       = useState('');

  // selection
  const [selectedIds,  setSelectedIds]  = useState<Set<number>>(new Set());
  const [allSelected,  setAllSelected]  = useState(false);

  // modal
  type ModalTab = 'email' | 'attachments';
  const [modalOpen,     setModalOpen]     = useState(false);
  const [modalTab,      setModalTab]      = useState<ModalTab>('email');
  const [activeEmail,   setActiveEmail]   = useState<EmailRecord | null>(null);
  const [editSubject,   setEditSubject]   = useState('');
  const [editContent,   setEditContent]   = useState('');
  const [editRecipient, setEditRecipient] = useState('');
  const [autoSaving,    setAutoSaving]    = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved     = useRef('');
  const snapSubject   = useRef('');
  const snapContent   = useRef('');
  const snapRecipient = useRef('');
  const snapAttachIds = useRef('');

  // attachments
  const [allAttachments,  setAllAttachments]  = useState<AttachOption[]>([]);
  const [linkedAttachIds, setLinkedAttachIds] = useState<Set<number>>(new Set());
  const [attachSearch,    setAttachSearch]    = useState('');
  const [attachLoading,   setAttachLoading]   = useState(false);
  const [attachSaving,    setAttachSaving]    = useState(false);
  const [attachMsg,       setAttachMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadFile,      setUploadFile]      = useState<File | null>(null);
  const [uploading,       setUploading]       = useState(false);
  const [uploadMsg,       setUploadMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragOver,      setIsDragOver]      = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // branding — removed (read-only, sourced directly from activeEmail.signature / activeEmail.logo_data)

  // schedule / reschedule
  const [schedOpen,   setSchedOpen]   = useState(false);
  const [schedTime,   setSchedTime]   = useState('');
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedTime, setReschedTime] = useState('');

  // toast
  const [toast, setToast] = useState<ToastState>({ visible: false, type: 'info', title: '', message: '' });
  const showToast = useCallback((title: string, message: string, type: ToastState['type'] = 'success') => {
    setToast({ visible: true, type, title, message });
    setTimeout(() => {
      setToast(p => ({ ...p, isExiting: true }));
      setTimeout(() => setToast(p => ({ ...p, visible: false, isExiting: false })), 300);
    }, 4200);
  }, []);

  // confirm
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, title: '', message: '', onConfirm: () => {} });
  const showConfirm = useCallback((
    title: string, message: string, onConfirm: () => void,
    opts?: { danger?: boolean; confirmLabel?: string },
  ) => setConfirm({ open: true, title, message, onConfirm, ...opts }), []);

  // helpers
  const formatDT = (s?: string) => {
    if (!s) return '—';
    const utc = s.includes('Z') ? s : `${s.replace(' ', 'T')}Z`;
    return new Date(utc).toLocaleString();
  };
  const isFuture = (s: string) => new Date(s) > new Date();
  const toISO    = (s: string) => new Date(s).toISOString();
  const minDT    = new Date().toLocaleString('sv-SE').slice(0, 16);

  const toolbarLabelStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    fontSize: '0.75rem', fontWeight: 600, opacity: 0.45,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    marginRight: '0.25rem', flexShrink: 0,
  };

  // ── dropdowns ─────────────────────────────────────────────────────────────
  const DD = 20;

  const companyDD = useDropdown(async (page, search) => {
    companyDD.setLoading(true);
    try {
      const qp = new URLSearchParams({ page: String(page), size: String(DD) });
      if (search.trim()) qp.set('search', search.trim());
      const r = await apiFetch(`${API_BASE}/company/?${qp}`);
      if (!r.ok) return;
      const d = await r.json();
      const items = (d.companies ?? []).map((c: any) => ({ id: c.id, name: c.name }));
      companyDD.setOptions(p => page === 1 ? items : [...p, ...items]);
      companyDD.setTotal(d.total ?? 0); companyDD.setPage(page);
    } finally { companyDD.setLoading(false); }
  });

  const campaignDD = useDropdown(async (page, search) => {
    campaignDD.setLoading(true);
    try {
      const qp = new URLSearchParams({ page: String(page), size: String(DD) });
      if (search.trim()) qp.set('search', search.trim());
      const r = await apiFetch(`${API_BASE}/campaign/?${qp}`);
      if (!r.ok) return;
      const d = await r.json();
      const items = (d.campaigns ?? []).map((c: any) => ({ id: c.id, name: c.name }));
      campaignDD.setOptions(p => page === 1 ? items : [...p, ...items]);
      campaignDD.setTotal(d.total ?? 0); campaignDD.setPage(page);
    } finally { campaignDD.setLoading(false); }
  });

  // ── fetch emails ──────────────────────────────────────────────────────────
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEmails = useCallback(async (
    page: number, size: number, searchTerm: string,
    sKey: SortKey | null, sDir: SortDir, sFilter: EmailStatus | null,
    coFilter: Set<number>, caFilter: Set<number>,
  ) => {
    setLoading(true);
    try {
      const qp = new URLSearchParams({ page: String(page), size: String(size), sort_order: sDir });
      if (searchTerm.trim())  qp.set('search',      searchTerm.trim());
      if (sFilter)            qp.set('status',       sFilter);
      if (sKey)               qp.set('sort_by',      sKey);
      if (coFilter.size > 0)  qp.set('company_ids',  Array.from(coFilter).join(','));
      if (caFilter.size > 0)  qp.set('campaign_ids', Array.from(caFilter).join(','));
      const r = await apiFetch(`${API_BASE}/email/?${qp}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setEmails(d.emails ?? []); setServerTotal(d.total ?? 0);
    } catch { showToast('Error', 'Failed to load emails', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => {
      fetchEmails(currentPage, pageSize, search, sortKey, sortDir, statusFilter, companyDD.filter, campaignDD.filter);
    }, 300);
    return () => { if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, search, sortKey, sortDir, statusFilter, companyDD.filter, campaignDD.filter]);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, sortKey, sortDir, companyDD.filter, campaignDD.filter]);
  useEffect(() => { setSelectedIds(new Set()); setAllSelected(false); },
    [currentPage, pageSize, search, statusFilter, sortKey, sortDir, companyDD.filter, campaignDD.filter]);

  const refreshEmails = useCallback(() => {
    fetchEmails(currentPage, pageSize, search, sortKey, sortDir, statusFilter, companyDD.filter, campaignDD.filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchEmails, currentPage, pageSize, search, sortKey, sortDir, statusFilter, companyDD.filter, campaignDD.filter]);

  // ── pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(serverTotal / pageSize));
  const rangeStart = serverTotal > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd   = Math.min(currentPage * pageSize, serverTotal);

  const handlePageChange     = (p: number) => setCurrentPage(p);
  const handlePageSizeChange = (s: number) => { setPageSize(s); localStorage.setItem('email_history_page_size', String(s)); setCurrentPage(1); };

  const renderPageNumbers = () => {
    const pages: React.ReactNode[] = [];
    const maxV = 5;
    let start = Math.max(1, currentPage - Math.floor(maxV / 2));
    let end   = Math.min(totalPages, start + maxV - 1);
    if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);
    if (start > 1) {
      pages.push(<PaginationButton key={1} theme={theme} onClick={() => handlePageChange(1)}>1</PaginationButton>);
      if (start > 2) pages.push(<PaginationInfo key="e1" theme={theme}>…</PaginationInfo>);
    }
    for (let i = start; i <= end; i++)
      pages.push(<PaginationButton key={i} theme={theme} $isActive={currentPage === i} onClick={() => handlePageChange(i)}>{i}</PaginationButton>);
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push(<PaginationInfo key="e2" theme={theme}>…</PaginationInfo>);
      pages.push(<PaginationButton key={totalPages} theme={theme} onClick={() => handlePageChange(totalPages)}>{totalPages}</PaginationButton>);
    }
    return pages;
  };

  // ── sort / select ─────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const allCurrentPageSelected = emails.length > 0 && emails.every(e => selectedIds.has(e.id));
  const effectiveSelectedCount = selectedIds.size;
  const showBulkBar            = selectedIds.size > 0;

  const fetchAllIds = async (): Promise<number[]> => {
    const qp = new URLSearchParams();
    if (statusFilter)              qp.set('status',       statusFilter);
    if (companyDD.filter.size > 0) qp.set('company_ids',  Array.from(companyDD.filter).join(','));
    if (campaignDD.filter.size > 0) qp.set('campaign_ids', Array.from(campaignDD.filter).join(','));
    if (search.trim())             qp.set('search',       search.trim());
    const r = await apiFetch(`${API_BASE}/email/ids/?${qp}`);
    if (!r.ok) throw new Error('Failed to fetch IDs');
    const d = await r.json();
    return d.ids as number[];
  };

  const toggleSelectAll = async () => {
    if (allSelected) {
      setSelectedIds(new Set()); setAllSelected(false); return;
    }
    try {
      const ids = await fetchAllIds();
      setSelectedIds(new Set(ids)); setAllSelected(true);
    } catch { showToast('Error', 'Could not select all emails', 'error'); }
  };

  const toggleSelect = (id: number) => {
    setAllSelected(false);
    setSelectedIds(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  // ── modal ─────────────────────────────────────────────────────────────────
  const openModal = (email: EmailRecord) => {
    setActiveEmail(email); setEditSubject(email.email_subject);
    setEditContent(email.email_content); setEditRecipient(email.recipient_email);
    setModalTab('email'); setAttachSearch(''); setAttachMsg(null);
    setUploadMsg(null); setUploadFile(null); setIsDragOver(false);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    lastSaved.current = JSON.stringify({ s: email.email_subject, c: email.email_content, r: email.recipient_email });
    setModalOpen(true);
    loadEmailAttachments(email);
    snapSubject.current   = email.email_subject;
    snapContent.current   = email.email_content;
    snapRecipient.current = email.recipient_email;
    snapAttachIds.current = '';
  };

  const closeModal = async () => {
    if (activeEmail?.status === 'draft' || activeEmail?.status === 'scheduled') {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      await doAutoSave(); refreshEmails();
    }
    lastSaved.current = '';
    setModalOpen(false); setActiveEmail(null);
    setSchedOpen(false); setSchedTime(''); setReschedOpen(false); setReschedTime('');
    setModalTab('email'); setAllAttachments([]); setLinkedAttachIds(new Set());
    setUploadFile(null); setUploadMsg(null); setAttachMsg(null);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  // ── auto-save ─────────────────────────────────────────────────────────────
  const doAutoSave = useCallback(async () => {
    if (!activeEmail || (activeEmail.status !== 'draft' && activeEmail.status !== 'scheduled')) return;
    const cur = JSON.stringify({ s: editSubject, c: editContent, r: editRecipient });
    if (cur === lastSaved.current) return;
    setAutoSaving(true);
    try {
      const r = await apiFetch(`${API_BASE}/email/bulk-update/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ email_id: activeEmail.id, email_subject: editSubject, email_content: editContent, recipient_email: editRecipient }] }),
      });
      if (r.ok) lastSaved.current = cur;
    } catch { /* silent */ } finally { setAutoSaving(false); }
  }, [activeEmail, editSubject, editContent, editRecipient]);

  useEffect(() => {
    if (!activeEmail || (activeEmail.status !== 'draft' && activeEmail.status !== 'scheduled') || !modalOpen) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(doAutoSave, 1200);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [editSubject, editContent, editRecipient]);

  // ── attachments ───────────────────────────────────────────────────────────
  const loadEmailAttachments = async (email: EmailRecord) => {
    setAttachLoading(true);
    try {
      // Seed linkedAttachIds from the record already available — no extra fetch needed.
      const ids = (email.attachments ?? []).map((a: EmailAttachment) => a.id);
      setLinkedAttachIds(new Set(ids));
      snapAttachIds.current = JSON.stringify([...ids].sort((a, b) => a - b));

      if (email.status === 'draft' || email.status === 'scheduled') {
        // Editable statuses need the full attachment library for the picker
        const allRes = await apiFetch(`${API_BASE}/attachments/?page=1&page_size=200`);
        if (allRes.ok) { const d = await allRes.json(); setAllAttachments(d.attachments ?? []); }
      } else {
        // Sent/failed: read-only view — use the baked-in list directly
        setAllAttachments(email.attachments ?? []);
      }
    } catch { /* silent */ } finally { setAttachLoading(false); }
  };

  const toggleAttachment = (id: number) => {
    setLinkedAttachIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setAttachMsg(null);
  };

  const saveAttachments = async () => {
    if (!activeEmail) return;
    setAttachSaving(true); setAttachMsg(null);
    try {
      const res = await apiFetch(`${API_BASE}/email/bulk-attachments/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ email_id: activeEmail.id, attachment_ids: Array.from(linkedAttachIds) }] }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      setAttachMsg({ type: 'success', text: 'Attachments saved' });
      snapAttachIds.current = JSON.stringify([...linkedAttachIds].sort((a, b) => a - b));
    } catch (err) { setAttachMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' }); }
    finally { setAttachSaving(false); }
  };

  const handleFilePick = (file: File) => {
    setUploadMsg(null);
    if (file.size > 5 * 1024 * 1024) { setUploadMsg({ type: 'error', text: 'Max 5 MB' }); return; }
    setUploadFile(file);
  };

  const handleUpload = async () => {
    if (!uploadFile || !activeEmail) return;
    setUploading(true); setUploadMsg(null);
    try {
      const fd = new FormData(); fd.append('file', uploadFile);
      const upRes = await apiFetch(`${API_BASE}/attachment/`, { method: 'POST', body: fd });
      if (!upRes.ok) { const e = await upRes.json(); throw new Error(e.detail || 'Upload failed'); }
      const upData = await upRes.json();
      const newIds = Array.from(new Set([...Array.from(linkedAttachIds), upData.id as number]));
      const attRes = await apiFetch(`${API_BASE}/email/bulk-attachments/`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ email_id: activeEmail.id, attachment_ids: newIds }] }),
      });
      if (attRes.ok) setLinkedAttachIds(new Set(newIds));
      await loadEmailAttachments(activeEmail);
      setUploadFile(null); if (uploadInputRef.current) uploadInputRef.current.value = '';
      setUploadMsg({ type: 'success', text: `"${upData.filename}" uploaded and attached` });
    } catch (err) { setUploadMsg({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' }); }
    finally { setUploading(false); }
  };

  // ── actions ───────────────────────────────────────────────────────────────
  const handleSend = (email: EmailRecord) => {
    showConfirm('Send Email', `Send this email to ${email.recipient_email} now?`, async () => {
      setActionLoading(true);
      try {
        if (email.status === 'draft' || email.status === 'scheduled') await doAutoSave();
        const r = await apiFetch(`${API_BASE}/email/bulk-send/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email_ids: [email.id] }) });
        if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Send failed'); }
        const d = await r.json();
        if (d.sent === 0) throw new Error(d.errors?.[0]?.reason || 'Send failed');
        showToast('Email Sent', `Sent to ${email.recipient_email}`); closeModal(); refreshEmails();
      } catch (e: any) { showToast('Send Failed', e.message, 'error'); }
      finally { setActionLoading(false); }
    }, { confirmLabel: 'Send Now' });
  };

  const handleScheduleSubmit = async () => {
    if (!schedTime || !isFuture(schedTime)) { showToast('Invalid Time', 'Please pick a future date and time', 'warning'); return; }
    if (!activeEmail) return;
    setActionLoading(true);
    try {
      if (activeEmail.status === 'draft') await doAutoSave();
      const r = await apiFetch(`${API_BASE}/email/bulk-send/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email_ids: [activeEmail.id], time: toISO(schedTime) }) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Schedule failed'); }
      const d = await r.json();
      if (d.sent === 0) throw new Error(d.errors?.[0]?.reason || 'Schedule failed');
      showToast('Scheduled', `Will send at ${new Date(schedTime).toLocaleString()}`);
      setSchedOpen(false); setSchedTime(''); closeModal(); refreshEmails();
    } catch (e: any) { showToast('Schedule Failed', e.message, 'error'); }
    finally { setActionLoading(false); }
  };

  const handleRescheduleSubmit = async () => {
    if (!reschedTime || !isFuture(reschedTime)) { showToast('Invalid Time', 'Please pick a future date and time', 'warning'); return; }
    if (!activeEmail) return;
    setActionLoading(true);
    try {
      const r = await apiFetch(`${API_BASE}/email/bulk-update/`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: [{ email_id: activeEmail.id, status: 'scheduled', time: toISO(reschedTime) }] }) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Reschedule failed'); }
      const d = await r.json();
      if (d.updated === 0) throw new Error(d.errors?.[0]?.reason || 'Reschedule failed');
      showToast('Rescheduled', `Will now send at ${new Date(reschedTime).toLocaleString()}`);
      setReschedOpen(false); setReschedTime(''); closeModal(); refreshEmails();
    } catch (e: any) { showToast('Reschedule Failed', e.message, 'error'); }
    finally { setActionLoading(false); }
  };

  const handleSaveDraft = async (email: EmailRecord) => {
    setActionLoading(true);
    try {
      const r = await apiFetch(`${API_BASE}/email/draft/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email_ids: [email.id] }) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Failed'); }
      const d = await r.json();
      if (d.drafted === 0) throw new Error(d.errors?.[0]?.reason || 'Failed to create draft');
      showToast('Draft Created', 'A draft copy has been created'); closeModal(); refreshEmails();
    } catch (e: any) { showToast('Failed', e.message, 'error'); }
    finally { setActionLoading(false); }
  };

  const doDelete = async (ids: number[]) => {
    const r = await apiFetch(`${API_BASE}/email/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Delete failed'); }
    return r.json();
  };

  const handleDelete = (id: number, label = 'this email') => {
    showConfirm('Delete Email', `Delete ${label}? This cannot be undone.`, async () => {
      setActionLoading(true);
      try {
        await doDelete([id]);
        showToast('Deleted', 'Email deleted successfully'); closeModal(); refreshEmails();
      } catch (e: any) { showToast('Delete Failed', (e as any).message, 'error'); }
      finally { setActionLoading(false); }
    }, { danger: true, confirmLabel: 'Delete' });
  };

  const downloadAttachments = async (ids: number[], filenames: string[]) => {
    if (ids.length === 0) return;
    try {
      const res = await apiFetch(`${API_BASE}/attachments/download/?ids=${ids.join(',')}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ids.length === 1 ? (filenames[0] ?? `file_${ids[0]}`) : 'attachments.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showToast('Download Failed', 'Could not download attachment(s)', 'error');
    }
  };

  const handleBulkDelete = () => {
    const count = effectiveSelectedCount;
    showConfirm('Delete Emails', `Delete ${count} email${count !== 1 ? 's' : ''}? This cannot be undone.`, async () => {
      setActionLoading(true);
      try {
        const d = await doDelete(Array.from(selectedIds));
        showToast('Deleted', d.message || `${count} emails deleted`, 'success');
        setSelectedIds(new Set()); setAllSelected(false); refreshEmails();
      } catch (e: any) { showToast('Error', (e as any).message || 'Deletion failed', 'error'); }
      finally { setActionLoading(false); }
    }, { danger: true, confirmLabel: 'Delete All' });
  };

  // ── dropdown renderer ─────────────────────────────────────────────────────
  const renderDD = (dd: ReturnType<typeof useDropdown>, label: string, Icon: React.FC) => (
    <div ref={dd.dropRef} style={{ position: 'relative', display: 'inline-block' }}>
      <DropdownTrigger theme={theme} $active={dd.filter.size > 0} onClick={() => dd.setIsOpen(o => !o)}>
        <Icon /> {label}
        {dd.filter.size > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, background: theme.colors.primary.content, color: theme.colors.primary.main }}>
            {dd.filter.size}
          </span>
        )}
        <ChevronDown />
      </DropdownTrigger>
      {dd.isOpen && (
        <DropdownMenu theme={theme} ref={dd.menuRef} style={{ left: 'auto', right: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
            <DropdownSearch theme={theme} placeholder={`Search ${label.toLowerCase()}…`}
              value={dd.search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => dd.setSearch(e.target.value)}
              onClick={(e: React.MouseEvent) => e.stopPropagation()} autoFocus style={{ flex: 1 }} />
            {dd.filter.size > 0 && (
              <button
                onClick={e => { e.stopPropagation(); Array.from(dd.filter).forEach(id => dd.remove(id)); dd.setIsOpen(false); }}
                style={{ flexShrink: 0, padding: '0 0.5rem', height: '30px', borderRadius: theme.radius.field, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: theme.colors.error.main, whiteSpace: 'nowrap', opacity: 0.8 }}>
                Clear
              </button>
            )}
          </div>
          {dd.options.map(opt => (
            <DropdownItem key={opt.id} theme={theme} $checked={dd.filter.has(opt.id)} onClick={() => dd.toggle(opt)}>
              <Checkbox theme={theme} $checked={dd.filter.has(opt.id)} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.name}</span>
            </DropdownItem>
          ))}
          {!dd.loading && dd.options.length === 0 && <div style={{ padding: '0.625rem', fontSize: '0.8rem', opacity: 0.5, textAlign: 'center' }}>No {label.toLowerCase()} found</div>}
          {dd.loading && <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem' }}><MiniSpinner theme={theme} /></div>}
          {!dd.loading && dd.hasMore && <div style={{ padding: '0.3rem', fontSize: '0.72rem', opacity: 0.4, textAlign: 'center' }}>Scroll for more</div>}
        </DropdownMenu>
      )}
    </div>
  );

  const anyFiltersActive = !!(statusFilter || companyDD.filter.size || campaignDD.filter.size);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PageContainer theme={theme}>

      {/* Toast */}
      <ToastContainer $isVisible={toast.visible}>
        {toast.visible && (
          <ToastItem theme={theme} $type={toast.type} $exiting={toast.isExiting}>
            <ToastBody><ToastTitle>{toast.title}</ToastTitle>{toast.message && <ToastMsg>{toast.message}</ToastMsg>}</ToastBody>
            <IconButton theme={theme} $size="sm" onClick={() => setToast(p => ({ ...p, visible: false }))}><XIcon /></IconButton>
          </ToastItem>
        )}
      </ToastContainer>

      {/* Confirm */}
      <ConfirmOverlay $isOpen={confirm.open} onClick={() => setConfirm(p => ({ ...p, open: false }))}>
        <ConfirmBox theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <ConfirmHeader>
            <ConfirmIconWrap theme={theme} $danger={confirm.danger}>{confirm.danger ? <AlertCircle /> : <CheckIcon />}</ConfirmIconWrap>
            <ConfirmContent>
              <ConfirmTitle theme={theme}>{confirm.title}</ConfirmTitle>
              <ConfirmMessage theme={theme}>{confirm.message}</ConfirmMessage>
            </ConfirmContent>
          </ConfirmHeader>
          <ConfirmActions>
            <CancelButton theme={theme} onClick={() => setConfirm(p => ({ ...p, open: false }))}>Cancel</CancelButton>
            {confirm.danger
              ? <DangerButton theme={theme} disabled={actionLoading} onClick={() => { setConfirm(p => ({ ...p, open: false })); confirm.onConfirm(); }}>{actionLoading ? <BtnSpinner /> : <TrashIcon />}{confirm.confirmLabel || 'Delete'}</DangerButton>
              : <PrimaryButton theme={theme} disabled={actionLoading} onClick={() => { setConfirm(p => ({ ...p, open: false })); confirm.onConfirm(); }}>{actionLoading ? <BtnSpinner /> : <CheckIcon />}{confirm.confirmLabel || 'Confirm'}</PrimaryButton>
            }
          </ConfirmActions>
        </ConfirmBox>
      </ConfirmOverlay>

      {/* Detail modal */}
      <EmailDetailModal
        isOpen={modalOpen} onClose={closeModal} activeEmail={activeEmail}
        titleLabel={activeEmail ? `${activeEmail.company_name} · ${activeEmail.campaign_name}` : ''}
        editSubject={editSubject} editContent={editContent} editRecipient={editRecipient}
        onSubjectChange={setEditSubject} onContentChange={setEditContent} onRecipientChange={setEditRecipient}
        autoSaving={autoSaving}
        schedOpen={schedOpen} schedTime={schedTime}
        onSchedOpen={() => { setSchedOpen(true); setSchedTime(''); }}
        onSchedClose={() => { setSchedOpen(false); setSchedTime(''); }}
        onSchedTimeChange={setSchedTime} onScheduleSubmit={handleScheduleSubmit}
        reschedOpen={reschedOpen} reschedTime={reschedTime}
        onReschedOpen={() => { setReschedOpen(true); setReschedTime(''); }}
        onReschedClose={() => { setReschedOpen(false); setReschedTime(''); }}
        onReschedTimeChange={setReschedTime} onRescheduleSubmit={handleRescheduleSubmit}
        actionLoading={actionLoading} onSend={handleSend} onSaveDraft={handleSaveDraft} onDelete={handleDelete}
        tab={modalTab} onTabChange={setModalTab}
        attachLoading={attachLoading} allAttachments={allAttachments} linkedAttachIds={linkedAttachIds}
        attachSearch={attachSearch} onAttachSearchChange={setAttachSearch}
        onToggleAttachment={toggleAttachment} onSaveAttachments={saveAttachments}
        attachSaving={attachSaving} attachMsg={attachMsg}
        uploadFile={uploadFile} onFilePick={handleFilePick} onUpload={handleUpload}
        uploading={uploading} uploadMsg={uploadMsg}
        isDragOver={isDragOver} onDragOver={() => setIsDragOver(true)} onDragLeave={() => setIsDragOver(false)}
        onDrop={handleFilePick}
        onClearUploadFile={() => { setUploadFile(null); setUploadMsg(null); if (uploadInputRef.current) uploadInputRef.current.value = ''; }}
        uploadInputRef={uploadInputRef}
        onDownloadAttachments={downloadAttachments}
        formatDT={formatDT} minDT={minDT} theme={theme}
      />

      {/* Page */}
      <MainContent>
        <HeaderCard theme={theme}>
          <HeaderRow>
            <BackBtn theme={theme} as={Link} to="/campaigns" onClick={(e: React.MouseEvent) => { if (e.ctrlKey || e.metaKey) return; e.preventDefault(); navigate('/campaigns'); }} title="Go back">
              <ArrowLeftIcon />
            </BackBtn>
            <HeaderCenter>
              <HeaderTitle>Email History</HeaderTitle>
              <HeaderSubtitle>All emails across every campaign and company</HeaderSubtitle>
            </HeaderCenter>
          </HeaderRow>
        </HeaderCard>

        <ListSection theme={theme}>
          <SectionHeader theme={theme}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {emails.length > 0 && (
                <Checkbox theme={theme} $checked={allCurrentPageSelected} onClick={toggleSelectAll}
                  title={allCurrentPageSelected ? 'Deselect all' : 'Select all'} />
              )}
              <SectionTitle>
                <MailIcon /> All Emails
                <CountBadge theme={theme}>{serverTotal}</CountBadge>
                {selectedIds.size > 0 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: theme.colors.primary.main, background: `${theme.colors.primary.main}18`, border: `1px solid ${theme.colors.primary.main}40`, borderRadius: '999px', padding: '1px 8px', marginLeft: '2px' }}>
                    {effectiveSelectedCount} selected
                  </span>
                )}
              </SectionTitle>
            </div>
          </SectionHeader>

          {/* Search */}
          <SearchWrapper>
            <SearchIconWrap theme={theme}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </SearchIconWrap>
            <SearchInput theme={theme} type="text" placeholder="Search emails by subject or recipient…"
              value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} />
            {search && (
              <SearchClearBtn theme={theme} onClick={() => setSearch('')} title="Clear search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </SearchClearBtn>
            )}
          </SearchWrapper>

          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <span style={toolbarLabelStyle} title="Sort"><SortIcon /></span>
            {(['date', 'subject'] as SortKey[]).map(key => {
              const active = sortKey === key;
              return (
                <button key={key} onClick={() => handleSort(key)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: '999px', fontSize: '0.8125rem', fontWeight: active ? 600 : 500, cursor: 'pointer', border: `1px solid ${active ? theme.colors.primary.main : theme.colors.base[300]}`, background: active ? theme.colors.primary.main : theme.colors.base[400], color: active ? theme.colors.primary.content : theme.colors.base.content, transition: 'all 0.15s' }}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                  {active && <span style={{ fontSize: '0.7rem', opacity: 0.9 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              );
            })}
            {sortKey && (
              <button onClick={() => { setSortKey(null); setSortDir('asc'); }} style={{ padding: '0.3rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', border: `1px solid ${theme.colors.base[300]}`, background: theme.colors.base[400], color: theme.colors.base.content, opacity: 0.55, transition: 'all 0.15s' }}>
                ✕ Clear
              </button>
            )}
          </div>

          {/* Filters */}
          <FilterBar style={{ marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap', gap: '0.375rem' }}>
            <span style={toolbarLabelStyle} title="Filter"><FilterIcon /></span>
            {(['sent', 'draft', 'scheduled', 'failed'] as EmailStatus[]).map(s => (
              <FilterChip key={s} theme={theme} $active={statusFilter === s}
                onClick={() => setStatusFilter(p => p === s ? null : s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </FilterChip>
            ))}
            {statusFilter && (
              <button onClick={() => setStatusFilter(null)} style={{ padding: '0.3rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', border: `1px solid ${theme.colors.base[300]}`, background: theme.colors.base[400], color: theme.colors.base.content, opacity: 0.55, transition: 'all 0.15s' }}>
                ✕ Clear
              </button>
            )}

            {/* Company + Campaign dropdowns */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {renderDD(companyDD,  'Companies', BuildingIcon)}
              {renderDD(campaignDD, 'Campaigns', CampaignIcon)}
            </div>
          </FilterBar>

          {/* Bulk bar */}
          {showBulkBar && (
            <BulkActionsBar theme={theme} $visible={true}>
              <BulkLeft>
                <CountBadge theme={theme}>{effectiveSelectedCount}</CountBadge>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{selectedIds.size} selected</span>
              </BulkLeft>
              <BulkRight>
                <IconButton theme={theme} $variant="danger" $size="md" title="Delete selected" onClick={handleBulkDelete} disabled={actionLoading}><TrashIcon /></IconButton>
              </BulkRight>
            </BulkActionsBar>
          )}

          {/* List */}
          {loading ? (
            <EmptyState><div style={{ fontSize: '1rem', opacity: 0.5 }}>Loading…</div></EmptyState>
          ) : emails.length === 0 ? (
            <EmptyState>
              <EmptyIcon><MailIcon /></EmptyIcon>
              <EmptyTitle>{search || anyFiltersActive ? 'No emails match' : 'No emails yet'}</EmptyTitle>
              <EmptySubtitle>{search || anyFiltersActive ? 'Try a different search term or filter' : 'Emails will appear here after they are created'}</EmptySubtitle>
            </EmptyState>
          ) : (
            emails.map(email => (
              <DualTagEmailListItem
                key={email.id} email={email}
                selected={selectedIds.has(email.id)}
                onSelect={() => toggleSelect(email.id)}
                onOpen={() => openModal(email)}
                onDelete={handleDelete}
                formatDT={formatDT} theme={theme}
              />
            ))
          )}

          {/* Pagination */}
          {serverTotal > 0 && (
            <PaginationContainer theme={theme}>
              <PaginationButton theme={theme} onClick={() => handlePageChange(1)} disabled={currentPage === 1}>««</PaginationButton>
              <PaginationButton theme={theme} onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>«</PaginationButton>
              {renderPageNumbers()}
              <PaginationButton theme={theme} onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>»</PaginationButton>
              <PaginationButton theme={theme} onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}>»»</PaginationButton>
              <PaginationInfo theme={theme}>{serverTotal > 0 ? `${rangeStart}–${rangeEnd} of ${serverTotal}` : '0'}</PaginationInfo>
              <PageSizeSelect theme={theme} value={pageSize} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handlePageSizeChange(Number(e.target.value))}>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={200}>200 / page</option>
              </PageSizeSelect>
            </PaginationContainer>
          )}

        </ListSection>
      </MainContent>
    </PageContainer>
  );
};

export default EmailHistory;