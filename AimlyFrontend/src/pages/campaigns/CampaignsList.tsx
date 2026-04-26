// ============================================================
// CampaignsList.tsx - UPDATED: Server-side sorting only
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import {
  CampaignsSection, SectionHeader, SectionTitle, AddButton,
  SearchWrapper, SearchIconWrap, SearchClearBtn, SearchInput, BulkActionsBar, BulkActionsLeft, BulkActionsRight,
  Checkbox, CampaignCard, CampaignHeader, CampaignInfo, CampaignName,
  CampaignMeta, CampaignDate, StatsContainer, CampaignStatBox,
  CampaignStatValue, CampaignStatLabel, CampaignStatSubtext,
  ActionButtons, IconButton, EmptyState, EmptyIcon, EmptyTitle, EmptySubtitle,
  PaginationContainer, PaginationButton, PaginationInfo, PageSizeSelect,
  ModalOverlay, ModalContent, ModalHeader, ModalTitle, CloseButton,
  ModalBody, ModalFooter, FormGroup, Label, Input, Button,
} from './campaigns.styles.ts';
import { TrashIcon } from '../../theme/icons.tsx';

import type { CampaignStats } from './campaigns.types.ts';

// ── Mobile detection ────────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 640);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
};

// ── Dots menu styled components ─────────────────────────────
const DotsButton = styled.button<{ theme: any }>`
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; flex-shrink: 0;
  padding: 0; border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[200]};
  color: ${p => p.theme.colors.base.content};
  cursor: pointer; transition: all 0.15s;
  &:hover { background: ${p => p.theme.colors.base[300]}; }
  svg { width: 16px; height: 16px; }
`;

const DotsMenu = styled.div<{ theme: any }>`
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 200;
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  padding: 0.3rem; min-width: 160px;
`;

const DotsItem = styled.button<{ theme: any; $danger?: boolean }>`
  width: 100%; display: flex; align-items: center; gap: 0.6rem;
  padding: 0.55rem 0.75rem; border: none;
  border-radius: ${p => p.theme.radius.field};
  background: transparent;
  color: ${p => p.$danger ? p.theme.colors.error.main : p.theme.colors.base.content};
  font-size: 0.875rem; font-weight: 500; font-family: inherit;
  cursor: pointer; text-align: left; transition: background 0.12s;
  &:hover { background: ${p => p.theme.colors.base[400]}; }
  svg { width: 15px; height: 15px; flex-shrink: 0; }
`;

const DotsDivider = styled.div<{ theme: any }>`
  height: 1px; background: ${p => p.theme.colors.base[300]}; margin: 0.3rem 0;
`;

type CampaignSortKey = 'name' | 'companies' | 'sent' | 'read' | 'scheduled';
type SortDir = 'asc' | 'desc';

interface CampaignsListProps {
  campaigns: CampaignStats[];
  totalCampaigns: number;
  searchTerm: string;
  selectedCampaigns: Set<number>;
  selectAllPages: boolean;
  effectiveSelectedCount: number;
  loading: boolean;
  hasStats: boolean;
  theme: any;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  sortKey: CampaignSortKey | null;
  sortDir: SortDir;
  onSort: (key: CampaignSortKey) => void;
  onSortClear: () => void;
  onSearchChange: (value: string) => void;
  onSelectAll: () => void;
  onSelectCampaign: (id: number, e: React.MouseEvent) => void;
  onCampaignClick: (id: number) => void;
  onDelete: (id: number, name: string, e: React.MouseEvent) => void;
  onEdit: (id: number, newName: string) => Promise<void>;
  onBulkDelete: () => void;
  onAddClick: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const formatDate = (dateString: string): string | null => {
  if (!dateString) return null;
  try {
    const d = new Date(dateString.replace(' ', 'T'));
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return null; }
};

// ── Edit Campaign Modal ────────────────────────────────────
interface EditModalState {
  open: boolean;
  campaignId: number;
  currentName: string;
  newName: string;
}

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

// ── Sort icon (matches Companies) ──────────────────────────
const SortIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <line x1="3"  y1="6"  x2="21" y2="6"/>
    <line x1="3"  y1="12" x2="14" y2="12"/>
    <line x1="3"  y1="18" x2="8"  y2="18"/>
  </svg>
);

// ── Toolbar label style (matches Companies) ────────────────
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

