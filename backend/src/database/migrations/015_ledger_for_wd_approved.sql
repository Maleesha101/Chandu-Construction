-- Update trigger to create ledger entries for both 'approved' and 'wd_approved' status

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
      NEW.updated_at,
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
   Handles both regular approval and WD approval workflows.';

