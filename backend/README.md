# Site Cash Flow Backend

Custom backend API for the Site Cash Flow Management System.

## Features

- ✅ JWT-based authentication
- ✅ Role-based access control (Boss, Admin, QS, MD, Viewer)
- ✅ PostgreSQL database with proper indexing
- ✅ RESTful API endpoints
- ✅ Input validation and error handling
- ✅ Secure password hashing
- ✅ CORS enabled for frontend integration

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
createdb site_cash_flow
```

Run the schema:

```bash
psql -d site_cash_flow -f src/database/schema.sql
```

### 3. Environment Configuration

Copy the example environment file:

```bash
copy .env.example .env
```

Edit `.env` and configure your settings:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=site_cash_flow
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=change_this_to_a_random_secret_key
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
```

### 4. Start the Server

Development mode (with hot reload):
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Expenses

- `GET /api/expenses` - Get all expenses (with filters)
- `GET /api/expenses/:id` - Get expense by ID
- `POST /api/expenses` - Create expense (Boss/Admin only)
- `PATCH /api/expenses/:id/status` - Update expense status
- `DELETE /api/expenses/:id` - Delete expense (Boss only)

### Sites

- `GET /api/sites` - Get all sites
- `POST /api/sites` - Create site (Boss/Admin only)
- `PUT /api/sites/:id` - Update site (Boss/Admin only)

### Bank Accounts

- `GET /api/banks` - Get all bank accounts
- `POST /api/banks` - Create bank account (Boss only)

### Managing Directors

- `GET /api/managing-directors` - Get all MDs

### Users

- `GET /api/users` - Get all users (Boss/Admin only)
- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/:id/role` - Update user role (Boss only)

### Approvals

- `GET /api/approvals/record/:recordId` - Get approvals for a record

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Role-Based Access Control

- **Boss**: Full access to all endpoints
- **Admin**: Can create expenses, manage sites, view all data
- **QS**: Can view and update WD-pending expenses
- **MD**: Limited view access
- **Viewer**: Read-only access

## Database Schema

See `src/database/schema.sql` for the complete database structure including:
- Users with roles
- Expense records with approval workflow
- Sites, bank accounts, managing directors
- Approval history and ledger entries

## Error Handling

All errors return JSON with the following format:

```json
{
  "error": "Error message",
  "stack": "Stack trace (development only)"
}
```

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based authorization middleware
- Input validation with express-validator
- SQL injection prevention with parameterized queries
- Helmet.js for HTTP headers security
- CORS configuration
