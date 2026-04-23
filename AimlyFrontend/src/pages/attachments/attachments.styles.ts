// ============================================================
// attachments.styles.ts
// ============================================================

import styled from 'styled-components';

// ── Page shell ─────────────────────────────────────────────

export const PageContainer = styled.div<{ theme: any }>`
  background-color: ${p => p.theme.colors.base[100]};
  min-height: 100vh;
  color: ${p => p.theme.colors.base.content};
`;

export const MainContent = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

// ── Base card — always base[200] so it lifts off base[100] page bg ──

export const Card = styled.div<{ theme: any }>`
  background-color: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  color: ${p => p.theme.colors.base.content};
  transition: all 0.2s ease;
  box-shadow: ${p => p.theme.colorScheme === 'dark'
    ? '0 2px 8px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)'
    : '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)'};
`;

// ── Header card ───────────────────────────────────────────────

export const HeaderCard = styled(Card)`
  padding: 2rem;
`;

export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 0.5rem;
`;

export const BackButton = styled.button<{ theme: any }>`
  text-decoration: none;
  position: absolute;
  left: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${p => p.theme.colors.base[400]};
    border-color: ${p => p.theme.colors.primary.main};
    color: ${p => p.theme.colors.primary.main};
  }

  svg { width: 18px; height: 18px; }
`;

export const HeaderCenter = styled.div`
  text-align: center;
`;

export const HeaderTitle = styled.h1`
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
  letter-spacing: -0.025em;
`;

export const HeaderSubtitle = styled.p`
  margin: 0;
  opacity: 0.6;
  font-size: 0.875rem;
`;

// ── Upload card ───────────────────────────────────────────────

export const UploadCard = styled(Card)`
  padding: 2rem;
`;

export const UploadZone = styled.div<{ theme: any; $isDragging: boolean }>`
  border: 2px dashed ${p => p.$isDragging
    ? p.theme.colors.primary.main
    : p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${p => p.$isDragging ? p.theme.colors.primary.main + '08' : 'transparent'};
  text-align: center;

  &:hover {
    border-color: ${p => p.theme.colors.primary.main};
    background-color: ${p => p.theme.colors.primary.main + '06'};
  }

  svg { width: 40px; height: 40px; opacity: 0.35; }
`;

export const UploadText = styled.p`
  margin: 0 0 0.25rem 0;
  font-weight: 500;
  font-size: 0.9375rem;
`;

export const UploadSubtext = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  opacity: 0.6;
`;

export const ProgressBar = styled.div<{ theme: any }>`
  width: 200px;
  height: 3px;
  background: ${p => p.theme.colors.base[300]};
  border-radius: 2px;
  overflow: hidden;
`;

export const ProgressFill = styled.div<{ theme: any; $pct: number }>`
  height: 100%;
  width: ${p => p.$pct}%;
  background: ${p => p.theme.colors.primary.main};
  border-radius: 2px;
  transition: width 0.3s ease;
`;

// ── List section ──────────────────────────────────────────────

export const ListSection = styled(Card)`
  padding: 2rem;
`;

export const SectionHeader = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
`;

export const SectionTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  svg { width: 20px; height: 20px; }
`;

export const CountBadge = styled.span<{ theme: any }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  background: ${p => p.theme.colors.primary.main};
  border: none;
  color: ${p => p.theme.colors.primary.content};
  margin-left: 2px;
  white-space: nowrap;
`;

export const AddButton = styled.button<{ theme: any }>`
  width: 36px;
  height: 36px;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.primary.main};
  background-color: ${p => p.theme.colors.primary.main};
  color: ${p => p.theme.colors.primary.content};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 1.25rem;
  font-weight: 300;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px ${p => p.theme.colors.primary.main}40;
  }
`;

// ── Bulk actions bar ──────────────────────────────────────────

export const BulkActionsBar = styled.div<{ theme: any; $visible: boolean }>`
  background-color: ${p => p.theme.colors.base[100]};
  border: 1px solid ${p => p.theme.colors.primary.main};
  border-radius: ${p => p.theme.radius.field};
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  opacity: ${p => p.$visible ? 1 : 0};
  transform: translateY(${p => p.$visible ? 0 : -10}px);
  transition: all 0.3s ease;
  pointer-events: ${p => p.$visible ? 'auto' : 'none'};
  overflow: hidden;
