// ============================================================
// Campaigns.tsx - UPDATED: Server-side sorting across all pages
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../theme/styles';
import { DashboardContainer, MainContent } from './campaigns.styles';
import { Toast, ConfirmDialog } from './ToastAndConfirm';
import OverallStatsCard from './OverallStatsCard';
import CampaignsList from './CampaignsList';
import CreateCampaignModal from './CreateCampaignModal';
import type { OverallStats, ToastState, ConfirmDialogState, CampaignsProps } from './campaigns.types';
import { apiFetch, useAuth } from '../../App';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost';
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT;
const API_BASE = BACKEND_PORT ? `${BACKEND_URL}:${BACKEND_PORT}` : BACKEND_URL;

const Campaigns: React.FC<CampaignsProps> = ({ onCampaignClick }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { authReady } = useAuth();

  const [accountStats, setAccountStats] = useState<Omit<OverallStats, 'campaigns'> | null>(null);

  const [campaigns, setCampaigns] = useState<OverallStats['campaigns']>([]);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const stored = localStorage.getItem('campaigns_page_size');
    return stored ? Number(stored) : 10;
  });

  const [searchTerm, setSearchTerm] = useState('');

  // ── Sort ───────────────────────────────────────────────────
  type CampaignSortKey = 'name' | 'companies' | 'sent' | 'read' | 'scheduled';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<CampaignSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Handle sort change: reset to page 1 and fetch with new sort ──
  const handleSort = (key: CampaignSortKey) => {
    let newSortDir: SortDir = 'asc';
    let newSortKey: CampaignSortKey | null = key;

    if (sortKey === key) {
      // Toggle direction if same key
      newSortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      // New key, reset to asc
      newSortDir = 'asc';
      newSortKey = key;
    }

    setSortKey(newSortKey);
    setSortDir(newSortDir);
    setCurrentPage(1); // Reset to first page
    setSelectedCampaigns(new Set());
    setSelectAllPages(false);
    // Note: fetchCampaignPage will be triggered by useEffect watching sortKey/sortDir
  };

  const handleSortClear = () => {
    setSortKey(null);
    setSortDir('asc');
    setCurrentPage(1);
    setSelectedCampaigns(new Set());
    setSelectAllPages(false);
  };

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ── Selection — two-tier: page IDs + all-pages flag ────────
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<number>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    isVisible: false, type: 'info', title: '', message: '',
  });

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false, title: '', message: '', onConfirm: () => {},
  });


  const showToast = (type: ToastState['type'], title: string, message: string) => {
    setToast({ isVisible: true, type, title, message });
    setTimeout(() => setToast((prev) => ({ ...prev, isVisible: false })), 5000);
  };

  const dismissToast = () => setToast((prev) => ({ ...prev, isVisible: false }));

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; variant?: ConfirmDialogState['variant'] }
  ) => {
    setConfirmDialog({
      isOpen: true, title, message, onConfirm,
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      variant: options?.variant || 'default',
    });
  };

  const handleConfirmClose = () => setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  const handleConfirmAction = () => { confirmDialog.onConfirm(); handleConfirmClose(); };

  const totalPages = Math.max(1, Math.ceil(totalCampaigns / pageSize));

  // Reset selection when page/size changes
  useEffect(() => {
    setSelectedCampaigns(new Set());
    setSelectAllPages(false);
  }, [currentPage, pageSize, searchTerm]);

  // ── Fetch account stats ────────────────────────────────────
  useEffect(() => {
    if (!authReady) return;
    const fetchAccountStats = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/stats/`);
        if (!res.ok) return;
        const data = await res.json();

        setAccountStats({
          total_campaigns:          data.total_campaigns          ?? 0,
          total_companies:          data.total_companies          ?? 0,
          total_campaign_companies: data.total_campaign_companies ?? 0,
          total_attachments:        data.total_attachments        ?? 0,
          total_categories:         data.total_categories         ?? 0,
          total_sent:               data.emails?.sent             ?? 0,
          total_read:               data.emails?.read             ?? 0,
          total_failed:             data.emails?.failed           ?? 0,
          total_draft:              data.emails?.draft            ?? 0,
          total_scheduled:          data.emails?.scheduled        ?? 0,
          overall_read_rate:        data.overall_read_rate        ?? 0,
        });
      } catch { /* silently ignore */ }
    };
    fetchAccountStats();
  }, [refreshTrigger, authReady]);

  // ── Fetch one page of campaigns with sort params ────────────
  const fetchCampaignPage = useCallback(
    async (page: number, size: number, search = '', sortKey?: CampaignSortKey | null, sortDir?: SortDir) => {
      setLoading(true);
      try {
        let url = `${API_BASE}/campaign/?page=${page}&size=${size}`;
        if (search.trim()) {
          url += `&search=${encodeURIComponent(search.trim())}`;
        }
        if (sortKey) {
          url += `&sort_by=${sortKey}&sort_order=${sortDir || 'asc'}`;
        }

        const res = await apiFetch(url);
        if (!res.ok) throw new Error('Failed to fetch campaigns');
        const data = await res.json();

        const pageItems: Array<{ id: number; name: string; created_at: string }> =
          data.campaigns ?? [];
        setTotalCampaigns(data.total ?? 0);

        if (pageItems.length === 0) { setCampaigns([]); return; }

        // Fetch all campaign stats in one request
        const ids = pageItems.map(c => c.id).join(',');
        const statsRes = await apiFetch(`${API_BASE}/stats/?campaign_ids=${ids}`);
        const statsData = statsRes.ok ? await statsRes.json() : { campaigns: [] };
        const statsMap = new Map((statsData.campaigns ?? []).map((s: any) => [s.campaign_id, s]));

        const merged = pageItems.map((c) => {
          const detail: any = statsMap.get(c.id);
          return {
            campaign_id:     c.id,
            campaign_name:   c.name,
            companies_count: detail?.companies_count ?? 0,
            created_at:      c.created_at,
            sent:            detail?.emails?.sent      ?? 0,
            read:            detail?.emails?.read      ?? 0,
            failed:          detail?.emails?.failed    ?? 0,
            draft:           detail?.emails?.draft     ?? 0,
            scheduled:       detail?.emails?.scheduled ?? 0,
            read_rate:       detail?.read_rate         ?? 0,
          };
        });

        setCampaigns(merged);
      } catch (err) {
        showToast('error', 'Load Failed', err instanceof Error ? err.message : 'Failed to load campaigns');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Debounced search triggers fresh server fetch ───────────
  const campaignSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!authReady) return;
    if (campaignSearchDebounce.current) clearTimeout(campaignSearchDebounce.current);
    campaignSearchDebounce.current = setTimeout(() => {
      setCurrentPage(1);
      fetchCampaignPage(1, pageSize, searchTerm, sortKey, sortDir);
    }, 350);
    return () => { if (campaignSearchDebounce.current) clearTimeout(campaignSearchDebounce.current); };
  }, [searchTerm, pageSize, sortKey, sortDir, fetchCampaignPage, authReady]);

  // Fetch when page, size, or sort changes
  useEffect(() => {
    if (!authReady) return;
    fetchCampaignPage(currentPage, pageSize, searchTerm, sortKey, sortDir);
  }, [currentPage, pageSize, refreshTrigger, sortKey, sortDir, fetchCampaignPage, searchTerm, authReady]);

  // No client-side sorting — server handles all sorting
  const filteredCampaigns = campaigns;

  // ── Pagination ─────────────────────────────────────────────
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedCampaigns(new Set());
    setSelectAllPages(false);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    localStorage.setItem('campaigns_page_size', String(size));
    setCurrentPage(1);
    setSelectedCampaigns(new Set());
    setSelectAllPages(false);
  };

  // ── Campaign click ─────────────────────────────────────────
  const handleCampaignClick = (campaignId: number) => {
    if (onCampaignClick) onCampaignClick(campaignId);
    else navigate(`/campaign/${campaignId}`);
  };

  // ── Create ─────────────────────────────────────────────────
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    setLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/campaign/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ name: newCampaignName.trim() }]),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to create campaign');
      }
      showToast('success', 'Created', 'Campaign created successfully');
      setNewCampaignName('');
      setShowCreateDialog(false);
      setCurrentPage(1);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      showToast('error', 'Create Failed', err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowCreateDialog(false);
    setNewCampaignName('');
  };

  // ── Edit/Rename ────────────────────────────────────────────
  const handleEditCampaign = async (campaignId: number, newName: string) => {

    try {
      const response = await apiFetch(`${API_BASE}/campaign/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ id: campaignId, name: newName.trim() }]),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to rename campaign');
      }
      showToast('success', 'Renamed', 'Campaign renamed successfully');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      showToast('error', 'Rename Failed', err instanceof Error ? err.message : 'Failed to rename campaign');
    }
  };

  // ── Selection ──────────────────────────────────────────────
  const handleSelectAll = () => {
    if (selectAllPages) {
      setSelectAllPages(false);
      setSelectedCampaigns(new Set());
    } else {
      setSelectAllPages(true);
      setSelectedCampaigns(new Set(filteredCampaigns.map((c) => c.campaign_id)));
    }
  };

  const handleSelectCampaign = (campaignId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectAllPages) {
      setSelectAllPages(false);
      setSelectedCampaigns(new Set([campaignId]));
      return;
    }
    const next = new Set(selectedCampaigns);
    if (next.has(campaignId)) next.delete(campaignId); else next.add(campaignId);
    setSelectedCampaigns(next);
  };

  // Fetch all campaign IDs across all pages
  const fetchAllCampaignIds = async (): Promise<number[]> => {
    try {
      let url = `${API_BASE}/campaign/?page=1&size=${totalCampaigns}`;
      if (sortKey) {
        url += `&sort_by=${sortKey}&sort_order=${sortDir}`;
      }
      const res = await apiFetch(url, {
        
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.campaigns ?? []).map((c: any) => c.id);
    } catch { return []; }
  };

  // ── Bulk delete ────────────────────────────────────────────
  const handleBulkDelete = () => {
    const count = selectAllPages ? totalCampaigns : selectedCampaigns.size;
    if (count === 0) return;
    showConfirm(
      'Delete Campaigns',
      `Are you sure you want to delete ${count} campaign${count > 1 ? 's' : ''}? This action cannot be undone.`,
      async () => {
        setLoading(true);
        try {
          let ids: number[];
          if (selectAllPages) {
            ids = await fetchAllCampaignIds();
          } else {
            ids = Array.from(selectedCampaigns);
          }
          const response = await apiFetch(`${API_BASE}/campaign/?ids=${ids.join(',')}`, {
            method: 'DELETE',
          });
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to delete campaigns');
          }
          showToast('success', 'Deleted', 'Campaigns deleted successfully');
          setSelectedCampaigns(new Set());
          setSelectAllPages(false);
          const newTotal = totalCampaigns - ids.length;
          const newTotalPages = Math.max(1, Math.ceil(newTotal / pageSize));
          setCurrentPage((prev) => Math.min(prev, newTotalPages));
          setRefreshTrigger((prev) => prev + 1);
        } catch (err) {
          showToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Failed to delete campaigns');
        } finally {
          setLoading(false);
        }
      },
      { confirmText: 'Delete', variant: 'danger' }
    );
  };

  // ── Single delete ──────────────────────────────────────────
  const handleDeleteCampaign = (campaignId: number, campaignName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm(
      'Delete Campaign',
      `Are you sure you want to delete "${campaignName}"? This action cannot be undone.`,
      async () => {
        setLoading(true);
        try {
          const response = await apiFetch(`${API_BASE}/campaign/?ids=${campaignId}`, {
            method: 'DELETE',
          });
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to delete campaign');
          }
          showToast('success', 'Deleted', 'Campaign deleted successfully');
          const newTotal = totalCampaigns - 1;
          const newTotalPages = Math.max(1, Math.ceil(newTotal / pageSize));
          setCurrentPage((prev) => Math.min(prev, newTotalPages));
          setRefreshTrigger((prev) => prev + 1);
        } catch (err) {
          showToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Failed to delete campaign');
        } finally {
          setLoading(false);
        }
      },
      { confirmText: 'Delete', variant: 'danger' }
    );
  };

  const overallStats: OverallStats | null = accountStats
    ? { ...accountStats, campaigns: [] }
    : null;

  const effectiveSelectedCount = selectAllPages ? totalCampaigns : selectedCampaigns.size;

  return (
    <DashboardContainer theme={theme}>
      <Toast toast={toast} onDismiss={dismissToast} theme={theme} />
      <ConfirmDialog
        dialog={confirmDialog}
        onClose={handleConfirmClose}
        onConfirm={handleConfirmAction}
        theme={theme}
      />

      <MainContent>
        {overallStats && <OverallStatsCard stats={overallStats} theme={theme} />}

        <CampaignsList
          campaigns={filteredCampaigns}
          totalCampaigns={totalCampaigns}
          searchTerm={searchTerm}
          selectedCampaigns={selectedCampaigns}
          selectAllPages={selectAllPages}
          effectiveSelectedCount={effectiveSelectedCount}
          loading={loading}
          hasStats={accountStats !== null}
          theme={theme}
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onSortClear={handleSortClear}
          onSearchChange={setSearchTerm}
          onSelectAll={handleSelectAll}
          onSelectCampaign={handleSelectCampaign}
          onCampaignClick={handleCampaignClick}
          onDelete={handleDeleteCampaign}
          onEdit={handleEditCampaign}
          onBulkDelete={handleBulkDelete}
          onAddClick={() => setShowCreateDialog(true)}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </MainContent>

      <CreateCampaignModal
        isOpen={showCreateDialog}
        newCampaignName={newCampaignName}
        loading={loading}
        theme={theme}
        onNameChange={setNewCampaignName}
        onCreate={handleCreateCampaign}
        onClose={handleCloseModal}
      />
    </DashboardContainer>
  );
};

export default Campaigns;