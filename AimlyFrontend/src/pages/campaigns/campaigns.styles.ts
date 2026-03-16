// ============================================================
// campaigns.styles.ts
// ============================================================

import styled from 'styled-components';

// ── Page shell ─────────────────────────────────────────────

export const DashboardContainer = styled.div<{ theme: any }>`
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

  &:hover {
    box-shadow: ${p => p.theme.colorScheme === 'dark'
      ? '0 8px 24px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)'
      : '0 8px 24px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)'};
    transform: translateY(-1px);
  }
`;

// ── Hero Banner ───────────────────────────────────────────────

export const HeroCard = styled.div<{ theme: any }>`
  background-color: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  box-shadow: ${p => p.theme.colorScheme === 'dark'
    ? '0 2px 8px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)'
    : '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)'};
  overflow: hidden;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: -60px;
    right: -60px;
    width: 260px;
    height: 260px;
    background: radial-gradient(
      circle,
      ${p => p.theme.colors.primary.main}12 0%,
      transparent 70%
    );
    pointer-events: none;
  }
`;

export const HeroCommandBar = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
  gap: 1rem;
`;

export const HeroBarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

export const HeroBarTitle = styled.span<{ theme: any }>`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${p => p.theme.colors.base.content};
  letter-spacing: -0.01em;
`;

export const HeroBarSep = styled.div<{ theme: any }>`
  width: 1px;
  height: 14px;
  background-color: ${p => p.theme.colors.base[300]};
`;

export const HeroBarDate = styled.span<{ theme: any }>`
  font-size: 0.75rem;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.45;
  font-weight: 400;
`;

export const HeroBarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

export const HeroNavBtn = styled.button<{ theme: any }>`
  height: 28px;
  padding: 0 0.625rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background-color: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  opacity: 0.75;
  white-space: nowrap;
  flex-shrink: 0;

  svg { width: 13px; height: 13px; flex-shrink: 0; }

  &:hover {
    border-color: ${p => p.theme.colors.primary.main};
    color: ${p => p.theme.colors.primary.main};
    opacity: 1;
  }
`;

export const HeroNavBtnCount = styled.span<{ theme: any }>`
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  background-color: ${p => p.theme.colors.base[300]};
  border-radius: 4px;
  padding: 0 4px;
  line-height: 16px;
`;

export const HeroStatsStrip = styled.div<{ theme: any }>`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  border-top: 1px solid ${p => p.theme.colors.base[300]};
`;

export const HeroStatCell = styled.div<{ theme: any }>`
  padding: 1rem 1.5rem;
  border-right: 1px solid ${p => p.theme.colors.base[300]};
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  transition: background-color 0.15s ease;

  &:last-child { border-right: none; }

  &:hover {
    background-color: ${p => p.theme.colors.base[400]};
  }
`;

export const HeroStatValue = styled.div<{ $color?: string }>`
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  color: ${p => p.$color || 'inherit'};
`;

export const HeroStatLabel = styled.div`
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.5;
`;

export const HeroStatRate = styled.div<{ $color?: string }>`
  font-size: 0.6rem;
  font-weight: 500;
  color: ${p => p.$color || 'inherit'};
  opacity: 0.8;
`;

// Legacy stubs
export const HeaderCard     = styled.div``;
export const HeaderContent  = styled.div``;
export const HeaderTitle    = styled.h1``;
export const HeaderSubtitle = styled.p``;

export const StatsCard = styled(Card)`
  padding: 2rem;
`;

export const StatsHeader = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid ${p => p.theme.colors.base[300]};
`;

export const StatsTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  svg { width: 20px; height: 20px; }
`;

export const CompaniesButton = styled.button<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.875rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background-color: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  opacity: 0.85;

  svg { width: 14px; height: 14px; flex-shrink: 0; }

  &:hover {
    border-color: ${p => p.theme.colors.primary.main};
    color: ${p => p.theme.colors.primary.main};
    background-color: ${p => p.theme.colors.base[400]};
    opacity: 1;
  }
`;

// NavIconButton / NavIconCount removed — replaced by HeroNavBtn / HeroNavBtnCount

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1.25rem;
`;

// StatBox sits inside StatsCard (base[200]) — use base[400]
export const StatBox = styled.div<{ theme: any }>`
  background-color: ${p => p.theme.colors.base[400]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 1.25rem;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${p => p.theme.colorScheme === 'dark'
      ? '0 4px 12px rgba(0,0,0,0.3)'
      : '0 4px 12px rgba(0,0,0,0.1)'};
    border-color: ${p => p.theme.colors.primary.main};
  }
