import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
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

// Get all users who can make transactions (boss, admin, md)
router.get('/transaction-users',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await query(
        `SELECT id, email, full_name, phone, role, active, created_at
        FROM users
        WHERE role IN ('boss', 'admin', 'md') AND active = true
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

// Create new user (boss and admin only)
router.post('/',
  authenticate,
  authorize('boss', 'admin'),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('full_name').notEmpty(),
  body('role').isIn(['boss', 'admin', 'qs', 'md', 'viewer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, full_name, phone, role } = req.body;

      // Check if user exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // Create user
      const result = await query(
        `INSERT INTO users (email, password_hash, full_name, phone, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, full_name, phone, role, created_at`,
        [email, password_hash, full_name, phone || null, role]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

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

// Toggle user active status (boss and admin only)
router.patch('/:id/active',
  authenticate,
  authorize('boss', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { active } = req.body;

      // Prevent user from deactivating themselves
      if (req.user?.userId === id && !active) {
        return res.status(400).json({ error: 'You cannot deactivate your own account' });
      }

      const result = await query(
        'UPDATE users SET active = $1 WHERE id = $2 RETURNING id, email, full_name, role, active',
        [active, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({ error: 'Failed to update user status' });
    }
  }
);

export default router;
