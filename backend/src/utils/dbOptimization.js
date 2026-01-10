/**
 * Database Optimization Utilities
 * Index management, query optimization, and performance monitoring
 */

const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Create all necessary indexes for optimal query performance
 * @returns {Promise<Object>} Index creation results
 */
const createIndexes = async () => {
  logger.info('Creating database indexes...');
  
  try {
    const Cve = require('../models/Cve');
    const results = {
      created: [],
      existing: [],
      errors: []
    };

    // Get existing indexes
    const existingIndexes = await Cve.collection.getIndexes();
    logger.debug('Existing indexes', { count: Object.keys(existingIndexes).length });

    // Single field indexes
    const singleFieldIndexes = [
      { field: { cveId: 1 }, options: { unique: true, name: 'idx_cveId' } },
      { field: { publishedDate: -1 }, options: { name: 'idx_publishedDate' } },
      { field: { lastModifiedDate: -1 }, options: { name: 'idx_lastModifiedDate' } },
      { field: { 'cvssV3.severity': 1 }, options: { name: 'idx_severity' } },
      { field: { epssScore: -1 }, options: { name: 'idx_epssScore_desc' } },
      { field: { exploitAvailable: 1 }, options: { name: 'idx_exploitAvailable' } },
      { field: { cisaKev: 1 }, options: { name: 'idx_cisaKev' } },
      { field: { 'affectedProducts.vendor': 1 }, options: { name: 'idx_vendor' } },
      { field: { 'affectedProducts.product': 1 }, options: { name: 'idx_product' } }
    ];

    // Compound indexes for common query patterns
    const compoundIndexes = [
      { 
        field: { publishedDate: -1, 'cvssV3.severity': 1 }, 
        options: { name: 'idx_publishedDate_severity' } 
      },
      { 
        field: { exploitAvailable: 1, cisaKev: 1 }, 
        options: { name: 'idx_exploit_kev' } 
      },
      { 
        field: { 'cvssV3.severity': 1, publishedDate: -1 }, 
        options: { name: 'idx_severity_date' } 
      },
      { 
        field: { epssScore: -1, publishedDate: -1 }, 
        options: { name: 'idx_epss_date' } 
      },
      { 
        field: { 'affectedProducts.vendor': 1, publishedDate: -1 }, 
        options: { name: 'idx_vendor_date' } 
      },
      {
        field: { cisaKev: 1, 'cvssV3.severity': 1, publishedDate: -1 },
        options: { name: 'idx_kev_severity_date' }
      }
    ];

    // Text index for full-text search
    const textIndex = {
      field: { 
        cveId: 'text', 
        description: 'text',
        'affectedProducts.vendor': 'text',
        'affectedProducts.product': 'text'
      },
      options: { 
        name: 'idx_text_search',
        weights: {
          cveId: 10,
          description: 5,
          'affectedProducts.vendor': 3,
          'affectedProducts.product': 3
        }
      }
    };

    // Create single field indexes
    for (const index of singleFieldIndexes) {
      try {
        await Cve.collection.createIndex(index.field, index.options);
        results.created.push(index.options.name);
        logger.debug(`Created index: ${index.options.name}`);
      } catch (error) {
        if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
          results.existing.push(index.options.name);
        } else {
          results.errors.push({ index: index.options.name, error: error.message });
          logger.error(`Failed to create index: ${index.options.name}`, { error: error.message });
        }
      }
    }

    // Create compound indexes
    for (const index of compoundIndexes) {
      try {
        await Cve.collection.createIndex(index.field, index.options);
        results.created.push(index.options.name);
        logger.debug(`Created compound index: ${index.options.name}`);
      } catch (error) {
        if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
          results.existing.push(index.options.name);
        } else {
          results.errors.push({ index: index.options.name, error: error.message });
          logger.error(`Failed to create compound index: ${index.options.name}`, { error: error.message });
        }
      }
    }

    // Create text index
    try {
      await Cve.collection.createIndex(textIndex.field, textIndex.options);
      results.created.push(textIndex.options.name);
      logger.debug(`Created text index: ${textIndex.options.name}`);
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        results.existing.push(textIndex.options.name);
      } else {
        results.errors.push({ index: textIndex.options.name, error: error.message });
        logger.error(`Failed to create text index: ${textIndex.options.name}`, { error: error.message });
      }
    }

    logger.info('Index creation completed', {
      created: results.created.length,
      existing: results.existing.length,
      errors: results.errors.length
    });

    return results;
  } catch (error) {
    logger.error('Index creation failed', { error: error.message });
    throw error;
  }
};

