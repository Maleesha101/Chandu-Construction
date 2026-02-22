/**
 * Standalone JavaScript Migration Runner
 * 
 * Use this script when TypeScript isn't compiled yet (e.g., initial setup, Docker)
 * For development, use: npm run migrate (uses TypeScript directly)
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Validate required environment variables
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

/**
 * Create migrations tracking table if it doesn't exist
 */
async function createMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      version INTEGER NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_migrations_version ON migrations(version);
  `;
  
  await pool.query(query);
  console.log('✅ Migrations tracking table ready');
}

/**
 * Get list of completed migrations
 */
async function getCompletedMigrations() {
  const result = await pool.query(
    'SELECT version FROM migrations ORDER BY version'
  );
  
  return result.rows.map(row => row.version);
}

/**
 * Get all migration files from the migrations directory
 */
function getAllMigrations() {
  const migrationsDir = path.join(__dirname, '../src/database/migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Migrations directory not found:', migrationsDir);
    process.exit(1);
  }
  
  const files = fs.readdirSync(migrationsDir);
  const migrations = [];
  
  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    
    // Extract version number from filename (e.g., "002_bank_transfers.sql" -> 2)
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) {
      console.warn(`⚠️  Skipping invalid migration filename: ${file}`);
      continue;
    }
    
    const version = parseInt(match[1]);
    const name = match[2];
    
    migrations.push({
      filename: file,
      version,
      name,
      path: path.join(migrationsDir, file),
    });
  }
  
  // Sort by version number
  migrations.sort((a, b) => a.version - b.version);
  
  return migrations;
}

/**
 * Run a single migration
 */
async function runMigration(migration) {
  console.log(`🔄 Running migration ${migration.version}: ${migration.name}...`);
  
  const sql = fs.readFileSync(migration.path, 'utf8');
  
  // Start transaction
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Run migration SQL
    await client.query(sql);
    
    // Record migration as completed
    await client.query(
      'INSERT INTO migrations (version, name) VALUES ($1, $2)',
      [migration.version, migration.name]
    );
    
    await client.query('COMMIT');
    console.log(`✅ Migration ${migration.version} completed successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration ${migration.version} failed:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main migration function
 */
async function migrate() {
  try {
    console.log('🚀 Starting database migration...\n');
    console.log(`Database: ${process.env.DB_NAME || 'site_cash_flow'}`);
    console.log(`User: ${process.env.DB_USER || 'postgres'}\n`);
    
    // Create migrations table if it doesn't exist
    await createMigrationsTable();
    
    // Get completed migrations
    const completed = await getCompletedMigrations();
    console.log(`📋 Completed migrations: ${completed.join(', ') || 'none'}\n`);
    
    // Get all migration files
    const allMigrations = getAllMigrations();
    console.log(`📁 Found ${allMigrations.length} migration files\n`);
    
    // Filter pending migrations
    const pending = allMigrations.filter(m => !completed.includes(m.version));
    
    if (pending.length === 0) {
      console.log('✅ All migrations are up to date!');
      return;
    }
    
    console.log(`📝 Pending migrations: ${pending.length}\n`);
    
    // Run pending migrations
    for (const migration of pending) {
      await runMigration(migration);
    }
    
    console.log(`\n🎉 All migrations completed successfully!`);
    console.log(`✅ Database is up to date\n`);
    
  } catch (error) {
    console.error('\n❌ Migration process failed:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Show migration status
 */
async function status() {
  try {
    console.log('📊 Migration Status\n');
    console.log(`Database: ${process.env.DB_NAME || 'site_cash_flow'}`);
    console.log(`User: ${process.env.DB_USER || 'postgres'}\n`);
    
    await createMigrationsTable();
    
    const completed = await getCompletedMigrations();
    const allMigrations = getAllMigrations();
    
    console.log(`Total migrations: ${allMigrations.length}`);
    console.log(`Completed: ${completed.length}`);
    console.log(`Pending: ${allMigrations.length - completed.length}\n`);
    
    console.log('Migrations:');
    for (const migration of allMigrations) {
      const statusIcon = completed.includes(migration.version) ? '✅' : '⏳';
      console.log(`  ${statusIcon} ${migration.version.toString().padStart(3, '0')}: ${migration.name}`);
    }
    console.log();
    
  } catch (error) {
    console.error('❌ Failed to get migration status:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Main entry point
const command = process.argv[2] || 'migrate';

if (command === 'status') {
  status();
} else if (command === 'migrate' || command === 'up') {
  migrate();
} else {
  console.error('❌ Unknown command:', command);
  console.log('\nUsage:');
  console.log('  node scripts/migrate.js          - Run pending migrations');
  console.log('  node scripts/migrate.js status   - Show migration status');
  console.log('\nOr use npm scripts:');
  console.log('  npm run migrate:js               - Run pending migrations');
  console.log('  npm run migrate                  - Run migrations (TypeScript)');
  console.log('  npm run migrate:status           - Show migration status');
  process.exit(1);
}
