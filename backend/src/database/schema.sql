-- Create ENUM types
CREATE TYPE app_role AS ENUM ('boss', 'admin', 'qs', 'md', 'viewer');
CREATE TYPE expense_status AS ENUM ('pending', 'approved', 'rejected', 'wd_pending', 'wd_approved', 'wd_rejected');

-- Users table (replaces auth.users from Supabase)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role app_role NOT NULL DEFAULT 'viewer',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  balance DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'LKR',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Managing directors table
CREATE TABLE IF NOT EXISTS managing_directors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact VARCHAR(50),
  email VARCHAR(255),
  float_balance DECIMAL(15, 2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sites table
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  location TEXT,
  code VARCHAR(50) UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expense records table
CREATE TABLE IF NOT EXISTS expense_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entered_by_user_id UUID REFERENCES users(id) NOT NULL,
  md_id UUID REFERENCES managing_directors(id),
  from_bank_account_id UUID REFERENCES bank_accounts(id),
  to_name VARCHAR(200) NOT NULL,
  purpose TEXT NOT NULL,
  site_id UUID REFERENCES sites(id),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) DEFAULT 'cash',
  status expense_status DEFAULT 'pending',
  reference VARCHAR(200),
  wd_reason TEXT,
  qs_notes TEXT,
  week_start DATE,
  week_end DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Record attachments table
CREATE TABLE IF NOT EXISTS record_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES expense_records(id) ON DELETE CASCADE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approvals table
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES expense_records(id) ON DELETE CASCADE NOT NULL,
  approver_id UUID REFERENCES users(id) NOT NULL,
  approved BOOLEAN NOT NULL,
  comments TEXT,
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ledger entries table
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES expense_records(id) ON DELETE CASCADE,
  account_code VARCHAR(50),
  description TEXT,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  balance_after DECIMAL(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Funding transactions table
CREATE TABLE IF NOT EXISTS funding_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(255) NOT NULL,
  destination_bank_id UUID REFERENCES bank_accounts(id),
  destination_md_id UUID REFERENCES managing_directors(id),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank transfers table for inter-account transfers
CREATE TABLE IF NOT EXISTS bank_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  to_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  transfer_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT different_accounts CHECK (from_account_id != to_account_id)
);

-- Create indexes
CREATE INDEX idx_expense_records_status ON expense_records(status);
CREATE INDEX idx_expense_records_site_id ON expense_records(site_id);
CREATE INDEX idx_expense_records_entry_date ON expense_records(entry_date);
CREATE INDEX idx_expense_records_entered_by ON expense_records(entered_by_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_approvals_record_id ON approvals(record_id);
CREATE INDEX idx_bank_transfers_from_account ON bank_transfers(from_account_id);
CREATE INDEX idx_bank_transfers_to_account ON bank_transfers(to_account_id);
CREATE INDEX idx_bank_transfers_date ON bank_transfers(transfer_date DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_managing_directors_updated_at BEFORE UPDATE ON managing_directors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_records_updated_at BEFORE UPDATE ON expense_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
