// ============================================================
// campaigns.types.ts - Shared TypeScript interfaces
// ============================================================

export interface CampaignStats {
  campaign_id:     number;
  campaign_name:   string;
  companies_count: number;
  created_at:      string;
  // Flattened from backend EmailStats object
  sent:      number;
  read:      number;
  failed:    number;
  draft:     number;
  scheduled: number;
  read_rate: number;
}

export interface OverallStats {
  total_campaigns:          number;
  total_companies:          number;
  total_campaign_companies: number;
  total_attachments:        number;
  total_categories:         number;
  // Flattened from backend emails: EmailStats
  total_sent:      number;
  total_read:      number;
  total_failed:    number;
  total_draft:     number;
  total_scheduled: number;
  overall_read_rate: number;
  // Populated from paginated campaign fetch (current page only)
  campaigns: CampaignStats[];
}

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
}

export interface ToastState {
  isVisible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export interface CampaignsProps {
  onCampaignClick?: (campaignId: number) => void;
}