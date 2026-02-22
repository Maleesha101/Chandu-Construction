# Test Coverage

This directory contains the test suite for the Chandu Construction Backend API.

## Test Structure

```
tests/
├── unit/              # Unit tests for individual functions/modules
│   ├── env.test.ts
│   └── passwordValidation.test.ts
└── integration/       # Integration tests for API endpoints
    └── health.test.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Generate coverage report
npm test -- --coverage
```

## Coverage Goals

- **Branches**: 50%
- **Functions**: 50%
- **Lines**: 50%
- **Statements**: 50%

## Writing Tests

### Unit Tests
Unit tests should test individual functions in isolation, mocking external dependencies.

Example:
```typescript
import { validatePassword } from '../../src/utils/passwordValidation';

describe('Password Validation', () => {
  it('should accept a strong password', () => {
    const result = validatePassword('StrongPass123!');
    expect(result.valid).toBe(true);
  });
});
```

### Integration Tests
Integration tests should test API endpoints with all middleware and logic.

Example:
```typescript
import request from 'supertest';
import app from '../../src/server';

describe('GET /api/health', () => {
  it('should return healthy status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
  });
});
```

## TODO: Additional Test Coverage Needed

The following areas need test coverage:

1. **Authentication Tests**
   - User registration
   - User login
   - JWT token validation
   - Password hashing

2. **Authorization Tests**
   - Role-based access control
   - Permission checks

3. **Expense Routes Tests**
   - Create expense
   - Update expense
   - Delete expense
   - List expenses with filters

4. **Database Tests**
   - Connection handling
   - Query execution
   - Transaction management

5. **Middleware Tests**
   - Rate limiting
   - Error handling
   - Request validation

6. **Security Tests**
   - SQL injection prevention
   - XSS prevention
   - CSRF protection
