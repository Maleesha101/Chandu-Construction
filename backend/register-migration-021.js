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
    console.log('📝 Registering migration 021 in tracking table...');
    
    // Insert migration 021 record
    const result = await pool.query(
      `INSERT INTO migrations (version, name, executed_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (version) DO NOTHING 
       RETURNING *`,
      [21, 'fix_ledger_transaction_date']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Migration 021 registered successfully');
    } else {
      console.log('ℹ️  Migration 021 was already registered');
    }
    
    // Show current migration status
    const status = await pool.query('SELECT version, name FROM migrations ORDER BY version');
    console.log('\n📊 Registered migrations:');
    status.rows.forEach(row => {
      console.log(`  ${row.version.toString().padStart(3, '0')}: ${row.name}`);
    });
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

registerMigration();