`;

export const BulkLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-weight: 500;
  font-size: 0.875rem;
`;

export const BulkRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

// ── Attachment card — sits inside ListSection (base[200]), uses base[400] ──

export const AttachmentCard = styled(Card)<{ theme: any; $selected: boolean }>`
  padding: 1.25rem;
  margin-bottom: 0.75rem;
  cursor: pointer;
  background-color: ${p => p.$selected
    ? p.theme.colors.primary.main + '08'
    : p.theme.colors.base[400]};
  border-color: ${p => p.$selected
    ? p.theme.colors.primary.main
    : p.theme.colors.base[300]};

  &:hover {
    border-color: ${p => p.theme.colors.primary.main};
    box-shadow: ${p => p.theme.colorScheme === 'dark'
      ? '0 8px 24px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)'
      : '0 8px 24px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)'};
    transform: translateY(-1px);
  }

  &:last-child { margin-bottom: 0; }
`;

export const AttachmentRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

export const FileIconWrap = styled.div<{ theme: any; $ext: string }>`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  background-color: ${p => {
    switch (p.$ext) {
      case 'pdf':  return '#EF4444' + '20';
      case 'doc':
      case 'docx': return '#3B82F6' + '20';
      case 'csv':  return '#10B981' + '20';
      case 'txt':  return '#6B7280' + '20';
      default:     return p.theme.colors.primary.main + '20';
    }
  }};
  color: ${p => {
    switch (p.$ext) {
      case 'pdf':  return '#EF4444';
      case 'doc':
      case 'docx': return '#3B82F6';
      case 'csv':  return '#10B981';
      case 'txt':  return '#6B7280';
      default:     return p.theme.colors.primary.main;
    }
  }};
`;

export const FileInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

export const FileName = styled.h3`
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.375rem 0;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const FileMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

export const FileMetaItem = styled.span`
  font-size: 0.8125rem;
  opacity: 0.6;
  font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
`;

export const LinkBadges = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
`;

const CAMPAIGN_BADGE_PALETTE = [
  { bg: '#6366f1', color: '#fff' },
  { bg: '#f59e0b', color: '#1a1000' },
  { bg: '#10b981', color: '#fff' },
  { bg: '#ef4444', color: '#fff' },
  { bg: '#3b82f6', color: '#fff' },
  { bg: '#ec4899', color: '#fff' },
  { bg: '#14b8a6', color: '#fff' },
  { bg: '#f97316', color: '#fff' },
  { bg: '#8b5cf6', color: '#fff' },
  { bg: '#06b6d4', color: '#fff' },
];

export const getCampaignBadgeColor = (campaignId: number) =>
  CAMPAIGN_BADGE_PALETTE[campaignId % CAMPAIGN_BADGE_PALETTE.length];

export const LinkBadge = styled.span<{ theme: any; $type: 'global' | 'campaign'; $campaignId?: number }>`
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  letter-spacing: 0.01em;
  border: none;
  background: ${p => p.$type === 'global'
    ? p.theme.colors.primary.main
    : getCampaignBadgeColor(p.$campaignId ?? 0).bg};
  color: ${p => p.$type === 'global'
    ? p.theme.colors.primary.content
    : getCampaignBadgeColor(p.$campaignId ?? 0).color};
`;

export const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

// ── Icon button ───────────────────────────────────────────────

export const IconButton = styled.button<{ theme: any; $variant?: 'default' | 'danger' | 'primary'; $size?: 'sm' | 'md' | 'lg' }>`
  padding: ${p => p.$size === 'lg' ? '0.75rem' : p.$size === 'sm' ? '0.25rem' : '0.5rem'};
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.$variant === 'primary'
    ? p.theme.colors.primary.main
    : p.theme.colors.base[300]};
  background-color: ${p => p.$variant === 'primary'
    ? p.theme.colors.primary.main
    : p.theme.colors.base[200]};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: ${p => p.$variant === 'primary'
    ? p.theme.colors.primary.content
    : p.$variant === 'danger'
      ? p.theme.colors.error.main
      : p.theme.colors.base.content};
  gap: 0.4rem;
  font-size: 0.825rem;
  font-weight: 600;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background-color: ${p => p.$variant === 'danger'
      ? p.theme.colors.error.main
      : p.theme.colors.primary.main};
    color: ${p => p.$variant === 'danger'
      ? p.theme.colors.error.content
      : p.theme.colors.primary.content};
    border-color: ${p => p.$variant === 'danger'
      ? p.theme.colors.error.main
      : p.theme.colors.primary.main};
  }

  &:disabled { opacity: 0.4; cursor: not-allowed; }

  svg {
    width: ${p => p.$size === 'lg' ? '20px' : p.$size === 'sm' ? '14px' : '16px'};
    height: ${p => p.$size === 'lg' ? '20px' : p.$size === 'sm' ? '14px' : '16px'};
    flex-shrink: 0;
  }
`;

