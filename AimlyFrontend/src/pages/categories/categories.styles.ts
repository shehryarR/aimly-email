// ============================================================
// categories.styles.ts
// Mirrors companies.styles.ts conventions exactly
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

// ── Base card ─────────────────────────────────────────────

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

export const HeaderCard = styled(Card)`
  padding: 2rem;
`;

export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
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

// ── Count badge ───────────────────────────────────────────

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

// ── Add button ────────────────────────────────────────────

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
  flex-shrink: 0;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px ${p => p.theme.colors.primary.main}40;
  }

  svg { width: 18px; height: 18px; }
`;

// ── Search input ──────────────────────────────────────────

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

// ── Bulk actions bar ──────────────────────────────────────

export const BulkActionsBar = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: ${p => p.theme.colors.base[400]};
  border: 1px solid ${p => p.theme.colors.primary.main};
  border-radius: ${p => p.theme.radius.field};
  margin-bottom: 1rem;
  animation: slideDown 0.2s ease;

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

export const BulkLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
`;

export const BulkRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

// ── Checkbox ──────────────────────────────────────────────

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

// ── Category card ─────────────────────────────────────────
// Sits inside ListSection (base[200]), uses base[400] like CompanyCard

export const CategoryCard = styled(Card)<{ theme: any; $selected: boolean }>`
  padding: 1.25rem;
  margin-bottom: 0.625rem;
  cursor: pointer;
  background-color: ${p => p.$selected
    ? p.theme.colors.primary.main + '08'
    : p.theme.colors.base[400]};
  border-color: ${p => p.$selected
    ? p.theme.colors.primary.main
    : p.theme.colors.base[300]};

  &:hover {
    border-color: ${p => p.theme.colors.primary.main};
    background-color: ${p => p.$selected
      ? p.theme.colors.primary.main + '08'
      : p.theme.colors.base[400]};
    box-shadow: ${p => p.theme.colorScheme === 'dark'
      ? '0 8px 24px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)'
      : '0 8px 24px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)'};
    transform: translateY(-1px);
  }

  &:last-child { margin-bottom: 0; }
`;

export const CategoryRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

export const CategoryInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

export const CategoryName = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 0.2rem;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const CategoryDetail = styled.div`
  font-size: 0.8125rem;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const CategoryMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
`;

export const CompanyCountBadge = styled.span<{ theme: any }>`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  letter-spacing: 0.01em;
  background: ${p => p.theme.colors.primary.main}18;
  border: 1px solid ${p => p.theme.colors.primary.main}30;
  color: ${p => p.theme.colors.primary.main};
  svg { width: 11px; height: 11px; flex-shrink: 0; }
`;

export const CategoryActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
`;

// ── Icon button — exact copy from companies.styles.ts ─────

export const IconButton = styled.button<{
  theme: any;
  $variant?: 'default' | 'danger';
  $size?: 'sm' | 'md' | 'lg';
}>`
  padding: ${p => p.$size === 'lg' ? '0.75rem' : p.$size === 'sm' ? '0.25rem' : '0.5rem'};
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background-color: ${p => p.theme.colors.base[200]};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: ${p => p.$variant === 'danger'
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

  &:disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }

  svg {
    width: ${p => p.$size === 'lg' ? '20px' : p.$size === 'sm' ? '14px' : '16px'};
    height: ${p => p.$size === 'lg' ? '20px' : p.$size === 'sm' ? '14px' : '16px'};
  }
`;

// ── Empty state ───────────────────────────────────────────

export const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
`;

export const EmptyIcon = styled.div<{ theme?: any }>`
  opacity: 0.25;
  margin-bottom: 1rem;
  display: flex;
  justify-content: center;
  svg { width: 48px; height: 48px; }
`;

export const EmptyTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
`;

export const EmptySubtitle = styled.p`
  font-size: 0.875rem;
  opacity: 0.6;
  margin: 0;
`;

// ── Pagination ────────────────────────────────────────────

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
`;

// ── Toast ─────────────────────────────────────────────────

