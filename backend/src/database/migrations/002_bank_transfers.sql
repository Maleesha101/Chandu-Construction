-- Create bank transfers table for tracking inter-account transfers
CREATE TABLE IF NOT EXISTS bank_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  to_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  transfer_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT different_accounts CHECK (from_account_id != to_account_id)
);

-- Add currency column to bank_accounts if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bank_accounts' AND column_name = 'currency') THEN
    ALTER TABLE bank_accounts ADD COLUMN currency VARCHAR(3) DEFAULT 'LKR';
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bank_transfers_from_account ON bank_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_to_account ON bank_transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_date ON bank_transfers(transfer_date DESC);

-- Insert some sample data for testing (optional)
-- COMMENT: Uncomment to insert sample transfers
/*
INSERT INTO bank_transfers (from_account_id, to_account_id, amount, description, transfer_date)
SELECT 
  (SELECT id FROM bank_accounts WHERE name = 'Main Account' LIMIT 1),
  (SELECT id FROM bank_accounts WHERE name = 'Petty Cash' LIMIT 1),
  5000.00,
  'Initial fund allocation to petty cash',
  NOW() - INTERVAL '1 day'
WHERE EXISTS (SELECT 1 FROM bank_accounts WHERE name = 'Main Account')
  AND EXISTS (SELECT 1 FROM bank_accounts WHERE name = 'Petty Cash');
*/
