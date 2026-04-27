import express from 'express';
import request from 'supertest';
import expenseRoutes from '../../src/routes/expense.routes';

jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'boss-user', role: 'boss' };
    next();
  },
  authorize: () => (_req: any, _res: any, next: any) => next(),
}));

const app = express();
app.use(express.json());
app.use('/api/expenses', expenseRoutes);

describe('DELETE /api/expenses/:id', () => {
  const { query } = require('../../src/database/db');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('restores ledger balances when deleting an expense that already posted ledger entries', async () => {
    const expenseId = 'expense-1';
    const pettyCashAccountId = 'petty-cash-account';
    const expenseAccountId = 'expense-account';

    query.mockImplementation(async (sql: string, params?: any[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [] };
      }

      if (sql.includes('SELECT id, amount, from_bank_account_id, payment_method')) {
        return {
          rows: [
            {
              id: expenseId,
              amount: '250.00',
              from_bank_account_id: null,
              payment_method: 'petty_cash',
            },
          ],
        };
      }

      if (sql.includes('SELECT DISTINCT account_id')) {
        return {
          rows: [
            { account_id: expenseAccountId },
            { account_id: pettyCashAccountId },
          ],
        };
      }

      if (sql.startsWith('DELETE FROM expense_records')) {
        return { rows: [{ id: expenseId }] };
      }

      if (sql.includes('UPDATE ledger_accounts la')) {
        expect(params).toEqual([[expenseAccountId, pettyCashAccountId]]);
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const response = await request(app).delete(`/api/expenses/${expenseId}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Expense deleted successfully');
    expect(query).toHaveBeenCalledWith('BEGIN');
    expect(query).toHaveBeenCalledWith('COMMIT');
  });
});