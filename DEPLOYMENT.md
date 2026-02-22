# 🚀 Production Deployment Guide

## Chandu Construction - Site Cash Flow Management System

This guide covers everything you need to deploy the Chandu Construction backend to production.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Deployment](#docker-deployment)
4. [Manual Deployment](#manual-deployment)
5. [Database Setup](#database-setup)
6. [Security Configuration](#security-configuration)
7. [Monitoring & Logging](#monitoring--logging)
8. [Backup & Recovery](#backup--recovery)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- Node.js 20.x LTS or higher
- PostgreSQL 16.x or higher
- Docker & Docker Compose (for containerized deployment)
- Git

### Minimum System Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB (with room for logs and backups)
- **OS**: Ubuntu 20.04+, CentOS 8+, or similar Linux distribution

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd Chandu-Construction/backend
```

### 2. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your production values:

```bash
# Server Configuration
PORT=5000
NODE_ENV=production

# Database Configuration (REQUIRED)
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=chandu_construction
DB_USER=your-db-user
DB_PASSWORD=your-secure-password-here

# JWT Configuration (REQUIRED)
# Generate a strong secret: openssl rand -base64 32
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
JWT_EXPIRES_IN=7d

# CORS Configuration
# Comma-separated list of allowed origins
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# Sentry Error Monitoring (Optional but Recommended)
SENTRY_DSN=your-sentry-dsn-here
```

### 3. Generate Strong Secrets

Generate a secure JWT secret:

```bash
openssl rand -base64 32
```

Copy the output to your `JWT_SECRET` in `.env`

---

## Docker Deployment (Recommended)

### 1. Build and Start Services

```bash
# From the root directory
docker-compose up -d
```

This will start:
- PostgreSQL database
- Backend API server
- Automated backup service

### 2. Verify Deployment

Check that all services are running:

```bash
docker-compose ps
```

Check backend health:

```bash
curl http://localhost:5000/api/health
```

### 3. View Logs

```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Database only
docker-compose logs -f postgres
```

### 4. Stop Services

```bash
docker-compose down
```

To stop and remove all data:

```bash
docker-compose down -v
```

---

## Manual Deployment

### 1. Install Dependencies

```bash
cd backend
npm ci --only=production
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Set Up Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE chandu_construction;

# Run schema
psql -U postgres -d chandu_construction -f src/database/schema.sql

# Run migrations (in order)
psql -U postgres -d chandu_construction -f src/database/migrations/002_bank_transfers.sql
# ... run all migrations in order
```

### 4. Start the Server

```bash
# Using npm
npm start

# Or with PM2 (recommended for production)
npm install -g pm2
pm2 start dist/server.js --name chandu-backend
pm2 save
pm2 startup
```

### 5. Configure Nginx (Reverse Proxy)

Create Nginx configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/chandu-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Set Up SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

## Database Setup

### Initial Schema

The schema is automatically created in Docker deployments. For manual setup:

```bash
psql -U postgres -d chandu_construction -f src/database/schema.sql
```

### Running Migrations

Migrations must be run in order:

```bash
# List migrations
ls -1 src/database/migrations/

# Run each migration
for migration in src/database/migrations/*.sql; do
  echo "Running $migration"
  psql -U postgres -d chandu_construction -f "$migration"
done
```

### Creating Default Admin User

```bash
psql -U postgres -d chandu_construction << EOF
-- Password: Change this after first login
INSERT INTO users (email, password_hash, full_name, role)
VALUES (
  'admin@yourdomain.com',
  -- Password: Admin@123456 (CHANGE IMMEDIATELY)
  '\$2a\$10\$xyz...', -- Use bcrypt to hash your password
  'System Administrator',
  'boss'
);
EOF
```

---

## Security Configuration

### 1. Firewall Rules

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (if using Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow PostgreSQL only from localhost
sudo ufw allow from 127.0.0.1 to any port 5432

# Enable firewall
sudo ufw enable
```

### 2. PostgreSQL Security

Edit `/etc/postgresql/16/main/pg_hba.conf`:

```
# Only allow local connections
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### 3. Rate Limiting

Rate limiting is built into the application:
- **API endpoints**: 100 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes
- **Password changes**: 3 attempts per hour

### 4. Security Headers

Helmet.js is configured to set security headers automatically.

---

## Monitoring & Logging

### Application Logs

Logs are stored in the `logs/` directory:

- `combined.log`: All application logs
- `error.log`: Error logs only

```bash
# View recent logs
tail -f logs/combined.log

# View errors
tail -f logs/error.log
```

### Health Checks

The application provides health check endpoints:

```bash
# Full health check (includes database connectivity)
curl http://localhost:5000/api/health

# Readiness check (for load balancers)
curl http://localhost:5000/api/ready

# Liveness check
curl http://localhost:5000/api/live
```

### Sentry Error Monitoring

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new Node.js project
3. Copy the DSN to your `.env` file:
   ```
   SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
   ```

Sentry will automatically capture:
- Unhandled exceptions
- API errors (status >= 500)
- Performance metrics

### PM2 Monitoring (if using PM2)

```bash
# View process status
pm2 status

# View logs
pm2 logs chandu-backend

# Monitoring dashboard
pm2 monit
```

---

## Backup & Recovery

### Automated Backups (Docker)

Backups run automatically every 24 hours when using Docker Compose.

Backups are stored in `./backup/` with retention of 30 days.

### Manual Backup

```bash
# Run the backup script
./scripts/backup.sh

# Backup files are created in ./backup/
ls -lh backup/
```

### Restore from Backup

```bash
# Restore from latest backup
./scripts/restore.sh

# Restore from specific backup
./scripts/restore.sh backup/backup_20240101_120000.sql.gz
```

### Cloud Backup (Optional)

To upload backups to AWS S3, uncomment the S3 section in `scripts/backup.sh` and configure:

```bash
# Install AWS CLI
sudo apt install awscli

# Configure credentials
aws configure

# Set S3 bucket in environment
export AWS_S3_BUCKET=your-backup-bucket
```

---

## Troubleshooting

### Application Won't Start

1. **Check environment variables**:
   ```bash
   npm run build
   node dist/server.js
   # Look for validation errors
   ```

2. **Check database connectivity**:
   ```bash
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME
   ```

3. **View logs**:
   ```bash
   tail -f logs/error.log
   ```

### Database Connection Errors

1. **Verify PostgreSQL is running**:
   ```bash
   sudo systemctl status postgresql
   ```

2. **Check connection**:
   ```bash
   psql -h localhost -U postgres -d chandu_construction
   ```

3. **Check pg_hba.conf** for connection permissions

### High Memory Usage

1. **Check Node.js memory**:
   ```bash
   pm2 show chandu-backend
   ```

2. **Restart application**:
   ```bash
   pm2 restart chandu-backend
   ```

3. **Increase memory limit** (if needed):
   ```bash
   pm2 delete chandu-backend
   pm2 start dist/server.js --name chandu-backend --max-memory-restart 1G
   ```

### Slow Queries

Check logs for slow query warnings (>1 second):

```bash
grep "Slow query" logs/combined.log
```

### Rate Limit Issues

If legitimate users are being rate limited, adjust limits in `src/middleware/rateLimiter.ts`

---

## Production Checklist

Before going live, ensure:

- [ ] All environment variables are configured
- [ ] JWT_SECRET is strong and unique (32+ characters)
- [ ] Database password is strong
- [ ] HTTPS/SSL is configured
- [ ] Firewall rules are in place
- [ ] Backups are running automatically
- [ ] Sentry error monitoring is configured
- [ ] Health checks are responding
- [ ] Logs are being written correctly
- [ ] Default admin password has been changed
- [ ] CORS origins are set to production domains only
- [ ] Database is backed up before first deployment
- [ ] All migrations have been applied

---

## Support

For issues or questions:
- Check logs: `logs/error.log` and `logs/combined.log`
- Review health endpoint: `/api/health`
- Check Sentry for errors (if configured)

---

## Version

**Current Version**: 1.0.0
**Last Updated**: February 2026
