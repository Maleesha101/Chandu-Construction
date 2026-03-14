#!/bin/bash

# Database Backup Script for Chandu Construction System
# This script creates a backup of the PostgreSQL database with timestamp

set -e

# Load .env file from backend directory if present and vars not already set
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/home/maleesha/Projects/Web/Chandu-Construction/backup}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

# Database connection (from env vars or defaults from .env.example)
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-site_cash_flow}"
DB_USER="${DB_USER:-postgres}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "============================================"
echo "Starting database backup: $TIMESTAMP"
echo "============================================"

# Create backup
echo "Creating backup..."
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --verbose --clean --if-exists --no-owner --no-acl \
  | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup completed successfully: $BACKUP_FILE ($BACKUP_SIZE)"
else
  echo "❌ Backup failed!"
  exit 1
fi

# Clean up old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING_BACKUPS=$(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)
echo "✅ Cleanup completed. Remaining backups: $REMAINING_BACKUPS"

# Create latest symlink
rm -f "$BACKUP_DIR/latest.sql.gz"
ln -s "$BACKUP_FILE" "$BACKUP_DIR/latest.sql.gz"
echo "✅ Latest backup symlink created"

echo "============================================"
echo "Backup process completed: $TIMESTAMP"
echo "============================================"

# Optional: Upload to S3 (uncomment if needed)
# if [ -n "$AWS_S3_BUCKET" ]; then
#   echo "Uploading to S3..."
#   aws s3 cp "$BACKUP_FILE" "s3://$AWS_S3_BUCKET/backups/"
#   echo "✅ Uploaded to S3"
# fi
