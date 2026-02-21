-- Add reference columns to bank_transfers table
-- Note: This must be run with a user that has permission to alter the table

DO $$
BEGIN
    -- Add cheque_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bank_transfers' AND column_name = 'cheque_id') THEN
        ALTER TABLE bank_transfers 
        ADD COLUMN cheque_id UUID REFERENCES cheques(id);
    END IF;

    -- Add transfer_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bank_transfers' AND column_name = 'transfer_type') THEN
        ALTER TABLE bank_transfers 
        ADD COLUMN transfer_type VARCHAR(50) DEFAULT 'manual' 
        CHECK (transfer_type IN ('manual', 'cheque_deposit', 'expense'));
    END IF;
END $$;

-- Create index for cheque references
CREATE INDEX IF NOT EXISTS idx_bank_transfers_cheque ON bank_transfers(cheque_id);
