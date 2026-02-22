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

      // Start transaction to ensure both bank account and ledger account are created
      await query('BEGIN');

      try {
        // Create bank account
        const result = await query(
          `INSERT INTO bank_accounts (name, bank_name, account_number, balance, currency)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [name, bank_name, account_number || null, balance || 0, currency || 'LKR']
        );

        const bankAccount = result.rows[0];

        // Create corresponding ledger account
        const accountCode = 'BANK-' + name.toUpperCase().replace(/\s+/g, '-');
        const accountName = `${name} - ${bank_name}`;

        await query(
          `SELECT get_or_create_ledger_account($1, $2, $3, $4, $5)`,
          [accountCode, accountName, 'asset', 'bank', bankAccount.id]
        );

        // If initial balance > 0, create a ledger entry for it
        if (balance && parseFloat(balance) > 0) {
          await query(
            `SELECT create_bank_deposit_ledger_entry($1, $2, $3, $4, $5, $6)`,
            [
              bankAccount.id,
              balance,
              `Initial balance for ${name}`,
              `INIT-${bankAccount.id.substring(0, 8)}`,
              new Date(),
              req.user?.userId
            ]
          );
        }

        await query('COMMIT');

        res.status(201).json(bankAccount);
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
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

      // Start transaction
      await query('BEGIN');

      try {
        values.push(id);
        const result = await query(
          `UPDATE bank_accounts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
          values
        );

        if (result.rows.length === 0) {
          await query('ROLLBACK');
          return res.status(404).json({ error: 'Bank account not found' });
        }

        const bankAccount = result.rows[0];

        // Update corresponding ledger account if name or bank_name changed
        if (name !== undefined || bank_name !== undefined) {
          const accountCode = 'BANK-' + bankAccount.name.toUpperCase().replace(/\s+/g, '-');
          const accountName = `${bankAccount.name} - ${bankAccount.bank_name}`;

          await query(
            `UPDATE ledger_accounts 
             SET account_code = $1, account_name = $2, active = $3
             WHERE reference_id = $4 AND account_category = 'bank'`,
            [accountCode, accountName, bankAccount.active, id]
          );
        } else if (active !== undefined) {
          // Just update active status
          await query(
            `UPDATE ledger_accounts 
             SET active = $1
             WHERE reference_id = $2 AND account_category = 'bank'`,
            [active, id]
          );
        }

        await query('COMMIT');

        res.json(bankAccount);
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
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
          'SELECT name, bank_name, balance FROM bank_accounts WHERE id = $1',
          [from_account_id]
        );

        if (fromAccount.rows.length === 0) {
          throw new Error('Source account not found');
        }

        if (parseFloat(fromAccount.rows[0].balance) < amount) {
          throw new Error('Insufficient balance in source account');
        }

        // Get destination account details
        const toAccount = await query(
          'SELECT name, bank_name FROM bank_accounts WHERE id = $1',
          [to_account_id]
        );

        if (toAccount.rows.length === 0) {
          throw new Error('Destination account not found');
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

        const transfer = transferResult.rows[0];
        const transferDesc = description || `Transfer to ${toAccount.rows[0].name}`;
        const referenceNumber = `TRF-${transfer.id.substring(0, 8)}`;

        // Get or create ledger accounts for both bank accounts
        const fromAccountCode = 'BANK-' + fromAccount.rows[0].name.toUpperCase().replace(/\s+/g, '-');
        const fromAccountName = `${fromAccount.rows[0].name} - ${fromAccount.rows[0].bank_name}`;
        
        const toAccountCode = 'BANK-' + toAccount.rows[0].name.toUpperCase().replace(/\s+/g, '-');
        const toAccountName = `${toAccount.rows[0].name} - ${toAccount.rows[0].bank_name}`;

        // Get ledger account IDs
        const fromLedgerResult = await query(
          `SELECT get_or_create_ledger_account($1, $2, $3, $4, $5) as account_id`,
          [fromAccountCode, fromAccountName, 'asset', 'bank', from_account_id]
        );
        const fromLedgerAccountId = fromLedgerResult.rows[0].account_id;

        const toLedgerResult = await query(
          `SELECT get_or_create_ledger_account($1, $2, $3, $4, $5) as account_id`,
          [toAccountCode, toAccountName, 'asset', 'bank', to_account_id]
        );
        const toLedgerAccountId = toLedgerResult.rows[0].account_id;

        // Get current balances from ledger
        const fromBalanceResult = await query(
          'SELECT COALESCE(balance, 0) as balance FROM ledger_accounts WHERE id = $1',
          [fromLedgerAccountId]
        );
        const fromNewBalance = parseFloat(fromBalanceResult.rows[0].balance) - amount;

        const toBalanceResult = await query(
          'SELECT COALESCE(balance, 0) as balance FROM ledger_accounts WHERE id = $1',
          [toLedgerAccountId]
        );
        const toNewBalance = parseFloat(toBalanceResult.rows[0].balance) + amount;

        // Create CREDIT entry for source account (money going out)
        await query(
          `INSERT INTO ledger_entries 
           (account_id, transaction_date, debit, credit, description, reference_number, created_by, balance_after)
           VALUES ($1, $2, 0, $3, $4, $5, $6, $7)`,
          [
            fromLedgerAccountId,
            transfer.transfer_date,
            amount,
            `Transfer to ${toAccount.rows[0].name} - ${transferDesc}`,
            referenceNumber,
            req.user?.userId,
            fromNewBalance
          ]
        );

        // Update source ledger account balance
        await query(
          'UPDATE ledger_accounts SET balance = balance - $1 WHERE id = $2',
          [amount, fromLedgerAccountId]
        );

        // Create DEBIT entry for destination account (money coming in)
        await query(
          `INSERT INTO ledger_entries 
           (account_id, transaction_date, debit, credit, description, reference_number, created_by, balance_after)
           VALUES ($1, $2, $3, 0, $4, $5, $6, $7)`,
          [
            toLedgerAccountId,
            transfer.transfer_date,
            amount,
            `Transfer from ${fromAccount.rows[0].name} - ${transferDesc}`,
            referenceNumber,
            req.user?.userId,
            toNewBalance
          ]
        );

        // Update destination ledger account balance
        await query(
          'UPDATE ledger_accounts SET balance = balance + $1 WHERE id = $2',
          [amount, toLedgerAccountId]
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
      const { account_id } = req.query;
      
      let queryText = `SELECT 
          t.*,
          fa.name as from_account_name,
          fa.bank_name as from_bank_name,
          ta.name as to_account_name,
          ta.bank_name as to_bank_name,
          c.cheque_number,
          c.payee_name
         FROM bank_transfers t
         LEFT JOIN bank_accounts fa ON t.from_account_id = fa.id
         LEFT JOIN bank_accounts ta ON t.to_account_id = ta.id
         LEFT JOIN cheques c ON t.cheque_id = c.id`;
      
      const params: any[] = [];
      if (account_id) {
        queryText += ` WHERE t.from_account_id = $1 OR t.to_account_id = $1`;
        params.push(account_id);
      }
      
      queryText += ` ORDER BY t.transfer_date DESC`;
      
      const result = await query(queryText, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching transfers:', error);
      res.status(500).json({ error: 'Failed to fetch transfer history' });
    }
  }
);

