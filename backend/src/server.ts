import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// Validate environment variables first
import { config } from './config/env';
import logger, { morganStream } from './config/logger';

logger.info('Environment configuration loaded', {
  NODE_ENV: config.NODE_ENV,
  PORT: config.PORT,
  DB_HOST: config.DB_HOST,
  DB_NAME: config.DB_NAME,
});

import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { 
  initSentry, 
  getSentryRequestHandler, 
  getSentryTracingHandler,
  getSentryErrorHandler 
} from './config/sentry';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import expenseRoutes from './routes/expense.routes';
import siteRoutes from './routes/site.routes';
import bankRoutes from './routes/bank.routes';
import mdRoutes from './routes/md.routes';
import approvalRoutes from './routes/approval.routes';
import userRoutes from './routes/user.routes';
import ledgerRoutes from './routes/ledger.routes';
import reportRoutes from './routes/report.routes';

const app: Application = express();
const PORT = config.PORT;

// Initialize Sentry (must be first)
initSentry(app);

// Sentry request handler must be the first middleware
app.use(getSentryRequestHandler());
app.use(getSentryTracingHandler());

// Middleware
app.use(helmet());

// Parse CORS origins (comma-separated in .env)
const corsOrigins = config.CORS_ORIGIN.split(',').map(origin => origin.trim());
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(compression());
app.use(morgan('combined', { stream: morganStream }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Health check routes (no rate limiting for monitoring)
app.use('/api', healthRoutes);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/managing-directors', mdRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/reports', reportRoutes);

// Sentry error handler (must be before other error handlers)
app.use(getSentryErrorHandler());

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${config.NODE_ENV}`);
});

export default app;
