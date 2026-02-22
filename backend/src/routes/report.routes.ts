import { Router, Response } from 'express';
import { query } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper function to get date range
function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let startDate = new Date();

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case 'this-week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'last-week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(now.getDate() - now.getDay() - 1);
      endDate.setHours(23, 59, 59);
      break;
    case 'this-month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      break;
    case 'last-month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      endDate.setMonth(now.getMonth(), 0);
      endDate.setHours(23, 59, 59);
      break;
    default:
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

// Get comprehensive expense summary
router.get('/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'this-week' } = req.query;
    const { startDate, endDate } = getDateRange(period as string);

    // Total expenses by status
    const statusQuery = await query(
      `SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expense_records
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY status`,
      [startDate, endDate]
    );

    // Total expenses by payment method
    const paymentMethodQuery = await query(
      `SELECT 
        payment_method,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expense_records
      WHERE created_at BETWEEN $1 AND $2
        AND status IN ('approved', 'wd_approved')
      GROUP BY payment_method`,
      [startDate, endDate]
    );

    // Daily expense trend
    const dailyTrendQuery = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expense_records
      WHERE created_at BETWEEN $1 AND $2
        AND status IN ('approved', 'wd_approved')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)`,
      [startDate, endDate]
    );

    // Top 5 categories by spending
    const categoryQuery = await query(
      `SELECT 
        to_name as category,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expense_records
      WHERE created_at BETWEEN $1 AND $2
        AND status IN ('approved', 'wd_approved')
      GROUP BY to_name
      ORDER BY total DESC
      LIMIT 5`,
      [startDate, endDate]
    );

    // Overall statistics
    const overallStats = await query(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(AVG(amount), 0) as avg_amount,
        COALESCE(MAX(amount), 0) as max_amount,
        COALESCE(MIN(amount), 0) as min_amount
      FROM expense_records
      WHERE created_at BETWEEN $1 AND $2
        AND status IN ('approved', 'wd_approved')`,
      [startDate, endDate]
    );

    res.json({
      period,
      dateRange: { startDate, endDate },
      byStatus: statusQuery.rows,
      byPaymentMethod: paymentMethodQuery.rows,
      dailyTrend: dailyTrendQuery.rows,
      topCategories: categoryQuery.rows,
      overall: overallStats.rows[0],
    });
  } catch (error) {
    console.error('Error fetching expense summary:', error);
    res.status(500).json({ error: 'Failed to fetch expense summary' });
  }
});

// Get site-specific report
router.get('/by-site', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'this-week' } = req.query;
    const { startDate, endDate } = getDateRange(period as string);

    const result = await query(
      `SELECT 
        s.id,
        s.name,
        s.code,
        s.location,
        COUNT(e.id) as expense_count,
        COALESCE(SUM(e.amount), 0) as total_spent,
        COALESCE(SUM(CASE WHEN e.payment_method = 'cash' THEN e.amount ELSE 0 END), 0) as cash_spent,
        COALESCE(SUM(CASE WHEN e.payment_method = 'bank' THEN e.amount ELSE 0 END), 0) as bank_spent,
        COALESCE(SUM(CASE WHEN e.payment_method = 'cheque' THEN e.amount ELSE 0 END), 0) as cheque_spent
      FROM sites s
      LEFT JOIN expense_records e ON s.id = e.site_id 
        AND e.created_at BETWEEN $1 AND $2
        AND e.status IN ('approved', 'wd_approved')
      WHERE s.active = true
      GROUP BY s.id, s.name, s.code, s.location
      ORDER BY total_spent DESC`,
      [startDate, endDate]
    );

    res.json({
      period,
      dateRange: { startDate, endDate },
      sites: result.rows,
    });
  } catch (error) {
    console.error('Error fetching site report:', error);
    res.status(500).json({ error: 'Failed to fetch site report' });
  }
});

// Get Supervisor-specific report (MD users)
router.get('/by-md', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'this-week' } = req.query;
    const { startDate, endDate } = getDateRange(period as string);

    const result = await query(
      `SELECT 
        u.id,
        u.full_name as name,
        u.phone,
        COUNT(e.id) as expense_count,
        COALESCE(SUM(e.amount), 0) as total_spent,
        COALESCE(AVG(e.amount), 0) as avg_amount
      FROM users u
      LEFT JOIN expense_records e ON (e.entered_by_user_id = u.id OR e.qs_notes = u.full_name)
        AND e.created_at BETWEEN $1 AND $2
        AND e.status IN ('approved', 'wd_approved')
      WHERE u.role = 'md' AND u.active = true
      GROUP BY u.id, u.full_name, u.phone
      ORDER BY total_spent DESC`,
      [startDate, endDate]
    );

    res.json({
      period,
      dateRange: { startDate, endDate },
      supervisors: result.rows,
    });
  } catch (error) {
    console.error('Error fetching supervisor report:', error);
    res.status(500).json({ error: 'Failed to fetch supervisor report' });
  }
});

// Get bank account report
router.get('/by-bank', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { period = 'this-week' } = req.query;
    const { startDate, endDate } = getDateRange(period as string);

    const result = await query(
      `SELECT 
        b.id,
        b.name,
        b.account_number,
        b.balance as current_balance,
        COUNT(e.id) as transaction_count,
        COALESCE(SUM(e.amount), 0) as total_spent
      FROM bank_accounts b
      LEFT JOIN expense_records e ON b.id = e.from_bank_account_id 
        AND e.created_at BETWEEN $1 AND $2
        AND e.status IN ('approved', 'wd_approved')
      GROUP BY b.id, b.name, b.account_number, b.balance
      ORDER BY total_spent DESC`,
      [startDate, endDate]
    );

    res.json({
      period,
      dateRange: { startDate, endDate },
      banks: result.rows,
    });
  } catch (error) {
    console.error('Error fetching bank report:', error);
    res.status(500).json({ error: 'Failed to fetch bank report' });
  }
});

// Get weekly comparison report
router.get('/weekly-comparison', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const weeks = [];
    
    // Get last 8 weeks of data
    for (let i = 0; i < 8; i++) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - (i * 7));
      weekEnd.setDate(weekEnd.getDate() - weekEnd.getDay());
      weekEnd.setHours(23, 59, 59);
      
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      weekStart.setHours(0, 0, 0);
      
      weeks.push({ weekStart, weekEnd });
    }

    const weeklyData = await Promise.all(
      weeks.map(async ({ weekStart, weekEnd }) => {
        const result = await query(
          `SELECT 
            COUNT(*) as count,
            COALESCE(SUM(amount), 0) as total
          FROM expense_records
          WHERE created_at BETWEEN $1 AND $2
            AND status IN ('approved', 'wd_approved')`,
          [weekStart, weekEnd]
        );
        
        return {
          week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
          weekStart,
          weekEnd,
          ...result.rows[0],
        };
      })
    );

    res.json({
      weeks: weeklyData.reverse(),
    });
  } catch (error) {
    console.error('Error fetching weekly comparison:', error);
    res.status(500).json({ error: 'Failed to fetch weekly comparison' });
  }
});

export default router;
