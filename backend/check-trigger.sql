-- Test trigger by checking the most recent wd_approved expense
\echo 'Checking most recent wd_approved expenses...'
SELECT 
  er.id, 
  er.to_name, 
  er.status, 
  er.amount,
  er.updated_at,
  COUNT(le.id) as ledger_entry_count 
FROM expense_records er 
LEFT JOIN ledger_entries le ON le.expense_record_id = er.id 
WHERE er.status = 'wd_approved' 
GROUP BY er.id, er.to_name, er.status, er.amount, er.updated_at
ORDER BY er.updated_at DESC
LIMIT 10;

\echo ''
\echo 'Checking if trigger exists and is enabled...'
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  CASE tgtype & 66
    WHEN 2 THEN 'BEFORE'
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END as timing,
  CASE tgtype & 28
    WHEN 4 THEN 'INSERT'
    WHEN 8 THEN 'DELETE'
    WHEN 16 THEN 'UPDATE'
    WHEN 12 THEN 'INSERT OR DELETE'
    WHEN 20 THEN 'INSERT OR UPDATE'
    WHEN 24 THEN 'DELETE OR UPDATE'
    WHEN 28 THEN 'INSERT OR DELETE OR UPDATE'
  END as events
FROM pg_trigger 
WHERE tgrelid = 'expense_records'::regclass
AND tgname = 'expense_approved_ledger_trigger';