`;

export const StatLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
  margin-bottom: 0.5rem;
`;

export const StatValue = styled.div`
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
`;

export const StatSubtext = styled.div<{ theme: any; $color?: string }>`
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.5rem;
  color: ${p => p.$color || p.theme.colors.base.content};
  opacity: 0.8;
`;

export const CampaignsSection = styled(Card)`
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

// SearchInput sits inside CampaignsSection (base[200]) — use base[400]
export const SearchWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
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

  &::placeholder {
    color: ${p => p.theme.colors.base.content};
    opacity: 0.5;
  }
`;

export const SearchContainer = styled.div`
  margin-bottom: 1.5rem;
`;

// CampaignCard sits inside CampaignsSection (base[200]) — use base[400]
export const CampaignCard = styled(Card)`
  padding: 1.25rem;
  margin-bottom: 0.75rem;
  cursor: pointer;
  background-color: ${p => p.theme.colors.base[400]};
  transition: all 0.2s ease;

  &:hover {
    border-color: ${p => p.theme.colors.primary.main};
  }
`;

export const CampaignHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

export const CampaignInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

export const CampaignName = styled.h3`
  font-size: 0.9375rem;
  font-weight: 600;
  margin: 0 0 0.375rem 0;
  letter-spacing: -0.01em;
`;

export const CampaignMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

export const CampaignDate = styled.span`
  font-size: 0.8125rem;
  opacity: 0.6;
  font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
`;

export const StatsContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

// CampaignStatBox sits inside CampaignCard (base[400]) — use base[200] to step back inward
export const CampaignStatBox = styled.div<{ theme: any }>`
  background-color: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 0.5rem 0.75rem;
  min-width: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

export const CampaignStatValue = styled.div<{ $color?: string }>`
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  color: ${p => p.$color || 'inherit'};
`;

export const CampaignStatLabel = styled.div`
  font-size: 0.625rem;
  text-transform: uppercase;
  font-weight: 600;
  opacity: 0.6;
  margin-top: 0.25rem;
  letter-spacing: 0.05em;
`;

export const CampaignStatSubtext = styled.div<{ $color?: string }>`
  font-size: 0.625rem;
  font-weight: 600;
  color: ${p => p.$color || 'inherit'};
  opacity: 0.8;
  margin-top: 0.125rem;
`;

export const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

// IconButton sits inside CampaignCard (base[400]) — use base[200] to step back
export const IconButton = styled.button<{ theme: any; $variant?: 'default' | 'danger'; $size?: 'sm' | 'md' | 'lg' }>`
  padding: ${p => p.$size === 'lg' ? '0.75rem' : p.$size === 'sm' ? '0.25rem' : '0.5rem'};
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background-color: ${p => p.theme.colors.base[200]};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: ${p => p.$variant === 'danger' ? p.theme.colors.error.main : p.theme.colors.base.content};

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

// ── Toast ─────────────────────────────────────────────────────

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

export const ToastMessage = styled.div`
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

// ── Confirm dialog ────────────────────────────────────────────

export const ConfirmOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const ConfirmBox = styled.div<{ theme: any }>`
  background-color: ${p => p.theme.colors.base[200]};
  border: 1px solid ${p => p.theme.colors.base[300]};
  border-radius: ${p => p.theme.radius.box};
  padding: 1.5rem;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
`;

export const ConfirmHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
`;

export const ConfirmIconWrapper = styled.div<{ theme: any; $variant?: 'danger' | 'warning' | 'default' }>`
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => ({
    danger:  p.theme.colors.error.main   + '15',
    warning: p.theme.colors.warning.main + '15',
    default: p.theme.colors.primary.main + '15',
  }[p.$variant ?? 'default'])};
  color: ${p => ({
    danger:  p.theme.colors.error.main,
    warning: p.theme.colors.warning.main,
    default: p.theme.colors.primary.main,
  }[p.$variant ?? 'default'])};

  svg { width: 20px; height: 20px; }
`;

export const ConfirmContent = styled.div`flex: 1;`;

export const ConfirmTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
`;

export const ConfirmMessage = styled.p`
  margin: 0;
  font-size: 0.9375rem;
  opacity: 0.8;
  line-height: 1.5;
`;

export const ConfirmButtons = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
`;

