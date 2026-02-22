require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'chandu',
  user: process.env.DB_USER || 'maleesha',
  password: process.env.DB_PASSWORD,
});

async function registerMigration() {
  try {
    console.log('📝 Registering migration 022 in tracking table...');
    
    // Insert migration 022 record
    const result = await pool.query(
      `INSERT INTO migrations (version, name, executed_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (version) DO NOTHING 
       RETURNING *`,
      [22, 'backfill_wd_approved_ledger_entries']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Migration 022 registered successfully');
    } else {
      console.log('ℹ️  Migration 022 was already registered');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

registerMigration();
