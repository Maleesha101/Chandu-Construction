import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'site_cash_flow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// Helper functions
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;
const randomDate = (start: Date, end: Date) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const randomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomBoolean = () => Math.random() > 0.5;

// Sample data generators
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Robert', 'Lisa', 'William', 'Mary', 'James', 'Patricia', 'Richard', 'Jennifer', 'Charles', 'Linda', 'Thomas', 'Barbara', 'Daniel', 'Susan'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee'];
const bankNames = ['Commercial Bank', 'Sampath Bank', 'Bank of Ceylon', 'Peoples Bank', 'Hatton National Bank', 'DFCC Bank', 'Nations Trust Bank', 'Seylan Bank'];
const siteLocations = ['Colombo', 'Gampaha', 'Kandy', 'Galle', 'Matara', 'Jaffna', 'Trincomalee', 'Batticaloa', 'Kurunegala', 'Anuradhapura'];
const expensePurposes = ['Material Purchase', 'Labor Payment', 'Equipment Rental', 'Fuel', 'Transportation', 'Maintenance', 'Supplies', 'Subcontractor Payment', 'Utilities', 'Administrative Costs'];
const paymentMethods = ['cash', 'bank_transfer', 'cheque', 'petty_cash'];
const statuses: Array<'pending' | 'approved' | 'rejected' | 'wd_pending' | 'wd_approved' | 'wd_rejected'> = ['pending', 'approved', 'rejected', 'wd_pending', 'wd_approved', 'wd_rejected'];
const roles: Array<'boss' | 'admin' | 'qs' | 'md' | 'worker'> = ['boss', 'admin', 'qs', 'md', 'worker'];

const generateFullName = () => `${randomElement(firstNames)} ${randomElement(lastNames)}`;
const generateEmail = (name: string) => `${name.toLowerCase().replace(' ', '.')}${randomInt(1, 999)}@example.com`;
const generatePhone = () => `0${randomInt(71, 77)}${randomInt(1000000, 9999999)}`;

async function seedUsers(count: number = 1000) {
  console.log(`Seeding ${count} users...`);
  const passwordHash = await bcrypt.hash('Password123!', 10);
  
  for (let i = 0; i < count; i++) {
    const fullName = generateFullName();
    const email = generateEmail(fullName);
    const role = randomElement(roles);
    const phone = generatePhone();
    
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role, active, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO NOTHING`,
      [email, passwordHash, fullName, phone, role, randomBoolean(), new Date(), new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} users`);
  }
  console.log('✅ Users seeded');
}

async function seedBankAccounts(count: number = 1000) {
  console.log(`Seeding ${count} bank accounts...`);
  
  for (let i = 0; i < count; i++) {
    const accountName = `Account ${i + 1}`;
    const bankName = randomElement(bankNames);
    const accountNumber = `${randomInt(100000000, 999999999)}`;
    const balance = randomFloat(0, 10000000);
    
    await pool.query(
      `INSERT INTO bank_accounts (name, bank_name, account_number, balance, currency, active, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [accountName, bankName, accountNumber, balance, 'LKR', randomBoolean(), new Date(), new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} bank accounts`);
  }
  console.log('✅ Bank accounts seeded');
}

async function seedManagingDirectors(count: number = 1000) {
  console.log(`Seeding ${count} managing directors...`);
  
  for (let i = 0; i < count; i++) {
    const name = generateFullName();
    const contact = generatePhone();
    const email = generateEmail(name);
    const floatBalance = randomFloat(0, 500000);
    
    await pool.query(
      `INSERT INTO managing_directors (name, contact, email, float_balance, active, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [name, contact, email, floatBalance, randomBoolean(), new Date(), new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} managing directors`);
  }
  console.log('✅ Managing directors seeded');
}

