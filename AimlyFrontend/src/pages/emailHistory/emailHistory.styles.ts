// ============================================================
// campaignHistory.styles.ts — mirrors attachments_styles.ts exactly,
// plus email-specific additions (StatusBadge, ReadBlock, form fields,
// auto-save note, spinner, form group/label)
// ============================================================

import styled, { keyframes } from 'styled-components';

// ── Animations (private — not exported) ────────────────────────────────────────

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const slideInAnim = keyframes`
  from { opacity: 0; transform: translateX(100%); }
  to   { opacity: 1; transform: translateX(0); }
`;

const slideOutAnim = keyframes`
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(100%); }
`;

// ── Page shell ─────────────────────────────────────────────────────────────────

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

// ── Base card ──────────────────────────────────────────────────────────────────

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

// ── Header card ────────────────────────────────────────────────────────────────

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

// ── List section ───────────────────────────────────────────────────────────────

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

// ── Bulk actions bar ───────────────────────────────────────────────────────────

export const BulkActionsBar = styled.div<{ theme: any; $visible: boolean }>`
  background-color: ${p => p.theme.colors.base[400]};
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

// ── Email card (mirrors AttachmentCard) ────────────────────────────────────────

export const EmailCard = styled(Card)<{ theme: any; $selected: boolean }>`
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

export const EmailRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

export const EmailInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

export const EmailSubject = styled.h3`
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.375rem 0;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const EmailMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

export const EmailMetaItem = styled.span`
  font-size: 0.8125rem;
  opacity: 0.6;
  font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
`;

export const EmailPreview = styled.div`
  font-size: 0.8125rem;
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 0.375rem;
`;

export const BadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
`;

// ── Status badge ───────────────────────────────────────────────────────────────

export const StatusBadge = styled.span<{ theme: any; $status: 'sent' | 'draft' | 'scheduled' | 'failed' }>`
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  ${p => {
    const m = {
      sent:      `background:${(p.theme.colors.success?.main || '#22c55e')}20;color:${p.theme.colors.success?.main || '#22c55e'};`,
      draft:     `background:${(p.theme.colors.warning?.main || '#f59e0b')}20;color:${p.theme.colors.warning?.main || '#f59e0b'};`,
      scheduled: `background:${(p.theme.colors.info?.main    || p.theme.colors.primary.main)}20;color:${p.theme.colors.info?.main || p.theme.colors.primary.main};`,
      failed:    `background:${(p.theme.colors.error?.main   || '#ef4444')}20;color:${p.theme.colors.error?.main || '#ef4444'};`,
    };
    return m[p.$status];
  }}
`;

export const CompanyTag = styled.span<{ theme: any }>`
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  border: 1px solid ${p => p.theme.colors.base[300]};
  background: ${p => p.theme.colors.base[400]};
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

// ── Action buttons ─────────────────────────────────────────────────────────────

export const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
`;

// ── Icon button ────────────────────────────────────────────────────────────────

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

// ── Checkbox ───────────────────────────────────────────────────────────────────

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

// ── Empty state ────────────────────────────────────────────────────────────────

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

// ── Search input ───────────────────────────────────────────────────────────────

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
  border: 1px solid ${p => p.theme.colors.base[400] || p.theme.colors.base[300]};
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

// ── Filter / sort bar ──────────────────────────────────────────────────────────

export const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
`;

export const FilterChip = styled.button<{ theme: any; $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.75rem;
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

// ── Toast ──────────────────────────────────────────────────────────────────────

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

export const ToastItem = styled.div<{ theme: any; $type: 'success' | 'error' | 'warning' | 'info'; $exiting?: boolean }>`
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
    warning: p.theme.colors.warning?.main || '#f59e0b',
    info:    p.theme.colors.info?.main    || p.theme.colors.primary.main,
  }[p.$type])};
  border-left: 4px solid ${p => ({
    success: p.theme.colors.success.main,
    error:   p.theme.colors.error.main,
    warning: p.theme.colors.warning?.main || '#f59e0b',
    info:    p.theme.colors.info?.main    || p.theme.colors.primary.main,
  }[p.$type])};
  border-radius: ${p => p.theme.radius.box};
  box-shadow: ${p => p.theme.colorScheme === 'dark'
    ? '0 8px 24px rgba(0,0,0,0.4)'
    : '0 8px 24px rgba(0,0,0,0.15)'};
  animation: ${p => p.$exiting ? slideOutAnim : slideInAnim} 0.3s ease forwards;
