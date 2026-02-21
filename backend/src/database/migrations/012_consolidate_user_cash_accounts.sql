-- Consolidate USER-{NAME} and CASH-{NAME} accounts into single CASH-{NAME} account per person
-- This ensures that petty cash and user payments are tracked in the same account

-- Step 1: Migrate all USER-{NAME} accounts to CASH-{NAME}
DO $$
DECLARE
  user_account RECORD;
  cash_account_id UUID;
  user_name TEXT;
  cash_code VARCHAR(50);
  cash_name VARCHAR(255);
BEGIN
  -- Loop through all USER-{NAME} accounts
  FOR user_account IN 
    SELECT id, account_code, account_name, balance, reference_id
    FROM ledger_accounts
    WHERE account_code LIKE 'USER-%' AND active = true
  LOOP
    -- Extract the user name from USER-{NAME} to create CASH-{NAME}
    user_name := SUBSTRING(user_account.account_name FROM 'User Account: (.+)');
    
    IF user_name IS NOT NULL THEN
      cash_code := 'CASH-' || UPPER(REPLACE(user_name, ' ', '-'));
      cash_name := 'Petty Cash: ' || user_name;
      
      -- Check if CASH-{NAME} account already exists
      SELECT id INTO cash_account_id
      FROM ledger_accounts
      WHERE account_code = cash_code AND active = true;
      
      IF cash_account_id IS NOT NULL THEN
        -- CASH account exists, merge the balances
        RAISE NOTICE 'Merging USER account % into existing CASH account %', user_account.account_code, cash_code;
        
        -- Update the CASH account balance by adding USER account balance
        UPDATE ledger_accounts
        SET balance = balance + user_account.balance,
            updated_at = NOW()
        WHERE id = cash_account_id;
        
        -- Update all ledger entries pointing to the USER account to point to CASH account
        UPDATE ledger_entries
        SET account_id = cash_account_id
        WHERE account_id = user_account.id;
        
        -- Deactivate the old USER account
        UPDATE ledger_accounts
        SET active = false,
            updated_at = NOW()
        WHERE id = user_account.id;
        
      ELSE
        -- CASH account doesn't exist, rename USER account to CASH account
        RAISE NOTICE 'Renaming USER account % to CASH account %', user_account.account_code, cash_code;
        
        UPDATE ledger_accounts
        SET account_code = cash_code,
            account_name = cash_name,
            account_type = 'asset',  -- Change from liability to asset
            account_category = 'petty_cash',  -- Change from user to petty_cash
            updated_at = NOW()
        WHERE id = user_account.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Step 2: Update the create_expense_ledger_entries function to use CASH-{NAME} for all user transactions
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
    -- Bank account payment
    SELECT id INTO v_credit_account_id
    FROM ledger_accounts
    WHERE related_entity_id = p_from_bank_id
      AND account_category = 'bank'
      AND active = true
    LIMIT 1;
    
    IF v_credit_account_id IS NULL THEN
      RAISE EXCEPTION 'Bank account not found in ledger: %', p_from_bank_id;
    END IF;
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
    description,
    expense_record_id,
    debit,
    credit,
    balance_after,
    created_by
  ) VALUES (
    v_debit_account_id,
    p_transaction_date,
    p_purpose,
    p_expense_id,
    p_amount,
    0,
    v_new_balance,
    p_created_by
  );
  
  -- Update debit account balance
  UPDATE ledger_accounts
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_debit_account_id;
  
  -- Calculate new balance for credit account (decreases)
  SELECT COALESCE(balance, 0) - p_amount INTO v_new_balance
  FROM ledger_accounts WHERE id = v_credit_account_id;
  
  -- Create credit entry
  INSERT INTO ledger_entries (
    account_id,
    transaction_date,
    description,
    expense_record_id,
    debit,
    credit,
    balance_after,
    created_by
  ) VALUES (
    v_credit_account_id,
    p_transaction_date,
    p_purpose,
    p_expense_id,
    0,
    p_amount,
    v_new_balance,
    p_created_by
  );
  
  -- Update credit account balance
  UPDATE ledger_accounts
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_credit_account_id;
  
END;
$$ LANGUAGE plpgsql;

-- Step 3: Recreate the trigger
DROP TRIGGER IF EXISTS expense_approved_ledger_trigger ON expense_records;

CREATE TRIGGER expense_approved_ledger_trigger
  AFTER UPDATE OF status ON expense_records
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION trigger_create_expense_ledger();

COMMENT ON TRIGGER expense_approved_ledger_trigger ON expense_records IS 
  'Creates double-entry ledger entries when expense is approved. 
   Consolidates all user cash into CASH-{NAME} accounts.';
