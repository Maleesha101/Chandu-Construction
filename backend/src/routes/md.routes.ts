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

export default router;
