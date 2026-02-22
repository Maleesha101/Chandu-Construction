# Database Migration System

## Overview

This project uses an automated database migration system that:
- ✅ Tracks which migrations have been applied
- ✅ Runs pending migrations automatically in order
- ✅ Supports rollback via transactions
- ✅ Works in development, Docker, and production
- ✅ Can be run safely multiple times (idempotent)

## Quick Start

### Run All Pending Migrations

```bash
# Development (TypeScript)
npm run migrate

# Or using JavaScript (no compilation needed)
npm run migrate:js

# Production (after build)
npm run migrate:prod
```

### Check Migration Status

```bash
npm run migrate:status
```

## How It Works

### 1. Migration Tracking

The system creates a `migrations` table to track which migrations have been applied:

```sql
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Migration File Format

Migration files must follow this naming convention:

```
<version>_<description>.sql
```

Examples:
- `002_bank_transfers.sql`
- `014_fix_related_entity_id_column.sql`
- `017_remove_viewer_role.sql`

### 3. Migration Process

1. **Create migrations table** (if not exists)
2. **Scan** `src/database/migrations/` directory
3. **Compare** with completed migrations
4. **Run** each pending migration in a transaction
5. **Record** successful migrations

### 4. Transaction Safety

Each migration runs in a transaction:
- ✅ If successful: changes are committed and recorded
- ❌ If failed: changes are rolled back, process stops

## Usage

### Development

Use TypeScript version with ts-node:

```bash
npm run migrate
```

Output:
```
🚀 Starting database migration...

✅ Migrations tracking table ready
📋 Completed migrations: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13

📁 Found 17 migration files

📝 Pending migrations: 4

🔄 Running migration 14: fix_related_entity_id_column...
✅ Migration 14 completed successfully
🔄 Running migration 15: ledger_for_wd_approved...
✅ Migration 15 completed successfully
🔄 Running migration 16: auto_generate_expense_reference...
✅ Migration 16 completed successfully
🔄 Running migration 17: remove_viewer_role...
✅ Migration 17 completed successfully

🎉 All migrations completed successfully!
✅ Database is up to date
```

### Check Status

See which migrations are pending:

```bash
npm run migrate:status
```

Output:
```
📊 Migration Status

Database: site_cash_flow
User: postgres

Total migrations: 17
Completed: 17
Pending: 0

Migrations:
  ✅ 002: bank_transfers
  ✅ 003: add_cheques
  ✅ 004: make_cheque_bank_account_nullable
  ✅ 005: make_bank_transfer_from_nullable
  ✅ 006: ledger_system
  ✅ 007: enforce_expense_debit_only
  ✅ 008: add_worker_role
  ✅ 009: ledger_petty_cash_by_person
  ✅ 010: ledger_bank_deposits_and_balance
  ✅ 011: ledger_user_accounts
  ✅ 012: consolidate_user_cash_accounts
  ✅ 013: fix_bank_deposit_trigger
  ✅ 014: fix_related_entity_id_column
  ✅ 015: ledger_for_wd_approved
  ✅ 016: auto_generate_expense_reference
  ✅ 017: remove_viewer_role
```

### Docker Deployment

Migrations run **automatically** when the container starts via `docker-entrypoint.sh`:

```bash
docker-compose up -d
```

The entrypoint script:
1. Waits for database to be ready
2. Runs migrations automatically
3. Starts the application server

### Manual Migration (JavaScript)

If TypeScript isn't compiled yet:

```bash
node scripts/migrate.js
```

Or check status:

```bash
node scripts/migrate.js status
```

## Creating New Migrations

### 1. Create Migration File

Add a new `.sql` file in `src/database/migrations/`:

```bash
# Naming convention: <next_version>_<description>.sql
touch src/database/migrations/018_add_project_table.sql
```

### 2. Write Migration SQL

```sql
-- src/database/migrations/018_add_project_table.sql

-- Create projects table
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add index
CREATE INDEX idx_projects_name ON projects(name);
```

### 3. Run Migration

```bash
npm run migrate
```

The system will automatically:
- ✅ Detect the new migration (version 18)
- ✅ Run it in a transaction
- ✅ Record it as completed

### 4. Verify

```bash
npm run migrate:status
```

## Migration Best Practices

### ✅ DO:

1. **Use transactions** - Each migration should be atomic
2. **Test locally first** - Run migrations on development database
3. **Make migrations idempotent** - Use `IF NOT EXISTS`, `IF EXISTS`
4. **Include rollback comments** - Document how to undo changes
5. **Keep migrations small** - One logical change per migration
6. **Version sequentially** - Use next available number

Example with idempotency:

```sql
-- Create table idempotently
CREATE TABLE IF NOT EXISTS new_table (
  id SERIAL PRIMARY KEY
);

-- Add column idempotently
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='new_column'
  ) THEN
    ALTER TABLE users ADD COLUMN new_column VARCHAR(255);
  END IF;