// ── Checkbox ──────────────────────────────────────────────────

export const Checkbox = styled.div<{ theme: any; $checked: boolean }>`
  width: 18px;
  height: 18px;
  min-width: 18px;
  border-radius: 4px;
  border: 2px solid ${p => p.$checked
    ? p.theme.colors.primary.main
    : p.theme.colors.base[400] || p.theme.colors.base[300]};
  background-color: ${p => p.$checked ? p.theme.colors.primary.main : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover { border-color: ${p => p.theme.colors.primary.main}; }

  &:after {
    content: '';
    display: ${p => p.$checked ? 'block' : 'none'};
    width: 4px;
    height: 8px;
    border: solid ${p => p.theme.colors.primary.content};
    border-width: 0 2px 2px 0;
    transform: rotate(45deg) translate(-1px, -1px);
  }
`;

// ── Empty state ───────────────────────────────────────────────

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
`;

export const EmptyIcon = styled.div`
  font-size: 3rem;
  opacity: 0.3;
  margin-bottom: 1rem;
  display: flex;
  justify-content: center;
  svg { width: 48px; height: 48px; }
`;

export const EmptyTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  opacity: 0.7;
  margin: 0 0 0.5rem 0;
`;

export const EmptySubtitle = styled.p`
  font-size: 0.875rem;
  opacity: 0.5;
  margin: 0;
  max-width: 400px;
`;

// ── Modal ─────────────────────────────────────────────────────

export const ModalOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: ${p => p.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

export const ModalContent = styled.div<{ theme: any }>`
  background-color: ${p => p.theme.colors.base[200]};
  border-radius: ${p => p.theme.radius.box};
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
`;

export const ModalHeader = styled.div<{ theme: any }>`
  padding: 1.5rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
`;

export const CloseButton = styled.button<{ theme: any }>`
  padding: 0.375rem;
  border: none;
  background: transparent;
  color: ${p => p.theme.colors.base.content};
  cursor: pointer;
  border-radius: ${p => p.theme.radius.field};
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: all 0.2s ease;

  &:hover { opacity: 1; background-color: ${p => p.theme.colors.base[100]}; }
  svg { width: 20px; height: 20px; }
`;

export const ModalBody = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
`;

export const ModalFooter = styled.div<{ theme: any }>`
  padding: 1.25rem 1.5rem;
  border-top: 1px solid ${p => p.theme.colors.base[300]};
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
`;

// ── Link modal rows ───────────────────────────────────────────

export const SectionLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
  margin-bottom: 0.5rem;
`;

export const LinkRow = styled.div<{ theme: any; $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.$selected
    ? p.theme.colors.primary.main + '60'
    : p.theme.colors.base[300]};
  background: ${p => p.$selected
    ? p.theme.colors.primary.main + '08'
    : p.theme.colors.base[100]};
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover { border-color: ${p => p.theme.colors.primary.main + '80'}; }
  &:last-child { margin-bottom: 0; }

  svg { width: 16px; height: 16px; flex-shrink: 0; opacity: 0.6; }
`;

export const LinkRowName = styled.div`
  font-size: 0.875rem;
  font-weight: 500;
  flex: 1;
`;

// sits inside ListSection (base[200]) — use base[100] for inset feel
export const SearchWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
`;

export const SearchIconWrap = styled.div<{ theme: any }>`
  position: absolute;
  left: 0.875rem;
  display: flex;
  align-items: center;
  pointer-events: none;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.35;
  svg { width: 15px; height: 15px; }
`;

export const SearchClearBtn = styled.button<{ theme: any }>`
  position: absolute;
  right: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: ${p => p.theme.colors.base[300]};
  color: ${p => p.theme.colors.base.content};
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.15s, background 0.15s;
  padding: 0;
  flex-shrink: 0;
  svg { width: 10px; height: 10px; }
  &:hover { opacity: 1; background: ${p => p.theme.colors.base[400]}; }
`;

export const SearchInput = styled.input<{ theme: any }>`
  width: 100%;
  padding: 0.75rem 2.25rem 0.75rem 2.375rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background-color: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem;
  transition: all 0.2s ease;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: ${p => p.theme.colors.primary.main};
    background-color: ${p => p.theme.colors.base[400]};
    box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}20;
  }
  &::placeholder { color: ${p => p.theme.colors.base.content}; opacity: 0.5; }
`;

// ── Toast ─────────────────────────────────────────────────────

export const ToastContainer = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: ${p => p.$isVisible ? 'auto' : 'none'};
`;

export const ToastItem = styled.div<{ theme: any; $type: 'success' | 'error' | 'warning' | 'info' }>`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  min-width: 320px;
  max-width: 450px;
  background-color: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => ({
    success: p.theme.colors.success.main,
    error:   p.theme.colors.error.main,
    warning: p.theme.colors.warning.main,
    info:    p.theme.colors.info.main,
  }[p.$type])};
  border-left: 4px solid ${p => ({
    success: p.theme.colors.success.main,
    error:   p.theme.colors.error.main,
    warning: p.theme.colors.warning.main,
    info:    p.theme.colors.info.main,
  }[p.$type])};
  border-radius: ${p => p.theme.radius.box};
  box-shadow: ${p => p.theme.colorScheme === 'dark'
    ? '0 8px 24px rgba(0,0,0,0.4)'
    : '0 8px 24px rgba(0,0,0,0.15)'};
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(100%); }
    to   { opacity: 1; transform: translateX(0); }
  }
