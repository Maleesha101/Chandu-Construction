# Chandu Construction - Complete Database Documentation

## System Overview

**Chandu Construction Site Cash Flow Management System** is a comprehensive financial tracking and expense management application built on PostgreSQL. It implements double-entry bookkeeping principles with automated ledger entry creation, multi-level approval workflows, and sophisticated banking operations including cheque management.

---

## Database: `site_cash_flow`

**Database Engine**: PostgreSQL 15+  
**Schema Format**: SQL with ENUM types, triggers, and stored procedures  
**Primary Authentication**: Custom JWT-based authentication (self-managed users table)

---

## Custom ENUM Types

PostgreSQL custom types define specific allowed values for certain columns:

### 1. **app_role**
Defines user permission levels within the system.
```sql
CREATE TYPE app_role AS ENUM ('boss', 'admin', 'qs', 'md');
```
- **boss**: Highest authority, full system access
- **admin**: Administrative access for system management
- **qs**: Quantity Surveyor - handles expense approvals and reviews
- **md**: Managing Director/Supervisor - field operations management

### 2. **expense_status**
Tracks the approval workflow state of expense records.
```sql
CREATE TYPE expense_status AS ENUM ('pending', 'approved', 'rejected', 'wd_pending', 'wd_approved', 'wd_rejected');
```
- **pending**: Initial state, awaiting first approval
- **approved**: Fully approved and processed
- **rejected**: Denied by approver
- **wd_pending**: Withdrawal approval pending (special workflow)
- **wd_approved**: Withdrawal approved
- **wd_rejected**: Withdrawal denied

### 3. **account_type**
Defines the fundamental accounting category (Chart of Accounts).
```sql
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'expense', 'revenue');
```
- **asset**: Resources owned (cash, bank accounts)
- **liability**: Obligations owed (supervisor floats, payables)
- **expense**: Money spent on operations
- **revenue**: Income and deposits

### 4. **account_category**
Sub-classification for ledger accounts.
```sql
CREATE TYPE account_category AS ENUM ('bank', 'supervisor', 'machine', 'rent', 'general', 'petty_cash', 'user');
```
- **bank**: Bank account assets
- **supervisor**: Managing director float accounts
- **machine**: Machine-related expenses
- **rent**: Rental expenses
- **general**: General operational expenses
- **petty_cash**: Cash held by individuals
- **user**: User cash accounts

---

## Core Tables

### 1. **users**
Central authentication and authorization table replacing Supabase auth.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique user identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email address |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| full_name | VARCHAR(255) | NOT NULL | User's display name |
| phone | VARCHAR(50) | | Contact number |
| role | app_role | NOT NULL, DEFAULT 'viewer' | Permission level |
| active | BOOLEAN | DEFAULT true | Account status |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last modification timestamp |

**Relationships**:
- Referenced by: `expense_records` (entered_by_user_id)
- Referenced by: `approvals` (approver_id)
- Referenced by: `record_attachments` (uploaded_by)
- Referenced by: `funding_transactions` (created_by)
- Referenced by: `cheques` (created_by)
- Referenced by: `ledger_entries` (created_by)
- Referenced by: `ledger_accounts` (reference_id when category='user')

**Indexes**:
- `idx_users_email` on email

**Triggers**:
- `update_users_updated_at` - Auto-updates `updated_at` on row modification

---

### 2. **bank_accounts**
Manages company bank accounts and cash holdings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique account identifier |
| name | VARCHAR(255) | NOT NULL | Account nickname |
| bank_name | VARCHAR(255) | NOT NULL | Financial institution name |
| account_number | VARCHAR(100) | | Actual account number |
| balance | DECIMAL(15, 2) | DEFAULT 0 | Current balance |
| currency | VARCHAR(10) | DEFAULT 'LKR' | Currency code |
| active | BOOLEAN | DEFAULT true | Account status |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last modification timestamp |

**Relationships**:
- Referenced by: `expense_records` (from_bank_account_id)
- Referenced by: `funding_transactions` (destination_bank_id)
- Referenced by: `bank_transfers` (from_account_id, to_account_id)
- Referenced by: `cheques` (bank_account_id, deposited_to_account_id)
- Referenced by: `ledger_accounts` (reference_id when category='bank')

**Indexes**: None additional