// Get account transactions (credits and debits)
router.get('/:id/transactions',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await query(
        `SELECT 
          t.*,
          fa.name as from_account_name,
          ta.name as to_account_name,
          c.cheque_number,
          c.payee_name,
          CASE 
            WHEN t.to_account_id = $1 THEN 'credit'
            WHEN t.from_account_id = $1 THEN 'debit'
          END as transaction_type
         FROM bank_transfers t
         LEFT JOIN bank_accounts fa ON t.from_account_id = fa.id
         LEFT JOIN bank_accounts ta ON t.to_account_id = ta.id
         LEFT JOIN cheques c ON t.cheque_id = c.id
         WHERE t.from_account_id = $1 OR t.to_account_id = $1
         ORDER BY t.transfer_date DESC`,
        [id]
      );
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching account transactions:', error);
      res.status(500).json({ error: 'Failed to fetch account transactions' });
    }
  }
);

// ============== CHEQUE MANAGEMENT ==============

// Get all cheques
router.get('/cheques',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { bank_account_id, status } = req.query;
      
      let queryText = `SELECT 
          c.*,
          ba.name as bank_account_name,
          ba.bank_name,
          da.name as deposited_to_account_name,
          u.full_name as created_by_name
         FROM cheques c
         LEFT JOIN bank_accounts ba ON c.bank_account_id = ba.id
         LEFT JOIN bank_accounts da ON c.deposited_to_account_id = da.id
         LEFT JOIN users u ON c.created_by = u.id
         WHERE 1=1`;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (bank_account_id) {
        queryText += ` AND c.bank_account_id = $${paramIndex++}`;
        params.push(bank_account_id);
      }
      
      if (status) {
        queryText += ` AND c.status = $${paramIndex++}`;
        params.push(status);
      }
      
      queryText += ` ORDER BY c.created_at DESC`;
      
      const result = await query(queryText, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching cheques:', error);
      res.status(500).json({ error: 'Failed to fetch cheques' });
    }
  }
);

