-- Fix ledger trigger to use entry_date instead of updated_at for transaction_date
-- This ensures ledger entries show the actual transaction date, not the approval date

CREATE OR REPLACE FUNCTION trigger_create_expense_ledger() 
RETURNS TRIGGER AS $$
BEGIN
  -- Create ledger entries when status changes to 'approved' or 'wd_approved'
  IF (NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved')) OR
     (NEW.status = 'wd_approved' AND (OLD.status IS NULL OR OLD.status != 'wd_approved')) THEN
    PERFORM create_expense_ledger_entries(
      NEW.id,
      NEW.amount,
      NEW.purpose,
      NEW.to_name,
      NEW.from_bank_account_id,
      NEW.md_id,
      NEW.entry_date,  -- ✅ FIX: Use entry_date (transaction date) instead of updated_at
      NEW.entered_by_user_id,
      NEW.qs_notes,  -- This contains from_person_name
      NEW.payment_method
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_create_expense_ledger IS 
  'Creates double-entry ledger entries when expense is approved or wd_approved. 
   Uses entry_date as transaction_date to reflect the actual transaction date, not approval date.';

-- Update existing ledger entries to use the correct transaction date from expense_records
DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Updating existing ledger entries to use correct transaction dates...';
  
  -- Update ledger entries that have associated expense records
  -- Set transaction_date to match the entry_date from expense_records
  UPDATE ledger_entries le
  SET transaction_date = er.entry_date
  FROM expense_records er
  WHERE le.expense_record_id = er.id
    AND le.transaction_date != er.entry_date;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Updated % ledger entries with correct transaction dates', updated_count;
END $$;

COMMENT ON TABLE ledger_entries IS 'Double-entry ledger entries. transaction_date reflects the actual transaction date from expense_records.entry_date, not the approval or creation date.';

