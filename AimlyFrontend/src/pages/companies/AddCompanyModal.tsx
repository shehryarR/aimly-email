// ============================================================
// AddCompanyModal.tsx
// Three-tab modal: Manual entry | CSV upload | AI search
// AI tab: query + limit only (no campaign_id, no extra field checkboxes)
// No cancel button in footer
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton,
  ModalBody, ModalFooter, FormGroup, Label, Input, Textarea,
  SaveButton,
} from './companies.styles';
import { apiFetch } from '../../App';

// ── Animations ─────────────────────────────────────────────
const spin      = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const fadeSlide = keyframes`from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}`;

// ── Tab bar ────────────────────────────────────────────────
const TabBar = styled.div<{ theme: any }>`
  display: flex;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  margin-bottom: 1.5rem;
`;

const Tab = styled.button<{ theme: any; $active: boolean }>`
  flex: 1;
  padding: 0.7rem 0.5rem;
  font-size: 0.8125rem;
  font-weight: ${p => p.$active ? 600 : 500};
  cursor: pointer;
  border: none;
  border-bottom: 2px solid ${p => p.$active ? p.theme.colors.primary.main : 'transparent'};
  background: transparent;
  color: ${p => p.$active ? p.theme.colors.primary.main : p.theme.colors.base.content};
  opacity: ${p => p.$active ? 1 : 0.55};
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  transition: all 0.15s;
  margin-bottom: -1px;
  &:hover { opacity: 1; color: ${p => p.theme.colors.primary.main}; }
  svg { width: 14px; height: 14px; }
`;

// ── Drop zone ──────────────────────────────────────────────
const DropZone = styled.div<{ theme: any; $isDragging: boolean; $hasFile: boolean }>`
  border: 2px dashed ${p =>
    p.$hasFile ? p.theme.colors.primary.main
    : p.$isDragging ? p.theme.colors.primary.main
    : p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p =>
    p.$hasFile ? `${p.theme.colors.primary.main}08`
    : p.$isDragging ? `${p.theme.colors.primary.main}06`
    : p.theme.colors.base[200]};
  padding: 2rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { border-color: ${p => p.theme.colors.primary.main}; }
`;

const DropIcon = styled.div`font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;`;
const DropText = styled.div<{ theme: any }>`font-size: 0.875rem; font-weight: 600; color: ${p => p.theme.colors.base.content}; margin-bottom: 0.25rem;`;
const DropSub  = styled.div`font-size: 0.75rem; opacity: 0.5;`;

const FileChip = styled.div<{ theme: any }>`
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: ${p => p.theme.colors.primary.main}18;
  border: 1px solid ${p => p.theme.colors.primary.main}40;
  border-radius: 999px;
  font-size: 0.8rem; font-weight: 600;
  color: ${p => p.theme.colors.primary.main};
  margin-top: 0.75rem;
`;

// ── Count select ───────────────────────────────────────────
// ── Spinner (for submit button) ────────────────────────────
const Spinner = styled.div`
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ${spin} 0.65s linear infinite;
  flex-shrink: 0;
`;

// ── Spinner for improve-prompt button ──────────────────────
const ImproveSpinner = styled.div<{ theme: any }>`
  width: 12px; height: 12px;
  border: 2px solid ${p => p.theme.colors.primary.main}40;
  border-top-color: ${p => p.theme.colors.primary.main};
  border-radius: 50%;
  animation: ${spin} 0.65s linear infinite;
  flex-shrink: 0;
`;

// ── Spinner for Tavily checking (uses theme colour) ────────
const CheckSpinner = styled.div<{ theme: any }>`
  width: 32px; height: 32px;
  border: 3px solid ${p => p.theme.colors.base[300]};
  border-top-color: ${p => p.theme.colors.primary.main};
  border-radius: 50%;
  animation: ${spin} 0.75s linear infinite;
`;

// ── Result banner ──────────────────────────────────────────
const ResultBanner = styled.div<{ theme: any; $type: 'success' | 'warning' | 'error' }>`
  padding: 0.625rem 0.875rem;
  border-radius: ${p => p.theme.radius.field};
  font-size: 0.825rem; font-weight: 500;
  margin-top: 0.75rem;
  animation: ${fadeSlide} 0.2s ease;
  ${p => p.$type === 'success' ? `
    background: ${p.theme.colors.success.main}12;
    border: 1px solid ${p.theme.colors.success.main}60;
    color: ${p.theme.colors.success.main};
  ` : p.$type === 'warning' ? `
    background: ${p.theme.colors.warning.main}12;
    border: 1px solid ${p.theme.colors.warning.main}60;
    color: ${p.theme.colors.warning.main};
  ` : `
    background: ${p.theme.colors.error.main}12;
    border: 1px solid ${p.theme.colors.error.main}60;
    color: ${p.theme.colors.error.main};
  `}
`;

