-- Test the trigger to see if it's working
-- First, create a test expense in wd_pending status
INSERT INTO expense_records (
  to_name,
  purpose,
  amount,
  entry_date,
  entered_by_user_id,
  payment_method,
  status
) VALUES (
  'Test Trigger',
  'Testing wd_approved trigger',
  100.00,
  CURRENT_DATE,
  (SELECT id FROM users WHERE role = 'boss' LIMIT 1),
  'cash',
  'wd_pending'
) RETURNING id;

-- Store the ID for later
\gset test_

-- Now update it to wd_approved (this should trigger ledger creation)
UPDATE expense_records 
SET status = 'wd_approved'
WHERE id = :'test_id';

-- Check if ledger entries were created
SELECT 
  er.id,
  er.to_name,
  er.status,
  COUNT(le.id) as ledger_count
FROM expense_records er
LEFT JOIN ledger_entries le ON le.expense_record_id = er.id
WHERE er.id = :'test_id'
GROUP BY er.id, er.to_name, er.status;

-- Clean up test data
DELETE FROM expense_records WHERE id = :'test_id';
