/**
 * Automated Database Migration Runner
 * 
 * This script:
 * - Creates a migrations tracking table
 * - Runs all pending migrations in order
 * - Records completed migrations
 * - Can be run safely multiple times (idempotent)
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/env';

interface Migration {
  filename: string;
  version: number;
  name: string;
  path: string;
}

const pool = new Pool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
});

/**
 * Create migrations tracking table if it doesn't exist
 */
async function createMigrationsTable(): Promise<void> {
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
async function getCompletedMigrations(): Promise<number[]> {
  const result = await pool.query<{ version: number }>(
    'SELECT version FROM migrations ORDER BY version'
  );
  
  return result.rows.map(row => row.version);
}

/**
 * Get all migration files from the migrations directory
 */
function getAllMigrations(): Migration[] {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Migrations directory not found:', migrationsDir);
    process.exit(1);
  }
  
  const files = fs.readdirSync(migrationsDir);
  const migrations: Migration[] = [];
  
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
async function runMigration(migration: Migration): Promise<void> {
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
async function migrate(): Promise<void> {
  try {
    console.log('🚀 Starting database migration...\n');
    
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
    console.error('\n❌ Migration process failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Show migration status
 */
async function status(): Promise<void> {
  try {
    console.log('📊 Migration Status\n');
    
    await createMigrationsTable();
    
    const completed = await getCompletedMigrations();
    const allMigrations = getAllMigrations();
    
    console.log(`Total migrations: ${allMigrations.length}`);
    console.log(`Completed: ${completed.length}`);
    console.log(`Pending: ${allMigrations.length - completed.length}\n`);
    
    console.log('Migrations:');
    for (const migration of allMigrations) {
      const status = completed.includes(migration.version) ? '✅' : '⏳';
      console.log(`  ${status} ${migration.version.toString().padStart(3, '0')}: ${migration.name}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to get migration status:', error);
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
  console.log('  npm run migrate          - Run pending migrations');
  console.log('  npm run migrate:status   - Show migration status');
  process.exit(1);
}
