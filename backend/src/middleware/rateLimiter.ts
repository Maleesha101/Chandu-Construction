import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';

// Extend Express Request type to include rateLimit property
declare module 'express' {
  interface Request {
    rateLimit?: {
      limit: number;
      current: number;
      remaining: number;
      resetTime: Date;
    };
  }
}

/**
 * General API rate limiter
 * Protects all API endpoints from abuse
 */
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes',
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the request limit. Please try again later.',
      retryAfter: req.rateLimit?.resetTime ? Math.ceil(req.rateLimit.resetTime.getTime() / 1000) : Date.now() + 900
    });
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks on login/register
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/register attempts per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Your IP has been temporarily blocked due to too many failed attempts. Please try again in 15 minutes.',
      retryAfter: req.rateLimit?.resetTime ? Math.ceil(req.rateLimit.resetTime.getTime() / 1000) : Date.now() + 900
    });
  }
});

/**
 * Rate limiter for password change endpoints
 * Prevents automated password change attacks
 */
export const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password changes per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many password change attempts, please try again after an hour',
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many password change attempts',
      message: 'You have exceeded the password change limit. Please try again in an hour.',
      retryAfter: req.rateLimit?.resetTime ? Math.ceil(req.rateLimit.resetTime.getTime() / 1000) : Date.now() + 3600
    });
  }
});

/**
 * Create operation rate limiter
 * Prevents spam of create operations (expenses, sites, etc.)
 */
export const createLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 create operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many create operations, please slow down',
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many create operations',
      message: 'You are creating resources too quickly. Please slow down.',
      retryAfter: req.rateLimit?.resetTime ? Math.ceil(req.rateLimit.resetTime.getTime() / 1000) : Date.now() + 60
    });
  }
});
