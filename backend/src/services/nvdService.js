const axios = require('axios');

// NVD API Configuration
const NVD_BASE_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const API_KEY = process.env.NVD_API_KEY || null;

// Rate limiting configuration
const RATE_LIMIT = {
  withKey: { requests: 50, window: 30000 }, // 50 requests per 30 seconds
  withoutKey: { requests: 5, window: 30000 } // 5 requests per 30 seconds
};

const currentLimit = API_KEY ? RATE_LIMIT.withKey : RATE_LIMIT.withoutKey;
const delayBetweenRequests = currentLimit.window / currentLimit.requests;

// Request queue and tracking
const requestQueue = [];
let isProcessingQueue = false;
let lastRequestTime = 0;
let requestCount = 0;
let windowStartTime = Date.now();

// In-memory cache
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Create axios instance with default configuration
 */
const nvdClient = axios.create({
  baseURL: NVD_BASE_URL,
  timeout: 30000,
  headers: {
    'User-Agent': 'ZeroDay-CVE-Tracker/1.0',
    ...(API_KEY && { 'apiKey': API_KEY })
  }
});

/**
 * Rate limiter middleware
 * Ensures requests comply with NVD rate limits
 */
const rateLimiter = async () => {
  const now = Date.now();
  
  // Reset counter if window expired
  if (now - windowStartTime > currentLimit.window) {
    requestCount = 0;
    windowStartTime = now;
  }
  
  // Wait if rate limit reached
  if (requestCount >= currentLimit.requests) {
    const waitTime = currentLimit.window - (now - windowStartTime);
    console.log(`⏳ Rate limit reached. Waiting ${waitTime}ms...`);
    await sleep(waitTime);
    requestCount = 0;
    windowStartTime = Date.now();
  }
  
  // Enforce minimum delay between requests
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < delayBetweenRequests) {
    await sleep(delayBetweenRequests - timeSinceLastRequest);
  }
  
  requestCount++;
  lastRequestTime = Date.now();
};

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate cache key from parameters
 */
const getCacheKey = (endpoint, params) => {
  return `${endpoint}:${JSON.stringify(params)}`;
};

/**
 * Get cached response if available and not expired
 */
