require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Validate DB_PASSWORD is set
if (!process.env.DB_PASSWORD) {
  console.error('❌ DB_PASSWORD environment variable is required');
  console.error('Please set DB_PASSWORD in your .env file');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'site_cash_flow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

console.log('Using database:', process.env.DB_NAME || 'site_cash_flow');
console.log('Using user:', process.env.DB_USER || 'postgres');

async function runMigration() {
  try {
    console.log('🔄 Running migration 022: Backfill wd_approved ledger entries...');
    
    const migrationPath = path.join(__dirname, 'src/database/migrations/022_backfill_wd_approved_ledger_entries.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Ledger entries created for wd_approved expenses!');
    console.log('✅ Migration completed!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runMigration();
