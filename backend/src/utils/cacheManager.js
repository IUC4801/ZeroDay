/**
 * Cache Manager
 * In-memory caching with optional Redis support
 */

const NodeCache = require('node-cache');
const logger = require('./logger');

// Cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  flushes: 0
};

// Cache TTL presets (in seconds)
const TTL = {
  NVD_API: parseInt(process.env.CACHE_TTL_NVD) || 3600,        // 1 hour
  EPSS: parseInt(process.env.CACHE_TTL_EPSS) || 86400,         // 24 hours
  CISA_KEV: parseInt(process.env.CACHE_TTL_KEV) || 43200,      // 12 hours
  OSV: parseInt(process.env.CACHE_TTL_OSV) || 3600,            // 1 hour
  STATS: parseInt(process.env.CACHE_TTL_STATS) || 300,         // 5 minutes
  QUERY: parseInt(process.env.CACHE_TTL_QUERY) || 600,         // 10 minutes
  SHORT: 60,                                                    // 1 minute
  MEDIUM: 1800,                                                 // 30 minutes
  LONG: 7200,                                                   // 2 hours
  DEFAULT: 3600                                                 // 1 hour
};

// Initialize node-cache
const nodeCache = new NodeCache({
  stdTTL: TTL.DEFAULT,
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false, // Don't clone objects (faster but be careful with mutations)
  deleteOnExpire: true,
  maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 10000
});

// Redis client (optional)
let redisClient = null;
let useRedis = false;

/**
 * Initialize Redis client
 */
const initRedis = async () => {
  if (process.env.USE_REDIS !== 'true') {
    logger.info('Redis disabled, using in-memory cache');
    return;
  }

  try {
    const redis = require('redis');
    
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB) || 0,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts, falling back to memory cache');
            useRedis = false;
            return new Error('Redis reconnection limit reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
      useRedis = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
      useRedis = true;
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
      useRedis = true;
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });

    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    useRedis = true;
    
    logger.info('Redis cache initialized successfully');
  } catch (error) {
    logger.warn('Failed to initialize Redis, falling back to in-memory cache', { error: error.message });
    useRedis = false;
    redisClient = null;
  }
};

/**
 * Generate cache key with consistent format
 * @param {String} namespace - Cache namespace (nvd, epss, kev, etc.)
 * @param {String|Object} identifier - Key identifier or params object
 * @returns {String} Cache key
 */
const generateKey = (namespace, identifier) => {
  if (typeof identifier === 'object') {
    // Sort object keys for consistent key generation
    const sortedParams = Object.keys(identifier)
      .sort()
      .map(key => `${key}:${identifier[key]}`)
      .join('|');
    return `${namespace}:${sortedParams}`;
  }
  return `${namespace}:${identifier}`;
};

/**
 * Set value in cache
 * @param {String} key - Cache key
 * @param {*} value - Value to cache
 * @param {Number} ttl - Time to live in seconds (optional)
 * @returns {Promise<Boolean>} Success status
 */
const set = async (key, value, ttl = TTL.DEFAULT) => {
  try {
    cacheStats.sets++;
    
    if (useRedis && redisClient) {
      const serialized = JSON.stringify(value);
      await redisClient.setEx(key, ttl, serialized);
      logger.logCache('set', key, { ttl, size: serialized.length });
      return true;
    } else {
      const success = nodeCache.set(key, value, ttl);
      logger.logCache('set', key, { ttl, backend: 'memory' });
      return success;
    }
  } catch (error) {
    logger.error('Cache set error', { key, error: error.message });
    return false;
  }
};

/**
 * Get value from cache
 * @param {String} key - Cache key
 * @returns {Promise<*>} Cached value or undefined
 */
const get = async (key) => {
  try {
    if (useRedis && redisClient) {
      const value = await redisClient.get(key);
      
      if (value === null) {
        cacheStats.misses++;
        logger.logCache('miss', key, { backend: 'redis' });
        return undefined;
      }
      
      cacheStats.hits++;
      logger.logCache('hit', key, { backend: 'redis' });
      return JSON.parse(value);
    } else {
      const value = nodeCache.get(key);
      
      if (value === undefined) {
        cacheStats.misses++;
        logger.logCache('miss', key, { backend: 'memory' });
      } else {
        cacheStats.hits++;
        logger.logCache('hit', key, { backend: 'memory' });
      }
      
      return value;
    }
  } catch (error) {
    logger.error('Cache get error', { key, error: error.message });
    cacheStats.misses++;
    return undefined;
  }
};