`;

export const ToastMsg = styled.div<{ theme: any }>`
  flex: 1;
  font-size: 0.8125rem;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.9;
  line-height: 1.4;
`;

// ── Confirm dialog ────────────────────────────────────────────

export const ConfirmOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: ${p => p.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 10001;
`;

export const ConfirmBox = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 1.5rem;
  max-width: 420px;
  width: 90%;
  box-shadow: ${p => p.theme.colorScheme === 'dark'
    ? '0 20px 40px rgba(0,0,0,0.5)'
    : '0 20px 40px rgba(0,0,0,0.15)'};
`;

export const ConfirmHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
`;

export const ConfirmIconWrap = styled.div<{ theme: any }>`
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => p.theme.colors.error.main + '15'};
  color: ${p => p.theme.colors.error.main};
  svg { width: 20px; height: 20px; }
`;

export const ConfirmContent = styled.div`flex: 1;`;

export const ConfirmTitle = styled.h3<{ theme: any }>`
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: ${p => p.theme.colors.base.content};
`;

export const ConfirmMessage = styled.p<{ theme: any }>`
  margin: 0;
  font-size: 0.9375rem;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.85;
  line-height: 1.5;
`;

export const ConfirmActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
`;

export const CancelButton = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${p => p.theme.colors.base[100]};
  color: ${p => p.theme.colors.base.content};
  border: 1px solid ${p => p.theme.colors.base[300]};
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { background-color: ${p => p.theme.colors.base[300]}; }
  svg { width: 16px; height: 16px; }
`;

export const DangerButton = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${p => p.theme.colors.error.main};
  color: ${p => p.theme.colors.error.content};
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { opacity: 0.9; transform: translateY(-1px); }
  svg { width: 16px; height: 16px; }
`;

export const PrimaryButton = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${p => p.theme.colors.primary.main};
  color: ${p => p.theme.colors.primary.content};
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { opacity: 0.9; transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  svg { width: 16px; height: 16px; }
`;

// ── Filter bar ────────────────────────────────────────────────

export const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
`;

export const FilterChip = styled.button<{ theme: any; $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  border: 1px solid ${p => p.$active
    ? p.theme.colors.primary.main
    : p.theme.colors.base[300]};
  background: ${p => p.$active
    ? p.theme.colors.primary.main
    : p.theme.colors.base[400]};
  color: ${p => p.$active
    ? p.theme.colors.primary.content
    : p.theme.colors.base.content};

  &:hover {
    border-color: ${p => p.theme.colors.primary.main};
    background: ${p => p.$active
      ? p.theme.colors.primary.main
      : p.theme.colors.primary.main + '12'};
    color: ${p => p.$active
      ? p.theme.colors.primary.content
      : p.theme.colors.primary.main};
  }

  svg { width: 13px; height: 13px; flex-shrink: 0; }
`;

