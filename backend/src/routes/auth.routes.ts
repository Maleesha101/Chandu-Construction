import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { getClient, query } from '../database/db';
import { AuthTokenPayload } from '../types/index';
import { config } from '../config/env';
import { validatePassword } from '../utils/passwordValidation';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// Register
router.post('/register',
  authLimiter,
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').custom((password) => {
    const validation = validatePassword(password);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    return true;
  }),
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('role').isIn(['boss', 'admin', 'qs', 'md', 'worker', 'user']).withMessage('Invalid role'),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, full_name, phone, role } = req.body;

      // Check if trying to create a boss account
      if (role === 'boss') {
        const existingBoss = await query(
          'SELECT id FROM users WHERE role = $1',
          ['boss']
        );

        if (existingBoss.rows.length > 0) {
          return res.status(400).json({ msg: 'Only one boss account can be created for the system' });
        }
      }

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

      const client = await getClient();
      let user: any;

      try {
        await client.query('BEGIN');

        // Create user
        const result = await client.query(
          `INSERT INTO users (email, password_hash, full_name, phone, role)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, email, full_name, phone, role, created_at`,
          [email, password_hash, full_name, phone || null, role]
        );

        user = result.rows[0];

        // Create a petty cash ledger account for normal users.
        if (role === 'user') {
          const accountCode = `CASH-${user.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
          const accountName = `Petty Cash: ${user.full_name}`;

          await client.query(
            `INSERT INTO ledger_accounts (
              account_code,
              account_name,
              account_type,
              account_category,
              reference_id,
              balance,
              active,
              description
            ) VALUES ($1, $2, 'asset', 'petty_cash', $3, 0, true, $4)
            ON CONFLICT (account_code) DO NOTHING`,
            [accountCode, accountName, user.id, `Auto-created petty cash account for user ${user.full_name}`]
          );
        }

        await client.query('COMMIT');
      } catch (txError) {
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        (client as any).release();
      }

      // Generate token
      const tokenPayload: AuthTokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(
        tokenPayload, 
        config.JWT_SECRET as Secret,
        { expiresIn: config.JWT_EXPIRES_IN } as SignOptions
      );

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Login
router.post('/login',
  authLimiter,
  body('email').isEmail(),
  body('password').notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Get user
      const result = await query(
        'SELECT * FROM users WHERE email = $1 AND active = true',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const tokenPayload: AuthTokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(
        tokenPayload, 
        config.JWT_SECRET as Secret,
        { expiresIn: config.JWT_EXPIRES_IN } as SignOptions
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

export default router;
