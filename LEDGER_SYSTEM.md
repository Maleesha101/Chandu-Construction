# Double-Entry Ledger System

## Overview
A comprehensive double-entry bookkeeping system has been implemented for tracking all expense transactions with proper accounting principles.

## Features

### 1. Automatic Ledger Accounts
The system automatically creates ledger accounts for:
- **Bank Accounts** (Asset accounts) - One for each bank account
- **Supervisors/MDs** (Liability accounts) - One for each managing director/supervisor
- **Machines** (Expense account) - For all machine-related expenses
- **Rents** (Expense account) - For all rental expenses  
- **General Expenses** (Expense account) - For other operational expenses

### 2. Double-Entry Bookkeeping
Every expense transaction creates two ledger entries:
- **DEBIT**: Expense account (Machines/Rents/General)
- **CREDIT**: Source account (Bank Account or Supervisor Float)

This ensures the accounting equation remains balanced at all times.

### 3. Automatic Entry Creation
When an expense is **approved**, the system automatically:
1. Determines the expense category (Machine, Rent, or General) based on the purpose/description
2. Creates a debit entry in the appropriate expense account
3. Creates a credit entry in the source account (bank or supervisor)
4. Updates account balances accordingly

## How It Works

### Expense Transaction Flow
```
1. User creates expense record
2. Expense goes through approval workflow
3. When approved → Trigger fires
4. System creates ledger entries:
   - Debit: Expense Account (+)
   - Credit: Bank/Supervisor Account (-)
5. Account balances updated
```

### Account Types
- **Assets**: Bank accounts (positive balance = money available)
- **Liabilities**: Supervisor floats (positive balance = amount owed to supervisor)
- **Expenses**: Spending categories (positive balance = total spent)
- **Revenue**: Income categories (for future use)

## Viewing Ledger Reports

### Navigate to Ledger
1. Go to **Reports** page
2. Click on **Ledger Accounts** card (or use sidebar: Ledger)

### Ledger Dashboard
Shows:
- **Total Assets**: Sum of all bank account balances
- **Total Liabilities**: Sum of all supervisor float balances
- **Total Expenses**: Sum of all expense categories

### Tabs Available:
1. **All Accounts**: Complete chart of accounts grouped by type
2. **Assets**: Bank accounts only
3. **Liabilities**: Supervisor floats only
4. **Expenses**: Expense categories only
5. **Expense Breakdown**: Detailed expense analysis with transaction counts

### Drilling Down
- Click on any account to view its complete transaction history
- See individual debits and credits
- View related expense records and sites
- Track running balances

## Database Tables

### ledger_accounts
Stores the chart of accounts:
- `account_code`: Unique code (e.g., BANK-MAIN, SUP-JOHN, EXP-MACHINE)
- `account_name`: Display name
- `account_type`: asset, liability, expense, revenue
- `account_category`: bank, supervisor, machine, rent, general
- `balance`: Current account balance
- `reference_id`: Links to bank_accounts or managing_directors

### ledger_entries
Stores individual transactions:
- `account_id`: Which account this entry affects
- `expense_record_id`: Links to original expense
- `debit`: Debit amount (increases for assets/expenses)
- `credit`: Credit amount (decreases for assets/expenses)
- `transaction_date`: When transaction occurred
- `description`: Transaction details

## API Endpoints

### GET /api/ledger/accounts
Returns all ledger accounts with balances and transaction counts

### GET /api/ledger/accounts/:id
Returns specific account details

### GET /api/ledger/accounts/:id/entries
Returns all transactions for a specific account
Query params: `startDate`, `endDate`, `limit`

### GET /api/ledger/summary
Returns summary statistics by account type and category

### GET /api/ledger/trial-balance
Returns trial balance report (all accounts with debit/credit totals)
Query params: `startDate`, `endDate`

### GET /api/ledger/expense-breakdown
Returns expense analysis by category
Query params: `startDate`, `endDate`

## Migration Applied
- **File**: `006_ledger_system.sql`
- **Status**: ✅ Successfully applied
- **Tables Created**: 
  - `ledger_accounts`
  - `ledger_entries` (recreated with proper structure)
- **Functions Created**:
  - `get_or_create_ledger_account()`: Auto-creates accounts
  - `create_expense_ledger_entries()`: Creates double-entry transactions
  - `trigger_create_expense_ledger()`: Auto-fires on expense approval

## Notes
- The trigger automatically creates ledger entries when expense status changes to 'approved'
- Machine expenses are identified by keywords like "machine" in purpose or to_name
- Rent expenses are identified by keywords like "rent"
- All other expenses go to General Expenses
- Account codes are automatically generated based on names
- Existing bank accounts and supervisors were imported as ledger accounts with current balances

## Testing
The system is now ready. To test:
1. Create a new expense
2. Approve it
3. Navigate to Ledger page
4. View the expense account (Machine/Rent/General)
5. You should see the debit entry
6. View the bank/supervisor account
7. You should see the credit entry
8. Verify balances are updated correctly

## Future Enhancements
- Date range filtering on ledger reports
- Export ledger reports to PDF/Excel
- Journal entry corrections/adjustments
- Financial statements (P&L, Balance Sheet)
- Budget vs Actual reports
