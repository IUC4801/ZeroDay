const express = require('express');
const rateLimit = require('express-rate-limit');
const cveController = require('../controllers/cveController');

const router = express.Router();

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`📡 [${timestamp}] ${method} ${path} from ${ip}`);
  
  // Log query params if present
  if (Object.keys(req.query).length > 0) {
    console.log(`   Query:`, req.query);
  }
  
  // Log body if present (exclude large payloads)
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`   Body:`, JSON.stringify(req.body).substring(0, 200));
  }
  
  next();
};

/**
 * Input validation middleware for pagination
 */
const validatePagination = (req, res, next) => {
  if (req.query.page) {
    const page = parseInt(req.query.page);
    if (isNaN(page) || page < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid page parameter. Must be a positive integer.'
      });
    }
  }
  
  if (req.query.limit) {
    const limit = parseInt(req.query.limit);
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter. Must be between 1 and 1000.'
      });
    }
  }
  
  next();
};

/**
 * Input validation middleware for date range
 */
const validateDateRange = (req, res, next) => {
  if (req.query.startDate) {
    const date = new Date(req.query.startDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD).'
      });
    }
  }
  
  if (req.query.endDate) {
    const date = new Date(req.query.endDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD).'
      });
    }
  }
  
  // Validate date range order
  if (req.query.startDate && req.query.endDate) {
    const start = new Date(req.query.startDate);
    const end = new Date(req.query.endDate);
    
    if (start > end) {
      return res.status(400).json({
        success: false,
        error: 'startDate must be before endDate.'
      });
    }
  }
  
  next();
};

/**
 * Input validation middleware for CVE ID
 */
const validateCveId = (req, res, next) => {
  const { cveId } = req.params;
  
  if (!cveId || !cveId.match(/^CVE-\d{4}-\d+$/i)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid CVE ID format. Expected: CVE-YYYY-NNNNN'
    });
  }
  
  next();
};

/**
 * Input validation middleware for search
 */
const validateSearch = (req, res, next) => {
  if (req.method === 'POST') {
    if (!req.body.query || typeof req.body.query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required and must be a string.'
      });
    }
    
    if (req.body.query.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Search query too long. Maximum 500 characters.'
      });
    }
  }
  
  next();
};

/**
 * Rate limiter for general API endpoints
 * 100 requests per minute
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false // Disable `X-RateLimit-*` headers
});

/**
 * Rate limiter for sync endpoint
 * 1 request per 1 minute (development), 5 minutes (production)
 */
const syncLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'production' ? 5 * 60 * 1000 : 1 * 60 * 1000, // 1-5 minutes
  max: 1,
  message: {
    success: false,
    error: `Sync can only be triggered once every ${process.env.NODE_ENV === 'production' ? '5' : '1'} minute(s).`,
    retryAfter: `${process.env.NODE_ENV === 'production' ? '5' : '1'} minute(s)`
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
  skipFailedRequests: false
});

/**
 * Rate limiter for export endpoint
 * 10 requests per 5 minutes (exports can be resource-intensive)
 */
const exportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: {
    success: false,
    error: 'Too many export requests. Maximum 10 per 5 minutes.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for search endpoint
 * 30 requests per minute (search can be expensive)
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: {
    success: false,
    error: 'Too many search requests. Maximum 30 per minute.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply request logging to all routes
router.use(requestLogger);

// ============================================================================
// CVE Routes
// ============================================================================

/**
 * GET /cves/stats
 * Get CVE statistics
 */
router.get('/stats', generalLimiter, cveController.getStats);

/**
 * GET /cves/trending
 * Get trending CVEs (by EPSS score)
 */
router.get('/trending', generalLimiter, cveController.getTrendingCVEs);

/**
 * GET /cves/export
 * Export CVEs to CSV or JSON
 */
router.get('/export', exportLimiter, validatePagination, validateDateRange, cveController.exportCVEs);

/**
 * POST /cves/search
 * Advanced search CVEs
 */
router.post('/search', searchLimiter, validateSearch, validatePagination, cveController.searchCVEs);

/**
 * GET /cves/vendor/:vendor
 * Get CVEs by vendor
 */
router.get('/vendor/:vendor', generalLimiter, validatePagination, cveController.getCVEsByVendor);

/**
 * POST /cves/sync
 * Trigger manual CVE sync
 */
router.post('/sync', syncLimiter, cveController.syncCVEs);

/**
 * GET /cves/sync/status
 * Get sync status
 */
router.get('/sync/status', generalLimiter, cveController.getSyncStatus);

/**
 * POST /cves/sync/abort
 * Abort running sync
 */
router.post('/sync/abort', generalLimiter, cveController.abortSync);

/**
 * GET /cves/:cveId
 * Get single CVE by ID
 * Note: This must come after all specific routes to avoid conflicts
 */
router.get('/:cveId', generalLimiter, validateCveId, cveController.getCVEById);

/**
 * GET /cves
 * Get all CVEs with pagination, filters, and search
 * Note: This must come last to avoid matching specific routes
 */
router.get('/', generalLimiter, validatePagination, validateDateRange, cveController.getAllCVEs);

// ============================================================================
// Error handling for undefined routes
// ============================================================================

router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

module.exports = router;
