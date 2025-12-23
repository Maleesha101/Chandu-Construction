import { Router, Response } from 'express';
import { query } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get approvals for a record
router.get('/record/:recordId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { recordId } = req.params;

    const result = await query(
      `SELECT a.*, u.full_name as approver_name
      FROM approvals a
      JOIN users u ON a.approver_id = u.id
      WHERE a.record_id = $1
      ORDER BY a.approved_at DESC`,
      [recordId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

export default router;
