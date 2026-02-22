-- Manually fix the wd_approved expenses without ledger entries
-- Run this to create ledger entries for all wd_approved expenses

DO $$
DECLARE
  expense_record RECORD;
BEGIN
  RAISE NOTICE 'Creating ledger entries for wd_approved expenses...';
  
  FOR expense_record IN 
    SELECT er.*
    FROM expense_records er
    WHERE er.status = 'wd_approved'
    AND NOT EXISTS (
      SELECT 1 FROM ledger_entries le WHERE le.expense_record_id = er.id
    )
  LOOP
    RAISE NOTICE 'Processing expense: % (%, Amount: %)', 
      expense_record.id, expense_record.to_name, expense_record.amount;
    
    BEGIN
      PERFORM create_expense_ledger_entries(
        expense_record.id,
        expense_record.amount,
        expense_record.purpose,
        expense_record.to_name,
        expense_record.from_bank_account_id,
        expense_record.md_id,
        expense_record.entry_date,
        expense_record.entered_by_user_id,
        expense_record.qs_notes,
        expense_record.payment_method
      );
      RAISE NOTICE 'Success: Created ledger entries for expense %', expense_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create ledger entries for expense %: %', expense_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Completed processing wd_approved expenses';
END $$;

-- Verify results
SELECT 
  er.id, 
  er.to_name, 
  er.status, 
  er.amount,
  COUNT(le.id) as ledger_entry_count 
FROM expense_records er 
LEFT JOIN ledger_entries le ON le.expense_record_id = er.id 
WHERE er.status = 'wd_approved' 
GROUP BY er.id, er.to_name, er.status, er.amount
ORDER BY er.updated_at DESC;