END $$;
```

### ❌ DON'T:

1. **Don't modify existing migrations** - Create new ones instead
2. **Don't delete migration files** - They're part of history
3. **Don't use DROP without IF EXISTS** - Might fail on fresh DB
4. **Don't commit without testing** - Test locally first
5. **Don't skip version numbers** - Keep sequence intact

## Troubleshooting

### Migration Failed

If a migration fails:

```
❌ Migration 18 failed: error: relation "old_table" does not exist
```

**Steps:**

1. **Check the error** - Read the error message carefully
2. **Fix the SQL** - Update the migration file
3. **Remove failed record** (if any):
   ```sql
   DELETE FROM migrations WHERE version = 18;
   ```
4. **Run again**:
   ```bash
   npm run migrate
   ```

### Database Out of Sync

If migrations are out of sync with the database:

**Option 1: Manual Fix**

```sql
-- Add missing migration record
INSERT INTO migrations (version, name) 
VALUES (14, 'fix_related_entity_id_column');
```

**Option 2: Rebuild**

```bash
# Backup first!
npm run backup

# Drop and recreate
psql -d chandu -c "DROP DATABASE site_cash_flow;"
psql -d chandu -c "CREATE DATABASE site_cash_flow;"
psql -d chandu -f src/database/schema.sql

# Run all migrations
npm run migrate
```

### Migrations Not Running in Docker

Check logs:

```bash
docker-compose logs backend
```

Common issues:
- Database not ready yet (increase `start-period` in healthcheck)
- Missing environment variables (check `.env` file)
- Permission issues (check file ownership)

### Check Database Connection

```bash
# Test connection
PGPASSWORD=$DB_PASSWORD psql -h localhost -U postgres -d site_cash_flow -c '\dt'
```

## File Structure

```
backend/
├── src/
│   └── database/
│       ├── migrate.ts              # TypeScript migration runner
│       └── migrations/             # Migration SQL files
│           ├── 002_bank_transfers.sql
│           ├── 003_add_cheques.sql
│           ├── ...
│           └── 017_remove_viewer_role.sql
├── scripts/
│   └── migrate.js                  # JavaScript migration runner
├── docker-entrypoint.sh            # Docker startup with migrations
└── package.json                    # NPM scripts
```

## NPM Scripts Reference

| Script | Description | When to Use |
|--------|-------------|-------------|
| `npm run migrate` | Run pending migrations (TypeScript) | Development |
| `npm run migrate:js` | Run pending migrations (JavaScript) | Initial setup, no build |
| `npm run migrate:prod` | Run migrations (compiled) | Production after build |
| `npm run migrate:status` | Show migration status | Check which are pending |

## Environment Variables

Required for migrations:

```env
# Database connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=site_cash_flow
DB_USER=postgres
DB_PASSWORD=your_secure_password  # REQUIRED - no default
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Database Migrations
  run: |
    npm install
    npm run migrate
  env:
    DB_HOST: localhost
    DB_PORT: 5432
    DB_NAME: site_cash_flow
    DB_USER: postgres
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
```

### Docker Compose

Migrations run automatically on container start:

```yaml
services:
  backend:
    build: ./backend
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - DB_PASSWORD=${DB_PASSWORD}
```

## Rollback Strategy

The system doesn't support automatic rollback. For manual rollback:

### 1. Create Rollback Migration

```sql
-- 019_rollback_project_table.sql
DROP TABLE IF EXISTS projects;
```

### 2. Or Manual SQL

```sql
-- Connect to database
psql -d site_cash_flow

-- Undo changes
DROP TABLE projects;

-- Remove migration record
DELETE FROM migrations WHERE version = 18;
```

### 3. Document Rollback

Add rollback instructions as SQL comments:

```sql
-- Migration: Add project table
-- Rollback: DROP TABLE projects; DELETE FROM migrations WHERE version = 18;

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);
```

## Advanced Usage

### Run Specific Migration

Use the old individual scripts:

```bash
node run-migration-014.js
```

### Skip Failed Migration

If you need to skip a failed migration (use with caution):

```sql
-- Mark as completed without running
INSERT INTO migrations (version, name) 
VALUES (18, 'problematic_migration');
```

### Reset All Migrations

⚠️ **WARNING: This will drop all data!**

```bash
# Backup first
npm run backup

# Reset
psql -d site_cash_flow << EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
EOF

# Run base schema
psql -d site_cash_flow -f src/database/schema.sql

# Run all migrations
npm run migrate
```

## Support

For issues with migrations:

1. Check [troubleshooting section](#troubleshooting) above
2. Review migration logs
3. Check database state: `\dt` and `SELECT * FROM migrations;`
4. Verify environment variables are set correctly
5. Test connection manually with `psql`

---

**Last Updated:** February 2026  
**System Version:** 1.0.0
