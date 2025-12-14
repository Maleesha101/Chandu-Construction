import { Router, Response } from 'express';
import { query } from '../database/db';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all bank accounts
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM bank_accounts WHERE active = true ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching banks:', error);
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

// Create bank account
router.post('/',
  authenticate,
  authorize('boss'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, bank_name, account_number, balance } = req.body;

      const result = await query(
        `INSERT INTO bank_accounts (name, bank_name, account_number, balance)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, bank_name, account_number || null, balance || 0]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating bank account:', error);
      res.status(500).json({ error: 'Failed to create bank account' });
    }
  }
);

export default router;
