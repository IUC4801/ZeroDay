const axios = require('axios');

// EPSS API Configuration
const EPSS_BASE_URL = 'https://api.first.org/data/v1/epss';

// Rate limiting: 100 requests per minute
const RATE_LIMIT = {
  requests: 100,
  window: 60000 // 1 minute
};

const delayBetweenRequests = RATE_LIMIT.window / RATE_LIMIT.requests; // ~600ms

// Request tracking
let requestCount = 0;
let windowStartTime = Date.now();
let lastRequestTime = 0;

// In-memory cache (24 hours TTL)
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Batch configuration
const MAX_CVES_PER_REQUEST = 1000;
const CHUNK_SIZE = 1000;

/**
 * Create axios instance
 */
const epssClient = axios.create({
  baseURL: EPSS_BASE_URL,
  timeout: 30000,
  headers: {
    'User-Agent': 'ZeroDay-CVE-Tracker/1.0'
  }
});

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Rate limiter
 */
const rateLimiter = async () => {
  const now = Date.now();
  
  // Reset counter if window expired
  if (now - windowStartTime > RATE_LIMIT.window) {
    requestCount = 0;
    windowStartTime = now;
  }
  
  // Wait if rate limit reached
  if (requestCount >= RATE_LIMIT.requests) {
    const waitTime = RATE_LIMIT.window - (now - windowStartTime);
    console.log(`⏳ EPSS rate limit reached. Waiting ${waitTime}ms...`);
    await sleep(waitTime);
    requestCount = 0;
    windowStartTime = Date.now();
  }
  
  // Enforce minimum delay
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < delayBetweenRequests) {
    await sleep(delayBetweenRequests - timeSinceLastRequest);
  }
  
  requestCount++;
  lastRequestTime = Date.now();
};

/**
 * Generate cache key
 */
const getCacheKey = (endpoint, params = {}) => {
  return `${endpoint}:${JSON.stringify(params)}`;
};

/**
 * Get cached response
 */
