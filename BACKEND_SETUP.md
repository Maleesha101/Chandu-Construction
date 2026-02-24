# Chandu Construction - Backend Setup Guide

## Quick Start Guide

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Setup PostgreSQL Database

**Option A: Using existing PostgreSQL installation**

```bash
# Create database
createdb chandu_construction

# Or use psql
psql -U postgres
CREATE DATABASE chandu_construction;
\q
```

**Option B: Using Docker**

```bash
docker run --name chandu-construction-db \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=chandu_construction \
  -p 5432:5432 -d postgres:16
```

### 3. Run Database Schema

```bash
cd backend
psql -U postgres -d chandu_construction -f src/database/schema.sql
```

This single file contains the complete database schema including:
- All tables (users, expenses, banks, ledger, etc.)
- All indexes for performance
- All functions and triggers (ledger system, auto-reference generation)
- All enum types
- Seed data for ledger accounts

### 4. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` file with your database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chandu_construction
DB_USER=postgres
DB_PASSWORD=your_secure_password

JWT_SECRET=generate_with_openssl_rand_base64_32
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### 5. Start Backend Server

**Development Mode:**
```bash
cd backend
npm run dev
```

**Production Mode:**
```bash
cd backend
npm run build
npm start
```

The server will start at `http://localhost:5000`

### 6. Create First Admin User

Use an API client (Postman, Insomnia, Thunder Client, or curl):

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "full_name": "Admin User",
    "role": "boss"
  }'
```

### 7. Test the Backend

1. **Health Check:**
   ```bash
   curl http://localhost:5000/api/health
   ```

2. **Login:**
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@example.com", "password": "SecurePassword123!"}'
   ```

3. **Get Expenses (use token from login):**
   ```bash
   curl http://localhost:5000/api/expenses \
     -H "Authorization: Bearer <your-token>"
   ```

## Frontend Integration

The frontend is configured to use the backend API. Once the backend is running:

1. Go to the root directory:
   ```bash
   cd ..  # From backend directory
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Start the frontend:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173`

## Role-Based Access Control

The system has 5 roles with different permissions:

- **boss**: Full system access, can manage everything
- **admin**: Can manage expenses, users, sites (except certain boss-only features)
- **qs**: QS approval workflow (wd_pending → wd_approved/wd_rejected)
- **md**: Managing Director/Supervisor - can view their assigned expenses
- **worker**: Limited access to view relevant information

Access is enforced at both:
1. **Backend API level** - Middleware checks user role
2. **Frontend UI level** - Components show/hide based on role

## Troubleshooting

### Port Already in Use
```bash
# Change PORT in backend/.env
PORT=5001
```

### Database Connection Issues
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check credentials in `.env`
- Ensure database exists: `psql -U postgres -l | grep chandu_construction`
- Test connection: `psql -U postgres -d chandu_construction -c "SELECT 1;"`

### CORS Issues
- Update `CORS_ORIGIN` in backend/.env to match your frontend URL
- For multiple origins, use comma-separated list: `http://localhost:5173,http://localhost:5174`

### Schema Errors
If you need to recreate the database:
```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS chandu_construction;"
psql -U postgres -c "CREATE DATABASE chandu_construction;"
psql -U postgres -d chandu_construction -f backend/src/database/schema.sql
```

## What's in the Schema?

The `schema.sql` file includes:

### Tables
- `users` - User accounts with roles
- `sites` - Construction sites
- `bank_accounts` - Bank account management
- `managing_directors` - Supervisors with float balances
- `expense_records` - All expense entries
- `approvals` - Approval history
- `cheques` - Cheque management
- `ledger_accounts` - Chart of accounts
- `ledger_entries` - Double-entry ledger
- `bank_transfers` - Inter-account transfers
- `funding_transactions` - Funding records
- `record_attachments` - File attachments

### Advanced Features
- **Double-entry ledger system** - Automatic ledger entries for approved expenses
- **Auto-generated references** - Expenses get unique references (EXP-YYYY-NNNN)
- **Triggers** - Automatic ledger creation, reference generation
- **Functions** - Complex business logic in SQL
- **Indexes** - Optimized for query performance

## API Documentation

For complete API documentation, see:
- [backend/endpoints.rest](backend/endpoints.rest) - Example requests
- [backend/README.md](backend/README.md) - API documentation

## Next Steps

- Read [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Check [SECURITY.md](SECURITY.md) for security best practices
- See [DATABASE_DOCUMENTATION.md](DATABASE_DOCUMENTATION.md) for schema details
- Review [LEDGER_SYSTEM.md](LEDGER_SYSTEM.md) for ledger system info

---

**Need Help?** Check the troubleshooting section above or create an issue in the repository.
