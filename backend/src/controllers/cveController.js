const Cve = require('../models/Cve');
const syncService = require('../services/syncService');

/**
 * Get all CVEs with pagination, filters, sorting, and search
 */
const getAllCVEs = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    
    // Validate pagination
    if (page < 1 || limit < 1 || limit > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters. Page >= 1, limit between 1-1000'
      });
    }
    
    // Build filter query
    const filter = {};
    
    // Severity filter
    if (req.query.severity) {
      const severities = Array.isArray(req.query.severity) 
        ? req.query.severity 
        : [req.query.severity];
      filter['cvssV3.baseSeverity'] = { $in: severities.map(s => s.toUpperCase()) };
    }
    
    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.publishedDate = {};
      if (req.query.startDate) {
        filter.publishedDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.publishedDate.$lte = new Date(req.query.endDate);
      }
    }
    
    // Exploit available filter
    if (req.query.exploitAvailable !== undefined) {
      filter.exploitAvailable = req.query.exploitAvailable === 'true';
    }
    
    // CISA KEV filter
    if (req.query.cisaKev !== undefined) {
      filter.cisaKev = req.query.cisaKev === 'true';
    }
    
    // Vendor filter
    if (req.query.vendor) {
      filter['affectedProducts.vendor'] = {
        $regex: req.query.vendor,
        $options: 'i'
      };
    }
    
    // Product filter
    if (req.query.product) {
      filter['affectedProducts.product'] = {
        $regex: req.query.product,
        $options: 'i'
      };
    }
    
    // CVSS score range
    if (req.query.minCvss || req.query.maxCvss) {
      filter['cvssV3.baseScore'] = {};
      if (req.query.minCvss) {
        filter['cvssV3.baseScore'].$gte = parseFloat(req.query.minCvss);
      }
      if (req.query.maxCvss) {
        filter['cvssV3.baseScore'].$lte = parseFloat(req.query.maxCvss);
      }
    }
    
    // EPSS score range
    if (req.query.minEpss || req.query.maxEpss) {
      filter.epssScore = {};
      if (req.query.minEpss) {
        filter.epssScore.$gte = parseFloat(req.query.minEpss);
      }
      if (req.query.maxEpss) {
        filter.epssScore.$lte = parseFloat(req.query.maxEpss);
      }
    }
    
    // Text search
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }
    
    // Build sort
    let sort = {};
    const sortBy = req.query.sortBy || 'publishedDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    
    switch (sortBy) {
      case 'publishedDate':
        sort.publishedDate = sortOrder;
        break;
      case 'cvssScore':
        sort['cvssV3.baseScore'] = sortOrder;
        break;
      case 'epssScore':
        sort.epssScore = sortOrder;
        break;
      case 'lastModifiedDate':
        sort.lastModifiedDate = sortOrder;
        break;
      default:
        sort.publishedDate = -1;
    }
    
    // Execute query
    const [cves, total] = await Promise.all([
      Cve.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Cve.countDocuments(filter)
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: cves,
      pagination: {
        page,
        limit,
        total,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Error in getAllCVEs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CVEs',
      message: error.message
    });
  }
};

/**
 * Get single CVE by ID
 */
const getCVEById = async (req, res) => {
  try {
    const { cveId } = req.params;
    
    // Validate CVE ID format
    if (!cveId.match(/^CVE-\d{4}-\d+$/i)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CVE ID format. Expected: CVE-YYYY-NNNNN'
      });
    }
    
    const cve = await Cve.findOne({ cveId: cveId.toUpperCase() });
    
    if (!cve) {
      return res.status(404).json({
        success: false,
        error: 'CVE not found',
        cveId: cveId.toUpperCase()
      });
    }
    
    res.json({
      success: true,
      data: cve
    });
    
  } catch (error) {
    console.error('❌ Error in getCVEById:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CVE',
      message: error.message
    });
  }
};

/**
 * Get CVE statistics
 */
