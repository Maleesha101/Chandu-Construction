-- Create ledger entries for existing bank transfers
-- This migration adds ledger tracking for bank transfers that were created before ledger integration

DO $$
DECLARE
  transfer_record RECORD;
  from_ledger_account_id UUID;
  to_ledger_account_id UUID;
  from_account_code VARCHAR(50);
  from_account_name VARCHAR(255);
  to_account_code VARCHAR(50);
  to_account_name VARCHAR(255);
  transfer_desc TEXT;
  reference_number VARCHAR(100);
BEGIN
  RAISE NOTICE 'Creating ledger entries for existing bank transfers...';
  
  -- Loop through all bank transfers that don't have ledger entries yet
  FOR transfer_record IN 
    SELECT 
      bt.*,
      fa.name as from_name,
      fa.bank_name as from_bank,
      ta.name as to_name,
      ta.bank_name as to_bank
    FROM bank_transfers bt
    LEFT JOIN bank_accounts fa ON bt.from_account_id = fa.id
    LEFT JOIN bank_accounts ta ON bt.to_account_id = ta.id
    WHERE bt.from_account_id IS NOT NULL  -- Skip cheque deposits (they already have ledger entries)
    AND bt.to_account_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM ledger_entries le 
      WHERE le.reference_number = 'TRF-' || SUBSTRING(bt.id::TEXT FROM 1 FOR 8)
    )
    ORDER BY bt.transfer_date
  LOOP
    -- Skip if either account is NULL (shouldn't happen, but safety check)
    IF transfer_record.from_account_id IS NULL OR transfer_record.to_account_id IS NULL THEN
      CONTINUE;
    END IF;
    
    RAISE NOTICE 'Processing transfer ID: % (% to %, Amount: %)', 
      transfer_record.id, 
      transfer_record.from_name, 
      transfer_record.to_name, 
      transfer_record.amount;
    
    -- Generate account codes and names
    from_account_code := 'BANK-' || UPPER(REPLACE(transfer_record.from_name, ' ', '-'));
    from_account_name := transfer_record.from_name || ' - ' || transfer_record.from_bank;
    
    to_account_code := 'BANK-' || UPPER(REPLACE(transfer_record.to_name, ' ', '-'));
    to_account_name := transfer_record.to_name || ' - ' || transfer_record.to_bank;
    
    -- Get or create ledger accounts
    from_ledger_account_id := get_or_create_ledger_account(
      from_account_code,
      from_account_name,
      'asset',
      'bank',
      transfer_record.from_account_id
    );
    
    to_ledger_account_id := get_or_create_ledger_account(
      to_account_code,
      to_account_name,
      'asset',
      'bank',
      transfer_record.to_account_id
    );
    
    -- Prepare description and reference
    transfer_desc := COALESCE(transfer_record.description, 'Bank Transfer');
    reference_number := 'TRF-' || SUBSTRING(transfer_record.id::TEXT FROM 1 FOR 8);
    
    -- Create CREDIT entry for source account (money going out)
    INSERT INTO ledger_entries (
      account_id,
      transaction_date,
      debit,
      credit,
      description,
      reference_number,
      created_at
    ) VALUES (
      from_ledger_account_id,
      transfer_record.transfer_date,
      0,
      transfer_record.amount,
      'Transfer to ' || transfer_record.to_name || ' - ' || transfer_desc,
      reference_number,
      transfer_record.created_at
    );
    
    -- Update source ledger account balance
    UPDATE ledger_accounts 
    SET balance = balance - transfer_record.amount
    WHERE id = from_ledger_account_id;
    
    -- Create DEBIT entry for destination account (money coming in)
    INSERT INTO ledger_entries (
      account_id,
      transaction_date,
      debit,
      credit,
      description,
      reference_number,
      created_at
    ) VALUES (
      to_ledger_account_id,
      transfer_record.transfer_date,
      transfer_record.amount,
      0,
      'Transfer from ' || transfer_record.from_name || ' - ' || transfer_desc,
      reference_number,
      transfer_record.created_at
    );
    
    -- Update destination ledger account balance
    UPDATE ledger_accounts 
    SET balance = balance + transfer_record.amount
    WHERE id = to_ledger_account_id;
    
  END LOOP;
  
  RAISE NOTICE 'Completed creating ledger entries for bank transfers';
END $$;

-- Add comment
COMMENT ON TABLE bank_transfers IS 'Bank account transfers. Each transfer creates corresponding ledger entries for both accounts.';
