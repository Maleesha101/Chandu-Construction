export type AppRole = 'boss' | 'admin' | 'qs' | 'md';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'wd_pending' | 'wd_approved' | 'wd_rejected';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: AppRole;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: AppRole;
}

export interface ExpenseRecord {
  id: string;
  entry_date: Date;
  entered_by_user_id: string;
  md_id?: string;
  from_bank_account_id?: string;
  to_name: string;
  purpose: string;
  site_id?: string;
  amount: number;
  payment_method: string;
  status: ExpenseStatus;
  reference?: string;
  wd_reason?: string;
  qs_notes?: string;
  week_start?: Date;
  week_end?: Date;
  created_at: Date;
  updated_at: Date;
}
