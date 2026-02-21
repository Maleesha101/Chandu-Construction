-- Double-Entry Ledger System for Expense Tracking
-- This migration creates a proper chart of accounts and double-entry bookkeeping

-- Create ledger account types
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'expense', 'revenue');
CREATE TYPE account_category AS ENUM ('bank', 'supervisor', 'machine', 'rent', 'general');

-- Create ledger_accounts table (Chart of Accounts)
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code VARCHAR(50) UNIQUE NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  account_category account_category NOT NULL,
  parent_account_id UUID REFERENCES ledger_accounts(id),
  reference_id UUID, -- Links to bank_accounts.id, managing_directors.id, etc.
  balance DECIMAL(15, 2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop old ledger_entries table if exists and recreate with proper structure
DROP TABLE IF EXISTS ledger_entries CASCADE;

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

-- Create indexes for performance
CREATE INDEX idx_ledger_accounts_type ON ledger_accounts(account_type);
CREATE INDEX idx_ledger_accounts_category ON ledger_accounts(account_category);
CREATE INDEX idx_ledger_accounts_reference ON ledger_accounts(reference_id);
CREATE INDEX idx_ledger_entries_account ON ledger_entries(account_id);
CREATE INDEX idx_ledger_entries_expense ON ledger_entries(expense_record_id);
CREATE INDEX idx_ledger_entries_date ON ledger_entries(transaction_date DESC);

-- Create updated_at trigger for ledger_accounts
CREATE TRIGGER update_ledger_accounts_updated_at 
  BEFORE UPDATE ON ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
  p_created_by UUID
) RETURNS VOID AS $$
DECLARE
  v_debit_account_id UUID;
  v_credit_account_id UUID;
  v_account_code VARCHAR(50);
  v_account_name VARCHAR(255);
  v_account_category account_category;
BEGIN
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
  
  -- Determine credit account (source of funds)
  IF p_from_bank_id IS NOT NULL THEN
    -- Payment from bank account
    SELECT name, bank_name INTO v_account_name
    FROM bank_accounts WHERE id = p_from_bank_id;
    
    v_account_code := 'BANK-' || UPPER(REPLACE(v_account_name, ' ', '-'));
    
    v_credit_account_id := get_or_create_ledger_account(
      v_account_code,
      v_account_name || ' - ' || (SELECT bank_name FROM bank_accounts WHERE id = p_from_bank_id),
      'asset',
      'bank',
      p_from_bank_id
    );
  ELSIF p_md_id IS NOT NULL THEN
    -- Payment from supervisor float
    SELECT name INTO v_account_name
    FROM managing_directors WHERE id = p_md_id;
    
    v_account_code := 'SUP-' || UPPER(REPLACE(v_account_name, ' ', '-'));
    
    v_credit_account_id := get_or_create_ledger_account(
      v_account_code,
      'Supervisor: ' || v_account_name,
      'liability',
      'supervisor',
      p_md_id
    );
  ELSE
    -- Default to general expenses payable
    v_credit_account_id := get_or_create_ledger_account(
      'LIABILITY-PAYABLE',
      'Expenses Payable',
      'liability',
      'general',
      NULL
    );
  END IF;
  
  -- Create DEBIT entry (Expense increases)
  INSERT INTO ledger_entries (
    transaction_date, account_id, expense_record_id, debit, credit,
    description, reference_number, created_by
  ) VALUES (
    p_transaction_date, v_debit_account_id, p_expense_id, p_amount, 0,
    p_purpose || ' - ' || p_to_name,
    'EXP-' || p_expense_id::TEXT,
    p_created_by
  );
  
  -- Create CREDIT entry (Asset/Liability decreases)
  INSERT INTO ledger_entries (
    transaction_date, account_id, expense_record_id, debit, credit,
    description, reference_number, created_by
  ) VALUES (
    p_transaction_date, v_credit_account_id, p_expense_id, 0, p_amount,
    p_purpose || ' - ' || p_to_name,
    'EXP-' || p_expense_id::TEXT,
    p_created_by
  );
  
  -- Update account balances
  UPDATE ledger_accounts 
  SET balance = balance + p_amount 
  WHERE id = v_debit_account_id;
  
  UPDATE ledger_accounts 
  SET balance = balance - p_amount 
  WHERE id = v_credit_account_id;
  
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically create ledger entries when expense is approved
CREATE OR REPLACE FUNCTION trigger_create_expense_ledger() 
RETURNS TRIGGER AS $$
BEGIN
  -- Only create ledger entries when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    PERFORM create_expense_ledger_entries(
      NEW.id,
      NEW.amount,
      NEW.purpose,
      NEW.to_name,
      NEW.from_bank_account_id,
      NEW.md_id,
      NEW.updated_at,
      NEW.entered_by_user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on expense_records
DROP TRIGGER IF EXISTS expense_approved_ledger_trigger ON expense_records;
CREATE TRIGGER expense_approved_ledger_trigger
  AFTER INSERT OR UPDATE ON expense_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_expense_ledger();

-- Create seed ledger accounts for common categories
INSERT INTO ledger_accounts (account_code, account_name, account_type, account_category, description)
VALUES
  ('EXP-MACHINE', 'Machine Expenses', 'expense', 'machine', 'All machine-related expenses'),
  ('EXP-RENT', 'Rent Expenses', 'expense', 'rent', 'All rental expenses'),
  ('EXP-GENERAL', 'General Expenses', 'expense', 'general', 'General operational expenses'),
  ('LIABILITY-PAYABLE', 'Expenses Payable', 'liability', 'general', 'Outstanding expenses payable')
ON CONFLICT (account_code) DO NOTHING;

-- Create ledger accounts for existing bank accounts
INSERT INTO ledger_accounts (account_code, account_name, account_type, account_category, reference_id, balance)
SELECT 
  'BANK-' || UPPER(REPLACE(name, ' ', '-')),
  name || ' - ' || bank_name,
  'asset',
  'bank',
  id,
  balance
FROM bank_accounts
ON CONFLICT (account_code) DO NOTHING;

-- Create ledger accounts for existing supervisors
INSERT INTO ledger_accounts (account_code, account_name, account_type, account_category, reference_id, balance)
SELECT 
  'SUP-' || UPPER(REPLACE(name, ' ', '-')),
  'Supervisor: ' || name,
  'liability',
  'supervisor',
  id,
  float_balance
FROM managing_directors
ON CONFLICT (account_code) DO NOTHING;