// ── Campaign dropdown filter ──────────────────────────────────

export const DropdownWrap = styled.div`
  position: relative;
  display: inline-block;
`;

export const DropdownTrigger = styled.button<{ theme: any; $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  border: 1px solid ${p => p.$active
    ? p.theme.colors.primary.main
    : p.theme.colors.base[300]};
  background: ${p => p.$active
    ? p.theme.colors.primary.main
    : p.theme.colors.base[400]};
  color: ${p => p.$active
    ? p.theme.colors.primary.content
    : p.theme.colors.base.content};

  &:hover {
    border-color: ${p => p.theme.colors.primary.main};
    background: ${p => p.$active
      ? p.theme.colors.primary.main
      : p.theme.colors.primary.main + '12'};
    color: ${p => p.$active
      ? p.theme.colors.primary.content
      : p.theme.colors.primary.main};
  }

  svg { width: 13px; height: 13px; flex-shrink: 0; }
`;

export const DropdownBadge = styled.span<{ theme: any }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  background: ${p => p.theme.colors.primary.content};
  color: ${p => p.theme.colors.primary.main};
`;

export const DropdownMenu = styled.div<{ theme: any }>`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 1000;
  min-width: 220px;
  max-height: 280px;
  overflow-y: auto;
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  box-shadow: ${p => p.theme.colorScheme === 'dark'
    ? '0 8px 24px rgba(0,0,0,0.4)'
    : '0 8px 24px rgba(0,0,0,0.12)'};
  padding: 0.375rem;
`;

export const DropdownSearch = styled.input<{ theme: any }>`
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background: ${p => p.theme.colors.base[100]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.8125rem;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: ${p => p.theme.colors.primary.main};
  }
  &::placeholder { opacity: 0.5; }
`;

export const DropdownItem = styled.div<{ theme: any; $checked: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.625rem;
  border-radius: ${p => p.theme.radius.field};
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: background 0.1s ease;
  background: ${p => p.$checked ? p.theme.colors.primary.main + '10' : 'transparent'};
  color: ${p => p.theme.colors.base.content};

  &:hover {
    background: ${p => p.$checked
      ? p.theme.colors.primary.main + '18'
      : p.theme.colors.base[100]};
  }

  svg { flex-shrink: 0; opacity: 0.6; }
`;

export const DropdownDivider = styled.div<{ theme: any }>`
  height: 1px;
  background: ${p => p.theme.colors.base[300]};
  margin: 0.375rem 0;
`;

// ── Pagination ────────────────────────────────────────────────

export const PaginationContainer = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 0;
  border-top: 1px solid ${p => p.theme.colors.base[300]};
  margin-top: 1rem;
  flex-wrap: wrap;
`;

export const PaginationButton = styled.button<{ theme: any; $isActive?: boolean }>`
  min-width: 36px;
  height: 36px;
  padding: 0 0.75rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.$isActive ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background-color: ${p => p.$isActive ? p.theme.colors.primary.main : p.theme.colors.base[400]};
  color: ${p => p.$isActive ? p.theme.colors.primary.content : p.theme.colors.base.content};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background-color: ${p => p.$isActive ? p.theme.colors.primary.main : p.theme.colors.primary.main + '12'};
    border-color: ${p => p.theme.colors.primary.main};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
  svg { width: 16px; height: 16px; }
`;

export const PaginationInfo = styled.span<{ theme: any }>`
  font-size: 0.875rem;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.7;
  margin: 0 0.5rem;
`;

export const PageSizeSelect = styled.select<{ theme: any }>`
  padding: 0.5rem 0.75rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background-color: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem;
  cursor: pointer;
  margin-left: 0.5rem;

  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }

  option {
    background-color: ${p => p.theme.colors.base[200]};
    color: ${p => p.theme.colors.base.content};
  }
`;

export const EditInput = styled.input<{ theme: any }>`
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background-color: ${p => p.theme.colors.base[100]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem;
  transition: all 0.2s ease;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: ${p => p.theme.colors.primary.main};
    background-color: ${p => p.theme.colors.base[100]};
    box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}20;
  }
  &::placeholder { color: ${p => p.theme.colors.base.content}; opacity: 0.5; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;