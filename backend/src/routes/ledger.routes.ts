import { Router } from 'express';
import { query } from '../database/db';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get all ledger accounts with balances
router.get('/accounts', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT 
        la.*,
        ba.name as bank_account_name,
        ba.bank_name as bank_name,
        md.name as supervisor_name,
        (SELECT COUNT(*) FROM ledger_entries WHERE account_id = la.id) as transaction_count
      FROM ledger_accounts la
      LEFT JOIN bank_accounts ba ON la.reference_id = ba.id AND la.account_category = 'bank'
      LEFT JOIN managing_directors md ON la.reference_id = md.id AND la.account_category = 'supervisor'
      WHERE la.active = true
      ORDER BY 
        CASE la.account_type
          WHEN 'asset' THEN 1
          WHEN 'liability' THEN 2
          WHEN 'expense' THEN 3
          WHEN 'revenue' THEN 4
        END,
        la.account_name`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get ledger account details by ID
router.get('/accounts/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const accountResult = await query(
      `SELECT 
        la.*,
        ba.name as bank_account_name,
        ba.bank_name as bank_name,
        md.name as supervisor_name
      FROM ledger_accounts la
      LEFT JOIN bank_accounts ba ON la.reference_id = ba.id AND la.account_category = 'bank'
      LEFT JOIN managing_directors md ON la.reference_id = md.id AND la.account_category = 'supervisor'
      WHERE la.id = $1`,
      [id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ message: 'Ledger account not found' });
    }

    res.json(accountResult.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get ledger entries for a specific account
router.get('/accounts/:id/entries', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    let queryText = `
      SELECT 
        le.*,
        er.entry_date as expense_date,
        er.to_name as expense_to_name,
        er.purpose as expense_purpose,
        er.amount as expense_amount,
        s.name as site_name,
        u.full_name as created_by_name
      FROM ledger_entries le
      LEFT JOIN expense_records er ON le.expense_record_id = er.id
      LEFT JOIN sites s ON er.site_id = s.id
      LEFT JOIN users u ON le.created_by = u.id
      WHERE le.account_id = $1
    `;

    const params: any[] = [id];
    let paramIndex = 2;

    if (startDate) {
      queryText += ` AND le.transaction_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND le.transaction_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    queryText += ` ORDER BY le.transaction_date DESC, le.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await query(queryText, params);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get ledger summary by account type
router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT 
        account_type,
        account_category,
        COUNT(*) as account_count,
        SUM(balance) as total_balance,
        (SELECT COUNT(*) FROM ledger_entries le WHERE le.account_id = la.id) as total_transactions
      FROM ledger_accounts la
      WHERE active = true
      GROUP BY account_type, account_category
      ORDER BY account_type, account_category`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get trial balance (all accounts with debit/credit totals)
router.get('/trial-balance', authenticate, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let queryText = `
      SELECT 
        la.id,
        la.account_code,
        la.account_name,
        la.account_type,
        la.account_category,
        COALESCE(SUM(le.debit), 0) as total_debit,
        COALESCE(SUM(le.credit), 0) as total_credit,
        la.balance as current_balance
      FROM ledger_accounts la
      LEFT JOIN ledger_entries le ON la.id = le.account_id
      WHERE la.active = true
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      queryText += ` AND le.transaction_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND le.transaction_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    queryText += `
      GROUP BY la.id, la.account_code, la.account_name, la.account_type, la.account_category, la.balance
      ORDER BY 
        CASE la.account_type
          WHEN 'asset' THEN 1
          WHEN 'liability' THEN 2
          WHEN 'expense' THEN 3
          WHEN 'revenue' THEN 4
        END,
        la.account_name
    `;

    const result = await query(queryText, params);

    // Calculate totals
    const totals = result.rows.reduce(
      (acc, row) => {
        acc.totalDebit += parseFloat(row.total_debit);
        acc.totalCredit += parseFloat(row.total_credit);
        return acc;
      },
      { totalDebit: 0, totalCredit: 0 }
    );

    res.json({
      accounts: result.rows,
      totals,
      balanced: Math.abs(totals.totalDebit - totals.totalCredit) < 0.01,
    });
  } catch (error) {
    next(error);
  }
});

// Get expense breakdown by category
router.get('/expense-breakdown', authenticate, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let queryText = `
      SELECT 
        la.account_category,
        la.account_name,
        COUNT(DISTINCT le.expense_record_id) as expense_count,
        SUM(le.debit) as total_amount
      FROM ledger_entries le
      JOIN ledger_accounts la ON le.account_id = la.id
      WHERE la.account_type = 'expense'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      queryText += ` AND le.transaction_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND le.transaction_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    queryText += `
      GROUP BY la.account_category, la.account_name
      ORDER BY total_amount DESC
    `;

    const result = await query(queryText, params);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get user's cash account balance by user ID
router.get('/user-cash-balance/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // First get the user's full name
    const userResult = await query(
      'SELECT full_name FROM users WHERE id = $1 AND active = true',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const fullName = userResult.rows[0].full_name;
    
    // Get their cash account
    const accountResult = await query(
      `SELECT 
        la.id,
        la.account_code,
        la.account_name,
        la.balance,
        la.account_type,
        la.account_category,
        (SELECT COUNT(*) FROM ledger_entries WHERE account_id = la.id) as transaction_count
      FROM ledger_accounts la
      WHERE la.reference_id = $1 
        AND la.account_category = 'petty_cash'
        AND la.active = true
      LIMIT 1`,
      [userId]
    );

    if (accountResult.rows.length === 0) {
      // No account exists yet, return zero balance
      return res.json({
        balance: 0,
        account_exists: false,
        user_name: fullName
      });
    }

    res.json({
      ...accountResult.rows[0],
      account_exists: true,
      user_name: fullName
    });
  } catch (error) {
    next(error);
  }
});

export default router;
