export type AppRole = 'boss' | 'admin' | 'qs' | 'md' | 'viewer';

export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'wd_pending' | 'wd_approved' | 'wd_rejected';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number: string | null;
  balance: number;
  currency: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManagingDirector {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  float_balance: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  name: string;
  location: string | null;
  code: string | null;
  active: boolean;
  created_at: string;
  petty_cash_expenses?: number;
  total_expenses?: number;
  petty_cash_count?: number;
  total_expense_count?: number;
}

export interface ExpenseRecord {
  id: string;
  entry_date: string;
  entered_by_user_id: string;
  md_id: string | null;
  from_bank_account_id: string | null;
  to_name: string;
  purpose: string;
  site_id: string | null;
  amount: number;
  payment_method: string;
  status: ExpenseStatus;
  reference: string | null;
  wd_reason: string | null;
  qs_notes: string | null;
  week_start: string | null;
  week_end: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  entered_by_name?: string;
  from_person_name?: string;
  site_name?: string;
  site_code?: string;
  bank_name?: string;
  md_name?: string;
  managing_director?: ManagingDirector;
  bank_account?: BankAccount;
  site?: Site;
  entered_by?: Profile;
}

export interface RecordAttachment {
  id: string;
  record_id: string;
  filename: string;
  url: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface LedgerEntry {
  id: string;
  record_id: string | null;
  funding_id: string | null;
  account_code: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance_after: number | null;
  created_at: string;
}

export type AccountType = 'asset' | 'liability' | 'expense' | 'revenue';
export type AccountCategory = 'bank' | 'supervisor' | 'machine' | 'rent' | 'general' | 'petty_cash' | 'user';

export interface LedgerAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  account_category: AccountCategory;
  parent_account_id: string | null;
  reference_id: string | null;
  balance: number;
  active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  bank_account_name?: string;
  bank_name?: string;
  supervisor_name?: string;
  transaction_count?: number;
}

export interface LedgerEntryDetail {
  id: string;
  transaction_date: string;
  account_id: string;
  expense_record_id: string | null;
  debit: number;
  credit: number;
  balance_after: number | null;
  description: string | null;
  reference_number: string | null;
  created_by: string | null;
  created_at: string;
  // Joined fields
  expense_date?: string;
  expense_to_name?: string;
  expense_purpose?: string;
  expense_amount?: number;
  from_person_name?: string;
  site_name?: string;
  created_by_name?: string;
}

export interface TrialBalance {
  accounts: {
    id: string;
    account_code: string;
    account_name: string;
    account_type: AccountType;
    account_category: AccountCategory;
    total_debit: number;
    total_credit: number;
    current_balance: number;
  }[];
  totals: {
    totalDebit: number;
    totalCredit: number;
  };
  balanced: boolean;
}

export interface ExpenseBreakdown {
  account_category: AccountCategory;
  account_name: string;
  expense_count: number;
  total_amount: number;
}

export interface Approval {
  id: string;
  record_id: string;
  approver_user_id: string;
  action: string;
  note: string | null;
  created_at: string;
  approver?: Profile;
}

export interface FundingTransaction {
  id: string;
  bank_account_id: string;
  md_id: string | null;
  amount: number;
  funding_date: string;
  week_start: string | null;
  week_end: string | null;
  created_by: string | null;
  note: string | null;
  created_at: string;
  bank_account?: BankAccount;
  managing_director?: ManagingDirector;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface DashboardStats {
  totalBankBalance: number;
  pendingCount: number;
  wdPendingCount: number;
  weeklySpend: number;
  approvedThisWeek: number;
  rejectedThisWeek: number;
}
