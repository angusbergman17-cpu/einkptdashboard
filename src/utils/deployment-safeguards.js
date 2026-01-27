/**
 * Deployment Safeguards
 * Production-ready error handling, monitoring, and failure mitigation
 *
 * Features:
 * - Graceful shutdown handling
 * - Process error recovery
 * - Request timeout protection
 * - Health check enhancements
 * - Environment validation
 * - Structured logging
 */

import { createWriteStream } from 'fs';
import { join } from 'path';

// Logging levels
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// Log file stream (for production troubleshooting)
let logStream = null;
if (process.env.NODE_ENV === 'production') {
  try {
    logStream = createWriteStream(join('/tmp', 'ptv-server.log'), { flags: 'a' });
  } catch (err) {
    console.error('Failed to create log stream:', err);
  }
}

/**
 * Structured logger with file output for production
 */
export function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };

  const logLine = JSON.stringify(logEntry);

  // Console output (always)
  console.log(`[${timestamp}] ${level}: ${message}`, meta);

  // File output (production only)
  if (logStream) {
    logStream.write(logLine + '\n');
  }
}

/**
 * Validate critical environment variables
 * Returns validation result with missing/invalid vars
 */
export function validateEnvironment() {
  const required = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || '3000'
  };

  const optional = {
    ODATA_API_KEY: process.env.ODATA_API_KEY ? '✓ Set' : '✗ Missing (fallback mode)',
    GOOGLE_PLACES_KEY: (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_KEY) ? '✓ Set' : '✗ Missing (optional)',
    MAPBOX_TOKEN: (process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_TOKEN) ? '✓ Set' : '✗ Missing (optional)',
    SMTP_HOST: process.env.SMTP_HOST ? '✓ Set' : '✗ Missing (optional)'
  };

  return {
    valid: true, // Non-blocking - system works in fallback mode
    required,
    optional
  };
}

/**
 * Request timeout middleware
 * Prevents hanging requests from exhausting server resources
 */
export function requestTimeout(timeoutMs = 30000) {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        log(LOG_LEVELS.WARN, `Request timeout: ${req.method} ${req.path}`, {
          ip: req.ip,
          userAgent: req.get('user-agent')
        });
        res.status(504).json({
          error: 'Request timeout',
          message: 'The server took too long to respond'
        });
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
}

/**
 * Error tracking for debugging
 */
const errorCounts = new Map();

export function trackError(errorType, errorMessage) {
  const key = `${errorType}:${errorMessage}`;
  errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
}

export function getErrorStats() {
  const stats = {};
  for (const [key, count] of errorCounts.entries()) {
    stats[key] = count;
  }
  return stats;
}

/**
 * Graceful shutdown handler
 * Ensures all connections close cleanly before exit
 */
export function setupGracefulShutdown(server, cleanup = async () => {}) {
  let isShuttingDown = false;

  async function gracefulShutdown(signal) {
    if (isShuttingDown) {
      log(LOG_LEVELS.WARN, `Already shutting down, received ${signal} again`);
      return;
    }

    isShuttingDown = true;
    log(LOG_LEVELS.INFO, `Received ${signal}, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      log(LOG_LEVELS.INFO, 'HTTP server closed');

      try {
        // Run cleanup tasks (close DB, save state, etc.)
        await cleanup();
        log(LOG_LEVELS.INFO, 'Cleanup completed successfully');

        // Close log stream
        if (logStream) {
          logStream.end();
        }

        process.exit(0);
      } catch (err) {
        log(LOG_LEVELS.ERROR, 'Error during cleanup', { error: err.message });
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      log(LOG_LEVELS.ERROR, 'Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  }

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

/**
 * Unhandled error recovery
 * Logs errors but keeps server running when safe
 */
export function setupErrorHandlers() {
  process.on('uncaughtException', (err) => {
    log(LOG_LEVELS.ERROR, 'Uncaught Exception', {
      error: err.message,
      stack: err.stack
    });
    trackError('uncaughtException', err.message);

    // For non-critical errors, keep running
    // For critical errors (e.g., EADDRINUSE), exit
    if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
      log(LOG_LEVELS.ERROR, 'Critical error - exiting', { code: err.code });
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    log(LOG_LEVELS.ERROR, 'Unhandled Promise Rejection', {
      reason: reason?.message || String(reason),
      stack: reason?.stack
    });
    trackError('unhandledRejection', reason?.message || String(reason));
  });

  // Log when process is running
  process.on('ready', () => {
    log(LOG_LEVELS.INFO, 'Process ready', {
      pid: process.pid,
      node: process.version,
      platform: process.platform
    });
  });
}

/**
 * Enhanced health check data
 * Returns detailed system status for monitoring
 */
export function getHealthStatus(additionalChecks = {}) {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    system: {
      uptime: Math.floor(uptime),
      uptimeHuman: formatUptime(uptime),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        unit: 'MB'
      },
      node: process.version,
      platform: process.platform
    },
    errors: getErrorStats(),
    ...additionalChecks
  };
}

/**
 * Format uptime in human-readable form
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Circuit breaker status monitoring
 */
export function getCircuitBreakerStatus(geocodingService) {
  if (!geocodingService) return null;

  const breaker = geocodingService.circuitBreaker;
  if (!breaker) return null;

  return {
    state: breaker.state,
    failures: breaker.failureCount,
    threshold: breaker.failureThreshold,
    timeout: breaker.timeout,
    halfOpenRetries: breaker.halfOpenRetries
  };
}

/**
 * Rate limiter status
 */
export function getRateLimiterStatus(geocodingService) {
  if (!geocodingService?.rateLimiter) return null;

  const limiter = geocodingService.rateLimiter;
  return {
    requests: limiter.requests?.length || 0,
    limit: limiter.limit,
    window: limiter.window,
    available: limiter.limit - (limiter.requests?.length || 0)
  };
}

export default {
  log,
  LOG_LEVELS,
  validateEnvironment,
  requestTimeout,
  trackError,
  getErrorStats,
  setupGracefulShutdown,
  setupErrorHandlers,
  getHealthStatus,
  getCircuitBreakerStatus,
  getRateLimiterStatus
};
