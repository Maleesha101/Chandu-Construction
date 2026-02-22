require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'site_cash_flow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Malee9163@',
});

console.log('Using database:', process.env.DB_NAME || 'site_cash_flow');
console.log('Using user:', process.env.DB_USER || 'postgres');

async function runMigration() {
  try {
    console.log('🔄 Running migration 016 - Auto-generate expense reference numbers...');
    
    const migrationPath = path.join(__dirname, 'src/database/migrations/016_auto_generate_expense_reference.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 016 completed successfully!');
    console.log('✅ Expense records will now have automatic reference numbers (EXP-YYYY-NNNN)');
    console.log('✅ Existing records have been updated with reference numbers');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
