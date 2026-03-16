// ============================================================
// CampaignAssignModal.tsx
// Exact same UI as AddCompaniesToCategoryModal:
// EnrollRow list, section headers, remove toggle, save diff
// ============================================================

import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton,
  ModalBody, ModalFooter, CancelButton, PrimaryButton,
} from './companies.styles';
import type { CampaignOption, Company } from './companies.types';

// ── Animations ─────────────────────────────────────────────
const spin      = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const fadeSlide = keyframes`from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}`;
const pulse     = keyframes`0%,100%{opacity:1}50%{opacity:0.5}`;

// ── Styled components (mirrors AddCompaniesToCategoryModal) ─
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
const BtnSpinner = styled.div`
  width: 15px; height: 15px;
  border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
  border-radius: 50%; animation: ${spin} 0.65s linear infinite; flex-shrink: 0;
`;
const EnrollList = styled.div<{ theme: any }>`
  max-height: 300px; overflow-y: auto;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  scrollbar-width: thin;
`;
const EnrollRow = styled.div<{ theme: any; $sel: boolean; $enrolled?: boolean }>`
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  cursor: pointer;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.$enrolled ? `${p.theme.colors.success?.main || '#22c55e'}0a` : p.$sel ? `${p.theme.colors.primary.main}10` : 'transparent'};
  transition: background 0.1s;
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

// ── Icons ───────────────────────────────────────────────────
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const MagnifyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const MinusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

// ── Types ───────────────────────────────────────────────────
interface Props {
  company: Company | null;
  isOpen: boolean;
  campaigns: CampaignOption[];
  enrolledCampaignIds: Set<number>;
  loading: boolean;
  theme: any;
  selectedCount?: number;
  onSave: (toEnroll: number[], toUnenroll: number[]) => void;
  onClose: () => void;
}

// ════════════════════════════════════════════════════════════
const CampaignAssignModal: React.FC<Props> = ({
  company, isOpen, campaigns, enrolledCampaignIds, loading, theme, selectedCount, onSave, onClose,
}) => {
  const [enrollSearch,  setEnrollSearch]  = useState('');
  const [selectedIds,   setSelectedIds]   = useState<Set<number>>(new Set());
  const [toRemoveIds,   setToRemoveIds]   = useState<Set<number>>(new Set());
  const [result,        setResult]        = useState<{ type: 'success'|'warning'|'error'|'info'; text: string } | null>(null);

  const resetAll = () => {
    setEnrollSearch('');
    setSelectedIds(new Set());
    setToRemoveIds(new Set());
    setResult(null);
  };

  useEffect(() => { if (isOpen) resetAll(); }, [isOpen]);

  const toggleSelect = (id: number) => {
    if (enrolledCampaignIds.has(id)) return;
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setResult(null);
  };

  const toggleRemove = (id: number) => {
    setToRemoveIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setResult(null);
  };

  const handleSave = () => {
    const toEnroll   = Array.from(selectedIds).filter(id => !enrolledCampaignIds.has(id));
    const toUnenroll = Array.from(toRemoveIds);
    if (toEnroll.length === 0 && toUnenroll.length === 0) {
      setResult({ type: 'error', text: 'No changes to save' });
      return;
    }
    onSave(toEnroll, toUnenroll);
  };

  const newCount    = Array.from(selectedIds).filter(id => !enrolledCampaignIds.has(id)).length;
  const removeCount = toRemoveIds.size;
  const hasChanges  = newCount > 0 || removeCount > 0;
  const submitLabel = loading
    ? 'Saving…'
    : newCount > 0 && removeCount > 0 ? `Save (+${newCount} / -${removeCount})`
    : newCount > 0    ? `Enroll (${newCount})`
    : removeCount > 0 ? `Remove (${removeCount})`
    : 'Save';

  const q      = enrollSearch.trim().toLowerCase();
  const eOnes  = campaigns.filter(c =>  enrolledCampaignIds.has(c.id) && (!q || c.name.toLowerCase().includes(q)));
  const uOnes  = campaigns.filter(c => !enrolledCampaignIds.has(c.id) && (!q || c.name.toLowerCase().includes(q)));

  const title = company
    ? `Add "${company.name}" to Campaigns`
    : selectedCount
      ? `Enroll ${selectedCount} Companies`
      : 'Manage Campaigns';

  return (
    <ModalOverlay $isOpen={isOpen} onClick={() => { resetAll(); onClose(); }}>
      <ModalContent theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()}>

        <ModalHeader theme={theme}>
          <ModalTitle>
            <LinkIcon />
            {title}
          </ModalTitle>
          <CloseButton theme={theme} onClick={() => { resetAll(); onClose(); }}>
            <CloseIcon />
          </CloseButton>
        </ModalHeader>

        <ModalBody>

          {/* Header: label + selected badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <FL theme={theme} style={{ marginBottom: 0 }}>
              Campaigns
              {selectedIds.size > 0 && <SelectBadge theme={theme}>{selectedIds.size} selected</SelectBadge>}
            </FL>
            <span style={{ fontSize: '0.75rem', opacity: 0.45 }}>{campaigns.length} total</span>
          </div>

          {/* Search */}
          <SearchWrap>
            <SIconWrap><MagnifyIcon /></SIconWrap>
            <EnrollSearch
              theme={theme}
              placeholder="Search by name…"
              value={enrollSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnrollSearch(e.target.value)}
            />
          </SearchWrap>

          {/* List */}
          <EnrollList theme={theme}>
            {campaigns.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.45, fontSize: '0.8125rem' }}>
                No campaigns available. Create one first.
              </div>
            ) : eOnes.length === 0 && uOnes.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.45, fontSize: '0.8125rem' }}>
                {`No campaigns match "${enrollSearch}"`}
              </div>
            ) : (
              <>
                {/* Already enrolled section */}
                {eOnes.length > 0 && (
                  <>
                    <div style={{
                      padding: '0.35rem 0.875rem', fontSize: '0.7rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45,
                      borderBottom: `1px solid ${theme.colors.base[300]}`,
                      background: (theme.colors.success?.main || '#22c55e') + '08',
                    }}>
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
                            {markedForRemoval ? <MinusIcon /> : <CheckIcon />}
                          </RowCheck>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.8375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: markedForRemoval ? 'line-through' : 'none' }}>{c.name}</div>
                          </div>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 600, flexShrink: 0,
                            color: markedForRemoval ? (theme.colors.error?.main || '#ef4444') : (theme.colors.success?.main || '#22c55e'),
                            background: markedForRemoval ? (theme.colors.error?.main || '#ef4444') + '18' : (theme.colors.success?.main || '#22c55e') + '18',
                            border: `1px solid ${markedForRemoval ? (theme.colors.error?.main || '#ef4444') : (theme.colors.success?.main || '#22c55e')}40`,
                            borderRadius: '999px', padding: '1px 7px',
                          }}>{markedForRemoval ? 'remove' : 'enrolled'}</span>
                        </EnrollRow>
                      );
                    })}
                  </>
                )}

                {/* Section divider */}
                {eOnes.length > 0 && uOnes.length > 0 && (
                  <div style={{
                    padding: '0.35rem 0.875rem', fontSize: '0.7rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45,
                    borderBottom: `1px solid ${theme.colors.base[300]}`,
                  }}>
                    Not enrolled ({uOnes.length})
                  </div>
                )}

                {/* Not yet enrolled */}
                {uOnes.map(c => (
                  <EnrollRow key={c.id} theme={theme} $sel={selectedIds.has(c.id)} onClick={() => toggleSelect(c.id)}>
                    <RowCheck theme={theme} $on={selectedIds.has(c.id)}>
                      {selectedIds.has(c.id) && <CheckIcon />}
                    </RowCheck>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.8375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    </div>
                  </EnrollRow>
                ))}

                {uOnes.length === 0 && eOnes.length > 0 && !enrollSearch && (
                  <div style={{ padding: '1rem 0.875rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
                    Company is enrolled in all campaigns
                  </div>
                )}
              </>
            )}
          </EnrollList>

          {/* Error / result banner */}
          {result && <Banner theme={theme} $t={result.type}>{result.text}</Banner>}

        </ModalBody>

        <ModalFooter theme={theme}>
          <CancelButton theme={theme} onClick={() => { resetAll(); onClose(); }}>Cancel</CancelButton>
          <PrimaryButton theme={theme} onClick={handleSave} disabled={loading || !hasChanges}>
            {loading ? <BtnSpinner /> : <LinkIcon />}
            {submitLabel}
          </PrimaryButton>
        </ModalFooter>

      </ModalContent>
    </ModalOverlay>
  );
};

export default CampaignAssignModal;