const getCached = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ Cache hit: ${key}`);
    return cached.data;
  }
  if (cached) {
    cache.delete(key); // Remove expired cache
  }
  return null;
};

/**
 * Set cache with timestamp
 */
const setCache = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Make HTTP request with rate limiting, retry, and caching
 */
const makeRequest = async (endpoint, params = {}, retries = 3) => {
  const cacheKey = getCacheKey(endpoint, params);
  
  // Check cache first
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Apply rate limiting
  await rateLimiter();
  
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 NVD API Request [Attempt ${attempt}/${retries}]: ${endpoint}`);
      console.log(`   Params:`, params);
      
      const response = await nvdClient.get(endpoint, { params });
      
      console.log(`✅ NVD API Response: ${response.status} - ${response.data?.totalResults || 0} results`);
      
      // Cache successful response
      setCache(cacheKey, response.data);
      
      return response.data;
    } catch (error) {
      lastError = error;
      
      // Handle rate limiting (429) and service unavailable (503)
      if (error.response?.status === 429 || error.response?.status === 503) {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Exponential backoff, max 30s
        console.warn(`⚠️  Rate limit or service unavailable (${error.response.status}). Retrying in ${backoffDelay}ms...`);
        await sleep(backoffDelay);
        continue;
      }
      
      // Handle other errors
      if (error.response) {
        console.error(`❌ NVD API Error [${error.response.status}]:`, error.response.data);
      } else if (error.request) {
        console.error(`❌ NVD API No Response:`, error.message);
      } else {
        console.error(`❌ NVD API Request Error:`, error.message);
      }
      
      // Don't retry on client errors (4xx except 429)
      if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
        throw error;
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
 * Normalize CVE data structure
 */
const normalizeCVE = (cveItem) => {
  const cve = cveItem.cve;
  
  // Extract CVSS V3 metrics
  const cvssV3 = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0];
  const cvssV3Data = cvssV3?.cvssData;
  
  // Extract CVSS V2 metrics
  const cvssV2 = cve.metrics?.cvssMetricV2?.[0];
  const cvssV2Data = cvssV2?.cvssData;
  
  // Extract description (prefer English)
  const description = cve.descriptions?.find(d => d.lang === 'en')?.value || 
                      cve.descriptions?.[0]?.value || 
                      'No description available';
  
  // Extract references
  const references = cve.references?.map(ref => ({
    url: ref.url,
    source: ref.source,
    tags: ref.tags || []
  })) || [];
  
  // Extract affected products (CPE configurations)
  const affectedProducts = [];
  if (cve.configurations) {
    cve.configurations.forEach(config => {
      config.nodes?.forEach(node => {
        node.cpeMatch?.forEach(match => {
          if (match.criteria) {
            const cpeUri = match.criteria.split(':');
            affectedProducts.push({
              vendor: cpeUri[3] || 'unknown',
              product: cpeUri[4] || 'unknown',
              versions: [cpeUri[5] || '*'],
              versionStartIncluding: match.versionStartIncluding,
              versionEndExcluding: match.versionEndExcluding,
              versionStartExcluding: match.versionStartExcluding,
              versionEndIncluding: match.versionEndIncluding
            });
          }
        });
      });
    });
  }
  
  // Extract CWE information
  const cweData = cve.weaknesses?.flatMap(weakness => 
    weakness.description
      ?.filter(d => d.lang === 'en')
      .map(d => ({
        cweId: d.value,
        description: d.value
      })) || []
  ) || [];
  
  return {
    cveId: cve.id,
    description,
    publishedDate: new Date(cve.published),
    lastModifiedDate: new Date(cve.lastModified),
    vulnStatus: cve.vulnStatus || 'Awaiting Analysis',
    cvssV3: cvssV3Data ? {
      score: cvssV3Data.baseScore,
      severity: cvssV3Data.baseSeverity,
      vector: cvssV3Data.vectorString,
      attackVector: cvssV3Data.attackVector,
      attackComplexity: cvssV3Data.attackComplexity,
      privilegesRequired: cvssV3Data.privilegesRequired,
      userInteraction: cvssV3Data.userInteraction,
      scope: cvssV3Data.scope,
      confidentialityImpact: cvssV3Data.confidentialityImpact,
      integrityImpact: cvssV3Data.integrityImpact,
      availabilityImpact: cvssV3Data.availabilityImpact
    } : null,
    cvssV2: cvssV2Data ? {
      score: cvssV2Data.baseScore,
      severity: cvssV2?.baseSeverity,
      vector: cvssV2Data.vectorString,
      accessVector: cvssV2Data.accessVector,
      accessComplexity: cvssV2Data.accessComplexity,
      authentication: cvssV2Data.authentication,
      confidentialityImpact: cvssV2Data.confidentialityImpact,
      integrityImpact: cvssV2Data.integrityImpact,
      availabilityImpact: cvssV2Data.availabilityImpact
    } : null,
    references,
    affectedProducts,
    cwe: cweData,
    attackVector: cvssV3Data?.attackVector || null,
    attackComplexity: cvssV3Data?.attackComplexity || null,
    privilegesRequired: cvssV3Data?.privilegesRequired || null,
    userInteraction: cvssV3Data?.userInteraction || null,
    scope: cvssV3Data?.scope || null
  };
};

/**
 * Fetch CVEs with pagination and filters
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} CVE results
 */
