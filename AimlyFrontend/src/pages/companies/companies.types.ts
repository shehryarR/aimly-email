// ============================================================
// companies.types.ts
// ============================================================

/** Matches backend CompanyResponse exactly */
export interface Company {
  id: number;
  user_id: number;
  name: string;         // backend field: name  (NOT company_name)
  email: string;        // backend field: email (NOT company_email)
  phone_number?: string | null;
  address?: string | null;
  company_info?: string | null;
  created_at: string;
  optedOut?: boolean;
}

/** Thin campaign shape used for the filter bar and assign modal */
export interface CampaignOption {
  id: number;
  name: string;
}

/** A company enriched with the campaigns it belongs to (client-side join) */
export interface CompanyWithCampaigns extends Company {
  campaign_ids: number[];
  category_ids: number[];
}

export interface ToastState {
  isVisible: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
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

export interface CompaniesProps {
  onCompanyClick?: (company: Company) => void;
}