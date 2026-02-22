import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { Application } from 'express';
import { config } from './env';
import logger from './logger';

/**
 * Initialize Sentry error monitoring
 * Only initializes if SENTRY_DSN is provided in environment variables
 */
export function initSentry(app: Application): void {
  const sentryDsn = process.env.SENTRY_DSN;

  if (!sentryDsn) {
    logger.info('Sentry DSN not provided - error monitoring disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment: config.NODE_ENV,
      
      // Set sample rate (1.0 = 100% of errors)
      sampleRate: 1.0,
      
      // Performance Monitoring
      tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in production, 100% in dev
      
      // Profiling
      profilesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      integrations: [
        // Express integration
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
        new ProfilingIntegration(),
      ],
      
      // Filter out sensitive data
      beforeSend(event, hint) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
        
        // Remove sensitive data from body
        if (event.request?.data) {
          const data = typeof event.request.data === 'string' 
            ? JSON.parse(event.request.data) 
            : event.request.data;
          
          if (data.password) data.password = '[REDACTED]';
          if (data.currentPassword) data.currentPassword = '[REDACTED]';
          if (data.newPassword) data.newPassword = '[REDACTED]';
          
          event.request.data = data;
        }
        
        return event;
      },
    });

    logger.info('✅ Sentry error monitoring initialized');
  } catch (error: any) {
    logger.error('Failed to initialize Sentry', { error: error.message });
  }
}

/**
 * Get Sentry request handler middleware
 * Must be used before any other request handlers
 */
export function getSentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}

/**
 * Get Sentry tracing handler middleware
 * Must be used after request handler
 */
export function getSentryTracingHandler() {
  return Sentry.Handlers.tracingHandler();
}

/**
 * Get Sentry error handler middleware
 * Must be used after all controllers but before other error handlers
 */
export function getSentryErrorHandler(): ReturnType<typeof Sentry.Handlers.errorHandler> {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture all errors with status >= 500
      if (error.status && typeof error.status === 'number' && error.status >= 500) {
        return true;
      }
      return true;
    },
  });
}

/**
 * Manually capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}

/**
 * Manually capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
}