export const ConfirmButton = styled.button<{ theme: any; $variant?: 'danger' | 'warning' | 'default' }>`
  padding: 0.625rem 1.25rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: ${p => ({
    danger:  p.theme.colors.error.main,
    warning: p.theme.colors.warning.main,
    default: p.theme.colors.primary.main,
  }[p.$variant ?? 'default'])};
  color: ${p => ({
    danger:  p.theme.colors.error.content,
    warning: p.theme.colors.warning.content,
    default: p.theme.colors.primary.content,
  }[p.$variant ?? 'default'])};

  &:hover { opacity: 0.9; transform: translateY(-1px); }
  svg { width: 16px; height: 16px; }
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

export const Checkbox = styled.div<{ theme: any; $checked: boolean }>`
  width: 18px;
  height: 18px;
  min-width: 18px;
  border-radius: 4px;
  border: 2px solid ${p => p.$checked ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background-color: ${p => p.$checked ? p.theme.colors.primary.main : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

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

// ── Bulk actions bar ──────────────────────────────────────────

export const BulkActionsBar = styled.div<{ theme: any; $visible?: boolean }>`
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

export const BulkActionsLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
  font-size: 0.875rem;
`;

export const BulkActionsRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
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
  max-width: 450px;
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

export const ModalBody = styled.div`padding: 1.5rem;`;

export const ModalFooter = styled.div<{ theme: any }>`
  padding: 1.25rem 1.5rem;
  border-top: 1px solid ${p => p.theme.colors.base[300]};
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
`;

export const FormGroup = styled.div`
  margin-bottom: 1.25rem;
  &:last-child { margin-bottom: 0; }
`;

export const Label = styled.label<{ theme: any }>`
  display: block;
  color: ${p => p.theme.colors.base.content};
  font-weight: 500;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
`;

// Input inside modal (base[200]) — use base[400] for inset feel
export const Input = styled.input<{ theme: any }>`
  width: 100%;
  padding: 0.75rem 1rem;
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

  &::placeholder {
    color: ${p => p.theme.colors.base.content};
    opacity: 0.5;
  }
`;

export const Button = styled.button<{ theme: any; $variant?: 'primary' | 'secondary' }>`
  padding: 0.75rem 1.5rem;
  border-radius: ${p => p.theme.radius.field};
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;

  ${p => p.$variant === 'secondary' ? `
    background-color: ${p.theme.colors.base[400]};
    color: ${p.theme.colors.base.content};
    border: 1px solid ${p.theme.colors.base[300]};
    &:hover { background-color: ${p.theme.colors.base[300]}; }
  ` : `
    background-color: ${p.theme.colors.primary.main};
    color: ${p.theme.colors.primary.content};
    &:hover {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px ${p.theme.colors.primary.main}40;
    }
  `}

  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

// ── Pagination ────────────────────────────────────────────────

export const PaginationContainer = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.375rem;
  padding-top: 1.25rem;
  margin-top: 0.75rem;
  border-top: 1px solid ${p => p.theme.colors.base[300]};
`;

export const PaginationButton = styled.button<{ theme: any; $isActive?: boolean }>`
  min-width: 32px;
  height: 32px;
  padding: 0 0.5rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.$isActive ? p.theme.colors.primary.main : p.theme.colors.base[300]};
  background-color: ${p => p.$isActive ? p.theme.colors.primary.main : p.theme.colors.base[400]};
  color: ${p => p.$isActive ? p.theme.colors.primary.content : p.theme.colors.base.content};
  font-size: 0.8125rem;
  font-weight: ${p => p.$isActive ? 600 : 400};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  line-height: 1;

  &:hover:not(:disabled) {
    border-color: ${p => p.theme.colors.primary.main};
    color: ${p => p.$isActive ? p.theme.colors.primary.content : p.theme.colors.primary.main};
    background-color: ${p => p.$isActive ? p.theme.colors.primary.main : `${p.theme.colors.primary.main}12`};
  }

  &:disabled { opacity: 0.35; cursor: not-allowed; pointer-events: none; }
`;

export const PaginationInfo = styled.span<{ theme: any }>`
  font-size: 0.8125rem;
  color: ${p => p.theme.colors.base.content};
  opacity: 0.65;
  padding: 0 0.375rem;
  white-space: nowrap;
`;

export const PageSizeSelect = styled.select<{ theme: any }>`
  height: 32px;
  padding: 0 0.5rem;
  border-radius: ${p => p.theme.radius.field};
  border: 1px solid ${p => p.theme.colors.base[300]};
  background-color: ${p => p.theme.colors.base[400]};
  color: ${p => p.theme.colors.base.content};
  font-size: 0.8125rem;
  cursor: pointer;
  transition: border-color 0.15s ease;
  margin-left: 0.25rem;

  &:focus { outline: none; border-color: ${p => p.theme.colors.primary.main}; }

  option {
    background-color: ${p => p.theme.colors.base[200]};
    color: ${p => p.theme.colors.base.content};
  }
`;