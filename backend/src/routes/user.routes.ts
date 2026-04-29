import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getClient, query } from '../database/db';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { validatePassword, getPasswordErrorMessage } from '../utils/passwordValidation';
import { passwordChangeLimiter } from '../middleware/rateLimiter';

const router = Router();

// Get all users (boss and admin only)
router.get('/',
  authenticate,
  authorize('boss', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await query(
        `SELECT id, email, full_name, phone, role, active, created_at
        FROM users
        ORDER BY full_name`
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// Get all supervisors (users with 'md' role)
router.get('/supervisors',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await query(
        `SELECT id, email, full_name, phone, role, active, created_at
        FROM users
        WHERE role = 'md' AND active = true
        ORDER BY full_name`
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching supervisors:', error);
      res.status(500).json({ error: 'Failed to fetch supervisors' });
    }
  }
);

// Get all users who can make transactions (boss, admin, md, qs)
router.get('/transaction-users',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await query(
        `SELECT id, email, full_name, phone, role, active, created_at
        FROM users
        WHERE role IN ('boss', 'admin', 'md', 'qs', 'user') AND active = true
        ORDER BY full_name`
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching transaction users:', error);
      res.status(500).json({ error: 'Failed to fetch transaction users' });
    }
  }
);

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;

    const result = await query(
      `SELECT id, email, full_name, phone, role, active, created_at
      FROM users WHERE id = $1`,
      [user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// Update user role (boss only)
router.patch('/:id/role',
  authenticate,
  authorize('boss'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      // Check if trying to assign boss role
      if (role === 'boss') {
        const existingBoss = await query(
          'SELECT id FROM users WHERE role = $1 AND id != $2',
          ['boss', id]
        );

        if (existingBoss.rows.length > 0) {
          return res.status(400).json({ msg: 'Only one boss account can exist in the system' });
        }
      }


      const result = await query(
        'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, full_name, role',
        [role, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  }
);

// Delete user (boss only)
router.delete('/:id',
  authenticate,
  authorize('boss'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const currentUser = req.user!;

      // Prevent user from deleting themselves
      if (id === currentUser.userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const client = await getClient();
      let result;

      try {
        await client.query('BEGIN');

        // Remove ledger entries and accounts tied to this user.
        const linkedAccountsResult = await client.query(
          `SELECT id
           FROM ledger_accounts
           WHERE reference_id = $1
             AND account_category IN ('petty_cash', 'user')`,
          [id]
        );

        const linkedAccountIds = linkedAccountsResult.rows.map((row: { id: string }) => row.id);

        if (linkedAccountIds.length > 0) {
          await client.query(
            'DELETE FROM ledger_entries WHERE account_id = ANY($1::uuid[])',
            [linkedAccountIds]
          );

          await client.query(
            'DELETE FROM ledger_accounts WHERE id = ANY($1::uuid[])',
            [linkedAccountIds]
          );
        }

        // Remove created_by linkage to allow user deletion.
        await client.query(
          'UPDATE ledger_entries SET created_by = NULL WHERE created_by = $1',
          [id]
        );

        result = await client.query(
          'DELETE FROM users WHERE id = $1 RETURNING id, email, full_name',
          [id]
        );

        await client.query('COMMIT');
      } catch (txError) {
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        (client as any).release();
      }

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted successfully', user: result.rows[0] });
    } catch (error) {
      console.error('Error deleting user:', error);

      // Surface FK violations as a business error instead of generic 500.
      if ((error as any)?.code === '23503') {
        const table = (error as any)?.table;

        if (table === 'approvals') {
          return res.status(409).json({
            error: 'Cannot delete this user because they have approval history. Please keep the user for audit records.'
          });
        }

        return res.status(409).json({
          error: 'Cannot delete this user because related records still exist. Remove or reassign dependent records first.'
        });
      }

      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

// Change password
router.patch('/me/password',
  passwordChangeLimiter,
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const currentUser = req.user!;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      // Validate new password strength
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({ 
          error: 'Password does not meet requirements',
          details: passwordValidation.errors 
        });
      }

      // Get current user with password hash
      const userResult = await query(
        'SELECT id, password_hash FROM users WHERE id = $1',
        [currentUser.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [newPasswordHash, currentUser.userId]
      );

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// Change email
router.patch('/me/email',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const currentUser = req.user!;
      const { newEmail, password } = req.body;

      if (!newEmail || !password) {
        return res.status(400).json({ error: 'New email and password are required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if email already exists
      const existingEmail = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [newEmail, currentUser.userId]
      );

      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      // Get current user with password hash
      const userResult = await query(
        'SELECT id, password_hash FROM users WHERE id = $1',
        [currentUser.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Password is incorrect' });
      }

      // Update email
      const result = await query(
        'UPDATE users SET email = $1 WHERE id = $2 RETURNING id, email, full_name, role',
        [newEmail, currentUser.userId]
      );

      res.json({ message: 'Email updated successfully', user: result.rows[0] });
    } catch (error) {
      console.error('Error changing email:', error);
      res.status(500).json({ error: 'Failed to change email' });
    }
  }
);

export default router;