async function seedSites(count: number = 1000) {
  console.log(`Seeding ${count} sites...`);
  
  for (let i = 0; i < count; i++) {
    const name = `Site ${i + 1}`;
    const location = randomElement(siteLocations);
    const code = `SITE-${String(i + 1).padStart(4, '0')}`;
    
    await pool.query(
      `INSERT INTO sites (name, location, code, active, created_at) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO NOTHING`,
      [name, location, code, randomBoolean(), new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} sites`);
  }
  console.log('✅ Sites seeded');
}

async function seedExpenseRecords(count: number = 1000) {
  console.log(`Seeding ${count} expense records...`);
  
  const users = await pool.query('SELECT id FROM users LIMIT 1000');
  const bankAccounts = await pool.query('SELECT id FROM bank_accounts LIMIT 1000');
  const mds = await pool.query('SELECT id FROM managing_directors LIMIT 1000');
  const sites = await pool.query('SELECT id FROM sites LIMIT 1000');
  
  if (users.rows.length === 0 || bankAccounts.rows.length === 0 || sites.rows.length === 0) {
    console.error('❌ Cannot seed expense records: missing required data');
    return;
  }
  
  for (let i = 0; i < count; i++) {
    const entryDate = randomDate(new Date(2023, 0, 1), new Date());
    const enteredByUserId = randomElement(users.rows).id;
    const mdId = mds.rows.length > 0 ? (Math.random() > 0.3 ? randomElement(mds.rows).id : null) : null;
    const fromBankAccountId = bankAccounts.rows.length > 0 ? (Math.random() > 0.5 ? randomElement(bankAccounts.rows).id : null) : null;
    const toName = generateFullName();
    const purpose = randomElement(expensePurposes);
    const siteId = sites.rows.length > 0 ? (Math.random() > 0.2 ? randomElement(sites.rows).id : null) : null;
    const amount = randomFloat(1000, 500000);
    const paymentMethod = randomElement(paymentMethods);
    const status = randomElement(statuses);
    const weekStart = new Date(entryDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    await pool.query(
      `INSERT INTO expense_records (entry_date, entered_by_user_id, md_id, from_bank_account_id, to_name, purpose, site_id, amount, payment_method, status, week_start, week_end, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [entryDate, enteredByUserId, mdId, fromBankAccountId, toName, purpose, siteId, amount, paymentMethod, status, weekStart, weekEnd, new Date(), new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} expense records`);
  }
  console.log('✅ Expense records seeded');
}

async function seedRecordAttachments(count: number = 1000) {
  console.log(`Seeding ${count} record attachments...`);
  
  const expenseRecords = await pool.query('SELECT id FROM expense_records LIMIT 1000');
  const users = await pool.query('SELECT id FROM users LIMIT 1000');
  
  if (expenseRecords.rows.length === 0 || users.rows.length === 0) {
    console.error('❌ Cannot seed record attachments: missing required data');
    return;
  }
  
  for (let i = 0; i < count; i++) {
    const recordId = randomElement(expenseRecords.rows).id;
    const filename = `attachment_${i + 1}.pdf`;
    const url = `https://storage.example.com/attachments/${filename}`;
    const uploadedBy = randomElement(users.rows).id;
    
    await pool.query(
      `INSERT INTO record_attachments (record_id, filename, url, uploaded_by, uploaded_at) 
       VALUES ($1, $2, $3, $4, $5)`,
      [recordId, filename, url, uploadedBy, new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} record attachments`);
  }
  console.log('✅ Record attachments seeded');
}

async function seedApprovals(count: number = 1000) {
  console.log(`Seeding ${count} approvals...`);
  
  const expenseRecords = await pool.query('SELECT id FROM expense_records LIMIT 1000');
  const users = await pool.query('SELECT id FROM users LIMIT 1000');
  
  if (expenseRecords.rows.length === 0 || users.rows.length === 0) {
    console.error('❌ Cannot seed approvals: missing required data');
    return;
  }
  
  for (let i = 0; i < count; i++) {
    const recordId = randomElement(expenseRecords.rows).id;
    const approverId = randomElement(users.rows).id;
    const approved = randomBoolean();
    const comments = approved ? 'Approved' : 'Rejected due to insufficient documentation';
    
    await pool.query(
      `INSERT INTO approvals (record_id, approver_id, approved, comments, approved_at) 
       VALUES ($1, $2, $3, $4, $5)`,
      [recordId, approverId, approved, comments, new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} approvals`);
  }
  console.log('✅ Approvals seeded');
}

async function seedCheques(count: number = 1000) {
  console.log(`Seeding ${count} cheques...`);
  
  const bankAccounts = await pool.query('SELECT id FROM bank_accounts LIMIT 1000');
  const users = await pool.query('SELECT id FROM users LIMIT 1000');
  
  if (bankAccounts.rows.length === 0 || users.rows.length === 0) {
    console.error('❌ Cannot seed cheques: missing required data');
    return;
  }
  
  const chequeStatuses = ['pending', 'deposited', 'cleared', 'bounced', 'cancelled'];
  
  for (let i = 0; i < count; i++) {
    const bankAccountId = randomElement(bankAccounts.rows).id;
    const chequeNumber = `CHQ${String(i + 1).padStart(6, '0')}`;
    const payeeName = generateFullName();
    const amount = randomFloat(5000, 1000000);
    const chequeDate = randomDate(new Date(2023, 0, 1), new Date());
    const status = randomElement(chequeStatuses);
    const depositDate = status !== 'pending' ? randomDate(chequeDate, new Date()) : null;
    const depositedToAccountId = depositDate ? randomElement(bankAccounts.rows).id : null;
    const createdBy = randomElement(users.rows).id;
    
    await pool.query(
      `INSERT INTO cheques (bank_account_id, cheque_number, payee_name, amount, cheque_date, deposit_date, deposited_to_account_id, status, description, created_by, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [bankAccountId, chequeNumber, payeeName, amount, chequeDate, depositDate, depositedToAccountId, status, `Cheque payment to ${payeeName}`, createdBy, new Date(), new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} cheques`);
  }
  console.log('✅ Cheques seeded');
}

async function seedLedgerAccounts(count: number = 1000) {
  console.log(`Seeding ${count} ledger accounts...`);
  
  const accountTypes: Array<'asset' | 'liability' | 'expense' | 'revenue'> = ['asset', 'liability', 'expense', 'revenue'];
  const accountCategories: Array<'bank' | 'supervisor' | 'machine' | 'rent' | 'general' | 'petty_cash' | 'user'> = ['bank', 'supervisor', 'machine', 'rent', 'general', 'petty_cash', 'user'];
  
  for (let i = 0; i < count; i++) {
    const accountCode = `ACC-${String(i + 1).padStart(6, '0')}`;
    const accountName = `Ledger Account ${i + 1}`;
    const accountType = randomElement(accountTypes);
    const accountCategory = randomElement(accountCategories);
    const balance = randomFloat(-100000, 500000);
    
    await pool.query(
      `INSERT INTO ledger_accounts (account_code, account_name, account_type, account_category, balance, active, description, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (account_code) DO NOTHING`,
      [accountCode, accountName, accountType, accountCategory, balance, randomBoolean(), `Description for ${accountName}`, new Date(), new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} ledger accounts`);
  }
  console.log('✅ Ledger accounts seeded');
}

async function seedLedgerEntries(count: number = 1000) {
  console.log(`Seeding ${count} ledger entries...`);
  
  const ledgerAccounts = await pool.query('SELECT id FROM ledger_accounts LIMIT 1000');
  const expenseRecords = await pool.query('SELECT id FROM expense_records LIMIT 1000');
  const users = await pool.query('SELECT id FROM users LIMIT 1000');
  
  if (ledgerAccounts.rows.length === 0 || users.rows.length === 0) {
    console.error('❌ Cannot seed ledger entries: missing required data');
    return;
  }
  
  for (let i = 0; i < count; i++) {
    const accountId = randomElement(ledgerAccounts.rows).id;
    const expenseRecordId = expenseRecords.rows.length > 0 ? (Math.random() > 0.5 ? randomElement(expenseRecords.rows).id : null) : null;
    const isDebit = randomBoolean();
    const amount = randomFloat(1000, 500000);
    const balanceAfter = randomFloat(-50000, 1000000);
    const createdBy = randomElement(users.rows).id;
    const referenceNumber = `REF-${String(i + 1).padStart(6, '0')}`;
    
    await pool.query(
      `INSERT INTO ledger_entries (transaction_date, account_id, expense_record_id, debit, credit, balance_after, description, reference_number, created_by, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [randomDate(new Date(2023, 0, 1), new Date()), accountId, expenseRecordId, isDebit ? amount : 0, isDebit ? 0 : amount, balanceAfter, `Ledger entry ${i + 1}`, referenceNumber, createdBy, new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} ledger entries`);
  }
  console.log('✅ Ledger entries seeded');
}

async function seedFundingTransactions(count: number = 1000) {
  console.log(`Seeding ${count} funding transactions...`);
  
  const bankAccounts = await pool.query('SELECT id FROM bank_accounts LIMIT 1000');
  const mds = await pool.query('SELECT id FROM managing_directors LIMIT 1000');
  const users = await pool.query('SELECT id FROM users LIMIT 1000');
  
  if (users.rows.length === 0) {
    console.error('❌ Cannot seed funding transactions: missing required data');
    return;
  }
  
  for (let i = 0; i < count; i++) {
    const source = `Funding Source ${i + 1}`;
    const destinationBankId = bankAccounts.rows.length > 0 ? (Math.random() > 0.5 ? randomElement(bankAccounts.rows).id : null) : null;
    const destinationMdId = mds.rows.length > 0 ? (Math.random() > 0.5 ? randomElement(mds.rows).id : null) : null;
    const amount = randomFloat(10000, 5000000);
    const transactionDate = randomDate(new Date(2023, 0, 1), new Date());
    const createdBy = randomElement(users.rows).id;
    
    await pool.query(
      `INSERT INTO funding_transactions (source, destination_bank_id, destination_md_id, amount, transaction_date, notes, created_by, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [source, destinationBankId, destinationMdId, amount, transactionDate, `Funding from ${source}`, createdBy, new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} funding transactions`);
  }
  console.log('✅ Funding transactions seeded');
}

async function seedBankTransfers(count: number = 1000) {
  console.log(`Seeding ${count} bank transfers...`);
  
  const bankAccounts = await pool.query('SELECT id FROM bank_accounts LIMIT 1000');
  const cheques = await pool.query('SELECT id FROM cheques LIMIT 1000');
  
  if (bankAccounts.rows.length === 0) {
    console.error('❌ Cannot seed bank transfers: missing required data');
    return;
  }
  
  const transferTypes = ['manual', 'cheque_deposit', 'expense'];
  
  for (let i = 0; i < count; i++) {
    const fromAccountId = Math.random() > 0.3 ? randomElement(bankAccounts.rows).id : null;
    const toAccountId = randomElement(bankAccounts.rows).id;
    const amount = randomFloat(5000, 500000);
    const transferType = randomElement(transferTypes);
    const chequeId = transferType === 'cheque_deposit' && cheques.rows.length > 0 ? randomElement(cheques.rows).id : null;
    const transferDate = randomDate(new Date(2023, 0, 1), new Date());
    
    await pool.query(
      `INSERT INTO bank_transfers (from_account_id, to_account_id, amount, description, transfer_date, cheque_id, transfer_type, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [fromAccountId, toAccountId, amount, `Bank transfer ${i + 1}`, transferDate, chequeId, transferType, new Date()]
    );
    
    if ((i + 1) % 100 === 0) console.log(`  - Inserted ${i + 1}/${count} bank transfers`);
  }
  console.log('✅ Bank transfers seeded');
}

async function main() {
  try {
    console.log('🚀 Starting database seeding with test data...\n');
    
    const recordCount = 1000;
    
    // Seed in order of dependencies
    await seedUsers(recordCount);
    await seedBankAccounts(recordCount);
    await seedManagingDirectors(recordCount);
    await seedSites(recordCount);
    await seedExpenseRecords(recordCount);
    await seedRecordAttachments(recordCount);
    await seedApprovals(recordCount);
    await seedCheques(recordCount);
    await seedLedgerAccounts(recordCount);
    await seedLedgerEntries(recordCount);
    await seedFundingTransactions(recordCount);
    await seedBankTransfers(recordCount);
    
    console.log('\n✅ All data seeded successfully!');
    console.log(`📊 Total records created: ${recordCount * 12} across 12 tables`);
    
    // Show summary
    const summary = await pool.query(`
      SELECT 
        'users' as table_name, COUNT(*) as count FROM users
      UNION ALL SELECT 'bank_accounts', COUNT(*) FROM bank_accounts
      UNION ALL SELECT 'managing_directors', COUNT(*) FROM managing_directors
      UNION ALL SELECT 'sites', COUNT(*) FROM sites
      UNION ALL SELECT 'expense_records', COUNT(*) FROM expense_records
      UNION ALL SELECT 'record_attachments', COUNT(*) FROM record_attachments
      UNION ALL SELECT 'approvals', COUNT(*) FROM approvals
      UNION ALL SELECT 'cheques', COUNT(*) FROM cheques
      UNION ALL SELECT 'ledger_accounts', COUNT(*) FROM ledger_accounts
      UNION ALL SELECT 'ledger_entries', COUNT(*) FROM ledger_entries
      UNION ALL SELECT 'funding_transactions', COUNT(*) FROM funding_transactions
      UNION ALL SELECT 'bank_transfers', COUNT(*) FROM bank_transfers
    `);
    
    console.log('\n📊 Database Summary:');
    console.table(summary.rows);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main as seedTestData };