export const ToastContainer = styled.div<{ theme: any; $type: 'success' | 'error' | 'warning' | 'info' }>`
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  min-width: 320px;
  max-width: 420px;
  padding: 1rem 1.25rem;
  border-radius: ${p => p.theme.radius.box};
  background-color: ${p => ({
    success: p.theme.colors.success.main,
    error:   p.theme.colors.error.main,
    warning: p.theme.colors.warning.main,
    info:    p.theme.colors.info.main,
  }[p.$type])};
  color: ${p => ({
    success: p.theme.colors.success.content,
    error:   p.theme.colors.error.content,
    warning: p.theme.colors.warning.content,
    info:    p.theme.colors.info.content,
  }[p.$type])};
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  z-index: 10000;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
`;

export const ToastContent = styled.div`flex: 1;`;

export const ToastTitle = styled.div`
  font-weight: 600;
  font-size: 0.9375rem;
  margin-bottom: 0.25rem;
`;

export const ToastMsg = styled.div`
  font-size: 0.8125rem;
  opacity: 0.9;
`;

export const ToastCloseButton = styled.button`
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.25rem;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover { opacity: 1; }
  svg { width: 16px; height: 16px; }
`;

// ── Confirm ───────────────────────────────────────────────

export const ConfirmOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0,0,0,0.5);
  display: ${p => p.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

export const ConfirmBox = styled.div<{ theme: any }>`
  background: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 1.75rem;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
`;

export const ConfirmHeader = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

export const ConfirmIconWrap = styled.div<{ theme: any; $variant?: string }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${p => {
    switch (p.$variant) {
      case 'danger':  return p.theme.colors.error.main + '15';
      case 'warning': return p.theme.colors.warning.main + '15';
      default:        return p.theme.colors.error.main + '15';
    }
  }};
  color: ${p => {
    switch (p.$variant) {
      case 'danger':  return p.theme.colors.error.main;
      case 'warning': return p.theme.colors.warning.main;
      default:        return p.theme.colors.error.main;
    }
  }};
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
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
`;

export const CancelButton = styled.button<{ theme: any }>`
  padding: 0.625rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${p => p.theme.colors.base[400]};
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
  &:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  svg { width: 16px; height: 16px; }
`;

// ── Modal ─────────────────────────────────────────────────

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

export const ModalContent = styled.div<{ theme: any; $wide?: boolean }>`
  background-color: ${p => p.theme.colors.base[200]};
  border-radius: ${p => p.theme.radius.box};
  width: 100%;
  max-width: ${p => p.$wide ? '600px' : '480px'};
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
`;

export const ModalHeader = styled.div<{ theme: any }>`
  padding: 1.5rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

export const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  svg { width: 18px; height: 18px; opacity: 0.7; }
`;

export const CloseButton = styled.button<{ theme: any }>`
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: ${p => p.theme.radius.field};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.6;
  transition: all 0.2s ease;
  &:hover { opacity: 1; background-color: ${p => p.theme.colors.base[400]}; }
  svg { width: 18px; height: 18px; }
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
  flex-shrink: 0;
`;

// ── Form elements ─────────────────────────────────────────

export const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`;

export const FormGroup = styled.div<{ $span?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  grid-column: ${p => p.$span ? '1 / -1' : 'auto'};
`;

export const Label = styled.label<{ theme: any }>`
  font-size: 0.8125rem;
  font-weight: 500;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.8;
`;

export const Input = styled.input<{ theme: any }>`
  width: 100%;
  padding: 0.625rem 0.875rem;
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
    box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}18;
  }
  &::placeholder { color: ${p => p.theme.colors.base.content}; opacity: 0.4; }
`;

export const Textarea = styled.textarea<{ theme: any }>`
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.field};
  background-color: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  transition: all 0.2s ease;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: ${p => p.theme.colors.primary.main};
    background-color: ${p => p.theme.colors.base[400]};
    box-shadow: 0 0 0 3px ${p => p.theme.colors.primary.main}18;
  }
  &::placeholder { color: ${p => p.theme.colors.base.content}; opacity: 0.4; }
`;

// ── Company list inside category modal ────────────────────

export const CompanyListItem = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  margin-bottom: 0.5rem;
  background: ${p => p.theme.colors.base[400]};
  transition: all 0.15s ease;
  &:last-child { margin-bottom: 0; }
  &:hover { border-color: ${p => p.theme.colors.primary.main}50; }
`;

export const CompanyListName = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const CompanyListEmail = styled.div`
  font-size: 0.8125rem;
  opacity: 0.6;
  flex-shrink: 0;
`;