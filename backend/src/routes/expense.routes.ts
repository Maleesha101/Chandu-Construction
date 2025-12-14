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
  body('amount').isNumeric().custom(value => value > 0),
  body('site_id').notEmpty().isUUID(),
  body('payment_method').optional().isString(),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
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
        entry_date
      } = req.body;

      const user = req.user!;

      const result = await query(
        `INSERT INTO expense_records 
         (to_name, purpose, amount, site_id, from_bank_account_id, md_id, 
          payment_method, reference, entry_date, entered_by_user_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
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
          user.userId
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating expense:', error);
      res.status(500).json({ error: 'Failed to create expense' });
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

      // Update status
      const result = await query(
        `UPDATE expense_records 
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );

      // Record approval
      if (comments) {
        await query(
          `INSERT INTO approvals (record_id, approver_id, approved, comments)
           VALUES ($1, $2, $3, $4)`,
          [id, user.userId, status.includes('approved'), comments]
        );
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating expense status:', error);
      res.status(500).json({ error: 'Failed to update expense status' });
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

      const result = await query(
        'DELETE FROM expense_records WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
      console.error('Error deleting expense:', error);
      res.status(500).json({ error: 'Failed to delete expense' });
    }
  }
);

export default router;
