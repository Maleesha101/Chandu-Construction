-- Update ledger system to handle payments to users differently
-- When beneficiary is a user (from users table), create a debit to their account instead of expense

-- Add 'user' to account_category enum
ALTER TYPE account_category ADD VALUE IF NOT EXISTS 'user';

-- Drop and recreate the function with updated logic
DROP FUNCTION IF EXISTS create_expense_ledger_entries(UUID, DECIMAL, TEXT, VARCHAR, UUID, UUID, TIMESTAMP WITH TIME ZONE, UUID, TEXT, VARCHAR);

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
  v_is_user_payment BOOLEAN := false;
BEGIN
  -- First, check if the beneficiary (to_name) is a user account
  SELECT id, full_name INTO v_to_user_id, v_to_user_name
  FROM users 
  WHERE full_name = p_to_name AND active = true
  LIMIT 1;
  
  IF v_to_user_id IS NOT NULL THEN
    -- This is a payment to a user account, not an expense
    v_is_user_payment := true;
    
    -- Create or get user's ledger account (DEBIT side - increases their balance)
    v_account_code := 'USER-' || UPPER(REPLACE(v_to_user_name, ' ', '-'));
    v_account_name := 'User Account: ' || v_to_user_name;
    
    v_debit_account_id := get_or_create_ledger_account(
      v_account_code,
      v_account_name,
      'liability',  -- User accounts are liabilities (company owes them money)
      'user',
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
        v_credit_account_id := get_or_create_ledger_account(
          'CASH-GENERAL',
          'Petty Cash - General',
          'asset',
          'petty_cash',
          NULL
        );
      END IF;
    ELSE
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
    v_credit_account_id := get_or_create_ledger_account(
      'LIABILITY-PAYABLE',
      'Expenses Payable',
      'liability',
      'general',
      NULL
    );
  END IF;
  
  -- Create DEBIT entry (Expense/User account increases)
  -- For user payments: debit increases liability (company owes them more)
  -- For expenses: debit increases expense
  INSERT INTO ledger_entries (
    transaction_date, account_id, expense_record_id, debit, credit,
    description, reference_number, created_by
  ) VALUES (
    p_transaction_date, v_debit_account_id, p_expense_id, p_amount, 0,
    CASE 
      WHEN v_is_user_payment THEN 'Payment to ' || p_to_name || ' - ' || p_purpose
      ELSE p_purpose || ' - ' || p_to_name
    END,
    'EXP-' || p_expense_id::TEXT,
    p_created_by
  );
  
  -- Calculate new balance for the credit account (bank/petty cash decreases)
  v_new_balance := (SELECT balance FROM ledger_accounts WHERE id = v_credit_account_id) - p_amount;
  
  -- Create CREDIT entry (Asset decreases - money going out)
  INSERT INTO ledger_entries (
    transaction_date, account_id, expense_record_id, debit, credit,
    description, reference_number, created_by, balance_after
  ) VALUES (
    p_transaction_date, v_credit_account_id, p_expense_id, 0, p_amount,
    CASE 
      WHEN v_is_user_payment THEN 'Payment to ' || p_to_name || ' - ' || p_purpose
      ELSE p_purpose || ' - ' || p_to_name
    END,
    'EXP-' || p_expense_id::TEXT,
    p_created_by,
    v_new_balance
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

COMMENT ON FUNCTION create_expense_ledger_entries IS 'Creates double-entry ledger records. If beneficiary is a user, debits their account (liability). If expense category, debits expense account. Always credits source (bank/petty cash).';
