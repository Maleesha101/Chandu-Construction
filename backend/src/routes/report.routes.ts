import { Router, Response } from 'express';
import { query } from '../database/db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Weekly Summary Report
router.get('/weekly-summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date } = req.query;
    
    const queryText = `
      SELECT 
        s.name as site_name,
        s.code as site_code,
        md.name as md_name,
        COUNT(e.id) as total_transactions,
        SUM(CASE WHEN e.payment_method = 'cash' THEN e.amount ELSE 0 END) as cash_expenses,
        SUM(CASE WHEN e.payment_method = 'bank' THEN e.amount ELSE 0 END) as bank_expenses,
        SUM(e.amount) as total_amount,
        COUNT(CASE WHEN e.status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN e.status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN e.status = 'rejected' THEN 1 END) as rejected_count
      FROM expense_records e
      LEFT JOIN sites s ON e.site_id = s.id
      LEFT JOIN managing_directors md ON e.md_id = md.id
      WHERE e.entry_date >= $1 AND e.entry_date <= $2
      GROUP BY s.id, s.name, s.code, md.id, md.name
      ORDER BY total_amount DESC
    `;
    
    const result = await query(queryText, [start_date, end_date]);
    
    // Calculate totals
    const totals = {
      total_transactions: result.rows.reduce((sum, row) => sum + parseInt(row.total_transactions), 0),
      cash_expenses: result.rows.reduce((sum, row) => sum + parseFloat(row.cash_expenses), 0),
      bank_expenses: result.rows.reduce((sum, row) => sum + parseFloat(row.bank_expenses), 0),
      total_amount: result.rows.reduce((sum, row) => sum + parseFloat(row.total_amount), 0),
      pending_count: result.rows.reduce((sum, row) => sum + parseInt(row.pending_count), 0),
      approved_count: result.rows.reduce((sum, row) => sum + parseInt(row.approved_count), 0),
      rejected_count: result.rows.reduce((sum, row) => sum + parseInt(row.rejected_count), 0),
    };
    
    res.json({
      data: result.rows,
      totals,
      period: { start_date, end_date }
    });
  } catch (error) {
    console.error('Error generating weekly summary:', error);
    res.status(500).json({ error: 'Failed to generate weekly summary' });
  }
});

// Bank Account Ledger Report
router.get('/bank-ledger', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, bank_id } = req.query;
    
    let queryText = `
      SELECT 
        e.entry_date,
        e.reference as wd_number,
        e.purpose as item_name,
        e.amount,
        e.status,
        e.payment_method,
        s.name as site_name,
        md.name as md_name,
        b.name as bank_name,
        b.balance as current_balance,
        u.full_name as entered_by
      FROM expense_records e
      LEFT JOIN sites s ON e.site_id = s.id
      LEFT JOIN managing_directors md ON e.md_id = md.id
      LEFT JOIN bank_accounts b ON e.from_bank_account_id = b.id
      LEFT JOIN users u ON e.entered_by_user_id = u.id
      WHERE e.payment_method = 'bank'
        AND e.entry_date >= $1 
        AND e.entry_date <= $2
    `;
    
    const params: any[] = [start_date, end_date];
    
    if (bank_id) {
      queryText += ` AND e.from_bank_account_id = $3`;
      params.push(bank_id);
    }
    
    queryText += ' ORDER BY e.entry_date DESC, e.created_at DESC';
    
    const result = await query(queryText, params);
    
    // Get bank account summary
    const bankSummaryQuery = `
      SELECT 
        b.id,
        b.name,
        b.account_number,
        b.balance as current_balance,
        COUNT(e.id) as transaction_count,
        COALESCE(SUM(CASE WHEN e.status IN ('approved', 'wd_approved') THEN e.amount ELSE 0 END), 0) as total_debits
      FROM bank_accounts b
      LEFT JOIN expense_records e ON b.id = e.from_bank_account_id 
        AND e.payment_method = 'bank'
        AND e.entry_date >= $1 
        AND e.entry_date <= $2
      WHERE 1=1
      ${bank_id ? 'AND b.id = $3' : ''}
      GROUP BY b.id, b.name, b.account_number, b.balance
      ORDER BY b.name
    `;
    
    const bankSummary = await query(bankSummaryQuery, params);
    
    res.json({
      transactions: result.rows,
      bank_summary: bankSummary.rows,
      period: { start_date, end_date }
    });
  } catch (error) {
    console.error('Error generating bank ledger:', error);
    res.status(500).json({ error: 'Failed to generate bank ledger' });
  }
});

// Site Expenses Report
router.get('/site-expenses', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, site_id } = req.query;
    
    let queryText = `
      SELECT 
        s.id as site_id,
        s.name as site_name,
        s.code as site_code,
        s.location,
        COUNT(e.id) as total_transactions,
        COALESCE(SUM(CASE WHEN e.payment_method = 'cash' THEN e.amount ELSE 0 END), 0) as cash_expenses,
        COALESCE(SUM(CASE WHEN e.payment_method = 'bank' THEN e.amount ELSE 0 END), 0) as bank_expenses,
        COALESCE(SUM(e.amount), 0) as total_expenses,
        COUNT(CASE WHEN e.status = 'pending' THEN 1 END) as pending_items,
        COUNT(CASE WHEN e.status = 'approved' THEN 1 END) as approved_items,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT md.name), NULL) as managing_directors
      FROM sites s
      LEFT JOIN expense_records e ON s.id = e.site_id
        AND e.entry_date >= $1 
        AND e.entry_date <= $2
      LEFT JOIN managing_directors md ON e.md_id = md.id
      WHERE 1=1
    `;
    
    const params: any[] = [start_date, end_date];
    
    if (site_id) {
      queryText += ` AND s.id = $3`;
      params.push(site_id);
    }
    
    queryText += `
      GROUP BY s.id, s.name, s.code, s.location
      ORDER BY total_expenses DESC
    `;
    
    const result = await query(queryText, params);
    
    // Get detailed expense categories per site
    const categoryQuery = `
      SELECT 
        s.name as site_name,
        e.purpose as item_name,
        COUNT(*) as item_count,
        COALESCE(SUM(e.amount), 0) as total_amount
      FROM expense_records e
      LEFT JOIN sites s ON e.site_id = s.id
      WHERE e.entry_date >= $1 
        AND e.entry_date <= $2
        ${site_id ? 'AND s.id = $3' : ''}
      GROUP BY s.name, e.purpose
      ORDER BY s.name, total_amount DESC
    `;
    
    const categories = await query(categoryQuery, params);
    
    res.json({
      sites: result.rows,
      expense_categories: categories.rows,
      period: { start_date, end_date }
    });
  } catch (error) {
    console.error('Error generating site expenses report:', error);
    res.status(500).json({ error: 'Failed to generate site expenses report' });
  }
});

