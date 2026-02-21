-- Make bank_account_id nullable in cheques table since cheques come from external sources
ALTER TABLE cheques 
  ALTER COLUMN bank_account_id DROP NOT NULL;

-- Drop the index since we won't be using this column
DROP INDEX IF EXISTS idx_cheques_bank_account;
