#!/bin/bash

# Database Migration Runner Script
# Run this script to apply all pending migrations in order

set -e

# Configuration
MIGRATIONS_DIR="src/database/migrations"
LOG_FILE="logs/migrations.log"

# Create logs directory if it doesn't exist
mkdir -p logs

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Logging function
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} - $1" | tee -a "$LOG_FILE"
}

# Error handler
error_exit() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    error_exit "Migrations directory not found at $MIGRATIONS_DIR"
fi

# Check if database connection variables are set
if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    log "${YELLOW}Loading environment variables from .env${NC}"
    if [ -f ".env" ]; then
        set -a
        source .env
        set +a
    else
        error_exit ".env file not found and DB environment variables not set"
    fi
fi

log "${GREEN}Starting database migrations...${NC}"
log "Database: $DB_NAME on $DB_HOST:${DB_PORT:-5432}"

# Find all migration files and sort by name (which includes timestamp)
MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" -type f | sort)

if [ -z "$MIGRATION_FILES" ]; then
    log "${YELLOW}No migrations found${NC}"
    exit 0
fi

# Apply each migration
MIGRATION_COUNT=0
for migration_file in $MIGRATION_FILES; do
    FILENAME=$(basename "$migration_file")
    
    log "${YELLOW}Applying migration: $FILENAME${NC}"
    
    if psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -d "$DB_NAME" -U "$DB_USER" -f "$migration_file"; then
        log "${GREEN}✓ Successfully applied: $FILENAME${NC}"
        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
    else
        error_exit "Failed to apply migration: $FILENAME"
    fi
done

log "${GREEN}✓ All migrations completed successfully! ($MIGRATION_COUNT migrations applied)${NC}"
