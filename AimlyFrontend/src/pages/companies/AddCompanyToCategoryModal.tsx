// ============================================================
// AddCompanyToCategoryModal.tsx
// Assign one or more companies to categories.
// Inverse of AddCompaniesToCategoryModal — you pick categories,
// not companies. Used from the Companies page (individual + bulk).
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton,
  ModalBody, ModalFooter, CancelButton, PrimaryButton,
} from './companies.styles';
import { apiFetch } from '../../App';

const BACKEND_URL  = import.meta.env.VITE_BACKEND_URL  || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE     = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

// ── Animations ──────────────────────────────────────────────
const spin      = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const fadeSlide = keyframes`from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}`;
const pulse     = keyframes`0%,100%{opacity:1}50%{opacity:0.5}`;

// ── Styled components ────────────────────────────────────────
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
const CategoryList = styled.div<{ theme: any }>`
  max-height: 300px; overflow-y: auto;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]};
  scrollbar-width: thin;
`;
const CategoryRow = styled.div<{ theme: any; $sel: boolean; $enrolled?: boolean }>`
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  cursor: ${p => p.$enrolled ? 'default' : 'pointer'};
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p =>
    p.$enrolled
      ? `${p.theme.colors.success?.main || '#22c55e'}0a`
      : p.$sel
        ? `${p.theme.colors.primary.main}10`
        : 'transparent'};
  transition: background 0.1s;
  opacity: ${p => p.$enrolled ? 0.65 : 1};
  &:last-child { border-bottom: none; }
  &:hover {
    background: ${p =>
      p.$enrolled
        ? `${p.theme.colors.success?.main || '#22c55e'}0a`
        : p.$sel
          ? `${p.theme.colors.primary.main}18`
          : p.theme.colors.base[300]};
  }
`;
const RowCheck = styled.div<{ theme: any; $on: boolean; $enrolled?: boolean }>`
  width: 16px; height: 16px; flex-shrink: 0; border-radius: 4px;
  border: 1.5px solid ${p =>
    p.$enrolled
      ? (p.theme.colors.success?.main || '#22c55e')
      : p.$on
        ? p.theme.colors.primary.main
        : p.theme.colors.base[300]};
  background: ${p =>
    p.$enrolled
      ? (p.theme.colors.success?.main || '#22c55e')
      : p.$on
        ? p.theme.colors.primary.main
        : 'transparent'};
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
const SIconWrap  = styled.div`
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

// ── Icons ────────────────────────────────────────────────────
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
const TagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const MinusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

// ── Types ────────────────────────────────────────────────────
interface Category { id: number; name: string; detail: string | null; company_count: number; }

export interface Props {
  isOpen: boolean;
  /** Single company — for individual assignment */
  company?: { id: number; name: string; category_ids?: number[] } | null;
  /** Multiple company IDs — for bulk assignment */
  companyIds?: number[];
  /** Total count label shown when bulk */
  selectedCount?: number;
  theme: any;
  onSave: (addedCategoryIds: number[], removedCategoryIds: number[]) => void;
  onClose: () => void;
}

