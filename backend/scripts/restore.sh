#!/bin/bash

# Database Restore Script for Chandu Construction System
# This script restores a PostgreSQL database from a backup file

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backup}"
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
gunzip -c "$BACKUP_FILE" | psql

if [ $? -eq 0 ]; then
  echo "✅ Database restored successfully!"
else
  echo "❌ Restore failed!"
  exit 1
fi

echo "============================================"
echo "Restore process completed"
echo "============================================"
