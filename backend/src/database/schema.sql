-- Create ENUM types
CREATE TYPE app_role AS ENUM ('boss', 'admin', 'qs', 'md', 'worker', 'user');
CREATE TYPE expense_status AS ENUM ('pending', 'approved', 'rejected', 'wd_pending', 'wd_approved', 'wd_rejected');
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'expense', 'revenue');
CREATE TYPE account_category AS ENUM ('bank', 'supervisor', 'machine', 'rent', 'general', 'petty_cash', 'user');

-- Users table (replaces auth.users from Supabase)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role app_role NOT NULL DEFAULT 'md',
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

-- Supervisors table
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

-- Cheques table
CREATE TABLE IF NOT EXISTS cheques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES bank_accounts(id),
  cheque_number VARCHAR(100) NOT NULL,
  payee_name VARCHAR(255) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  cheque_date DATE NOT NULL,
  deposit_date DATE,
  deposited_to_account_id UUID REFERENCES bank_accounts(id),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'deposited', 'cleared', 'bounced', 'cancelled')),
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ledger accounts table (Chart of Accounts)
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code VARCHAR(50) UNIQUE NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  account_category account_category NOT NULL,
  parent_account_id UUID REFERENCES ledger_accounts(id),
  reference_id UUID, -- Links to bank_accounts.id, managing_directors.id, users.id, etc.
  balance DECIMAL(15, 2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ledger entries table (Double-entry bookkeeping)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  account_id UUID REFERENCES ledger_accounts(id) NOT NULL,
  expense_record_id UUID REFERENCES expense_records(id) ON DELETE CASCADE,
  debit DECIMAL(15, 2) DEFAULT 0 CHECK (debit >= 0),
  credit DECIMAL(15, 2) DEFAULT 0 CHECK (credit >= 0),
  balance_after DECIMAL(15, 2),
  description TEXT,
  reference_number VARCHAR(100),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT debit_or_credit_only CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
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
  from_account_id UUID REFERENCES bank_accounts(id),
  to_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  transfer_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  cheque_id UUID REFERENCES cheques(id),
  transfer_type VARCHAR(50) DEFAULT 'manual' CHECK (transfer_type IN ('manual', 'cheque_deposit', 'expense')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT different_accounts CHECK (from_account_id IS NULL OR from_account_id != to_account_id)
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
CREATE INDEX idx_bank_transfers_cheque ON bank_transfers(cheque_id);
CREATE INDEX idx_cheques_deposited_to ON cheques(deposited_to_account_id);
CREATE INDEX idx_cheques_status ON cheques(status);
CREATE INDEX idx_cheques_date ON cheques(cheque_date DESC);
CREATE INDEX idx_ledger_accounts_type ON ledger_accounts(account_type);
CREATE INDEX idx_ledger_accounts_category ON ledger_accounts(account_category);
CREATE INDEX idx_ledger_accounts_reference ON ledger_accounts(reference_id);
CREATE INDEX idx_ledger_entries_account ON ledger_entries(account_id);
CREATE INDEX idx_ledger_entries_expense ON ledger_entries(expense_record_id);
CREATE INDEX idx_ledger_entries_date ON ledger_entries(transaction_date DESC);

-- Create sequence for expense reference numbers
CREATE SEQUENCE IF NOT EXISTS expense_reference_seq START 1;

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

CREATE TRIGGER update_cheques_updated_at BEFORE UPDATE ON cheques
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ledger_accounts_updated_at BEFORE UPDATE ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================================================
-- LEDGER SYSTEM FUNCTIONS
-- ============================================================================

-- Function to get or create ledger account
CREATE OR REPLACE FUNCTION get_or_create_ledger_account(
  p_account_code VARCHAR(50),
  p_account_name VARCHAR(255),
  p_account_type account_type,
  p_account_category account_category,
  p_reference_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Try to find existing account
  SELECT id INTO v_account_id 
  FROM ledger_accounts 
  WHERE account_code = p_account_code;
  
  -- If not found, create it
  IF v_account_id IS NULL THEN
    INSERT INTO ledger_accounts (account_code, account_name, account_type, account_category, reference_id)
    VALUES (p_account_code, p_account_name, p_account_type, p_account_category, p_reference_id)
    RETURNING id INTO v_account_id;
  END IF;
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create double-entry for expense
CREATE OR REPLACE FUNCTION create_expense_ledger_entries(
  p_expense_id UUID,
  p_amount DECIMAL(15, 2),
  p_purpose TEXT,
  p_to_name VARCHAR(200),
  p_from_bank_id UUID,
  p_md_id UUID,
  p_transaction_date TIMESTAMP WITH TIME ZONE,
  p_created_by UUID,
  p_from_person_name TEXT,
  p_payment_method VARCHAR(50)
) RETURNS VOID AS $$
DECLARE
  v_debit_account_id UUID;
  v_credit_account_id UUID;
  v_account_code VARCHAR(50);
  v_account_name VARCHAR(255);
  v_account_category account_category;
  v_from_user_id UUID;
  v_from_user_name VARCHAR(255);
  v_to_user_id UUID;
  v_to_user_name VARCHAR(255);
  v_new_balance DECIMAL(15, 2);
  v_is_user_cash BOOLEAN := false;
  v_bank_name VARCHAR(255);
  v_bank_account_name VARCHAR(255);
BEGIN
  -- First, check if the beneficiary (to_name) is a user account
  SELECT id, full_name INTO v_to_user_id, v_to_user_name
  FROM users 
  WHERE full_name = p_to_name AND active = true
  LIMIT 1;
  
  IF v_to_user_id IS NOT NULL THEN
    -- This is a payment to a user account - add to their petty cash
    v_is_user_cash := true;
    
    -- Create or get user's cash account (DEBIT side - increases their cash balance)
    v_account_code := 'CASH-' || UPPER(REPLACE(v_to_user_name, ' ', '-'));
    v_account_name := 'Petty Cash: ' || v_to_user_name;
    
    v_debit_account_id := get_or_create_ledger_account(
      v_account_code,
      v_account_name,
      'asset',  -- Cash held by person is an asset
      'petty_cash',
      v_to_user_id
    );
  ELSE
    -- Regular expense entry
    -- Determine expense category based on purpose/to_name
    IF LOWER(p_purpose) LIKE '%machine%' OR LOWER(p_to_name) LIKE '%machine%' THEN
      v_account_category := 'machine';
      v_account_code := 'EXP-MACHINE';
      v_account_name := 'Machine Expenses';
    ELSIF LOWER(p_purpose) LIKE '%rent%' OR LOWER(p_to_name) LIKE '%rent%' THEN
      v_account_category := 'rent';
      v_account_code := 'EXP-RENT';
      v_account_name := 'Rent Expenses';
    ELSE
      v_account_category := 'general';
      v_account_code := 'EXP-GENERAL';
      v_account_name := 'General Expenses';
    END IF;
    
    -- Get or create expense account (DEBIT side)
    v_debit_account_id := get_or_create_ledger_account(
      v_account_code,
      v_account_name,
      'expense',
      v_account_category,
      NULL
    );
  END IF;
  
  -- Determine credit account (source of funds)
  IF p_payment_method = 'cash' OR p_payment_method = 'petty_cash' THEN
    -- Petty cash payment - track by person
    IF p_from_person_name IS NOT NULL AND p_from_person_name != '' THEN
      SELECT id, full_name INTO v_from_user_id, v_from_user_name
      FROM users 
      WHERE full_name = p_from_person_name AND active = true
      LIMIT 1;
      
      IF v_from_user_id IS NOT NULL THEN
        -- Create petty cash account for this specific person (CREDIT side - decreases their cash)
        v_account_code := 'CASH-' || UPPER(REPLACE(v_from_user_name, ' ', '-'));
        v_account_name := 'Petty Cash: ' || v_from_user_name;
        
        v_credit_account_id := get_or_create_ledger_account(
          v_account_code,
          v_account_name,
          'asset',
          'petty_cash',
          v_from_user_id
        );
      ELSE
        -- Fallback to generic petty cash account if person not found in users table
        v_credit_account_id := get_or_create_ledger_account(
          'CASH-PETTY',
          'Petty Cash',
          'asset',
          'petty_cash',
          NULL
        );
      END IF;
    ELSE
      -- Generic petty cash account if no person specified
      v_credit_account_id := get_or_create_ledger_account(
        'CASH-PETTY',
        'Petty Cash',
        'asset',
        'petty_cash',
        NULL
      );
    END IF;
  ELSIF p_from_bank_id IS NOT NULL THEN
    -- Bank account payment - Get or create bank ledger account
    SELECT name, bank_name INTO v_bank_account_name, v_bank_name
    FROM bank_accounts
    WHERE id = p_from_bank_id;
    
    IF v_bank_account_name IS NULL THEN
      RAISE EXCEPTION 'Bank account not found: %', p_from_bank_id;
    END IF;
    
    -- Generate account code and get/create ledger account
    v_account_code := 'BANK-' || UPPER(REPLACE(v_bank_account_name, ' ', '-'));
    v_account_name := v_bank_account_name || ' - ' || v_bank_name;
    
    v_credit_account_id := get_or_create_ledger_account(
      v_account_code,
      v_account_name,
      'asset',
      'bank',
      p_from_bank_id
    );
  ELSE
    -- Default to generic cash if no source specified
    v_credit_account_id := get_or_create_ledger_account(
      'CASH-PETTY',
      'Petty Cash',
      'asset',
      'petty_cash',
      NULL
    );
  END IF;
  
  -- Calculate new balance for debit account (increases)
  SELECT COALESCE(balance, 0) + p_amount INTO v_new_balance
  FROM ledger_accounts WHERE id = v_debit_account_id;
  
  -- Create debit entry
  INSERT INTO ledger_entries (
    account_id,
    transaction_date,
    expense_record_id,
    debit,
    credit,
    description,
    reference_number,
    created_by,
    balance_after
  ) VALUES (
    v_debit_account_id,
    p_transaction_date,
    p_expense_id,
    p_amount,
    0,
    p_purpose || ' - To: ' || p_to_name,
    'EXP-' || SUBSTRING(p_expense_id::TEXT FROM 1 FOR 8),
    p_created_by,
    v_new_balance
  );
  
  -- Update debit account balance
  UPDATE ledger_accounts 
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = v_debit_account_id;
  
  -- Calculate new balance for credit account (decreases)
  SELECT COALESCE(balance, 0) - p_amount INTO v_new_balance
  FROM ledger_accounts WHERE id = v_credit_account_id;
  
  -- Create credit entry
  INSERT INTO ledger_entries (
    account_id,
    transaction_date,
    expense_record_id,
    debit,
    credit,
    description,
    reference_number,
    created_by,
    balance_after
  ) VALUES (
    v_credit_account_id,
    p_transaction_date,
    p_expense_id,
    0,
    p_amount,
    p_purpose || ' - From: ' || COALESCE(p_from_person_name, 'Bank'),
    'EXP-' || SUBSTRING(p_expense_id::TEXT FROM 1 FOR 8),
    p_created_by,
    v_new_balance
  );
  
  -- Update credit account balance
  UPDATE ledger_accounts 
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE id = v_credit_account_id;
  
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically create ledger entries when expense is approved
CREATE OR REPLACE FUNCTION trigger_create_expense_ledger() 
RETURNS TRIGGER AS $$
BEGIN
  -- Create ledger entries when status changes to 'approved' or 'wd_approved'
  IF (NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved')) OR
     (NEW.status = 'wd_approved' AND (OLD.status IS NULL OR OLD.status != 'wd_approved')) THEN
    PERFORM create_expense_ledger_entries(
      NEW.id,
      NEW.amount,
      NEW.purpose,
      NEW.to_name,
      NEW.from_bank_account_id,
      NEW.md_id,
      NEW.entry_date,  -- Use entry_date (transaction date) instead of updated_at
      NEW.entered_by_user_id,
      NEW.qs_notes,  -- This contains from_person_name
      NEW.payment_method
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on expense_records
DROP TRIGGER IF EXISTS expense_approved_ledger_trigger ON expense_records;
CREATE TRIGGER expense_approved_ledger_trigger
  AFTER UPDATE OF status ON expense_records
  FOR EACH ROW
  WHEN (
    (NEW.status = 'approved' AND OLD.status != 'approved') OR
    (NEW.status = 'wd_approved' AND OLD.status != 'wd_approved')
  )
  EXECUTE FUNCTION trigger_create_expense_ledger();

-- Function to create ledger entries for bank deposits (cheques)
CREATE OR REPLACE FUNCTION create_bank_deposit_ledger_entry(
  p_bank_account_id UUID,
  p_amount DECIMAL(15, 2),
  p_description TEXT,
  p_reference_number VARCHAR(100),
  p_deposit_date TIMESTAMP WITH TIME ZONE,
  p_created_by UUID
) RETURNS VOID AS $$
DECLARE
  v_bank_account_id UUID;
  v_account_code VARCHAR(50);
  v_account_name VARCHAR(255);
  v_revenue_account_id UUID;
  v_current_balance DECIMAL(15, 2);
  v_new_balance DECIMAL(15, 2);
  v_bank_name VARCHAR(255);
  v_bank_account_name VARCHAR(255);
BEGIN
  -- Get bank account details
  SELECT name, bank_name, balance INTO v_bank_account_name, v_bank_name, v_current_balance
  FROM bank_accounts WHERE id = p_bank_account_id;
  
  v_account_code := 'BANK-' || UPPER(REPLACE(v_bank_account_name, ' ', '-'));
  v_account_name := v_bank_account_name || ' - ' || v_bank_name;
  
  -- Get or create bank ledger account
  v_bank_account_id := get_or_create_ledger_account(
    v_account_code,
    v_account_name,
    'asset',
    'bank',
    p_bank_account_id
  );
  
  -- Get or create revenue/income account for deposits
  v_revenue_account_id := get_or_create_ledger_account(
    'REV-DEPOSITS',
    'Bank Deposits & Income',
    'revenue',
    'general',
    NULL
  );
  
  -- Calculate new balance (balance after this transaction)
  v_new_balance := (SELECT balance FROM ledger_accounts WHERE id = v_bank_account_id) + p_amount;
  
  -- Create DEBIT entry (Bank account increases - money coming in)
  INSERT INTO ledger_entries (
    transaction_date, account_id, debit, credit,
    description, reference_number, created_by, balance_after
  ) VALUES (
    p_deposit_date, v_bank_account_id, p_amount, 0,
    p_description,
    p_reference_number,
    p_created_by,
    v_new_balance
  );
  
  -- Create CREDIT entry (Revenue increases)
  INSERT INTO ledger_entries (
    transaction_date, account_id, debit, credit,
    description, reference_number, created_by
  ) VALUES (
    p_deposit_date, v_revenue_account_id, 0, p_amount,
    p_description,
    p_reference_number,
    p_created_by
  );
  
  -- Update account balances
  UPDATE ledger_accounts 
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = v_bank_account_id;
  
  UPDATE ledger_accounts 
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = v_revenue_account_id;
  
END;
$$ LANGUAGE plpgsql;

-- Trigger function for bank deposits
CREATE OR REPLACE FUNCTION trigger_create_bank_deposit_ledger() 
RETURNS TRIGGER AS $$
BEGIN
  -- Only create ledger entries for cheque deposits (money coming in)
  IF NEW.transfer_type = 'cheque_deposit' AND NEW.to_account_id IS NOT NULL THEN
    PERFORM create_bank_deposit_ledger_entry(
      NEW.to_account_id,
      NEW.amount,
      NEW.description,
      'CHEQUE-' || NEW.id::TEXT,
      NEW.transfer_date,
      NULL  -- bank_transfers doesn't have created_by, pass NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on bank_transfers
DROP TRIGGER IF EXISTS bank_deposit_ledger_trigger ON bank_transfers;
CREATE TRIGGER bank_deposit_ledger_trigger
  AFTER INSERT ON bank_transfers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_bank_deposit_ledger();

-- ============================================================================
-- EXPENSE REFERENCE AUTO-GENERATION
-- ============================================================================

-- Function to generate unique expense reference number
CREATE OR REPLACE FUNCTION generate_expense_reference()
RETURNS VARCHAR(200) AS $$
DECLARE
  v_year VARCHAR(4);
  v_seq_num INTEGER;
  v_reference VARCHAR(200);
  v_exists BOOLEAN;
BEGIN
  -- Get current year from entry_date if available, otherwise use current year
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Loop until we find a unique reference
  LOOP
    -- Get next sequence number
    v_seq_num := nextval('expense_reference_seq');
    
    -- Format: EXP-YYYY-NNNN (e.g., EXP-2026-0001)
    v_reference := 'EXP-' || v_year || '-' || LPAD(v_seq_num::TEXT, 4, '0');
    
    -- Check if this reference already exists
    SELECT EXISTS(SELECT 1 FROM expense_records WHERE reference = v_reference) INTO v_exists;
    
    -- If it doesn't exist, we can use it
    IF NOT v_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN v_reference;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-generate reference on INSERT
CREATE OR REPLACE FUNCTION auto_generate_expense_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if reference is NULL or empty
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := generate_expense_reference();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for expense reference
DROP TRIGGER IF EXISTS expense_reference_trigger ON expense_records;
CREATE TRIGGER expense_reference_trigger
  BEFORE INSERT ON expense_records
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_expense_reference();

-- ============================================================================
-- SEED DATA FOR LEDGER ACCOUNTS
-- ============================================================================

-- Create seed ledgeraccounts for common categories
INSERT INTO ledger_accounts (account_code, account_name, account_type, account_category, description)
VALUES
  ('EXP-MACHINE', 'Machine Expenses', 'expense', 'machine', 'All machine-related expenses'),
  ('EXP-RENT', 'Rent Expenses', 'expense', 'rent', 'All rental expenses'),
  ('EXP-GENERAL', 'General Expenses', 'expense', 'general', 'General operational expenses'),
  ('LIABILITY-PAYABLE', 'Expenses Payable', 'liability', 'general', 'Outstanding expenses payable'),
  ('REV-DEPOSITS', 'Bank Deposits & Income', 'revenue', 'general', 'Income from cheque deposits and other bank deposits'),
  ('CASH-PETTY', 'Petty Cash', 'asset', 'petty_cash', 'General petty cash account')
ON CONFLICT (account_code) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TYPE app_role IS 'Application roles: boss (owner), admin, qs (quantity surveyor), md (supervisor), worker';
COMMENT ON TYPE account_type IS 'Ledger account types following double-entry bookkeeping: asset, liability, expense, revenue';
COMMENT ON TYPE account_category IS 'Ledger account categories for classification';
COMMENT ON TABLE ledger_entries IS 'Double-entry ledger entries. transaction_date reflects the actual transaction date from expense_records.entry_date';
COMMENT ON TABLE expense_records IS 'Expense records. Both approved and wd_approved status trigger ledger entry creation';
COMMENT ON FUNCTION get_or_create_ledger_account IS 'Gets existing or creates new ledger account';
COMMENT ON FUNCTION create_expense_ledger_entries IS 'Creates double-entry ledger records for approved expenses';
COMMENT ON FUNCTION trigger_create_expense_ledger IS 'Automatically creates ledger entries when expense is approved or wd_approved';
COMMENT ON FUNCTION create_bank_deposit_ledger_entry IS 'Creates double-entry ledger records for bank deposits/cheques';
COMMENT ON FUNCTION trigger_create_bank_deposit_ledger IS 'Automatically creates ledger entries when cheques are deposited';
COMMENT ON FUNCTION generate_expense_reference IS 'Generates unique expense reference numbers in format EXP-YYYY-NNNN';
COMMENT ON FUNCTION auto_generate_expense_reference IS 'Trigger function to automatically assign reference numbers to new expense records';