// ============================================================
// Categories.tsx
// Full CRUD page for categories + company membership management
// Follows Companies.tsx patterns exactly
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../theme/styles';
import styled, { keyframes } from 'styled-components';
import {
  PageContainer, MainContent,
  HeaderCard, HeaderRow, HeaderCenter, HeaderTitle, HeaderSubtitle,
  ListSection, SectionHeader, SectionTitle, CountBadge, AddButton,
  SearchWrapper, SearchIconWrap, SearchClearBtn, SearchInput,
  BulkActionsBar, BulkLeft, BulkRight, Checkbox,
  CategoryCard, CategoryRow, CategoryInfo,
  CategoryName, CategoryDetail, CategoryMeta, CompanyCountBadge,
  CategoryActionButtons, IconButton,
  EmptyState, EmptyIcon, EmptyTitle, EmptySubtitle,
  PaginationContainer, PaginationButton, PaginationInfo, PageSizeSelect,
  ToastContainer, ToastContent, ToastTitle, ToastMsg, ToastCloseButton,
  ConfirmOverlay, ConfirmBox, ConfirmHeader, ConfirmIconWrap,
  ConfirmContent, ConfirmTitle, ConfirmMessage, ConfirmActions,
  CancelButton, DangerButton,
  ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton,
  ModalBody, ModalFooter, FormGrid, FormGroup, Label, Input, Textarea, PrimaryButton,
} from './categories.styles';
import { apiFetch, useAuth } from '../../App';
import AddCompaniesToCategoryModal from './AddCompaniesToCategoryModal';

const BACKEND_URL  = import.meta.env.VITE_BACKEND_URL  || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE     = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

// ── Types ──────────────────────────────────────────────────

interface Category {
  id: number;
  user_id: number;
  name: string;
  detail: string | null;
  company_count: number;
  created_at: string;
  updated_at: string;
}