**Triggers**:
- `update_bank_accounts_updated_at` - Auto-updates `updated_at`

---

### 3. **managing_directors**
Tracks supervisors/managing directors who hold float balances.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique supervisor identifier |
| name | VARCHAR(255) | NOT NULL | Supervisor full name |
| contact | VARCHAR(50) | | Phone number |
| email | VARCHAR(255) | | Email address |
| float_balance | DECIMAL(15, 2) | DEFAULT 0 | Current cash float held |
| active | BOOLEAN | DEFAULT true | Employment status |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last modification timestamp |

**Relationships**:
- Referenced by: `expense_records` (md_id)
- Referenced by: `funding_transactions` (destination_md_id)
- Referenced by: `ledger_accounts` (reference_id when category='supervisor')

**Indexes**: None additional

**Triggers**:
- `update_managing_directors_updated_at` - Auto-updates `updated_at`

**Business Logic**: When expenses are paid from supervisor float, their `float_balance` decreases. When funding is provided to them, it increases.

---

### 4. **sites**
Construction site locations where expenses occur.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique site identifier |
| name | VARCHAR(255) | NOT NULL | Site name/project name |
| location | TEXT | | Physical address or description |
| code | VARCHAR(50) | UNIQUE | Short code for site reference |
| active | BOOLEAN | DEFAULT true | Site operational status |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |

**Relationships**:
- Referenced by: `expense_records` (site_id)

**Indexes**: None additional

**Triggers**: None

---

### 5. **expense_records**
Core transaction table capturing all company expenses.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique expense identifier |
| entry_date | DATE | NOT NULL, DEFAULT CURRENT_DATE | Date of expense occurrence |
| entered_by_user_id | UUID | REFERENCES users(id), NOT NULL | User who created record |
| md_id | UUID | REFERENCES managing_directors(id) | If paid from supervisor float |
| from_bank_account_id | UUID | REFERENCES bank_accounts(id) | If paid from bank account |
| to_name | VARCHAR(200) | NOT NULL | Payee/beneficiary name |
| purpose | TEXT | NOT NULL | Expense description/justification |
| site_id | UUID | REFERENCES sites(id) | Associated construction site |
| amount | DECIMAL(15, 2) | NOT NULL, CHECK > 0 | Transaction amount |
| payment_method | VARCHAR(50) | DEFAULT 'cash' | Payment type (cash/bank/cheque) |
| status | expense_status | DEFAULT 'pending' | Approval workflow state |
| reference | VARCHAR(200) | | Auto-generated reference number |
| wd_reason | TEXT | | Withdrawal reason if applicable |
| qs_notes | TEXT | | QS notes (also stores from_person_name) |
| week_start | DATE | | Week period start |
| week_end | DATE | | Week period end |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last modification timestamp |

**Relationships**:
- References: `users`, `managing_directors`, `bank_accounts`, `sites`
- Referenced by: `record_attachments` (record_id)
- Referenced by: `approvals` (record_id)
- Referenced by: `ledger_entries` (expense_record_id)

**Indexes**:
- `idx_expense_records_status` on status
- `idx_expense_records_site_id` on site_id
- `idx_expense_records_entry_date` on entry_date
- `idx_expense_records_entered_by` on entered_by_user_id

**Triggers**:
- `update_expense_records_updated_at` - Auto-updates `updated_at`
- `expense_approved_ledger_trigger` - Creates double-entry ledger records when status becomes 'approved' or 'wd_approved'
- `expense_reference_trigger` - Auto-generates reference number in format EXP-YYYY-NNNN

**Business Rules**:
- Either `md_id` OR `from_bank_account_id` must be set (source of funds)
- Status progresses through workflow: pending → approved/rejected OR wd_pending → wd_approved/wd_rejected
- Reference auto-generated on INSERT: EXP-2026-0001, EXP-2026-0002, etc.

---

### 6. **record_attachments**
File uploads associated with expense records (receipts, invoices).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique attachment identifier |
| record_id | UUID | REFERENCES expense_records(id) ON DELETE CASCADE, NOT NULL | Parent expense record |
| filename | VARCHAR(255) | NOT NULL | Original filename |
| url | TEXT | NOT NULL | File storage URL/path |
| uploaded_by | UUID | REFERENCES users(id) | User who uploaded file |
| uploaded_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Upload timestamp |

