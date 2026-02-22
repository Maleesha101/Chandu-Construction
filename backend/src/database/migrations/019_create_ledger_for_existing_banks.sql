-- Create ledger accounts for existing bank accounts that don't have one
-- This fixes the issue where bank accounts created before the ledger integration don't show in the ledger

DO $$
DECLARE
  bank_record RECORD;
  v_account_code VARCHAR(50);
  v_account_name VARCHAR(255);
  v_ledger_account_id UUID;
BEGIN
  -- Loop through all bank accounts
  FOR bank_record IN 
    SELECT ba.* 
    FROM bank_accounts ba
    WHERE ba.active = true
    AND NOT EXISTS (
      SELECT 1 FROM ledger_accounts la 
      WHERE la.reference_id = ba.id 
      AND la.account_category = 'bank'
    )
  LOOP
    -- Generate account code and name
    v_account_code := 'BANK-' || UPPER(REPLACE(bank_record.name, ' ', '-'));
    v_account_name := bank_record.name || ' - ' || bank_record.bank_name;
    
    RAISE NOTICE 'Creating ledger account for bank: % (ID: %)', bank_record.name, bank_record.id;
    
    -- Create ledger account using the get_or_create function
    v_ledger_account_id := get_or_create_ledger_account(
      v_account_code,
      v_account_name,
      'asset',
      'bank',
      bank_record.id
    );
    
    -- If bank has a balance > 0, create an initial balance entry
    IF bank_record.balance > 0 THEN
      RAISE NOTICE 'Creating initial balance entry: % LKR', bank_record.balance;
      
      -- Get or create revenue account for initial balances
      DECLARE
        v_equity_account_id UUID;
      BEGIN
        v_equity_account_id := get_or_create_ledger_account(
          'EQUITY-OPENING',
          'Opening Balances',
          'revenue',
          'general',
          NULL
        );
        
        -- Create DEBIT entry (Bank account increases)
        INSERT INTO ledger_entries (
          account_id,
          transaction_date,
          debit,
          credit,
          description,
          reference_number,
          balance_after,
          created_at
        ) VALUES (
          v_ledger_account_id,
          bank_record.created_at,
          bank_record.balance,
          0,
          'Initial balance for ' || bank_record.name,
          'INIT-' || SUBSTRING(bank_record.id::TEXT FROM 1 FOR 8),
          bank_record.balance,
          NOW()
        );
        
        -- Create CREDIT entry (Equity/Revenue increases)
        INSERT INTO ledger_entries (
          account_id,
          transaction_date,
          debit,
          credit,
          description,
          reference_number,
          created_at
        ) VALUES (
          v_equity_account_id,
          bank_record.created_at,
          0,
          bank_record.balance,
          'Initial balance for ' || bank_record.name,
          'INIT-' || SUBSTRING(bank_record.id::TEXT FROM 1 FOR 8),
          NOW()
        );
        
        -- Update ledger account balance
        UPDATE ledger_accounts 
        SET balance = bank_record.balance
        WHERE id = v_ledger_account_id;
        
        -- Update equity account balance
        UPDATE ledger_accounts 
        SET balance = balance + bank_record.balance
        WHERE id = v_equity_account_id;
      END;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed creating ledger accounts for existing bank accounts';
END $$;

-- Add comment
COMMENT ON TABLE ledger_accounts IS 'Chart of accounts for double-entry bookkeeping. Bank accounts should have corresponding ledger accounts.';
