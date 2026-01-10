/**
 * Winston Logger Configuration
 * Comprehensive logging system with console and file transports
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  console.log(`✅ Created logs directory: ${LOG_DIR}`);
}

// Define log levels and colors
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  http: 'magenta',
  debug: 'green'
};

// Tell winston about our colors
winston.addColors(colors);

// Custom format for console output (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    // Format message
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      // Remove internal winston properties
      delete meta.level;
      delete meta.timestamp;
      
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta, null, 2)}`;
      }
    }
    
    return log;
  })
);

// Custom format for file output (JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Custom format for production (structured JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console transport (for development)
const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
  handleExceptions: true,
  handleRejections: true
});

// File transport for errors only
const errorFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  format: fileFormat,
  maxSize: '20m',
  maxFiles: '30d',
  handleExceptions: true,
  handleRejections: true
});

// File transport for all logs
const combinedFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  format: fileFormat,
  maxSize: '20m',
  maxFiles: '30d'
});

// File transport for HTTP requests
const httpFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'http',
  format: fileFormat,
  maxSize: '20m',
  maxFiles: '14d' // Keep HTTP logs for 2 weeks
});

// Build transports array based on environment
const transports = [];

if (NODE_ENV === 'development') {
  // Development: console + files
  transports.push(consoleTransport);
  transports.push(errorFileTransport);
  transports.push(combinedFileTransport);
  transports.push(httpFileTransport);
} else if (NODE_ENV === 'production') {
  // Production: files only (no console noise)
  transports.push(errorFileTransport);
  transports.push(combinedFileTransport);
  transports.push(httpFileTransport);
} else {
  // Test: console only
  transports.push(consoleTransport);
}

// Create the logger
const logger = winston.createLogger({
  level: LOG_LEVEL,
  levels,
  format: NODE_ENV === 'production' ? productionFormat : fileFormat,
  transports,
  exitOnError: false
});

// Create a stream object for Morgan HTTP logger
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

/**
 * Log HTTP request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Number} responseTime - Response time in milliseconds
 */
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    type: 'http-request',
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id || req.userId || null,
    requestId: req.id || req.headers['x-request-id'] || null
  };
  
  // Log at appropriate level based on status code
  if (res.statusCode >= 500) {
    logger.error('HTTP Request', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('HTTP Request', logData);
  } else {
    logger.http('HTTP Request', logData);
  }
};

/**
 * Log error with full context
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
logger.logError = (error, context = {}) => {
  const errorData = {
    type: 'error',
    message: error.message,
    name: error.name,
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode,
    ...context
  };
  
  logger.error('Application Error', errorData);
};

/**
 * Log database query
 * @param {String} query - Query string or operation
 * @param {Number} duration - Query duration in milliseconds
 * @param {Object} meta - Additional metadata
 */
logger.logQuery = (query, duration, meta = {}) => {
  const logData = {
    type: 'database-query',
    query: typeof query === 'string' ? query.substring(0, 200) : query,
    duration: `${duration}ms`,
    ...meta
  };
  
  // Warn on slow queries (>1 second)
  if (duration > 1000) {
    logger.warn('Slow Database Query', logData);
  } else {
    logger.debug('Database Query', logData);
  }
};

/**
 * Log external API call
 * @param {String} service - Service name (NVD, EPSS, etc.)
 * @param {String} endpoint - API endpoint
 * @param {Number} duration - Request duration in milliseconds
 * @param {Object} meta - Additional metadata
 */
logger.logApiCall = (service, endpoint, duration, meta = {}) => {
  const logData = {
    type: 'api-call',
    service,
    endpoint,
    duration: `${duration}ms`,
    ...meta
  };
  
  // Warn on slow API calls (>5 seconds)
  if (duration > 5000) {
    logger.warn('Slow API Call', logData);
  } else {
    logger.debug('API Call', logData);
  }
};

/**
 * Log performance metric
 * @param {String} operation - Operation name
 * @param {Number} duration - Duration in milliseconds
 * @param {Object} meta - Additional metadata
 */
logger.logPerformance = (operation, duration, meta = {}) => {
  const logData = {
    type: 'performance',
    operation,
    duration: `${duration}ms`,
    ...meta
  };
  
  // Warn on slow operations (>1 second)
  if (duration > 1000) {
    logger.warn('Slow Operation', logData);
  } else {
    logger.info('Performance Metric', logData);
  }
};

/**
 * Log security event
 * @param {String} event - Security event description
 * @param {Object} meta - Additional metadata
 */
logger.logSecurity = (event, meta = {}) => {
  logger.warn('Security Event', {
    type: 'security',
    event,
    timestamp: new Date().toISOString(),
    ...meta
  });
};

/**
 * Log cron job execution
 * @param {String} jobName - Job name
 * @param {String} status - Job status (started, completed, failed)
 * @param {Object} meta - Additional metadata
 */
logger.logCronJob = (jobName, status, meta = {}) => {
  const logData = {
    type: 'cron-job',
    job: jobName,
    status,
    ...meta
  };
  
  if (status === 'failed') {
    logger.error('Cron Job', logData);
  } else if (status === 'completed') {
    logger.info('Cron Job', logData);
  } else {
    logger.debug('Cron Job', logData);
  }
};

/**
 * Log authentication event
 * @param {String} event - Auth event (login, logout, token-refresh, etc.)
 * @param {Object} meta - Additional metadata
 */
logger.logAuth = (event, meta = {}) => {
  logger.info('Authentication', {
    type: 'authentication',
    event,
    ...meta
  });
};

/**
 * Log cache operation
 * @param {String} operation - Operation (hit, miss, set, delete)
 * @param {String} key - Cache key
 * @param {Object} meta - Additional metadata
 */
logger.logCache = (operation, key, meta = {}) => {
  logger.debug('Cache Operation', {
    type: 'cache',
    operation,
    key,
    ...meta
  });
};

/**
 * Create child logger with default metadata
 * @param {Object} defaultMeta - Default metadata to include in all logs
 * @returns {Object} Child logger instance
 */
logger.child = (defaultMeta) => {
  return logger.child(defaultMeta);
};

/**
 * Measure execution time of async function
 * @param {Function} fn - Async function to measure
 * @param {String} label - Label for the operation
 * @returns {Promise} Result of the function
 */
logger.measureTime = async (fn, label) => {
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    logger.logPerformance(label, duration, { success: true });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.logPerformance(label, duration, { success: false, error: error.message });
    
    throw error;
  }
};

/**
 * Get logger configuration info
 * @returns {Object} Logger configuration
 */
logger.getConfig = () => {
  return {
    level: LOG_LEVEL,
    environment: NODE_ENV,
    logDir: LOG_DIR,
    transports: transports.map(t => ({
      type: t.constructor.name,
      level: t.level || 'all'
    }))
  };
};

// Log initialization
logger.info('Logger initialized', logger.getConfig());

// Handle transport errors
errorFileTransport.on('error', (error) => {
  console.error('Error file transport error:', error);
});

combinedFileTransport.on('error', (error) => {
  console.error('Combined file transport error:', error);
});

httpFileTransport.on('error', (error) => {
  console.error('HTTP file transport error:', error);
});

// Log rotation events
errorFileTransport.on('rotate', (oldFilename, newFilename) => {
  logger.debug('Error log rotated', { oldFilename, newFilename });
});

combinedFileTransport.on('rotate', (oldFilename, newFilename) => {
  logger.debug('Combined log rotated', { oldFilename, newFilename });
});

// Export logger
module.exports = logger;
