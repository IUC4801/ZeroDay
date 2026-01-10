/**
 * Global Error Handler Middleware
 * Handles all errors thrown in the application
 */

const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Format error response
 * @param {Error} err - Error object
 * @param {Boolean} isDevelopment - Is development environment
 * @returns {Object} Formatted error response
 */
const formatErrorResponse = (err, isDevelopment) => {
  const response = {
    success: false,
    error: err.message || 'Internal server error',
    statusCode: err.statusCode || 500
  };
  
  // Add error type
  if (err.name) {
    response.type = err.name;
  }
  
  // Add validation errors if present
  if (err.errors) {
    response.errors = err.errors;
  }
  
  // Add stack trace in development
  if (isDevelopment) {
    response.stack = err.stack;
    response.raw = err.toString();
  }
  
  return response;
};

/**
 * Log error with appropriate level
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 */
const logError = (err, req) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const ip = req.ip || req.connection.remoteAddress;
  
  // Log structured error
  const errorLog = {
    timestamp,
    level: err.statusCode >= 500 ? 'error' : 'warn',
    method,
    url,
    ip,
    statusCode: err.statusCode || 500,
    message: err.message,
    type: err.name,
    userId: req.user?.id || null,
    requestId: req.id || null
  };
  
  // Console log with formatting
  if (err.statusCode >= 500) {
    console.error('🚨 Server Error:', JSON.stringify(errorLog, null, 2));
    
    // Log stack trace for server errors
    if (err.stack) {
      console.error('Stack Trace:', err.stack);
    }
  } else {
    console.warn('⚠️  Client Error:', JSON.stringify(errorLog, null, 2));
  }
};

/**
 * Handle specific error types
 * @param {Error} err - Error object
 * @returns {Error} Processed error
 */
const handleSpecificErrors = (err) => {
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return new ApiError(400, 'Validation failed', true, err.stack);
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return new ApiError(409, `Duplicate value for field: ${field}`, true, err.stack);
  }
  
  // Mongoose cast error
  if (err.name === 'CastError') {
    return new ApiError(400, `Invalid ${err.path}: ${err.value}`, true, err.stack);
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return new ApiError(401, 'Invalid token', true, err.stack);
  }
  
  if (err.name === 'TokenExpiredError') {
    return new ApiError(401, 'Token expired', true, err.stack);
  }
  
  // Express validator errors
  if (err.array) {
    const errors = err.array().map(e => e.msg);
    return new ApiError(400, 'Validation failed', true, err.stack);
  }
  
  return err;
};

/**
 * Main error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Handle specific error types
  let processedError = handleSpecificErrors(err);
  
  // Ensure error has statusCode
  if (!processedError.statusCode) {
    processedError = new ApiError(500, processedError.message, false, processedError.stack);
  }
  
  // Log error
  logError(processedError, req);
  
  // Determine if development
  const isDevelopment = NODE_ENV === 'development';
  
  // Format response
  const errorResponse = formatErrorResponse(processedError, isDevelopment);
  
  // Send response
  res.status(processedError.statusCode).json(errorResponse);
};

/**
 * Handle 404 errors (route not found)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`);
  next(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 * @param {Function} fn - Async function
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Development error handler (verbose)
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
const developmentErrorHandler = (err, req, res, next) => {
  console.error('🐛 Development Error Handler:');
  console.error('Message:', err.message);
  console.error('Status:', err.statusCode || 500);
  console.error('Stack:', err.stack);
  
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message,
    statusCode: err.statusCode || 500,
    type: err.name,
    stack: err.stack,
    request: {
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      body: req.body,
      params: req.params
    }
  });
};

/**
 * Production error handler (minimal info)
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
const productionErrorHandler = (err, req, res, next) => {
  // Log error internally
  console.error('❌ Production Error:', {
    message: err.message,
    statusCode: err.statusCode,
    url: req.originalUrl
  });
  
  // Send minimal info to client
  const statusCode = err.statusCode || 500;
  const message = err.isOperational 
    ? err.message 
    : 'Something went wrong. Please try again later.';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    statusCode
  });
};

/**
 * Get appropriate error handler based on environment
 */
const getErrorHandler = () => {
  return NODE_ENV === 'production' ? productionErrorHandler : developmentErrorHandler;
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  developmentErrorHandler,
  productionErrorHandler,
  getErrorHandler,
  ApiError
};
