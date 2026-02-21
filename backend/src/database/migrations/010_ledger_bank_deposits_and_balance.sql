-- Create ledger entries for cheque deposits and update balance tracking
-- This migration adds proper ledger tracking for bank deposits and updates balance calculations

-- First, let's add a function to create ledger entries for bank deposits (cheques)
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
BEGIN
  -- Get bank account details
  SELECT name, bank_name, balance INTO v_account_name, v_account_code, v_current_balance
  FROM bank_accounts WHERE id = p_bank_account_id;
  
  v_account_code := 'BANK-' || UPPER(REPLACE(v_account_name, ' ', '-'));
  
  -- Get or create bank ledger account
  v_bank_account_id := get_or_create_ledger_account(
    v_account_code,
    v_account_name || ' - ' || (SELECT bank_name FROM bank_accounts WHERE id = p_bank_account_id),
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
  SET balance = balance + p_amount 
  WHERE id = v_bank_account_id;
  
  UPDATE ledger_accounts 
  SET balance = balance + p_amount 
  WHERE id = v_revenue_account_id;
  
END;
$$ LANGUAGE plpgsql;

-- Update the expense ledger function to also track balance_after
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
  v_new_balance DECIMAL(15, 2);
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
    IF p_from_person_name IS NOT NULL AND p_from_person_name != '' THEN
      SELECT id, full_name INTO v_from_user_id, v_from_user_name
      FROM users 
      WHERE full_name = p_from_person_name AND active = true
      LIMIT 1;
      
      IF v_from_user_id IS NOT NULL THEN
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
  
  -- Calculate new balance for the credit account (bank/petty cash decreases)
  v_new_balance := (SELECT balance FROM ledger_accounts WHERE id = v_credit_account_id) - p_amount;
  
  -- Create CREDIT entry (Asset/Liability decreases - money going out)
  INSERT INTO ledger_entries (
    transaction_date, account_id, expense_record_id, debit, credit,
    description, reference_number, created_by, balance_after
  ) VALUES (
    p_transaction_date, v_credit_account_id, p_expense_id, 0, p_amount,
    p_purpose || ' - ' || p_to_name,
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

-- Create trigger for bank_transfers to auto-create ledger entries for cheque deposits
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
      NEW.created_by
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

-- Create the revenue account if it doesn't exist
INSERT INTO ledger_accounts (account_code, account_name, account_type, account_category, description)
VALUES ('REV-DEPOSITS', 'Bank Deposits & Income', 'revenue', 'general', 'Income from cheque deposits and other bank deposits')
ON CONFLICT (account_code) DO NOTHING;

COMMENT ON FUNCTION create_bank_deposit_ledger_entry IS 'Creates double-entry ledger records for bank deposits/cheques. Debits bank account (increases it), credits revenue account.';
COMMENT ON FUNCTION trigger_create_bank_deposit_ledger IS 'Automatically creates ledger entries when cheques are deposited to bank accounts.';
