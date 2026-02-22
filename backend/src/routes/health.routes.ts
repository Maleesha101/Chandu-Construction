import { Router, Request, Response } from 'express';
import { query } from '../database/db';
import { config } from '../config/env';
import logger from '../config/logger';

const router = Router();

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    database: {
      status: 'connected' | 'disconnected';
      responseTime?: number;
      error?: string;
    };
  };
}

/**
 * Health check endpoint
 * Used by load balancers, container orchestrators, and monitoring systems
 */
router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const healthCheck: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: {
        status: 'disconnected'
      }
    }
  };

  try {
    // Check database connectivity
    const dbStart = Date.now();
    await query('SELECT 1');
    const dbResponseTime = Date.now() - dbStart;

    healthCheck.services.database = {
      status: 'connected',
      responseTime: dbResponseTime
    };

    // Determine overall health status
    if (dbResponseTime > 1000) {
      healthCheck.status = 'degraded';
      logger.warn('Health check: Database response time is slow', { responseTime: dbResponseTime });
    }

    res.status(200).json(healthCheck);
  } catch (error: any) {
    healthCheck.status = 'unhealthy';
    healthCheck.services.database = {
      status: 'disconnected',
      error: error.message
    };

    logger.error('Health check failed', { error: error.message });
    res.status(503).json(healthCheck);
  }
});

/**
 * Readiness check endpoint
 * Returns 200 when the service is ready to accept traffic
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if database is ready
    await query('SELECT 1');
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

/**
 * Liveness check endpoint
 * Returns 200 if the service is alive (even if dependencies are down)
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});

export default router;
