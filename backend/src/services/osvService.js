const axios = require('axios');

// OSV.dev API Configuration
const OSV_BASE_URL = 'https://api.osv.dev/v1';

// Rate limiting (OSV.dev doesn't specify strict limits, using conservative approach)
const RATE_LIMIT = {
  requests: 60,
  window: 60000 // 1 minute
};

const delayBetweenRequests = RATE_LIMIT.window / RATE_LIMIT.requests; // ~1000ms

// Request tracking
let requestCount = 0;
let windowStartTime = Date.now();
let lastRequestTime = 0;

// In-memory cache (1 hour TTL)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Batch configuration
const MAX_BATCH_SIZE = 1000;

// Supported ecosystems
const SUPPORTED_ECOSYSTEMS = [
  'npm',
  'PyPI',
  'Go',
  'Maven',
  'crates.io',
  'RubyGems',
  'Packagist',
  'NuGet',
  'Hex',
  'Pub',
  'ConanCenter',
  'Alpine',
  'Debian',
  'Ubuntu',
  'Rocky Linux',
  'AlmaLinux'
];

/**
 * Create axios instance
 */
const osvClient = axios.create({
  baseURL: OSV_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
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
    console.log(`⏳ OSV rate limit reached. Waiting ${waitTime}ms...`);
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
    console.log(`✅ OSV cache hit: ${key}`);
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
const makeRequest = async (endpoint, method = 'GET', data = null, retries = 3) => {
  const cacheKey = getCacheKey(endpoint, data || {});
  
  // Check cache (only for GET requests)
  if (method === 'GET') {
    const cached = getCached(cacheKey);
    if (cached) {
      return cached;
    }
  }
  
  // Apply rate limiting
  await rateLimiter();
  
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 OSV API Request [Attempt ${attempt}/${retries}]: ${method} ${endpoint}`);
      
      let response;
      if (method === 'GET') {
        response = await osvClient.get(endpoint);
      } else if (method === 'POST') {
        response = await osvClient.post(endpoint, data);
      }
      
      console.log(`✅ OSV API Response: ${response.status}`);
      
      // Cache successful response
      if (method === 'GET') {
        setCache(cacheKey, response.data);
      }
      
      return response.data;
    } catch (error) {
      lastError = error;
      
      // Handle rate limiting (429)
      if (error.response?.status === 429) {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        console.warn(`⚠️  OSV rate limit (429). Retrying in ${backoffDelay}ms...`);
        await sleep(backoffDelay);
        continue;
      }
      
      // Log error
      if (error.response) {
        console.error(`❌ OSV API Error [${error.response.status}]:`, error.response.data);
      } else if (error.request) {
        console.error(`❌ OSV API No Response:`, error.message);
      } else {
        console.error(`❌ OSV API Request Error:`, error.message);
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
 * Extract CVE IDs from OSV aliases
 */
const extractCVEIds = (vulnerability) => {
  if (!vulnerability.aliases || !Array.isArray(vulnerability.aliases)) {
    return [];
  }
  
  return vulnerability.aliases
    .filter(alias => alias.match(/^CVE-\d{4}-\d+$/i))
    .map(cve => cve.toUpperCase());
};

/**
 * Parse severity from OSV data
 */
const parseSeverity = (vulnerability) => {
  // Check severity field (CVSS v3)
  if (vulnerability.severity && Array.isArray(vulnerability.severity)) {
    for (const sev of vulnerability.severity) {
      if (sev.type === 'CVSS_V3') {
        return {
          type: 'CVSS_V3',
          score: sev.score,
          vector: null
        };
      }
    }
  }
  
  // Check database_specific
  if (vulnerability.database_specific) {
    const db = vulnerability.database_specific;
    
    if (db.severity) {
      return {
        type: 'DATABASE_SPECIFIC',
        score: null,
        severity: db.severity
      };
    }
    
    if (db.cvss_score) {
      return {
        type: 'DATABASE_SPECIFIC',
        score: db.cvss_score,
        vector: db.cvss_vector || null
      };
    }
  }
  
  return null;
};

/**
 * Extract affected versions
 */
const extractAffectedVersions = (vulnerability) => {
  if (!vulnerability.affected || !Array.isArray(vulnerability.affected)) {
    return [];
  }
  
  return vulnerability.affected.map(affected => ({
    package: affected.package?.name || 'unknown',
    ecosystem: affected.package?.ecosystem || 'unknown',
    purl: affected.package?.purl || null,
    ranges: affected.ranges || [],
    versions: affected.versions || [],
    databaseSpecific: affected.database_specific || null,
    ecosystemSpecific: affected.ecosystem_specific || null
  }));
};

/**
 * Normalize OSV vulnerability to CVE-like format
 */
const normalizeOSVData = (vulnerability) => {
  const cveIds = extractCVEIds(vulnerability);
  const severity = parseSeverity(vulnerability);
  const affectedVersions = extractAffectedVersions(vulnerability);
  
  return {
    id: vulnerability.id,
    cveIds: cveIds,
    primaryCveId: cveIds[0] || null,
    summary: vulnerability.summary || null,
    details: vulnerability.details || null,
    aliases: vulnerability.aliases || [],
    modified: vulnerability.modified,
    published: vulnerability.published,
    withdrawn: vulnerability.withdrawn || null,
    severity: severity,
    affected: affectedVersions,
    references: vulnerability.references || [],
    credits: vulnerability.credits || [],
    databaseSpecific: vulnerability.database_specific || null,
    ecosystemSpecific: vulnerability.ecosystem_specific || null
  };
};

/**
 * Query vulnerabilities by package and ecosystem
 * @param {String} packageName - Package name
 * @param {String} ecosystem - Ecosystem (npm, PyPI, etc.)
 * @param {String} version - Optional specific version
 * @returns {Promise<Array>} Array of vulnerabilities
 */
const queryVulnerabilities = async (packageName, ecosystem, version = null) => {
  if (!packageName) {
    throw new Error('Package name is required');
  }
  
  // Validate ecosystem
  if (ecosystem && !SUPPORTED_ECOSYSTEMS.includes(ecosystem)) {
    console.warn(`⚠️  Ecosystem '${ecosystem}' may not be supported. Supported: ${SUPPORTED_ECOSYSTEMS.join(', ')}`);
  }
  
  console.log(`🔍 Querying OSV for package: ${packageName} (${ecosystem || 'any ecosystem'})`);
  
  const queryData = {
    package: {
      name: packageName
    }
  };
  
  if (ecosystem) {
    queryData.package.ecosystem = ecosystem;
  }
  
  if (version) {
    queryData.version = version;
  }
  
  const response = await makeRequest('/query', 'POST', queryData);
  
  if (!response.vulns || response.vulns.length === 0) {
    console.log(`ℹ️  No vulnerabilities found for ${packageName}`);
    return [];
  }
  
  console.log(`✅ Found ${response.vulns.length} vulnerabilities for ${packageName}`);
  
  return response.vulns.map(normalizeOSVData);
};

/**
 * Get multiple vulnerabilities by IDs (batch)
 * @param {Array<String>} vulnIds - Array of vulnerability IDs
 * @returns {Promise<Map>} Map of id → vulnerability
 */
const getBatch = async (vulnIds) => {
  if (!Array.isArray(vulnIds) || vulnIds.length === 0) {
    return new Map();
  }
  
  console.log(`📦 Fetching ${vulnIds.length} OSV vulnerabilities in batch`);
  
  // Limit batch size
  if (vulnIds.length > MAX_BATCH_SIZE) {
    console.warn(`⚠️  Batch size ${vulnIds.length} exceeds max ${MAX_BATCH_SIZE}, truncating`);
    vulnIds = vulnIds.slice(0, MAX_BATCH_SIZE);
  }
  
  const queryData = {
    queries: vulnIds.map(id => ({ id }))
  };
  
  try {
    const response = await makeRequest('/querybatch', 'POST', queryData);
    
    if (!response.results || !Array.isArray(response.results)) {
      throw new Error('Invalid batch response format');
    }
    
    const resultMap = new Map();
    let foundCount = 0;
    
    response.results.forEach((result, index) => {
      const requestedId = vulnIds[index];
      
      if (result.vulns && result.vulns.length > 0) {
        // Take first vulnerability from result
        resultMap.set(requestedId, normalizeOSVData(result.vulns[0]));
        foundCount++;
      }
    });
    
    console.log(`✅ Batch fetch complete: ${foundCount}/${vulnIds.length} vulnerabilities found`);
    
    return resultMap;
  } catch (error) {
    console.error('❌ Batch fetch failed:', error.message);
    throw error;
  }
};

/**
 * Get single vulnerability by ID
 * @param {String} vulnId - Vulnerability ID (e.g., GHSA-xxxx-xxxx-xxxx)
 * @returns {Promise<Object>} Vulnerability details
 */
const getVulnerability = async (vulnId) => {
  if (!vulnId) {
    throw new Error('Vulnerability ID is required');
  }
  
  console.log(`🔍 Fetching OSV vulnerability: ${vulnId}`);
  
  const response = await makeRequest(`/vulns/${vulnId}`, 'GET');
  
  if (!response) {
    throw new Error(`Vulnerability ${vulnId} not found`);
  }
  
  return normalizeOSVData(response);
};

/**
 * Get vulnerabilities by CVE ID
 * @param {String} cveId - CVE ID
 * @returns {Promise<Array>} Array of OSV vulnerabilities
 */
const getVulnerabilitiesByCVE = async (cveId) => {
  if (!cveId || !cveId.match(/^CVE-\d{4}-\d+$/i)) {
    throw new Error('Invalid CVE ID format');
  }
  
  console.log(`🔍 Searching OSV for CVE: ${cveId}`);
  
  // OSV doesn't have a direct CVE endpoint, need to query by ID
  // Try using CVE as the ID
  try {
    const response = await makeRequest(`/vulns/${cveId}`, 'GET');
    return [normalizeOSVData(response)];
  } catch (error) {
    // CVE might not be the primary ID, search aliases
    console.log(`ℹ️  CVE ${cveId} not found as primary ID`);
    return [];
  }
};

/**
 * Query by ecosystem (get recent vulnerabilities)
 * @param {String} ecosystem - Ecosystem name
 * @param {Number} limit - Max results (not directly supported, best effort)
 * @returns {Promise<Array>} Recent vulnerabilities
 */
const queryByEcosystem = async (ecosystem, limit = 100) => {
  if (!ecosystem) {
    throw new Error('Ecosystem is required');
  }
  
  if (!SUPPORTED_ECOSYSTEMS.includes(ecosystem)) {
    console.warn(`⚠️  Ecosystem '${ecosystem}' may not be supported`);
  }
  
  console.log(`🔍 Querying OSV for ecosystem: ${ecosystem}`);
  
  // OSV API doesn't support direct ecosystem queries
  // This is a limitation - would need to query specific packages
  console.warn('⚠️  OSV API does not support direct ecosystem-wide queries');
  console.warn('ℹ️  Consider querying specific popular packages in this ecosystem');
  
  return [];
};

/**
 * Get popular packages for ecosystem
 * Helper function to provide commonly tracked packages
 */
const getPopularPackages = (ecosystem) => {
  const popular = {
    'npm': ['express', 'react', 'lodash', 'axios', 'moment', 'webpack', 'babel-core'],
    'PyPI': ['requests', 'urllib3', 'certifi', 'setuptools', 'pip', 'django', 'flask'],
    'Go': ['github.com/gin-gonic/gin', 'github.com/gorilla/mux', 'github.com/stretchr/testify'],
    'Maven': ['org.springframework:spring-core', 'com.fasterxml.jackson.core:jackson-databind'],
    'RubyGems': ['rails', 'bundler', 'rake', 'nokogiri', 'puma'],
    'crates.io': ['serde', 'tokio', 'rand', 'clap', 'regex']
  };
  
  return popular[ecosystem] || [];
};

/**
 * Bulk query popular packages in ecosystem
 * @param {String} ecosystem - Ecosystem name
 * @param {Array<String>} packages - Optional package list
 * @returns {Promise<Object>} Map of package → vulnerabilities
 */
const queryEcosystemPackages = async (ecosystem, packages = null) => {
  if (!ecosystem) {
    throw new Error('Ecosystem is required');
  }
  
  const packageList = packages || getPopularPackages(ecosystem);
  
  if (packageList.length === 0) {
    console.warn(`⚠️  No packages specified for ecosystem: ${ecosystem}`);
    return {};
  }
  
  console.log(`📊 Querying ${packageList.length} packages in ${ecosystem}`);
  
  const results = {};
  
  for (const pkg of packageList) {
    try {
      const vulns = await queryVulnerabilities(pkg, ecosystem);
      results[pkg] = vulns;
      console.log(`  ✅ ${pkg}: ${vulns.length} vulnerabilities`);
    } catch (error) {
      console.error(`  ❌ ${pkg}: ${error.message}`);
      results[pkg] = [];
    }
  }
  
  return results;
};

/**
 * Query by commit hash
 * @param {String} commit - Git commit hash
 * @returns {Promise<Array>} Vulnerabilities affecting this commit
 */
const queryByCommit = async (commit) => {
  if (!commit) {
    throw new Error('Commit hash is required');
  }
  
  console.log(`🔍 Querying OSV for commit: ${commit}`);
  
  const queryData = {
    commit: commit
  };
  
  const response = await makeRequest('/query', 'POST', queryData);
  
  if (!response.vulns || response.vulns.length === 0) {
    console.log(`ℹ️  No vulnerabilities found for commit ${commit}`);
    return [];
  }
  
  console.log(`✅ Found ${response.vulns.length} vulnerabilities for commit`);
  
  return response.vulns.map(normalizeOSVData);
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
  console.log(`🗑️  Cleared ${size} OSV cache entries`);
  return size;
};

/**
 * Get service status
 */
const getServiceStatus = () => {
  return {
    baseURL: OSV_BASE_URL,
    rateLimit: RATE_LIMIT,
    requestCount,
    windowStartTime,
    cacheStats: getCacheStats(),
    supportedEcosystems: SUPPORTED_ECOSYSTEMS,
    maxBatchSize: MAX_BATCH_SIZE
  };
};

/**
 * Get supported ecosystems
 */
const getSupportedEcosystems = () => {
  return [...SUPPORTED_ECOSYSTEMS];
};

module.exports = {
  queryVulnerabilities,
  getBatch,
  getVulnerability,
  getVulnerabilitiesByCVE,
  queryByEcosystem,
  queryEcosystemPackages,
  queryByCommit,
  getPopularPackages,
  getSupportedEcosystems,
  extractCVEIds,
  parseSeverity,
  extractAffectedVersions,
  normalizeOSVData,
  getCacheStats,
  clearCache,
  getServiceStatus
};