**Relationships**:
- References: `expense_records`, `users`

**Indexes**: None additional

**Triggers**: None

**Notes**: CASCADE delete ensures attachments are removed when parent expense is deleted.

---

### 7. **approvals**
Audit trail of approval decisions on expense records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique approval identifier |
| record_id | UUID | REFERENCES expense_records(id) ON DELETE CASCADE, NOT NULL | Parent expense record |
| approver_id | UUID | REFERENCES users(id), NOT NULL | User who made decision |
| approved | BOOLEAN | NOT NULL | Decision outcome (true/false) |
| comments | TEXT | | Approver's notes |
| approved_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Decision timestamp |

**Relationships**:
- References: `expense_records`, `users`

**Indexes**:
- `idx_approvals_record_id` on record_id

**Triggers**: None

**Business Logic**: Multiple approvals can exist per expense (multi-level approval workflow).

---

### 8. **funding_transactions**
Records of money transfers into bank accounts or supervisor floats.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique transaction identifier |
| source | VARCHAR(255) | NOT NULL | Origin of funds (description) |
| destination_bank_id | UUID | REFERENCES bank_accounts(id) | If funding a bank account |
| destination_md_id | UUID | REFERENCES managing_directors(id) | If funding a supervisor |
| amount | DECIMAL(15, 2) | NOT NULL, CHECK > 0 | Funding amount |
| transaction_date | DATE | NOT NULL, DEFAULT CURRENT_DATE | Transaction date |
| notes | TEXT | | Additional information |
| created_by | UUID | REFERENCES users(id) | User who recorded transaction |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |

**Relationships**:
- References: `bank_accounts`, `managing_directors`, `users`

**Indexes**: None additional

**Triggers**: None

**Business Rules**: Either `destination_bank_id` OR `destination_md_id` must be set.

---

### 9. **bank_transfers**
Inter-account fund transfers (including cheque deposits).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique transfer identifier |
| from_account_id | UUID | REFERENCES bank_accounts(id), NOT NULL* | Source account |
| to_account_id | UUID | REFERENCES bank_accounts(id), NOT NULL | Destination account |
| amount | DECIMAL(15, 2) | NOT NULL, CHECK > 0 | Transfer amount |
| description | TEXT | | Transfer purpose/notes |
| transfer_date | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Transfer timestamp |
| cheque_id | UUID | REFERENCES cheques(id) | If transfer is from cheque deposit |
| transfer_type | VARCHAR(50) | DEFAULT 'manual', CHECK IN (...) | Type: manual/cheque_deposit/expense |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |

**Constraints**:
- `different_accounts` CHECK: from_account_id != to_account_id

**Relationships**:
- References: `bank_accounts`, `cheques`

**Indexes**:
- `idx_bank_transfers_from_account` on from_account_id
- `idx_bank_transfers_to_account` on to_account_id
- `idx_bank_transfers_date` on transfer_date DESC
- `idx_bank_transfers_cheque` on cheque_id

**Triggers**: None

**Notes**: *from_account_id can be NULL in some transfer scenarios (migration 005).

---

### 10. **cheques**
Manages received cheques and their deposit lifecycle.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique cheque identifier |
| bank_account_id | UUID | REFERENCES bank_accounts(id), NOT NULL | Issuing bank account |
| cheque_number | VARCHAR(100) | NOT NULL | Cheque number from cheque leaf |
| payee_name | VARCHAR(255) | NOT NULL | Name of recipient |
| amount | DECIMAL(15, 2) | NOT NULL, CHECK > 0 | Cheque amount |
| cheque_date | DATE | NOT NULL | Date written on cheque |
| deposit_date | DATE | | Date deposited to bank |
| deposited_to_account_id | UUID | REFERENCES bank_accounts(id) | Account where deposited |
| status | VARCHAR(50) | DEFAULT 'pending', CHECK IN (...) | Cheque status |
| description | TEXT | | Purpose/notes |
| created_by | UUID | REFERENCES users(id) | User who created record |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last modification timestamp |

**Status Values**: pending, deposited, cleared, bounced, cancelled

**Relationships**:
- References: `bank_accounts`, `users`
- Referenced by: `bank_transfers` (cheque_id)