// ── Unsaved changes dialog (edit modal) ───────────────────
const UnsavedOverlay = styled.div`
  position: fixed; inset: 0; z-index: 11000;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
`;
const UnsavedBox = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 1.5rem; max-width: 420px; width: 90%;
  box-shadow: 0 20px 40px rgba(0,0,0,0.4);
`;
const UnsavedActions = styled.div`display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;`;
const KeepBtn = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem; border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[200]}; color: ${p => p.theme.colors.base.content};
  border: 1px solid ${p => p.theme.colors.base[300]};
  font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: all 0.2s;
  &:hover { background: ${p => p.theme.colors.base[300]}; }
`;
const DiscardBtn = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem; border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.error.main}; color: ${p => p.theme.colors.error.content};
  border: none; font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: all 0.2s;
  &:hover { opacity: 0.9; }
`;

const CampaignsList: React.FC<CampaignsListProps> = ({
  campaigns, totalCampaigns, searchTerm, selectedCampaigns,
  selectAllPages, effectiveSelectedCount,
  loading, hasStats, theme,
  currentPage, pageSize, totalPages,
  sortKey, sortDir, onSort, onSortClear,
  onSearchChange, onSelectAll, onSelectCampaign,
  onCampaignClick, onDelete, onEdit, onBulkDelete, onAddClick,
  onPageChange, onPageSizeChange,
}) => {

  const isMobile = useIsMobile();
  const [dotsOpenId, setDotsOpenId] = useState<number | null>(null);
  const dotsMenuRef = useRef<HTMLDivElement>(null);

  // Close dots menu on outside click
  useEffect(() => {
    if (dotsOpenId === null) return;
    const handler = (e: MouseEvent) => {
      if (dotsMenuRef.current && !dotsMenuRef.current.contains(e.target as Node)) {
        setDotsOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dotsOpenId]);

  const [editModal, setEditModal] = useState<EditModalState>({
    open: false,
    campaignId: 0,
    currentName: '',
    newName: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [confirmEditClose, setConfirmEditClose] = useState(false);

  const closeEditModal = () => {
    if (editModal.newName !== editModal.currentName && editModal.newName.trim()) {
      setConfirmEditClose(true);
      return;
    }
    setEditModal({ ...editModal, open: false });
  };

  const discardEditClose = () => {
    setConfirmEditClose(false);
    setEditModal({ open: false, campaignId: 0, currentName: '', newName: '' });
  };

  const openEditModal = (campaign: CampaignStats) => {
    setEditModal({
      open: true,
      campaignId: campaign.campaign_id,
      currentName: campaign.campaign_name,
      newName: campaign.campaign_name,
    });
  };

  const handleSaveEdit = async () => {
    if (!editModal.newName.trim()) {
      return;
    }
    if (editModal.newName === editModal.currentName) {
      setEditModal({ ...editModal, open: false });
      return;
    }
    setEditLoading(true);
    try {
      await onEdit(editModal.campaignId, editModal.newName.trim());
      setEditModal({ ...editModal, open: false });
    } finally {
      setEditLoading(false);
    }
  };

  const sortOptions: { key: CampaignSortKey; label: string }[] = [
    { key: 'name',      label: 'Alphabetical' },
    { key: 'companies', label: 'Companies'    },
    { key: 'sent',      label: 'Sent'         },
    { key: 'read',      label: 'Read'         },
    { key: 'scheduled', label: 'Scheduled'    },
  ];

  const renderStatBox = (label: string, value: number, color?: string, subtext?: string) => (
    <CampaignStatBox key={label} theme={theme}>
      <CampaignStatValue $color={color}>{value}</CampaignStatValue>
      <CampaignStatLabel>{label}</CampaignStatLabel>
      {subtext && <CampaignStatSubtext $color={color}>{subtext}</CampaignStatSubtext>}
    </CampaignStatBox>
  );

  const renderPageNumbers = () => {
    const pages: React.ReactNode[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end   = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
      pages.push(<PaginationButton key={1} theme={theme} onClick={() => onPageChange(1)}>1</PaginationButton>);
      if (start > 2) pages.push(<PaginationInfo key="e1" theme={theme}>...</PaginationInfo>);
    }
    for (let i = start; i <= end; i++) {
      pages.push(
        <PaginationButton key={i} theme={theme} $isActive={currentPage === i} onClick={() => onPageChange(i)}>
          {i}
        </PaginationButton>
      );
    }
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push(<PaginationInfo key="e2" theme={theme}>...</PaginationInfo>);
      pages.push(
        <PaginationButton key={totalPages} theme={theme} onClick={() => onPageChange(totalPages)}>
          {totalPages}
        </PaginationButton>
      );
    }
    return pages;
  };

  const rangeStart = ((currentPage - 1) * pageSize) + 1;
  const rangeEnd   = Math.min(currentPage * pageSize, totalCampaigns);
  const showBulkBar = selectedCampaigns.size > 0 || selectAllPages;

  return (
    <>
      <CampaignsSection theme={theme}>

        {/* ── Section header ─────────────────────────────────── */}
        <SectionHeader theme={theme}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {totalCampaigns > 0 && (
              <Checkbox
                theme={theme}
                $checked={selectAllPages || (selectedCampaigns.size === campaigns.length && campaigns.length > 0)}
                onClick={onSelectAll}
                title={selectAllPages ? 'Deselect all' : 'Select all'}
              />
            )}
            <SectionTitle>
              <svg width="18" height="16" viewBox="0 0 38 34" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 11H13L28 3V31L13 23H5C3.9 23 3 22.1 3 21V13C3 11.9 3.9 11 5 11Z"/>
                <path d="M32 9C34.5 11.5 35.5 14.5 35.5 17C35.5 19.5 34.5 22.5 32 25"/>
                <path d="M13 23L15 31H20L18 23"/>
              </svg>
              Campaigns
              {(selectedCampaigns.size > 0 || selectAllPages) && (
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
          <AddButton theme={theme} onClick={onAddClick} title="Create new campaign">+</AddButton>
        </SectionHeader>

        {/* ── Search + Sort ───────────────────────────────────── */}
        {hasStats && (
          <>
            <SearchWrapper>
              <SearchIconWrap theme={theme}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </SearchIconWrap>
              <SearchInput
                theme={theme}
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
              />
              {searchTerm && (
                <SearchClearBtn theme={theme} onClick={() => onSearchChange('')} title="Clear search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </SearchClearBtn>
              )}
            </SearchWrapper>

            {/* ── Sort bar — icon label (matches Companies) ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <span style={toolbarLabelStyle} title="Sort">
                <SortIcon />
              </span>
              {sortOptions.map(({ key, label }) => {
                const active = sortKey === key;
                return (
                  <button key={key} onClick={() => onSort(key)} style={{
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
                <button onClick={onSortClear} style={{
                  padding: '0.3rem 0.6rem', borderRadius: '999px',
                  fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                  border: `1px solid ${theme.colors.base[300]}`,
                  background: theme.colors.base[400], color: theme.colors.base.content, opacity: 0.55,
                  transition: 'all 0.15s',
                }}>✕ Clear</button>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════ */}
        {/* BULK ACTIONS BAR                                    */}
        {/* ════════════════════════════════════════════════════ */}
        {showBulkBar && (
          <BulkActionsBar theme={theme} $visible={true}>
            <BulkActionsLeft>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '999px',
                background: theme.colors.primary.main,
                border: 'none',
                color: theme.colors.primary.content,
                marginRight: '0.25rem',
                whiteSpace: 'nowrap',
              }}>
                {effectiveSelectedCount}
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                of {selectAllPages ? totalCampaigns : campaigns.length} selected
              </span>
            </BulkActionsLeft>
            <BulkActionsRight>
              <IconButton
                theme={theme}
                $variant="danger"
                $size="md"
                onClick={onBulkDelete}
                title="Delete selected campaigns"
              >
                <TrashIcon />
              </IconButton>
            </BulkActionsRight>
          </BulkActionsBar>
        )}

        {/* ── List ───────────────────────────────────────────── */}
        {loading && !hasStats ? (
          <EmptyState>
            <EmptyIcon>⏳</EmptyIcon>
            <EmptyTitle>Loading campaigns...</EmptyTitle>
          </EmptyState>
        ) : campaigns.length === 0 ? (
          <EmptyState>
            <EmptyIcon>{totalCampaigns === 0 ? '📁' : '🔍'}</EmptyIcon>
            <EmptyTitle>{totalCampaigns === 0 ? 'No campaigns yet' : 'No campaigns found'}</EmptyTitle>
            <EmptySubtitle>
              {totalCampaigns === 0
                ? 'Get started by creating your first campaign'
                : `No campaigns match "${searchTerm}"`}
            </EmptySubtitle>
          </EmptyState>
        ) : (
          campaigns.map((campaign) => {
            const isSelected = selectAllPages || selectedCampaigns.has(campaign.campaign_id);
            const formattedDate = formatDate(campaign.created_at);
            return (
              <CampaignCard
                key={campaign.campaign_id}
                theme={theme}
                onClick={(e: React.MouseEvent) => {
                  if (e.ctrlKey || e.metaKey) return;
                  onCampaignClick(campaign.campaign_id);
                }}
                style={{ position: 'relative', ...(isSelected
                  ? { borderColor: theme.colors.primary.main, backgroundColor: theme.colors.primary.main + '05' }
                  : {}) }}
              >
                {/* Invisible Link stretched over card for Ctrl+click → new tab */}
                <Link
                  to={`/campaign/${campaign.campaign_id}`}
                  onClick={(e: React.MouseEvent) => {
                    if (!e.ctrlKey && !e.metaKey) e.preventDefault();
                  }}
                  style={{ position: 'absolute', inset: 0, zIndex: 0 }}
                  aria-hidden="true"
                  tabIndex={-1}
                />

                {isMobile ? (
                  /* ── Mobile: flat row — checkbox · content · dots ── */
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Checkbox */}
                    <div onClick={(e) => { e.stopPropagation(); onSelectCampaign(campaign.campaign_id, e); }}
                      style={{ width: 18, height: 18, minWidth: 18, flexShrink: 0, borderRadius: 4,
                        border: `2px solid ${isSelected ? theme.colors.primary.main : theme.colors.base.content + '55'}`,
                        backgroundColor: isSelected ? theme.colors.primary.main : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      {isSelected && <div style={{ width: 4, height: 8, border: `solid ${theme.colors.primary.content}`, borderWidth: '0 2px 2px 0', transform: 'rotate(45deg) translate(-1px,-1px)' }} />}
                    </div>

                    {/* Content: name + date + chips */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {campaign.campaign_name}
                      </div>
                      {formattedDate && (
                        <div style={{ fontSize: '0.72rem', opacity: 0.5, fontFamily: 'SF Mono, Monaco, monospace' }}>
                          {formattedDate}
                        </div>
                      )}
                      {/* Stat chips */}
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                        {[
                          { label: 'Co.',   value: campaign.companies_count, color: theme.colors.primary.main },
                          { label: 'Sent',  value: campaign.sent,            color: theme.colors.success.main },
                          { label: 'Read',  value: campaign.read,            color: theme.colors.info.main,
                            sub: campaign.sent > 0 ? `${campaign.read_rate.toFixed(0)}%` : undefined },
                          { label: 'Sched', value: campaign.scheduled,       color: theme.colors.warning.main },
                        ].map(({ label, value, color, sub }) => (
                          <div key={label} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.2rem 0.55rem', borderRadius: '999px',
                            border: `1px solid ${color}`,
                            background: theme.colors.base[300],
                            fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap',
                          }}>
                            <span style={{ opacity: 0.55, fontWeight: 500, color: theme.colors.base.content }}>{label}</span>
                            <span style={{ color }}>{value}</span>
                            {sub && <span style={{ color, opacity: 0.8, fontSize: '0.68rem' }}>{sub}</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dots menu */}
                    <div style={{ position: 'relative', flexShrink: 0 }}
                      ref={dotsOpenId === campaign.campaign_id ? dotsMenuRef : undefined}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <DotsButton theme={theme}
                        onClick={() => setDotsOpenId(dotsOpenId === campaign.campaign_id ? null : campaign.campaign_id)}
                        disabled={isSelected}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                      </DotsButton>
                      {dotsOpenId === campaign.campaign_id && (
                        <DotsMenu theme={theme}>
                          <DotsItem theme={theme} onClick={() => { setDotsOpenId(null); openEditModal(campaign); }}>
                            <EditIcon /> Rename
                          </DotsItem>
                          <DotsDivider theme={theme} />
                          <DotsItem theme={theme} $danger onClick={(e: React.MouseEvent) => { setDotsOpenId(null); onDelete(campaign.campaign_id, campaign.campaign_name, e); }}>
                            <TrashIcon /> Delete
                          </DotsItem>
                        </DotsMenu>
                      )}
                    </div>
                  </div>
                ) : (
                  /* ── Desktop: original layout ── */
                  <CampaignHeader>
                    <div onClick={(e) => onSelectCampaign(campaign.campaign_id, e)}
                      style={{ display: 'flex', alignItems: 'center' }}>
                      <Checkbox theme={theme} $checked={isSelected} />
                    </div>

                    <CampaignInfo>
                      <CampaignName>{campaign.campaign_name}</CampaignName>
                      <CampaignMeta>
                        {formattedDate && <CampaignDate>{formattedDate}</CampaignDate>}
                      </CampaignMeta>
                    </CampaignInfo>

                    <StatsContainer>
                      {renderStatBox('Companies', campaign.companies_count, theme.colors.primary.main)}
                      {renderStatBox('Sent',      campaign.sent,            theme.colors.success.main)}
                      {renderStatBox('Read',      campaign.read,            theme.colors.info.main,
                        campaign.sent > 0 ? `${campaign.read_rate.toFixed(0)}%` : undefined)}
                      {renderStatBox('Scheduled', campaign.scheduled,       theme.colors.warning.main)}
                    </StatsContainer>

                    <ActionButtons onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <IconButton theme={theme} $size="md"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); openEditModal(campaign); }}
                        title="Rename campaign" disabled={isSelected}>
                        <EditIcon />
                      </IconButton>
                      <IconButton theme={theme} $variant="danger"
                        onClick={(e: React.MouseEvent) => onDelete(campaign.campaign_id, campaign.campaign_name, e)}
                        title="Delete campaign" disabled={isSelected}>
                        <TrashIcon />
                      </IconButton>
                    </ActionButtons>
                  </CampaignHeader>
                )}
              </CampaignCard>
            );
          })
        )}

        {/* ── Pagination ─────────────────────────────────────── */}
        {totalCampaigns > 0 && (
          <PaginationContainer theme={theme}>
            <PaginationButton theme={theme} onClick={() => onPageChange(1)} disabled={currentPage === 1} title="First">««</PaginationButton>
            <PaginationButton theme={theme} onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} title="Prev">«</PaginationButton>
            {renderPageNumbers()}
            <PaginationButton theme={theme} onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} title="Next">»</PaginationButton>
            <PaginationButton theme={theme} onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} title="Last">»»</PaginationButton>
            <PaginationInfo theme={theme}>
              {totalCampaigns > 0 ? `${rangeStart}–${rangeEnd} of ${totalCampaigns}` : '0'}
            </PaginationInfo>
            <PageSizeSelect
              theme={theme}
              value={pageSize}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onPageSizeChange(Number(e.target.value))}
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
            </PageSizeSelect>
          </PaginationContainer>
        )}
      </CampaignsSection>

      {/* ── Edit Campaign Modal ─────────────────────────────── */}
      <ModalOverlay $isOpen={editModal.open} onClick={() => !editLoading && closeEditModal()}>
        <ModalContent theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <ModalHeader theme={theme}>
            <ModalTitle>Rename Campaign</ModalTitle>
            <CloseButton theme={theme} onClick={() => !editLoading && closeEditModal()}>
              <XIcon />
            </CloseButton>
          </ModalHeader>
          <ModalBody>
            <FormGroup>
              <Label theme={theme}>Current Name</Label>
              <div style={{
                marginBottom: '1.25rem',
                padding: '0.75rem',
                background: theme.colors.base[400],
                borderRadius: theme.radius?.field || '6px',
                fontSize: '0.875rem',
              }}>
                {editModal.currentName}
              </div>

              <Label theme={theme}>New Name</Label>
              <Input
                theme={theme}
                type="text"
                value={editModal.newName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditModal({ ...editModal, newName: e.target.value })
                }
                placeholder="Enter new campaign name"
                disabled={editLoading}
                autoFocus
              />
            </FormGroup>
          </ModalBody>
          <ModalFooter theme={theme}>
            <Button
              theme={theme}
              $variant="secondary"
              onClick={() => closeEditModal()}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button
              theme={theme}
              onClick={handleSaveEdit}
              disabled={!editModal.newName.trim() || editLoading || editModal.newName === editModal.currentName}
            >
              {editLoading ? 'Saving...' : 'Save'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>

      {confirmEditClose && (
        <UnsavedOverlay onClick={() => setConfirmEditClose(false)}>
          <UnsavedBox theme={theme} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
            <UnsavedActions>
              <KeepBtn theme={theme} onClick={() => setConfirmEditClose(false)}>Keep editing</KeepBtn>
              <DiscardBtn theme={theme} onClick={discardEditClose}>Discard changes</DiscardBtn>
            </UnsavedActions>
          </UnsavedBox>
        </UnsavedOverlay>
      )}
    </>
  );
};

export default CampaignsList;