const getStats = async (req, res) => {
  try {
    // Total CVEs
    const total = await Cve.countDocuments();
    
    // By severity
    const severityCounts = await Cve.aggregate([
      {
        $group: {
          _id: '$cvssV3.baseSeverity',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const bySeverity = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      NONE: 0
    };
    
    severityCounts.forEach(item => {
      if (item._id && bySeverity.hasOwnProperty(item._id)) {
        bySeverity[item._id] = item.count;
      }
    });
    
    // Recent trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTrends = await Cve.aggregate([
      {
        $match: {
          publishedDate: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$publishedDate' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Top vendors
    const topVendors = await Cve.aggregate([
      { $unwind: '$affectedProducts' },
      {
        $group: {
          _id: '$affectedProducts.vendor',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Exploit statistics
    const exploitStats = await Cve.aggregate([
      {
        $group: {
          _id: null,
          totalWithExploit: {
            $sum: { $cond: ['$exploitAvailable', 1, 0] }
          },
          totalInCisaKev: {
            $sum: { $cond: ['$cisaKev', 1, 0] }
          },
          avgEpssScore: { $avg: '$epssScore' }
        }
      }
    ]);
    
    const exploitData = exploitStats[0] || {
      totalWithExploit: 0,
      totalInCisaKev: 0,
      avgEpssScore: 0
    };
    
    // Average CVSS score
    const cvssStats = await Cve.aggregate([
      {
        $match: {
          'cvssV3.baseScore': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          avgCvss: { $avg: '$cvssV3.baseScore' },
          maxCvss: { $max: '$cvssV3.baseScore' },
          minCvss: { $min: '$cvssV3.baseScore' }
        }
      }
    ]);
    
    const cvssData = cvssStats[0] || {
      avgCvss: 0,
      maxCvss: 0,
      minCvss: 0
    };
    
    // Recent additions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentAdditions = await Cve.countDocuments({
      publishedDate: { $gte: sevenDaysAgo }
    });
    
    res.json({
      success: true,
      data: {
        total,
        bySeverity,
        recentTrends: recentTrends.map(item => ({
          date: item._id,
          count: item.count
        })),
        topVendors: topVendors.map(item => ({
          vendor: item._id,
          count: item.count
        })),
        exploits: {
          withExploit: exploitData.totalWithExploit,
          inCisaKev: exploitData.totalInCisaKev,
          avgEpssScore: exploitData.avgEpssScore ? exploitData.avgEpssScore.toFixed(4) : '0.0000'
        },
        cvss: {
          average: cvssData.avgCvss ? cvssData.avgCvss.toFixed(2) : '0.00',
          max: cvssData.maxCvss,
          min: cvssData.minCvss
        },
        recentAdditions
      }
    });
    
  } catch (error) {
    console.error('❌ Error in getStats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
};

/**
 * Advanced search CVEs
 */
const searchCVEs = async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    // Pagination
    const page = parseInt(req.body.page) || 1;
    const limit = parseInt(req.body.limit) || 25;
    const skip = (page - 1) * limit;
    
    // Build search filter
    const filter = {
      $or: [
        { cveId: { $regex: query, $options: 'i' } },
        { 'descriptions.value': { $regex: query, $options: 'i' } },
        { 'affectedProducts.vendor': { $regex: query, $options: 'i' } },
        { 'affectedProducts.product': { $regex: query, $options: 'i' } }
      ]
    };
    
    // Add additional filters from body
    if (req.body.severity) {
      filter['cvssV3.baseSeverity'] = { $in: req.body.severity };
    }
    
    if (req.body.exploitAvailable !== undefined) {
      filter.exploitAvailable = req.body.exploitAvailable;
    }
    
    if (req.body.cisaKev !== undefined) {
      filter.cisaKev = req.body.cisaKev;
    }
    
    // Execute search
    const [results, total] = await Promise.all([
      Cve.find(filter)
        .sort({ publishedDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Cve.countDocuments(filter)
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: results,
      pagination: {
        page,
        limit,
        total,
        pages: totalPages
      },
      query
    });
    
  } catch (error) {
    console.error('❌ Error in searchCVEs:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
};

/**
 * Get trending CVEs (by EPSS score)
 */
const getTrendingCVEs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const minEpss = parseFloat(req.query.minEpss) || 0.1;
    
    // Validate
    if (limit < 1 || limit > 500) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be between 1 and 500'
      });
    }
    
    if (minEpss < 0 || minEpss > 1) {
      return res.status(400).json({
        success: false,
        error: 'minEpss must be between 0 and 1'
      });
    }
    
    // Build filter
    const filter = {
      epssScore: { $gte: minEpss }
    };
    
    // Optional filters
    if (req.query.severity) {
      filter['cvssV3.baseSeverity'] = req.query.severity.toUpperCase();
    }
    
    if (req.query.recentOnly === 'true') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filter.publishedDate = { $gte: thirtyDaysAgo };
    }
    
    // Get trending CVEs
    const trending = await Cve.find(filter)
      .sort({ epssScore: -1, publishedDate: -1 })
      .limit(limit)
      .lean();
    
    res.json({
      success: true,
      data: trending,
      count: trending.length,
      filters: {
        minEpss,
        limit
      }
    });
    
  } catch (error) {
    console.error('❌ Error in getTrendingCVEs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending CVEs',
      message: error.message
    });
  }
};

/**
 * Get CVEs by vendor
 */
const getCVEsByVendor = async (req, res) => {
  try {
    const { vendor } = req.params;
    
    if (!vendor) {
      return res.status(400).json({
        success: false,
        error: 'Vendor parameter is required'
      });
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    
    // Sort
    const sortBy = req.query.sortBy || 'publishedDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };
    
    // Filter
    const filter = {
      'affectedProducts.vendor': {
        $regex: vendor,
        $options: 'i'
      }
    };
    
    // Execute query
    const [cves, total] = await Promise.all([
      Cve.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Cve.countDocuments(filter)
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: cves,
      vendor,
      pagination: {
        page,
        limit,
        total,
        pages: totalPages
      }
    });
    
  } catch (error) {
    console.error('❌ Error in getCVEsByVendor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CVEs by vendor',
      message: error.message
    });
  }
};

/**
 * Trigger manual CVE sync
 */
const syncCVEs = async (req, res) => {
  try {
    const options = req.body || {};
    
    // Validate options
    if (options.dateRange) {
      if (!options.dateRange.startDate || !options.dateRange.endDate) {
        return res.status(400).json({
          success: false,
          error: 'dateRange requires both startDate and endDate'
        });
      }
    }
    
    // Check if sync is already running
    const currentStatus = syncService.getStatus();
    if (currentStatus && currentStatus.status === 'running') {
      return res.status(409).json({
        success: false,
        error: 'Sync already in progress',
        syncId: currentStatus.id
      });
    }
    
    // For SSE (Server-Sent Events)
    if (req.query.stream === 'true') {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Send initial message
      res.write(`data: ${JSON.stringify({ type: 'start', message: 'Sync starting...' })}\n\n`);
      
      // Listen to sync events
      const onProgress = (data) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', ...data })}\n\n`);
      };
      
      const onComplete = (data) => {
        res.write(`data: ${JSON.stringify({ type: 'complete', ...data })}\n\n`);
        res.end();
      };
      
      const onError = (data) => {
        res.write(`data: ${JSON.stringify({ type: 'error', ...data })}\n\n`);
        res.end();
      };
      
      syncService.on('sync:progress', onProgress);
      syncService.on('sync:complete', onComplete);
      syncService.on('sync:error', onError);
      
      // Start sync
      syncService.syncCVEData(options).catch(error => {
        console.error('Sync error:', error);
      });
      
      // Clean up on client disconnect
      req.on('close', () => {
        syncService.removeListener('sync:progress', onProgress);
        syncService.removeListener('sync:complete', onComplete);
        syncService.removeListener('sync:error', onError);
      });
      
    } else {
      // Non-streaming response (fire and forget)
      const syncId = Date.now();
      
      // Start sync in background
      syncService.syncCVEData(options)
        .then(result => {
          console.log('✅ Sync completed:', result);
        })
        .catch(error => {
          console.error('❌ Sync failed:', error);
        });
      
      res.status(202).json({
        success: true,
        message: 'Sync started',
        syncId,
        options
      });
    }
    
  } catch (error) {
    console.error('❌ Error in syncCVEs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start sync',
      message: error.message
    });
  }
};

/**
 * Get sync status
 */
const getSyncStatus = async (req, res) => {
  try {
    const status = syncService.getStatus();
    
    if (!status) {
      return res.json({
        success: true,
        data: {
          status: 'idle',
          message: 'No sync in progress'
        }
      });
    }
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('❌ Error in getSyncStatus:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
      message: error.message
    });
  }
};

/**
 * Abort running sync
 */
const abortSync = async (req, res) => {
  try {
    const status = syncService.getStatus();
    
    if (!status || status.status !== 'running') {
      return res.status(400).json({
        success: false,
        error: 'No sync in progress'
      });
    }
    
    syncService.abort();
    
    res.json({
      success: true,
      message: 'Sync abort requested',
      syncId: status.id
    });
    
  } catch (error) {
    console.error('❌ Error in abortSync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to abort sync',
      message: error.message
    });
  }
};

