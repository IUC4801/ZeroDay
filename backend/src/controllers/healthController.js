/**
 * Health Check Controller
 * Provides comprehensive system health monitoring endpoints
 */

const mongoose = require('mongoose');
const os = require('os');
const axios = require('axios');
const logger = require('../utils/logger');

// Store application start time
const APP_START_TIME = Date.now();

// Store cache statistics
let cacheStats = {
  hits: 0,
  misses: 0,
  total: 0
};

/**
 * Update cache statistics
 * @param {Boolean} isHit - Whether cache was hit
 */
const updateCacheStats = (isHit) => {
  cacheStats.total++;
  if (isHit) {
    cacheStats.hits++;
  } else {
    cacheStats.misses++;
  }
};

/**
 * Get cache hit rate
 * @returns {Number} Hit rate percentage
 */
const getCacheHitRate = () => {
  if (cacheStats.total === 0) return 0;
  return ((cacheStats.hits / cacheStats.total) * 100).toFixed(2);
};

/**
 * Reset cache statistics
 */
const resetCacheStats = () => {
  cacheStats = { hits: 0, misses: 0, total: 0 };
};

/**
 * Execute health check with timeout
 * @param {Function} checkFn - Async function to execute
 * @param {Number} timeout - Timeout in milliseconds
 * @returns {Promise} Result or timeout error
 */
const withTimeout = (checkFn, timeout = 5000) => {
  return Promise.race([
    checkFn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), timeout)
    )
  ]);
};

/**
 * Check database health
 * @returns {Object} Database status
 */
const checkDatabase = async () => {
  const start = Date.now();
  
  try {
    // Check connection state
    const state = mongoose.connection.readyState;
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    if (state !== 1) {
      return {
        status: 'down',
        state: stateMap[state],
        error: 'Database not connected'
      };
    }
    
    // Ping database to check response time
    await mongoose.connection.db.admin().ping();
    const responseTime = Date.now() - start;
    
    // Get document counts
    const Cve = require('../models/Cve');
    const cveCount = await Cve.countDocuments();
    
    return {
      status: 'ok',
      state: stateMap[state],
      responseTime: `${responseTime}ms`,
      documentCounts: {
        cves: cveCount
      }
    };
  } catch (error) {
    logger.logError(error, { context: 'Database health check' });
    return {
      status: 'down',
      error: error.message
    };
  }
};

/**
 * Check external API availability
 * @param {String} name - API name
 * @param {String} url - API URL to check
 * @returns {Object} API status
 */
const checkExternalApi = async (name, url) => {
  const start = Date.now();
  
  try {
    const response = await axios.get(url, {
      timeout: 3000,
      validateStatus: (status) => status < 500
    });
    
    const responseTime = Date.now() - start;
    
    return {
      status: response.status < 400 ? 'ok' : 'degraded',
      responseTime: `${responseTime}ms`,
      statusCode: response.status
    };
  } catch (error) {
    return {
      status: 'down',
      error: error.message
    };
  }
};

/**
 * Check all external APIs
 * @returns {Object} External APIs status
 */
