-- Make from_account_id nullable in bank_transfers for external deposits (cheques)
ALTER TABLE bank_transfers 
  ALTER COLUMN from_account_id DROP NOT NULL;

-- Drop the old constraint that required different accounts
ALTER TABLE bank_transfers 
  DROP CONSTRAINT IF EXISTS different_accounts;

-- Add new constraint that only checks when from_account_id is not null
ALTER TABLE bank_transfers 
  ADD CONSTRAINT different_accounts 
  CHECK (from_account_id IS NULL OR from_account_id != to_account_id);