/**
 * Export CVEs to CSV or JSON
 */
const exportCVEs = async (req, res) => {
  try {
    const format = req.query.format || 'json';
    
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Use json or csv'
      });
    }
    
    // Build filter (same as getAllCVEs)
    const filter = {};
    
    if (req.query.severity) {
      filter['cvssV3.baseSeverity'] = req.query.severity.toUpperCase();
    }
    
    if (req.query.startDate || req.query.endDate) {
      filter.publishedDate = {};
      if (req.query.startDate) {
        filter.publishedDate.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.publishedDate.$lte = new Date(req.query.endDate);
      }
    }
    
    if (req.query.exploitAvailable !== undefined) {
      filter.exploitAvailable = req.query.exploitAvailable === 'true';
    }
    
    if (req.query.cisaKev !== undefined) {
      filter.cisaKev = req.query.cisaKev === 'true';
    }
    
    // Limit export size
    const limit = parseInt(req.query.limit) || 1000;
    if (limit > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Export limit cannot exceed 10,000 records'
      });
    }
    
    // Fetch data
    const cves = await Cve.find(filter)
      .sort({ publishedDate: -1 })
      .limit(limit)
      .lean();
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="cves-${Date.now()}.json"`);
      res.json(cves);
    } else {
      // CSV format
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="cves-${Date.now()}.csv"`);
      
      // CSV headers
      const headers = [
        'CVE ID',
        'Published Date',
        'Modified Date',
        'CVSS Score',
        'Severity',
        'EPSS Score',
        'Exploit Available',
        'CISA KEV',
        'Description'
      ];
      
      res.write(headers.join(',') + '\n');
      
      // CSV rows
      cves.forEach(cve => {
        const row = [
          cve.cveId,
          cve.publishedDate ? new Date(cve.publishedDate).toISOString() : '',
          cve.lastModifiedDate ? new Date(cve.lastModifiedDate).toISOString() : '',
          cve.cvssV3?.baseScore || cve.cvssV2?.baseScore || '',
          cve.cvssV3?.baseSeverity || '',
          cve.epssScore || '',
          cve.exploitAvailable ? 'Yes' : 'No',
          cve.cisaKev ? 'Yes' : 'No',
          cve.descriptions?.[0]?.value ? `"${cve.descriptions[0].value.replace(/"/g, '""')}"` : ''
        ];
        
        res.write(row.join(',') + '\n');
      });
      
      res.end();
    }
    
  } catch (error) {
    console.error('❌ Error in exportCVEs:', error);
    res.status(500).json({
      success: false,
      error: 'Export failed',
      message: error.message
    });
  }
};

module.exports = {
  getAllCVEs,
  getCVEById,
  getStats,
  searchCVEs,
  getTrendingCVEs,
  getCVEsByVendor,
  syncCVEs,
  getSyncStatus,
  abortSync,
  exportCVEs
};
