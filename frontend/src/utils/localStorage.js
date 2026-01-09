/**
 * Local Storage Manager with error handling, validation, and expiration
 * Provides type-safe storage operations with fallback for disabled localStorage
 */

// In-memory fallback storage when localStorage is unavailable
const memoryStorage = new Map();

// Storage keys
const STORAGE_KEYS = {
  FILTERS: 'zeroday_filters',
  SEARCH_HISTORY: 'zeroday_search_history',
  USER_PREFERENCES: 'zeroday_user_preferences',
  WATCHLIST: 'zeroday_watchlist'
};

// Default expiration times (in milliseconds)
const EXPIRATION = {
  FILTERS: 7 * 24 * 60 * 60 * 1000, // 7 days
  SEARCH_HISTORY: 30 * 24 * 60 * 60 * 1000, // 30 days
  USER_PREFERENCES: 365 * 24 * 60 * 60 * 1000, // 1 year
  WATCHLIST: 90 * 24 * 60 * 60 * 1000 // 90 days
};

/**
 * Check if localStorage is available
 * @returns {Boolean}
 */
const isLocalStorageAvailable = () => {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Get storage quota information
 * @returns {Promise<Object>} Storage estimate
 */
export const getStorageQuota = async () => {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        usagePercent: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0,
        available: (estimate.quota || 0) - (estimate.usage || 0)
      };
    }
    return { usage: 0, quota: 0, usagePercent: 0, available: 0 };
  } catch (error) {
    console.warn('Storage quota check failed:', error);
    return { usage: 0, quota: 0, usagePercent: 0, available: 0 };
  }
};

/**
 * Simple encryption using Base64 (for basic obfuscation)
 * For production, use proper encryption library like crypto-js
 * @param {String} data - Data to encrypt
 * @returns {String}
 */
const encrypt = (data) => {
  try {
    return btoa(encodeURIComponent(JSON.stringify(data)));
  } catch (error) {
    console.warn('Encryption failed:', error);
    return JSON.stringify(data);
  }
};

/**
 * Decrypt Base64 encoded data
 * @param {String} encryptedData - Encrypted data
 * @returns {*}
 */
const decrypt = (encryptedData) => {
  try {
    return JSON.parse(decodeURIComponent(atob(encryptedData)));
  } catch (error) {
    console.warn('Decryption failed:', error);
    try {
      return JSON.parse(encryptedData);
    } catch (e) {
      return null;
    }
  }
};

/**
 * Get item from storage (localStorage or memory fallback)
 * @param {String} key - Storage key
 * @returns {*}
 */
const getItem = (key) => {
  if (isLocalStorageAvailable()) {
    return localStorage.getItem(key);
  }
  return memoryStorage.get(key);
};

/**
 * Set item in storage (localStorage or memory fallback)
 * @param {String} key - Storage key
 * @param {String} value - Value to store
 */
const setItem = (key, value) => {
  if (isLocalStorageAvailable()) {
    localStorage.setItem(key, value);
  } else {
    memoryStorage.set(key, value);
  }
};

/**
 * Remove item from storage
 * @param {String} key - Storage key
 */
const removeItem = (key) => {
  if (isLocalStorageAvailable()) {
    localStorage.removeItem(key);
  } else {
    memoryStorage.delete(key);
  }
};

/**
 * Save data with expiration timestamp
 * @param {String} key - Storage key
 * @param {*} data - Data to save
 * @param {Number} expirationMs - Expiration time in milliseconds
 * @param {Boolean} encrypted - Whether to encrypt the data
 */
