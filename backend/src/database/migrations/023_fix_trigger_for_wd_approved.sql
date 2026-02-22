-- Fix the trigger to handle both 'approved' and 'wd_approved' status changes
-- The trigger function already handles both, but the WHEN clause was only checking for 'approved'

-- Drop the old trigger
DROP TRIGGER IF EXISTS expense_approved_ledger_trigger ON expense_records;

-- Create the trigger with correct WHEN clause for both statuses
CREATE TRIGGER expense_approved_ledger_trigger
  AFTER UPDATE OF status ON expense_records
  FOR EACH ROW
  WHEN (
    (NEW.status = 'approved' AND OLD.status != 'approved') OR
    (NEW.status = 'wd_approved' AND OLD.status != 'wd_approved')
  )
  EXECUTE FUNCTION trigger_create_expense_ledger();

COMMENT ON TRIGGER expense_approved_ledger_trigger ON expense_records IS 
  'Creates ledger entries when expense status changes to approved or wd_approved';

-- Test the trigger is properly defined
SELECT 
  tgname,
  tgenabled,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'expense_records'::regclass
AND tgname = 'expense_approved_ledger_trigger';
