// ============================================================
// Companies.tsx
// UPDATED: Server-side sorting + campaign filtering, sort/filter icons
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
  DropdownWrap, DropdownTrigger, DropdownBadge, DropdownMenu,
  DropdownSearch, DropdownItem,
  BulkActionsBar, BulkLeft, BulkRight,
  Checkbox, CompanyCard, CompanyRow,
  CompanyInfo, CompanyName, CompanyEmail, CompanyMeta, MetaItem,
  CampaignTag, CategoryTag, CompanyActionButtons, IconButton,
  EmptyState, EmptyIcon, EmptyTitle, EmptySubtitle,
  PaginationContainer, PaginationButton, PaginationInfo, PageSizeSelect,
  ToastContainer, ToastItem, ToastMsg,
  ConfirmOverlay, ConfirmBox, ConfirmHeader, ConfirmIconWrap,
  ConfirmContent, ConfirmTitle, ConfirmMessage, ConfirmActions,
  CancelButton, DangerButton,
  ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton,
  ModalBody, ModalFooter, PrimaryButton,
} from './companies.styles';
import CampaignAssignModal        from './CampaignAssignModal';
import AddCompanyModal             from './AddCompanyModal';
import AddCompanyToCategoryModal   from './AddCompanyToCategoryModal';
import type { Company, CompanyWithCampaigns, CampaignOption, CompaniesProps } from './companies.types';
import { apiFetch, useAuth } from '../../App';

const BACKEND_URL  = import.meta.env.VITE_BACKEND_URL  || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE     = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

interface ToastState   { visible: boolean; type: 'success'|'error'|'warning'|'info'; message: string; }
interface ConfirmState { open: boolean; title: string; message: string; onConfirm: () => void; variant?: 'danger'|'warning'|'default'; }

// ── Back button ─────────────────────────────────────────────
const BackBtn = styled.button<{ theme: any }>`
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

const OptedOutBadge = styled.span`
  display: inline-flex; align-items: center; gap: 0.25rem;
  font-size: 0.68rem; font-weight: 600; letter-spacing: 0.03em;
  color: #ef4444; background: #ef444415; border: 1px solid #ef444430;
  border-radius: 999px; padding: 1px 7px 1px 5px; margin-left: 0.5rem;
  vertical-align: middle;
`;
const spin = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;
const AdditionSpinner = styled.span<{ theme: any }>`
  width: 18px; height: 18px; display: inline-block; flex-shrink: 0;
  border: 2px solid transparent;
  border-color: ${(p: any) => p.theme.colors.primary.main}40;
  border-top-color: ${(p: any) => p.theme.colors.primary.main};
  border-radius: 50%;
  animation: ${spin} 0.7s linear infinite;
