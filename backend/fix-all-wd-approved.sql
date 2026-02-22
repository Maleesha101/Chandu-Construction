-- Comprehensive fix for wd_approved ledger entries
-- This script can be run anytime to ensure all wd_approved expenses have ledger entries

DO $$
DECLARE
  expense_record RECORD;
  fixed_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Scanning for wd_approved expenses without ledger entries...';
  
  FOR expense_record IN 
    SELECT er.*
    FROM expense_records er
    WHERE er.status = 'wd_approved'
    AND NOT EXISTS (
      SELECT 1 FROM ledger_entries le WHERE le.expense_record_id = er.id
    )
    ORDER BY er.updated_at
  LOOP
    RAISE NOTICE 'Creating ledger entries for: % (%, Amount: %)', 
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
      fixed_count := fixed_count + 1;
      RAISE NOTICE '✓ Success';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '✗ Failed: %', SQLERRM;
    END;
  END LOOP;
  
  IF fixed_count = 0 THEN
    RAISE NOTICE 'All wd_approved expenses already have ledger entries!';
  ELSE
    RAISE NOTICE 'Fixed % wd_approved expense(s)', fixed_count;
  END IF;
END $$;

-- Summary report
SELECT 
  COUNT(*) as total_wd_approved,
  COUNT(DISTINCT le.expense_record_id) as with_ledger_entries,
  COUNT(*) - COUNT(DISTINCT le.expense_record_id) as missing_ledger_entries
FROM expense_records er
LEFT JOIN ledger_entries le ON le.expense_record_id = er.id
WHERE er.status = 'wd_approved';
