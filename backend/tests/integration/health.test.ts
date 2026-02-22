import request from 'supertest';
import express from 'express';
import healthRoutes from '../../src/routes/health.routes';

// Mock the database query function
jest.mock('../../src/database/db', () => ({
  query: jest.fn(),
}));

// Mock the logger
jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the config
jest.mock('../../src/config/env', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 5000,
    DB_HOST: 'localhost',
    DB_NAME: 'testdb',
    JWT_SECRET: 'test_secret',
    JWT_EXPIRES_IN: '7d',
    CORS_ORIGIN: 'http://localhost:3000',
  },
}));

const app = express();
app.use(express.json());
app.use('/api', healthRoutes);

describe('Health Check Routes', () => {
  const { query } = require('../../src/database/db');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when database is connected', async () => {
      query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.services.database.status).toBe('connected');
      expect(response.body.services.database.responseTime).toBeDefined();
    });

    it('should return unhealthy status when database is disconnected', async () => {
      query.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.database.status).toBe('disconnected');
      expect(response.body.services.database.error).toBe('Connection refused');
    });

    it('should return degraded status when database is slow', async () => {
      query.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ rows: [{ '?column?': 1 }] }), 1100))
      );

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.services.database.responseTime).toBeGreaterThan(1000);
    });
  });

  describe('GET /api/ready', () => {
    it('should return 200 when service is ready', async () => {
      query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const response = await request(app).get('/api/ready');

      expect(response.status).toBe(200);
      expect(response.body.ready).toBe(true);
    });

    it('should return 503 when service is not ready', async () => {
      query.mockRejectedValueOnce(new Error('Database not ready'));

      const response = await request(app).get('/api/ready');

      expect(response.status).toBe(503);
      expect(response.body.ready).toBe(false);
    });
  });

  describe('GET /api/live', () => {
    it('should always return 200', async () => {
      const response = await request(app).get('/api/live');

      expect(response.status).toBe(200);
      expect(response.body.alive).toBe(true);
    });
  });
});
