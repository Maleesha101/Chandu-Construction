-- Fix the newly added wd_approved record that's missing ledger entries
DO $$
DECLARE
  expense_record RECORD;
BEGIN
  RAISE NOTICE 'Processing newly wd_approved expense without ledger entries...';
  
  -- Get the specific expense
  SELECT * INTO expense_record
  FROM expense_records 
  WHERE id = 'f0cc86fe-dd73-42c5-90ab-61c07b4024e3';
  
  IF expense_record.id IS NOT NULL THEN
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
      RAISE NOTICE 'Success: Created ledger entries';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Expense not found';
  END IF;
END $$;

-- Verify
SELECT 
  er.id, 
  er.to_name, 
  er.status, 
  er.amount,
  COUNT(le.id) as ledger_entry_count 
FROM expense_records er 
LEFT JOIN ledger_entries le ON le.expense_record_id = er.id 
WHERE er.id = 'f0cc86fe-dd73-42c5-90ab-61c07b4024e3'
GROUP BY er.id, er.to_name, er.status, er.amount;
