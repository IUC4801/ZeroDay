/**
 * Authentication and Authorization Middleware
 * API key validation and JWT authentication
 */

const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const API_KEYS = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];

/**
 * Validate API key from request
 * @param {Object} req - Express request
 * @returns {Boolean} Whether API key is valid
 */
const validateApiKey = (req) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return false;
  }
  
  // Check against stored API keys
  return API_KEYS.includes(apiKey);
};

/**
 * API Key authentication middleware
 * Requires valid API key in header or query
 */
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    throw new ApiError(401, 'API key is required. Provide it in X-API-Key header or apiKey query parameter.');
  }
  
  if (!validateApiKey(req)) {
    console.warn(`⚠️  Invalid API key attempt from ${req.ip}`);
    throw new ApiError(401, 'Invalid API key');
  }
  
  console.log(`✅ Valid API key from ${req.ip}`);
  next();
};

/**
 * Optional API Key middleware
 * Validates API key if present, but doesn't require it
 */
const optionalApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (apiKey) {
    req.hasValidApiKey = validateApiKey(req);
    
    if (!req.hasValidApiKey) {
      console.warn(`⚠️  Invalid API key provided from ${req.ip}`);
    }
  } else {
    req.hasValidApiKey = false;
  }
  
  next();
};

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @param {String} expiresIn - Expiration time
 * @returns {String} JWT token
 */
const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * Verify JWT token
 * @param {String} token - JWT token
 * @returns {Object} Decoded payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token expired');
    }
    throw new ApiError(401, 'Invalid token');
  }
};

/**
 * Extract token from request
 * @param {Object} req - Express request
 * @returns {String|null} Token or null
 */
const extractToken = (req) => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check query parameter
  if (req.query.token) {
    return req.query.token;
  }
  
  // Check cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
};

/**
 * JWT authentication middleware
 * Requires valid JWT token
 */
const requireAuth = (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      throw new ApiError(401, 'Authentication required. Provide token in Authorization header.');
    }
    
    const decoded = verifyToken(token);
    
    // Attach user to request
    req.user = decoded;
    req.userId = decoded.id || decoded.userId;
    
    console.log(`✅ Authenticated user: ${req.userId}`);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware
 * Validates token if present, but doesn't require it
 */
const optionalAuth = (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
      req.userId = decoded.id || decoded.userId;
      req.isAuthenticated = true;
    } else {
      req.isAuthenticated = false;
    }
    
    next();
  } catch (error) {
    // Don't fail on invalid token in optional auth
    req.isAuthenticated = false;
    next();
  }
};

/**
 * Role-based access control middleware
 * @param {Array<String>} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    
    const userRole = req.user.role;
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      console.warn(`⚠️  Unauthorized access attempt: User ${req.userId} with role ${userRole} tried to access ${req.path}`);
      throw new ApiError(403, 'Insufficient permissions. Required role: ' + allowedRoles.join(' or '));
    }
    
    console.log(`✅ Authorized: User ${req.userId} with role ${userRole}`);
    next();
  };
};

/**
 * Permission-based access control
 * @param {Array<String>} requiredPermissions - Array of required permissions
 * @returns {Function} Middleware function
 */
const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    
    const userPermissions = req.user.permissions || [];
    
    const hasPermission = requiredPermissions.every(perm => 
      userPermissions.includes(perm)
    );
    
    if (!hasPermission) {
      console.warn(`⚠️  Unauthorized access attempt: User ${req.userId} missing permissions: ${requiredPermissions.join(', ')}`);
      throw new ApiError(403, 'Insufficient permissions');
    }
    
    next();
  };
};

/**
 * Check if user owns resource
 * @param {Function} getResourceUserId - Function to extract resource owner ID from request
 * @returns {Function} Middleware function
 */
const requireOwnership = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication required');
      }
      
      // Allow admins to bypass ownership check
      if (req.user.role === 'admin') {
        return next();
      }
      
      const resourceUserId = await getResourceUserId(req);
      
      if (resourceUserId !== req.userId) {
        console.warn(`⚠️  Ownership violation: User ${req.userId} tried to access resource owned by ${resourceUserId}`);
        throw new ApiError(403, 'You do not have permission to access this resource');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Combine multiple auth strategies (OR logic)
 * @param {Array<Function>} strategies - Array of auth middleware
 * @returns {Function} Middleware function
 */
const anyAuth = (...strategies) => {
  return async (req, res, next) => {
    let lastError = null;
    
    for (const strategy of strategies) {
      try {
        await new Promise((resolve, reject) => {
          strategy(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        // If strategy succeeded, continue
        return next();
      } catch (error) {
        lastError = error;
        // Try next strategy
      }
    }
    
    // All strategies failed
    next(lastError || new ApiError(401, 'Authentication required'));
  };
};

/**
 * Check if request is from admin
 * @param {Object} req - Express request
 * @returns {Boolean} Whether user is admin
 */
const isAdmin = (req) => {
  return req.user && req.user.role === 'admin';
};

/**
 * Check if request is authenticated
 * @param {Object} req - Express request
 * @returns {Boolean} Whether user is authenticated
 */
const isAuthenticated = (req) => {
  return req.user !== undefined && req.user !== null;
};

/**
 * Get user info from request
 * @param {Object} req - Express request
 * @returns {Object|null} User info or null
 */
const getUserInfo = (req) => {
  return req.user || null;
};

module.exports = {
  validateApiKey,
  requireApiKey,
  optionalApiKey,
  generateToken,
  verifyToken,
  extractToken,
  requireAuth,
  optionalAuth,
  requireRole,
  requirePermission,
  requireOwnership,
  anyAuth,
  isAdmin,
  isAuthenticated,
  getUserInfo
};
