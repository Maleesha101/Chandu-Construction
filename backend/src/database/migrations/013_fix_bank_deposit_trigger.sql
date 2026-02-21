-- Fix the bank deposit trigger to not require created_by field from bank_transfers
-- bank_transfers table doesn't have a created_by field, so we pass NULL instead

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

COMMENT ON FUNCTION trigger_create_bank_deposit_ledger IS 'Automatically creates ledger entries when cheques are deposited to bank accounts. Updated to handle missing created_by field in bank_transfers.';
