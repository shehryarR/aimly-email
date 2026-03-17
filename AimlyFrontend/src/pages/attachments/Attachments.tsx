// ============================================================
// Attachments.tsx - Matches campaign page UI patterns exactly
// UPDATED: Server-side sorting + filtering, full campaign list,
//          sort/filter icons, select-all-pages functionality
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../theme/styles';
import { apiFetch } from '../../App';

import {
  PageContainer, MainContent, HeaderCard, HeaderRow, BackButton,
  HeaderCenter, HeaderTitle, HeaderSubtitle,
  UploadZone, UploadText, UploadSubtext, ProgressBar, ProgressFill,
  ListSection, SectionHeader, SectionTitle, CountBadge, AddButton,
  BulkActionsBar, BulkLeft, BulkRight,
  AttachmentCard, AttachmentRow, FileIconWrap, FileInfo, FileName,
  FileMeta, FileMetaItem, LinkBadges, LinkBadge, ActionButtons,
  Checkbox, IconButton,
  EmptyState, EmptyIcon, EmptyTitle, EmptySubtitle,
  ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton,
  ModalBody, ModalFooter,
  SectionLabel, LinkRow, LinkRowName, SearchWrapper, SearchIconWrap, SearchClearBtn, SearchInput,
  ToastContainer, ToastItem, ToastMsg,
  ConfirmOverlay, ConfirmBox, ConfirmHeader, ConfirmIconWrap, ConfirmContent,
  ConfirmTitle, ConfirmMessage, ConfirmActions, CancelButton, DangerButton, PrimaryButton,
  PaginationContainer, PaginationButton, PaginationInfo, PageSizeSelect,
  FilterChip,
  DropdownWrap, DropdownTrigger, DropdownBadge, DropdownMenu,
  DropdownSearch, DropdownItem,
  EditInput,
} from './attachments.styles';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Attachment {
  id: number;
  filename: string;
  file_size: number;
  created_at: string;
  linked_global: boolean;
  linked_campaigns: { id: number; name: string }[];
}

interface Campaign {
  id: number;
  name: string;
  preference_id: number | null;
}

interface ToastState {
  visible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const getExt = (filename: string) =>
  filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';

const getNameWithoutExt = (filename: string) => {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (str: string) => {
  if (!str) return '';
  try {
    return new Date(str.replace(' ', 'T')).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return ''; }
};

// ── Inline SVG icons ────────────────────────────────────────────────────────────

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const PaperclipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);

const UploadCloudIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const LinkChainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const AlertCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const SortIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <line x1="3"  y1="6"  x2="21" y2="6"/>
    <line x1="3"  y1="12" x2="14" y2="12"/>
    <line x1="3"  y1="18" x2="8"  y2="18"/>
  </svg>
);

const FilterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

// ── Main component ─────────────────────────────────────────────────────────────

