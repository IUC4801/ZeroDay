const axios = require('axios');
const cron = require('node-cron');

// CISA KEV Configuration
const KEV_CATALOG_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

// Cache configuration
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
let catalogCache = null;
let lastFetchTime = null;
let previousCveIds = new Set();

// Notification callbacks
const notificationCallbacks = [];

/**
 * Create axios instance
 */
const kevClient = axios.create({
  timeout: 60000, // 60 seconds for large JSON file
  headers: {
    'User-Agent': 'ZeroDay-CVE-Tracker/1.0',
    'Accept': 'application/json'
  }
});

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validate KEV catalog structure
 */
const validateCatalog = (catalog) => {
  if (!catalog || typeof catalog !== 'object') {
    throw new Error('Invalid catalog: not an object');
  }
  
  if (!catalog.catalogVersion) {
    throw new Error('Invalid catalog: missing catalogVersion');
  }
  
  if (!catalog.dateReleased) {
    throw new Error('Invalid catalog: missing dateReleased');
  }
  
  if (!Array.isArray(catalog.vulnerabilities)) {
    throw new Error('Invalid catalog: vulnerabilities is not an array');
  }
  
  if (catalog.count !== catalog.vulnerabilities.length) {
    console.warn(`⚠️  KEV count mismatch: declared=${catalog.count}, actual=${catalog.vulnerabilities.length}`);
  }
  
  return true;
};

/**
 * Validate individual KEV entry
 */
const validateKEVEntry = (entry) => {
  const requiredFields = [
    'cveID',
    'vendorProject',
    'product',
    'vulnerabilityName',
    'dateAdded',
    'shortDescription',
    'requiredAction',
    'dueDate'
  ];
  
  const missing = requiredFields.filter(field => !entry[field]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  KEV entry ${entry.cveID || 'unknown'} missing fields: ${missing.join(', ')}`);
    return false;
  }
  
  // Validate CVE ID format
  if (!entry.cveID.match(/^CVE-\d{4}-\d+$/i)) {
    console.warn(`⚠️  Invalid CVE ID format: ${entry.cveID}`);
    return false;
  }
  
  return true;
};

/**
 * Normalize KEV entry
 */
const normalizeKEVEntry = (entry) => {
  return {
    cveId: entry.cveID.toUpperCase(),
    vendorProject: entry.vendorProject,
    product: entry.product,
    vulnerabilityName: entry.vulnerabilityName,
    dateAdded: entry.dateAdded,
    shortDescription: entry.shortDescription,
    requiredAction: entry.requiredAction,
    dueDate: entry.dueDate,
    knownRansomwareCampaignUse: entry.knownRansomwareCampaignUse === 'Known' || entry.knownRansomwareCampaignUse === true,
    notes: entry.notes || null
  };
};

/**
 * Detect new KEV additions
 */
const detectNewKEVs = (catalog) => {
  if (!catalog || !catalog.vulnerabilities) {
    return [];
  }
  
  const currentCveIds = new Set(
    catalog.vulnerabilities.map(v => v.cveID.toUpperCase())
  );
  
  // Find new CVEs
  const newCves = [];
  currentCveIds.forEach(cveId => {
    if (!previousCveIds.has(cveId)) {
      const entry = catalog.vulnerabilities.find(v => v.cveID.toUpperCase() === cveId);
      if (entry) {
        newCves.push(normalizeKEVEntry(entry));
      }
    }
  });
  
  // Update previous set
  previousCveIds = currentCveIds;
  
  return newCves;
};

/**
 * Trigger notification callbacks
 */
const notifyNewKEVs = (newKevs) => {
  if (newKevs.length === 0) {
    return;
  }
  
  console.log(`🚨 ${newKevs.length} new KEV entries detected!`);
  
  notificationCallbacks.forEach(callback => {
    try {
      callback(newKevs);
    } catch (error) {
      console.error('❌ Notification callback error:', error.message);
    }
  });
};

/**
 * Fetch KEV catalog from CISA
 * @param {Number} retries - Number of retry attempts
 * @returns {Promise<Object>} KEV catalog
 */
const fetchKEVCatalog = async (retries = 3) => {
  console.log('📥 Fetching CISA KEV catalog...');
  
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📡 KEV Catalog Request [Attempt ${attempt}/${retries}]`);
      
      const response = await kevClient.get(KEV_CATALOG_URL);
      
      console.log(`✅ KEV Catalog Downloaded: ${response.status}`);
      
      const catalog = response.data;
      
      // Validate catalog structure
      validateCatalog(catalog);
      
      console.log(`📊 KEV Catalog Info:`);
      console.log(`   Version: ${catalog.catalogVersion}`);
      console.log(`   Released: ${catalog.dateReleased}`);
      console.log(`   Count: ${catalog.count} vulnerabilities`);
      
      // Validate entries
      let validCount = 0;
      catalog.vulnerabilities = catalog.vulnerabilities.filter(entry => {
        const isValid = validateKEVEntry(entry);
        if (isValid) validCount++;
        return isValid;
      });
      
      console.log(`✅ Validated ${validCount}/${catalog.count} entries`);
      
      // Detect new KEVs (skip on first fetch)
      if (catalogCache !== null) {
        const newKevs = detectNewKEVs(catalog);
        if (newKevs.length > 0) {
          notifyNewKEVs(newKevs);
        }
      } else {
        // Initialize previous set on first fetch
        previousCveIds = new Set(
          catalog.vulnerabilities.map(v => v.cveID.toUpperCase())
        );
      }
      
      // Update cache
      catalogCache = catalog;
      lastFetchTime = Date.now();
      
      return catalog;
      
    } catch (error) {
      lastError = error;
      
      if (error.response) {
        console.error(`❌ KEV API Error [${error.response.status}]:`, error.response.statusText);
      } else if (error.request) {
        console.error(`❌ KEV API No Response:`, error.message);
      } else {
        console.error(`❌ KEV API Request Error:`, error.message);
      }
      
      // Wait before retry
      if (attempt < retries) {
        const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        console.log(`⏳ Retrying in ${retryDelay}ms...`);
        await sleep(retryDelay);
      }
    }
  }
  
  throw lastError;
};

