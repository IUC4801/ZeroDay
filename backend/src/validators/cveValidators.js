/**
 * CVE Validators
 * Input validation schemas using express-validator
 */

const { query, param, body, validationResult } = require('express-validator');
const { validationErrorResponse } = require('../utils/responseFormatter');

/**
 * Validation error handler middleware
 * Collects validation errors and returns formatted response
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors.array());
  }
  
  next();
};

/**
 * Validate GET /api/cves query parameters
 */
const validateGetAllCVEs = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be an integer greater than or equal to 1')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100')
    .toInt(),
  
  query('severity')
    .optional()
    .isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
    .withMessage('Severity must be one of: CRITICAL, HIGH, MEDIUM, LOW')
    .toUpperCase(),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((endDate, { req }) => {
      if (req.query.startDate && endDate < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  query('exploitAvailable')
    .optional()
    .isBoolean()
    .withMessage('exploitAvailable must be a boolean')
    .toBoolean(),
  
  query('cisaKev')
    .optional()
    .isBoolean()
    .withMessage('cisaKev must be a boolean')
    .toBoolean(),
  
  query('vendor')
    .optional()
    .isString()
    .withMessage('Vendor must be a string')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Vendor name must not exceed 100 characters')
    .escape(),
  
  query('product')
    .optional()
    .isString()
    .withMessage('Product must be a string')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Product name must not exceed 100 characters')
    .escape(),
  
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must not exceed 200 characters')
    .escape(),
  
  query('sort')
    .optional()
    .isIn(['publishedDate', 'lastModifiedDate', 'cvssScore', 'epssScore', '-publishedDate', '-lastModifiedDate', '-cvssScore', '-epssScore'])
    .withMessage('Invalid sort field'),
  
  query('minCvssScore')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('minCvssScore must be a number between 0 and 10')
    .toFloat(),
  
  query('maxCvssScore')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('maxCvssScore must be a number between 0 and 10')
    .toFloat(),
  
  query('minEpssScore')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('minEpssScore must be a number between 0 and 1')
    .toFloat(),
  
  query('maxEpssScore')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('maxEpssScore must be a number between 0 and 1')
    .toFloat(),
  
  handleValidationErrors
];

/**
 * Validate CVE ID parameter
 */
const validateGetCVEById = [
  param('cveId')
    .matches(/^CVE-\d{4}-\d{4,}$/)
    .withMessage('CVE ID must match format: CVE-YYYY-NNNNN (e.g., CVE-2023-12345)'),
  
  handleValidationErrors
];

/**
 * Validate POST /api/cves/search request body
 */
const validateSearchCVEs = [
  body('query')
    .notEmpty()
    .withMessage('Search query is required')
    .isString()
    .withMessage('Query must be a string')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Query must be between 2 and 200 characters')
    .escape(),
  
  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object'),
  
  body('filters.severity')
    .optional()
    .isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
    .withMessage('Severity must be one of: CRITICAL, HIGH, MEDIUM, LOW'),
  
  body('filters.startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  
  body('filters.endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate(),
  
  body('filters.exploitAvailable')
    .optional()
    .isBoolean()
    .withMessage('exploitAvailable must be a boolean'),
  
  body('filters.cisaKev')
    .optional()
    .isBoolean()
    .withMessage('cisaKev must be a boolean'),
  
  body('filters.vendor')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Vendor name must not exceed 100 characters')
    .escape(),
  
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be an integer greater than or equal to 1')
    .toInt(),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100')
    .toInt(),
  
  handleValidationErrors
];

/**
 * Validate POST /api/cves/sync request body
 */
const validateSyncRequest = [
  body('dateRange')
    .optional()
    .isIn(['7d', '30d', '90d', 'all'])
    .withMessage('dateRange must be one of: 7d, 30d, 90d, all'),
  
  body('force')
    .optional()
    .isBoolean()
    .withMessage('Force must be a boolean')
    .toBoolean(),
  
  body('full')
    .optional()
    .isBoolean()
    .withMessage('Full must be a boolean')
    .toBoolean(),
  
  body('incremental')
    .optional()
    .isBoolean()
    .withMessage('Incremental must be a boolean')
    .toBoolean(),
  
  body('vendors')
    .optional()
    .isArray()
    .withMessage('Vendors must be an array'),
  
  body('vendors.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Each vendor name must not exceed 100 characters')
    .escape(),
  
  body('resume')
    .optional()
    .isBoolean()
    .withMessage('Resume must be a boolean')
    .toBoolean(),
  
  body('checkOSV')
    .optional()
    .isBoolean()
    .withMessage('checkOSV must be a boolean')
    .toBoolean(),
  
  handleValidationErrors
];

/**
 * Validate vendor parameter
 */
const validateVendorParam = [
  param('vendor')
    .notEmpty()
    .withMessage('Vendor parameter is required')
    .isString()
    .withMessage('Vendor must be a string')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Vendor name must be between 2 and 100 characters')
    .escape(),
  
  handleValidationErrors
];

/**
 * Validate GET /api/cves/stats query parameters
 */
const validateGetStats = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((endDate, { req }) => {
      if (req.query.startDate && endDate < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Validate GET /api/cves/trending query parameters
 */
const validateGetTrending = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100')
    .toInt(),
  
  query('days')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Days must be an integer between 1 and 90')
    .toInt(),
  
  handleValidationErrors
];

/**
 * Validate GET /api/cves/export query parameters
 */
const validateExportCVEs = [
  query('format')
    .optional()
    .isIn(['csv', 'json', 'excel'])
    .withMessage('Format must be one of: csv, json, excel'),
  
  query('severity')
    .optional()
    .isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
    .withMessage('Severity must be one of: CRITICAL, HIGH, MEDIUM, LOW'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate(),
  
  query('exploitAvailable')
    .optional()
    .isBoolean()
    .withMessage('exploitAvailable must be a boolean')
    .toBoolean(),
  
  query('cisaKev')
    .optional()
    .isBoolean()
    .withMessage('cisaKev must be a boolean')
    .toBoolean(),
  
  query('vendor')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Vendor name must not exceed 100 characters')
    .escape(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Limit must be an integer between 1 and 10000')
    .toInt(),
  
  handleValidationErrors
];

/**
 * Validate job name parameter for cron triggers
 */
const validateJobName = [
  param('jobName')
    .notEmpty()
    .withMessage('Job name is required')
    .isString()
    .withMessage('Job name must be a string')
    .trim()
    .isIn(['syncRecentCVEs', 'updateKEVCatalog', 'cleanupOldLogs', 'generateDailyReport', 'healthCheck'])
    .withMessage('Invalid job name'),
  
  handleValidationErrors
];

/**
 * Validate date range query parameters
 */
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date')
    .toDate(),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .toDate()
    .custom((endDate, { req }) => {
      if (req.query.startDate && endDate < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Validate pagination query parameters
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be an integer greater than or equal to 1')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100')
    .toInt(),
  
  handleValidationErrors
];

/**
 * Sanitize and validate common string inputs
 */
const sanitizeString = (field, location = 'body', options = {}) => {
  const { min = 1, max = 255, required = false } = options;
  
  const validator = location === 'query' ? query(field) : 
                    location === 'param' ? param(field) : 
                    body(field);
  
  let chain = validator;
  
  if (required) {
    chain = chain.notEmpty().withMessage(`${field} is required`);
  } else {
    chain = chain.optional();
  }
  
  return chain
    .isString()
    .withMessage(`${field} must be a string`)
    .trim()
    .isLength({ min, max })
    .withMessage(`${field} must be between ${min} and ${max} characters`)
    .escape();
};

module.exports = {
  validateGetAllCVEs,
  validateGetCVEById,
  validateSearchCVEs,
  validateSyncRequest,
  validateVendorParam,
  validateGetStats,
  validateGetTrending,
  validateExportCVEs,
  validateJobName,
  validateDateRange,
  validatePagination,
  sanitizeString,
  handleValidationErrors
};