`;


// ── Icons ────────────────────────────────────────────────────
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
const BuildingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
);
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.08 6.08l1.08-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const MapPinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);
const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);
const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);
const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const TagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const ChevronDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ── Sort icon ────────────────────────────────────────────────
const SortIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <line x1="3"  y1="6"  x2="21" y2="6"/>
    <line x1="3"  y1="12" x2="14" y2="12"/>
    <line x1="3"  y1="18" x2="8"  y2="18"/>
  </svg>
);

// ── Filter icon ──────────────────────────────────────────────
const FilterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

// ── Helpers ──────────────────────────────────────────────────
const downloadCompaniesCSV = (
  companies: CompanyWithCampaigns[],
  _campaignNameMap: Map<number, string>,
  filename: string
) => {
  const headers = ['company_name', 'email', 'company_info', 'phone_number', 'address'];
  const rows = companies.map(c => [
    c.name, c.email, c.company_info ?? '', c.phone_number ?? '', c.address ?? '',
  ]);
  const escape = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

// ── Toolbar label style (shared by sort + filter rows) ───────
const toolbarLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.45,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginRight: '0.25rem',
  flexShrink: 0,
};

// ════════════════════════════════════════════════════════════
const Companies: React.FC<CompaniesProps> = ({ onCompanyClick }) => {
  const { theme } = useTheme();
  const navigate  = useNavigate();
  const { authReady } = useAuth();

  const [allCampaigns,        setAllCampaigns]        = useState<CampaignOption[]>([]);
  const [allCategories,       setAllCategories]       = useState<CampaignOption[]>([]);
  const [pageCompanies,      setPageCompanies]      = useState<CompanyWithCampaigns[]>([]);
  const [serverTotal,        setServerTotal]        = useState(0);
  const [loading,            setLoading]            = useState(false);
  const [hasData,            setHasData]            = useState(false);
  const [refreshTrigger,     setRefreshTrigger]     = useState(0);

  // ── Company addition polling (mirrors Campaign.tsx) ────────
  const [companyAdditionActive, setCompanyAdditionActive] = useState<number | null>(null);
  const [cancellingSearch, setCancellingSearch] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Pagination ─────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize,    setPageSize]    = useState(() => {
    const stored = localStorage.getItem('companies_page_size');
    return stored ? Number(stored) : 20;
  });

  // ── Selection ──────────────────────────────────────────────
  const [selectedIds,    setSelectedIds]    = useState<Set<number>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);

  // ── Search ─────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');

  // ── Sort — server-side ─────────────────────────────────────
  type CompanySortKey = 'name' | 'campaigns';
  type SortDir        = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<CompanySortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: CompanySortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setCurrentPage(1);
  };

  // ── Campaign filter — server-side ──────────────────────────
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<number>>(new Set());
  const [campaignFilterMode,  setCampaignFilterMode]  = useState<'any' | 'all'>('any');
  const [campaignDropOpen,    setCampaignDropOpen]    = useState(false);
  const [campaignDropSearch,  setCampaignDropSearch]  = useState('');
  const campaignDropRef = useRef<HTMLDivElement>(null);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());
  const [categoryFilterMode,  setCategoryFilterMode]  = useState<'any' | 'all'>('any');
  const [categoryDropOpen,    setCategoryDropOpen]    = useState(false);
  const [categoryDropSearch,  setCategoryDropSearch]  = useState('');
  const categoryDropRef = useRef<HTMLDivElement>(null);

  // ── Modal state ────────────────────────────────────────────
  const [assignCompany, setAssignCompany] = useState<CompanyWithCampaigns | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [viewCompany,         setViewCompany]         = useState<CompanyWithCampaigns | null>(null);
  const [viewCompanyCategories, setViewCompanyCategories] = useState<{ id: number; name: string }[]>([]);
  const [viewCategoriesLoading, setViewCategoriesLoading] = useState(false);
  const [detailCompany, setDetailCompany] = useState<CompanyWithCampaigns | null>(null);
  const [editLoading,   setEditLoading]   = useState(false);
  const [editForm,      setEditForm]      = useState<{ name: string; email: string; phone_number: string; address: string; company_info: string } | null>(null);
  const [bulkEnrollOpen,    setBulkEnrollOpen]    = useState(false);
  const [bulkEnrollLoading, setBulkEnrollLoading] = useState(false);
  const [addModalOpen,      setAddModalOpen]      = useState(false);

  // ── Category assignment modal ──────────────────────────────
  const [categoryAssignCompany,   setCategoryAssignCompany]   = useState<CompanyWithCampaigns | null>(null);
  const [bulkCategoryAssignOpen,  setBulkCategoryAssignOpen]  = useState(false);

  // ── Toast / confirm ────────────────────────────────────────
  const [toast,   setToast]   = useState<ToastState>({ visible: false, type: 'info', message: '' });
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (type: ToastState['type'], message: string) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast(p => ({ ...p, visible: false })), 4500);
  };
  const showConfirm = (
    title: string, message: string,
    onConfirm: () => void,
    variant: ConfirmState['variant'] = 'danger'
  ) => setConfirm({ open: true, title, message, onConfirm, variant });

  // ── Addition status polling (same mechanism as Campaign.tsx) ─
  const startPollingAdditionStatus = () => {
    if (pollRef.current) return; // already polling
    pollRef.current = setInterval(async () => {
      try {
        const r = await apiFetch(`${API_BASE}/company/addition-status`);
        if (r.ok) {
          const d = await r.json();
          setCompanyAdditionActive(d.company_addition_active);
          if (d.company_addition_active === 0) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setRefreshTrigger(p => p + 1);
          }
        }
      } catch { /* silent */ }
    }, 2000);
  };

  // ── Cancel AI search ───────────────────────────────────────
  const handleCancelSearch = async () => {
    setCancellingSearch(true);
    try {
      const r = await apiFetch(`${API_BASE}/company/cancel-ai-search`, { method: 'POST' });
      if (r.ok) {
        setCompanyAdditionActive(0);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setRefreshTrigger(p => p + 1);
        showToast('info', 'AI search cancelled');
      } else {
        showToast('error', 'Failed to cancel search');
      }
    } catch {
      showToast('error', 'Failed to cancel search');
    } finally {
      setCancellingSearch(false);
    }
  };

  // ── On mount: check if addition already in progress ────────
  useEffect(() => {
    if (!authReady) return;
    (async () => {
      try {
        const r = await apiFetch(`${API_BASE}/company/addition-status`);
        if (r.ok) {
          const d = await r.json();
          setCompanyAdditionActive(d.company_addition_active);
          if (d.company_addition_active !== 0) {
            startPollingAdditionStatus();
          }
        }
      } catch { setCompanyAdditionActive(0); }
    })();
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [authReady]);

  // ── Close dropdown on outside click ───────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (campaignDropRef.current && !campaignDropRef.current.contains(e.target as Node))
        setCampaignDropOpen(false);
      if (categoryDropRef.current && !categoryDropRef.current.contains(e.target as Node))
        setCategoryDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Reset to page 1 on search/sort/filter change ──────────
  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedCampaignIds, campaignFilterMode, selectedCategoryIds, categoryFilterMode, sortKey, sortDir]);

  // ── Reset selection on any nav/filter change ──────────────
  useEffect(() => {
    setSelectAllPages(false);
    setSelectedIds(new Set());
  }, [currentPage, pageSize, searchTerm, selectedCampaignIds, campaignFilterMode, selectedCategoryIds, categoryFilterMode, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(serverTotal / pageSize));

  // ── Load all campaigns (paginated loop, matches Companies pattern) ─
  useEffect(() => {
    if (!authReady) return;
    const load = async () => {
      try {
        const list: CampaignOption[] = [];
        let page = 1;
        while (true) {
          const res = await apiFetch(`${API_BASE}/campaign/?page=${page}&size=100`);
          if (!res.ok) break;
          const d = await res.json();
          const batch = (d.campaigns ?? []).map((c: any) => ({ id: c.id, name: c.name }));
          list.push(...batch);
          if (batch.length < 100) break;
          page++;
        }
        setAllCampaigns(list);
      } catch { /* silent */ }
    };
    load();
  }, [refreshTrigger, authReady]);

  // ── Load all categories ────────────────────────────────────
  useEffect(() => {
    if (!authReady) return;
    const load = async () => {
      try {
        const list: CampaignOption[] = [];
        let page = 1;
        while (true) {
          const res = await apiFetch(`${API_BASE}/category/?page=${page}&size=100`);
          if (!res.ok) break;
          const d = await res.json();
          const batch = (d.categories ?? []).map((c: any) => ({ id: c.id, name: c.name }));
          list.push(...batch);
          if (batch.length < 100) break;
          page++;
        }
        setAllCategories(list);
      } catch { /* silent */ }
    };
    load();
  }, [refreshTrigger, authReady]);

  // ── Build server query params from current state ──────────
  const buildQueryParams = useCallback((
    page: number, size: number, search: string,
    sKey: CompanySortKey | null, sDir: SortDir,
    campaignIds: Set<number>, filterMode: 'any' | 'all',
    categoryIds: Set<number>, catFilterMode: 'any' | 'all'
  ): string => {
    const p = new URLSearchParams({
      page: String(page),
      size: String(size),
    });
    if (search.trim())          p.set('search', search.trim());
    if (sKey)                   { p.set('sort_by', sKey); p.set('sort_order', sDir); }
    if (campaignIds.size > 0) {
      p.set('filter_campaigns', Array.from(campaignIds).join(','));
      p.set('filter_mode', filterMode);
    }
    if (categoryIds.size > 0) {
      p.set('filter_categories', Array.from(categoryIds).join(','));
      p.set('category_filter_mode', catFilterMode);
    }
    return p.toString();
  }, []);

  // ── Fetch current page ─────────────────────────────────────
  const fetchPage = useCallback(async (
    page: number, size: number, search: string,
    sKey: CompanySortKey | null, sDir: SortDir,
    campaignIds: Set<number>, filterMode: 'any' | 'all',
    categoryIds: Set<number>, catFilterMode: 'any' | 'all'
  ) => {
    setLoading(true);
    try {
      const qs  = buildQueryParams(page, size, search, sKey, sDir, campaignIds, filterMode, categoryIds, catFilterMode);
      const res = await apiFetch(`${API_BASE}/company/?${qs}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setServerTotal(data.total ?? 0);
      const raw: Company[] = data.companies ?? [];
      const enriched: CompanyWithCampaigns[] = raw.map(c => ({
        ...c,
        campaign_ids: (c as any).campaign_ids ?? [],
      }));
      setPageCompanies(enriched);
      setHasData(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [buildQueryParams]);

  // ── Fetch trigger ──────────────────────────────────────────
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!authReady) return;
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => {
      fetchPage(currentPage, pageSize, searchTerm, sortKey, sortDir, selectedCampaignIds, campaignFilterMode, selectedCategoryIds, categoryFilterMode);
    }, 300);
    return () => { if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, refreshTrigger, searchTerm, sortKey, sortDir, selectedCampaignIds, campaignFilterMode, selectedCategoryIds, categoryFilterMode, fetchPage, authReady]);

  // ── Derived values ─────────────────────────────────────────
  const campaignNameMap       = new Map(allCampaigns.map(c => [c.id, c.name]));
  const categoryNameMap       = new Map(allCategories.map(c => [c.id, c.name]));
  const filteredDropCampaigns = allCampaigns.filter(c =>
    c.name.toLowerCase().includes(campaignDropSearch.toLowerCase())
  );
  const filteredDropCategories = allCategories.filter(c =>
    c.name.toLowerCase().includes(categoryDropSearch.toLowerCase())
  );
  const displayTotal           = serverTotal;
  const rangeStart             = ((currentPage - 1) * pageSize) + 1;
  const rangeEnd               = Math.min(currentPage * pageSize, displayTotal);
  const allCurrentPageSelected = pageCompanies.length > 0 &&
    pageCompanies.every(c => selectedIds.has(c.id));
  const effectiveSelectedCount = selectAllPages ? serverTotal : selectedIds.size;
  const showBulkBar            = selectedIds.size > 0 || selectAllPages;
  const selectedPageCompanies  = pageCompanies.filter(c => selectedIds.has(c.id));
  const allSelectedOptedOut    = !selectAllPages && selectedPageCompanies.length > 0 && selectedPageCompanies.every(c => c.optedOut);

  // ── Selection helpers ──────────────────────────────────────
  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectAllPages) { setSelectAllPages(false); setSelectedIds(new Set([id])); return; }
    setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    if (selectAllPages) {
      setSelectAllPages(false); setSelectedIds(new Set());
    } else {
      setSelectAllPages(true);
      setSelectedIds(new Set(pageCompanies.map(c => c.id)));
    }
  };

  // ── Fetch all IDs (for bulk ops spanning all pages) ────────
  const fetchAllIds = async (): Promise<number[]> => {
    try {
      const qs  = buildQueryParams(1, serverTotal, searchTerm, sortKey, sortDir, selectedCampaignIds, campaignFilterMode, selectedCategoryIds, categoryFilterMode);
      const res = await apiFetch(`${API_BASE}/company/?${qs}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.companies ?? []).map((c: any) => c.id);
    } catch { return []; }
  };

  // ── Pagination helpers ─────────────────────────────────────
  const handlePageChange     = (p: number) => { setCurrentPage(p); };
  const handlePageSizeChange = (s: number) => {
    setPageSize(s);
    localStorage.setItem('companies_page_size', String(s));
    setCurrentPage(1);
  };

  const renderPageNumbers = () => {
    const pages: React.ReactNode[] = [];
    const maxV  = 5;
    let start   = Math.max(1, currentPage - Math.floor(maxV / 2));
    let end     = Math.min(totalPages, start + maxV - 1);
    if (end - start + 1 < maxV) start = Math.max(1, end - maxV + 1);

    if (start > 1) {
      pages.push(<PaginationButton key={1} theme={theme} onClick={() => handlePageChange(1)}>1</PaginationButton>);
      if (start > 2) pages.push(<PaginationInfo key="e1" theme={theme}>…</PaginationInfo>);
    }
    for (let i = start; i <= end; i++)
      pages.push(
        <PaginationButton key={i} theme={theme} $isActive={currentPage === i}
          onClick={() => handlePageChange(i)}>{i}</PaginationButton>
      );
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push(<PaginationInfo key="e2" theme={theme}>…</PaginationInfo>);
      pages.push(<PaginationButton key={totalPages} theme={theme}
        onClick={() => handlePageChange(totalPages)}>{totalPages}</PaginationButton>);
    }
    return pages;
  };

  // ── CRUD helpers ───────────────────────────────────────────
  const handleSaveCompany = async () => {
    if (!detailCompany || !editForm) return;
    if (!editForm.name.trim() || !editForm.email.trim()) return;
    setEditLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/company/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          id: detailCompany.id,
          name:         editForm.name.trim(),
          email:        editForm.email.trim(),
          phone_number: editForm.phone_number,
          address:      editForm.address,
          company_info: editForm.company_info,
        }]),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      showToast('success', 'Company updated');
      setDetailCompany(null);
      setEditForm(null);
      setRefreshTrigger(p => p + 1);
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed'); }
    finally { setEditLoading(false); }
  };

  const deleteCompanies = async (ids: number[]) => {
    setLoading(true);
    try {
      const idsToDelete = selectAllPages ? await fetchAllIds() : ids;
      const res = await apiFetch(`${API_BASE}/company/?ids=${idsToDelete.join(',')}`, {
        method: 'DELETE',
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      showToast('success', `${idsToDelete.length} compan${idsToDelete.length > 1 ? 'ies' : 'y'} deleted`);
      setSelectedIds(new Set()); setSelectAllPages(false);
      setRefreshTrigger(p => p + 1);
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  const handleBulkDownload = async () => {
    let list: CompanyWithCampaigns[];
    if (selectAllPages) {
      try {
        const qs  = buildQueryParams(1, serverTotal, searchTerm, sortKey, sortDir, selectedCampaignIds, campaignFilterMode, selectedCategoryIds, categoryFilterMode);
        const res = await apiFetch(`${API_BASE}/company/?${qs}`);
        if (!res.ok) { showToast('error', 'Failed to fetch all companies'); return; }
        const data = await res.json();
        list = (data.companies ?? []).map((c: any) => ({
          ...c,
          campaign_ids: c.campaign_ids ?? [],
        }));
      } catch { showToast('error', 'Failed to fetch companies'); return; }
    } else {
      list = pageCompanies.filter(c => selectedIds.has(c.id));
    }
    downloadCompaniesCSV(list, campaignNameMap,
      `companies_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ── Single-company assign ──────────────────────────────────
  const handleAssignSave = async (toEnroll: number[], toUnenroll: number[]) => {
    if (!assignCompany) return;
    setAssignLoading(true);
    try {
      if (toUnenroll.length) {
        const res = await apiFetch(`${API_BASE}/campaign/bulk-unenroll/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_ids: [assignCompany.id], campaign_ids: toUnenroll }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      }
      if (toEnroll.length) {
        const res = await apiFetch(`${API_BASE}/campaign/bulk-enroll/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_ids: [assignCompany.id], campaign_ids: toEnroll }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      }

      const newIds = [
        ...assignCompany.campaign_ids.filter(id => !toUnenroll.includes(id)),
        ...toEnroll,
      ];
      setAssignCompany(prev => prev ? { ...prev, campaign_ids: newIds } : prev);
      setPageCompanies(prev => prev.map(c =>
        c.id !== assignCompany.id ? c : { ...c, campaign_ids: newIds }
      ));

      const parts: string[] = [];
      if (toEnroll.length)   parts.push(`enrolled in ${toEnroll.length} campaign${toEnroll.length > 1 ? 's' : ''}`);
      if (toUnenroll.length) parts.push(`removed from ${toUnenroll.length} campaign${toUnenroll.length > 1 ? 's' : ''}`);
      showToast('success', parts.join(', '));
      setAssignCompany(null);
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed'); }
    finally { setAssignLoading(false); }
  };

  // ── Bulk enroll ────────────────────────────────────────────
  const handleBulkEnrollSave = async (toEnroll: number[], _toUnenroll: number[]) => {
    if (!toEnroll.length) { setBulkEnrollOpen(false); return; }
    setBulkEnrollLoading(true);
    const allIds = selectAllPages ? await fetchAllIds() : Array.from(selectedIds);
    const selectedCompanyIds = selectAllPages ? allIds : pageCompanies.filter(c => selectedIds.has(c.id) && !c.optedOut).map(c => c.id);
    try {
      const res = await apiFetch(`${API_BASE}/campaign/bulk-enroll/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_ids: selectedCompanyIds, campaign_ids: toEnroll }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      setPageCompanies(prev => prev.map(c =>
        !selectedIds.has(c.id) && !selectAllPages ? c : {
          ...c, campaign_ids: Array.from(new Set([...c.campaign_ids, ...toEnroll])),
        }
      ));
      showToast('success',
        `${selectedCompanyIds.length} compan${selectedCompanyIds.length > 1 ? 'ies' : 'y'} enrolled in ${toEnroll.length} campaign${toEnroll.length > 1 ? 's' : ''}`
      );
      setBulkEnrollOpen(false);
      setSelectedIds(new Set()); setSelectAllPages(false);
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Failed'); }
    finally { setBulkEnrollLoading(false); }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <PageContainer theme={theme}>

      {/* Toast */}
      <ToastContainer $isVisible={toast.visible}>
        {toast.visible && (
          <ToastItem theme={theme} $type={toast.type}>
            <ToastMsg theme={theme}>{toast.message}</ToastMsg>
            <IconButton theme={theme} $size="sm"
              onClick={() => setToast(p => ({ ...p, visible: false }))}>
              <CloseIcon />
            </IconButton>
          </ToastItem>
        )}
      </ToastContainer>

      {/* Confirm */}
      <ConfirmOverlay $isOpen={confirm.open}
        onClick={() => setConfirm(p => ({ ...p, open: false }))}>
        <ConfirmBox theme={theme} onClick={e => e.stopPropagation()}>
          <ConfirmHeader>
            <ConfirmIconWrap theme={theme} $variant={confirm.variant}><AlertIcon /></ConfirmIconWrap>
            <ConfirmContent>
              <ConfirmTitle theme={theme}>{confirm.title}</ConfirmTitle>
              <ConfirmMessage theme={theme}>{confirm.message}</ConfirmMessage>
            </ConfirmContent>
          </ConfirmHeader>
          <ConfirmActions>
            <CancelButton theme={theme}
              onClick={() => setConfirm(p => ({ ...p, open: false }))}>Cancel</CancelButton>
            <DangerButton theme={theme} onClick={() => {
              confirm.onConfirm();
              setConfirm(p => ({ ...p, open: false }));
            }}>
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
              <HeaderTitle>Companies</HeaderTitle>
              <HeaderSubtitle>Browse and manage all companies across your campaigns</HeaderSubtitle>
            </HeaderCenter>
          </HeaderRow>
        </HeaderCard>

        {/* List section */}
        <ListSection theme={theme}>

          {/* Section header */}
          <SectionHeader theme={theme}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {pageCompanies.length > 0 && (
                <Checkbox
                  theme={theme}
                  $checked={selectAllPages || allCurrentPageSelected}
                  onClick={toggleSelectAll}
                  title={
                    selectAllPages ? 'Deselect all'
                    : allCurrentPageSelected ? 'Deselect all on this page'
                    : 'Select all on this page'
                  }
                />
              )}
              <SectionTitle>
                <BuildingIcon />
                Companies
                <CountBadge theme={theme}>{displayTotal}</CountBadge>
                {(selectedIds.size > 0 || selectAllPages) && (
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 500,
                    color: theme.colors.primary.main,
                    background: `${theme.colors.primary.main}18`,
                    border: `1px solid ${theme.colors.primary.main}40`,
                    borderRadius: '999px', padding: '1px 8px', marginLeft: '2px',
                  }}>
                    {effectiveSelectedCount} selected
                  </span>
                )}
              </SectionTitle>
            </div>
            {companyAdditionActive === null ? null
              : companyAdditionActive !== 0
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, fontSize: '0.8rem', fontWeight: 500, color: theme.colors.primary.main }}>
                    <AdditionSpinner theme={theme} />
                    {companyAdditionActive > 0
                      ? `Finding companies… ${companyAdditionActive} remaining`
                      : 'Adding companies…'
                    }
                    {companyAdditionActive > 0 && (
                      <button
                        onClick={handleCancelSearch}
                        disabled={cancellingSearch}
                        style={{
                          marginLeft: '0.25rem',
                          padding: '0.2rem 0.6rem',
                          fontSize: '0.72rem', fontWeight: 600,
                          borderRadius: '999px', cursor: cancellingSearch ? 'not-allowed' : 'pointer',
                          border: `1px solid ${theme.colors.error.main}60`,
                          background: `${theme.colors.error.main}12`,
                          color: theme.colors.error.main,
                          opacity: cancellingSearch ? 0.5 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        {cancellingSearch ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </span>
                : <AddButton theme={theme} onClick={() => setAddModalOpen(true)} title="Add company">
                    <PlusIcon />
                  </AddButton>
            }
          </SectionHeader>

          {/* Search */}
          <SearchWrapper>
            <SearchIconWrap theme={theme}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </SearchIconWrap>
            <SearchInput
              theme={theme}
              type="text"
              placeholder="Search by name or email…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <SearchClearBtn theme={theme} onClick={() => setSearchTerm('')} title="Clear search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </SearchClearBtn>
            )}
          </SearchWrapper>

          {/* ── Sort bar — icon label ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <span style={toolbarLabelStyle} title="Sort">
              <SortIcon />
            </span>
            {([
              { key: 'name',      label: 'Alphabetical' },
              { key: 'campaigns', label: 'Campaigns'    },
            ] as { key: CompanySortKey; label: string }[]).map(({ key, label }) => {
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
                  {active && (
                    <span style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              );
            })}
            {sortKey && (
              <button onClick={() => { setSortKey(null); setSortDir('asc'); setCurrentPage(1); }} style={{
                padding: '0.3rem 0.6rem', borderRadius: '999px',
                fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                border: `1px solid ${theme.colors.base[300]}`,
                background: theme.colors.base[400], color: theme.colors.base.content, opacity: 0.55,
                transition: 'all 0.15s',
              }}>✕ Clear</button>
            )}
          </div>

          {/* ── Filter bar — icon label + campaigns dropdown ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <span style={toolbarLabelStyle} title="Filter">
              <FilterIcon />
            </span>

            {allCampaigns.length > 0 && (
              <DropdownWrap ref={campaignDropRef}>
                <DropdownTrigger theme={theme} $active={selectedCampaignIds.size > 0}
                  onClick={() => { setCampaignDropOpen(p => !p); setCampaignDropSearch(''); }}>
                  <FolderIcon />
                  Campaigns
                  {selectedCampaignIds.size > 0 && (
                    <DropdownBadge theme={theme}>{selectedCampaignIds.size}</DropdownBadge>
                  )}
                  <ChevronDown />
                </DropdownTrigger>

                {campaignDropOpen && (
                  <DropdownMenu theme={theme}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <DropdownSearch
                        theme={theme}
                        placeholder="Search campaigns…"
                        value={campaignDropSearch}
                        onChange={e => setCampaignDropSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{ marginBottom: 0, flex: 1 }}
                      />
                      {selectedCampaignIds.size > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedCampaignIds(new Set()); setCampaignFilterMode('any'); setCurrentPage(1); setCampaignDropOpen(false); }}
                          style={{
                            flexShrink: 0, padding: '0 0.5rem', height: '30px',
                            borderRadius: theme.radius.field, border: 'none',
                            background: 'transparent', cursor: 'pointer',
                            fontSize: '0.72rem', fontWeight: 600,
                            color: theme.colors.error.main, whiteSpace: 'nowrap',
                            opacity: 0.8,
                          }}>
                          Clear
                        </button>
                      )}
                    </div>
                    {filteredDropCampaigns.map(c => (
                      <DropdownItem key={c.id} theme={theme} $checked={selectedCampaignIds.has(c.id)}
                        onClick={() => {
                          setSelectedCampaignIds(prev => {
                            const next = new Set(prev);
                            next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                            return next;
                          });
                          setSelectedIds(new Set());
                          setSelectAllPages(false);
                        }}>
                        <Checkbox theme={theme} $checked={selectedCampaignIds.has(c.id)} />
                        <FolderIcon />{c.name}
                      </DropdownItem>
                    ))}
                    {filteredDropCampaigns.length === 0 && (
                      <div style={{ padding: '0.625rem', fontSize: '0.8rem', opacity: 0.5, textAlign: 'center' }}>
                        No campaigns found
                      </div>
                    )}
                  </DropdownMenu>
                )}
              </DropdownWrap>
            )}

            {/* ANY / ALL toggle — only shown when 2+ campaigns selected */}
            {selectedCampaignIds.size >= 2 && (
              <div style={{
                display: 'flex', alignItems: 'center',
                border: `1px solid ${theme.colors.base[300]}`,
                borderRadius: '999px', overflow: 'hidden',
                marginLeft: '0.25rem', flexShrink: 0,
              }}>
                {(['any', 'all'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setCampaignFilterMode(mode)}
                    style={{
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.72rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      cursor: 'pointer', border: 'none',
                      background: campaignFilterMode === mode
                        ? theme.colors.primary.main
                        : 'transparent',
                      color: campaignFilterMode === mode
                        ? theme.colors.primary.content
                        : theme.colors.base.content,
                      opacity: campaignFilterMode === mode ? 1 : 0.45,
                      transition: 'all 0.15s',
                    }}
                    title={mode === 'any' ? 'Show companies in ANY selected campaign (OR)' : 'Show companies in ALL selected campaigns (AND)'}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}

            {/* ── Category filter dropdown ── */}
            {allCategories.length > 0 && (
              <DropdownWrap ref={categoryDropRef}>
                <DropdownTrigger theme={theme} $active={selectedCategoryIds.size > 0}
                  onClick={() => { setCategoryDropOpen(p => !p); setCategoryDropSearch(''); }}>
                  <TagIcon />
                  Categories
                  {selectedCategoryIds.size > 0 && (
                    <DropdownBadge theme={theme}>{selectedCategoryIds.size}</DropdownBadge>
                  )}
                  <ChevronDown />
                </DropdownTrigger>

                {categoryDropOpen && (
                  <DropdownMenu theme={theme}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <DropdownSearch
                        theme={theme}
                        placeholder="Search categories…"
                        value={categoryDropSearch}
                        onChange={e => setCategoryDropSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{ marginBottom: 0, flex: 1 }}
                      />
                      {selectedCategoryIds.size > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedCategoryIds(new Set()); setCategoryFilterMode('any'); setCurrentPage(1); setCategoryDropOpen(false); }}
                          style={{
                            flexShrink: 0, padding: '0 0.5rem', height: '30px',
                            borderRadius: theme.radius.field, border: 'none',
                            background: 'transparent', cursor: 'pointer',
                            fontSize: '0.72rem', fontWeight: 600,
                            color: theme.colors.error.main, whiteSpace: 'nowrap',
                            opacity: 0.8,
                          }}>
                          Clear
                        </button>
                      )}
                    </div>
                    {filteredDropCategories.map(c => (
                      <DropdownItem key={c.id} theme={theme} $checked={selectedCategoryIds.has(c.id)}
                        onClick={() => {
                          setSelectedCategoryIds(prev => {
                            const next = new Set(prev);
                            next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                            return next;
                          });
                          setSelectedIds(new Set());
                          setSelectAllPages(false);
                        }}>
                        <Checkbox theme={theme} $checked={selectedCategoryIds.has(c.id)} />
                        <TagIcon />{c.name}
                      </DropdownItem>
                    ))}
                    {filteredDropCategories.length === 0 && (
                      <div style={{ padding: '0.625rem', fontSize: '0.8rem', opacity: 0.5, textAlign: 'center' }}>
                        No categories found
                      </div>
                    )}
                  </DropdownMenu>
                )}
              </DropdownWrap>
            )}

            {/* Category ANY / ALL toggle */}
            {selectedCategoryIds.size >= 2 && (
              <div style={{
                display: 'flex', alignItems: 'center',
                border: `1px solid ${theme.colors.base[300]}`,
                borderRadius: '999px', overflow: 'hidden',
                marginLeft: '0.25rem', flexShrink: 0,
              }}>
                {(['any', 'all'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setCategoryFilterMode(mode)}
                    style={{
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.72rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      cursor: 'pointer', border: 'none',
                      background: categoryFilterMode === mode
                        ? theme.colors.primary.main
                        : 'transparent',
                      color: categoryFilterMode === mode
                        ? theme.colors.primary.content
                        : theme.colors.base.content,
                      opacity: categoryFilterMode === mode ? 1 : 0.45,
                      transition: 'all 0.15s',
                    }}
                    title={mode === 'any' ? 'Show companies in ANY selected category (OR)' : 'Show companies in ALL selected categories (AND)'}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bulk actions */}
          {showBulkBar && (
            <BulkActionsBar theme={theme}>
              <BulkLeft>
                <CountBadge theme={theme}>{effectiveSelectedCount}</CountBadge>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  of {selectAllPages ? serverTotal : pageCompanies.length} selected
                </span>
              </BulkLeft>
              <BulkRight>
                <IconButton theme={theme} $size="md" title="Download selected as CSV"
                  onClick={handleBulkDownload}><DownloadIcon /></IconButton>
                <IconButton theme={theme} $size="md" title="Assign selected to category"
                  onClick={() => setBulkCategoryAssignOpen(true)}><TagIcon /></IconButton>
                <IconButton theme={theme} $size="md"
                  title={allSelectedOptedOut ? 'All selected companies have opted out' : 'Enroll selected in campaigns'}
                  disabled={allSelectedOptedOut}
                  style={allSelectedOptedOut ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                  onClick={() => { if (!allSelectedOptedOut) setBulkEnrollOpen(true); }}><LinkIcon /></IconButton>
                <IconButton theme={theme} $variant="danger" $size="md" title="Delete selected"
                  onClick={() => {
                    const count = selectAllPages ? serverTotal : selectedIds.size;
                    showConfirm(
                      'Delete Companies',
                      `Delete ${count} compan${count > 1 ? 'ies' : 'y'}? This cannot be undone.`,
                      () => deleteCompanies(Array.from(selectedIds))
                    );
                  }}><TrashIcon /></IconButton>
              </BulkRight>
            </BulkActionsBar>
          )}

          {/* Company list */}
          {loading && !hasData ? (
            <EmptyState>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', justifyContent: 'center' }}>
                <AdditionSpinner theme={theme} />
                <EmptyTitle style={{ margin: 0 }}>Loading companies…</EmptyTitle>
              </div>
            </EmptyState>
          ) : pageCompanies.length === 0 ? (
            <EmptyState>
              <EmptyIcon><BuildingIcon /></EmptyIcon>
              <EmptyTitle>{displayTotal === 0 ? 'No companies yet' : 'No results'}</EmptyTitle>
              <EmptySubtitle>
                {displayTotal === 0
                  ? 'Use the + button to add companies'
                  : searchTerm
                    ? `No companies match "${searchTerm}"`
                    : 'No companies match the selected filters'}
              </EmptySubtitle>
            </EmptyState>
          ) : pageCompanies.map(company => {
            const isSelected = selectAllPages || selectedIds.has(company.id);
            return (
              <CompanyCard key={company.id} theme={theme} $selected={isSelected}
                onClick={e => {
                  if (onCompanyClick) { onCompanyClick(company); return; }
                  toggleSelect(company.id, e);
                }}>
                <CompanyRow>
                  <div onClick={e => toggleSelect(company.id, e)}>
                    <Checkbox theme={theme} $checked={isSelected} />
                  </div>

                  <CompanyInfo>
                    <CompanyName>{company.name}</CompanyName>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
                      <CompanyEmail>{company.email}</CompanyEmail>{company.optedOut && (
                        <OptedOutBadge>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                          </svg>
                          Opted out
                        </OptedOutBadge>
                      )}
                    </div>
                    {(company.phone_number || company.address) && (
                      <CompanyMeta>
                        {company.phone_number && <MetaItem><PhoneIcon />{company.phone_number}</MetaItem>}
                        {company.address      && <MetaItem><MapPinIcon />{company.address}</MetaItem>}
                      </CompanyMeta>
                    )}
                  </CompanyInfo>

                  {(() => {
                    const companyCategoryIds = company.category_ids ?? [];
                    const hasCampaigns  = company.campaign_ids.length > 0;
                    const hasCategories = companyCategoryIds.length > 0;
                    if (!hasCampaigns && !hasCategories) return null;
                    return (
                      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }} onClick={e => e.stopPropagation()}>
                        {hasCampaigns && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.4 }}>Campaigns</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {company.campaign_ids.slice(0, 3).map(cid => {
                                const name = campaignNameMap.get(cid);
                                if (!name) return null;
                                const label = name.length > 18 ? name.slice(0, 18) + '…' : name;
                                return (
                                  <CampaignTag key={cid} theme={theme} $campaignId={cid} title={name}
                                    style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                    {label}
                                  </CampaignTag>
                                );
                              })}
                              {company.campaign_ids.length > 3 && (
                                <CampaignTag theme={theme} $campaignId={99}
                                  title={company.campaign_ids.slice(3).map(cid => campaignNameMap.get(cid)).filter(Boolean).join(', ')}>
                                  +{company.campaign_ids.length - 3} more
                                </CampaignTag>
                              )}
                            </div>
                          </div>
                        )}
                        {hasCampaigns && hasCategories && (
                          <div style={{ width: 1, background: theme.colors.base[300], alignSelf: 'stretch', flexShrink: 0, opacity: 0.6 }} />
                        )}
                        {hasCategories && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.4 }}>Categories</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {companyCategoryIds.slice(0, 3).map(catId => {
                                const name = categoryNameMap.get(catId);
                                if (!name) return null;
                                const label = name.length > 18 ? name.slice(0, 18) + '…' : name;
                                return (
                                  <CategoryTag key={catId} theme={theme} $categoryId={catId} title={name}
                                    style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                    {label}
                                  </CategoryTag>
                                );
                              })}
                              {companyCategoryIds.length > 3 && (
                                <CategoryTag theme={theme} $categoryId={99}
                                  title={companyCategoryIds.slice(3).map(id => categoryNameMap.get(id)).filter(Boolean).join(', ')}>
                                  +{companyCategoryIds.length - 3} more
                                </CategoryTag>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <CompanyActionButtons onClick={e => e.stopPropagation()}>
                    <IconButton theme={theme} $size="md" title="View details" disabled={isSelected}
                      onClick={e => { e.stopPropagation(); setViewCompany(company); setViewCategoriesLoading(false);
                        const cats = allCategories
                          .filter(cat => (company.category_ids ?? []).includes(cat.id))
                          .map(cat => ({ id: cat.id, name: cat.name }))
                          .sort((a, b) => a.name.localeCompare(b.name));
                        setViewCompanyCategories(cats);
                      }}>
                      <EyeIcon />
                    </IconButton>
                    <IconButton theme={theme} $size="md" title="Edit company" disabled={isSelected}
                      onClick={e => { e.stopPropagation(); setDetailCompany(company); setEditForm({ name: company.name, email: company.email, phone_number: company.phone_number ?? '', address: company.address ?? '', company_info: company.company_info ?? '' }); }}>
                      <EditIcon />
                    </IconButton>
                    <IconButton theme={theme} $size="md" title="Assign to category" disabled={isSelected}
                      onClick={e => { e.stopPropagation(); setCategoryAssignCompany(company); }}>
                      <TagIcon />
                    </IconButton>
                    <IconButton theme={theme} $size="md" title="Download as CSV" disabled={isSelected}
                      onClick={e => { e.stopPropagation(); downloadCompaniesCSV([company], campaignNameMap, `${company.name.replace(/[^a-z0-9]/gi, '_')}.csv`); }}>
                      <DownloadIcon />
                    </IconButton>
                    <IconButton theme={theme} $size="md"
                      title={company.optedOut ? 'Company has opted out — cannot enroll' : 'Manage campaigns'}
                      disabled={isSelected || !!company.optedOut}
                      style={company.optedOut ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                      onClick={e => { e.stopPropagation(); if (!company.optedOut) setAssignCompany(company); }}>
                      <LinkIcon />
                    </IconButton>
                    <IconButton theme={theme} $variant="danger" $size="md" title="Delete" disabled={isSelected}
                      onClick={e => { e.stopPropagation(); showConfirm('Delete Company', `Delete "${company.name}"? This cannot be undone.`, () => deleteCompanies([company.id])); }}>
                      <TrashIcon />
                    </IconButton>
                  </CompanyActionButtons>
                </CompanyRow>
              </CompanyCard>
            );
          })}

          {/* Pagination */}
          {displayTotal > 0 && (
            <PaginationContainer theme={theme}>
              <PaginationButton theme={theme} onClick={() => handlePageChange(1)} disabled={currentPage === 1}>««</PaginationButton>
              <PaginationButton theme={theme} onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>«</PaginationButton>
              {renderPageNumbers()}
              <PaginationButton theme={theme} onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>»</PaginationButton>
              <PaginationButton theme={theme} onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}>»»</PaginationButton>
              <PaginationInfo theme={theme}>
                {displayTotal > 0 ? `${rangeStart}–${rangeEnd} of ${displayTotal}` : '0'}
              </PaginationInfo>
              <PageSizeSelect theme={theme} value={pageSize}
                onChange={e => handlePageSizeChange(Number(e.target.value))}>
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

      {/* ── Modals ─────────────────────────────────────────── */}

      {/* View-only modal */}
      {viewCompany && (
        <ModalOverlay $isOpen={true} onClick={() => setViewCompany(null)}>
          <ModalContent theme={theme} $wide={true} onClick={e => e.stopPropagation()}>
            <ModalHeader theme={theme}>
              <ModalTitle><EyeIcon /> {viewCompany.name}</ModalTitle>
              <CloseButton theme={theme} onClick={() => setViewCompany(null)}><CloseIcon /></CloseButton>
            </ModalHeader>
            <ModalBody>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Name</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, padding: '0.5rem 0.75rem', background: theme.colors.base[200], borderRadius: theme.radius.field }}>{viewCompany.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Email</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, padding: '0.5rem 0.75rem', background: theme.colors.base[200], borderRadius: theme.radius.field }}>{viewCompany.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Phone</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, padding: '0.5rem 0.75rem', background: theme.colors.base[200], borderRadius: theme.radius.field, opacity: viewCompany.phone_number ? 1 : 0.4 }}>
                    {viewCompany.phone_number || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Created</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, padding: '0.5rem 0.75rem', background: theme.colors.base[200], borderRadius: theme.radius.field, opacity: 0.6 }}>
                    {new Date(viewCompany.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Address</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, padding: '0.5rem 0.75rem', background: theme.colors.base[200], borderRadius: theme.radius.field, opacity: viewCompany.address ? 1 : 0.4 }}>
                    {viewCompany.address || '—'}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Notes</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, padding: '0.5rem 0.75rem', background: theme.colors.base[200], borderRadius: theme.radius.field, minHeight: '4.5rem', whiteSpace: 'pre-wrap', opacity: viewCompany.company_info ? 1 : 0.4 }}>
                    {viewCompany.company_info || '—'}
                  </div>
                </div>
              </div>

              {/* Enrolled campaigns */}
              <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.75rem' }}>
                Enrolled Campaigns <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({viewCompany.campaign_ids.length})</span>
              </div>
              {viewCompany.campaign_ids.length === 0 ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', border: `1px dashed ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.45 }}>
                  Not enrolled in any campaigns
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {viewCompany.campaign_ids.map(cid => {
                    const name = campaignNameMap.get(cid);
                    if (!name) return null;
                    const label = name.length > 22 ? name.slice(0, 22) + '…' : name;
                    return (
                      <CampaignTag key={cid} theme={theme} $campaignId={cid}
                        title={name}
                        style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                        {label}
                      </CampaignTag>
                    );
                  })}
                </div>
              )}

              {/* Categories */}
              <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.75rem', marginTop: '1.25rem' }}>
                Categories
                {!viewCategoriesLoading && (
                  <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({viewCompanyCategories.length})</span>
                )}
              </div>
              {viewCategoriesLoading ? (
                <div style={{ padding: '1rem', opacity: 0.45, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AdditionSpinner theme={theme} /> Loading categories…
                </div>
              ) : viewCompanyCategories.length === 0 ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', border: `1px dashed ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.45 }}>
                  Not assigned to any categories
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {viewCompanyCategories.map(cat => {
                    const label = cat.name.length > 22 ? cat.name.slice(0, 22) + '…' : cat.name;
                    return (
                      <CategoryTag key={cat.id} theme={theme} $categoryId={cat.id}
                        title={cat.name}>
                        {label}
                      </CategoryTag>
                    );
                  })}
                </div>
              )}
            </ModalBody>
            <ModalFooter theme={theme}>
              <PrimaryButton theme={theme} onClick={() => {
                setViewCompany(null);
                setDetailCompany(viewCompany);
                setEditForm({ name: viewCompany.name, email: viewCompany.email, phone_number: viewCompany.phone_number ?? '', address: viewCompany.address ?? '', company_info: viewCompany.company_info ?? '' });
              }}>
                <EditIcon /> Edit Company
              </PrimaryButton>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Detail + Edit modal (merged) */}
      {detailCompany && (
        <ModalOverlay $isOpen={true} onClick={() => { setDetailCompany(null); setEditForm(null); }}>
          <ModalContent theme={theme} $wide={true} onClick={e => e.stopPropagation()}>
            <ModalHeader theme={theme}>
              <ModalTitle><EditIcon /> Edit — {detailCompany.name}</ModalTitle>
              <CloseButton theme={theme} onClick={() => { setDetailCompany(null); setEditForm(null); }}><CloseIcon /></CloseButton>
            </ModalHeader>
            <ModalBody>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Name */}
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Name *</div>
                  <input
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.9rem', fontWeight: 500, background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, color: theme.colors.base.content, outline: 'none', boxSizing: 'border-box' }}
                    value={editForm?.name ?? detailCompany.name}
                    onChange={e => setEditForm(p => ({ ...(p ?? { name: detailCompany.name, email: detailCompany.email, phone_number: detailCompany.phone_number ?? '', address: detailCompany.address ?? '', company_info: detailCompany.company_info ?? '' }), name: e.target.value }))}
                    autoFocus
                  />
                </div>
                {/* Email */}
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Email *</div>
                  <input
                    type="email"
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.9rem', fontWeight: 500, background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, color: theme.colors.base.content, outline: 'none', boxSizing: 'border-box' }}
                    value={editForm?.email ?? detailCompany.email}
                    onChange={e => setEditForm(p => ({ ...(p ?? { name: detailCompany.name, email: detailCompany.email, phone_number: detailCompany.phone_number ?? '', address: detailCompany.address ?? '', company_info: detailCompany.company_info ?? '' }), email: e.target.value }))}
                  />
                </div>
                {/* Phone */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Phone</div>
                  <input
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.9rem', fontWeight: 500, background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, color: theme.colors.base.content, outline: 'none', boxSizing: 'border-box' }}
                    value={editForm?.phone_number ?? detailCompany.phone_number ?? ''}
                    onChange={e => setEditForm(p => ({ ...(p ?? { name: detailCompany.name, email: detailCompany.email, phone_number: detailCompany.phone_number ?? '', address: detailCompany.address ?? '', company_info: detailCompany.company_info ?? '' }), phone_number: e.target.value }))}
                  />
                </div>
                {/* Address */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Address</div>
                  <input
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.9rem', fontWeight: 500, background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, color: theme.colors.base.content, outline: 'none', boxSizing: 'border-box' }}
                    value={editForm?.address ?? detailCompany.address ?? ''}
                    onChange={e => setEditForm(p => ({ ...(p ?? { name: detailCompany.name, email: detailCompany.email, phone_number: detailCompany.phone_number ?? '', address: detailCompany.address ?? '', company_info: detailCompany.company_info ?? '' }), address: e.target.value }))}
                  />
                </div>
                {/* Notes */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>Notes</div>
                  <textarea
                    rows={3}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.9rem', fontWeight: 500, background: theme.colors.base[200], border: `1px solid ${theme.colors.base[300]}`, borderRadius: theme.radius.field, color: theme.colors.base.content, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    value={editForm?.company_info ?? detailCompany.company_info ?? ''}
                    onChange={e => setEditForm(p => ({ ...(p ?? { name: detailCompany.name, email: detailCompany.email, phone_number: detailCompany.phone_number ?? '', address: detailCompany.address ?? '', company_info: detailCompany.company_info ?? '' }), company_info: e.target.value }))}
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter theme={theme}>
              <PrimaryButton
                theme={theme}
                onClick={handleSaveCompany}
                disabled={editLoading || !editForm || !editForm.name.trim() || !editForm.email.trim()}
              >
                <SaveIcon />
                {editLoading ? 'Saving…' : 'Save Changes'}
              </PrimaryButton>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}

      <CampaignAssignModal
        company={assignCompany}
        isOpen={assignCompany !== null}
        campaigns={allCampaigns}
        enrolledCampaignIds={new Set(assignCompany?.campaign_ids ?? [])}
        loading={assignLoading}
        theme={theme}
        onSave={handleAssignSave}
        onClose={() => setAssignCompany(null)}
      />

      <CampaignAssignModal
        company={null}
        selectedCount={effectiveSelectedCount}
        isOpen={bulkEnrollOpen}
        campaigns={allCampaigns}
        enrolledCampaignIds={new Set()}
        loading={bulkEnrollLoading}
        theme={theme}
        onSave={handleBulkEnrollSave}
        onClose={() => setBulkEnrollOpen(false)}
      />

      <AddCompanyModal
        isOpen={addModalOpen}
        theme={theme}
        apiBase={API_BASE}
        initialTab="manual"
        onClose={() => setAddModalOpen(false)}
        onSuccess={(active: number) => { setCompanyAdditionActive(active); if (active !== 0) startPollingAdditionStatus(); else setRefreshTrigger(p => p + 1); }}
      />

      {/* Individual — assign company to category */}
      <AddCompanyToCategoryModal
        isOpen={categoryAssignCompany !== null}
        company={categoryAssignCompany}
        theme={theme}
        onSave={(added, removed) => {
          const parts: string[] = [];
          if (added.length)   parts.push(`added to ${added.length} categor${added.length > 1 ? 'ies' : 'y'}`);
          if (removed.length) parts.push(`removed from ${removed.length} categor${removed.length > 1 ? 'ies' : 'y'}`);
          showToast('success', parts.join(', '));
          setCategoryAssignCompany(null);
          setRefreshTrigger(p => p + 1);
        }}
        onClose={() => setCategoryAssignCompany(null)}
      />

      {/* Bulk — assign selected companies to category */}
      <AddCompanyToCategoryModal
        isOpen={bulkCategoryAssignOpen}
        companyIds={selectAllPages ? undefined : Array.from(selectedIds)}
        selectedCount={effectiveSelectedCount}
        theme={theme}
        onSave={(added, removed) => {
          const parts: string[] = [];
          if (added.length)   parts.push(`${effectiveSelectedCount} compan${effectiveSelectedCount > 1 ? 'ies' : 'y'} added to ${added.length} categor${added.length > 1 ? 'ies' : 'y'}`);
          if (removed.length) parts.push(`removed from ${removed.length} categor${removed.length > 1 ? 'ies' : 'y'}`);
          showToast('success', parts.join(', '));
          setBulkCategoryAssignOpen(false);
          setSelectedIds(new Set()); setSelectAllPages(false);
          setRefreshTrigger(p => p + 1);
        }}
        onClose={() => setBulkCategoryAssignOpen(false)}
      />
    </PageContainer>
  );
};

export default Companies;