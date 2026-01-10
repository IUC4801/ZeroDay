/**
 * Rate Limiter Configuration
 * Multiple rate limiters for different endpoints
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { rateLimitResponse } = require('../utils/responseFormatter');

// Environment
const NODE_ENV = process.env.NODE_ENV || 'development';

// Redis store (optional, for production)
let RedisStore = null;
let redisClient = null;

/**
 * Initialize Redis store for rate limiting
 */
const initRedisStore = async () => {
  if (process.env.USE_REDIS_RATE_LIMIT === 'true') {
    try {
      const { default: RedisStoreImport } = require('rate-limit-redis');
      const redis = require('redis');
      
      RedisStore = RedisStoreImport;
      
      redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        password: process.env.REDIS_PASSWORD,
        database: parseInt(process.env.REDIS_DB) || 0
      });

      await redisClient.connect();
      logger.info('Redis rate limit store initialized');
    } catch (error) {
      logger.warn('Redis rate limit store initialization failed, using memory store', { error: error.message });
      RedisStore = null;
      redisClient = null;
    }
  }
};

/**
 * Get store configuration
 * @returns {Object|undefined} Store configuration
 */
const getStore = () => {
  if (RedisStore && redisClient) {
    return new RedisStore({
      client: redisClient,
      prefix: 'rate-limit:'
    });
  }
  // Use default memory store if Redis not available
  return undefined;
};

/**
 * Custom key generator
 * Combines IP address with user ID if authenticated
 * @param {Object} req - Express request object
 * @returns {String} Rate limit key
 */
const customKeyGenerator = (req) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userId = req.user?.id || req.userId || '';
  
  return userId ? `${ip}:${userId}` : ip;
};

/**
 * Skip function for whitelisted IPs and endpoints
 * @param {Object} req - Express request object
 * @returns {Boolean} Whether to skip rate limiting
 */
const skipRateLimiting = (req) => {
  // Skip for health check endpoints
  const healthCheckPaths = ['/api/health', '/api/health/live', '/api/health/ready'];
  if (healthCheckPaths.includes(req.path)) {
    return true;
  }

  // Skip for localhost in development
  if (NODE_ENV === 'development') {
    const ip = req.ip || req.connection.remoteAddress;
    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
      return true;
    }
  }

  // Skip for whitelisted IPs
  const whitelist = (process.env.RATE_LIMIT_WHITELIST || '').split(',').filter(Boolean);
  if (whitelist.length > 0) {
    const ip = req.ip || req.connection.remoteAddress;
    if (whitelist.includes(ip)) {
      return true;
    }
  }

  // Skip for admin users (if authenticated)
  if (req.user?.role === 'admin') {
    return true;
  }

  return false;
};

/**
 * Custom rate limit handler
 * Returns consistent error response format
 */
const rateLimitHandler = (req, res) => {
  const retryAfter = Math.ceil(req.rateLimit.resetTime / 1000 - Date.now() / 1000);
  
  logger.logSecurity('Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    limit: req.rateLimit.limit,
    remaining: req.rateLimit.remaining,
    resetTime: new Date(req.rateLimit.resetTime).toISOString()
  });

  return rateLimitResponse(
    res,
    'Too many requests from this IP, please try again later',
    retryAfter
  );
};

/**
 * On limit reached callback
 * Logs when rate limit is hit
 */
const onLimitReached = (req, res, options) => {
  logger.warn('Rate limit reached', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    limit: options.max,
    window: options.windowMs
  });
};

/**
 * General rate limiter
 * 100 requests per 15 minutes
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_GENERAL) || 100,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: rateLimitHandler,
  skip: skipRateLimiting,
  keyGenerator: customKeyGenerator,
  store: getStore(),
  onLimitReached
});

/**
 * Search rate limiter
 * 30 requests per minute
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_SEARCH) || 30,
  message: 'Too many search requests, please try again after a minute',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimiting,
  keyGenerator: customKeyGenerator,
  store: getStore(),
  onLimitReached
});

/**
 * Sync rate limiter
 * 1 request per 5 minutes
 */
