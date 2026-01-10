/**
 * API Response Formatter
 * Standardized response formats for consistent API responses
 */

/**
 * Success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {String} message - Success message
 * @param {Number} statusCode - HTTP status code (default: 200)
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };

  return res.status(statusCode).json(response);
};

/**
 * Error response
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code (default: 500)
 * @param {Array|Object} errors - Detailed error information
 */
const errorResponse = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  // Only include errors field if errors are provided
  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Response data array
 * @param {Number} page - Current page number
 * @param {Number} limit - Items per page
 * @param {Number} total - Total number of items
 * @param {String} message - Success message
 */
const paginatedResponse = (res, data, page, limit, total, message = 'Success') => {
  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, total);

  const response = {
    success: true,
    message,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      totalPages,
      hasNext,
      hasPrev,
      showing: `${startIndex + 1}-${endIndex} of ${total}`
    },
    timestamp: new Date().toISOString()
  };

  return res.status(200).json(response);
};

/**
 * Not found response
 * @param {Object} res - Express response object
 * @param {String} resource - Resource name that was not found
 */
const notFoundResponse = (res, resource = 'Resource') => {
  const response = {
    success: false,
    message: `${resource} not found`,
    timestamp: new Date().toISOString()
  };

  return res.status(404).json(response);
};

/**
 * Validation error response
 * @param {Object} res - Express response object
 * @param {Array|Object} errors - Validation errors
 */
const validationErrorResponse = (res, errors) => {
  // Format errors array if needed
  let formattedErrors = errors;

  // If errors is an array of express-validator errors
  if (Array.isArray(errors) && errors.length > 0 && errors[0].msg) {
    formattedErrors = errors.map(err => ({
      field: err.param || err.path,
      message: err.msg,
      value: err.value
    }));
  }

  // If errors is an object (Mongoose validation errors)
  if (typeof errors === 'object' && !Array.isArray(errors) && errors.errors) {
    formattedErrors = Object.keys(errors.errors).map(key => ({
      field: key,
      message: errors.errors[key].message,
      value: errors.errors[key].value
    }));
  }

  const response = {
    success: false,
    message: 'Validation failed',
    errors: formattedErrors,
    timestamp: new Date().toISOString()
  };

  return res.status(400).json(response);
};

/**
 * Unauthorized response
 * @param {Object} res - Express response object
 * @param {String} message - Custom message
 */
const unauthorizedResponse = (res, message = 'Unauthorized access') => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  return res.status(401).json(response);
};

/**
 * Forbidden response
 * @param {Object} res - Express response object
 * @param {String} message - Custom message
 */
const forbiddenResponse = (res, message = 'Access forbidden') => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  return res.status(403).json(response);
};

/**
 * Rate limit response
 * @param {Object} res - Express response object
 * @param {String} message - Custom message
 * @param {Number} retryAfter - Seconds until rate limit resets
 */
const rateLimitResponse = (res, message = 'Too many requests', retryAfter = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  // Add retry-after information if provided
  if (retryAfter) {
    response.retryAfter = retryAfter;
    res.setHeader('Retry-After', retryAfter);
  }

  return res.status(429).json(response);
};

/**
 * Conflict response
 * @param {Object} res - Express response object
 * @param {String} message - Conflict message
 */
const conflictResponse = (res, message = 'Resource already exists') => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  return res.status(409).json(response);
};

/**
 * Created response
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {String} message - Success message
 */
const createdResponse = (res, data, message = 'Resource created successfully') => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };

  return res.status(201).json(response);
};

/**
 * No content response
 * @param {Object} res - Express response object
 */
const noContentResponse = (res) => {
  return res.status(204).send();
};

/**
 * Accepted response (for async operations)
 * @param {Object} res - Express response object
 * @param {*} data - Response data (e.g., job ID)
 * @param {String} message - Message about the accepted operation
 */
const acceptedResponse = (res, data = null, message = 'Request accepted for processing') => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };

  return res.status(202).json(response);
};

/**
 * Bad request response
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 */
const badRequestResponse = (res, message = 'Bad request') => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  return res.status(400).json(response);
};

/**
 * Service unavailable response
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 */
const serviceUnavailableResponse = (res, message = 'Service temporarily unavailable') => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  return res.status(503).json(response);
};

/**
 * Custom response
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {Boolean} success - Success flag
 * @param {String} message - Response message
 * @param {*} data - Response data
 * @param {Object} additional - Additional fields to include
 */
const customResponse = (res, statusCode, success, message, data = null, additional = {}) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString(),
    ...additional
  };

  // Only include data if provided
  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Stream response helper for SSE (Server-Sent Events)
 * @param {Object} res - Express response object
 * @param {String} event - Event name
 * @param {*} data - Data to send
 */
const sendSSEEvent = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

/**
 * Initialize SSE connection
 * @param {Object} res - Express response object
 */
const initSSE = (res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable nginx buffering
  });

  // Send initial comment to establish connection
  res.write(': connected\n\n');
};

/**
 * Export response helper
 * @param {Object} res - Express response object
 * @param {String} filename - Export filename
 * @param {String} contentType - MIME type
 * @param {*} data - Data to send
 */
const exportResponse = (res, filename, contentType, data) => {
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', contentType);
  return res.send(data);
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  notFoundResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  rateLimitResponse,
  conflictResponse,
  createdResponse,
  noContentResponse,
  acceptedResponse,
  badRequestResponse,
  serviceUnavailableResponse,
  customResponse,
  sendSSEEvent,
  initSSE,
  exportResponse
};