const saveWithExpiration = (key, data, expirationMs, encrypted = false) => {
  try {
    const item = {
      data: encrypted ? encrypt(data) : data,
      timestamp: Date.now(),
      expiration: Date.now() + expirationMs,
      encrypted
    };
    setItem(key, JSON.stringify(item));
    return true;
  } catch (error) {
    console.error(`Failed to save ${key}:`, error);
    
    // Check if quota exceeded
    if (error.name === 'QuotaExceededError') {
      console.warn('Storage quota exceeded. Clearing old data...');
      clearOldData();
      try {
        const item = {
          data: encrypted ? encrypt(data) : data,
          timestamp: Date.now(),
          expiration: Date.now() + expirationMs,
          encrypted
        };
        setItem(key, JSON.stringify(item));
        return true;
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }
    return false;
  }
};

/**
 * Load data with expiration check
 * @param {String} key - Storage key
 * @returns {*|null}
 */
const loadWithExpiration = (key) => {
  try {
    const itemStr = getItem(key);
    if (!itemStr) return null;

    const item = JSON.parse(itemStr);
    
    // Check expiration
    if (item.expiration && Date.now() > item.expiration) {
      removeItem(key);
      return null;
    }

    // Decrypt if needed
    return item.encrypted ? decrypt(item.data) : item.data;
  } catch (error) {
    console.error(`Failed to load ${key}:`, error);
    return null;
  }
};

/**
 * Clear old expired data from storage
 */
const clearOldData = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      const item = loadWithExpiration(key);
      // loadWithExpiration already removes expired items
    });
  } catch (error) {
    console.error('Failed to clear old data:', error);
  }
};

/**
 * Save user's last applied filters
 * @param {Object} filters - Filter object
 * @returns {Boolean}
 * @example
 * saveFilters({ severity: ['CRITICAL', 'HIGH'], dateRange: { start: '2024-01-01' } })
 */
export const saveFilters = (filters) => {
  if (!filters || typeof filters !== 'object') {
    console.warn('Invalid filters data');
    return false;
  }
  return saveWithExpiration(STORAGE_KEYS.FILTERS, filters, EXPIRATION.FILTERS);
};

/**
 * Load saved filters
 * @returns {Object|null}
 */
export const loadFilters = () => {
  return loadWithExpiration(STORAGE_KEYS.FILTERS);
};

/**
 * Add search term to history (max 10 items)
 * @param {String} term - Search term
 * @returns {Boolean}
 */
export const saveSearchHistory = (term) => {
  if (!term || typeof term !== 'string' || term.trim().length === 0) {
    console.warn('Invalid search term');
    return false;
  }

  try {
    const history = getSearchHistory() || [];
    
    // Remove duplicate if exists
    const filteredHistory = history.filter(item => item.toLowerCase() !== term.toLowerCase());
    
    // Add new term at the beginning
    const newHistory = [term.trim(), ...filteredHistory].slice(0, 10);
    
    return saveWithExpiration(STORAGE_KEYS.SEARCH_HISTORY, newHistory, EXPIRATION.SEARCH_HISTORY);
  } catch (error) {
    console.error('Failed to save search history:', error);
    return false;
  }
};

/**
 * Get search history
 * @returns {Array<String>}
 */
export const getSearchHistory = () => {
  const history = loadWithExpiration(STORAGE_KEYS.SEARCH_HISTORY);
  return Array.isArray(history) ? history : [];
};

/**
 * Clear all search history
 * @returns {Boolean}
 */
export const clearSearchHistory = () => {
  try {
    removeItem(STORAGE_KEYS.SEARCH_HISTORY);
    return true;
  } catch (error) {
    console.error('Failed to clear search history:', error);
    return false;
  }
};

/**
 * Save user preferences (theme, layout, notifications, etc.)
 * @param {Object} prefs - User preferences object
 * @param {String} [prefs.theme] - Theme preference
 * @param {Boolean} [prefs.notifications] - Notification preference
 * @param {String} [prefs.layout] - Layout preference
 * @param {Object} [prefs.tableColumns] - Visible table columns
 * @returns {Boolean}
 * @example
 * saveUserPreferences({ 
 *   theme: 'dark', 
 *   notifications: true, 
 *   layout: 'grid',
 *   tableColumns: { severity: true, cvss: true }
 * })
 */
export const saveUserPreferences = (prefs) => {
  if (!prefs || typeof prefs !== 'object') {
    console.warn('Invalid preferences data');
    return false;
  }

  // Merge with existing preferences
  const currentPrefs = getUserPreferences() || {};
  const mergedPrefs = { ...currentPrefs, ...prefs };

  return saveWithExpiration(
    STORAGE_KEYS.USER_PREFERENCES,
    mergedPrefs,
    EXPIRATION.USER_PREFERENCES
  );
};

/**
 * Get user preferences
 * @returns {Object}
 */