interface CompanyInCategory {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

interface ToastState   { visible: boolean; type: 'success'|'error'|'warning'|'info'; title: string; message: string; }
interface ConfirmState { open: boolean; title: string; message: string; onConfirm: () => void; variant?: 'danger'|'warning'|'default'; }

// ── Spinner ────────────────────────────────────────────────
const spin = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const Spinner = styled.span<{ theme: any }>`
  width: 18px; height: 18px; display: inline-block; flex-shrink: 0;
  border: 2px solid transparent;
  border-color: ${(p: any) => p.theme.colors.primary.main}40;
  border-top-color: ${(p: any) => p.theme.colors.primary.main};
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;

// ── Back button ────────────────────────────────────────────
const BackBtn = styled.button<{ theme: any }>`
  position: absolute; left: 0;
  width: 36px; height: 36px; padding: 0;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease; flex-shrink: 0;
  &:hover { border-color: ${p => p.theme.colors.primary.main}; color: ${p => p.theme.colors.primary.main}; }
  svg { width: 18px; height: 18px; }
`;

const toolbarLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.3rem',
  fontSize: '0.75rem', fontWeight: 600, opacity: 0.45,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginRight: '0.25rem', flexShrink: 0,
};

// ── Icons ──────────────────────────────────────────────────
const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const TagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const BuildingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/>
    <line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/>
  </svg>
);
const SortIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="14" y2="12"/>
    <line x1="3" y1="18" x2="8" y2="18"/>
  </svg>
);
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

// ════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════

const Categories: React.FC = () => {
  const { theme } = useTheme();
  const navigate  = useNavigate();
  const { authReady } = useAuth();

  // ── List state ─────────────────────────────────────────
  const [categories,     setCategories]     = useState<Category[]>([]);
  const [serverTotal,    setServerTotal]    = useState(0);
  const [loading,        setLoading]        = useState(false);
  const [hasData,        setHasData]        = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ── Pagination ─────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize,    setPageSize]    = useState(() => {
    const s = localStorage.getItem('categories_page_size');
    return s ? Number(s) : 20;
  });

  // ── Selection ──────────────────────────────────────────
  const [selectedIds,    setSelectedIds]    = useState<Set<number>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [deselectedIds,  setDeselectedIds]  = useState<Set<number>>(new Set());

  // ── Search ─────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');

  // ── Sort ───────────────────────────────────────────────
  type SortKey = 'name' | 'companies' | 'created_at';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setCurrentPage(1);
  };

  // ── Modal state ────────────────────────────────────────
  const [createOpen,   setCreateOpen]   = useState(false);
  const [createName,   setCreateName]   = useState('');
  const [createDetail, setCreateDetail] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [editName,     setEditName]     = useState('');
  const [editDetail,   setEditDetail]   = useState('');
  const [editLoading,  setEditLoading]  = useState(false);

  const [companiesModal, setCompaniesModal] = useState<Category | null>(null);
  const [modalCompanies, setModalCompanies] = useState<CompanyInCategory[]>([]); void modalCompanies;
  const [modalTotal,     setModalTotal]     = useState(0); void modalTotal;
  const [modalPage,      setModalPage]      = useState(1);
  const [modalSearch,    setModalSearch]    = useState('');
  const [modalLoading,   setModalLoading]   = useState(false); void modalLoading;

  const [addCompaniesModal,        setAddCompaniesModal]        = useState<Category | null>(null);
  const [addCompaniesExistingIds,  setAddCompaniesExistingIds]  = useState<Set<number>>(new Set());

  // ── Detail modal (eye icon) ────────────────────────────
  const [detailModal,          setDetailModal]          = useState<Category | null>(null);
  const [detailModalCompanies, setDetailModalCompanies] = useState<CompanyInCategory[]>([]);
  const [detailModalTotal,     setDetailModalTotal]     = useState(0);
  const [detailModalLoading,   setDetailModalLoading]   = useState(false);
  const [detailModalSearch,    setDetailModalSearch]    = useState('');

  // ── Toast / confirm ────────────────────────────────────
  const [toast,   setToast]   = useState<ToastState>({ visible: false, type: 'info', title: '', message: '' });
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (type: ToastState['type'], message: string, title?: string) => {
    const defaultTitles = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' };
    setToast({ visible: true, type, title: title ?? defaultTitles[type], message });
    setTimeout(() => setToast(p => ({ ...p, visible: false })), 4500);
  };
  const showConfirm = (title: string, message: string, onConfirm: () => void, variant: ConfirmState['variant'] = 'danger') =>
    setConfirm({ open: true, title, message, onConfirm, variant });

  // ── Reset page on filter change ────────────────────────
  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortKey, sortDir]);
  useEffect(() => { setSelectedIds(new Set()); setSelectAllPages(false); setDeselectedIds(new Set()); }, [currentPage, pageSize, searchTerm, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(serverTotal / pageSize));

  // ── Fetch categories ───────────────────────────────────
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(currentPage), size: String(pageSize) });
      if (searchTerm.trim()) p.set('search', searchTerm.trim());
      if (sortKey) { p.set('sort_by', sortKey); p.set('sort_order', sortDir); }
      const res  = await apiFetch(`${API_BASE}/category/?${p.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCategories(data.categories ?? []);
      setServerTotal(data.total ?? 0);
      setHasData(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [currentPage, pageSize, searchTerm, sortKey, sortDir]);

  useEffect(() => {
    if (!authReady) return;
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(fetchCategories, 300);
    return () => { if (fetchTimer.current) clearTimeout(fetchTimer.current); };
  }, [fetchCategories, authReady, refreshTrigger]);

  // ── Derived ────────────────────────────────────────────
  const allCurrentPageSelected = selectAllPages && deselectedIds.size === 0;
  const showBulkBar            = selectAllPages || selectedIds.size > 0;
  const effectiveCount         = selectAllPages ? serverTotal - deselectedIds.size : selectedIds.size;
  const rangeStart             = (currentPage - 1) * pageSize + 1;
  const rangeEnd               = Math.min(currentPage * pageSize, serverTotal);

  // ── Selection helpers ──────────────────────────────────
  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectAllPages) {
      const next = new Set(deselectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      setDeselectedIds(next);
    } else {
      setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }
  };