// MD Expenses Report
router.get('/md-expenses', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, md_id } = req.query;
    
    let queryText = `
      SELECT 
        md.id as md_id,
        md.name as md_name,
        md.email as md_email,
        md.contact as md_phone,
        COUNT(e.id) as total_transactions,
        COALESCE(SUM(CASE WHEN e.payment_method = 'cash' THEN e.amount ELSE 0 END), 0) as cash_expenses,
        COALESCE(SUM(CASE WHEN e.payment_method = 'bank' THEN e.amount ELSE 0 END), 0) as bank_expenses,
        COALESCE(SUM(e.amount), 0) as total_expenses,
        COUNT(CASE WHEN e.status = 'pending' THEN 1 END) as pending_items,
        COUNT(CASE WHEN e.status = 'approved' THEN 1 END) as approved_items,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT s.name), NULL) as sites
      FROM managing_directors md
      LEFT JOIN expense_records e ON md.id = e.md_id
        AND e.entry_date >= $1 
        AND e.entry_date <= $2
      LEFT JOIN sites s ON e.site_id = s.id
      WHERE 1=1
    `;
    
    const params: any[] = [start_date, end_date];
    
    if (md_id) {
      queryText += ` AND md.id = $3`;
      params.push(md_id);
    }
    
    queryText += `
      GROUP BY md.id, md.name, md.email, md.contact
      ORDER BY total_expenses DESC
    `;
    
    const result = await query(queryText, params);
    
    // Get expense trend by date
    const trendQuery = `
      SELECT 
        md.name as md_name,
        e.entry_date,
        COUNT(*) as transaction_count,
        COALESCE(SUM(e.amount), 0) as daily_total
      FROM expense_records e
      LEFT JOIN managing_directors md ON e.md_id = md.id
      WHERE e.entry_date >= $1 
        AND e.entry_date <= $2
        ${md_id ? 'AND md.id = $3' : ''}
      GROUP BY md.name, e.entry_date
      ORDER BY e.entry_date, md.name
    `;
    
    const trend = await query(trendQuery, params);
    
    res.json({
      managing_directors: result.rows,
      expense_trend: trend.rows,
      period: { start_date, end_date }
    });
  } catch (error) {
    console.error('Error generating MD expenses report:', error);
    res.status(500).json({ error: 'Failed to generate MD expenses report' });
  }
});

// WD Status Report
router.get('/wd-report', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { start_date, end_date, status } = req.query;
    
    let queryText = `
      SELECT 
        e.id,
        e.reference as wd_number,
        e.entry_date,
        e.purpose as item_name,
        e.amount,
        e.payment_method,
        e.status,
        e.qs_notes,
        e.created_at,
        s.name as site_name,
        s.code as site_code,
        md.name as md_name,
        b.name as bank_name,
        u.full_name as entered_by
      FROM expense_records e
      LEFT JOIN sites s ON e.site_id = s.id
      LEFT JOIN managing_directors md ON e.md_id = md.id
      LEFT JOIN bank_accounts b ON e.from_bank_account_id = b.id
      LEFT JOIN users u ON e.entered_by_user_id = u.id
      WHERE e.entry_date >= $1 
        AND e.entry_date <= $2
    `;
    
    const params: any[] = [start_date, end_date];
    
    if (status) {
      queryText += ` AND e.status = $3`;
      params.push(status);
    }
    
    queryText += ' ORDER BY e.entry_date DESC, e.created_at DESC';
    
    const result = await query(queryText, params);
    
    // Get status summary
    const summaryQuery = `
      SELECT 
        e.status,
        COUNT(*) as count,
        COALESCE(SUM(e.amount), 0) as total_amount
      FROM expense_records e
      WHERE e.entry_date >= $1 
        AND e.entry_date <= $2
      GROUP BY e.status
      ORDER BY e.status
    `;
    
    const summary = await query(summaryQuery, [start_date, end_date]);
    
    res.json({
      records: result.rows,
      summary: summary.rows,
      period: { start_date, end_date }
    });
  } catch (error) {
    console.error('Error generating WD report:', error);
    res.status(500).json({ error: 'Failed to generate WD report' });
  }
});

// Export helper - Get all banks for filtering
router.get('/filters/banks', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT id, name, account_number FROM bank_accounts ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching banks:', error);
    res.status(500).json({ error: 'Failed to fetch banks' });
  }
});

// Export helper - Get all MDs for filtering
router.get('/filters/mds', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT id, name FROM managing_directors ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching MDs:', error);
    res.status(500).json({ error: 'Failed to fetch MDs' });
  }
});

export default router;