export const getUserPreferences = () => {
  const prefs = loadWithExpiration(STORAGE_KEYS.USER_PREFERENCES);
  
  // Return default preferences if none saved
  return prefs || {
    theme: 'dark',
    notifications: true,
    layout: 'table',
    tableColumns: {
      select: true,
      id: true,
      severity: true,
      cvss: true,
      epss: true,
      description: true,
      published: true,
      actions: true
    },
    itemsPerPage: 25,
    autoRefresh: false,
    autoRefreshInterval: 300000 // 5 minutes
  };
};

/**
 * Save watchlist of CVE IDs
 * @param {Array<String>} cveIds - Array of CVE IDs
 * @returns {Boolean}
 * @example
 * saveWatchlist(['CVE-2024-1234', 'CVE-2024-5678'])
 */
export const saveWatchlist = (cveIds) => {
  if (!Array.isArray(cveIds)) {
    console.warn('Watchlist must be an array');
    return false;
  }

  // Validate CVE IDs format
  const validCveIds = cveIds.filter(id => 
    typeof id === 'string' && /^CVE-\d{4}-\d+$/.test(id)
  );

  if (validCveIds.length !== cveIds.length) {
    console.warn('Some invalid CVE IDs were filtered out');
  }

  // Encrypt watchlist for privacy
  return saveWithExpiration(
    STORAGE_KEYS.WATCHLIST,
    validCveIds,
    EXPIRATION.WATCHLIST,
    true // encrypted
  );
};

/**
 * Get watchlist of CVE IDs
 * @returns {Array<String>}
 */
export const getWatchlist = () => {
  const watchlist = loadWithExpiration(STORAGE_KEYS.WATCHLIST);
  return Array.isArray(watchlist) ? watchlist : [];
};

/**
 * Add CVE to watchlist
 * @param {String} cveId - CVE ID to add
 * @returns {Boolean}
 */
export const addToWatchlist = (cveId) => {
  if (!cveId || typeof cveId !== 'string') {
    console.warn('Invalid CVE ID');
    return false;
  }

  const watchlist = getWatchlist();
  if (!watchlist.includes(cveId)) {
    watchlist.push(cveId);
    return saveWatchlist(watchlist);
  }
  return true;
};

/**
 * Remove CVE from watchlist
 * @param {String} cveId - CVE ID to remove
 * @returns {Boolean}
 */
export const removeFromWatchlist = (cveId) => {
  const watchlist = getWatchlist();
  const filtered = watchlist.filter(id => id !== cveId);
  return saveWatchlist(filtered);
};

/**
 * Check if CVE is in watchlist
 * @param {String} cveId - CVE ID to check
 * @returns {Boolean}
 */
export const isInWatchlist = (cveId) => {
  const watchlist = getWatchlist();
  return watchlist.includes(cveId);
};

/**
 * Clear all watchlist items
 * @returns {Boolean}
 */
export const clearWatchlist = () => {
  try {
    removeItem(STORAGE_KEYS.WATCHLIST);
    return true;
  } catch (error) {
    console.error('Failed to clear watchlist:', error);
    return false;
  }
};

/**
 * Clear all stored data
 * @returns {Boolean}
 */
export const clearAllData = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Failed to clear all data:', error);
    return false;
  }
};

/**
 * Export all data for backup
 * @returns {Object}
 */
export const exportData = () => {
  return {
    filters: loadFilters(),
    searchHistory: getSearchHistory(),
    preferences: getUserPreferences(),
    watchlist: getWatchlist(),
    exportedAt: new Date().toISOString()
  };
};

/**
 * Import data from backup
 * @param {Object} data - Data object to import
 * @returns {Boolean}
 */
export const importData = (data) => {
  try {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data');
    }

    let success = true;

    if (data.filters) {
      success = saveFilters(data.filters) && success;
    }

    if (Array.isArray(data.searchHistory)) {
      data.searchHistory.forEach(term => saveSearchHistory(term));
    }

    if (data.preferences) {
      success = saveUserPreferences(data.preferences) && success;
    }

    if (Array.isArray(data.watchlist)) {
      success = saveWatchlist(data.watchlist) && success;
    }

    return success;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
};

// Export all functions as default object
export default {
  saveFilters,
  loadFilters,
  saveSearchHistory,
  getSearchHistory,
  clearSearchHistory,
  saveUserPreferences,
  getUserPreferences,
  saveWatchlist,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  clearWatchlist,
  clearAllData,
  getStorageQuota,
  exportData,
  importData
};