// ── Tavily status box ──────────────────────────────────────
const TavilyStatusBox = styled.div<{ theme: any; $status: 'checking' | 'ok' | 'error' }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2.5rem 1.5rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p =>
    p.$status === 'ok'       ? p.theme.colors.success?.main + '60' || '#22c55e60'
    : p.$status === 'error'  ? p.theme.colors.error.main + '60'
    : p.theme.colors.base[300]};
  background: ${p =>
    p.$status === 'ok'       ? (p.theme.colors.success?.main || '#22c55e') + '08'
    : p.$status === 'error'  ? p.theme.colors.error.main + '06'
    : p.theme.colors.base[200]};
  text-align: center;
  animation: ${fadeSlide} 0.2s ease;
`;

const TavilyStatusIcon = styled.div<{ $status: 'checking' | 'ok' | 'error' }>`
  font-size: 2.25rem;
  line-height: 1;
`;

const TavilyStatusTitle = styled.div<{ theme: any; $status: 'checking' | 'ok' | 'error' }>`
  font-size: 1rem;
  font-weight: 600;
  color: ${p =>
    p.$status === 'ok'      ? p.theme.colors.success?.main || '#22c55e'
    : p.$status === 'error' ? p.theme.colors.error.main
    : p.theme.colors.base.content};
`;

const TavilyStatusMsg = styled.div<{ theme: any }>`
  font-size: 0.8125rem;
  opacity: 0.7;
  line-height: 1.5;
  max-width: 340px;
`;

// ── CSV format hint ────────────────────────────────────────
const CodeHint = styled.code<{ theme: any }>`
  display: block;
  padding: 0.6rem 0.875rem;
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  font-size: 0.75rem;
  font-family: 'Courier New', monospace;
  color: ${p => p.theme.colors.base.content};
  margin-top: 0.5rem;
  line-height: 1.6;
  opacity: 0.8;