  const toggleSelectAll = () => {
    if (selectAllPages) {
      setSelectAllPages(false);
      setSelectedIds(new Set());
      setDeselectedIds(new Set());
    } else {
      setSelectAllPages(true);
      setSelectedIds(new Set());
      setDeselectedIds(new Set());
    }
  };

  // ── CRUD — Create ──────────────────────────────────────
  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreateLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/category/`, {
        method: 'POST',
        body: JSON.stringify([{ name: createName.trim(), detail: createDetail.trim() || null }]),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      showToast('success', `Category "${createName.trim()}" created`);
      setCreateOpen(false); setCreateName(''); setCreateDetail('');
      setRefreshTrigger(p => p + 1);
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed'); }
    finally { setCreateLoading(false); }
  };

  // ── CRUD — Edit ────────────────────────────────────────
  const openEdit = (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCategory(cat);
    setEditName(cat.name);
    setEditDetail(cat.detail ?? '');
  };

  const handleEdit = async () => {
    if (!editCategory || !editName.trim()) return;
    setEditLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/category/`, {
        method: 'PUT',
        body: JSON.stringify([{
          id: editCategory.id,
          name: editName.trim(),
          detail: editDetail.trim() !== '' ? editDetail.trim() : '',  // empty string → NULL via backend
        }]),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      showToast('success', 'Category updated');
      setEditCategory(null);
      setRefreshTrigger(p => p + 1);
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed'); }
    finally { setEditLoading(false); }
  };