const Attachments: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data ───────────────────────────────────────────────────
  const [attachments,      setAttachments]      = useState<Attachment[]>([]);
  const [campaigns,        setCampaigns]         = useState<Campaign[]>([]);
  const [globalSettingsId, setGlobalSettingsId]  = useState<number | null>(null);
  const [loading,          setLoading]           = useState(true);
  const [totalAttachments, setTotalAttachments]  = useState(0);

  // ── Pagination ─────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize,    setPageSize]    = useState(() => {
    const stored = localStorage.getItem('attachments_page_size');
    return stored ? Number(stored) : 20;
  });

  // ── Selection ──────────────────────────────────────────────
  const [selected,       setSelected]       = useState<Set<number>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);

  // ── Sort — server-side ─────────────────────────────────────
  type AttachmentSortKey = 'name' | 'campaigns' | 'size';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<AttachmentSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: AttachmentSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  // ── Filter — server-side, multi-select ────────────────────
  const [activeFilters, setActiveFilters] = useState<Set<'global' | number>>(new Set());
  const [campaignFilterMode, setCampaignFilterMode] = useState<'any' | 'all'>('any');

  // ── Search ─────────────────────────────────────────────────
  const [attachmentSearch, setAttachmentSearch] = useState('');

  // ── Rename modal ───────────────────────────────────────────
  const [renameModal, setRenameModal] = useState<{
    open: boolean;
    attachmentId: number;
    currentName: string;
    newName: string;
  }>({ open: false, attachmentId: 0, currentName: '', newName: '' });

  const [renaming, setRenaming] = useState(false);

  // ── Detail modal ───────────────────────────────────────────
  const [detailAttachment, setDetailAttachment] = useState<Attachment | null>(null);

  // ── Debounced search ───────────────────────────────────────
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setCurrentPage(1);
    }, 350);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [attachmentSearch]);

  // ── Reset selection when page/filter/search/sort changes ──
  useEffect(() => {
    setSelectAllPages(false);
    setSelected(new Set());
  }, [currentPage, pageSize, attachmentSearch, activeFilters, campaignFilterMode, sortKey, sortDir]);

  const toggleFilter = (val: 'global' | number) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val); else next.add(val);
      return next;
    });
    setCurrentPage(1);
  };

  const [campaignDropdownOpen, setCampaignDropdownOpen] = useState(false);
  const [campaignDropdownSearch, setCampaignDropdownSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCampaignDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Upload ─────────────────────────────────────────────────
  const [isDragging,      setIsDragging]      = useState(false);
  const [uploadProgress,  setUploadProgress]  = useState(0);
  const [uploading,       setUploading]       = useState(false);

  // ── Attach modal ───────────────────────────────────────────
  const [linkModal, setLinkModal] = useState<{
    open: boolean;
    attachmentIds: number[];
    currentGlobal: boolean;
    currentCampaigns: number[];
  }>({ open: false, attachmentIds: [], currentGlobal: false, currentCampaigns: [] });

  const [linkGlobal,     setLinkGlobal]     = useState(false);
  const [linkCampaigns,  setLinkCampaigns]  = useState<Set<number>>(new Set());
  const [campaignSearch, setCampaignSearch] = useState('');
  const [linkSaving,     setLinkSaving]     = useState(false);

  // ── Upload modal ───────────────────────────────────────────
  const [uploadModal, setUploadModal] = useState(false);

  // ── Toast ──────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState>({ visible: false, type: 'info', message: '' });

  const showToast = (type: ToastState['type'], message: string) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast(p => ({ ...p, visible: false })), 4000);
  };

  // ── Confirm dialog ──────────────────────────────────────────
  const [confirm, setConfirm] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirm({ open: true, title, message, onConfirm });
  };

  // ── Build filter query params ──────────────────────────────
  const buildFilterParams = () => {
    const params: string[] = [];
    const hasGlobalFilter = activeFilters.has('global');
    const campaignFilterIds = Array.from(activeFilters).filter((f): f is number => typeof f === 'number');

    if (hasGlobalFilter) params.push('filter_global=true');
    if (campaignFilterIds.length > 0) {
      params.push(`filter_campaigns=${campaignFilterIds.join(',')}`);
      params.push(`filter_mode=${campaignFilterMode}`);
    }
    if (sortKey) {
      params.push(`sort_by=${sortKey}`);
      params.push(`sort_order=${sortDir}`);
    }
    return params.join('&');
  };

  // ── Load ALL campaigns using paginated loop ────────────────
  const loadAllCampaigns = useCallback(async (): Promise<Campaign[]> => {
    const list: { id: number; name: string }[] = [];

    let page = 1;
    while (true) {
      const res = await apiFetch(`${API_BASE}/campaign/?page=${page}&size=100`);
      if (!res.ok) break;
      const d = await res.json();
      const batch: any[] = d.campaigns ?? [];
      list.push(...batch.map((c: any) => ({ id: c.id, name: c.name })));
      if (batch.length < 100) break;
      page++;
    }

    const prefResults = await Promise.allSettled(
      list.map((c) =>
        apiFetch(`${API_BASE}/campaign/${c.id}/campaign_preference/`)
          .then(r => r.ok ? r.json() : null)
      )
    );

    return list.map((c, i) => {
      const pref = prefResults[i].status === 'fulfilled' ? prefResults[i].value : null;
      return { id: c.id, name: c.name, preference_id: pref?.id ?? null } as Campaign;
    });
  }, []);

  // ── Load data ──────────────────────────────────────────────
  const loadAll = useCallback(async (page = 1, size = 20, search = '', filterParams = '') => {
    setLoading(true);

    try {
      const searchParam = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
      const filterStr   = filterParams ? `&${filterParams}` : '';

      const [attRes, globalRes] = await Promise.all([
        apiFetch(`${API_BASE}/attachments/?page=${page}&page_size=${size}${searchParam}${filterStr}`),
        apiFetch(`${API_BASE}/global_setting/`),
      ]);

      // Load campaigns fully (all pages) once and cache
      if (campaigns.length === 0) {
        const campList = await loadAllCampaigns();
        setCampaigns(campList);
      }

      let gsId: number | null = globalSettingsId;
      if (globalRes.ok) {
        const gsData = await globalRes.json();
        gsId = gsData.id ?? null;
        setGlobalSettingsId(gsId);
      }

      if (attRes.ok) {
        const attData = await attRes.json();
        const rawList: any[] = attData.attachments ?? [];
        setTotalAttachments(attData.total ?? rawList.length);

        const campList = campaigns.length > 0 ? campaigns : await loadAllCampaigns();

        const linkResults = await Promise.allSettled(
          rawList.map(async (a) => {
            const results: { global: boolean; campaigns: { id: number; name: string }[] } =
              { global: false, campaigns: [] };

            if (gsId) {
              const gRes = await apiFetch(`${API_BASE}/global-settings/${gsId}/attachments/`);
              if (gRes.ok) {
                const gData = await gRes.json();
                results.global = (gData.attachments ?? []).some((x: any) => x.id === a.id);
              }
            }

            for (const camp of campList) {
              if (!camp.preference_id) continue;
              const cRes = await apiFetch(`${API_BASE}/campaign-preference/${camp.preference_id}/attachments/`);
              if (cRes.ok) {
                const cData = await cRes.json();
                if ((cData.attachments ?? []).some((x: any) => x.id === a.id)) {
                  results.campaigns.push({ id: camp.id, name: camp.name });
                }
              }
            }
            return results;
          })
        );

        const merged: Attachment[] = rawList.map((a, i) => {
          const links = linkResults[i].status === 'fulfilled' ? linkResults[i].value : { global: false, campaigns: [] };
          return {
            id: a.id,
            filename: a.filename,
            file_size: a.file_size ?? 0,
            created_at: a.created_at,
            linked_global: links.global,
            linked_campaigns: links.campaigns,
          };
        });
        setAttachments(merged);
      }
    } catch {
      showToast('error', 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [campaigns, globalSettingsId, loadAllCampaigns]);

  // Reload when page/size/search/sort/filter changes
  useEffect(() => {
    loadAll(currentPage, pageSize, attachmentSearch, buildFilterParams());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, attachmentSearch, activeFilters, campaignFilterMode, sortKey, sortDir]);

  // Load campaigns list once on mount (for modals/dropdowns)
  useEffect(() => {
    if (campaigns.length > 0) return;
    loadAllCampaigns().then(setCampaigns);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Upload ─────────────────────────────────────────────────
  const uploadFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    setUploading(true);
    setUploadProgress(0);

    let done = 0;
    let successCount = 0;
    let failCount = 0;

    for (const file of fileArr) {
      const fd = new FormData();
      fd.append('file', file);

      try {
        const res = await apiFetch(`${API_BASE}/attachment/`, {
          method: 'POST',
          body: fd,
        });

        if (!res.ok) {
          failCount++;
          try {
            const err = await res.json();
            showToast('error', err.detail || err.message || JSON.stringify(err));
          } catch {
            showToast('error', `Failed to upload ${file.name} (HTTP ${res.status})`);
          }
        } else {
          successCount++;
          showToast('success', `${file.name} uploaded successfully`);
        }
      } catch {
        failCount++;
        showToast('error', `Network error uploading ${file.name}`);
      }

      done++;
      setUploadProgress(Math.round((done / fileArr.length) * 100));
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setUploading(false);

    if (fileArr.length > 1) {
      if (successCount === fileArr.length) {
        showToast('success', `${fileArr.length} files uploaded successfully`);
        setUploadModal(false);
        setCurrentPage(1);
        loadAll(1, pageSize, attachmentSearch, buildFilterParams());
      } else if (successCount > 0) {
        showToast('warning', `${successCount} uploaded, ${failCount} failed`);
        setCurrentPage(1);
        loadAll(1, pageSize, attachmentSearch, buildFilterParams());
      } else {
        showToast('error', `All ${failCount} uploads failed`);
      }
    } else {
      if (successCount === 1) {
        setUploadModal(false);
        setCurrentPage(1);
        loadAll(1, pageSize, attachmentSearch, buildFilterParams());
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  // ── Rename ─────────────────────────────────────────────────
  const openRenameModal = (att: Attachment) => {
    setRenameModal({
      open: true,
      attachmentId: att.id,
      currentName: att.filename,
      newName: getNameWithoutExt(att.filename)
    });
  };

  const handleRename = async () => {
    if (!renameModal.newName.trim()) {
      showToast('error', 'Filename cannot be empty');
      return;
    }

    setRenaming(true);

    try {
      const res = await apiFetch(`${API_BASE}/attachment/${renameModal.attachmentId}?new_name=${encodeURIComponent(renameModal.newName.trim())}`, {
        method: 'PUT',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to rename attachment');
      }

      showToast('success', 'Attachment renamed successfully');
      setRenameModal({ ...renameModal, open: false });
      loadAll(currentPage, pageSize, attachmentSearch, buildFilterParams());
    } catch (error: any) {
      showToast('error', error.message || 'Failed to rename attachment');
    } finally {
      setRenaming(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────
  const deleteAttachments = async (ids: number[]) => {
    if (selectAllPages) {
      try {
        const res = await apiFetch(`${API_BASE}/attachments/?page=1&page_size=${totalAttachments}`);
        if (res.ok) {
          const data = await res.json();
          const allIds: number[] = (data.attachments ?? []).map((a: any) => a.id);
          for (const id of allIds) {
            await apiFetch(`${API_BASE}/attachment/${id}/`, { method: 'DELETE' });
          }
          showToast('success', `${allIds.length} attachments deleted`);
        } else {
          showToast('error', 'Failed to fetch all attachments for deletion');
          return;
        }
      } catch {
        showToast('error', 'Failed to delete all attachments');
        return;
      }
      setSelectAllPages(false);
    } else {
      for (const id of ids) {
        await apiFetch(`${API_BASE}/attachment/${id}/`, { method: 'DELETE' });
      }
      showToast('success', `${ids.length} attachment${ids.length > 1 ? 's' : ''} deleted`);
    }

    setSelected(new Set());
    loadAll(currentPage, pageSize, attachmentSearch, buildFilterParams());
  };

  const confirmDelete = (ids: number[]) => {
    let message: string;
    if (selectAllPages) {
      message = `Are you sure you want to delete all ${totalAttachments} attachments? This will also remove them from any attached campaigns or global settings.`;
    } else {
      const names = ids.length === 1
        ? `"${attachments.find(a => a.id === ids[0])?.filename}"`
        : `${ids.length} attachments`;
      message = `Are you sure you want to delete ${names}? This will also remove them from any attached campaigns or global settings.`;
    }
    showConfirm('Delete Attachment', message, () => deleteAttachments(ids));
  };

  // ── Download ────────────────────────────────────────────────
  const downloadAttachment = async (att: Attachment) => {
    try {
      const res = await apiFetch(`${API_BASE}/attachment/${att.id}/`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showToast('error', `Failed to download ${att.filename}`);
    }
  };

  const bulkDownload = async () => {
    let attsToDownload: { id: number; filename: string }[];

    if (selectAllPages) {
      try {
        const res = await apiFetch(`${API_BASE}/attachments/?page=1&page_size=${totalAttachments}`);
        if (!res.ok) { showToast('error', 'Failed to fetch all attachments'); return; }
        const data = await res.json();
        attsToDownload = (data.attachments ?? []).map((a: any) => ({ id: a.id, filename: a.filename }));
      } catch {
        showToast('error', 'Failed to fetch all attachments for download');
        return;
      }
    } else {
      const ids = Array.from(selected);
      attsToDownload = ids.map(id => {
        const att = attachments.find(a => a.id === id);
        return { id, filename: att?.filename ?? `file_${id}` };
      });
    }

    for (const att of attsToDownload) {
      try {
        const res = await apiFetch(`${API_BASE}/attachment/${att.id}/`);
        if (!res.ok) continue;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = att.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 300));
      } catch {
        showToast('error', `Failed to download ${att.filename}`);
      }
    }
    showToast('success', `${attsToDownload.length} file${attsToDownload.length > 1 ? 's' : ''} downloaded`);
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectAllPages) {
      setSelectAllPages(false);
      setSelected(new Set([id]));
      return;
    }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selectAllPages) {
      setSelectAllPages(false);
      setSelected(new Set());
    } else {
      setSelectAllPages(true);
      setSelected(new Set(attachments.map(a => a.id)));
    }
  };

  // ── Attach modal ───────────────────────────────────────────
  const openLinkModal = (ids: number[]) => {
    let currentGlobal = false;
    let currentCampaigns: number[] = [];
    if (ids.length === 1) {
      const att = attachments.find(a => a.id === ids[0]);
      if (att) {
        currentGlobal = att.linked_global;
        currentCampaigns = att.linked_campaigns.map(c => c.id);
      }
    }
    setLinkGlobal(currentGlobal);
    setLinkCampaigns(new Set(currentCampaigns));
    setCampaignSearch('');
    setLinkModal({ open: true, attachmentIds: ids, currentGlobal, currentCampaigns });
  };

  const saveLinkModal = async () => {
    setLinkSaving(true);
    const attIds = linkModal.attachmentIds;
    const isBulk = attIds.length > 1;

    try {
      for (const attId of attIds) {
        if (globalSettingsId) {
          if (isBulk) {
            const curRes = await apiFetch(`${API_BASE}/global-settings/${globalSettingsId}/attachments/`);
            const curData = curRes.ok ? await curRes.json() : { attachments: [] };
            const curIds: number[] = (curData.attachments ?? []).map((x: any) => x.id);
            const newIds = linkGlobal
              ? Array.from(new Set([...curIds, attId]))
              : curIds.filter((id: number) => id !== attId);
            await apiFetch(`${API_BASE}/global-settings/${globalSettingsId}/attachments/`, {
              method: 'PUT',
              body: JSON.stringify(newIds),
            });
          } else {
            const curRes = await apiFetch(`${API_BASE}/global-settings/${globalSettingsId}/attachments/`);
            const curData = curRes.ok ? await curRes.json() : { attachments: [] };
            const curIds: number[] = (curData.attachments ?? []).map((x: any) => x.id).filter((id: number) => id !== attId);
            const newIds = linkGlobal ? [...curIds, attId] : curIds;
            await apiFetch(`${API_BASE}/global-settings/${globalSettingsId}/attachments/`, {
              method: 'PUT',
              body: JSON.stringify(newIds),
            });
          }
        }

        for (const camp of campaigns) {
          if (!camp.preference_id) continue;
          const shouldLink = linkCampaigns.has(camp.id);
          const curRes = await apiFetch(`${API_BASE}/campaign-preference/${camp.preference_id}/attachments/`);
          const curData = curRes.ok ? await curRes.json() : { attachments: [] };
          const curIds: number[] = (curData.attachments ?? []).map((x: any) => x.id).filter((id: number) => id !== attId);
          const newIds = shouldLink ? [...curIds, attId] : curIds;
          await apiFetch(`${API_BASE}/campaign-preference/${camp.preference_id}/attachments/`, {
            method: 'PUT',
            body: JSON.stringify(newIds),
          });
        }
      }

      showToast('success', isBulk
        ? `Attachments updated for ${attIds.length} files`
        : 'Attachments updated successfully'
      );
      setLinkModal(p => ({ ...p, open: false }));
      setSelected(new Set());
      loadAll(currentPage, pageSize, attachmentSearch, buildFilterParams());
    } catch {
      showToast('error', 'Failed to update attachments');
    } finally {
      setLinkSaving(false);
    }
  };

  // ── Visible attachments (server already filtered/sorted/paginated) ─
  const visibleAttachments = attachments;

  const totalPages = Math.ceil(totalAttachments / pageSize);

  const filteredCampaignsForModal = campaigns
    .filter(c => c.name.toLowerCase().includes(campaignSearch.toLowerCase()))
    .sort((a, b) => {
      const aLinked = linkCampaigns.has(a.id) ? 0 : 1;
      const bLinked = linkCampaigns.has(b.id) ? 0 : 1;
      if (aLinked !== bLinked) return aLinked - bLinked;
      return a.name.localeCompare(b.name);
    });

  // ── Derived selection counts ────────────────────────────────
  const effectiveSelectedCount = selectAllPages ? totalAttachments : selected.size;
  const allCurrentPageSelected = visibleAttachments.length > 0 &&
    visibleAttachments.every(a => selected.has(a.id));
  const showBulkBar = selected.size > 0 || selectAllPages;

  // ── Active filter count for display ───────────────────────
  const activeFilterCount = activeFilters.size;
  const activeCampaignFilterIds = Array.from(activeFilters).filter((f): f is number => typeof f === 'number');

  // ── Pagination helper ────────────────────────────────────────
  const renderPageNumbers = () => {
    const pages: React.ReactNode[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
      pages.push(<PaginationButton key={1} theme={theme} onClick={() => setCurrentPage(1)}>1</PaginationButton>);
      if (start > 2) pages.push(<PaginationInfo key="e1" theme={theme}>...</PaginationInfo>);
    }

    for (let i = start; i <= end; i++) {
      pages.push(
        <PaginationButton key={i} theme={theme} $isActive={currentPage === i} onClick={() => setCurrentPage(i)}>
          {i}
        </PaginationButton>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push(<PaginationInfo key="e2" theme={theme}>...</PaginationInfo>);
      pages.push(
        <PaginationButton key={totalPages} theme={theme} onClick={() => setCurrentPage(totalPages)}>
          {totalPages}
        </PaginationButton>
      );
    }

    return pages;
  };

  const rangeStart = ((currentPage - 1) * pageSize) + 1;
  const rangeEnd   = Math.min(currentPage * pageSize, totalAttachments);

  // ── Shared toolbar label style ─────────────────────────────
  const toolbarLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    opacity: 0.45,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginRight: '0.25rem',
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <PageContainer theme={theme}>

      {/* Toast */}
      <ToastContainer $isVisible={toast.visible}>
        {toast.visible && (
          <ToastItem theme={theme} $type={toast.type}>
            <ToastMsg theme={theme}>{toast.message}</ToastMsg>
            <IconButton theme={theme} $size="sm" onClick={() => setToast(p => ({ ...p, visible: false }))}>
              <XIcon />
            </IconButton>
          </ToastItem>
        )}
      </ToastContainer>

      {/* Confirm dialog */}
      <ConfirmOverlay $isOpen={confirm.open} onClick={() => setConfirm(p => ({ ...p, open: false }))}>
        <ConfirmBox theme={theme} onClick={e => e.stopPropagation()}>
          <ConfirmHeader>
            <ConfirmIconWrap theme={theme}><AlertCircleIcon /></ConfirmIconWrap>
            <ConfirmContent>
              <ConfirmTitle theme={theme}>{confirm.title}</ConfirmTitle>
              <ConfirmMessage theme={theme}>{confirm.message}</ConfirmMessage>
            </ConfirmContent>
          </ConfirmHeader>
          <ConfirmActions>
            <CancelButton theme={theme} onClick={() => setConfirm(p => ({ ...p, open: false }))}>Cancel</CancelButton>
            <DangerButton theme={theme} onClick={() => {
              confirm.onConfirm();
              setConfirm(p => ({ ...p, open: false }));
            }}>
              <TrashIcon /> Delete
            </DangerButton>
          </ConfirmActions>
        </ConfirmBox>
      </ConfirmOverlay>

      {/* Rename modal */}
      <ModalOverlay $isOpen={renameModal.open} onClick={() => !renaming && setRenameModal({ ...renameModal, open: false })}>
        <ModalContent theme={theme} onClick={e => e.stopPropagation()}>
          <ModalHeader theme={theme}>
            <ModalTitle>Rename Attachment</ModalTitle>
            <CloseButton theme={theme} onClick={() => !renaming && setRenameModal({ ...renameModal, open: false })}>
              <XIcon />
            </CloseButton>
          </ModalHeader>
          <ModalBody>
            <SectionLabel>Current name</SectionLabel>
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: theme.colors.base[200], borderRadius: theme.radius.field }}>
              {renameModal.currentName}
            </div>
            <SectionLabel>New name (without extension)</SectionLabel>
            <EditInput
              theme={theme}
              type="text"
              value={renameModal.newName}
              onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
              placeholder="Enter new filename"
              disabled={renaming}
              autoFocus
            />
            <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.5rem' }}>
              The file extension will be preserved automatically.
            </div>
          </ModalBody>
          <ModalFooter theme={theme}>
            <CancelButton theme={theme} onClick={() => setRenameModal({ ...renameModal, open: false })} disabled={renaming}>Cancel</CancelButton>
            <PrimaryButton theme={theme} onClick={handleRename} disabled={renaming || !renameModal.newName.trim()}>
              <EditIcon />
              {renaming ? 'Renaming...' : 'Rename'}
            </PrimaryButton>
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>

      {/* Attach modal */}
      <ModalOverlay $isOpen={linkModal.open} onClick={() => setLinkModal(p => ({ ...p, open: false }))}>
        <ModalContent theme={theme} onClick={e => e.stopPropagation()}>
          <ModalHeader theme={theme}>
            <ModalTitle>
              {linkModal.attachmentIds.length === 1
                ? `Attach "${attachments.find(a => a.id === linkModal.attachmentIds[0])?.filename}"`
                : `Attach ${linkModal.attachmentIds.length} Files`}
            </ModalTitle>
            <CloseButton theme={theme} onClick={() => setLinkModal(p => ({ ...p, open: false }))}>
              <XIcon />
            </CloseButton>
          </ModalHeader>
          <ModalBody>
            <SectionLabel>Global Settings</SectionLabel>
            <LinkRow theme={theme} $selected={linkGlobal} onClick={() => setLinkGlobal(p => !p)}>
              <Checkbox theme={theme} $checked={linkGlobal} />
              <GlobeIcon />
              <LinkRowName style={{ fontWeight: 600 }}>Global Settings</LinkRowName>
              {linkGlobal && <LinkBadge theme={theme} $type="global">Attached</LinkBadge>}
            </LinkRow>

            <SectionLabel style={{ marginTop: '1.25rem' }}>
              Campaigns
              {campaigns.length > 0 && (
                <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  ({linkCampaigns.size} selected)
                </span>
              )}
            </SectionLabel>

            <SearchWrapper>
              <SearchIconWrap theme={theme}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </SearchIconWrap>
              <SearchInput
                theme={theme}
                placeholder="Search campaigns…"
                value={campaignSearch}
                onChange={e => setCampaignSearch(e.target.value)}
              />
              {campaignSearch && (
                <SearchClearBtn theme={theme} onClick={() => setCampaignSearch('')} title="Clear search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </SearchClearBtn>
              )}
            </SearchWrapper>

            <div style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '4px', scrollbarWidth: 'thin' }}>
              {filteredCampaignsForModal.length === 0 ? (
                <div style={{
                  padding: '1.5rem', opacity: 0.5, textAlign: 'center', fontSize: '0.875rem',
                  border: `1px dashed ${theme.colors.base[300]}`, borderRadius: theme.radius.field,
                }}>
                  {campaignSearch ? `No campaigns match "${campaignSearch}"` : 'No campaigns found'}
                </div>
              ) : (
                filteredCampaignsForModal.map(camp => (
                  <LinkRow
                    key={camp.id}
                    theme={theme}
                    $selected={linkCampaigns.has(camp.id)}
                    onClick={() => {
                      const next = new Set(linkCampaigns);
                      if (next.has(camp.id)) next.delete(camp.id); else next.add(camp.id);
                      setLinkCampaigns(next);
                    }}
                  >
                    <Checkbox theme={theme} $checked={linkCampaigns.has(camp.id)} />
                    <FolderIcon />
                    <LinkRowName>{camp.name}</LinkRowName>
                    {camp.preference_id === null && (
                      <span style={{ fontSize: '0.7rem', opacity: 0.45 }}>No preferences</span>
                    )}
                    {linkCampaigns.has(camp.id) && (
                      <LinkBadge theme={theme} $type="campaign" $campaignId={camp.id}>Attached</LinkBadge>
                    )}
                  </LinkRow>
                ))
              )}
            </div>
          </ModalBody>
          <ModalFooter theme={theme}>
            <PrimaryButton
              theme={theme}
              onClick={saveLinkModal}
              disabled={linkSaving || (
                linkGlobal === linkModal.currentGlobal &&
                linkCampaigns.size === linkModal.currentCampaigns.length &&
                linkModal.currentCampaigns.every(id => linkCampaigns.has(id))
              )}
            >
              <LinkChainIcon />
              {linkSaving ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>

      {/* Upload modal */}
      <ModalOverlay $isOpen={uploadModal} onClick={() => !uploading && setUploadModal(false)}>
        <ModalContent theme={theme} onClick={e => e.stopPropagation()}>
          <ModalHeader theme={theme}>
            <ModalTitle>Upload Files</ModalTitle>
            <CloseButton theme={theme} onClick={() => !uploading && setUploadModal(false)}>
              <XIcon />
            </CloseButton>
          </ModalHeader>
          <ModalBody>
            <UploadZone
              theme={theme}
              $isDragging={isDragging}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}
            >
              <UploadCloudIcon />
              <UploadText>{uploading ? `Uploading… ${uploadProgress}%` : 'Click or drag files to upload'}</UploadText>
              <UploadSubtext>PDF, DOC, DOCX, TXT, CSV — max 5 MB each</UploadSubtext>
              {uploading && (
                <ProgressBar theme={theme}>
                  <ProgressFill theme={theme} $pct={uploadProgress} />
                </ProgressBar>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }}
                disabled={uploading}
              />
            </UploadZone>
          </ModalBody>
        </ModalContent>
      </ModalOverlay>

      <MainContent>

        {/* Header */}
        <HeaderCard theme={theme}>
          <HeaderRow>
            <BackButton theme={theme} onClick={() => navigate('/campaigns')} title="Back to campaigns">
              <ArrowLeftIcon />
            </BackButton>
            <HeaderCenter>
              <HeaderTitle>Attachments</HeaderTitle>
              <HeaderSubtitle>Upload files and attach them to global settings or specific campaigns</HeaderSubtitle>
            </HeaderCenter>
          </HeaderRow>
        </HeaderCard>

        {/* Files list */}
        <ListSection theme={theme}>

          <SectionHeader theme={theme}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {attachments.length > 0 && (
                <Checkbox
                  theme={theme}
                  $checked={selectAllPages || allCurrentPageSelected}
                  onClick={toggleSelectAll}
                  title={selectAllPages ? 'Deselect all' : allCurrentPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                />
              )}
              <SectionTitle>
                <PaperclipIcon />
                All Files
                <CountBadge theme={theme}>{totalAttachments}</CountBadge>
                {(selected.size > 0 || selectAllPages) && (
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
            <AddButton theme={theme} onClick={() => setUploadModal(true)} title="Upload files">+</AddButton>
          </SectionHeader>

          {/* Search bar */}
          <SearchWrapper>
            <SearchIconWrap theme={theme}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </SearchIconWrap>
            <SearchInput
              theme={theme}
              type="text"
              placeholder="Search files…"
              value={attachmentSearch}
              onChange={e => setAttachmentSearch(e.target.value)}
            />
            {attachmentSearch && (
              <SearchClearBtn theme={theme} onClick={() => setAttachmentSearch('')} title="Clear search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </SearchClearBtn>
            )}
          </SearchWrapper>

          {/* ── Sort bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <span style={toolbarLabelStyle} title="Sort">
              <SortIcon />
            </span>
            {([
              { key: 'name',      label: 'Alphabetical' },
              { key: 'size',      label: 'Size'      },
              { key: 'campaigns', label: 'Campaigns' },
            ] as { key: AttachmentSortKey; label: string }[]).map(({ key, label }) => {
              const active = sortKey === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSort(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.3rem 0.7rem',
                    borderRadius: '999px',
                    fontSize: '0.8125rem', fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    border: `1px solid ${active ? theme.colors.primary.main : theme.colors.base[300]}`,
                    background: active ? theme.colors.primary.main : theme.colors.base[400],
                    color: active ? theme.colors.primary.content : theme.colors.base.content,
                    transition: 'all 0.15s',
                  }}
                >
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
              <button
                onClick={() => { setSortKey(null); setSortDir('asc'); setCurrentPage(1); }}
                style={{
                  padding: '0.3rem 0.6rem', borderRadius: '999px',
                  fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                  border: `1px solid ${theme.colors.base[300]}`,
                  background: theme.colors.base[400], color: theme.colors.base.content, opacity: 0.55,
                  transition: 'all 0.15s',
                }}
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* ── Filter bar ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <span style={toolbarLabelStyle} title="Filter">
              <FilterIcon />
            </span>

            <FilterChip
              theme={theme}
              $active={activeFilters.has('global')}
              onClick={() => toggleFilter('global')}
            >
              <GlobeIcon /> Global
            </FilterChip>

            {campaigns.length > 0 && (
              <DropdownWrap ref={dropdownRef}>
                <DropdownTrigger
                  theme={theme}
                  $active={activeCampaignFilterIds.length > 0}
                  onClick={() => { setCampaignDropdownOpen(p => !p); setCampaignDropdownSearch(''); }}
                >
                  <FolderIcon />
                  Campaigns
                  {activeCampaignFilterIds.length > 0 && (
                    <DropdownBadge theme={theme}>{activeCampaignFilterIds.length}</DropdownBadge>
                  )}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                       strokeLinecap="round" strokeLinejoin="round" width="11" height="11"
                       style={{ opacity: 0.7, marginLeft: '1px' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </DropdownTrigger>

                {campaignDropdownOpen && (
                  <DropdownMenu theme={theme}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      <DropdownSearch
                        theme={theme}
                        placeholder="Search campaigns…"
                        value={campaignDropdownSearch}
                        onChange={e => setCampaignDropdownSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{ flex: 1 }}
                      />
                      {activeCampaignFilterIds.length > 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setActiveFilters(prev => { const next = new Set(prev); activeCampaignFilterIds.forEach(id => next.delete(id)); return next; }); setCampaignFilterMode('any'); setCurrentPage(1); setCampaignDropdownOpen(false); }}
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
                    {campaigns
                      .filter(c => c.name.toLowerCase().includes(campaignDropdownSearch.toLowerCase()))
                      .map(c => (
                        <DropdownItem
                          key={c.id}
                          theme={theme}
                          $checked={activeFilters.has(c.id)}
                          onClick={() => toggleFilter(c.id)}
                        >
                          <Checkbox theme={theme} $checked={activeFilters.has(c.id)} />
                          <FolderIcon />
                          {c.name}
                        </DropdownItem>
                      ))
                    }
                    {campaigns.filter(c => c.name.toLowerCase().includes(campaignDropdownSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '0.75rem', textAlign: 'center', opacity: 0.5, fontSize: '0.8125rem' }}>
                        No campaigns match
                      </div>
                    )}
                  </DropdownMenu>
                )}
              </DropdownWrap>
            )}

            {/* ANY / ALL toggle — only shown when 2+ campaigns selected */}
            {activeCampaignFilterIds.length >= 2 && (
              <div style={{
                display: 'flex', alignItems: 'center',
                border: `1px solid ${theme.colors.base[300]}`,
                borderRadius: '999px', overflow: 'hidden',
                marginLeft: '0.25rem', flexShrink: 0,
              }}>
                {(['any', 'all'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => { setCampaignFilterMode(mode); setCurrentPage(1); }}
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
                    title={mode === 'any' ? 'Show attachments linked to ANY selected campaign (OR)' : 'Show attachments linked to ALL selected campaigns (AND)'}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bulk actions bar */}
          {showBulkBar && (
            <BulkActionsBar theme={theme} $visible={true}>
              <BulkLeft>
                <CountBadge theme={theme}>{effectiveSelectedCount}</CountBadge>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  of {selectAllPages ? totalAttachments : visibleAttachments.length} selected
                </span>
              </BulkLeft>
              <BulkRight>
                <IconButton theme={theme} $size="md" onClick={bulkDownload} title="Download selected">
                  <DownloadIcon />
                </IconButton>
                <IconButton
                  theme={theme}
                  $size="md"
                  onClick={() => openLinkModal(Array.from(selected))}
                  title="Attach to campaigns"
                  disabled={selectAllPages}
                >
                  <LinkChainIcon />
                </IconButton>
                <IconButton theme={theme} $variant="danger" $size="md"
                  onClick={() => confirmDelete(Array.from(selected))} title="Delete selected">
                  <TrashIcon />
                </IconButton>
              </BulkRight>
            </BulkActionsBar>
          )}

          {/* List */}
          {loading ? (
            <EmptyState>
              <EmptyTitle>Loading…</EmptyTitle>
            </EmptyState>
          ) : visibleAttachments.length === 0 ? (
            <EmptyState>
              <EmptyIcon><PaperclipIcon /></EmptyIcon>
              <EmptyTitle>{attachmentSearch || activeFilterCount > 0 ? 'No attachments match' : 'No attachments yet'}</EmptyTitle>
              <EmptySubtitle>{attachmentSearch || activeFilterCount > 0 ? 'Try a different search term or filter' : 'Use the + button to upload files'}</EmptySubtitle>
            </EmptyState>
          ) : (
            visibleAttachments.map(att => {
              const ext = getExt(att.filename);
              const isSelected = selectAllPages || selected.has(att.id);
              return (
                <AttachmentCard
                  key={att.id}
                  theme={theme}
                  $selected={isSelected}
                  onClick={e => toggleSelect(att.id, e)}
                >
                  <AttachmentRow>
                    <Checkbox
                      theme={theme}
                      $checked={isSelected}
                      onClick={e => toggleSelect(att.id, e)}
                    />

                    <FileIconWrap theme={theme} $ext={ext}>{ext || '?'}</FileIconWrap>

                    <FileInfo>
                      <FileName>{att.filename}</FileName>
                      <FileMeta>
                        <FileMetaItem>{formatBytes(att.file_size)}</FileMetaItem>
                        {att.created_at && <FileMetaItem>{formatDate(att.created_at)}</FileMetaItem>}
                      </FileMeta>
                    </FileInfo>

                    <LinkBadges>
                      {att.linked_global && <LinkBadge theme={theme} $type="global">Global</LinkBadge>}
                      {att.linked_campaigns.map(c => (
                        <LinkBadge key={c.id} theme={theme} $type="campaign" $campaignId={c.id}>{c.name}</LinkBadge>
                      ))}
                    </LinkBadges>

                    <ActionButtons onClick={e => e.stopPropagation()}>
                      <IconButton theme={theme} $size="md" onClick={() => setDetailAttachment(att)} title="View details" disabled={isSelected}>
                        <EyeIcon />
                      </IconButton>
                      <IconButton theme={theme} $size="md" onClick={() => downloadAttachment(att)} title="Download" disabled={isSelected}>
                        <DownloadIcon />
                      </IconButton>
                      <IconButton theme={theme} $size="md" onClick={() => openRenameModal(att)} title="Rename" disabled={isSelected}>
                        <EditIcon />
                      </IconButton>
                      <IconButton theme={theme} $size="md" onClick={() => openLinkModal([att.id])} title="Manage attachments" disabled={isSelected}>
                        <LinkChainIcon />
                      </IconButton>
                      <IconButton theme={theme} $variant="danger" $size="md" onClick={() => confirmDelete([att.id])} title="Delete" disabled={isSelected}>
                        <TrashIcon />
                      </IconButton>
                    </ActionButtons>
                  </AttachmentRow>
                </AttachmentCard>
              );
            })
          )}

          {/* Pagination */}
          {totalAttachments > 0 && (
            <PaginationContainer theme={theme}>
              <PaginationButton theme={theme} onClick={() => setCurrentPage(1)} disabled={currentPage === 1} title="First page">««</PaginationButton>
              <PaginationButton theme={theme} onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} title="Previous page">«</PaginationButton>
              {renderPageNumbers()}
              <PaginationButton theme={theme} onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} title="Next page">»</PaginationButton>
              <PaginationButton theme={theme} onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} title="Last page">»»</PaginationButton>
              <PaginationInfo theme={theme}>
                {totalAttachments > 0 ? `${rangeStart}–${rangeEnd} of ${totalAttachments}` : '0'}
              </PaginationInfo>
              <PageSizeSelect
                theme={theme}
                value={pageSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPageSize(val);
                  localStorage.setItem('attachments_page_size', String(val));
                  setCurrentPage(1);
                }}
              >
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

      {/* Attachment detail modal */}
      {detailAttachment && (
        <ModalOverlay $isOpen={true} onClick={() => setDetailAttachment(null)}>
          <ModalContent theme={theme} onClick={e => e.stopPropagation()}>
            <ModalHeader theme={theme}>
              <ModalTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <EyeIcon /> Attachment Details
              </ModalTitle>
              <CloseButton theme={theme} onClick={() => setDetailAttachment(null)}>
                <XIcon />
              </CloseButton>
            </ModalHeader>
            <ModalBody>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em', wordBreak: 'break-word' }}>
                  {detailAttachment.filename}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'File Size', value: formatBytes(detailAttachment.file_size) },
                  { label: 'Uploaded',  value: detailAttachment.created_at ? formatDate(detailAttachment.created_at) : null },
                ].filter(f => f.value).map(field => (
                  <div key={field.label}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.3rem' }}>
                      {field.label}
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500, padding: '0.5rem 0.75rem', background: theme.colors.base[200], borderRadius: theme.radius.field }}>
                      {field.value}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.45, marginBottom: '0.75rem' }}>
                Linked To
              </div>
              {!detailAttachment.linked_global && detailAttachment.linked_campaigns.length === 0 ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', border: `1px dashed ${theme.colors.base[300]}`, borderRadius: theme.radius.field, fontSize: '0.875rem', opacity: 0.45 }}>
                  Not linked to any campaign or global settings
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {detailAttachment.linked_global && <LinkBadge theme={theme} $type="global">Global</LinkBadge>}
                  {detailAttachment.linked_campaigns.map(c => (
                    <LinkBadge key={c.id} theme={theme} $type="campaign" $campaignId={c.id}>{c.name}</LinkBadge>
                  ))}
                </div>
              )}
            </ModalBody>
            <ModalFooter theme={theme}>
              <PrimaryButton theme={theme} onClick={() => { const att = detailAttachment; setDetailAttachment(null); openRenameModal(att); }}>
                <EditIcon />
              </PrimaryButton>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}

    </PageContainer>
  );
};

export default Attachments;