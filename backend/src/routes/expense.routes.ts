import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/db';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all expenses (with filters)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, site_id, start_date, end_date } = req.query;
    const user = req.user!;

    let queryText = `
      SELECT e.*, 
            u.full_name as entered_by_name,
            md.name as from_person_name,
            s.name as site_name,
            s.code as site_code,
            b.name as bank_name,
            md.name as md_name
      FROM expense_records e
      LEFT JOIN users u ON e.entered_by_user_id = u.id
      LEFT JOIN sites s ON e.site_id = s.id
      LEFT JOIN bank_accounts b ON e.from_bank_account_id = b.id
      LEFT JOIN managing_directors md ON e.md_id = md.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Role-based filtering
    if (user.role !== 'boss' && user.role !== 'admin' && user.role !== 'qs') {
      queryText += ` AND e.entered_by_user_id = $${paramIndex}`;
      params.push(user.userId);
      paramIndex++;
    }

    if (status) {
      queryText += ` AND e.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (site_id) {
      queryText += ` AND e.site_id = $${paramIndex}`;
      params.push(site_id);
      paramIndex++;
    }

    if (start_date) {
      queryText += ` AND e.entry_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND e.entry_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    queryText += ' ORDER BY e.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Get expense by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    let queryText = `
      SELECT e.*, 
            u.full_name as entered_by_name,
            md.name as from_person_name,
            s.name as site_name,
            b.name as bank_name,
            md.name as md_name
      FROM expense_records e
      LEFT JOIN users u ON e.entered_by_user_id = u.id
      LEFT JOIN sites s ON e.site_id = s.id
      LEFT JOIN bank_accounts b ON e.from_bank_account_id = b.id
      LEFT JOIN managing_directors md ON e.md_id = md.id
      WHERE e.id = $1
    `;

    // Role-based access control
    if (user.role !== 'boss' && user.role !== 'admin' && user.role !== 'qs') {
      queryText += ' AND e.entered_by_user_id = $2';
      const result = await query(queryText, [id, user.userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      return res.json(result.rows[0]);
    }

    const result = await query(queryText, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// Create expense (only boss and admin)
router.post('/',
  authenticate,
  authorize('boss', 'admin'),
  body('to_name').notEmpty().isLength({ max: 200 }),
  body('purpose').notEmpty().isLength({ max: 500 }),
  body('amount').custom((value) => {
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      throw new Error('Amount must be a positive number');
    }
    return true;
  }),
  body('site_id').optional({ values: 'falsy' }).isUUID(),
  body('from_bank_account_id').optional({ values: 'falsy' }).isUUID(),
  body('md_id').optional({ values: 'falsy' }).isUUID(),
  body('payment_method').optional().isString(),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        to_name,
        purpose,
        amount,
        site_id,
        from_bank_account_id,
        md_id,
        payment_method,
        reference,
        entry_date,
        from_person_name
      } = req.body;
      
      // Normalize empty strings to null for optional UUID fields
      const normalizedSiteId = site_id && site_id.trim() !== '' ? site_id : null;
      const normalizedBankId = from_bank_account_id && from_bank_account_id.trim() !== '' ? from_bank_account_id : null;
      const normalizedMdId = md_id && md_id.trim() !== '' ? md_id : null;
      
      console.log('Creating expense with data:', {
        to_name,
        purpose,
        amount,
        site_id: normalizedSiteId,
        from_bank_account_id: normalizedBankId,
        md_id: normalizedMdId,
        payment_method,
        reference,
        entry_date,
        from_person_name
      });
      
      // Additional validation: Site is required for petty cash payments
      if ((payment_method === 'cash' || payment_method === 'petty_cash') && !normalizedSiteId) {
        return res.status(400).json({ 
          errors: [{ 
            msg: 'Site is required for petty cash payments', 
            param: 'site_id' 
          }] 
        });
      }

      const user = req.user!;

      // Start transaction
      await query('BEGIN');

      try {
        // If payment is from bank account, check balance and deduct
        if (normalizedBankId && (payment_method === 'bank_account' || payment_method === 'bank' || payment_method === 'bank_transfer')) {
          const bankResult = await query(
            'SELECT balance FROM bank_accounts WHERE id = $1',
            [normalizedBankId]
          );

          if (bankResult.rows.length === 0) {
            throw new Error('Bank account not found');
          }

          const currentBalance = parseFloat(bankResult.rows[0].balance);
          if (currentBalance < amount) {
            throw new Error('Insufficient bank balance');
          }

          // Deduct from bank account
          await query(
            'UPDATE bank_accounts SET balance = balance - $1 WHERE id = $2',
            [amount, normalizedBankId]
          );
        }

        // Create expense record
        const result = await query(
          `INSERT INTO expense_records 
          (to_name, purpose, amount, site_id, from_bank_account_id, md_id, 
            payment_method, reference, entry_date, entered_by_user_id, qs_notes, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
           RETURNING *`,
          [
            to_name,
            purpose,
            amount,
            normalizedSiteId,
            normalizedBankId,
            normalizedMdId,
            payment_method || 'cash',
            reference || null,
            entry_date || new Date(),
            user.userId,
            from_person_name || null
          ]
        );

        await query('COMMIT');
        res.status(201).json(result.rows[0]);
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error: any) {
      console.error('Error creating expense:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        detail: error.detail
      });
      
      if (error.code === '23503') {
        return res.status(400).json({ error: 'Invalid reference: site_id, from_bank_account_id, or md_id does not exist' });
      }
      
      res.status(500).json({ 
        error: 'Failed to create expense',
        details: error.message 
      });
    }
  }
);

// Update expense status (role-based)
router.patch('/:id/status',
  authenticate,
  body('status').isIn(['pending', 'approved', 'rejected', 'wd_pending', 'wd_approved', 'wd_rejected']),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { status, comments } = req.body;
      const user = req.user!;

      // Get current expense
      const expenseResult = await query(
        'SELECT * FROM expense_records WHERE id = $1',
        [id]
      );

      if (expenseResult.rows.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      const expense = expenseResult.rows[0];

      // Role-based authorization logic
      if (user.role === 'boss') {
        // Boss can do anything
      } else if (user.role === 'admin' && expense.status === 'pending') {
        // Admin can update pending records
      } else if (user.role === 'qs' && expense.status === 'wd_pending') {
        // QS can update wd_pending records
      } else {
        return res.status(403).json({ error: 'Not authorized to update this expense' });
      }

      // Start transaction for status update
      await query('BEGIN');

      try {
        // If expense is being rejected and was paid from bank, refund the amount
        if ((status === 'rejected' || status === 'wd_rejected') && 
            expense.from_bank_account_id && 
            (expense.payment_method === 'bank_account' || expense.payment_method === 'bank' || expense.payment_method === 'bank_transfer') &&
            (expense.status === 'pending' || expense.status === 'wd_pending')) {
          await query(
            'UPDATE bank_accounts SET balance = balance + $1 WHERE id = $2',
            [expense.amount, expense.from_bank_account_id]
          );
        }

        // Update status and save comments appropriately
        // For wd_pending: save to wd_reason field
        // For wd_approved/wd_rejected: save to qs_notes field
        let updateQuery = `UPDATE expense_records SET status = $1, updated_at = NOW()`;
        const params = [status, id];
        
        if (status === 'wd_pending' && comments) {
          updateQuery += `, wd_reason = $2`;
          params.splice(1, 0, comments);
        } else if ((status === 'wd_approved' || status === 'wd_rejected') && comments) {
          updateQuery += `, qs_notes = $2`;
          params.splice(1, 0, comments);
        }
        
        updateQuery += ` WHERE id = $${params.length} RETURNING *`;

        const result = await query(updateQuery, params);

        // Record approval
        if (comments) {
          await query(
            `INSERT INTO approvals (record_id, approver_id, approved, comments)
              VALUES ($1, $2, $3, $4)`,
            [id, user.userId, status.includes('approved'), comments]
          );
        }

        await query('COMMIT');
        res.json(result.rows[0]);
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error updating expense status:', error);
      res.status(500).json({ error: 'Failed to update expense status' });
    }
  }
);

// Update expense (only boss)
router.put('/:id',
  authenticate,
  authorize('boss'),
  body('to_name').notEmpty().isLength({ max: 200 }),
  body('purpose').notEmpty().isLength({ max: 500 }),
  body('amount').custom((value) => {
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      throw new Error('Amount must be a positive number');
    }
    return true;
  }),
  body('site_id').optional().isUUID(),
  body('payment_method').optional().isString(),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const {
        to_name,
        purpose,
        amount,
        site_id,
        from_bank_account_id,
        md_id,
        payment_method,
        reference,
        entry_date,
        from_person_name
      } = req.body;

      // Check if expense exists
      const checkResult = await query(
        'SELECT * FROM expense_records WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      // Update expense record
      const result = await query(
        `UPDATE expense_records 
        SET to_name = $1, purpose = $2, amount = $3, site_id = $4,
            from_bank_account_id = $5, md_id = $6, payment_method = $7,
            reference = $8, entry_date = $9, qs_notes = $10, updated_at = NOW()
        WHERE id = $11
        RETURNING *`,
        [
          to_name,
          purpose,
          amount,
          site_id,
          from_bank_account_id || null,
          md_id || null,
          payment_method || 'cash',
          reference || null,
          entry_date || new Date(),
          from_person_name || null,
          id
        ]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating expense:', error);
      res.status(500).json({ error: 'Failed to update expense' });
    }
  }
);

// Delete expense (only boss)
router.delete('/:id',
  authenticate,
  authorize('boss'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      await query('BEGIN');

      try {
        const expenseResult = await query(
          `SELECT id, amount, from_bank_account_id, payment_method
           FROM expense_records
           WHERE id = $1
           FOR UPDATE`,
          [id]
        );

        if (expenseResult.rows.length === 0) {
          await query('ROLLBACK');
          return res.status(404).json({ error: 'Expense not found' });
        }

        const expense = expenseResult.rows[0];
        const expenseAmount = Number(expense.amount);

        const accountResult = await query(
          `SELECT DISTINCT account_id
           FROM ledger_entries
           WHERE expense_record_id = $1`,
          [id]
        );

        if (
          expense.from_bank_account_id &&
          ['bank_account', 'bank', 'bank_transfer'].includes(expense.payment_method)
        ) {
          await query(
            'UPDATE bank_accounts SET balance = balance + $1 WHERE id = $2',
            [expenseAmount, expense.from_bank_account_id]
          );
        }

        const result = await query(
          'DELETE FROM expense_records WHERE id = $1 RETURNING id',
          [id]
        );

        if (accountResult.rows.length > 0) {
          await query(
            `UPDATE ledger_accounts la
             SET balance = COALESCE((
               SELECT SUM(COALESCE(le.debit, 0) - COALESCE(le.credit, 0))
               FROM ledger_entries le
               WHERE le.account_id = la.id
             ), 0),
                 updated_at = NOW()
             WHERE la.id = ANY($1::uuid[])`,
            [accountResult.rows.map((row) => row.account_id)]
          );
        }

        await query('COMMIT');

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Expense not found' });
        }

        res.json({ message: 'Expense deleted successfully' });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      res.status(500).json({ error: 'Failed to delete expense' });
    }
  }
);

export default router;
