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
      const { name, bank_name, account_number, balance, currency } = req.body;

      const result = await query(
        `INSERT INTO bank_accounts (name, bank_name, account_number, balance, currency)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, bank_name, account_number || null, balance || 0, currency || 'LKR']
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating bank account:', error);
      res.status(500).json({ error: 'Failed to create bank account' });
    }
  }
);

// Update bank account
router.put('/:id',
  authenticate,
  authorize('boss'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, bank_name, account_number, balance, currency, active } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (bank_name !== undefined) {
        updates.push(`bank_name = $${paramIndex++}`);
        values.push(bank_name);
      }
      if (account_number !== undefined) {
        updates.push(`account_number = $${paramIndex++}`);
        values.push(account_number || null);
      }
      if (balance !== undefined) {
        updates.push(`balance = $${paramIndex++}`);
        values.push(balance);
      }
      if (currency !== undefined) {
        updates.push(`currency = $${paramIndex++}`);
        values.push(currency);
      }
      if (active !== undefined) {
        updates.push(`active = $${paramIndex++}`);
        values.push(active);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      const result = await query(
        `UPDATE bank_accounts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Bank account not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating bank account:', error);
      res.status(500).json({ error: 'Failed to update bank account' });
    }
  }
);

// Transfer between accounts
router.post('/transfer',
  authenticate,
  authorize('boss'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { from_account_id, to_account_id, amount, description } = req.body;

      if (!from_account_id || !to_account_id || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (from_account_id === to_account_id) {
        return res.status(400).json({ error: 'Cannot transfer to the same account' });
      }

      if (amount <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0' });
      }

      // Start transaction
      await query('BEGIN');

      try {
        // Check from account balance
        const fromAccount = await query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [from_account_id]
        );

        if (fromAccount.rows.length === 0) {
          throw new Error('Source account not found');
        }

        if (parseFloat(fromAccount.rows[0].balance) < amount) {
          throw new Error('Insufficient balance in source account');
        }

        // Deduct from source account
        await query(
          'UPDATE bank_accounts SET balance = balance - $1 WHERE id = $2',
          [amount, from_account_id]
        );

        // Add to destination account
        await query(
          'UPDATE bank_accounts SET balance = balance + $1 WHERE id = $2',
          [amount, to_account_id]
        );

        // Record transfer
        const transferResult = await query(
          `INSERT INTO bank_transfers 
           (from_account_id, to_account_id, amount, description, transfer_date)
           VALUES ($1, $2, $3, $4, NOW()) 
           RETURNING *`,
          [from_account_id, to_account_id, amount, description || null]
        );

        await query('COMMIT');

        res.json({
          message: 'Transfer completed successfully',
          transfer: transferResult.rows[0]
        });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error: any) {
      console.error('Error transferring funds:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to complete transfer' 
      });
    }
  }
);

// Get transfer history
router.get('/transfers',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await query(
        `SELECT 
          t.*,
          fa.name as from_account_name,
          fa.bank_name as from_bank_name,
          ta.name as to_account_name,
          ta.bank_name as to_bank_name
         FROM bank_transfers t
         LEFT JOIN bank_accounts fa ON t.from_account_id = fa.id
         LEFT JOIN bank_accounts ta ON t.to_account_id = ta.id
         ORDER BY t.transfer_date DESC`
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching transfers:', error);
      res.status(500).json({ error: 'Failed to fetch transfer history' });
    }
  }
);

export default router;
