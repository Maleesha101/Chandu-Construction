-- Fix bank account ledger entry creation
-- Instead of raising an error when bank account not found in ledger,
-- automatically create the ledger account entry (similar to how deposits work)

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
    p_purpose || ' - To: ' || p_to_name,
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

COMMENT ON FUNCTION create_expense_ledger_entries IS 'Creates double-entry ledger records. Automatically creates bank ledger accounts if they don''t exist. If beneficiary is a user, debits their account (liability). If expense category, debits expense account. Always credits source (bank/petty cash).';