const checkExternalApis = async () => {
  try {
    const [nvd, epss, cisa] = await Promise.allSettled([
      checkExternalApi('NVD', 'https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=1'),
      checkExternalApi('EPSS', 'https://api.first.org/data/v1/epss'),
      checkExternalApi('CISA KEV', 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json')
    ]);
    
    return {
      nvd: nvd.status === 'fulfilled' ? nvd.value : { status: 'error', error: nvd.reason?.message },
      epss: epss.status === 'fulfilled' ? epss.value : { status: 'error', error: epss.reason?.message },
      cisa: cisa.status === 'fulfilled' ? cisa.value : { status: 'error', error: cisa.reason?.message }
    };
  } catch (error) {
    logger.logError(error, { context: 'External API health check' });
    return {
      error: 'Failed to check external APIs'
    };
  }
};

/**
 * Get system metrics
 * @returns {Object} System metrics
 */
const getSystemMetrics = () => {
  try {
    // Memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // CPU usage (approximation based on load average)
    const cpus = os.cpus();
    const loadAverage = os.loadavg()[0];
    const cpuUsage = ((loadAverage / cpus.length) * 100).toFixed(2);
    
    // Process memory
    const processMemory = process.memoryUsage();
    
    return {
      memory: {
        total: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        used: `${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        free: `${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        usagePercentage: `${((usedMemory / totalMemory) * 100).toFixed(2)}%`
      },
      process: {
        heapUsed: `${(processMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(processMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(processMemory.rss / 1024 / 1024).toFixed(2)} MB`,
        external: `${(processMemory.external / 1024 / 1024).toFixed(2)} MB`
      },
      cpu: {
        usage: `${cpuUsage}%`,
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        loadAverage: {
          '1min': loadAverage.toFixed(2),
          '5min': os.loadavg()[1].toFixed(2),
          '15min': os.loadavg()[2].toFixed(2)
        }
      },
      platform: {
        type: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname()
      }
    };
  } catch (error) {
    logger.logError(error, { context: 'System metrics check' });
    return {
      error: 'Failed to retrieve system metrics'
    };
  }
};

/**
 * Get application statistics
 * @returns {Object} Application stats
 */
const getApplicationStats = async () => {
  try {
    const uptime = process.uptime();
    const uptimeFormatted = formatUptime(uptime);
    
    // Get CVE count
    const Cve = require('../models/Cve');
    const totalCves = await Cve.countDocuments();
    
    // Get last sync info (if sync state file exists)
    let lastSync = null;
    try {
      const fs = require('fs');
      const path = require('path');
      const syncStatePath = path.join(__dirname, '../../.sync-state.json');
      
      if (fs.existsSync(syncStatePath)) {
        const syncState = JSON.parse(fs.readFileSync(syncStatePath, 'utf8'));
        lastSync = {
          timestamp: syncState.timestamp,
          status: syncState.status || 'unknown',
          processedCount: syncState.processedCveIds?.length || 0
        };
      }
    } catch (error) {
      // Sync state not available
    }
    
    // Get active connections (if available)
    const activeConnections = mongoose.connection.client?.topology?.s?.server?.s?.pool?.totalConnectionCount || 0;
    
    return {
      uptime: uptimeFormatted,
      uptimeSeconds: Math.floor(uptime),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      totalCves,
      lastSync,
      activeConnections,
      cache: {
        hitRate: `${getCacheHitRate()}%`,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        total: cacheStats.total
      },
      pid: process.pid
    };
  } catch (error) {
    logger.logError(error, { context: 'Application stats check' });
    return {
      error: 'Failed to retrieve application stats',
      uptime: formatUptime(process.uptime())
    };
  }
};

/**
 * Format uptime in human-readable format
 * @param {Number} seconds - Uptime in seconds
 * @returns {String} Formatted uptime
 */
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

/**
 * Determine overall system status
 * @param {Object} checks - All health check results
 * @returns {String} Overall status
 */
const determineOverallStatus = (checks) => {
  // Critical: Database must be up
  if (checks.database?.status === 'down') {
    return 'down';
  }
  
  // Degraded: Any external API is down
  if (checks.externalApis) {
    const apiStatuses = Object.values(checks.externalApis);
    if (apiStatuses.some(api => api.status === 'down' || api.status === 'error')) {
      return 'degraded';
    }
  }
  
  return 'ok';
};

/**
 * GET /api/health
 * Basic health check
 */
exports.basicHealthCheck = async (req, res) => {
  try {
    const uptime = process.uptime();
    const timestamp = new Date().toISOString();
    
    // Quick database check
    const dbState = mongoose.connection.readyState;
    const isHealthy = dbState === 1;
    
    const status = isHealthy ? 'ok' : 'down';
    const statusCode = isHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      status,
      timestamp,
      uptime: formatUptime(uptime)
    });
  } catch (error) {
    logger.logError(error, { context: 'Basic health check' });
    res.status(503).json({
      status: 'down',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

/**
 * GET /api/health/detailed
 * Comprehensive system status
 */
exports.detailedHealthCheck = async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Run all checks with timeout
    const [database, externalApis, systemMetrics, applicationStats] = await Promise.allSettled([
      withTimeout(checkDatabase, 5000),
      withTimeout(checkExternalApis, 10000),
      Promise.resolve(getSystemMetrics()),
      withTimeout(getApplicationStats, 3000)
    ]);
    
    const checks = {
      database: database.status === 'fulfilled' ? database.value : { status: 'error', error: database.reason?.message },
      externalApis: externalApis.status === 'fulfilled' ? externalApis.value : { error: externalApis.reason?.message },
      system: systemMetrics.status === 'fulfilled' ? systemMetrics.value : { error: systemMetrics.reason?.message },
      application: applicationStats.status === 'fulfilled' ? applicationStats.value : { error: applicationStats.reason?.message }
    };
    
    const overallStatus = determineOverallStatus(checks);
    const statusCode = overallStatus === 'down' ? 503 : 200;
    
    res.status(statusCode).json({
      status: overallStatus,
      timestamp,
      checks
    });
    
    // Log if system is degraded or down
    if (overallStatus !== 'ok') {
      logger.warn('System health degraded', { status: overallStatus, checks });
    }
  } catch (error) {
    logger.logError(error, { context: 'Detailed health check' });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

/**
 * GET /api/health/ready
 * Readiness probe - checks if app can handle requests
 */
exports.readinessCheck = async (req, res) => {
  try {
    // Check database connection with timeout
    const dbCheck = await withTimeout(checkDatabase, 3000);
    
    const isReady = dbCheck.status === 'ok';
    const statusCode = isReady ? 200 : 503;
    
    res.status(statusCode).json({
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck
      }
    });
    
    if (!isReady) {
      logger.warn('Readiness check failed', { database: dbCheck });
    }
  } catch (error) {
    logger.logError(error, { context: 'Readiness check' });
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

/**
 * GET /api/health/live
 * Liveness probe - simple check if process is alive
 */
exports.livenessCheck = (req, res) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: formatUptime(process.uptime()),
    pid: process.pid
  });
};

// Export cache statistics functions for use in other modules
exports.updateCacheStats = updateCacheStats;
exports.getCacheHitRate = getCacheHitRate;
exports.resetCacheStats = resetCacheStats;
