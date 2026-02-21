import { Router, Response } from 'express';
import { query } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all Supervisors
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM managing_directors WHERE active = true ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching MDs:', error);
    res.status(500).json({ error: 'Failed to fetch Supervisors' });
  }
});

// Create new Supervisor
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, contact } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await query(
      `INSERT INTO managing_directors (name, contact, active) 
       VALUES ($1, $2, true) 
       RETURNING *`,
      [name.trim(), contact?.trim() || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating supervisor:', error);
    res.status(500).json({ error: 'Failed to create supervisor' });
  }
});

export default router;