**Indexes**:
- `idx_cheques_bank_account` on bank_account_id
- `idx_cheques_deposited_to` on deposited_to_account_id
- `idx_cheques_status` on status
- `idx_cheques_date` on cheque_date DESC

**Triggers**:
- `update_cheques_updated_at` - Auto-updates `updated_at`

**Lifecycle**:
1. pending → deposited (when deposited to bank)
2. deposited → cleared (when funds available)
3. deposited → bounced (if cheque fails)
4. pending → cancelled (if voided)

---

## Ledger System (Double-Entry Bookkeeping)

### 11. **ledger_accounts**
Chart of Accounts - defines all financial accounts in the system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique account identifier |
| account_code | VARCHAR(50) | UNIQUE, NOT NULL | Account code (e.g., BANK-MAIN) |
| account_name | VARCHAR(255) | NOT NULL | Human-readable account name |
| account_type | account_type | NOT NULL | asset/liability/expense/revenue |
| account_category | account_category | NOT NULL | Sub-classification |
| parent_account_id | UUID | REFERENCES ledger_accounts(id) | Hierarchical parent account |
| reference_id | UUID | | Links to entity (bank_accounts.id, etc.) |
| balance | DECIMAL(15, 2) | DEFAULT 0 | Current running balance |
| active | BOOLEAN | DEFAULT true | Account status |
| description | TEXT | | Account purpose description |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last modification timestamp |

**Relationships**:
- Self-referential: parent_account_id references ledger_accounts(id)
- Referenced by: `ledger_entries` (account_id)
- Soft references entities via reference_id (bank_accounts, managing_directors, users)

**Indexes**:
- `idx_ledger_accounts_type` on account_type
- `idx_ledger_accounts_category` on account_category
- `idx_ledger_accounts_reference` on reference_id

**Triggers**:
- `update_ledger_accounts_updated_at` - Auto-updates `updated_at`

**Auto-Created Accounts**:
- `BANK-{NAME}` for each bank_account (asset, bank)
- `SUP-{NAME}` for each managing_director (liability, supervisor)
- `CASH-{NAME}` for each user's petty cash (asset, petty_cash)
- `USER-{NAME}` for user accounts (liability, user)
- `EXP-MACHINE` - Machine expenses (expense, machine)
- `EXP-RENT` - Rent expenses (expense, rent)
- `EXP-GENERAL` - General expenses (expense, general)
- `REV-DEPOSITS` - Bank deposits revenue (revenue, general)
- `LIABILITY-PAYABLE` - Expenses payable (liability, general)

---

### 12. **ledger_entries**
Individual debit/credit entries for all transactions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique entry identifier |
| transaction_date | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Transaction timestamp |
| account_id | UUID | REFERENCES ledger_accounts(id), NOT NULL | Parent ledger account |
| expense_record_id | UUID | REFERENCES expense_records(id) ON DELETE CASCADE | If from expense transaction |
| debit | DECIMAL(15, 2) | DEFAULT 0, CHECK >= 0 | Debit amount |
| credit | DECIMAL(15, 2) | DEFAULT 0, CHECK >= 0 | Credit amount |
| balance_after | DECIMAL(15, 2) | | Account balance after entry |
| description | TEXT | | Entry description |
| reference_number | VARCHAR(100) | | Transaction reference |
| created_by | UUID | REFERENCES users(id) | User who triggered entry |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |

**Constraints**:
- `debit_or_credit_only` CHECK: (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)

**Relationships**:
- References: `ledger_accounts`, `expense_records`, `users`

**Indexes**:
- `idx_ledger_entries_account` on account_id
- `idx_ledger_entries_expense` on expense_record_id
- `idx_ledger_entries_date` on transaction_date DESC

**Triggers**: None (entries created by stored procedures)

**Business Rules**:
- Each entry has EITHER a debit OR a credit (never both)
- Every transaction creates at least 2 entries (double-entry)
- Debits and credits must balance for each transaction

---

## Key Relationships & Entity Diagram

### Primary Entity Relationships

