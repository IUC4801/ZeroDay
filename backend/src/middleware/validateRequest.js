/**
 * Request Validation and Sanitization Middleware
 */

const validator = require('validator');

/**
 * Sanitize string input
 * @param {String} str - Input string
 * @returns {String} Sanitized string
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  // Trim whitespace
  str = str.trim();
  
  // Escape HTML to prevent XSS
  str = validator.escape(str);
  
  return str;
};

/**
 * Validate and sanitize query parameters
 * @param {Object} schema - Validation schema
 * @returns {Function} Middleware function
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const [key, rules] of Object.entries(schema)) {
      const value = req.query[key];
      
      // Check required
      if (rules.required && !value) {
        errors.push(`${key} is required`);
        continue;
      }
      
      // Skip validation if not required and not present
      if (!value && !rules.required) continue;
      
      // Type validation
      if (rules.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${key} must be a number`);
          continue;
        }
        
        // Min/Max validation
        if (rules.min !== undefined && num < rules.min) {
          errors.push(`${key} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && num > rules.max) {
          errors.push(`${key} must be at most ${rules.max}`);
        }
        
        req.query[key] = num;
      }
      
      if (rules.type === 'boolean') {
        if (!['true', 'false', '1', '0'].includes(value)) {
          errors.push(`${key} must be a boolean`);
          continue;
        }
        req.query[key] = value === 'true' || value === '1';
      }
      
      if (rules.type === 'string') {
        req.query[key] = sanitizeString(value);
        
        // Length validation
        if (rules.minLength && req.query[key].length < rules.minLength) {
          errors.push(`${key} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && req.query[key].length > rules.maxLength) {
          errors.push(`${key} must be at most ${rules.maxLength} characters`);
        }
        
        // Pattern validation
        if (rules.pattern && !rules.pattern.test(req.query[key])) {
          errors.push(`${key} format is invalid`);
        }
      }
      
      if (rules.type === 'date') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          errors.push(`${key} must be a valid date`);
        } else {
          req.query[key] = date;
        }
      }
      
      if (rules.type === 'email') {
        if (!validator.isEmail(value)) {
          errors.push(`${key} must be a valid email`);
        } else {
          req.query[key] = validator.normalizeEmail(value);
        }
      }
      
      if (rules.type === 'url') {
        if (!validator.isURL(value)) {
          errors.push(`${key} must be a valid URL`);
        }
      }
      
      // Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }
    
    next();
  };
};

/**
 * Validate and sanitize request body
 * @param {Object} schema - Validation schema
 * @returns {Function} Middleware function
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    // Check if body exists
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Request body is required'
      });
    }
    
    for (const [key, rules] of Object.entries(schema)) {
      const value = req.body[key];
      
      // Check required
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${key} is required`);
        continue;
      }
      
      // Skip validation if not required and not present
      if ((value === undefined || value === null) && !rules.required) continue;
      
      // Type validation
      if (rules.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`${key} must be a string`);
          continue;
        }
        
        req.body[key] = sanitizeString(value);
        
        // Length validation
        if (rules.minLength && req.body[key].length < rules.minLength) {
          errors.push(`${key} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && req.body[key].length > rules.maxLength) {
          errors.push(`${key} must be at most ${rules.maxLength} characters`);
        }
        
        // Pattern validation
        if (rules.pattern && !rules.pattern.test(req.body[key])) {
          errors.push(`${key} format is invalid`);
        }
      }
      
      if (rules.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${key} must be a number`);
          continue;
        }
        
        // Min/Max validation
        if (rules.min !== undefined && num < rules.min) {
          errors.push(`${key} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && num > rules.max) {
          errors.push(`${key} must be at most ${rules.max}`);
        }
        
        req.body[key] = num;
      }
      
      if (rules.type === 'boolean') {
        if (typeof value !== 'boolean') {
          errors.push(`${key} must be a boolean`);
        }
      }
      
      if (rules.type === 'array') {
        if (!Array.isArray(value)) {
          errors.push(`${key} must be an array`);
          continue;
        }
        
        // Array length validation
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${key} must have at least ${rules.minLength} items`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${key} must have at most ${rules.maxLength} items`);
        }
        
        // Validate array items
        if (rules.items) {
          req.body[key] = value.map((item, index) => {
            if (rules.items.type === 'string') {
              return sanitizeString(item);
            }
            return item;
          });
        }
      }
      
      if (rules.type === 'object') {
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`${key} must be an object`);
        }
      }
      
      if (rules.type === 'email') {
        if (!validator.isEmail(value)) {
          errors.push(`${key} must be a valid email`);
        } else {
          req.body[key] = validator.normalizeEmail(value);
        }
      }
      
      if (rules.type === 'url') {
        if (!validator.isURL(value)) {
          errors.push(`${key} must be a valid URL`);
        }
      }
      
      // Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
      }
      
      // Custom validation
      if (rules.custom && typeof rules.custom === 'function') {
        const customError = rules.custom(value);
        if (customError) {
          errors.push(customError);
        }
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }
    
    next();
  };
};

/**
 * Validate route parameters
 * @param {Object} schema - Validation schema
 * @returns {Function} Middleware function
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const [key, rules] of Object.entries(schema)) {
      const value = req.params[key];
      
      if (rules.required && !value) {
        errors.push(`${key} parameter is required`);
        continue;
      }
      
      if (!value) continue;
      
      // Pattern validation
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${key} format is invalid`);
      }
      
      // Sanitize
      if (rules.type === 'string') {
        req.params[key] = sanitizeString(value);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors
      });
    }
    
    next();
  };
};

/**
 * Sanitize all request inputs
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const sanitizeInputs = (req, res, next) => {
  // Sanitize query params
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        req.query[key] = sanitizeString(value);
      }
    }
  }
  
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = sanitizeString(value);
      }
    }
  }
  
  // Sanitize params
  if (req.params) {
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === 'string') {
        req.params[key] = sanitizeString(value);
      }
    }
  }
  
  next();
};

/**
 * Common validation schemas
 */
const commonSchemas = {
  pagination: {
    page: {
      type: 'number',
      min: 1,
      required: false
    },
    limit: {
      type: 'number',
      min: 1,
      max: 1000,
      required: false
    }
  },
  
  dateRange: {
    startDate: {
      type: 'date',
      required: false
    },
    endDate: {
      type: 'date',
      required: false
    }
  },
  
  cveId: {
    cveId: {
      type: 'string',
      pattern: /^CVE-\d{4}-\d+$/i,
      required: true
    }
  }
};

module.exports = {
  validateQuery,
  validateBody,
  validateParams,
  sanitizeInputs,
  sanitizeString,
  commonSchemas
};
