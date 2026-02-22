require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DB_PASSWORD) {
  console.error('❌ DB_PASSWORD environment variable is required');
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
    console.log('🔄 Running migration 014 - Fix related_entity_id column reference...');
    
    const migrationPath = path.join(__dirname, 'src/database/migrations/014_fix_related_entity_id_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 014 completed successfully!');
    console.log('✅ Function create_expense_ledger_entries fixed to use reference_id');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