```
users
  ├─── expense_records (entered_by_user_id)
  ├─── approvals (approver_id)
  ├─── record_attachments (uploaded_by)
  ├─── funding_transactions (created_by)
  ├─── cheques (created_by)
  └─── ledger_entries (created_by)

bank_accounts
  ├─── expense_records (from_bank_account_id)
  ├─── funding_transactions (destination_bank_id)
  ├─── bank_transfers (from_account_id, to_account_id)
  ├─── cheques (bank_account_id, deposited_to_account_id)
  └─── ledger_accounts (reference_id)

managing_directors
  ├─── expense_records (md_id)
  ├─── funding_transactions (destination_md_id)
  └─── ledger_accounts (reference_id)

sites
  └─── expense_records (site_id)

expense_records
  ├─── record_attachments (record_id) [CASCADE]
  ├─── approvals (record_id) [CASCADE]
  └─── ledger_entries (expense_record_id) [CASCADE]

cheques
  └─── bank_transfers (cheque_id)

ledger_accounts
  └─── ledger_entries (account_id)
```

---

## Stored Procedures & Functions

### 1. **update_updated_at_column()**
Generic trigger function to auto-update `updated_at` timestamp.

**Used by**: users, bank_accounts, managing_directors, expense_records, cheques, ledger_accounts

---

### 2. **get_or_create_ledger_account()**
Idempotent function to retrieve or create a ledger account.

**Parameters**:
- p_account_code VARCHAR(50)
- p_account_name VARCHAR(255)
- p_account_type account_type
- p_account_category account_category
- p_reference_id UUID (optional)

**Returns**: UUID (account_id)

**Usage**: Called by expense ledger functions to ensure accounts exist.

---

### 3. **create_expense_ledger_entries()**
Core function creating double-entry ledger records for expenses.

**Parameters**:
- p_expense_id UUID
- p_amount DECIMAL
- p_purpose TEXT
- p_to_name VARCHAR
- p_from_bank_id UUID
- p_md_id UUID
- p_transaction_date TIMESTAMP
- p_created_by UUID
- p_from_person_name TEXT (from qs_notes)
- p_payment_method VARCHAR

**Logic**:
1. Determines if beneficiary (to_name) is a user → creates cash account
2. Otherwise categorizes expense (machine/rent/general)
3. Creates DEBIT entry (expense or user cash increases)
4. Creates CREDIT entry (bank/supervisor/petty cash decreases)
5. Updates ledger_accounts balances

**Special Handling**:
- If `to_name` matches a user → credit their CASH account (asset)
- If `payment_method` is 'cash' → debit from person's petty cash
- If `from_bank_account_id` set → credit bank account
- If `md_id` set → credit supervisor float

---

### 4. **trigger_create_expense_ledger()**
Trigger function that automatically invokes `create_expense_ledger_entries()`.

**Triggered**: AFTER INSERT OR UPDATE on expense_records  
**Condition**: When status changes to 'approved' or 'wd_approved'

---

### 5. **create_bank_deposit_ledger_entry()**
Creates ledger entries for bank deposits (cheques, income).

**Parameters**:
- p_bank_account_id UUID
- p_amount DECIMAL
- p_description TEXT
- p_reference_number VARCHAR
- p_deposit_date TIMESTAMP
- p_created_by UUID

**Logic**:
1. Creates DEBIT entry to bank account (asset increases)
2. Creates CREDIT entry to REV-DEPOSITS (revenue increases)
3. Updates both account balances

---

### 6. **generate_expense_reference()**
Generates unique expense reference numbers.

**Format**: EXP-YYYY-NNNN (e.g., EXP-2026-0001)

**Returns**: VARCHAR(200)

**Logic**:
- Uses PostgreSQL sequence `expense_reference_seq`
- Loops until unique reference found
- Year based on current date

---

### 7. **auto_generate_expense_reference()**
Trigger function to auto-assign reference on expense INSERT.

**Triggered**: BEFORE INSERT on expense_records  
**Condition**: Only if reference is NULL or empty

---

## Indexes Summary

### Performance Optimization
- **expense_records**: status, site_id, entry_date, entered_by_user_id
- **users**: email
- **approvals**: record_id
- **bank_transfers**: from_account_id, to_account_id, transfer_date, cheque_id
- **cheques**: bank_account_id, deposited_to_account_id, status, cheque_date
- **ledger_accounts**: account_type, account_category, reference_id
- **ledger_entries**: account_id, expense_record_id, transaction_date

---

## Sequences

### expense_reference_seq
Auto-increment sequence for generating expense reference numbers.

**Usage**: Called by `generate_expense_reference()`  
**Reset Logic**: Synced with highest existing EXP-YYYY-#### number