const getCVEs = async (params = {}) => {
  const queryParams = {
    startIndex: params.startIndex || 0,
    resultsPerPage: Math.min(params.resultsPerPage || 20, 2000), // Max 2000
    ...(params.pubStartDate && { pubStartDate: params.pubStartDate }),
    ...(params.pubEndDate && { pubEndDate: params.pubEndDate }),
    ...(params.cvssV3Severity && { cvssV3Severity: params.cvssV3Severity }),
    ...(params.keywordSearch && { keywordSearch: params.keywordSearch })
  };
  
  const data = await makeRequest('/', queryParams);
  
  return {
    totalResults: data.totalResults,
    resultsPerPage: data.resultsPerPage,
    startIndex: data.startIndex,
    cves: data.vulnerabilities?.map(v => normalizeCVE(v)) || []
  };
};

/**
 * Fetch single CVE by ID
 * @param {String} cveId - CVE identifier (e.g., CVE-2024-1234)
 * @returns {Promise<Object>} CVE data
 */
const getCVEById = async (cveId) => {
  if (!cveId || !cveId.match(/^CVE-\d{4}-\d+$/)) {
    throw new Error('Invalid CVE ID format');
  }
  
  const data = await makeRequest('/', { cveId });
  
  if (!data.vulnerabilities || data.vulnerabilities.length === 0) {
    throw new Error(`CVE not found: ${cveId}`);
  }
  
  return normalizeCVE(data.vulnerabilities[0]);
};

/**
 * Fetch CVEs by date range with pagination
 * @param {String} startDate - Start date (ISO 8601)
 * @param {String} endDate - End date (ISO 8601)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array>} Array of normalized CVEs
 */
const getCVEsByDateRange = async (startDate, endDate, onProgress = null) => {
  const allCVEs = [];
  let startIndex = 0;
  const resultsPerPage = 2000; // Max allowed by NVD API
  let totalResults = 0;
  
  console.log(`📅 Fetching CVEs from ${startDate} to ${endDate}`);
  
  do {
    const result = await getCVEs({
      startIndex,
      resultsPerPage,
      pubStartDate: startDate,
      pubEndDate: endDate
    });
    
    totalResults = result.totalResults;
    allCVEs.push(...result.cves);
    
    const progress = {
      fetched: allCVEs.length,
      total: totalResults,
      percentage: totalResults > 0 ? ((allCVEs.length / totalResults) * 100).toFixed(2) : 0
    };
    
    console.log(`📊 Progress: ${progress.fetched}/${progress.total} (${progress.percentage}%)`);
    
    if (onProgress) {
      onProgress(progress);
    }
    
    startIndex += resultsPerPage;
  } while (allCVEs.length < totalResults);
  
  console.log(`✅ Completed: Fetched ${allCVEs.length} CVEs`);
  
  return allCVEs;
};

/**
 * Fetch recent CVEs (last N days)
 * @param {Number} days - Number of days to look back
 * @returns {Promise<Array>} Array of normalized CVEs
 */
const getRecentCVEs = async (days = 7) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return getCVEsByDateRange(
    startDate.toISOString(),
    endDate.toISOString()
  );
};

/**
 * Search CVEs by keyword
 * @param {String} keyword - Search keyword
 * @param {Number} limit - Max results
 * @returns {Promise<Array>} Array of normalized CVEs
 */
const searchCVEs = async (keyword, limit = 100) => {
  const result = await getCVEs({
    keywordSearch: keyword,
    resultsPerPage: Math.min(limit, 2000)
  });
  
  return result.cves;
};

/**
 * Get cache statistics
 * @returns {Object} Cache stats
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
    active: cache.size - expired
  };
};

/**
 * Clear cache
 */
const clearCache = () => {
  const size = cache.size;
  cache.clear();
  console.log(`🗑️  Cleared ${size} cache entries`);
  return size;
};

/**
 * Get service status
 */
const getServiceStatus = () => {
  return {
    baseURL: NVD_BASE_URL,
    hasApiKey: !!API_KEY,
    rateLimit: currentLimit,
    requestCount,
    windowStartTime,
    cacheStats: getCacheStats()
  };
};

module.exports = {
  getCVEs,
  getCVEById,
  getCVEsByDateRange,
  getRecentCVEs,
  searchCVEs,
  getCacheStats,
  clearCache,
  getServiceStatus,
  normalizeCVE
};