// Create cheque and automatically deposit to account
router.post('/cheques',
  authenticate,
  authorize('boss', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { 
        cheque_number, 
        payee_name, 
        amount, 
        cheque_date, 
        description,
        deposit_to_account_id 
      } = req.body;

      if (!cheque_number || !payee_name || !amount || !cheque_date || !deposit_to_account_id) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (amount <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0' });
      }

      // Start transaction
      await query('BEGIN');

      try {
        // Create cheque record
        const chequeResult = await query(
          `INSERT INTO cheques 
           (cheque_number, payee_name, amount, cheque_date, description, created_by, status, deposit_date, deposited_to_account_id)
           VALUES ($1, $2, $3, $4, $5, $6, 'deposited', $4, $7) 
           RETURNING *`,
          [cheque_number, payee_name, amount, cheque_date, description || null, req.user?.userId, deposit_to_account_id]
        );

        const cheque = chequeResult.rows[0];

        // Update destination account balance
        await query(
          'UPDATE bank_accounts SET balance = balance + $1 WHERE id = $2',
          [amount, deposit_to_account_id]
        );

        // Create bank transfer record (from_account_id is NULL for external cheques)
        await query(
          `INSERT INTO bank_transfers 
           (from_account_id, to_account_id, amount, description, transfer_date, cheque_id, transfer_type)
           VALUES ($1, $2, $3, $4, $5, $6, 'cheque_deposit')`,
          [
            null,
            deposit_to_account_id,
            amount,
            `Cheque #${cheque_number} from ${payee_name}`,
            cheque_date,
            cheque.id
          ]
        );

        await query('COMMIT');

        res.status(201).json(cheque);
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error creating cheque:', error);
      res.status(500).json({ error: 'Failed to create cheque' });
    }
  }
);

// Update cheque
router.put('/cheques/:id',
  authenticate,
  authorize('boss', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { cheque_number, payee_name, amount, cheque_date, description, status } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (cheque_number !== undefined) {
        updates.push(`cheque_number = $${paramIndex++}`);
        values.push(cheque_number);
      }
      if (payee_name !== undefined) {
        updates.push(`payee_name = $${paramIndex++}`);
        values.push(payee_name);
      }
      if (amount !== undefined) {
        updates.push(`amount = $${paramIndex++}`);
        values.push(amount);
      }
      if (cheque_date !== undefined) {
        updates.push(`cheque_date = $${paramIndex++}`);
        values.push(cheque_date);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      const result = await query(
        `UPDATE cheques SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Cheque not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating cheque:', error);
      res.status(500).json({ error: 'Failed to update cheque' });
    }
  }
);

// Deposit cheque to bank account
router.post('/cheques/:id/deposit',
  authenticate,
  authorize('boss', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { to_account_id, deposit_date } = req.body;

      if (!to_account_id) {
        return res.status(400).json({ error: 'Destination account is required' });
      }

      // Start transaction
      await query('BEGIN');

      try {
        // Get cheque details
        const chequeResult = await query(
          'SELECT * FROM cheques WHERE id = $1',
          [id]
        );

        if (chequeResult.rows.length === 0) {
          throw new Error('Cheque not found');
        }

        const cheque = chequeResult.rows[0];

        if (cheque.status !== 'pending') {
          throw new Error('Cheque has already been processed or cancelled');
        }

        // Update destination account balance
        await query(
          'UPDATE bank_accounts SET balance = balance + $1 WHERE id = $2',
          [cheque.amount, to_account_id]
        );

        // Create bank transfer record
        const transferResult = await query(
          `INSERT INTO bank_transfers 
           (from_account_id, to_account_id, amount, description, transfer_date, cheque_id, transfer_type)
           VALUES ($1, $2, $3, $4, $5, $6, 'cheque_deposit') 
           RETURNING *`,
          [
            cheque.bank_account_id,
            to_account_id,
            cheque.amount,
            `Cheque #${cheque.cheque_number} from ${cheque.payee_name}`,
            deposit_date || new Date().toISOString(),
            id
          ]
        );

        // Update cheque status
        const updatedCheque = await query(
          `UPDATE cheques 
           SET status = 'deposited', 
               deposit_date = $1,
               deposited_to_account_id = $2
           WHERE id = $3 
           RETURNING *`,
          [deposit_date || new Date().toISOString(), to_account_id, id]
        );

        await query('COMMIT');

        res.json({
          message: 'Cheque deposited successfully',
          cheque: updatedCheque.rows[0],
          transfer: transferResult.rows[0]
        });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error: any) {
      console.error('Error depositing cheque:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to deposit cheque' 
      });
    }
  }
);

// Cancel cheque
router.post('/cheques/:id/cancel',
  authenticate,
  authorize('boss', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const result = await query(
        `UPDATE cheques 
         SET status = 'cancelled' 
         WHERE id = $1 AND status = 'pending'
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Cheque not found or already processed' });
      }

      res.json({
        message: 'Cheque cancelled successfully',
        cheque: result.rows[0]
      });
    } catch (error) {
      console.error('Error cancelling cheque:', error);
      res.status(500).json({ error: 'Failed to cancel cheque' });
    }
  }
);

export default router;
