import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/db';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all sites with expense tracking
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { active } = req.query;
    
    let queryText = `
      SELECT 
        s.*,
        COALESCE(SUM(CASE 
          WHEN e.payment_method = 'cash' 
          AND e.status IN ('approved', 'wd_approved') 
          THEN e.amount 
          ELSE 0 
        END), 0) as petty_cash_expenses,
        COALESCE(SUM(CASE 
          WHEN e.status IN ('approved', 'wd_approved') 
          THEN e.amount 
          ELSE 0 
        END), 0) as total_expenses,
        COUNT(CASE 
          WHEN e.payment_method = 'cash' 
          AND e.status IN ('approved', 'wd_approved') 
          THEN 1 
        END) as petty_cash_count,
        COUNT(CASE 
          WHEN e.status IN ('approved', 'wd_approved') 
          THEN 1 
        END) as total_expense_count
      FROM sites s
      LEFT JOIN expense_records e ON s.id = e.site_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (active !== undefined) {
      queryText += ` AND s.active = $${paramIndex}`;
      params.push(active === 'true');
      paramIndex++;
    }
    
    queryText += ' GROUP BY s.id ORDER BY s.name';
    
    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// Create site (boss and admin only)
router.post('/',
  authenticate,
  authorize('boss', 'admin'),
  body('name').notEmpty(),
  body('code').optional(),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, location, code } = req.body;

      const result = await query(
        'INSERT INTO sites (name, location, code) VALUES ($1, $2, $3) RETURNING *',
        [name, location || null, code || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating site:', error);
      res.status(500).json({ error: 'Failed to create site' });
    }
  }
);

// Update site
router.put('/:id',
  authenticate,
  authorize('boss', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, location, code, active } = req.body;

      const result = await query(
        `UPDATE sites SET name = $1, location = $2, code = $3, active = $4
         WHERE id = $5 RETURNING *`,
        [name, location, code, active, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Site not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating site:', error);
      res.status(500).json({ error: 'Failed to update site' });
    }
  }
);

export default router;