/**
 * Get statistics grouped by severity
 * @returns {Promise<Array>} Severity statistics
 */
const getStatsBySeverity = async () => {
  try {
    const Cve = require('../models/Cve');
    
    const stats = await Cve.aggregate([
      {
        $group: {
          _id: '$cvssV3.severity',
          count: { $sum: 1 },
          avgCvssScore: { $avg: '$cvssV3.baseScore' },
          avgEpssScore: { $avg: '$epssScore' },
          exploitCount: {
            $sum: { $cond: ['$exploitAvailable', 1, 0] }
          },
          kevCount: {
            $sum: { $cond: ['$cisaKev', 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          _id: 0,
          severity: '$_id',
          count: 1,
          avgCvssScore: { $round: ['$avgCvssScore', 2] },
          avgEpssScore: { $round: ['$avgEpssScore', 4] },
          exploitCount: 1,
          kevCount: 1,
          exploitPercentage: {
            $round: [{ $multiply: [{ $divide: ['$exploitCount', '$count'] }, 100] }, 2]
          }
        }
      }
    ]);

    return stats;
  } catch (error) {
    logger.error('getStatsBySeverity failed', { error: error.message });
    throw error;
  }
};

/**
 * Get trending CVEs based on EPSS score
 * @param {Number} limit - Number of results
 * @returns {Promise<Array>} Trending CVEs
 */
const getTrendingCVEs = async (limit = 10) => {
  try {
    const Cve = require('../models/Cve');
    
    const trending = await Cve.find({ epssScore: { $gt: 0 } })
      .select('cveId description publishedDate cvssV3 epssScore exploitAvailable cisaKev')
      .sort({ epssScore: -1, publishedDate: -1 })
      .limit(limit)
      .lean()
      .exec();

    return trending;
  } catch (error) {
    logger.error('getTrendingCVEs failed', { error: error.message });
    throw error;
  }
};

/**
 * Get CVEs by date range with optimized query
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} options - Query options
 * @returns {Promise<Array>} CVEs in date range
 */
const getCVEsByDateRange = async (startDate, endDate, options = {}) => {
  try {
    const Cve = require('../models/Cve');
    const { page = 1, limit = 25, severity = null } = options;

    const query = {
      publishedDate: {
        $gte: startDate,
        $lte: endDate
      }
    };

    if (severity) {
      query['cvssV3.severity'] = severity;
    }

    const skip = (page - 1) * limit;

    const [cves, total] = await Promise.all([
      Cve.find(query)
        .select('cveId description publishedDate cvssV3 epssScore exploitAvailable cisaKev')
        .sort({ publishedDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Cve.countDocuments(query)
    ]);

    return { cves, total };
  } catch (error) {
    logger.error('getCVEsByDateRange failed', { error: error.message });
    throw error;
  }
};

/**
 * Get top vendors by CVE count
 * @param {Number} limit - Number of results
 * @returns {Promise<Array>} Top vendors
 */
const getTopVendors = async (limit = 10) => {
  try {
    const Cve = require('../models/Cve');
    
    const topVendors = await Cve.aggregate([
      { $unwind: '$affectedProducts' },
      {
        $group: {
          _id: '$affectedProducts.vendor',
          cveCount: { $sum: 1 },
          criticalCount: {
            $sum: { $cond: [{ $eq: ['$cvssV3.severity', 'CRITICAL'] }, 1, 0] }
          },
          highCount: {
            $sum: { $cond: [{ $eq: ['$cvssV3.severity', 'HIGH'] }, 1, 0] }
          },
          avgCvssScore: { $avg: '$cvssV3.baseScore' }
        }
      },
      { $sort: { cveCount: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          vendor: '$_id',
          cveCount: 1,
          criticalCount: 1,
          highCount: 1,
          avgCvssScore: { $round: ['$avgCvssScore', 2] }
        }
      }
    ]);

    return topVendors;
  } catch (error) {
    logger.error('getTopVendors failed', { error: error.message });
    throw error;
  }
};

/**
 * Get database statistics
 * @returns {Promise<Object>} Database statistics
 */
const getDatabaseStats = async () => {
  try {
    const Cve = require('../models/Cve');
    const db = mongoose.connection.db;

    // Collection stats
    const collStats = await db.command({ collStats: 'cves' });

    // Index information
    const indexes = await Cve.collection.getIndexes();
    const indexStats = await Cve.collection.stats();

    // Document counts
    const totalDocs = await Cve.countDocuments();
    const criticalDocs = await Cve.countDocuments({ 'cvssV3.severity': 'CRITICAL' });
    const highDocs = await Cve.countDocuments({ 'cvssV3.severity': 'HIGH' });
    const exploitDocs = await Cve.countDocuments({ exploitAvailable: true });
    const kevDocs = await Cve.countDocuments({ cisaKev: true });

    return {
      collection: {
        name: collStats.ns,
        count: totalDocs,
        size: `${(collStats.size / 1024 / 1024).toFixed(2)} MB`,
        storageSize: `${(collStats.storageSize / 1024 / 1024).toFixed(2)} MB`,
        avgObjSize: `${(collStats.avgObjSize / 1024).toFixed(2)} KB`
      },
      indexes: {
        count: Object.keys(indexes).length,
        totalSize: `${(indexStats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`,
        list: Object.keys(indexes)
      },
      documents: {
        total: totalDocs,
        critical: criticalDocs,
        high: highDocs,
        withExploits: exploitDocs,
        inKEV: kevDocs
      }
    };
  } catch (error) {
    logger.error('getDatabaseStats failed', { error: error.message });
    throw error;
  }
};

/**
 * Analyze slow queries using profiling
 * @param {Number} thresholdMs - Slow query threshold in milliseconds
 * @returns {Promise<Array>} Slow queries
 */
const analyzeSlowQueries = async (thresholdMs = 100) => {
  try {
    const db = mongoose.connection.db;
    
    // Enable profiling if not already enabled
    const profilingStatus = await db.command({ profile: -1 });
    
    if (profilingStatus.was === 0) {
      logger.info('Enabling database profiling for slow query analysis');
      await db.command({ profile: 1, slowms: thresholdMs });
    }

    // Query system.profile collection
    const systemProfile = db.collection('system.profile');
    
    const slowQueries = await systemProfile
      .find({
        ns: { $regex: /cves$/ },
        millis: { $gte: thresholdMs },
        op: { $in: ['query', 'getmore'] }
      })
      .sort({ millis: -1 })
      .limit(20)
      .toArray();

    const analyzed = slowQueries.map(query => ({
      operation: query.op,
      duration: `${query.millis}ms`,
      timestamp: query.ts,
      command: query.command,
      planSummary: query.planSummary,
      docsExamined: query.docsExamined,
      keysExamined: query.keysExamined,
      nreturned: query.nreturned
    }));

    return analyzed;
  } catch (error) {
    logger.error('analyzeSlowQueries failed', { error: error.message });
    return [];
  }
};

/**
 * Suggest missing indexes based on query patterns
 * @returns {Promise<Array>} Index suggestions
 */
const suggestIndexes = async () => {
  try {
    const suggestions = [];
    const Cve = require('../models/Cve');
    
    // Check if indexes exist
    const indexes = await Cve.collection.getIndexes();
    const indexNames = Object.keys(indexes);

    // Analyze common query patterns
    const patterns = [
      {
        name: 'severity_publishedDate',
        fields: { 'cvssV3.severity': 1, publishedDate: -1 },
        reason: 'Frequently used for filtering by severity and sorting by date'
      },
      {
        name: 'exploitAvailable_cisaKev',
        fields: { exploitAvailable: 1, cisaKev: 1 },
        reason: 'Used for finding exploitable or KEV vulnerabilities'
      },
      {
        name: 'vendor_publishedDate',
        fields: { 'affectedProducts.vendor': 1, publishedDate: -1 },
        reason: 'Used for vendor-specific queries sorted by date'
      },
      {
        name: 'epssScore_desc',
        fields: { epssScore: -1 },
        reason: 'Used for trending CVE queries'
      }
    ];

    // Check which indexes are missing
    for (const pattern of patterns) {
      const indexExists = indexNames.some(name => name.includes(pattern.name));
      
      if (!indexExists) {
        suggestions.push({
          name: pattern.name,
          fields: pattern.fields,
          reason: pattern.reason,
          createCommand: `db.cves.createIndex(${JSON.stringify(pattern.fields)}, { name: '${pattern.name}' })`
        });
      }
    }

    // Analyze slow queries for additional suggestions
    const slowQueries = await analyzeSlowQueries(100);
    
    for (const query of slowQueries) {
      if (query.docsExamined > query.nreturned * 10) {
        suggestions.push({
          name: 'custom_' + Date.now(),
          reason: `High docs examined ratio (${query.docsExamined}/${query.nreturned})`,
          query: query.command,
          planSummary: query.planSummary
        });
      }
    }

    return suggestions;
  } catch (error) {
    logger.error('suggestIndexes failed', { error: error.message });
    return [];
  }
};

/**
 * Optimize query by adding lean() and selecting only needed fields
 * @param {Object} query - Mongoose query object
 * @param {Array} fields - Fields to select
 * @returns {Object} Optimized query
 */
const optimizeQuery = (query, fields = []) => {
  if (fields.length > 0) {
    query.select(fields.join(' '));
  }
  return query.lean();
};

/**
 * Run full database optimization
 * @returns {Promise<Object>} Optimization results
 */
const runOptimization = async () => {
  logger.info('Starting database optimization...');
  
  try {
    const results = {
      indexes: null,
      stats: null,
      suggestions: null,
      duration: 0
    };

    const startTime = Date.now();

    // Create indexes
    results.indexes = await createIndexes();

    // Get database stats
    results.stats = await getDatabaseStats();

    // Get index suggestions
    results.suggestions = await suggestIndexes();

    results.duration = Date.now() - startTime;

    logger.info('Database optimization completed', {
      duration: `${results.duration}ms`,
      indexesCreated: results.indexes.created.length,
      suggestions: results.suggestions.length
    });

    return results;
  } catch (error) {
    logger.error('Database optimization failed', { error: error.message });
    throw error;
  }
};

/**
 * Drop unused indexes
 * @param {Array} indexNames - Array of index names to drop
 * @returns {Promise<Object>} Drop results
 */
const dropIndexes = async (indexNames = []) => {
  try {
    const Cve = require('../models/Cve');
    const results = {
      dropped: [],
      errors: []
    };

    for (const indexName of indexNames) {
      try {
        await Cve.collection.dropIndex(indexName);
        results.dropped.push(indexName);
        logger.info(`Dropped index: ${indexName}`);
      } catch (error) {
        results.errors.push({ index: indexName, error: error.message });
        logger.error(`Failed to drop index: ${indexName}`, { error: error.message });
      }
    }

    return results;
  } catch (error) {
    logger.error('dropIndexes failed', { error: error.message });
    throw error;
  }
};

/**
 * Compact collection to reclaim disk space
 * @returns {Promise<Object>} Compact results
 */
const compactCollection = async () => {
  try {
    const db = mongoose.connection.db;
    
    logger.info('Starting collection compaction...');
    const result = await db.command({ compact: 'cves', force: true });
    logger.info('Collection compaction completed', result);
    
    return result;
  } catch (error) {
    logger.error('compactCollection failed', { error: error.message });
    throw error;
  }
};

module.exports = {
  // Index management
  createIndexes,
  dropIndexes,
  
  // Aggregation helpers
  getStatsBySeverity,
  getTrendingCVEs,
  getCVEsByDateRange,
  getTopVendors,
  
  // Query optimization
  optimizeQuery,
  
  // Performance monitoring
  getDatabaseStats,
  analyzeSlowQueries,
  suggestIndexes,
  
  // Maintenance
  runOptimization,
  compactCollection
};
