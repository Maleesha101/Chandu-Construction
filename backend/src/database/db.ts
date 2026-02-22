import { Pool } from 'pg';
import logger from '../config/logger';

// Environment variables are loaded in server.ts before this module is imported
logger.debug('Database configuration', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  passwordExists: !!process.env.DB_PASSWORD
});

if (!process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD environment variable is required');
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'site_cash_flow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  logger.info('✅ Database connected successfully');
});

pool.on('error', (err) => {
  logger.error('❌ Unexpected database error', { error: err.message, stack: err.stack });
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  // Only log queries in development mode
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
  } else if (duration > 1000) {
    // Log slow queries in production (> 1 second)
    logger.warn('Slow query detected', { duration, rows: res.rowCount });
  }
  
  return res;
};

export const getClient = async () => {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  // Set a timeout of 5 seconds
  const timeout = setTimeout(() => {
    logger.warn('A client has been checked out for more than 5 seconds!');
  }, 5000);

  // Override release to clear timeout
  (client as any).release = () => {
    clearTimeout(timeout);
    return originalRelease();
  };

  return client;
};

export default pool;