const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: parseInt(process.env.RATE_LIMIT_SYNC) || 1,
  message: 'Sync operation in progress or recently completed, please wait 5 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimiting,
  keyGenerator: customKeyGenerator,
  store: getStore(),
  skipSuccessfulRequests: false, // Count even if sync fails
  skipFailedRequests: false,
  onLimitReached
});

/**
 * Export rate limiter
 * 10 requests per hour
 */
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_EXPORT) || 10,
  message: 'Too many export requests, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimiting,
  keyGenerator: customKeyGenerator,
  store: getStore(),
  onLimitReached
});

/**
 * Strict rate limiter
 * 10 requests per 15 minutes
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_STRICT) || 10,
  message: 'Too many requests, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimiting,
  keyGenerator: customKeyGenerator,
  store: getStore(),
  onLimitReached
});

/**
 * Authentication rate limiter
 * 5 requests per 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_AUTH) || 5,
  message: 'Too many authentication attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Don't count successful auth
  skipFailedRequests: false, // Count failed attempts
  keyGenerator: customKeyGenerator,
  store: getStore(),
  onLimitReached: (req, res, options) => {
    logger.logSecurity('Auth rate limit reached', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
  }
});

/**
 * API key rate limiter (higher limits for API key users)
 * 1000 requests per hour
 */
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_API_KEY) || 1000,
  message: 'API key rate limit exceeded, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => {
    // Skip if no API key present
    if (!req.headers['x-api-key'] && !req.query.apiKey) {
      return true;
    }
    return skipRateLimiting(req);
  },
  keyGenerator: (req) => {
    // Use API key as identifier
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    return `api-key:${apiKey}`;
  },
  store: getStore(),
  onLimitReached
});

/**
 * Dynamic rate limiter based on user role
 * @param {Object} limits - Limits per role { admin: 1000, premium: 500, user: 100 }
 * @returns {Function} Rate limit middleware
 */
const dynamicRateLimiter = (limits = { admin: 1000, premium: 500, user: 100 }) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      const role = req.user?.role || 'user';
      return limits[role] || limits.user;
    },
    message: 'Rate limit exceeded for your account tier',
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: skipRateLimiting,
    keyGenerator: customKeyGenerator,
    store: getStore(),
    onLimitReached
  });
};

/**
 * Create custom rate limiter
 * @param {Object} options - Rate limiter options
 * @returns {Function} Rate limit middleware
 */
const createRateLimiter = (options = {}) => {
  const defaults = {
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: skipRateLimiting,
    keyGenerator: customKeyGenerator,
    store: getStore(),
    onLimitReached
  };

  return rateLimit({ ...defaults, ...options });
};

/**
 * Get rate limit info for a request
 * @param {Object} req - Express request object
 * @returns {Object} Rate limit information
 */
const getRateLimitInfo = (req) => {
  if (!req.rateLimit) {
    return null;
  }

  return {
    limit: req.rateLimit.limit,
    remaining: req.rateLimit.remaining,
    resetTime: new Date(req.rateLimit.resetTime).toISOString(),
    used: req.rateLimit.used
  };
};

/**
 * Close Redis connection gracefully
 */
const close = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Rate limit Redis client closed');
  }
};

module.exports = {
  // Pre-configured limiters
  generalLimiter,
  searchLimiter,
  syncLimiter,
  exportLimiter,
  strictLimiter,
  authLimiter,
  apiKeyLimiter,
  
  // Dynamic/custom limiters
  dynamicRateLimiter,
  createRateLimiter,
  
  // Utilities
  getRateLimitInfo,
  customKeyGenerator,
  skipRateLimiting,
  
  // Initialization
  initRedisStore,
  close
};
