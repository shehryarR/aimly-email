// ============================================================
// EmailDetailModal.tsx — Shared email detail/edit modal
//
// Used by:
//   - pages/campaignhistory/campaignHistory.tsx
//   - pages/companyhistory/companyEmailHistory.tsx
//
// The only contextual difference between the two usages is the
// modal header title. Pass `titleLabel` to control it:
//   campaignHistory   → email.company_name
//   companyHistory    → email.campaign_name
// ============================================================

import React, { useRef, useState } from 'react';
import {
  ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton,
  ModalBody, ModalFooter,
  FormGroup, FormLabel, FormInput, FormTextarea, ReadBlock,
  CancelButton, DangerButton, PrimaryButton,
  StatusBadge, Spinner, BtnSpinner, AutoSaveNote,
} from './EmailDetailModal.styles';

// ─── types (re-exported so callers don't need to redefine) ────────────────────
export type EmailStatus = 'sent' | 'draft' | 'scheduled' | 'failed';

export interface EmailRecord {
  id: number;
  email_subject: string;
  email_content: string;
  recipient_email: string;
  status: EmailStatus;
  sent_at?: string;
  created_at?: string;
  /** present in campaign history — company the email was sent to */
  company_name?: string;
  /** present in company history  — campaign the email belongs to */
  campaign_name?: string;
  company_id?: number;
  campaign_id?: number;
}

export interface AttachOption {
  id: number;
  filename: string;
  file_size: number | null;
}

// ─── inline icons ─────────────────────────────────────────────────────────────
const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const ScheduleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const DraftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
);

// ─── helper ───────────────────────────────────────────────────────────────────
const getExt = (fn: string) => fn.split('.').pop()?.toLowerCase() || '';

const EXT_BG: Record<string, string> = {
  pdf: '#ef444420', doc: '#3b82f620', docx: '#3b82f620', csv: '#22c55e20', txt: '#64748b20',
};
const EXT_COLOR: Record<string, string> = {
  pdf: '#ef4444',   doc: '#3b82f6',   docx: '#3b82f6',   csv: '#22c55e',   txt: '#64748b',
};

// ─── props ────────────────────────────────────────────────────────────────────
export interface EmailDetailModalProps {
  // modal visibility
  isOpen: boolean;
  onClose: () => void;

  // the email being viewed / edited
  activeEmail: EmailRecord | null;

  // what to show in the modal header (e.g. company_name or campaign_name)
  titleLabel: string;

  // edit state (draft / scheduled emails)
  editSubject: string;
  editContent: string;
  editRecipient: string;
  onSubjectChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onRecipientChange: (v: string) => void;
  autoSaving: boolean;

  // schedule sub-panel
  schedOpen: boolean;
  schedTime: string;
  onSchedOpen: () => void;
  onSchedClose: () => void;
  onSchedTimeChange: (v: string) => void;
  onScheduleSubmit: () => void;

  // reschedule sub-panel (scheduled emails)
  reschedOpen: boolean;
  reschedTime: string;
  onReschedOpen: () => void;
  onReschedClose: () => void;
  onReschedTimeChange: (v: string) => void;
  onRescheduleSubmit: () => void;

  // actions
  actionLoading: boolean;
  onSend: (email: EmailRecord) => void;
  onSaveDraft: (email: EmailRecord) => void;
  onRetry: (email: EmailRecord) => void;
  onDelete: (id: number, label?: string) => void;

  // attachment tab
  tab: 'email' | 'attachments' | 'branding';
  onTabChange: (t: 'email' | 'attachments' | 'branding') => void;
  attachLoading: boolean;
  allAttachments: AttachOption[];
  linkedAttachIds: Set<number>;
  attachSearch: string;
  onAttachSearchChange: (v: string) => void;
  onToggleAttachment: (id: number) => void;
  onSaveAttachments: () => void;
  attachSaving: boolean;
  attachMsg: { type: 'success' | 'error'; text: string } | null;
  // upload
  uploadFile: File | null;
  onFilePick: (file: File) => void;
  onUpload: () => void;
  uploading: boolean;
  uploadMsg: { type: 'success' | 'error'; text: string } | null;
  isDragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (file: File) => void;
  onClearUploadFile: () => void;
  uploadInputRef: React.RefObject<HTMLInputElement>;