/**
 * Delete key from cache
 * @param {String} key - Cache key
 * @returns {Promise<Boolean>} Success status
 */
const del = async (key) => {
  try {
    cacheStats.deletes++;
    
    if (useRedis && redisClient) {
      const result = await redisClient.del(key);
      logger.logCache('delete', key, { backend: 'redis', deleted: result });
      return result > 0;
    } else {
      const result = nodeCache.del(key);
      logger.logCache('delete', key, { backend: 'memory', deleted: result });
      return result > 0;
    }
  } catch (error) {
    logger.error('Cache delete error', { key, error: error.message });
    return false;
  }
};

/**
 * Delete multiple keys matching pattern
 * @param {String} pattern - Key pattern (supports wildcards with Redis)
 * @returns {Promise<Number>} Number of deleted keys
 */
const delPattern = async (pattern) => {
  try {
    if (useRedis && redisClient) {
      const keys = await redisClient.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await redisClient.del(keys);
      logger.logCache('delete-pattern', pattern, { backend: 'redis', deleted: result });
      return result;
    } else {
      // For node-cache, convert pattern to regex
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      const allKeys = nodeCache.keys();
      const matchingKeys = allKeys.filter(key => regex.test(key));
      
      matchingKeys.forEach(key => nodeCache.del(key));
      logger.logCache('delete-pattern', pattern, { backend: 'memory', deleted: matchingKeys.length });
      return matchingKeys.length;
    }
  } catch (error) {
    logger.error('Cache delete pattern error', { pattern, error: error.message });
    return 0;
  }
};

/**
 * Check if key exists in cache
 * @param {String} key - Cache key
 * @returns {Promise<Boolean>} Existence status
 */
const has = async (key) => {
  try {
    if (useRedis && redisClient) {
      const exists = await redisClient.exists(key);
      return exists === 1;
    } else {
      return nodeCache.has(key);
    }
  } catch (error) {
    logger.error('Cache has error', { key, error: error.message });
    return false;
  }
};

/**
 * Get all cache keys
 * @returns {Promise<Array>} Array of cache keys
 */
const keys = async () => {
  try {
    if (useRedis && redisClient) {
      return await redisClient.keys('*');
    } else {
      return nodeCache.keys();
    }
  } catch (error) {
    logger.error('Cache keys error', { error: error.message });
    return [];
  }
};

/**
 * Flush all cache
 * @returns {Promise<Boolean>} Success status
 */
const flush = async () => {
  try {
    cacheStats.flushes++;
    
    if (useRedis && redisClient) {
      await redisClient.flushDb();
      logger.info('Redis cache flushed');
      return true;
    } else {
      nodeCache.flushAll();
      logger.info('Memory cache flushed');
      return true;
    }
  } catch (error) {
    logger.error('Cache flush error', { error: error.message });
    return false;
  }
};

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
const getStats = async () => {
  try {
    const hitRate = cacheStats.hits + cacheStats.misses > 0
      ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(2)
      : 0;

    let keyCount = 0;
    let memoryUsage = 0;

    if (useRedis && redisClient) {
      const info = await redisClient.info('stats');
      const dbSize = await redisClient.dbSize();
      keyCount = dbSize;
      
      // Parse memory usage from info
      const memMatch = info.match(/used_memory:(\d+)/);
      if (memMatch) {
        memoryUsage = parseInt(memMatch[1]);
      }
    } else {
      const nodeCacheStats = nodeCache.getStats();
      keyCount = nodeCacheStats.keys;
      // Approximate memory usage
      memoryUsage = process.memoryUsage().heapUsed;
    }

    return {
      backend: useRedis ? 'redis' : 'memory',
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      hitRate: `${hitRate}%`,
      sets: cacheStats.sets,
      deletes: cacheStats.deletes,
      flushes: cacheStats.flushes,
      keys: keyCount,
      memoryUsage: `${(memoryUsage / 1024 / 1024).toFixed(2)} MB`
    };
  } catch (error) {
    logger.error('Cache stats error', { error: error.message });
    return {
      error: 'Failed to retrieve cache statistics'
    };
  }
};

/**
 * Reset cache statistics
 */