/**
 * Get KEV catalog (from cache or fetch)
 * @param {Boolean} forceRefresh - Force refresh from server
 * @returns {Promise<Object>} KEV catalog
 */
const getCatalog = async (forceRefresh = false) => {
  // Check cache validity
  const cacheValid = catalogCache && 
                     lastFetchTime && 
                     (Date.now() - lastFetchTime) < CACHE_TTL;
  
  if (!forceRefresh && cacheValid) {
    console.log('✅ Returning cached KEV catalog');
    return catalogCache;
  }
  
  // Fetch fresh catalog
  if (!cacheValid) {
    console.log('ℹ️  Cache expired or missing, fetching fresh KEV catalog...');
  }
  
  return await fetchKEVCatalog();
};

/**
 * Get list of CVE IDs in KEV
 * @returns {Promise<Array<String>>} Array of CVE IDs
 */
const getKEVList = async () => {
  const catalog = await getCatalog();
  
  return catalog.vulnerabilities.map(v => v.cveID.toUpperCase());
};

/**
 * Get KEV details for specific CVE
 * @param {String} cveId - CVE ID
 * @returns {Promise<Object|null>} KEV entry or null
 */
const getKEVDetails = async (cveId) => {
  if (!cveId || !cveId.match(/^CVE-\d{4}-\d+$/i)) {
    throw new Error('Invalid CVE ID format');
  }
  
  const catalog = await getCatalog();
  const normalizedId = cveId.toUpperCase();
  
  const entry = catalog.vulnerabilities.find(
    v => v.cveID.toUpperCase() === normalizedId
  );
  
  return entry ? normalizeKEVEntry(entry) : null;
};

/**
 * Check if CVE is in KEV catalog
 * @param {String} cveId - CVE ID
 * @returns {Promise<Boolean>} True if in KEV
 */
const isInKEV = async (cveId) => {
  if (!cveId || !cveId.match(/^CVE-\d{4}-\d+$/i)) {
    return false;
  }
  
  const catalog = await getCatalog();
  const normalizedId = cveId.toUpperCase();
  
  return catalog.vulnerabilities.some(
    v => v.cveID.toUpperCase() === normalizedId
  );
};

/**
 * Get KEV entries by vendor
 * @param {String} vendor - Vendor name (case-insensitive)
 * @returns {Promise<Array>} Array of KEV entries
 */
const getKEVByVendor = async (vendor) => {
  const catalog = await getCatalog();
  const vendorLower = vendor.toLowerCase();
  
  return catalog.vulnerabilities
    .filter(v => v.vendorProject.toLowerCase().includes(vendorLower))
    .map(normalizeKEVEntry);
};

/**
 * Get KEV entries by product
 * @param {String} product - Product name (case-insensitive)
 * @returns {Promise<Array>} Array of KEV entries
 */
const getKEVByProduct = async (product) => {
  const catalog = await getCatalog();
  const productLower = product.toLowerCase();
  
  return catalog.vulnerabilities
    .filter(v => v.product.toLowerCase().includes(productLower))
    .map(normalizeKEVEntry);
};

/**
 * Get recent KEV additions
 * @param {Number} days - Number of days to look back (default: 30)
 * @returns {Promise<Array>} Recent KEV entries
 */
const getRecentKEVs = async (days = 30) => {
  const catalog = await getCatalog();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return catalog.vulnerabilities
    .filter(v => {
      const dateAdded = new Date(v.dateAdded);
      return dateAdded >= cutoffDate;
    })
    .map(normalizeKEVEntry)
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
};