---

## Data Flow Examples

### Example 1: Expense Approval Flow
```
1. User creates expense_record (status='pending')
   ↓
2. Auto-assign reference: EXP-2026-0123
   ↓
3. Approver reviews and approves (status → 'approved')
   ↓
4. trigger_create_expense_ledger fires
   ↓
5. create_expense_ledger_entries executes:
   - DEBIT: EXP-GENERAL account (+10,000)
   - CREDIT: BANK-MAIN account (-10,000)
   ↓
6. ledger_accounts.balance updated
   ↓
7. Two ledger_entries created with reference_number='EXP-{id}'
```

### Example 2: Cheque Deposit Flow
```
1. Create cheque record (status='pending')
   ↓
2. User deposits cheque to bank_account
   ↓
3. cheque.status → 'deposited'
   cheque.deposited_to_account_id → {bank_account_id}
   ↓
4. bank_transfer created:
   - from_account_id: NULL/source
   - to_account_id: deposited_to_account_id
   - cheque_id: {cheque_id}
   - transfer_type: 'cheque_deposit'
   ↓
5. create_bank_deposit_ledger_entry:
   - DEBIT: BANK-{NAME} (+amount)
   - CREDIT: REV-DEPOSITS (+amount)
```

### Example 3: Petty Cash from User
```
1. expense_record created:
   - to_name: "John Contractor"
   - payment_method: 'cash'
   - qs_notes: "Alice Manager" (from_person_name)
   - status → 'approved'
   ↓
2. create_expense_ledger_entries checks:
   - to_name NOT a user → regular expense
   - payment_method='cash' + from_person_name='Alice Manager'
   ↓
3. Ledger entries:
   - DEBIT: EXP-GENERAL (+5,000)
   - CREDIT: CASH-ALICE-MANAGER (-5,000)
   ↓
4. Alice's petty cash balance decreases
```

### Example 4: Payment to User (Cash Advance)
```
1. expense_record created:
   - to_name: "Bob Worker" (exists in users table)
   - from_bank_account_id: {bank_id}
   - amount: 20,000
   - status → 'approved'
   ↓
2. create_expense_ledger_entries detects Bob is a user
   ↓
3. Ledger entries:
   - DEBIT: CASH-BOB-WORKER (+20,000)  [asset - cash given to Bob]
   - CREDIT: BANK-MAIN (-20,000)  [asset - bank funds decrease]
   ↓
4. Bob's petty cash balance increases
```

---

## Business Rules Summary

### Expense Record Rules
1. **Source of funds**: Must have EITHER `from_bank_account_id` OR `md_id` set
2. **Amount validation**: Must be > 0
3. **Reference auto-generation**: Format EXP-YYYY-NNNN
4. **Status workflow**: 
   - Standard: pending → approved/rejected
   - Withdrawal: wd_pending → wd_approved/wd_rejected
5. **Ledger creation**: Only triggered on 'approved' or 'wd_approved' status

### Bank Transfer Rules
1. **Different accounts**: from_account_id ≠ to_account_id
2. **Amount validation**: Must be > 0
3. **Transfer types**: manual, cheque_deposit, expense
4. **Cheque linking**: If cheque_id set, transfer_type should be 'cheque_deposit'

### Cheque Management Rules
1. **Status progression**: pending → deposited → cleared/bounced OR pending → cancelled
2. **Deposit requirement**: When deposited, must set deposited_to_account_id
3. **Bank transfer creation**: Deposit creates corresponding bank_transfer record

### Ledger System Rules
1. **Double-entry**: Every transaction creates ≥2 ledger_entries
2. **Debit OR Credit**: Each entry has ONLY one side (debit XOR credit)
3. **Balance equation**: Σ debits = Σ credits for each transaction
4. **Account balance tracking**: Updated automatically via stored procedures
5. **Cascading deletes**: Deleting expense removes associated ledger_entries

### Account Type Rules
1. **Assets** (debit increases): Bank accounts, petty cash
2. **Liabilities** (credit increases): Supervisor floats, payables
3. **Expenses** (debit increases): Machine, rent, general expenses
4. **Revenue** (credit increases): Deposits, income

---

## Migration History

The system has evolved through 17 migrations:

1. **001**: Initial schema (users, banks, MDs, sites, expenses, approvals)
2. **002**: Bank transfers functionality
3. **003**: Cheque management (parts 1 & 2)
4. **004**: Make cheque bank_account nullable
5. **005**: Make bank_transfer from_account nullable
6. **006**: Ledger system implementation (double-entry)
7. **007**: Enforce expense debit-only rule
8. **008**: Add worker role
9. **009**: Ledger petty cash by person
10. **010**: Ledger bank deposits and balance tracking
11. **011**: Ledger user accounts (payments to users)
12. **012**: Consolidate user cash accounts
13. **013**: Fix bank deposit trigger
14. **014**: Fix related_entity_id column
15. **015**: Ledger for wd_approved status
16. **016**: Auto-generate expense reference
17. **017**: Remove viewer role

---

## System Integration Points

### Authentication
- **JWT tokens** generated from users table
- **Password hashing** with bcrypt
- **Role-based access control** via app_role enum

### File Storage
- `record_attachments.url` stores file paths
- Files stored externally (not in database)

### Automatic Calculations
- Bank account balances
- Managing director float balances
- Ledger account balances
- Expense reference numbers

### Audit Trail
- All created_at/updated_at timestamps
- Approvals table tracks who approved what
- Ledger entries immutable (no updates)

---

## Database Maintenance

### Regular Tasks
1. **Backup** expense_records, ledger_entries, users
2. **Archive** old approved expenses (annual)
3. **Verify** ledger balance integrity
4. **Monitor** sequence values for reference numbers
5. **Clean** orphaned attachments (files without records)

### Performance Monitoring
- Watch query performance on:
  - expense_records filtering by status/date
  - ledger_entries joins with accounts
  - bank_transfers date range queries
- Consider partitioning ledger_entries by year if volume grows

### Data Integrity Checks
```sql
-- Verify ledger balance equation
SELECT 
  expense_record_id,
  SUM(debit) as total_debits,
  SUM(credit) as total_credits
FROM ledger_entries
WHERE expense_record_id IS NOT NULL
GROUP BY expense_record_id
HAVING SUM(debit) != SUM(credit);
-- Should return 0 rows

-- Verify account balance accuracy
SELECT 
  la.account_code,
  la.balance as stored_balance,
  COALESCE(SUM(le.debit - le.credit), 0) as calculated_balance
FROM ledger_accounts la
LEFT JOIN ledger_entries le ON la.id = le.account_id
GROUP BY la.id, la.account_code, la.balance
HAVING la.balance != COALESCE(SUM(le.debit - le.credit), 0);
-- Should return 0 rows
```

---

## Security Considerations

1. **Password Storage**: Bcrypt hashed, never stored plain-text
2. **CASCADE Deletes**: Ensure proper authorization before deleting expenses
3. **Foreign Key Integrity**: Enforced at database level
4. **Ledger Immutability**: No UPDATE/DELETE on ledger_entries (insert-only)
5. **Active Status Flags**: Use instead of hard deletes (users, accounts, sites)
6. **Role Validation**: Enforce role-based rules at application layer

---

## Database Size Estimates

### Small Installation (1 year)
- 5 users, 3 sites, 5 bank accounts
- ~2,000 expense records/year
- ~5,000 ledger entries/year
- **Estimated size**: 50-100 MB

### Medium Installation (1 year)
- 20 users, 10 sites, 10 bank accounts
- ~10,000 expense records/year
- ~25,000 ledger entries/year
- **Estimated size**: 250-500 MB

### Large Installation (1 year)
- 50 users, 30 sites, 20 bank accounts
- ~50,000 expense records/year
- ~125,000 ledger entries/year
- **Estimated size**: 1-2 GB

---

## Conclusion

This Chandu Construction database implements a robust financial management system with:

✅ Complete double-entry bookkeeping  
✅ Multi-level approval workflows  
✅ Automated ledger entry creation  
✅ Comprehensive audit trails  
✅ Cheque management lifecycle  
✅ Petty cash tracking by person  
✅ User cash advances  
✅ Inter-bank transfers  
✅ Referential integrity  
✅ Automatic reference number generation  

The system is production-ready and follows accounting best practices while maintaining flexibility for construction industry workflows.

---

**Last Updated**: February 22, 2026  
**Database Version**: Migration 017  
**Schema File**: `backend/src/database/schema.sql`
