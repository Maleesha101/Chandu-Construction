# Database Migrations

This directory contains all database migrations for the Site Cash Flow application.

## Migration Files

Migrations are named with a timestamp prefix in the format: `YYYYMMDD_migration_name.sql`

- `20260414_add_user_role.sql` - Adds 'user' role to the app_role enum

## How to Apply Migrations

### Option 1: Using psql directly

```bash
# Connect to your database and run the migration
psql -d site_cash_flow -f src/database/migrations/20260414_add_user_role.sql
```

### Option 2: Using the backup/restore scripts

```bash
# Run the migration
./scripts/backup.sh  # Backup before migration
psql -d site_cash_flow -f src/database/migrations/20260414_add_user_role.sql
```

### Option 3: Run all pending migrations

```bash
# List all migration files
ls src/database/migrations/*.sql

# Run each migration in order
for migration in src/database/migrations/*.sql; do
  echo "Running migration: $migration"
  psql -d site_cash_flow -f "$migration"
done
```

## Important Notes

- **Always backup your database before running migrations**
- Migrations should be run in chronological order (oldest first)
- Each migration should be idempotent when possible (safe to run multiple times)
- Test migrations in development before running on production

## Rollback Instructions

For the 'user' role addition, rollback is manual due to PostgreSQL enum limitations:

```sql
-- Step 1: Create new enum without 'user' value
ALTER TYPE app_role RENAME TO app_role_old;
CREATE TYPE app_role AS ENUM ('boss', 'admin', 'qs', 'md', 'worker');

-- Step 2: Update any affected columns
-- (Only needed if 'user' role was actually assigned to users)
-- UPDATE users SET role = 'md' WHERE role = 'user';

-- Step 3: Update role columns to use new enum
ALTER TABLE users ALTER COLUMN role TYPE app_role USING role::text::app_role;

-- Step 4: Drop old enum
DROP TYPE app_role_old;
```

## Environment Setup

Before running migrations, ensure your database environment is configured:

```bash
# Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=site_cash_flow
export DB_USER=postgres
export DB_PASSWORD=your_password
```

Or use `.env` file:

```bash
# Load from .env
set -a
source .env
set +a
```