// ════════════════════════════════════════════════════════════
const AddCompanyToCategoryModal: React.FC<Props> = ({
  isOpen, company, companyIds, selectedCount, theme, onSave, onClose,
}) => {
  const [search,        setSearch]        = useState('');
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [totalCats,     setTotalCats]     = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [enrolledIds,   setEnrolledIds]   = useState<Set<number>>(new Set());
  const [selectedIds,   setSelectedIds]   = useState<Set<number>>(new Set());
  const [toRemoveIds,   setToRemoveIds]   = useState<Set<number>>(new Set());
  const [saving,        setSaving]        = useState(false);
  const [result,        setResult]        = useState<{ type: 'success'|'warning'|'error'|'info'; text: string } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBulk     = !company && !!companyIds?.length;
  const companyId  = company?.id;

  const resetAll = () => {
    setSearch(''); setCategories([]); setEnrolledIds(new Set());
    setSelectedIds(new Set()); setToRemoveIds(new Set()); setResult(null);
  };

  useEffect(() => { if (isOpen) resetAll(); }, [isOpen]);

  // ── Load all categories, and (for single company) mark which ones it's already in ──
  const loadCategories = async (q: string) => {
    setLoading(true);
    try {
      // All categories (paginated)
      const PAGE = 100;
      let all: Category[] = [], page = 1, total = Infinity;
      while (all.length < total) {
        const qs = new URLSearchParams({ page: String(page), size: String(PAGE) });
        if (q.trim()) qs.set('search', q.trim());
        const r = await apiFetch(`${API_BASE}/category/?${qs}`);
        if (!r.ok) break;
        const d = await r.json();
        total = d.total ?? 0;
        all   = [...all, ...(d.categories ?? [])];
        if (all.length >= total) break;
        page++;
      }
      setTotalCats(all.length);

      // For single company: use category_ids already returned by the company endpoint
      if (companyId && !isBulk) {
        const eIds = new Set<number>(company?.category_ids ?? []);
        setEnrolledIds(eIds);
        // Sort: already-enrolled first, then alphabetically
        all.sort((a, b) => {
          const aIn = eIds.has(a.id), bIn = eIds.has(b.id);
          if (aIn && !bIn) return -1;
          if (!aIn && bIn) return 1;
          return a.name.localeCompare(b.name);
        });
      } else {
        all.sort((a, b) => a.name.localeCompare(b.name));
      }
      setCategories(all);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (isOpen) loadCategories('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadCategories(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

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
    if (!toAdd.length && !toRemove.length) {
      setResult({ type: 'error', text: 'No changes to save' });
      return;
    }

    // The company IDs to operate on
    const ids = isBulk ? companyIds! : companyId ? [companyId] : [];
    if (!ids.length) return;

    setSaving(true); setResult(null);
    try {
      if (toAdd.length) {
        const res = await apiFetch(`${API_BASE}/category/bulk-assign/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_ids: ids, category_ids: toAdd }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.detail || 'Failed to add');
      }
      if (toRemove.length) {
        const res = await apiFetch(`${API_BASE}/category/bulk-remove/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_ids: ids, category_ids: toRemove }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.detail || 'Failed to remove');
      }
      onSave(toAdd, toRemove);
    } catch (err) {
      setResult({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally { setSaving(false); }
  };

  const newCount    = Array.from(selectedIds).filter(id => !enrolledIds.has(id)).length;
  const removeCount = toRemoveIds.size;
  const hasChanges  = newCount > 0 || removeCount > 0;

  const submitLabel = saving
    ? 'Saving…'
    : newCount > 0 && removeCount > 0 ? `Save (+${newCount} / -${removeCount})`
    : newCount > 0    ? `Add (${newCount})`
    : removeCount > 0 ? `Remove (${removeCount})`
    : 'Save';

  const eOnes = categories.filter(c =>  enrolledIds.has(c.id));
  const uOnes = categories.filter(c => !enrolledIds.has(c.id));

  const titleLabel = isBulk
    ? `Assign ${selectedCount ?? companyIds!.length} Companies to Category`
    : company
      ? `Assign "${company.name}" to Category`
      : 'Assign to Category';

  return (
    <ModalOverlay $isOpen={isOpen} onClick={() => { resetAll(); onClose(); }}>
      <ModalContent theme={theme} $wide onClick={(e: React.MouseEvent) => e.stopPropagation()}>

        <ModalHeader theme={theme}>
          <ModalTitle>
            <TagIcon />
            {titleLabel}
          </ModalTitle>
          <CloseButton theme={theme} onClick={() => { resetAll(); onClose(); }}>
            <CloseIcon />
          </CloseButton>
        </ModalHeader>

        <ModalBody>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <FL theme={theme} style={{ marginBottom: 0 }}>
              Your Categories
              {selectedIds.size > 0 && <SelectBadge theme={theme}>{selectedIds.size} selected</SelectBadge>}
            </FL>
            <span style={{ fontSize: '0.75rem', opacity: 0.45 }}>{totalCats} total</span>
          </div>

          {/* Search */}
          <SearchWrap>
            <SIconWrap><MagnifyIcon /></SIconWrap>
            <EnrollSearch
              theme={theme}
              placeholder="Search categories…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />
          </SearchWrap>

          {/* List */}
          <CategoryList theme={theme}>
            {loading ? (
              <PulseRow>Loading categories…</PulseRow>
            ) : categories.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.45, fontSize: '0.8125rem' }}>
                {search ? `No categories match "${search}"` : 'No categories found. Create one first.'}
              </div>
            ) : (
              <>
                {/* Already assigned section (single company only) */}
                {eOnes.length > 0 && (
                  <>
                    <div style={{
                      padding: '0.35rem 0.875rem', fontSize: '0.7rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45,
                      borderBottom: `1px solid ${theme.colors.base[300]}`,
                      background: (theme.colors.success?.main || '#22c55e') + '08',
                    }}>
                      ✓ Already assigned ({eOnes.length})
                    </div>
                    {eOnes.map(cat => {
                      const markedForRemoval = toRemoveIds.has(cat.id);
                      return (
                        <CategoryRow
                          key={cat.id} theme={theme}
                          $sel={markedForRemoval}
                          $enrolled={!markedForRemoval}
                          onClick={() => toggleRemove(cat.id)}
                          style={{ cursor: 'pointer', opacity: markedForRemoval ? 0.55 : 0.65 }}
                        >
                          <RowCheck theme={theme} $on={!markedForRemoval} $enrolled={!markedForRemoval}>
                            {markedForRemoval ? <MinusIcon /> : <CheckIcon />}
                          </RowCheck>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.8375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: markedForRemoval ? 'line-through' : 'none' }}>{cat.name}</div>
                            {cat.detail && (
                              <div style={{ fontSize: '0.75rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.detail}</div>
                            )}
                          </div>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 600, flexShrink: 0,
                            color: markedForRemoval ? (theme.colors.error?.main || '#ef4444') : (theme.colors.success?.main || '#22c55e'),
                            background: (markedForRemoval ? (theme.colors.error?.main || '#ef4444') : (theme.colors.success?.main || '#22c55e')) + '18',
                            border: `1px solid ${(markedForRemoval ? (theme.colors.error?.main || '#ef4444') : (theme.colors.success?.main || '#22c55e'))}40`,
                            borderRadius: '999px', padding: '1px 7px',
                          }}>
                            {markedForRemoval ? 'remove' : 'assigned'}
                          </span>
                        </CategoryRow>
                      );
                    })}
                  </>
                )}

                {/* Divider */}
                {eOnes.length > 0 && uOnes.length > 0 && (
                  <div style={{
                    padding: '0.35rem 0.875rem', fontSize: '0.7rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45,
                    borderBottom: `1px solid ${theme.colors.base[300]}`,
                  }}>
                    Not assigned ({uOnes.length})
                  </div>
                )}

                {/* Not yet assigned */}
                {uOnes.map(cat => (
                  <CategoryRow key={cat.id} theme={theme} $sel={selectedIds.has(cat.id)} onClick={() => toggleSelect(cat.id)}>
                    <RowCheck theme={theme} $on={selectedIds.has(cat.id)}>
                      {selectedIds.has(cat.id) && <CheckIcon />}
                    </RowCheck>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.8375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</div>
                      {cat.detail && (
                        <div style={{ fontSize: '0.75rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.detail}</div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.7rem', opacity: 0.4, flexShrink: 0 }}>
                      {cat.company_count} {cat.company_count === 1 ? 'co.' : 'cos.'}
                    </span>
                  </CategoryRow>
                ))}

                {uOnes.length === 0 && eOnes.length > 0 && !search && (
                  <div style={{ padding: '1rem 0.875rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
                    Company is already in all categories
                  </div>
                )}
              </>
            )}
          </CategoryList>

          {/* Result banner */}
          {result && <Banner theme={theme} $t={result.type}>{result.text}</Banner>}

        </ModalBody>

        <ModalFooter theme={theme}>
          <CancelButton theme={theme} onClick={() => { resetAll(); onClose(); }}>Cancel</CancelButton>
          <PrimaryButton theme={theme} onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <BtnSpinner /> : <TagIcon />}
            {submitLabel}
          </PrimaryButton>
        </ModalFooter>

      </ModalContent>
    </ModalOverlay>
  );
};

export default AddCompanyToCategoryModal;