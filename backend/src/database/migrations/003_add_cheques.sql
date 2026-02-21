-- Add cheques table for managing cheques
CREATE TABLE IF NOT EXISTS cheques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  cheque_number VARCHAR(100) NOT NULL,
  payee_name VARCHAR(255) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  cheque_date DATE NOT NULL,
  deposit_date DATE,
  deposited_to_account_id UUID REFERENCES bank_accounts(id),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'deposited', 'cleared', 'bounced', 'cancelled')),
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indices for better query performance
CREATE INDEX idx_cheques_bank_account ON cheques(bank_account_id);
CREATE INDEX idx_cheques_deposited_to ON cheques(deposited_to_account_id);
CREATE INDEX idx_cheques_status ON cheques(status);
CREATE INDEX idx_cheques_date ON cheques(cheque_date DESC);

-- Add updated_at trigger
CREATE TRIGGER update_cheques_updated_at
  BEFORE UPDATE ON cheques
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add a reference column to bank_transfers to link to cheque deposits
ALTER TABLE bank_transfers 
ADD COLUMN IF NOT EXISTS cheque_id UUID REFERENCES cheques(id),
ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(50) DEFAULT 'manual' CHECK (transfer_type IN ('manual', 'cheque_deposit', 'expense'));

CREATE INDEX idx_bank_transfers_cheque ON bank_transfers(cheque_id);
