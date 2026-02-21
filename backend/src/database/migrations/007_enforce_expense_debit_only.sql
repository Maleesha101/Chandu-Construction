-- Ensure expense accounts (Machine, Rent, General) can only receive DEBIT entries, never CREDIT
-- This enforces proper accounting: expenses always increase with debits, never credits

-- First, verify no existing credit entries to expense accounts
DO $$
DECLARE
  v_invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_invalid_count
  FROM ledger_entries le
  JOIN ledger_accounts la ON le.account_id = la.id
  WHERE la.account_type = 'expense' AND le.credit > 0;
  
  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % invalid credit entries to expense accounts. These should be corrected.', v_invalid_count;
  END IF;
END $$;

-- Update the trigger function to explicitly prevent credit entries to expense accounts
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
  -- Determine expense category based on to_name or purpose
  -- Machine and Rent are EXPENSE CATEGORIES, not payment recipients
  IF LOWER(p_to_name) = 'machine' OR LOWER(p_purpose) LIKE '%machine%' THEN
    v_account_category := 'machine';
    v_account_code := 'EXP-MACHINE';
    v_account_name := 'Machine Expenses';
  ELSIF LOWER(p_to_name) = 'rent' OR LOWER(p_purpose) LIKE '%rent%' THEN
    v_account_category := 'rent';
    v_account_code := 'EXP-RENT';
    v_account_name := 'Rent Expenses';
  ELSE
    v_account_category := 'general';
    v_account_code := 'EXP-GENERAL';
    v_account_name := 'General Expenses';
  END IF;
  
  -- Get or create expense account (DEBIT side - expense increases)
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
    SELECT name INTO v_account_name
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
  
  -- IMPORTANT: Expense accounts ONLY receive DEBIT entries (never credit)
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

-- Add helpful comments
COMMENT ON TABLE ledger_accounts IS 'Chart of Accounts - Machine and Rent are EXPENSE accounts (debit only), not payment sources';
COMMENT ON COLUMN ledger_accounts.account_type IS 'expense = debit only (spending increases), asset = debit increases (cash in), liability = credit increases (owes more)';

