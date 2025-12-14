# Site Cash Flow - Backend Setup Guide

## Quick Start Guide

### 1. Install Backend Dependencies

```powershell
cd backend
npm install
```

### 2. Setup PostgreSQL Database

**Option A: Using existing PostgreSQL installation**

```powershell
# Create database
createdb site_cash_flow

# Or use psql
psql -U postgres
CREATE DATABASE site_cash_flow;
\q
```

**Option B: Using Docker**

```powershell
docker run --name site-cash-flow-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=site_cash_flow -p 5432:5432 -d postgres:15
```

### 3. Run Database Schema

```powershell
cd backend
psql -U postgres -d site_cash_flow -f src/database/schema.sql
```

### 4. Configure Environment

```powershell
cd backend
copy .env.example .env
```

Edit `.env` file with your database credentials.

### 5. Start Backend Server

```powershell
cd backend
npm run dev
```

The server will start at `http://localhost:5000`

### 6. Create First Admin User

Use an API client (Postman, Insomnia, or curl):

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123",
    "full_name": "Admin User",
    "role": "boss"
  }'
```

### 7. Update Frontend Configuration

The frontend is already configured to use the API client. Just ensure the backend is running!

## Testing the Backend

1. Check health endpoint:
```
GET http://localhost:5000/api/health
```

2. Login:
```
POST http://localhost:5000/api/auth/login
Body: { "email": "admin@example.com", "password": "SecurePassword123" }
```

3. Get expenses (use token from login):
```
GET http://localhost:5000/api/expenses
Authorization: Bearer <your-token>
```

## Frontend Integration

The frontend now uses `src/lib/apiClient.ts` instead of Supabase. All existing pages will work with the new backend automatically once it's running.

### Boss/Admin Can Add Expenses

The role-based access is enforced at:
1. **Backend API level** - Only boss/admin can POST to `/api/expenses`
2. **Frontend UI level** - Buttons show/hide based on user role
3. **Route protection** - Protected routes check user permissions

## Troubleshooting

### Port Already in Use
```powershell
# Change PORT in backend/.env
PORT=5001
```

### Database Connection Issues
- Verify PostgreSQL is running
- Check credentials in `.env`
- Ensure database exists

### CORS Issues
- Update `CORS_ORIGIN` in backend/.env to match your frontend URL

## API Documentation

See `backend/README.md` for complete API documentation including all endpoints and authentication details.
