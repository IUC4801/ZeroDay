/**
 * Request Logger Middleware
 * Structured logging for all HTTP requests
 */

const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

// Log levels
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace'
};

// Current log level from environment
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_TO_FILE = process.env.LOG_TO_FILE === 'true';
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');

// Ensure log directory exists
if (LOG_TO_FILE) {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Get log file path
 * @param {String} level - Log level
 * @returns {String} Log file path
 */
const getLogFilePath = (level) => {
  const date = format(new Date(), 'yyyy-MM-dd');
  return path.join(LOG_DIR, `${level}-${date}.log`);
};

/**
 * Write log to file
 * @param {String} level - Log level
 * @param {Object} logData - Log data
 */
const writeToFile = (level, logData) => {
  if (!LOG_TO_FILE) return;
  
  try {
    const logFile = getLogFilePath(level);
    const logLine = JSON.stringify(logData) + '\n';
    fs.appendFileSync(logFile, logLine);
  } catch (error) {
    console.error('Failed to write log to file:', error.message);
  }
};

/**
 * Check if log level should be logged
 * @param {String} level - Log level to check
 * @returns {Boolean} Whether to log
 */
const shouldLog = (level) => {
  const levels = Object.values(LOG_LEVELS);
  const currentIndex = levels.indexOf(CURRENT_LOG_LEVEL);
  const requestedIndex = levels.indexOf(level);
  
  return requestedIndex <= currentIndex;
};

/**
 * Format log data
 * @param {Object} data - Raw log data
 * @returns {Object} Formatted log data
 */
const formatLogData = (data) => {
  return {
    timestamp: new Date().toISOString(),
    level: data.level || LOG_LEVELS.INFO,
    ...data
  };
};

/**
 * Get emoji for log level
 * @param {String} level - Log level
 * @returns {String} Emoji
 */
const getLevelEmoji = (level) => {
  const emojis = {
    error: '🚨',
    warn: '⚠️',
    info: 'ℹ️',
    debug: '🐛',
    trace: '🔍'
  };
  return emojis[level] || 'ℹ️';
};

/**
 * Get colored log level
 * @param {String} level - Log level
 * @returns {String} Colored level string
 */
const getColoredLevel = (level) => {
  const colors = {
    error: '\x1b[31m', // Red
    warn: '\x1b[33m',  // Yellow
    info: '\x1b[36m',  // Cyan
    debug: '\x1b[35m', // Magenta
    trace: '\x1b[90m'  // Gray
  };
  const reset = '\x1b[0m';
  const color = colors[level] || '';
  return `${color}${level.toUpperCase()}${reset}`;
};

/**
 * Console log with formatting
 * @param {String} level - Log level
 * @param {Object} logData - Log data
 */
const consoleLog = (level, logData) => {
  const emoji = getLevelEmoji(level);
  const coloredLevel = getColoredLevel(level);
  
  console.log(`${emoji} [${logData.timestamp}] ${coloredLevel}:`, JSON.stringify(logData, null, 2));
};

/**
 * Main logger function
 * @param {String} level - Log level
 * @param {Object} data - Log data
 */
const log = (level, data) => {
  if (!shouldLog(level)) return;
  
  const logData = formatLogData({ level, ...data });
  
  // Console log
  consoleLog(level, logData);
  
  // File log
  writeToFile(level, logData);
};

/**
 * Request logger middleware
 * Logs all incoming requests and responses
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Generate request ID
  req.id = req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Log request
  const requestLog = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'] || null,
    userId: req.user?.id || null
  };
  
  log(LOG_LEVELS.INFO, {
    type: 'request',
    ...requestLog
  });
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Determine log level based on status code
    let level = LOG_LEVELS.INFO;
    if (statusCode >= 500) {
      level = LOG_LEVELS.ERROR;
    } else if (statusCode >= 400) {
      level = LOG_LEVELS.WARN;
    }
    
    // Log response
    const responseLog = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      duration: `${duration}ms`,
      contentLength: res.getHeader('content-length'),
      userId: req.user?.id || null
    };
    
    log(level, {
      type: 'response',
      ...responseLog
    });
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Error logger middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const errorLogger = (err, req, res, next) => {
  log(LOG_LEVELS.ERROR, {
    type: 'error',
    requestId: req.id,
    method: req.method,
    url: req.originalUrl || req.url,
    error: {
      message: err.message,
      name: err.name,
      stack: err.stack,
      statusCode: err.statusCode || 500
    },
    userId: req.user?.id || null,
    ip: req.ip
  });
  
  next(err);
};

/**
 * Custom logger functions
 */
const logger = {
  error: (message, meta = {}) => {
    log(LOG_LEVELS.ERROR, { message, ...meta });
  },
  
  warn: (message, meta = {}) => {
    log(LOG_LEVELS.WARN, { message, ...meta });
  },
  
  info: (message, meta = {}) => {
    log(LOG_LEVELS.INFO, { message, ...meta });
  },
  
  debug: (message, meta = {}) => {
    log(LOG_LEVELS.DEBUG, { message, ...meta });
  },
  
  trace: (message, meta = {}) => {
    log(LOG_LEVELS.TRACE, { message, ...meta });
  },
  
  /**
   * Log database query
   */
  query: (query, duration, meta = {}) => {
    log(LOG_LEVELS.DEBUG, {
      type: 'database',
      query,
      duration: `${duration}ms`,
      ...meta
    });
  },
  
  /**
   * Log API call
   */
  apiCall: (service, endpoint, duration, meta = {}) => {
    log(LOG_LEVELS.DEBUG, {
      type: 'api-call',
      service,
      endpoint,
      duration: `${duration}ms`,
      ...meta
    });
  },
  
  /**
   * Log security event
   */
  security: (event, meta = {}) => {
    log(LOG_LEVELS.WARN, {
      type: 'security',
      event,
      ...meta
    });
  },
  
  /**
   * Log performance metric
   */
  performance: (metric, value, meta = {}) => {
    log(LOG_LEVELS.INFO, {
      type: 'performance',
      metric,
      value,
      ...meta
    });
  }
};

/**
 * Clean old log files (older than 30 days)
 */
const cleanOldLogs = () => {
  if (!LOG_TO_FILE) return;
  
  try {
    const files = fs.readdirSync(LOG_DIR);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    files.forEach(file => {
      const filePath = path.join(LOG_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Deleted old log file: ${file}`);
      }
    });
  } catch (error) {
    console.error('Failed to clean old logs:', error.message);
  }
};

// Clean logs on startup
if (LOG_TO_FILE) {
  cleanOldLogs();
}

module.exports = {
  requestLogger,
  errorLogger,
  logger,
  LOG_LEVELS,
  cleanOldLogs
};