  // branding tab
  brandSignature: string;
  onBrandSignatureChange: (v: string) => void;
  brandLogoData: string | null;
  onBrandLogoFile: (file: File) => void;
  onClearBrandLogo: () => void;
  brandLogoUploading: boolean;
  onSaveBranding: () => void;
  brandSaving: boolean;
  brandMsg: { type: 'success' | 'error'; text: string } | null;
  brandLogoInputRef: React.RefObject<HTMLInputElement>;

  // date helpers
  formatDT: (s?: string) => string;
  minDT: string;

  // theme
  theme: any;
  // dirty tracking — caller computes and passes this
  isDirty?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const EmailDetailModal: React.FC<EmailDetailModalProps> = ({
  isOpen, onClose, activeEmail, titleLabel,
  editSubject, editContent, editRecipient,
  onSubjectChange, onContentChange, onRecipientChange, autoSaving,
  schedOpen, schedTime, onSchedOpen, onSchedClose, onSchedTimeChange, onScheduleSubmit,
  reschedOpen, reschedTime, onReschedOpen, onReschedClose, onReschedTimeChange, onRescheduleSubmit,
  actionLoading, onSend, onSaveDraft, onRetry, onDelete,
  tab, onTabChange,
  attachLoading, allAttachments, linkedAttachIds, attachSearch,
  onAttachSearchChange, onToggleAttachment, onSaveAttachments, attachSaving, attachMsg,
  uploadFile, onFilePick, onUpload, uploading, uploadMsg,
  isDragOver, onDragOver, onDragLeave, onDrop, onClearUploadFile, uploadInputRef,
  brandSignature, onBrandSignatureChange, brandLogoData, onBrandLogoFile,
  onClearBrandLogo, brandLogoUploading, onSaveBranding, brandSaving, brandMsg, brandLogoInputRef,
  formatDT, minDT, theme, isDirty = false,
}) => {
  const [confirmClose, setConfirmClose] = useState(false);

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

  const ALLOWED_EXTS = ['.pdf', '.doc', '.docx', '.txt', '.csv'];

  return (
    <>
    <ModalOverlay $isOpen={isOpen} onClick={handleClose}>
      <ModalContent theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <>
          {/* ── Header ── */}
          <ModalHeader theme={theme}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <ModalTitle>{titleLabel}</ModalTitle>
                <StatusBadge theme={theme} $status={activeEmail.status}>
                  {activeEmail.status}
                </StatusBadge>
              </div>
            </div>
            <CloseButton theme={theme} onClick={handleClose}><XIcon /></CloseButton>
          </ModalHeader>

          {/* ── Tab bar ── */}
          <div style={{
            display: 'flex', borderBottom: `1px solid ${theme.colors.base[300]}`,
            background: theme.colorScheme === 'dark' ? theme.colors.base[200] : theme.colors.base[100],
            flexShrink: 0,
          }}>
            {([
              { id: 'email', label: 'Email', icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              )},
              { id: 'attachments', label: 'Attachments', icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              )},
              { id: 'branding', label: 'Branding', icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
              )},
            ] as { id: 'email'|'attachments'|'branding'; label: string; icon: React.ReactNode }[]).map(t => (
              <button key={t.id} onClick={() => onTabChange(t.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.7rem 1.25rem',
                fontSize: '0.8375rem', fontWeight: tab === t.id ? 700 : 500,
                border: 'none', borderBottom: `2px solid ${tab === t.id ? theme.colors.primary.main : 'transparent'}`,
                background: 'none', cursor: 'pointer',
                color: tab === t.id ? theme.colors.primary.main : theme.colors.base.content,
                opacity: tab === t.id ? 1 : 0.55,
                transition: 'all 0.15s', marginBottom: '-1px',
              }}>
                {t.icon}{t.label}
                {t.id === 'attachments' && linkedAttachIds.size > 0 && (
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '999px',
                    background: theme.colors.primary.main + '20', color: theme.colors.primary.main,
                    border: `1px solid ${theme.colors.primary.main}40`,
                  }}>{linkedAttachIds.size}</span>
                )}
              </button>
            ))}
          </div>

          {/* ══════════════ EMAIL TAB ══════════════ */}
          {tab === 'email' && (
            <>
              <ModalBody>
                <FormGroup>
                  <FormLabel theme={theme}>Recipient</FormLabel>
                  {(isDraft || isScheduled || isFailed)
                    ? <FormInput theme={theme} value={editRecipient}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onRecipientChange(e.target.value)}
                        placeholder="recipient@example.com" />
                    : <ReadBlock theme={theme} style={{ fontFamily: 'SF Mono, Monaco, Courier New, monospace', fontSize: '0.825rem' }}>
                        {activeEmail.recipient_email}
                      </ReadBlock>
                  }
                </FormGroup>

                <FormGroup>
                  <FormLabel theme={theme}>Subject</FormLabel>
                  {(isDraft || isScheduled || isFailed)
                    ? <FormInput theme={theme} value={editSubject}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSubjectChange(e.target.value)}
                        placeholder="Email subject" />
                    : <ReadBlock theme={theme}>{activeEmail.email_subject}</ReadBlock>
                  }
                </FormGroup>

                <FormGroup>
                  <FormLabel theme={theme}>Content</FormLabel>
                  {(isDraft || isScheduled || isFailed)
                    ? <FormTextarea theme={theme} value={editContent}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onContentChange(e.target.value)}
                        placeholder="Email body…" />
                    : <ReadBlock theme={theme}>{activeEmail.email_content}</ReadBlock>
                  }
                </FormGroup>

                {(activeEmail.status === 'draft' || activeEmail.status === 'failed')
                  ? activeEmail.created_at && (
                      <FormGroup>
                        <FormLabel theme={theme}>Created At</FormLabel>
                        <ReadBlock theme={theme} style={{ fontSize: '0.825rem' }}>
                          {formatDT(activeEmail.created_at)}
                        </ReadBlock>
                      </FormGroup>
                    )
                  : activeEmail.sent_at && (
                      <FormGroup>
                        <FormLabel theme={theme}>{isScheduled ? 'Scheduled For' : 'Sent At'}</FormLabel>
                        <ReadBlock theme={theme} style={{ fontSize: '0.825rem' }}>
                          {formatDT(activeEmail.sent_at)}
                        </ReadBlock>
                      </FormGroup>
                    )
                }
              </ModalBody>

              <ModalFooter theme={theme}>
                {(isDraft || isScheduled) && autoSaving && (
                  <AutoSaveNote><Spinner theme={theme} $size={13} />Saving…</AutoSaveNote>
                )}

                {isDraft && (
                  <>
                    {schedOpen ? (
                      <>
                        <AutoSaveNote style={{ opacity: 1, marginRight: 'auto' }}>
                          <FormInput theme={theme} type="datetime-local" value={schedTime} min={minDT}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSchedTimeChange(e.target.value)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem', marginBottom: 0 }} />
                        </AutoSaveNote>
                        <CancelButton theme={theme} disabled={actionLoading}
                          onClick={() => { onSchedClose(); }}>Cancel</CancelButton>
                        <PrimaryButton theme={theme} disabled={!schedTime || actionLoading} onClick={onScheduleSubmit}>
                          {actionLoading ? <BtnSpinner /> : <ScheduleIcon />} Confirm
                        </PrimaryButton>
                      </>
                    ) : (
                      <>
                        <CancelButton theme={theme} disabled={actionLoading}
                          onClick={() => { onSchedOpen(); }}>
                          <ScheduleIcon /> Schedule
                        </CancelButton>
                        <PrimaryButton theme={theme} disabled={actionLoading} onClick={() => onSend(activeEmail)}>
                          {actionLoading ? <BtnSpinner /> : <SendIcon />} Send Now
                        </PrimaryButton>
                      </>
                    )}
                  </>
                )}

                {isScheduled && (
                  <>
                    {reschedOpen ? (
                      <>
                        <AutoSaveNote style={{ opacity: 1, marginRight: 'auto' }}>
                          <FormInput theme={theme} type="datetime-local" value={reschedTime} min={minDT}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onReschedTimeChange(e.target.value)}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8125rem', marginBottom: 0 }} />
                        </AutoSaveNote>
                        <CancelButton theme={theme} disabled={actionLoading}
                          onClick={() => { onReschedClose(); }}>Cancel</CancelButton>
                        <PrimaryButton theme={theme} disabled={!reschedTime || actionLoading} onClick={onRescheduleSubmit}>
                          {actionLoading ? <BtnSpinner /> : <ScheduleIcon />} Confirm
                        </PrimaryButton>
                      </>
                    ) : (
                      <>
                        <CancelButton theme={theme} disabled={actionLoading} onClick={() => onSaveDraft(activeEmail)}>
                          <DraftIcon /> Save as Draft
                        </CancelButton>
                        <CancelButton theme={theme} disabled={actionLoading}
                          onClick={() => { onReschedOpen(); }}>
                          <ScheduleIcon /> Reschedule
                        </CancelButton>
                        <PrimaryButton theme={theme} disabled={actionLoading} onClick={() => onSend(activeEmail)}>
                          {actionLoading ? <BtnSpinner /> : <SendIcon />} Send Now
                        </PrimaryButton>
                      </>
                    )}
                  </>
                )}

                {isSent && (
                  <>
                    <DangerButton theme={theme} disabled={actionLoading}
                      onClick={() => onDelete(activeEmail.id, `"${activeEmail.email_subject}"`)}>
                      {actionLoading ? <BtnSpinner /> : <TrashIcon />} Delete
                    </DangerButton>
                    <PrimaryButton theme={theme} disabled={actionLoading} onClick={() => onSaveDraft(activeEmail)}>
                      {actionLoading ? <BtnSpinner /> : <DraftIcon />} Save as Draft
                    </PrimaryButton>
                  </>
                )}

                {isFailed && (
                  <>
                    <DangerButton theme={theme} disabled={actionLoading}
                      onClick={() => onDelete(activeEmail.id, `"${activeEmail.email_subject}"`)}>
                      {actionLoading ? <BtnSpinner /> : <TrashIcon />} Delete
                    </DangerButton>
                    <CancelButton theme={theme} disabled={actionLoading} onClick={() => onSaveDraft(activeEmail)}>
                      {actionLoading ? <BtnSpinner /> : <DraftIcon />} Save as Draft
                    </CancelButton>
                    <PrimaryButton theme={theme} disabled={actionLoading} onClick={() => onRetry(activeEmail)}>
                      {actionLoading ? <BtnSpinner /> : <SendIcon />} Retry
                    </PrimaryButton>
                  </>
                )}
              </ModalFooter>
            </>
          )}

          {/* ══════════════ ATTACHMENTS TAB ══════════════ */}
          {tab === 'attachments' && (
            <ModalBody style={{ gap: '0.75rem' }}>
              {attachLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', opacity: 0.5, fontSize: '0.875rem' }}>Loading…</div>
              ) : (isDraft || isScheduled) ? (
                /* ── DRAFT: full manage UI ── */
                <>
                  {/* Upload zone */}
                  <div>
                    <div
                      onDragOver={e => { e.preventDefault(); onDragOver(); }}
                      onDragLeave={() => onDragLeave()}
                      onDrop={e => { e.preventDefault(); onDragLeave(); const f = e.dataTransfer.files[0]; if (f && !uploading) onDrop(f); }}
                      onClick={() => !uploading && uploadInputRef.current?.click()}
                      style={{
                        border: `2px dashed ${isDragOver ? theme.colors.primary.main : uploadFile ? theme.colors.primary.main + '80' : theme.colors.base[300]}`,
                        borderRadius: theme.radius.field,
                        background: isDragOver ? theme.colors.primary.main + '08' : theme.colors.base[200],
                        padding: '0.85rem 1rem', cursor: uploading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '0.85rem',
                        opacity: uploading ? 0.65 : 1,
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: uploadFile ? theme.colors.primary.main + '15' : theme.colors.base[300], display: 'flex', alignItems: 'center', justifyContent: 'center', color: uploadFile ? theme.colors.primary.main : theme.colors.base.content, opacity: uploadFile ? 1 : 0.4 }}>
                        {uploadFile
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {uploadFile
                          ? <><div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadFile.name}</div>
                              <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: 1 }}>{(uploadFile.size/1024).toFixed(0)} KB · Click to change</div></>
                          : <><div style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.65 }}>Click or drag to upload</div>
                              <div style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: 1 }}>PDF, DOC, DOCX, TXT, CSV · Max 5 MB</div></>
                        }
                      </div>
                      {uploadFile && !uploading && (
                        <button onClick={e => { e.stopPropagation(); onClearUploadFile(); }}
                          style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, border: `1px solid ${theme.colors.base[300]}`, background: theme.colors.base[100], color: theme.colors.base.content, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', opacity: 0.6 }}>✕</button>
                      )}
                      <input ref={uploadInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.csv" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) onFilePick(f); }} disabled={uploading} />
                    </div>
                    {uploadFile && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <PrimaryButton theme={theme} onClick={onUpload} disabled={uploading} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
                          {uploading ? <BtnSpinner /> : null} {uploading ? 'Uploading…' : 'Upload & Attach'}
                        </PrimaryButton>
                      </div>
                    )}
                    {uploadMsg && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', fontWeight: 500, color: uploadMsg.type === 'success' ? (theme.colors.success?.main || '#22c55e') : theme.colors.error.main }}>{uploadMsg.text}</div>
                    )}
                  </div>

                  <div style={{ height: 1, background: theme.colors.base[300] }} />

                  {allAttachments.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', gap: '0.4rem', opacity: 0.5, textAlign: 'center' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="26" height="26"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>No files uploaded yet</div>
                      <div style={{ fontSize: '0.8rem' }}>Use the upload area above to add files.</div>
                    </div>
                  ) : (
                    <>
                      {/* Search */}
                      <input
                        type="text" placeholder="Search files…" value={attachSearch}
                        onChange={e => onAttachSearchChange(e.target.value)}
                        style={{
                          width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.8125rem',
                          border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field,
                          background: theme.colors.base[200], color: theme.colors.base.content, outline: 'none',
                        }}
                      />

                      {/* Attached */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: theme.colors.primary.main }}>
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                          </svg>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.45 }}>Attached</span>
                          <span style={{ fontSize: '0.67rem', fontWeight: 600, background: theme.colors.primary.main + '20', color: theme.colors.primary.main, borderRadius: '999px', padding: '1px 6px' }}>{attachedFiles.length}</span>
                        </div>
                        <div style={{ maxHeight: 140, overflowY: 'auto', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, background: theme.colors.base[200] }}>
                          {attachedFiles.length === 0
                            ? <div style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.8rem', opacity: 0.5 }}>
                                {attachSearch ? `No attached files match "${attachSearch}"` : 'No files attached — select below to attach'}
                              </div>
                            : attachedFiles.map(att => {
                                const ext = getExt(att.filename);
                                return (
                                  <div key={att.id} onClick={() => onToggleAttachment(att.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', cursor: 'pointer', background: theme.colors.primary.main + '10', borderBottom: `1px solid ${theme.colors.base[300]}`, transition: 'background 0.1s' }}>
                                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${theme.colors.primary.main}`, background: theme.colors.primary.main, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 18, padding: '0 4px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0, background: EXT_BG[ext] || '#64748b20', color: EXT_COLOR[ext] || '#64748b' }}>{ext || '?'}</span>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem', fontWeight: 500 }}>{att.filename}</span>
                                    {att.file_size != null && <span style={{ fontSize: '0.7rem', opacity: 0.4, flexShrink: 0 }}>{(att.file_size / 1024).toFixed(0)} KB</span>}
                                    <span style={{ fontSize: '0.68rem', opacity: 0.35, flexShrink: 0 }}>detach</span>
                                  </div>
                                );
                              })
                          }
                        </div>
                      </div>

                      {/* Not attached */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                            <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                          </svg>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.45 }}>Not Attached</span>
                          <span style={{ fontSize: '0.67rem', fontWeight: 600, background: theme.colors.base[300], borderRadius: '999px', padding: '1px 6px', opacity: 0.55 }}>{unattachedFiles.length}</span>
                        </div>
                        <div style={{ maxHeight: 140, overflowY: 'auto', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, background: theme.colors.base[200] }}>
                          {unattachedFiles.length === 0
                            ? <div style={{ padding: '0.85rem', textAlign: 'center', fontSize: '0.8rem', opacity: 0.5 }}>
                                {attachSearch ? `No unattached files match "${attachSearch}"` : 'All files are attached'}
                              </div>
                            : unattachedFiles.map(att => {
                                const ext = getExt(att.filename);
                                return (
                                  <div key={att.id} onClick={() => onToggleAttachment(att.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: `1px solid ${theme.colors.base[300]}`, transition: 'background 0.1s' }}>
                                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${theme.colors.base[300]}`, flexShrink: 0 }} />
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 18, padding: '0 4px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0, background: EXT_BG[ext] || '#64748b20', color: EXT_COLOR[ext] || '#64748b' }}>{ext || '?'}</span>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem', fontWeight: 500 }}>{att.filename}</span>
                                    {att.file_size != null && <span style={{ fontSize: '0.7rem', opacity: 0.4, flexShrink: 0 }}>{(att.file_size / 1024).toFixed(0)} KB</span>}
                                    <span style={{ fontSize: '0.68rem', opacity: 0.35, flexShrink: 0 }}>attach</span>
                                  </div>
                                );
                              })
                          }
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{allAttachments.length} file{allAttachments.length !== 1 ? 's' : ''} total</span>
                        <PrimaryButton theme={theme} onClick={onSaveAttachments} disabled={attachSaving} style={{ padding: '0.5rem 1.1rem', fontSize: '0.8rem' }}>
                          {attachSaving ? <BtnSpinner /> : null} {attachSaving ? 'Saving…' : 'Save'}
                        </PrimaryButton>
                      </div>
                      {attachMsg && (
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, color: attachMsg.type === 'success' ? (theme.colors.success?.main || '#22c55e') : theme.colors.error.main }}>{attachMsg.text}</div>
                      )}
                    </>
                  )}
                </>
              ) : (
                /* ── NON-DRAFT: read-only list of what was attached ── */
                (() => {
                  const sentAtts = allAttachments.filter(a => linkedAttachIds.has(a.id));
                  return sentAtts.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 2rem', gap: '0.5rem', opacity: 0.45, textAlign: 'center' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="30" height="30"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No attachments</div>
                      <div style={{ fontSize: '0.8rem' }}>This email was sent without any attachments.</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.45, marginBottom: '0.6rem' }}>
                        {sentAtts.length} attachment{sentAtts.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, overflow: 'hidden' }}>
                        {sentAtts.map((att, i) => {
                          const ext = getExt(att.filename);
                          return (
                            <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 0.85rem', background: i % 2 === 0 ? theme.colors.base[200] : 'transparent', borderBottom: i < sentAtts.length - 1 ? `1px solid ${theme.colors.base[300]}` : 'none' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 34, height: 20, padding: '0 5px', borderRadius: 4, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0, background: EXT_BG[ext] || '#64748b20', color: EXT_COLOR[ext] || '#64748b' }}>{ext || '?'}</span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8375rem', fontWeight: 500 }}>{att.filename}</span>
                              {att.file_size != null && <span style={{ fontSize: '0.75rem', opacity: 0.4, flexShrink: 0 }}>{(att.file_size / 1024).toFixed(0)} KB</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              )}
            </ModalBody>
          )}

          {/* ══════════════ BRANDING TAB ══════════════ */}
          {tab === 'branding' && (
            <ModalBody style={{ gap: '1.25rem' }}>
              {isDraft || isScheduled ? (
                /* ── DRAFT: editable logo + signature ── */
                <>
                  {/* Logo */}
                  <FormGroup>
                    <FormLabel theme={theme}>
                      Logo
                      <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.5, marginLeft: '0.3rem', textTransform: 'none', letterSpacing: 0 }}>PNG, JPG, GIF or WebP · max 5 MB</span>
                    </FormLabel>
                    <div
                      onClick={() => !brandLogoUploading && brandLogoInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); if (!brandLogoUploading) { const f = e.dataTransfer.files[0]; if (f) onBrandLogoFile(f); } }}
                      style={{
                        width: '100%', height: brandLogoData ? 90 : 76,
                        border: `2px dashed ${brandLogoData ? theme.colors.primary.main : theme.colors.base[300]}`,
                        borderRadius: theme.radius.field, background: theme.colors.base[200],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: brandLogoUploading ? 'not-allowed' : 'pointer',
                        position: 'relative', overflow: 'hidden', transition: 'border-color 0.15s',
                        opacity: brandLogoUploading ? 0.6 : 1,
                      }}
                    >
                      {brandLogoData ? (
                        <>
                          <img src={brandLogoData} alt="Logo" style={{ maxHeight: 66, maxWidth: '92%', objectFit: 'contain', borderRadius: 4 }} />
                          <button onClick={e => { e.stopPropagation(); onClearBrandLogo(); }}
                            style={{ position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: '50%', border: `1px solid ${theme.colors.base[300]}`, background: theme.colors.base[100], color: theme.colors.base.content, fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.75 }}>✕</button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', opacity: 0.4, fontSize: '0.75rem', pointerEvents: 'none' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                          </svg>
                          <span>{brandLogoUploading ? 'Processing…' : 'Click or drag to upload'}</span>
                        </div>
                      )}
                    </div>
                    <input ref={brandLogoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f && !brandLogoUploading) onBrandLogoFile(f); e.target.value = ''; }}
                      disabled={brandLogoUploading} />
                  </FormGroup>

                  {/* Signature */}
                  <FormGroup>
                    <FormLabel theme={theme}>Email Signature</FormLabel>
                    <FormTextarea theme={theme} rows={4} placeholder={'Best,\nJohn Smith\nAcme Corp'}
                      value={brandSignature}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { onBrandSignatureChange(e.target.value); }}
                      style={{ minHeight: 100 }} />
                  </FormGroup>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    {brandMsg && (
                      <div style={{ fontSize: '0.8rem', fontWeight: 500, color: brandMsg.type === 'success' ? (theme.colors.success?.main || '#22c55e') : theme.colors.error.main }}>{brandMsg.text}</div>
                    )}
                    <PrimaryButton theme={theme} onClick={onSaveBranding} disabled={brandSaving} style={{ marginLeft: 'auto', padding: '0.5rem 1.1rem', fontSize: '0.8rem' }}>
                      {brandSaving ? <BtnSpinner /> : null} {brandSaving ? 'Saving…' : 'Save'}
                    </PrimaryButton>
                  </div>
                </>
              ) : (
                /* ── NON-DRAFT: read-only display of logo + signature ── */
                (brandLogoData || brandSignature) ? (
                  <>
                    {brandLogoData && (
                      <FormGroup>
                        <FormLabel theme={theme}>Logo</FormLabel>
                        <div style={{ padding: '0.75rem 1rem', background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                          <img src={brandLogoData} alt="Logo" style={{ maxHeight: 64, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }} />
                        </div>
                      </FormGroup>
                    )}
                    {brandSignature && (
                      <FormGroup>
                        <FormLabel theme={theme}>Email Signature</FormLabel>
                        <ReadBlock theme={theme} style={{ whiteSpace: 'pre-wrap', minHeight: 60 }}>{brandSignature}</ReadBlock>
                      </FormGroup>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 2rem', gap: '0.5rem', opacity: 0.45, textAlign: 'center' }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No branding set</div>
                    <div style={{ fontSize: '0.8rem' }}>This email was sent without a logo or signature.</div>
                  </div>
                )
              )}
            </ModalBody>
          )}
        </>
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

export default EmailDetailModal;