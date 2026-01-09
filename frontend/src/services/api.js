import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add timestamps
api.interceptors.request.use(
  (config) => {
    config.metadata = { startTime: new Date() };
    config.headers['X-Request-Time'] = new Date().toISOString();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    const duration = new Date() - response.config.metadata.startTime;
    console.log(`Request to ${response.config.url} took ${duration}ms`);
    return response;
  },
  (error) => {
    let errorMessage = 'An unexpected error occurred';

    if (error.response) {
      // Server responded with error status
      errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
    } else if (error.request) {
      // Request made but no response received
      errorMessage = 'Network error: Unable to reach the server';
    } else {
      // Error in request setup
      errorMessage = error.message;
    }

    console.error('API Error:', errorMessage);
    return Promise.reject({ ...error, message: errorMessage });
  }
);

/**
 * Fetches CVEs with pagination and filters
 * @param {number} page - Page number for pagination
 * @param {number} limit - Number of items per page
 * @param {Object} filters - Filter options (severity, year, etc.)
 * @returns {Promise<{data: Object|null, error: string|null}>} CVE list and pagination info
 */
export const fetchCVEs = async (page = 1, limit = 20, filters = {}) => {
  try {
    const params = { page, limit, ...filters };
    const response = await api.get('/cves', { params });
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

/**
 * Fetches a single CVE by its ID
 * @param {string} cveId - The CVE identifier (e.g., CVE-2024-1234)
 * @returns {Promise<{data: Object|null, error: string|null}>} CVE details
 */
export const fetchCVEById = async (cveId) => {
  try {
    const response = await api.get(`/cves/${cveId}`);
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

/**
 * Fetches statistics about CVEs
 * @returns {Promise<{data: Object|null, error: string|null}>} Statistics data
 */
export const fetchStats = async () => {
  try {
    const response = await api.get('/cves/stats');
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

/**
 * Searches CVEs based on query and filters
 * @param {string} searchQuery - Search query string
 * @param {Object} filters - Additional filter options
 * @returns {Promise<{data: Object|null, error: string|null}>} Search results
 */
export const searchCVEs = async (searchQuery, filters = {}) => {
  try {
    const params = { q: searchQuery, ...filters };
    const response = await api.get('/cves/search', { params });
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

/**
 * Fetches trending CVEs
 * @param {number} limit - Number of trending CVEs to fetch
 * @returns {Promise<{data: Object|null, error: string|null}>} Trending CVEs
 */
export const fetchTrendingCVEs = async (limit = 10) => {
  try {
    const params = { limit };
    const response = await api.get('/cves/trending', { params });
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

/**
 * Fetches CVEs by vendor name
 * @param {string} vendor - Vendor name to filter by
 * @returns {Promise<{data: Object|null, error: string|null}>} CVEs for the specified vendor
 */
export const fetchCVEsByVendor = async (vendor) => {
  try {
    const response = await api.get(`/cves/vendor/${vendor}`);
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

/**
 * Triggers CVE data synchronization from NVD
 * @returns {Promise<{data: Object|null, error: string|null}>} Sync status
 */
export const triggerSync = async () => {
  try {
    const response = await api.post('/cves/sync');
    return { data: response.data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
};

export default api;
