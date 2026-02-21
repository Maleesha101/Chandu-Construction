import { Router, Response } from 'express';
import { query } from '../database/db';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

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

// Get all users who can make transactions (boss, admin, md, worker)
router.get('/transaction-users',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await query(
        `SELECT id, email, full_name, phone, role, active, created_at
        FROM users
        WHERE role IN ('boss', 'admin', 'md', 'worker') AND active = true
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

export default router;
