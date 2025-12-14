import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Debug: Show current working directory and check for .env file
console.log('Current working directory:', process.cwd());
const envPath = path.join(process.cwd(), '.env');
console.log('.env path:', envPath);
console.log('.env exists:', fs.existsSync(envPath));

// Load .env file
const result = dotenv.config();
if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
} else {
  console.log('✅ .env file loaded successfully');
}

console.log('Environment after dotenv:', {
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  JWT_SECRET: process.env.JWT_SECRET ? '***' : undefined
});

import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import expenseRoutes from './routes/expense.routes';
import siteRoutes from './routes/site.routes';
import bankRoutes from './routes/bank.routes';
import mdRoutes from './routes/md.routes';
import approvalRoutes from './routes/approval.routes';
import userRoutes from './routes/user.routes';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:8081', 'http://localhost:3000'],
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Site Cash Flow API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/managing-directors', mdRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/users', userRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
});

export default app;