`;

// ── Icons ──────────────────────────────────────────────────
const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/>
  </svg>
);
const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);
const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
    <path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75z"/>
    <path d="M5 15l.75 2.25L8 18l-2.25.75L5 21l-.75-2.25L2 18l2.25-.75z"/>
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

// ── Types ──────────────────────────────────────────────────
type ModalTab = 'manual' | 'csv' | 'ai';

interface AddResult { type: 'success' | 'warning' | 'error'; text: string; }

interface AddCompanyModalProps {
  isOpen: boolean;
  theme: any;
  apiBase: string;
  initialTab?: ModalTab;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Component ──────────────────────────────────────────────
const AddCompanyModal: React.FC<AddCompanyModalProps> = ({
  isOpen, theme, apiBase, initialTab = 'manual', onClose, onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);

  React.useEffect(() => { if (isOpen) setActiveTab(initialTab); }, [isOpen, initialTab]);

  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<AddResult | null>(null);

  // Manual form
  const [manual, setManual] = useState({ name: '', email: '', phone_number: '', address: '', company_info: '' });

  // CSV
  const [csvFile, setCsvFile]     = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI — query and limit only
  const [aiQuery, setAiQuery] = useState('');
  const [aiLimit, setAiLimit] = useState(10);
  const [aiLimitRaw, setAiLimitRaw] = useState('10');
  const [aiIncludePhone,   setAiIncludePhone]   = useState(true);
  const [aiIncludeAddress, setAiIncludeAddress] = useState(true);
  const [aiIncludeInfo,    setAiIncludeInfo]    = useState(true);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);

  // Tavily + LLM status — checked once when AI tab is first opened
  type TavilyStatus = 'idle' | 'checking' | 'ok' | 'error';
  const [tavilyStatus,     setTavilyStatus]    = useState<TavilyStatus>('idle');
  const [tavilyMessage,    setTavilyMessage]   = useState('');
  const [tavilyStatusCode, setTavilyStatusCode] = useState<number>(0);
  const [llmMessage,       setLlmMessage]      = useState('');
  const [llmStatusCode,    setLlmStatusCode]   = useState<number>(0);


  // Check Tavily + LLM whenever AI tab becomes active
  const checkTavily = async () => {
    setTavilyStatus('checking');
    setTavilyMessage(''); setTavilyStatusCode(0);
    setLlmMessage('');    setLlmStatusCode(0);
    try {
      const res = await apiFetch(`${apiBase}/user_keys/status/`, {
        
      });
      const d = await res.json();
      const tvCode: number = d.tavily?.status_code ?? 0;
      const llmCode: number = d.llm?.status_code ?? 0;
      setTavilyStatusCode(tvCode);
      setTavilyMessage(d.tavily?.status_text || '');
      setLlmStatusCode(llmCode);
      setLlmMessage(d.llm?.status_text || '');
      if (tvCode === 1 && llmCode === 1) {
        setTavilyStatus('ok');
      } else {
        setTavilyStatus('error');
      }
    } catch {
      setTavilyStatus('error');
      setTavilyMessage('Could not reach server to verify keys');
      setTavilyStatusCode(3);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai' && tavilyStatus === 'idle') {
      checkTavily();
    }
  }, [activeTab]);

  const resetAll = () => {
    setManual({ name: '', email: '', phone_number: '', address: '', company_info: '' });
    setCsvFile(null);
    setAiQuery(''); setAiLimit(10);
    setAiIncludePhone(true); setAiIncludeAddress(true); setAiIncludeInfo(true);
    setTavilyStatus('idle'); setTavilyMessage(''); setTavilyStatusCode(0);
    setLlmMessage(''); setLlmStatusCode(0); setTavilyStatusCode(0);
    setLlmMessage('');    setLlmStatusCode(0);
    setResult(null);
  };

  const handleClose = () => { resetAll(); onClose(); };

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

  const showResult = (r: AddResult) => {
    setResult(r);
    if (r.type === 'success') {
      setTimeout(() => { resetAll(); onSuccess(); onClose(); }, 1400);
    }
  };

  // ── Submit manual ─────────────────────────────────────────
  // Backend expects multipart/form-data (due to UploadFile param).
  // JSON body is never parsed when File() is present — send as FormData.
  const submitManual = async () => {
    if (!manual.name.trim() || !manual.email.trim()) {
      setResult({ type: 'error', text: 'Name and email are required' }); return;
    }
    setLoading(true); setResult(null);
    try {
      const formData = new FormData();
      formData.append('companies', JSON.stringify([{
        name:         manual.name.trim(),
        email:        manual.email.trim(),
        phone_number: manual.phone_number.trim() || null,
        address:      manual.address.trim()      || null,
        company_info: manual.company_info.trim() || null,
      }]));
      const res = await apiFetch(`${apiBase}/company/`, {
        method: 'POST', // no Content-Type — let browser set multipart boundary
        body: formData,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed');
      if (d.skipped > 0 && d.created === 0)
        showResult({ type: 'warning', text: 'Company already exists (duplicate email)' });
      else
        showResult({ type: 'success', text: `"${manual.name}" added successfully` });
    } catch (err) {
      showResult({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add company' });
    } finally { setLoading(false); }
  };

  // ── Submit CSV — close immediately, fire in background ──────
  const submitCsv = () => {
    if (!csvFile) { setResult({ type: 'error', text: 'Select a CSV file first' }); return; }
    resetAll(); onSuccess(); onClose();
    const formData = new FormData();
    formData.append('file', csvFile);
    apiFetch(`${apiBase}/company/`, { method: 'POST', body: formData })
      .catch(() => { /* silent — polling will stop naturally */ });
  };

  // ── Submit AI — close immediately, fire in background ───────
  const submitAi = () => {
    if (!aiQuery.trim()) { setResult({ type: 'error', text: 'Enter a search query' }); return; }
    resetAll(); onSuccess(); onClose();
    const formData = new FormData();
    formData.append('ai_search', JSON.stringify({
      query: aiQuery.trim(),
      limit: aiLimit,
      include_phone:        aiIncludePhone,
      include_address:      aiIncludeAddress,
      include_company_info: aiIncludeInfo,
    }));
    apiFetch(`${apiBase}/company/`, { method: 'POST', body: formData })
      .catch(() => { /* silent — polling will stop naturally */ });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) { setCsvFile(f); setResult(null); }
    else setResult({ type: 'error', text: 'Only .csv files are accepted' });
  };

  const handleSubmit = () => {
    if (activeTab === 'manual') submitManual();
    else if (activeTab === 'csv') submitCsv();
    else submitAi();
  };

  const submitLabel = loading
    ? 'Processing…'
    : activeTab === 'manual' ? 'Add Company'
    : activeTab === 'csv'    ? 'Import CSV'
    : 'Search & Import';

  return (
    <ModalOverlay $isOpen={isOpen} onClick={handleClose}>
      <ModalContent theme={theme} $wide onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <ModalHeader theme={theme}>
          <ModalTitle>Add Companies</ModalTitle>
          <CloseButton theme={theme} onClick={handleClose}><CloseIcon /></CloseButton>
        </ModalHeader>

        <ModalBody>
          {/* Tab bar */}
          <TabBar theme={theme}>
            <Tab theme={theme} $active={activeTab === 'manual'} onClick={() => { setActiveTab('manual'); setResult(null); }}>
              <PencilIcon /> Manual
            </Tab>
            <Tab theme={theme} $active={activeTab === 'csv'} onClick={() => { setActiveTab('csv'); setResult(null); }}>
              <FileIcon /> CSV Upload
            </Tab>
            <Tab theme={theme} $active={activeTab === 'ai'} onClick={() => { setActiveTab('ai'); setResult(null); }}>
              <SparkleIcon /> AI Search
            </Tab>
          </TabBar>

          {/* ── Manual tab ─────────────────────────────────── */}
          {activeTab === 'manual' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormGroup>
                <Label theme={theme}>Company Name *</Label>
                <Input theme={theme} value={manual.name}
                  onChange={e => setManual(p => ({ ...p, name: e.target.value }))}
                  placeholder="Acme Corp" autoFocus />
              </FormGroup>
              <FormGroup>
                <Label theme={theme}>Email *</Label>
                <Input theme={theme} type="email" value={manual.email}
                  onChange={e => setManual(p => ({ ...p, email: e.target.value }))}
                  placeholder="contact@acme.com" />
              </FormGroup>
              <FormGroup>
                <Label theme={theme}>Phone</Label>
                <Input theme={theme} value={manual.phone_number}
                  onChange={e => setManual(p => ({ ...p, phone_number: e.target.value }))}
                  placeholder="+1 (555) 000-0000" />
              </FormGroup>
              <FormGroup style={{ gridColumn: '1 / -1' }}>
                <Label theme={theme}>Address</Label>
                <Input theme={theme} value={manual.address}
                  onChange={e => setManual(p => ({ ...p, address: e.target.value }))}
                  placeholder="123 Main St, City, State" />
              </FormGroup>
              <FormGroup style={{ gridColumn: '1 / -1' }}>
                <Label theme={theme}>Company Info</Label>
                <Textarea theme={theme} rows={3} value={manual.company_info}
                  onChange={e => setManual(p => ({ ...p, company_info: e.target.value }))}
                  placeholder="Brief description of the company…" />
              </FormGroup>
            </div>
          )}

          {/* ── CSV tab ────────────────────────────────────── */}
          {activeTab === 'csv' && (
            <div>
              <DropZone
                theme={theme}
                $isDragging={isDragging}
                $hasFile={!!csvFile}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <DropIcon>{csvFile ? '✅' : '📄'}</DropIcon>
                <DropText theme={theme}>
                  {csvFile ? csvFile.name : 'Drop your CSV here or click to browse'}
                </DropText>
                <DropSub>{csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : 'Only .csv files accepted'}</DropSub>
                {csvFile && <FileChip theme={theme}><FileIcon /> {csvFile.name}</FileChip>}
                <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setCsvFile(f); setResult(null); } e.target.value = ''; }} />
              </DropZone>

              <div style={{ marginTop: '1.25rem' }}>
                <Label theme={theme}>Required CSV format</Label>
                <CodeHint theme={theme}>
                  company_name, email, phone_number, address, company_info{'\n'}
                  Acme Corp, contact@acme.com, +1555000, "123 Main St", "B2B SaaS"
                </CodeHint>
                <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.4rem' }}>
                  Only <strong>company_name</strong> and <strong>email</strong> are required. Duplicates are skipped automatically.
                </div>
              </div>
            </div>
          )}

          {/* ── AI search tab — gated on Tavily + LLM status ──── */}
          {activeTab === 'ai' && (
            <div>
              {/* Checking state */}
              {tavilyStatus === 'checking' && (
                <TavilyStatusBox theme={theme} $status="checking">
                  <TavilyStatusIcon $status="checking" style={{ display: 'flex', justifyContent: 'center' }}>
                    <CheckSpinner theme={theme} />
                  </TavilyStatusIcon>
                  <TavilyStatusTitle theme={theme} $status="checking">Checking API keys…</TavilyStatusTitle>
                  <TavilyStatusMsg theme={theme}>Verifying Tavily and LLM keys are configured and working.</TavilyStatusMsg>
                </TavilyStatusBox>
              )}

              {/* Error / not configured */}
              {tavilyStatus === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Tavily error */}
                  {tavilyStatusCode !== 1 && (
                    <TavilyStatusBox theme={theme} $status="error">
                      <TavilyStatusIcon $status="error">
                        {tavilyStatusCode === 0 ? '🔑' : tavilyStatusCode === 2 ? '⚠️' : '❌'}
                      </TavilyStatusIcon>
                      <TavilyStatusTitle theme={theme} $status="error">
                        {tavilyStatusCode === 0 ? 'Tavily API Key Not Set'
                          : tavilyStatusCode === 2 ? 'Tavily Usage Limit Reached'
                          : 'Tavily API Key Not Working'}
                      </TavilyStatusTitle>
                      <TavilyStatusMsg theme={theme}>
                        {tavilyMessage || 'AI search requires a Tavily API key.'}{' '}
                        {tavilyStatusCode === 0 && <>Get a free key at{' '}
                          <a href="https://tavily.com" target="_blank" rel="noopener noreferrer"
                            style={{ color: 'inherit', textDecoration: 'underline' }}>tavily.com</a>.</>}
                      </TavilyStatusMsg>
                    </TavilyStatusBox>
                  )}
                  {/* LLM error */}
                  {llmStatusCode !== 1 && (
                    <TavilyStatusBox theme={theme} $status="error">
                      <TavilyStatusIcon $status="error">
                        {llmStatusCode === 0 ? '🔑' : llmStatusCode === 2 ? '⚠️' : '❌'}
                      </TavilyStatusIcon>
                      <TavilyStatusTitle theme={theme} $status="error">
                        {llmStatusCode === 0 ? 'LLM API Key Not Set'
                          : llmStatusCode === 2 ? 'LLM Usage Limit Reached'
                          : 'LLM API Key Not Working'}
                      </TavilyStatusTitle>
                      <TavilyStatusMsg theme={theme}>
                        {llmMessage || 'AI search requires an LLM API key to generate company profiles.'}
                      </TavilyStatusMsg>
                    </TavilyStatusBox>
                  )}
                </div>
              )}

              {/* OK — show form */}
              {tavilyStatus === 'ok' && (
                <>
                  <FormGroup>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <Label theme={theme} style={{ marginBottom: 0 }}>Search Query *</Label>
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
                          <>
                            <ImproveSpinner theme={theme} />
                            Optimizing…
                          </>
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
                    <Textarea theme={theme} rows={3} value={aiQuery}
                      onChange={e => setAiQuery(e.target.value)}
                      placeholder={'e.g. "Find B2B SaaS companies in Berlin with 50-200 employees"'}
                      autoFocus />
                  </FormGroup>

                  <FormGroup style={{ marginTop: '1rem' }}>
                    <Label theme={theme}>Number of companies</Label>
                    <input type="number" min={1} max={1000} value={aiLimitRaw}
                      onChange={e => setAiLimitRaw(e.target.value)}
                      onBlur={() => {
                        const clamped = Math.min(1000, Math.max(1, parseInt(aiLimitRaw, 10) || 1));
                        setAiLimit(clamped);
                        setAiLimitRaw(String(clamped));
                      }}
                      style={{ width: '100%', padding: '0.65rem 0.9rem', border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, background: theme.colors.base[200], color: theme.colors.base.content, fontSize: '0.875rem', boxSizing: 'border-box' as const }}
                    />
                  </FormGroup>

                  <FormGroup style={{ marginTop: '1rem' }}>
                    <Label theme={theme}>Include fields</Label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const, marginTop: '0.35rem' }}>
                      {([
                        { label: 'Phone',    val: aiIncludePhone,   set: setAiIncludePhone },
                        { label: 'Address',  val: aiIncludeAddress, set: setAiIncludeAddress },
                        { label: 'Company Info', val: aiIncludeInfo, set: setAiIncludeInfo },
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
                  </FormGroup>

                  <ResultBanner theme={theme} $type="warning" style={{ marginTop: '1.25rem' }}>
                    ⚠️ Search time varies depending on the number of companies requested. Discovered companies will be added to your pool and enrolled.
                  </ResultBanner>
                </>
              )}
            </div>
          )}

          {/* Result banner */}
          {result && (
            <ResultBanner theme={theme} $type={result.type} style={{ marginTop: '1rem' }}>
              {result.type === 'success' ? '✓ ' : result.type === 'warning' ? '⚠ ' : '✕ '}
              {result.text}
            </ResultBanner>
          )}
        </ModalBody>

        {/* Footer — no cancel button; submit disabled when AI tab & Tavily not ready */}
        <ModalFooter theme={theme}>
          <SaveButton theme={theme} onClick={handleSubmit}
            disabled={loading || (activeTab === 'ai' && tavilyStatus !== 'ok')}>
            {loading ? <Spinner /> : <UploadIcon />}
            {submitLabel}
          </SaveButton>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
};

export default AddCompanyModal;