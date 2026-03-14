#!/bin/bash

# Database Restore Script for Chandu Construction System
# This script restores a PostgreSQL database from a backup file

set -e

# Load .env file from backend directory if present and vars not already set
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

# Database connection (from env vars or defaults)
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-site_cash_flow}"
DB_USER="${DB_USER:-postgres}"

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/home/maleesha/Projects/Web/Chandu-Construction/backup}"
BACKUP_FILE="${1:-$BACKUP_DIR/latest.sql.gz}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  echo "Usage: $0 [backup_file.sql.gz]"
  echo "Example: $0 ./backup/backup_20240101_120000.sql.gz"
  exit 1
fi

echo "============================================"
echo "Database Restore"
echo "============================================"
echo "Backup file: $BACKUP_FILE"
echo ""

read -p "⚠️  This will DROP and RECREATE the database. Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo ""
echo "Starting restore process..."

# Restore the backup
echo "Restoring database from backup..."
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \

if [ $? -eq 0 ]; then
  echo "✅ Database restored successfully!"
else
  echo "❌ Restore failed!"
  exit 1
fi

echo "============================================"
echo "Restore process completed"
echo "============================================"