/**
 * Get KEVs with ransomware campaign use
 * @returns {Promise<Array>} KEV entries with known ransomware use
 */
const getRansomwareKEVs = async () => {
  const catalog = await getCatalog();
  
  return catalog.vulnerabilities
    .filter(v => v.knownRansomwareCampaignUse === 'Known')
    .map(normalizeKEVEntry);
};

/**
 * Get KEV statistics
 * @returns {Promise<Object>} Statistics
 */
const getKEVStatistics = async () => {
  const catalog = await getCatalog();
  
  // Count by year
  const byYear = {};
  catalog.vulnerabilities.forEach(v => {
    const year = v.cveID.match(/CVE-(\d{4})-/)?.[1];
    if (year) {
      byYear[year] = (byYear[year] || 0) + 1;
    }
  });
  
  // Count ransomware
  const ransomwareCount = catalog.vulnerabilities.filter(
    v => v.knownRansomwareCampaignUse === 'Known'
  ).length;
  
  // Recent additions (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = catalog.vulnerabilities.filter(v => {
    return new Date(v.dateAdded) >= thirtyDaysAgo;
  }).length;
  
  // Top vendors
  const vendorCounts = {};
  catalog.vulnerabilities.forEach(v => {
    const vendor = v.vendorProject;
    vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;
  });
  
  const topVendors = Object.entries(vendorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([vendor, count]) => ({ vendor, count }));
  
  return {
    catalogVersion: catalog.catalogVersion,
    dateReleased: catalog.dateReleased,
    totalCount: catalog.count,
    byYear,
    ransomwareCount,
    ransomwarePercentage: ((ransomwareCount / catalog.count) * 100).toFixed(2),
    recentAdditions: recentCount,
    topVendors,
    lastUpdated: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
    cacheAge: lastFetchTime ? Date.now() - lastFetchTime : null
  };
};

/**
 * Register notification callback for new KEV additions
 * @param {Function} callback - Callback function(newKevs)
 */
const registerNotificationCallback = (callback) => {
  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }
  
  notificationCallbacks.push(callback);
  console.log(`✅ Registered KEV notification callback (${notificationCallbacks.length} total)`);
};

/**
 * Unregister notification callback
 * @param {Function} callback - Callback to remove
 */
const unregisterNotificationCallback = (callback) => {
  const index = notificationCallbacks.indexOf(callback);
  if (index !== -1) {
    notificationCallbacks.splice(index, 1);
    console.log(`✅ Unregistered KEV notification callback (${notificationCallbacks.length} remaining)`);
  }
};

/**
 * Initialize scheduled updates
 * @param {String} schedule - Cron schedule (default: every 12 hours)
 */
const initScheduledUpdates = (schedule = '0 */12 * * *') => {
  console.log(`⏰ Scheduling KEV catalog updates: ${schedule}`);
  
  // Validate cron expression
  if (!cron.validate(schedule)) {
    throw new Error('Invalid cron schedule expression');
  }
  
  // Schedule the job
  const job = cron.schedule(schedule, async () => {
    console.log('🔄 Running scheduled KEV catalog update...');
    try {
      await fetchKEVCatalog();
      console.log('✅ Scheduled KEV update completed');
    } catch (error) {
      console.error('❌ Scheduled KEV update failed:', error.message);
    }
  });
  
  console.log('✅ KEV scheduled updates initialized');
  
  return job;
};

/**
 * Refresh catalog immediately
 */
const refreshCatalog = async () => {
  console.log('🔄 Manual KEV catalog refresh...');
  return await fetchKEVCatalog();
};

/**
 * Clear cache
 */
const clearCache = () => {
  catalogCache = null;
  lastFetchTime = null;
  console.log('🗑️  KEV cache cleared');
};

/**
 * Get cache information
 */
const getCacheInfo = () => {
  return {
    cached: catalogCache !== null,
    lastFetchTime: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
    cacheAge: lastFetchTime ? Date.now() - lastFetchTime : null,
    cacheValid: catalogCache && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_TTL,
    ttl: CACHE_TTL,
    catalogVersion: catalogCache?.catalogVersion || null,
    entryCount: catalogCache?.count || 0,
    notificationCallbacks: notificationCallbacks.length
  };
};

/**
 * Get service status
 */
const getServiceStatus = () => {
  return {
    url: KEV_CATALOG_URL,
    cacheInfo: getCacheInfo(),
    previousCveCount: previousCveIds.size
  };
};

module.exports = {
  fetchKEVCatalog,
  getCatalog,
  getKEVList,
  getKEVDetails,
  isInKEV,
  getKEVByVendor,
  getKEVByProduct,
  getRecentKEVs,
  getRansomwareKEVs,
  getKEVStatistics,
  registerNotificationCallback,
  unregisterNotificationCallback,
  initScheduledUpdates,
  refreshCatalog,
  clearCache,
  getCacheInfo,
  getServiceStatus,
  normalizeKEVEntry
};
