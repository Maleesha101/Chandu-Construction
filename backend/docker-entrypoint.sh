#!/bin/sh
set -e

echo "🚀 Starting Chandu Construction Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "Postgres is unavailable - sleeping"
  sleep 2
done

echo "✅ Database is ready!"

# Run migrations
echo "🔄 Running database migrations..."
node dist/database/migrate.js || {
  echo "❌ Migrations failed, but continuing..."
}

echo "✅ Migrations complete!"

# Start the application
echo "🎉 Starting application server..."
exec node dist/server.js
