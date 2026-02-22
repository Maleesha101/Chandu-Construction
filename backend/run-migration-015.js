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
    console.log('🔄 Running migration 015 - Ledger entries for WD approved expenses...');
    
    const migrationPath = path.join(__dirname, 'src/database/migrations/015_ledger_for_wd_approved.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 015 completed successfully!');
    console.log('✅ Ledger entries will now be created for both approved and wd_approved expenses');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