const getCached = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ EPSS cache hit: ${key}`);
    return cached.data;
  }
  if (cached) {
    cache.delete(key);
  }
  return null;
};

/**
 * Set cache
 */
const setCache = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Make HTTP request with rate limiting
 */
const makeRequest = async (endpoint = '', params = {}, retries = 3) => {
  const cacheKey = getCacheKey(endpoint, params);
  
  // Check cache
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Apply rate limiting
  await rateLimiter();
  
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 EPSS API Request [Attempt ${attempt}/${retries}]: ${endpoint || 'root'}`);
      
      const response = await epssClient.get(endpoint, { params });
      
      console.log(`✅ EPSS API Response: ${response.status} - ${response.data?.data?.length || 0} scores`);
      
      // Cache successful response
      setCache(cacheKey, response.data);
      
      return response.data;
    } catch (error) {
      lastError = error;
      
      // Handle rate limiting (429)
      if (error.response?.status === 429) {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        console.warn(`⚠️  EPSS rate limit (429). Retrying in ${backoffDelay}ms...`);
        await sleep(backoffDelay);
        continue;
      }
      
      // Log error
      if (error.response) {
        console.error(`❌ EPSS API Error [${error.response.status}]:`, error.response.data);
      } else if (error.request) {
        console.error(`❌ EPSS API No Response:`, error.message);
      } else {
        console.error(`❌ EPSS API Request Error:`, error.message);
      }
      
      // Don't retry on client errors (4xx except 429)
      if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
        break;
      }
      
      // Wait before retry
      if (attempt < retries) {
        const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⏳ Retrying in ${retryDelay}ms...`);
        await sleep(retryDelay);
      }
    }
  }
  
  throw lastError;
};

/**
 * Normalize EPSS data
 */
const normalizeEPSSData = (epssItem) => {
  return {
    cveId: epssItem.cve,
    score: parseFloat(epssItem.epss),
    percentile: parseFloat(epssItem.percentile),
    date: epssItem.date
  };
};

/**
 * Split array into chunks
 */
const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Fetch EPSS scores for array of CVE IDs
 * Handles bulk requests with automatic chunking
 * @param {Array<String>} cveIds - Array of CVE IDs
 * @returns {Promise<Map>} Map of cveId → {score, percentile, date}
 */
const getEPSSScores = async (cveIds) => {
  if (!Array.isArray(cveIds) || cveIds.length === 0) {
    return new Map();
  }
  
  console.log(`📊 Fetching EPSS scores for ${cveIds.length} CVEs`);
  
  // Validate CVE IDs
  const validCveIds = cveIds.filter(id => id && id.match(/^CVE-\d{4}-\d+$/i));
  if (validCveIds.length !== cveIds.length) {
    console.warn(`⚠️  Filtered out ${cveIds.length - validCveIds.length} invalid CVE IDs`);
  }
  
  // Split into chunks for batch processing
  const chunks = chunkArray(validCveIds, CHUNK_SIZE);
  const resultMap = new Map();
  const errors = [];
  
  console.log(`📦 Processing ${chunks.length} chunks`);
  
  // Process chunks in parallel (with rate limiting per request)
  const chunkPromises = chunks.map(async (chunk, index) => {
    try {
      const cveParam = chunk.join(',');
      const response = await makeRequest('', { cve: cveParam });
      
      if (response.status === 'OK' && response.data) {
        response.data.forEach(item => {
          const normalized = normalizeEPSSData(item);
          resultMap.set(normalized.cveId, normalized);
        });
        
        console.log(`✅ Chunk ${index + 1}/${chunks.length}: Fetched ${response.data.length} scores`);
      }
    } catch (error) {
      console.error(`❌ Chunk ${index + 1}/${chunks.length} failed:`, error.message);
      errors.push({ chunk: index + 1, error: error.message });
    }
  });
  
  await Promise.all(chunkPromises);
  
  // Report results
  console.log(`📊 EPSS Fetch Complete: ${resultMap.size}/${validCveIds.length} scores retrieved`);
  
  if (errors.length > 0) {
    console.warn(`⚠️  ${errors.length} chunks failed`);
  }
  
  // Handle missing CVEs gracefully
  const missingCves = validCveIds.filter(id => !resultMap.has(id));
  if (missingCves.length > 0) {
    console.log(`ℹ️  ${missingCves.length} CVEs have no EPSS data`);
  }
  
  return resultMap;
};

/**
 * Get latest EPSS data dump
 * @param {Number} limit - Max number of results (default: 100)
 * @returns {Promise<Array>} Array of EPSS scores
 */
const getLatestEPSS = async (limit = 100) => {
  console.log(`📥 Fetching latest EPSS data (limit: ${limit})`);
  
  const response = await makeRequest('', {
    order: '!epss', // Sort by EPSS score descending
    limit: Math.min(limit, 1000)
  });
  
  if (response.status !== 'OK' || !response.data) {
    throw new Error('Failed to fetch latest EPSS data');
  }
  
  return response.data.map(normalizeEPSSData);
};

/**
 * Get EPSS scores by specific date
 * @param {String} date - Date in YYYY-MM-DD format
 * @param {Array<String>} cveIds - Optional array of CVE IDs
 * @returns {Promise<Array|Map>} EPSS scores for the date
 */
const getEPSSByDate = async (date, cveIds = null) => {
  // Validate date format
  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }
  
  console.log(`📅 Fetching EPSS scores for date: ${date}`);
  
  // If specific CVEs requested
  if (cveIds && Array.isArray(cveIds)) {
    const chunks = chunkArray(cveIds, CHUNK_SIZE);
    const resultMap = new Map();
    
    for (const chunk of chunks) {
      const cveParam = chunk.join(',');
      const response = await makeRequest('', {
        cve: cveParam,
        date: date
      });
      
      if (response.status === 'OK' && response.data) {
        response.data.forEach(item => {
          const normalized = normalizeEPSSData(item);
          resultMap.set(normalized.cveId, normalized);
        });
      }
    }
    
    return resultMap;
  }
  
  // Otherwise get all EPSS scores for that date
  const response = await makeRequest('', { date });
  
  if (response.status !== 'OK' || !response.data) {
    throw new Error(`Failed to fetch EPSS data for date: ${date}`);
  }
  
  return response.data.map(normalizeEPSSData);
};

/**
 * Get EPSS trend analysis (score change over time)
 * @param {String} cveId - CVE ID
 * @param {Number} days - Number of days to look back (default: 30)
 * @returns {Promise<Object>} Trend data
 */
const getEPSSTrend = async (cveId, days = 30) => {
  if (!cveId || !cveId.match(/^CVE-\d{4}-\d+$/i)) {
    throw new Error('Invalid CVE ID format');
  }
  
  console.log(`📈 Analyzing EPSS trend for ${cveId} (${days} days)`);
  
  const dates = [];
  const today = new Date();
  
  // Generate array of dates
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  
  const trendData = [];
  const errors = [];
  
  // Fetch EPSS for each date (sequential to avoid overwhelming API)
  for (const date of dates) {
    try {
      const response = await makeRequest('', {
        cve: cveId,
        date: date
      });
      
      if (response.status === 'OK' && response.data && response.data.length > 0) {
        trendData.push(normalizeEPSSData(response.data[0]));
      }
    } catch (error) {
      errors.push({ date, error: error.message });
    }
  }
  
  if (trendData.length === 0) {
    throw new Error(`No EPSS trend data found for ${cveId}`);
  }
  
  // Sort by date ascending
  trendData.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Calculate trend metrics
  const firstScore = trendData[0].score;
  const latestScore = trendData[trendData.length - 1].score;
  const scoreChange = latestScore - firstScore;
  const percentChange = firstScore > 0 ? ((scoreChange / firstScore) * 100).toFixed(2) : 0;
  
  const maxScore = Math.max(...trendData.map(d => d.score));
  const minScore = Math.min(...trendData.map(d => d.score));
  const avgScore = (trendData.reduce((sum, d) => sum + d.score, 0) / trendData.length).toFixed(4);
  
  return {
    cveId,
    dataPoints: trendData.length,
    trend: {
      first: firstScore,
      latest: latestScore,
      change: scoreChange,
      percentChange: parseFloat(percentChange),
      direction: scoreChange > 0 ? 'increasing' : scoreChange < 0 ? 'decreasing' : 'stable'
    },
    statistics: {
      max: maxScore,
      min: minScore,
      avg: parseFloat(avgScore)
    },
    history: trendData,
    errors: errors.length > 0 ? errors : null
  };
};

/**
 * Get top CVEs by EPSS score
 * @param {Number} limit - Number of top CVEs to return
 * @returns {Promise<Array>} Top CVEs by EPSS
 */
const getTopEPSSCVEs = async (limit = 100) => {
  console.log(`🔝 Fetching top ${limit} CVEs by EPSS score`);
  
  const response = await makeRequest('', {
    order: '!epss', // Descending order
    limit: Math.min(limit, 1000)
  });
  
  if (response.status !== 'OK' || !response.data) {
    throw new Error('Failed to fetch top EPSS CVEs');
  }
  
  return response.data.map(normalizeEPSSData);
};

/**
 * Get cache statistics
 */
const getCacheStats = () => {
  let expired = 0;
  const now = Date.now();
  
  cache.forEach((value) => {
    if (now - value.timestamp >= CACHE_TTL) {
      expired++;
    }
  });
  
  return {
    total: cache.size,
    expired,
    active: cache.size - expired,
    ttl: CACHE_TTL
  };
};

/**
 * Clear cache
 */
const clearCache = () => {
  const size = cache.size;
  cache.clear();
  console.log(`🗑️  Cleared ${size} EPSS cache entries`);
  return size;
};

/**
 * Get service status
 */
const getServiceStatus = () => {
  return {
    baseURL: EPSS_BASE_URL,
    rateLimit: RATE_LIMIT,
    requestCount,
    windowStartTime,
    cacheStats: getCacheStats(),
    maxCvesPerRequest: MAX_CVES_PER_REQUEST
  };
};

module.exports = {
  getEPSSScores,
  getLatestEPSS,
  getEPSSByDate,
  getEPSSTrend,
  getTopEPSSCVEs,
  getCacheStats,
  clearCache,
  getServiceStatus,
  normalizeEPSSData
};