const resetStats = () => {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.sets = 0;
  cacheStats.deletes = 0;
  cacheStats.flushes = 0;
  logger.info('Cache statistics reset');
};

/**
 * Get or set cached value (cache-aside pattern)
 * @param {String} key - Cache key
 * @param {Function} fetchFn - Async function to fetch data if not cached
 * @param {Number} ttl - Time to live in seconds
 * @returns {Promise<*>} Cached or fetched value
 */
const getOrSet = async (key, fetchFn, ttl = TTL.DEFAULT) => {
  try {
    // Try to get from cache
    const cached = await get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Fetch fresh data
    const data = await fetchFn();
    
    // Cache the result
    await set(key, data, ttl);
    
    return data;
  } catch (error) {
    logger.error('Cache getOrSet error', { key, error: error.message });
    throw error;
  }
};

/**
 * Warm up cache with frequently accessed data
 */
const warmCache = async () => {
  logger.info('Starting cache warm-up');
  
  try {
    // Import models and services only when needed
    const Cve = require('../models/Cve');
    
    // Pre-cache statistics
    const statsKey = generateKey('stats', 'overview');
    const stats = await Cve.getStatistics();
    await set(statsKey, stats, TTL.STATS);
    logger.debug('Cached CVE statistics');
    
    // Pre-cache trending CVEs
    const trendingKey = generateKey('trending', { limit: 10 });
    const trending = await Cve.findTrending(10);
    await set(trendingKey, trending, TTL.QUERY);
    logger.debug('Cached trending CVEs');
    
    // Pre-cache CISA KEV list (if service is available)
    try {
      const cisaKevService = require('../services/cisaKevService');
      const kevKey = generateKey('kev', 'catalog');
      const kevCatalog = await cisaKevService.getKEVList();
      await set(kevKey, kevCatalog, TTL.CISA_KEV);
      logger.debug('Cached CISA KEV catalog');
    } catch (error) {
      logger.debug('CISA KEV service not available for cache warming');
    }
    
    logger.info('Cache warm-up completed');
  } catch (error) {
    logger.warn('Cache warm-up failed', { error: error.message });
  }
};

/**
 * Express middleware for caching responses
 * @param {Number} ttl - Time to live in seconds
 * @param {Function} keyGenerator - Function to generate cache key from request
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (ttl = TTL.DEFAULT, keyGenerator = null) => {
  return async (req, res, next) => {
    // Skip cache for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator 
        ? keyGenerator(req)
        : generateKey('route', `${req.originalUrl || req.url}`);

      // Check cache
      const cached = await get(cacheKey);
      
      if (cached !== undefined) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function(data) {
        // Cache the response
        set(cacheKey, data, ttl).catch(err => {
          logger.error('Failed to cache response', { key: cacheKey, error: err.message });
        });

        res.setHeader('X-Cache', 'MISS');
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', { error: error.message });
      next();
    }
  };
};

/**
 * Invalidate cache by namespace or pattern
 * @param {String} namespace - Cache namespace to invalidate
 * @returns {Promise<Number>} Number of deleted keys
 */
const invalidate = async (namespace) => {
  try {
    const pattern = `${namespace}*`;
    const deleted = await delPattern(pattern);
    logger.info('Cache invalidated', { namespace, deleted });
    return deleted;
  } catch (error) {
    logger.error('Cache invalidation error', { namespace, error: error.message });
    return 0;
  }
};

/**
 * Close cache connections gracefully
 */
const close = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis client closed');
    }
    nodeCache.close();
    logger.info('Cache manager closed');
  } catch (error) {
    logger.error('Error closing cache connections', { error: error.message });
  }
};

// Handle node-cache events
nodeCache.on('expired', (key, value) => {
  logger.debug('Cache key expired', { key });
});

nodeCache.on('flush', () => {
  logger.debug('Cache flushed');
});

// Export cache manager
module.exports = {
  // Core functions
  set,
  get,
  del,
  delPattern,
  has,
  keys,
  flush,
  
  // Utility functions
  getStats,
  resetStats,
  getOrSet,
  generateKey,
  
  // Cache strategies
  warmCache,
  invalidate,
  
  // Middleware
  cacheMiddleware,
  
  // Initialization
  initRedis,
  close,
  
  // TTL presets
  TTL,
  
  // Direct access (use with caution)
  nodeCache,
  get redisClient() {
    return redisClient;
  },
  get useRedis() {
    return useRedis;
  }
};
