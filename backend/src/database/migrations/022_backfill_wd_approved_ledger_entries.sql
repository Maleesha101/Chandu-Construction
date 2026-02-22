-- Backfill ledger entries for wd_approved expenses that don't have them yet
-- This ensures all wd_approved expenses are properly tracked in the ledger

DO $$
DECLARE
  expense_record RECORD;
  entry_count INTEGER;
BEGIN
  RAISE NOTICE 'Checking for wd_approved expenses without ledger entries...';
  
  -- Loop through all wd_approved expenses
  FOR expense_record IN 
    SELECT er.*
    FROM expense_records er
    WHERE er.status = 'wd_approved'
    AND NOT EXISTS (
      SELECT 1 FROM ledger_entries le 
      WHERE le.expense_record_id = er.id
    )
    ORDER BY er.updated_at
  LOOP
    RAISE NOTICE 'Creating ledger entries for expense ID: % (To: %, Amount: %)', 
      expense_record.id, 
      expense_record.to_name, 
      expense_record.amount;
    
    -- Create ledger entries using the same function used by the trigger
    PERFORM create_expense_ledger_entries(
      expense_record.id,
      expense_record.amount,
      expense_record.purpose,
      expense_record.to_name,
      expense_record.from_bank_account_id,
      expense_record.md_id,
      expense_record.entry_date,  -- Use entry_date as transaction date
      expense_record.entered_by_user_id,
      expense_record.qs_notes,  -- This contains from_person_name
      expense_record.payment_method
    );
    
  END LOOP;
  
  -- Count total wd_approved expenses with ledger entries
  SELECT COUNT(DISTINCT er.id) INTO entry_count
  FROM expense_records er
  INNER JOIN ledger_entries le ON er.id = le.expense_record_id
  WHERE er.status = 'wd_approved';
  
  RAISE NOTICE 'Completed! Total wd_approved expenses with ledger entries: %', entry_count;
END $$;

COMMENT ON TABLE expense_records IS 'Expense records. Both approved and wd_approved status trigger ledger entry creation.';