`;

export const ToastBody = styled.div`flex: 1;`;
export const ToastTitle = styled.div`font-size: 0.875rem; font-weight: 600; margin-bottom: 0.1rem;`;
export const ToastMsg = styled.div`font-size: 0.8125rem; opacity: 0.8; line-height: 1.4;`;

// ── Confirm dialog ─────────────────────────────────────────────────────────────

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

export const ConfirmIconWrap = styled.div<{ theme: any; $danger?: boolean }>`
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => p.$danger
    ? p.theme.colors.error.main + '15'
    : p.theme.colors.primary.main + '15'};
  color: ${p => p.$danger
    ? p.theme.colors.error.main
    : p.theme.colors.primary.main};
  svg { width: 20px; height: 20px; }
`;

export const ConfirmContent = styled.div`flex: 1;`;

export const ConfirmTitle = styled.h3<{ theme: any }>`
  margin: 0 0 0.5rem 0;
  font-size: 1.0625rem;
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

// ── Spinner ────────────────────────────────────────────────────────────────────


export const BtnSpinner = styled.div`
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ${spin} 0.65s linear infinite;
  flex-shrink: 0;
`;

// ── Section label (small uppercase) ───────────────────────────────────────────

export const SectionLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.45;
  margin-bottom: 0.5rem;
`;

// ── Schedule small modal ───────────────────────────────────────────────────────



// ── Company filter dropdown ────────────────────────────────────────────────────

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

export const DropdownMenu = styled.div<{ theme: any }>`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 1000;
  min-width: 230px;
  max-height: 300px;
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
  margin-bottom: 0.375rem;
  box-sizing: border-box;

  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }
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
`;

// ── Pagination ─────────────────────────────────────────────────────────────────

export const PaginationContainer = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.375rem;
  padding-top: 1.5rem;
  margin-top: 1rem;
  border-top: 1px solid ${p => p.theme.colors.base[300]};
`;

export const PaginationButton = styled.button<{ theme: any; $isActive?: boolean }>`
  min-width: 36px;
  height: 36px;
  padding: 0 0.75rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.$isActive
    ? p.theme.colors.primary.main
    : p.theme.colors.base[300]};
  background-color: ${p => p.$isActive
    ? p.theme.colors.primary.main
    : p.theme.colors.base[400]};
  color: ${p => p.$isActive
    ? p.theme.colors.primary.content
    : p.theme.colors.base.content};
  font-size: 0.875rem;
  font-weight: ${p => p.$isActive ? 600 : 400};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  line-height: 1;

  &:hover:not(:disabled) {
    border-color: ${p => p.theme.colors.primary.main};
    color: ${p => p.$isActive
      ? p.theme.colors.primary.content
      : p.theme.colors.primary.main};
    background-color: ${p => p.$isActive
      ? p.theme.colors.primary.main
      : p.theme.colors.primary.main + '12'};
  }

  &:disabled { opacity: 0.35; cursor: not-allowed; pointer-events: none; }
`;

export const PaginationInfo = styled.span<{ theme: any }>`
  font-size: 0.875rem;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.65;
  padding: 0 0.375rem;
  white-space: nowrap;
`;

export const PageSizeSelect = styled.select<{ theme: any }>`
  height: 36px;
  padding: 0 0.625rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background-color: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem;
  cursor: pointer;
  margin-left: 0.25rem;
  transition: border-color 0.15s ease;

  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }

  option {
    background-color: ${p => p.theme.colors.base[200]};
    color: ${p => p.theme.colors.base.content};
  }
`;
// ── Buttons ────────────────────────────────────────────────────────────────────

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
  &:disabled { opacity: 0.5; cursor: not-allowed; }
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
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
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