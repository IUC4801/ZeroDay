/**
 * Rate Limiting Middleware
 * Configurable rate limiters for different routes
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

// Redis client configuration
let redisClient = null;
const USE_REDIS = process.env.REDIS_URL && process.env.USE_REDIS === 'true';

if (USE_REDIS) {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });
    
    redisClient.on('connect', () => {
      console.log('✅ Redis: Connected for rate limiting');
    });
    
    redisClient.on('error', (err) => {
      console.error('❌ Redis Error:', err.message);
    });
    
    redisClient.connect();
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error.message);
    console.log('ℹ️  Falling back to in-memory rate limiting');
  }
}

/**
 * Create rate limiter with custom configuration
 * @param {Object} options - Rate limiter options
 * @returns {Function} Rate limiter middleware
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 100, // 100 requests per window
    message = 'Too many requests, please try again later',
    statusCode = 429,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = null,
    skip = null
  } = options;
  
  const config = {
    windowMs,
    max,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests,
    skipFailedRequests,
    
    // Custom message
    message: {
      success: false,
      error: message,
      statusCode,
      retryAfter: `${Math.ceil(windowMs / 1000)} seconds`
    },
    
    // Custom status code
    statusCode,
    
    // Key generator (defaults to IP)
    keyGenerator: keyGenerator || ((req) => {
      return req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0] || 
             req.connection.remoteAddress;
    }),
    
    // Skip function
    skip: skip || (() => false),
    
    // Handler when limit is exceeded
    handler: (req, res) => {
      console.warn(`⚠️  Rate limit exceeded: ${req.ip} - ${req.method} ${req.path}`);
      res.status(statusCode).json({
        success: false,
        error: message,
        statusCode,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  };
  
  // Use Redis store if available
  if (USE_REDIS && redisClient) {
    config.store = new RedisStore({
      client: redisClient,
      prefix: 'rl:', // Rate limit prefix
      sendCommand: (...args) => redisClient.sendCommand(args)
    });
  }
  
  return rateLimit(config);
};

/**
 * Preset rate limiters
 */

// General API rate limiter (100 requests per minute)
const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests. Please try again later.'
});

// Strict rate limiter (10 requests per minute)
const strictLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Rate limit exceeded. Please slow down.'
});

// Auth rate limiter (5 login attempts per 15 minutes)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts. Please try again later.',
  skipSuccessfulRequests: true // Only count failed attempts
});

// Search rate limiter (30 requests per minute)
const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many search requests. Please try again later.'
});

// Export rate limiter (10 requests per 5 minutes)
const exportLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many export requests. Maximum 10 per 5 minutes.'
});

// Sync rate limiter (1 request per 5 minutes)
const syncLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 1,
  message: 'Sync can only be triggered once every 5 minutes.',
  skipFailedRequests: false
});

// Upload rate limiter (20 requests per hour)
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many upload requests. Maximum 20 per hour.'
});

// API key based rate limiter (1000 requests per hour)
const apiKeyLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  message: 'API key rate limit exceeded.',
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  }
});

/**
 * Dynamic rate limiter based on user role
 * @param {Object} req - Express request
 * @returns {Number} Max requests allowed
 */
const dynamicRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: (req) => {
    // Higher limits for authenticated users
    if (req.user) {
      if (req.user.role === 'admin') {
        return 1000; // Admin: 1000 req/min
      }
      if (req.user.role === 'premium') {
        return 500; // Premium: 500 req/min
      }
      return 200; // Authenticated: 200 req/min
    }
    return 100; // Anonymous: 100 req/min
  },
  message: 'Rate limit exceeded for your account type.'
});

/**
 * Skip rate limiting for certain conditions
 * @param {Object} req - Express request
 * @returns {Boolean} Whether to skip rate limiting
 */
const skipRateLimiting = (req) => {
  // Skip for health checks
  if (req.path === '/health' || req.path === '/ping') {
    return true;
  }
  
  // Skip for admins
  if (req.user && req.user.role === 'admin') {
    return true;
  }
  
  // Skip for whitelisted IPs
  const whitelistedIPs = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
  if (whitelistedIPs.includes(req.ip)) {
    return true;
  }
  
  return false;
};

/**
 * Smart rate limiter with skip conditions
 */
const smartLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests. Please try again later.',
  skip: skipRateLimiting
});

/**
 * Get rate limit status
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getRateLimitStatus = (req, res) => {
  const remaining = res.getHeader('RateLimit-Remaining');
  const limit = res.getHeader('RateLimit-Limit');
  const reset = res.getHeader('RateLimit-Reset');
  
  res.json({
    success: true,
    data: {
      limit: limit ? parseInt(limit) : null,
      remaining: remaining ? parseInt(remaining) : null,
      reset: reset ? new Date(parseInt(reset) * 1000).toISOString() : null
    }
  });
};

/**
 * Close Redis connection on shutdown
 */
const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log('✅ Redis connection closed');
  }
};

module.exports = {
  createRateLimiter,
  generalLimiter,
  strictLimiter,
  authLimiter,
  searchLimiter,
  exportLimiter,
  syncLimiter,
  uploadLimiter,
  apiKeyLimiter,
  dynamicRateLimiter,
  smartLimiter,
  getRateLimitStatus,
  closeRedis
};
