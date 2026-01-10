/**
 * CORS (Cross-Origin Resource Sharing) Middleware
 * Configures CORS policies for API access
 */

const cors = require('cors');

// Environment
const NODE_ENV = process.env.NODE_ENV || 'development';

// Allowed origins
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];

// Production origins (add your production domains)
if (NODE_ENV === 'production') {
  ALLOWED_ORIGINS.push(
    'https://zeroday.dev',
    'https://www.zeroday.dev',
    'https://api.zeroday.dev'
  );
}

/**
 * Check if origin is allowed
 * @param {String} origin - Request origin
 * @returns {Boolean} Whether origin is allowed
 */
const isOriginAllowed = (origin) => {
  // Allow requests with no origin (mobile apps, curl, etc.)
  if (!origin) return true;
  
  // Check whitelist
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }
  
  // In development, allow all localhost origins
  if (NODE_ENV === 'development' && origin.includes('localhost')) {
    return true;
  }
  
  // Check wildcard patterns
  for (const allowed of ALLOWED_ORIGINS) {
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(origin)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * CORS options
 */
const corsOptions = {
  /**
   * Dynamic origin validation
   */
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  /**
   * Allowed HTTP methods
   */
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  
  /**
   * Allowed headers
   */
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-Request-ID',
    'X-Request-Time',
    'Accept',
    'Origin'
  ],
  
  /**
   * Exposed headers (headers that client can access)
   */
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset'
  ],
  
  /**
   * Allow credentials (cookies, authorization headers)
   */
  credentials: true,
  
  /**
   * Preflight cache duration (in seconds)
   */
  maxAge: 86400, // 24 hours
  
  /**
   * Success status code for preflight requests
   */
  optionsSuccessStatus: 204,
  
  /**
   * Pass the CORS preflight response to the next handler
   */
  preflightContinue: false
};

/**
 * Strict CORS for production
 */
const strictCorsOptions = {
  origin: (origin, callback) => {
    // Only allow whitelisted origins in production
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚨 CORS: Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'RateLimit-Limit', 'RateLimit-Remaining'],
  credentials: true,
  maxAge: 3600, // 1 hour
  optionsSuccessStatus: 204,
  preflightContinue: false
};

/**
 * Permissive CORS for development
 */
const permissiveCorsOptions = {
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*',
  credentials: false,
  maxAge: 86400,
  optionsSuccessStatus: 204,
  preflightContinue: false
};

/**
 * Get CORS middleware based on environment
 */
const getCorsMiddleware = () => {
  if (NODE_ENV === 'production') {
    console.log('🔒 Using strict CORS policy for production');
    return cors(strictCorsOptions);
  } else if (NODE_ENV === 'test') {
    console.log('🧪 Using permissive CORS policy for testing');
    return cors(permissiveCorsOptions);
  } else {
    console.log('🔓 Using standard CORS policy for development');
    return cors(corsOptions);
  }
};

/**
 * Custom CORS middleware with logging
 */
const corsWithLogging = (req, res, next) => {
  const origin = req.headers.origin;
  
  // Log CORS requests
  if (origin) {
    const allowed = isOriginAllowed(origin);
    console.log(`🌐 CORS Request: ${origin} - ${allowed ? 'ALLOWED' : 'BLOCKED'}`);
  }
  
  // Apply CORS
  const middleware = getCorsMiddleware();
  middleware(req, res, next);
};

/**
 * Handle preflight requests manually
 */
const handlePreflight = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    
    if (isOriginAllowed(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-API-Key,X-Request-ID');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');
      return res.status(204).end();
    }
  }
  
  next();
};

/**
 * Add security headers
 */
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.header('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.header('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  if (NODE_ENV === 'production') {
    res.header('Content-Security-Policy', "default-src 'self'");
  }
  
  next();
};

/**
 * Get CORS configuration info
 */
const getCorsInfo = () => {
  return {
    environment: NODE_ENV,
    allowedOrigins: ALLOWED_ORIGINS,
    allowedMethods: corsOptions.methods,
    allowedHeaders: corsOptions.allowedHeaders,
    credentials: corsOptions.credentials
  };
};

module.exports = {
  corsMiddleware: getCorsMiddleware(),
  corsWithLogging,
  handlePreflight,
  securityHeaders,
  getCorsInfo,
  isOriginAllowed,
  corsOptions,
  strictCorsOptions,
  permissiveCorsOptions
};
