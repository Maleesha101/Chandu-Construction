import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { config } from '../config/env';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error occurred', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    ...(config.NODE_ENV === 'development' && { stack: err.stack })
  });
};
