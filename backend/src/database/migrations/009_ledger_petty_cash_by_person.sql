-- Update ledger system to track petty cash by person
-- When payment_method is 'cash', create petty cash account for the specific person

-- First, add new account category for petty cash
ALTER TYPE account_category ADD VALUE IF NOT EXISTS 'petty_cash';

-- Drop the old version of the function
DROP FUNCTION IF EXISTS create_expense_ledger_entries(UUID, DECIMAL, TEXT, VARCHAR, UUID, UUID, TIMESTAMP WITH TIME ZONE, UUID);

-- Update the create_expense_ledger_entries function to handle petty cash by person
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
  IF p_payment_method = 'cash' OR p_payment_method = 'petty_cash' THEN
    -- Petty cash payment - track by person
    -- First, try to find the user by name from qs_notes (from_person_name)
    IF p_from_person_name IS NOT NULL AND p_from_person_name != '' THEN
      SELECT id, full_name INTO v_from_user_id, v_from_user_name
      FROM users 
      WHERE full_name = p_from_person_name AND active = true
      LIMIT 1;
      
      IF v_from_user_id IS NOT NULL THEN
        -- Create petty cash account for this specific person
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
        -- User not found, use generic petty cash
        v_credit_account_id := get_or_create_ledger_account(
          'CASH-GENERAL',
          'Petty Cash - General',
          'asset',
          'petty_cash',
          NULL
        );
      END IF;
    ELSE
      -- No person specified, use generic petty cash
      v_credit_account_id := get_or_create_ledger_account(
        'CASH-GENERAL',
        'Petty Cash - General',
        'asset',
        'petty_cash',
        NULL
      );
    END IF;
  ELSIF p_from_bank_id IS NOT NULL THEN
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

-- Update trigger function to pass new parameters
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
      NEW.entered_by_user_id,
      NEW.qs_notes,  -- This contains from_person_name
      NEW.payment_method
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_expense_ledger_entries IS 'Creates double-entry ledger records for approved expenses. Tracks petty cash by individual person when payment_method is cash.';
