# Cheque Management Implementation

## What's Been Implemented

1. **Database Schema**:
   - Created `cheques` table to track cheques
   - Added indices for better query performance
   - Added trigger for automatic `updated_at` timestamp

2. **Backend API**:
   - GET `/api/banks/cheques` - Get all cheques
   - POST `/api/banks/cheques` - Create a new cheque
   - PUT `/api/banks/cheques/:id` - Update cheque details
   - POST `/api/banks/cheques/:id/deposit` - Deposit cheque to bank account
   - POST `/api/banks/cheques/:id/cancel` - Cancel a pending cheque
   - GET `/api/banks/:id/transactions` - Get account-specific transactions

3. **Frontend Features**:
   - New "Cheques" tab in Bank Management page
   - Add cheque dialog for recording received cheques
   - Deposit cheque functionality with automatic transfer creation
   - Account detail view showing credits and debits separately
   - Click on any bank account to see detailed transaction history
   - Transfer history now shows cheque deposits

## Migration Status

✅ **Completed**: Cheques table created successfully
⚠️ **Pending**: bank_transfers table enhancement

The `bank_transfers` table needs two additional columns:
- `cheque_id` - References the cheque when a transfer is a cheque deposit
- `transfer_type` - Indicates if transfer is 'manual', 'cheque_deposit', or 'expense'

### To Complete the Migration:

You need to run this SQL command as a database superuser (postgres):

```bash
sudo -u postgres psql site_cash_flow -f backend/src/database/migrations/003_add_cheques_part2.sql
```

**OR** manually run these SQL commands:

```sql
ALTER TABLE bank_transfers 
ADD COLUMN cheque_id UUID REFERENCES cheques(id);

ALTER TABLE bank_transfers 
ADD COLUMN transfer_type VARCHAR(50) DEFAULT 'manual' 
CHECK (transfer_type IN ('manual', 'cheque_deposit', 'expense'));

CREATE INDEX idx_bank_transfers_cheque ON bank_transfers(cheque_id);
```

## How to Use

### 1. Add a Cheque
- Go to Bank Management page
- Click "Add Cheque" button
- Fill in cheque details:
  - Bank Account (which bank the cheque is drawn on)
  - Cheque Number
  - Payee Name (who issued the cheque)
  - Amount
  - Cheque Date
  - Optional description

### 2. Deposit a Cheque
- Go to the "Checheques" tab
- Find a pending cheque
- Click "Deposit" button
- Select the bank account to deposit into
- Choose deposit date
- The system will:
  - Create a transfer record in Transfer History
  - Update the destination bank account balance
  - Mark the cheque as "deposited"

### 3. View Account Transactions
- Go to "Bank Accounts" tab
- Click on any bank account row

You'll see:
- Current balance
- Total credits (money received)
- Total debits (money sent)
- Separate lists for credit and debit transactions
- Cheque deposits are clearly marked

### 4. View Transfer History
- Go to "Transfer History" tab
- See all transfers including:
  - Manual transfers
  - Cheque deposits (with cheque number and payee)
  - Transfer type badge

## Testing

1. **Start the backend** (if not already running):
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend** (in another terminal):
   ```bash
   npm run dev
   ```

3. **Test the features**:
   - Add a test cheque
   - Deposit it to a bank account
   - Check the Transfer History
   - Click on the bank account to see transactions

## Notes

- Only users with 'boss' or 'admin' roles can access Bank Management
- Cheques can only be deposited when status is 'pending'
- Once deposited, a cheque cannot be modified
- Cancelled cheques cannot be deposited
- All monetary transactions are properly tracked in the database