  // ── CRUD — Delete ──────────────────────────────────────
  const deleteCategories = async (ids: number[]) => {
    if (!ids.length) { showToast('warning', 'No categories to delete'); return; }
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/category/?ids=${ids.join(',')}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      showToast('success', `${ids.length} categor${ids.length > 1 ? 'ies' : 'y'} deleted`);
      setSelectedIds(new Set());
      setSelectAllPages(false);
      setRefreshTrigger(p => p + 1);
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  // ── Companies modal ────────────────────────────────────
  const _openCompaniesModal = async (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompaniesModal(cat);
    setModalPage(1);
    setModalSearch('');
    fetchModalCompanies(cat.id, 1, '');
  };
  void _openCompaniesModal;

  const fetchModalCompanies = async (catId: number, page: number, search: string) => {
    setModalLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), size: '20' });
      if (search.trim()) p.set('search', search.trim());
      const res  = await apiFetch(`${API_BASE}/category/${catId}/company/?${p.toString()}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setModalCompanies(data.companies ?? []);
      setModalTotal(data.total ?? 0);
    } catch (err) { showToast('error', 'Failed to load companies'); }
    finally { setModalLoading(false); }
  };

  // Reload modal companies when search/page changes
  const modalSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!companiesModal) return;
    if (modalSearchTimer.current) clearTimeout(modalSearchTimer.current);
    modalSearchTimer.current = setTimeout(() => {
      fetchModalCompanies(companiesModal.id, modalPage, modalSearch);
    }, 300);
    return () => { if (modalSearchTimer.current) clearTimeout(modalSearchTimer.current); };
  }, [modalPage, modalSearch, companiesModal]);

  const _removeCompanyFromCategory = async (companyId: number) => {
    if (!companiesModal) return;
    try {
      const res = await apiFetch(
        `${API_BASE}/category/${companiesModal.id}/company/?ids=${companyId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      showToast('success', 'Company removed from category');
      fetchModalCompanies(companiesModal.id, modalPage, modalSearch);
      setRefreshTrigger(p => p + 1); // refresh company_count on card
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed'); }
  };
  void _removeCompanyFromCategory;

  // ── Add companies modal ────────────────────────────────
  const openAddCompaniesModal = async (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let all: any[] = [], page = 1, total = Infinity;
      while (all.length < total) {
        const res = await apiFetch(`${API_BASE}/category/${cat.id}/company/?page=${page}&size=100`);
        if (!res.ok) break;
        const data = await res.json();
        total = data.total ?? 0;
        all = [...all, ...(data.companies ?? [])];
        if (all.length >= total) break;
        page++;
      }
      setAddCompaniesExistingIds(new Set<number>(all.map((c: any) => c.id as number)));
    } catch {
      setAddCompaniesExistingIds(new Set());
    }
    setAddCompaniesModal(cat);
  };

  const handleAddCompaniesSave = (addedIds: number[], removedIds: number[]) => {
    const parts = [];
    if (addedIds.length)   parts.push(`${addedIds.length} added`);
    if (removedIds.length) parts.push(`${removedIds.length} removed`);
    showToast('success', parts.join(', '));
    setAddCompaniesModal(null);
    setRefreshTrigger(p => p + 1);
    if (companiesModal && addCompaniesModal && companiesModal.id === addCompaniesModal.id) {
      fetchModalCompanies(companiesModal.id, modalPage, modalSearch);
    }
  };

  // ── Detail modal ───────────────────────────────────────
  const openDetailModal = async (cat: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailModal(cat);
    setDetailModalCompanies([]);
    setDetailModalTotal(0);
    setDetailModalSearch('');
    setDetailModalLoading(true);
    try {
      let all: CompanyInCategory[] = [], page = 1, total = Infinity;
      while (all.length < total) {
        const res = await apiFetch(`${API_BASE}/category/${cat.id}/company/?page=${page}&size=100`);
        if (!res.ok) break;
        const data = await res.json();
        total = data.total ?? 0;
        all = [...all, ...(data.companies ?? [])];
        if (all.length >= total) break;
        page++;
      }
      setDetailModalCompanies(all);
      setDetailModalTotal(all.length);
    } catch { setDetailModalCompanies([]); setDetailModalTotal(0); }
    finally { setDetailModalLoading(false); }
  };

  // ── Pagination helpers ─────────────────────────────────
  const renderPageNumbers = () => {
    const pages: React.ReactNode[] = [];
    const maxV = 5;
    let start  = Math.max(1, currentPage - Math.floor(maxV / 2));
    let end    = Math.min(totalPages, start + maxV - 1);
    if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);

    if (start > 1) {
      pages.push(<PaginationButton key={1} theme={theme} onClick={() => setCurrentPage(1)}>1</PaginationButton>);
      if (start > 2) pages.push(<PaginationInfo key="e1" theme={theme}>…</PaginationInfo>);
    }
    for (let i = start; i <= end; i++)
      pages.push(
        <PaginationButton key={i} theme={theme} $isActive={currentPage === i}
          onClick={() => setCurrentPage(i)}>{i}</PaginationButton>
      );
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push(<PaginationInfo key="e2" theme={theme}>…</PaginationInfo>);
      pages.push(<PaginationButton key={totalPages} theme={theme} onClick={() => setCurrentPage(totalPages)}>{totalPages}</PaginationButton>);
    }
    return pages;
  };

  // ── Render ─────────────────────────────────────────────
  return (
    <PageContainer theme={theme}>

      {/* Toast */}
      {toast.visible && (
        <ToastContainer theme={theme} $type={toast.type}>
          <ToastContent>
            <ToastTitle>{toast.title}</ToastTitle>
            <ToastMsg>{toast.message}</ToastMsg>
          </ToastContent>
          <ToastCloseButton onClick={() => setToast(p => ({ ...p, visible: false }))}>
            <CloseIcon />
          </ToastCloseButton>
        </ToastContainer>
      )}

      {/* Confirm */}
      <ConfirmOverlay $isOpen={confirm.open} onClick={() => setConfirm(p => ({ ...p, open: false }))}>
        <ConfirmBox theme={theme} onClick={e => e.stopPropagation()}>
          <ConfirmHeader>
            <ConfirmIconWrap theme={theme} $variant={confirm.variant}><AlertIcon /></ConfirmIconWrap>
            <ConfirmContent>
              <ConfirmTitle theme={theme}>{confirm.title}</ConfirmTitle>
              <ConfirmMessage theme={theme}>{confirm.message}</ConfirmMessage>
            </ConfirmContent>
          </ConfirmHeader>
          <ConfirmActions>
            <CancelButton theme={theme} onClick={() => setConfirm(p => ({ ...p, open: false }))}>Cancel</CancelButton>
            <DangerButton theme={theme} onClick={() => { confirm.onConfirm(); setConfirm(p => ({ ...p, open: false })); }}>
              <TrashIcon /> Delete
            </DangerButton>
          </ConfirmActions>
        </ConfirmBox>
      </ConfirmOverlay>

      <MainContent>

        {/* Header */}
        <HeaderCard theme={theme}>
          <HeaderRow>
            <BackBtn theme={theme} onClick={() => navigate('/campaigns')} title="Go back">
              <ArrowLeftIcon />
            </BackBtn>
            <HeaderCenter>
              <HeaderTitle>Categories</HeaderTitle>
              <HeaderSubtitle>Organize companies into groups for quick campaign assignment</HeaderSubtitle>
            </HeaderCenter>
          </HeaderRow>
        </HeaderCard>

        {/* List section */}
        <ListSection theme={theme}>

          {/* Section header */}
          <SectionHeader theme={theme}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {categories.length > 0 && (
                <Checkbox theme={theme} $checked={allCurrentPageSelected} onClick={toggleSelectAll} />
              )}
              <SectionTitle>
                <TagIcon />
                Categories
                <CountBadge theme={theme}>{serverTotal}</CountBadge>
                {showBulkBar && (
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 500,
                    color: theme.colors.primary.main,
                    background: `${theme.colors.primary.main}18`,
                    border: `1px solid ${theme.colors.primary.main}40`,
                    borderRadius: '999px', padding: '1px 8px', marginLeft: '2px',
                  }}>
                    {effectiveCount} selected
                  </span>
                )}
              </SectionTitle>
            </div>
            <AddButton theme={theme} onClick={() => { setCreateOpen(true); setCreateName(''); setCreateDetail(''); }} title="Create category">
              <PlusIcon />
            </AddButton>
          </SectionHeader>

          {/* Search */}
          <SearchWrapper>
            <SearchIconWrap theme={theme}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </SearchIconWrap>
            <SearchInput
              theme={theme}
              type="text"
              placeholder="Search categories…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <SearchClearBtn theme={theme} onClick={() => setSearchTerm('')} title="Clear">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </SearchClearBtn>
            )}
          </SearchWrapper>

          {/* Sort bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <span style={toolbarLabelStyle} title="Sort"><SortIcon /></span>
            {([
              { key: 'name',       label: 'Alphabetical' },
              { key: 'companies',  label: 'Companies'    },
              { key: 'created_at', label: 'Created'      },
            ] as { key: SortKey; label: string }[]).map(({ key, label }) => {
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
              }}>✕ Clear</button>
            )}
          </div>

          {/* Bulk actions */}
          {showBulkBar && (
            <BulkActionsBar theme={theme}>
              <BulkLeft>
                <CountBadge theme={theme}>{effectiveCount}</CountBadge>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {selectAllPages ? `all ${serverTotal} selected` : `of ${categories.length} selected`}
                </span>
              </BulkLeft>
              <BulkRight>
                <IconButton theme={theme} $variant="danger" $size="md" title="Delete selected"
                  onClick={() => showConfirm(
                    'Delete Categories',
                    `Delete ${effectiveCount} categor${effectiveCount > 1 ? 'ies' : 'y'}? This cannot be undone.`,
                    async () => {
                      if (selectAllPages) {
                        setLoading(true);
                        try {
                          const p = new URLSearchParams({ page: '1', size: String(serverTotal) });
                          if (searchTerm.trim()) p.set('search', searchTerm.trim());
                          const res  = await apiFetch(`${API_BASE}/category/?${p.toString()}`);
                          if (!res.ok) throw new Error('Failed to fetch categories');
                          const data = await res.json();
                          const ids: number[] = (data.categories ?? [])
                            .map((c: any) => c.id as number)
                            .filter((id: number) => !deselectedIds.has(id));
                          if (!ids.length) { showToast('warning', 'No categories found to delete'); setSelectAllPages(false); return; }
                          await deleteCategories(ids);
                        } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed to delete'); }
                        finally { setLoading(false); }
                      } else {
                        deleteCategories(Array.from(selectedIds));
                      }
                    }
                  )}>
                  <TrashIcon />
                </IconButton>
              </BulkRight>
            </BulkActionsBar>
          )}

          {/* List */}
          {loading && !hasData ? (
            <EmptyState>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', justifyContent: 'center' }}>
                <Spinner theme={theme} />
                <EmptyTitle style={{ margin: 0 }}>Loading categories…</EmptyTitle>
              </div>
            </EmptyState>
          ) : categories.length === 0 ? (
            <EmptyState>
              <EmptyIcon><TagIcon /></EmptyIcon>
              <EmptyTitle>{serverTotal === 0 ? 'No categories yet' : 'No results'}</EmptyTitle>
              <EmptySubtitle>
                {serverTotal === 0
                  ? 'Use the + button to create your first category'
                  : `No categories match "${searchTerm}"`}
              </EmptySubtitle>
            </EmptyState>
          ) : categories.map(cat => {
            const isSelected = selectAllPages ? !deselectedIds.has(cat.id) : selectedIds.has(cat.id);
            return (
              <CategoryCard key={cat.id} theme={theme} $selected={isSelected}
                onClick={e => toggleSelect(cat.id, e)}>
                <CategoryRow>
                  <div onClick={e => toggleSelect(cat.id, e)}>
                    <Checkbox theme={theme} $checked={isSelected} />
                  </div>
                  <CategoryInfo>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', minWidth: 0 }}>
                      <CategoryName>{cat.name}</CategoryName>
                      {cat.detail && (
                        <CategoryDetail style={{ flexShrink: 1 }}>
                          {cat.detail.length > 60 ? cat.detail.slice(0, 60) + '…' : cat.detail}
                        </CategoryDetail>
                      )}
                    </div>
                  </CategoryInfo>
                  <CategoryMeta>
                    <CompanyCountBadge theme={theme}>
                      <BuildingIcon />
                      {cat.company_count} {cat.company_count === 1 ? 'company' : 'companies'}
                    </CompanyCountBadge>
                  </CategoryMeta>
                  <CategoryActionButtons onClick={e => e.stopPropagation()}>
                    <IconButton theme={theme} $size="md" title="Add companies" disabled={isSelected}
                      onClick={e => openAddCompaniesModal(cat, e)}>
                      <PlusIcon />
                    </IconButton>
                    <IconButton theme={theme} $size="md" title="View details" disabled={isSelected}
                      onClick={e => openDetailModal(cat, e)}>
                      <EyeIcon />
                    </IconButton>
                    <IconButton theme={theme} $size="md" title="Edit" disabled={isSelected}
                      onClick={e => openEdit(cat, e)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton theme={theme} $variant="danger" $size="md" title="Delete" disabled={isSelected}
                      onClick={e => { e.stopPropagation(); showConfirm('Delete Category', `Delete "${cat.name}"? This cannot be undone.`, () => deleteCategories([cat.id])); }}>
                      <TrashIcon />
                    </IconButton>
                  </CategoryActionButtons>
                </CategoryRow>
              </CategoryCard>
            );
          })}

          {/* Pagination */}
          {serverTotal > 0 && (
            <PaginationContainer theme={theme}>
              <PaginationButton theme={theme} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>«</PaginationButton>
              {renderPageNumbers()}
              <PaginationButton theme={theme} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>»</PaginationButton>
              <PaginationInfo theme={theme}>{rangeStart}–{rangeEnd} of {serverTotal}</PaginationInfo>
              <PageSizeSelect theme={theme} value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); localStorage.setItem('categories_page_size', e.target.value); setCurrentPage(1); }}>
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

      {/* ── Create modal ─────────────────────────────────── */}
      <ModalOverlay $isOpen={createOpen} onClick={() => setCreateOpen(false)}>
        <ModalContent theme={theme} onClick={e => e.stopPropagation()}>
          <ModalHeader theme={theme}>
            <ModalTitle><TagIcon /> New Category</ModalTitle>
            <CloseButton theme={theme} onClick={() => setCreateOpen(false)}><CloseIcon /></CloseButton>
          </ModalHeader>
          <ModalBody>
            <FormGrid>
              <FormGroup $span>
                <Label theme={theme}>Name *</Label>
                <Input
                  theme={theme}
                  placeholder="e.g. SaaS Companies"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
              </FormGroup>
              <FormGroup $span>
                <Label theme={theme}>Description</Label>
                <Textarea
                  theme={theme}
                  placeholder="Optional description…"
                  value={createDetail}
                  onChange={e => setCreateDetail(e.target.value)}
                  rows={3}
                />
              </FormGroup>
            </FormGrid>
          </ModalBody>
          <ModalFooter theme={theme}>
            <CancelButton theme={theme} onClick={() => setCreateOpen(false)}>Cancel</CancelButton>
            <PrimaryButton theme={theme} onClick={handleCreate}
              disabled={createLoading || !createName.trim()}>
              <SaveIcon />
              {createLoading ? 'Creating…' : 'Create Category'}
            </PrimaryButton>
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>

      {/* ── Edit modal ────────────────────────────────────── */}
      {editCategory && (
        <ModalOverlay $isOpen={true} onClick={() => setEditCategory(null)}>
          <ModalContent theme={theme} onClick={e => e.stopPropagation()}>
            <ModalHeader theme={theme}>
              <ModalTitle><EditIcon /> Edit Category</ModalTitle>
              <CloseButton theme={theme} onClick={() => setEditCategory(null)}><CloseIcon /></CloseButton>
            </ModalHeader>
            <ModalBody>
              <FormGrid>
                <FormGroup $span>
                  <Label theme={theme}>Name *</Label>
                  <Input
                    theme={theme}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEdit()}
                    autoFocus
                  />
                </FormGroup>
                <FormGroup $span>
                  <Label theme={theme}>Description</Label>
                  <Textarea
                    theme={theme}
                    value={editDetail}
                    onChange={e => setEditDetail(e.target.value)}
                    rows={3}
                    placeholder="Leave blank to clear"
                  />
                </FormGroup>
              </FormGrid>
            </ModalBody>
            <ModalFooter theme={theme}>
              <CancelButton theme={theme} onClick={() => setEditCategory(null)}>Cancel</CancelButton>
              <PrimaryButton theme={theme} onClick={handleEdit}
                disabled={editLoading || !editName.trim()}>
                <SaveIcon />
                {editLoading ? 'Saving…' : 'Save Changes'}
              </PrimaryButton>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* ── Detail modal (Eye icon) ───────────────────────── */}
      {detailModal && (
        <ModalOverlay $isOpen={true} onClick={() => setDetailModal(null)}>
          <ModalContent theme={theme} $wide onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <ModalHeader theme={theme}>
              <ModalTitle><EyeIcon /> {detailModal.name}</ModalTitle>
              <CloseButton theme={theme} onClick={() => setDetailModal(null)}><CloseIcon /></CloseButton>
            </ModalHeader>
            <ModalBody>

              {/* Description + meta row */}
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Description</div>
                  {detailModal.detail
                    ? <div style={{ fontSize: '0.875rem', lineHeight: 1.6, opacity: 0.85, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{detailModal.detail}</div>
                    : <div style={{ fontSize: '0.875rem', opacity: 0.35, fontStyle: 'italic' }}>No description</div>
                  }
                </div>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Created</div>
                  <div style={{ fontSize: '0.8125rem', opacity: 0.7, marginBottom: '0.75rem' }}>{new Date(detailModal.created_at).toLocaleDateString()}</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Updated</div>
                  <div style={{ fontSize: '0.8125rem', opacity: 0.7 }}>{new Date(detailModal.updated_at).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: theme.colors.base[300], margin: '0 0 1.25rem' }} />

              {/* Companies — scrollable list */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Companies
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: theme.colors.primary.main, border: `1px solid ${theme.colors.primary.main}`, color: theme.colors.primary.content, textTransform: 'none', letterSpacing: 0 }}>
                      {detailModalTotal}
                    </span>
                  </div>
                  {/* Inline search */}
                  {detailModalCompanies.length > 0 && (
                    <div style={{ position: 'relative' }}>
                      <svg style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none', width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input
                        type="text"
                        placeholder="Search…"
                        value={detailModalSearch ?? ''}
                        onChange={e => setDetailModalSearch(e.target.value)}
                        style={{
                          paddingLeft: '1.75rem', paddingRight: '0.625rem',
                          paddingTop: '0.3rem', paddingBottom: '0.3rem',
                          fontSize: '0.8rem', width: '140px',
                          border: `1px solid ${theme.colors.base[300]}`,
                          borderRadius: theme.radius.field,
                          background: theme.colors.base[400],
                          color: theme.colors.base.content,
                          outline: 'none',
                        }}
                      />
                    </div>
                  )}
                </div>

                {detailModalLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem', opacity: 0.6 }}>
                    <Spinner theme={theme} /><span style={{ fontSize: '0.875rem' }}>Loading…</span>
                  </div>
                ) : detailModalCompanies.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.875rem', opacity: 0.4, fontStyle: 'italic', border: `1px dashed ${theme.colors.base[300]}`, borderRadius: theme.radius.field }}>
                    No companies in this category
                  </div>
                ) : (() => {
                  const q = (detailModalSearch ?? '').trim().toLowerCase();
                  const filtered = q
                    ? detailModalCompanies.filter(co => co.name.toLowerCase().includes(q) || co.email.toLowerCase().includes(q))
                    : detailModalCompanies;
                  return (
                    <div style={{
                      maxHeight: '320px', overflowY: 'auto',
                      border: `1px solid ${theme.colors.base[300]}`,
                      borderRadius: theme.radius.field,
                      background: theme.colors.base[200],
                      scrollbarWidth: 'thin',
                    }}>
                      {filtered.length === 0 ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.8125rem', opacity: 0.45 }}>
                          No companies match "{detailModalSearch}"
                        </div>
                      ) : filtered.map((co, i) => (
                        <div key={co.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.625rem 0.875rem',
                          borderBottom: i < filtered.length - 1 ? `1px solid ${theme.colors.base[300]}` : 'none',
                        }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: `${theme.colors.primary.main}18`,
                            border: `1px solid ${theme.colors.primary.main}30`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', fontWeight: 700, color: theme.colors.primary.main,
                          }}>
                            {co.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.8375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.name}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.email}</div>
                          </div>
                          <span style={{ fontSize: '0.7rem', opacity: 0.35, flexShrink: 0 }}>
                            {new Date(co.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

            </ModalBody>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* ── Add Companies modal ──────────────────────── */}
      <AddCompaniesToCategoryModal
        isOpen={addCompaniesModal !== null}
        category={addCompaniesModal}
        existingCompanyIds={addCompaniesExistingIds}
        theme={theme}
        onSave={handleAddCompaniesSave}
        onClose={() => setAddCompaniesModal(null)}
      />

    </PageContainer>
  );
};

export default Categories;