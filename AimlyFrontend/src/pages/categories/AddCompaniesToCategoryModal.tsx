// ============================================================
// AddCompaniesToCategoryModal.tsx
// Uses the exact same "Enroll Existing" UI as Campaign.tsx
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton,
  ModalBody, ModalFooter, CancelButton, PrimaryButton,
} from './categories.styles';
import { apiFetch } from '../../App';

const BACKEND_URL  = import.meta.env.VITE_BACKEND_URL  || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE     = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

// ── Animations ─────────────────────────────────────────────
const spin      = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const fadeSlide = keyframes`from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}`;
const pulse     = keyframes`0%,100%{opacity:1}50%{opacity:0.5}`;

// ── Styled components (mirrors Campaign.tsx exactly) ────────
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
    strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
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
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const MinusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

// ── Types ───────────────────────────────────────────────────
interface Company { id: number; name: string; email: string; }

interface Props {
  isOpen: boolean;
  category: { id: number; name: string } | null;
  existingCompanyIds: Set<number>;
  theme: any;
  onSave: (addedIds: number[], removedIds: number[]) => void;
  onClose: () => void;
}

// ════════════════════════════════════════════════════════════
const AddCompaniesToCategoryModal: React.FC<Props> = ({
  isOpen, category, theme, onSave, onClose,
}) => {
  const [enrollSearch,  setEnrollSearch]  = useState('');
  const [enrollList,    setEnrollList]    = useState<Company[]>([]);
  const [enrollTotal,   setEnrollTotal]   = useState(0);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrolledIds,   setEnrolledIds]   = useState<Set<number>>(new Set());
  const [selectedIds,   setSelectedIds]   = useState<Set<number>>(new Set());
  const [saving,        setSaving]        = useState(false);
  const [toRemoveIds,   setToRemoveIds]   = useState<Set<number>>(new Set());
  const [result,        setResult]        = useState<{ type: 'success'|'warning'|'error'|'info'; text: string } | null>(null);

  const enrollDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAll = () => {
    setEnrollSearch(''); setEnrollList([]); setEnrolledIds(new Set());
    setSelectedIds(new Set()); setToRemoveIds(new Set()); setResult(null);
  };

  useEffect(() => { if (isOpen) resetAll(); }, [isOpen]);

  // ── Load all companies, mark already-in-category ones ─────
  const loadEnrollList = async (search: string) => {
    if (!category) return;
    setEnrollLoading(true);
    try {
      const PAGE_SIZE = 100;
      const s = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';

      // All user companies (paginated)
      let allCos: Company[] = [], page = 1, total = Infinity;
      while (allCos.length < total) {
        const r = await apiFetch(`${API_BASE}/company/?page=${page}&size=${PAGE_SIZE}${s}`);
        if (!r.ok) break;
        const d = await r.json();
        total = d.total || 0;
        allCos = [...allCos, ...(d.companies || [])];
        if (allCos.length >= total) break;
        page++;
      }

      // Companies already in this category (paginated)
      let enrolled: Company[] = []; page = 1; total = Infinity;
      while (enrolled.length < total) {
        const r = await apiFetch(`${API_BASE}/category/${category.id}/company/?page=${page}&size=${PAGE_SIZE}`);
        if (!r.ok) break;
        const d = await r.json();
        total = d.total || 0;
        enrolled = [...enrolled, ...(d.companies || [])];
        if (enrolled.length >= total) break;
        page++;
      }

      const eIds = new Set<number>(enrolled.map(c => c.id));
      setEnrolledIds(eIds);
      setEnrollTotal(allCos.length);
      // Already-in first, then rest — both alphabetically
      setEnrollList([
        ...allCos.filter(c =>  eIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)),
        ...allCos.filter(c => !eIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name)),
      ]);
    } catch { /* silent */ }
    finally { setEnrollLoading(false); }
  };

  useEffect(() => {
    if (isOpen && category) loadEnrollList('');
  }, [isOpen, category]);

  useEffect(() => {
    if (!isOpen) return;
    if (enrollDebounce.current) clearTimeout(enrollDebounce.current);
    enrollDebounce.current = setTimeout(() => loadEnrollList(enrollSearch), 350);
    return () => { if (enrollDebounce.current) clearTimeout(enrollDebounce.current); };
  }, [enrollSearch]);

  const toggleSelect = (id: number) => {
    if (enrolledIds.has(id)) return;
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setResult(null);
  };

  const toggleRemove = (id: number) => {
    setToRemoveIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setResult(null);
  };

  const handleSave = async () => {
    const toAdd    = Array.from(selectedIds).filter(id => !enrolledIds.has(id));
    const toRemove = Array.from(toRemoveIds);
    if (toAdd.length === 0 && toRemove.length === 0) {
      setResult({ type: 'error', text: 'No changes to save' });
      return;
    }
    setSaving(true); setResult(null);
    try {
      if (toAdd.length > 0) {
        const res = await apiFetch(`${API_BASE}/category/${category!.id}/company/`, {
          method: 'POST',
          body: JSON.stringify(toAdd),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.detail || 'Failed to add');
      }
      if (toRemove.length > 0) {
        const res = await apiFetch(
          `${API_BASE}/category/${category!.id}/company/?ids=${toRemove.join(',')}`,
          { method: 'DELETE' }
        );
        const d = await res.json();
        if (!res.ok) throw new Error(d.detail || 'Failed to remove');
      }
      onSave(toAdd, toRemove);
    } catch (err) {
      setResult({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save changes' });
    } finally { setSaving(false); }
  };

  const newCount    = Array.from(selectedIds).filter(id => !enrolledIds.has(id)).length;
  const removeCount = toRemoveIds.size;
  const hasChanges  = newCount > 0 || removeCount > 0;
  const submitLabel = saving
    ? 'Saving…'
    : newCount > 0 && removeCount > 0 ? `Save (+${newCount} / -${removeCount})`
    : newCount > 0   ? `Add (${newCount})`
    : removeCount > 0 ? `Remove (${removeCount})`
    : 'Save';

  const eOnes = enrollList.filter(c =>  enrolledIds.has(c.id));
  const uOnes = enrollList.filter(c => !enrolledIds.has(c.id));

  const allUnenrolledSelected = uOnes.length > 0 && uOnes.every(c => selectedIds.has(c.id));
  const someUnenrolledSelected = uOnes.some(c => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (allUnenrolledSelected) {
        uOnes.forEach(c => n.delete(c.id));
      } else {
        uOnes.forEach(c => { if (!enrolledIds.has(c.id)) n.add(c.id); });
      }
      return n;
    });
    setResult(null);
  };

  return (
    <ModalOverlay $isOpen={isOpen} onClick={() => { resetAll(); onClose(); }}>
      <ModalContent theme={theme} $wide onClick={(e: React.MouseEvent) => e.stopPropagation()}>

        <ModalHeader theme={theme}>
          <ModalTitle>
            <PlusIcon />
            {category ? `Add Companies to "${category.name}"` : 'Add Companies'}
          </ModalTitle>
          <CloseButton theme={theme} onClick={() => { resetAll(); onClose(); }}>
            <CloseIcon />
          </CloseButton>
        </ModalHeader>

        <ModalBody>

          {/* Header: label + total count */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <FL theme={theme} style={{ marginBottom: 0 }}>
              Your Companies
              {selectedIds.size > 0 && <SelectBadge theme={theme}>{selectedIds.size} selected</SelectBadge>}
            </FL>
            <span style={{ fontSize: '0.75rem', opacity: 0.45 }}>{enrollTotal} total</span>
          </div>

          {/* Search */}
          <SearchWrap>
            <SIconWrap><MagnifyIcon /></SIconWrap>
            <EnrollSearch
              theme={theme}
              placeholder="Search by name or email…"
              value={enrollSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnrollSearch(e.target.value)}
            />
          </SearchWrap>

          {/* List */}
          <EnrollList theme={theme}>
            {enrollLoading ? (
              <PulseRow>Loading companies…</PulseRow>
            ) : enrollList.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.45, fontSize: '0.8125rem' }}>
                {enrollSearch ? `No companies match "${enrollSearch}"` : 'No companies found. Add some first.'}
              </div>
            ) : (
              <>
                {/* Select all row — shown at top whenever there are unenrolled companies */}
                {uOnes.length > 0 && (
                  <div
                    onClick={toggleSelectAll}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.5rem 0.875rem', cursor: 'pointer',
                      borderBottom: `1px solid ${theme.colors.primary.main}30`,
                      background: allUnenrolledSelected || someUnenrolledSelected
                        ? theme.colors.primary.main + '14'
                        : theme.colors.primary.main + '08',
                      fontSize: '0.8rem', fontWeight: 600,
                      color: theme.colors.primary.main,
                    }}>
                    <div style={{
                      width: 16, height: 16, minWidth: 16, borderRadius: 4, flexShrink: 0,
                      border: `1.5px solid ${allUnenrolledSelected || someUnenrolledSelected ? theme.colors.primary.main : theme.colors.base[300]}`,
                      background: allUnenrolledSelected ? theme.colors.primary.main : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                      boxSizing: 'border-box' as const,
                    }}>
                      {allUnenrolledSelected && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" width="9" height="9"><polyline points="20 6 9 17 4 12"/></svg>}
                      {!allUnenrolledSelected && someUnenrolledSelected && <div style={{ width: 8, height: 2, background: theme.colors.primary.main, borderRadius: 1 }} />}
                    </div>
                    Select all ({uOnes.length})
                  </div>
                )}

                {/* Already in category section */}
                {eOnes.length > 0 && (
                  <>
                    <div style={{
                      padding: '0.35rem 0.875rem', fontSize: '0.7rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45,
                      borderBottom: `1px solid ${theme.colors.base[300]}`,
                      background: (theme.colors.success?.main || '#22c55e') + '08',
                    }}>
                      ✓ Already in category ({eOnes.length})
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
                            <div style={{ fontSize: '0.75rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                          </div>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 600, flexShrink: 0,
                            color: markedForRemoval ? (theme.colors.error?.main || '#ef4444') : (theme.colors.success?.main || '#22c55e'),
                            background: markedForRemoval ? (theme.colors.error?.main || '#ef4444') + '18' : (theme.colors.success?.main || '#22c55e') + '18',
                            border: `1px solid ${markedForRemoval ? (theme.colors.error?.main || '#ef4444') : (theme.colors.success?.main || '#22c55e')}40`,
                            borderRadius: '999px', padding: '1px 7px',
                          }}>{markedForRemoval ? 'remove' : 'added'}</span>
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
                    Not added ({uOnes.length})
                  </div>
                )}

                {/* Not yet added */}
                {uOnes.map(c => (
                  <EnrollRow key={c.id} theme={theme} $sel={selectedIds.has(c.id)} onClick={() => toggleSelect(c.id)}>
                    <RowCheck theme={theme} $on={selectedIds.has(c.id)}>
                      {selectedIds.has(c.id) && <CheckIcon />}
                    </RowCheck>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.8375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                    </div>
                  </EnrollRow>
                ))}

                {uOnes.length === 0 && eOnes.length > 0 && !enrollSearch && (
                  <div style={{ padding: '1rem 0.875rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
                    All companies are already in this category
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
          <PrimaryButton theme={theme} onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <BtnSpinner /> : <PlusIcon />}
            {submitLabel}
          </PrimaryButton>
        </ModalFooter>

      </ModalContent>
    </ModalOverlay>
  );
};

export default AddCompaniesToCategoryModal;