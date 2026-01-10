const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const nvdService = require('./nvdService');
const epssService = require('./epssService');
const cisaKevService = require('./cisaKevService');
const osvService = require('./osvService');
const Cve = require('../models/Cve');

// Sync state file for resume capability
const SYNC_STATE_FILE = path.join(__dirname, '../../.sync-state.json');

// Batch sizes
const BATCH_SIZE = 100; // Process CVEs in batches
const EPSS_BATCH_SIZE = 1000; // EPSS supports up to 1000 CVEs

/**
 * Sync Service Event Emitter
 */
class SyncService extends EventEmitter {
  constructor() {
    super();
    this.currentSync = null;
    this.aborted = false;
  }

  /**
   * Main CVE data sync function
   * @param {Object} options - Sync options
   * @param {Object} options.dateRange - {startDate, endDate}
   * @param {Boolean} options.full - Full sync (all CVEs)
   * @param {Array<String>} options.vendors - Filter by vendors
   * @param {Boolean} options.incremental - Incremental sync (last 7 days)
   * @param {Boolean} options.resume - Resume from last state
   * @returns {Promise<Object>} Sync statistics
   */
  async syncCVEData(options = {}) {
    const syncId = Date.now();
    const startTime = Date.now();
    
    console.log('🚀 Starting CVE Data Sync...');
    console.log(`   Sync ID: ${syncId}`);
    console.log(`   Options:`, JSON.stringify(options, null, 2));
    
    // Reset abort flag
    this.aborted = false;
    
    // Initialize sync state
    this.currentSync = {
      id: syncId,
      startTime,
      status: 'running',
      progress: {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0
      },
      stats: {
        fetched: 0,
        new: 0,
        updated: 0,
        errors: 0,
        apiCalls: {
          nvd: 0,
          epss: 0,
          cisaKev: 0,
          osv: 0
        }
      },
      failedCveIds: [],
      processedCveIds: new Set()
    };
    
    this.emit('sync:start', {
      syncId,
      options,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Load resume state if requested
      if (options.resume) {
        await this.loadResumeState();
      }
      
      // Step 1: Fetch CVEs from NVD
      console.log('\n📥 Step 1: Fetching CVEs from NVD...');
      const cveList = await this.fetchCVEsFromNVD(options);
      
      if (this.aborted) {
        throw new Error('Sync aborted by user');
      }
      
      this.currentSync.progress.total = cveList.length;
      this.currentSync.stats.fetched = cveList.length;
      
      console.log(`✅ Fetched ${cveList.length} CVEs from NVD`);
      
      this.emit('sync:fetched', {
        syncId,
        count: cveList.length,
        timestamp: new Date().toISOString()
      });
      
      // Step 2: Process CVEs in batches
      console.log('\n🔄 Step 2: Processing and enriching CVEs...');
      await this.processCVEBatches(cveList, options);
      
      if (this.aborted) {
        throw new Error('Sync aborted by user');
      }
      
      // Step 3: Retry failed CVEs
      if (this.currentSync.failedCveIds.length > 0 && !options.skipRetry) {
        console.log(`\n🔁 Step 3: Retrying ${this.currentSync.failedCveIds.length} failed CVEs...`);
        await this.retryFailedCVEs();
      }
      
      // Calculate final statistics
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      this.currentSync.status = 'completed';
      this.currentSync.endTime = endTime;
      this.currentSync.elapsed = elapsed;
      
      const result = {
        syncId,
        status: 'completed',
        statistics: {
          total: this.currentSync.progress.total,
          fetched: this.currentSync.stats.fetched,
          new: this.currentSync.stats.new,
          updated: this.currentSync.stats.updated,
          errors: this.currentSync.stats.errors,
          successful: this.currentSync.progress.successful,
          failed: this.currentSync.progress.failed,
          skipped: this.currentSync.progress.skipped
        },
        apiCalls: this.currentSync.stats.apiCalls,
        elapsed: {
          milliseconds: elapsed,
          seconds: Math.floor(elapsed / 1000),
          formatted: this.formatDuration(elapsed)
        },
        failedCveIds: this.currentSync.failedCveIds,
        timestamp: new Date().toISOString()
      };
      
      console.log('\n✅ CVE Data Sync Completed!');
      console.log(`   Total CVEs: ${result.statistics.total}`);
      console.log(`   New: ${result.statistics.new}`);
      console.log(`   Updated: ${result.statistics.updated}`);
      console.log(`   Errors: ${result.statistics.errors}`);
      console.log(`   Time: ${result.elapsed.formatted}`);
      
      this.emit('sync:complete', result);
      
      // Clear resume state on success
      await this.clearResumeState();
      
      return result;
      
    } catch (error) {
      console.error('❌ CVE Data Sync Failed:', error.message);
      
      this.currentSync.status = 'failed';
      this.currentSync.error = error.message;
      
      // Save state for resume
      await this.saveResumeState();
      
      this.emit('sync:error', {
        syncId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Fetch CVEs from NVD based on options
   */
  async fetchCVEsFromNVD(options) {
    let cves = [];
    
    // Determine date range
    let startDate, endDate;
    
    if (options.full) {
      // Full sync: last 3 years
      endDate = new Date();
      startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 3);
      console.log(`   Full sync: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    } else if (options.incremental) {
      // Incremental: last 7 days
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      console.log(`   Incremental sync: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    } else if (options.dateRange) {
      startDate = new Date(options.dateRange.startDate);
      endDate = new Date(options.dateRange.endDate);
      console.log(`   Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    } else {
      // Default: last 30 days
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      console.log(`   Default sync: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    }
    
    // Fetch from NVD
    const onProgress = (progress) => {
      console.log(`   Progress: ${progress.fetched}/${progress.total} CVEs (${progress.percentage}%)`);
      this.emit('sync:progress', {
        phase: 'fetch',
        ...progress
      });
    };
    
    // Format dates as ISO 8601 with time component for NVD API
    const formatNVDDate = (date) => {
      return date.toISOString().split('.')[0] + '.000';
    };
    
    cves = await nvdService.getCVEsByDateRange(
      formatNVDDate(startDate),
      formatNVDDate(endDate),
      onProgress
    );
    
    this.currentSync.stats.apiCalls.nvd++;
    
    // Filter by vendors if specified
    if (options.vendors && Array.isArray(options.vendors)) {
      const originalCount = cves.length;
      cves = cves.filter(cve => 
        options.vendors.some(vendor => 
          cve.affectedProducts.some(prod => 
            prod.vendor.toLowerCase().includes(vendor.toLowerCase())
          )
        )
      );
      console.log(`   Filtered by vendors: ${cves.length}/${originalCount} CVEs`);
    }
    
    return cves;
  }

  /**
   * Process CVEs in batches
   */
  async processCVEBatches(cveList, options) {
    const totalBatches = Math.ceil(cveList.length / BATCH_SIZE);
    
    for (let i = 0; i < cveList.length; i += BATCH_SIZE) {
      if (this.aborted) {
        console.log('⚠️  Sync aborted, stopping batch processing');
        break;
      }
      
      const batch = cveList.slice(i, Math.min(i + BATCH_SIZE, cveList.length));
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      console.log(`\n📦 Processing Batch ${batchNum}/${totalBatches} (${batch.length} CVEs)...`);
      
      // Extract CVE IDs for enrichment
      const cveIds = batch.map(cve => cve.cveId);
      
      // Enrich with EPSS scores (bulk)
      const epssScores = await this.fetchEPSSScores(cveIds);
      
      // Check CISA KEV status (bulk)
      const kevData = await this.checkCISAKEV(cveIds);
      
      // Process each CVE in batch
      for (const cve of batch) {
        if (this.aborted) break;
        
        // Skip if already processed (resume scenario)
        if (this.currentSync.processedCveIds.has(cve.cveId)) {
          this.currentSync.progress.skipped++;
          continue;
        }
        
        try {
          await this.processSingleCVE(cve, epssScores, kevData, options);
          this.currentSync.progress.successful++;
        } catch (error) {
          console.error(`   ❌ Failed to process ${cve.cveId}:`, error.message);
          this.currentSync.progress.failed++;
          this.currentSync.stats.errors++;
          this.currentSync.failedCveIds.push(cve.cveId);
        }
        
        this.currentSync.progress.processed++;
        this.currentSync.processedCveIds.add(cve.cveId);
        
        // Emit progress
        if (this.currentSync.progress.processed % 10 === 0) {
          this.emitProgress();
        }
        
        // Save resume state periodically
        if (this.currentSync.progress.processed % 50 === 0) {
          await this.saveResumeState();
        }
      }
      
      console.log(`✅ Batch ${batchNum} complete`);
    }
  }

  /**
   * Fetch EPSS scores for CVE batch
   */
  async fetchEPSSScores(cveIds) {
    try {
      console.log(`   📊 Fetching EPSS scores for ${cveIds.length} CVEs...`);
      const scores = await epssService.getEPSSScores(cveIds);
      this.currentSync.stats.apiCalls.epss++;
      console.log(`   ✅ Retrieved ${scores.size} EPSS scores`);
      return scores;
    } catch (error) {
      console.error(`   ⚠️  EPSS fetch failed:`, error.message);
      return new Map();
    }
  }

  /**
   * Check CISA KEV status for CVE batch
   */
  async checkCISAKEV(cveIds) {
    try {
      console.log(`   🔐 Checking CISA KEV status...`);
      const kevList = await cisaKevService.getKEVList();
      this.currentSync.stats.apiCalls.cisaKev++;
      
      const kevSet = new Set(kevList);
      const kevDetails = new Map();
      
      for (const cveId of cveIds) {
        if (kevSet.has(cveId)) {
          const details = await cisaKevService.getKEVDetails(cveId);
          if (details) {
            kevDetails.set(cveId, details);
          }
        }
      }
      
      console.log(`   ✅ Found ${kevDetails.size} CVEs in CISA KEV`);
      return kevDetails;
    } catch (error) {
      console.error(`   ⚠️  CISA KEV check failed:`, error.message);
      return new Map();
    }
  }

  /**
   * Process single CVE
   */
  async processSingleCVE(cve, epssScores, kevData, options) {
    // Check if CVE exists in database
    const existing = await Cve.findOne({ cveId: cve.cveId });
    
    // Extract description (prefer English)
    const description = cve.descriptions?.find(d => d.lang === 'en')?.value || 
                       cve.descriptions?.[0]?.value || 
                       'No description available';
    
    // Determine severity from CVSS scores
    let severity = 'NONE';
    if (cve.cvssV3?.severity) {
      severity = cve.cvssV3.severity;
    } else if (cve.cvssV2?.severity) {
      severity = cve.cvssV2.severity;
    }
    
    // Build CVE document
    const cveData = {
      cveId: cve.cveId,
      description: description,
      sourceIdentifier: cve.sourceIdentifier,
      publishedDate: cve.publishedDate,
      lastModifiedDate: cve.lastModifiedDate,
      vulnStatus: cve.vulnStatus,
      severity: severity,
      
      // CVSS scores
      cvssV3: cve.cvssV3,
      cvssV2: cve.cvssV2,
      
      // CWE
      cwe: cve.cwe,
      
      // References
      references: cve.references,
      
      // Affected products
      affectedProducts: cve.affectedProducts,
      
      // Enrich with EPSS
      epssScore: null,
      epssPercentile: null,
      epssDate: null,
      
      // CISA KEV
      cisaKev: false,
      cisaKevData: null,
      
      // Exploit availability
      exploitAvailable: false,
      
      // Metadata
      lastSyncDate: new Date()
    };
    
    // Add EPSS data
    if (epssScores.has(cve.cveId)) {
      const epss = epssScores.get(cve.cveId);
      cveData.epssScore = epss.score;
      cveData.epssPercentile = epss.percentile;
      cveData.epssDate = epss.date;
    }
    
    // Add CISA KEV data
    if (kevData.has(cve.cveId)) {
      const kev = kevData.get(cve.cveId);
      cveData.cisaKev = true;
      cveData.cisaKevData = {
        dateAdded: kev.dateAdded,
        dueDate: kev.dueDate,
        requiredAction: kev.requiredAction,
        knownRansomwareCampaignUse: kev.knownRansomwareCampaignUse
      };
      cveData.exploitAvailable = true;
    }
    
    // Check OSV for additional data (optional, can be slow)
    if (options.checkOSV) {
      try {
        const osvData = await osvService.getVulnerabilitiesByCVE(cve.cveId);
        this.currentSync.stats.apiCalls.osv++;
        
        if (osvData.length > 0) {
          // Mark as having exploit if found in OSV
          cveData.exploitAvailable = true;
        }
      } catch (error) {
        // OSV check is optional, don't fail on error
      }
    }
    
    // Upsert to database
    if (existing) {
      // Update existing
      await Cve.updateOne(
        { cveId: cve.cveId },
        { $set: cveData }
      );
      this.currentSync.stats.updated++;
    } else {
      // Create new
      await Cve.create(cveData);
      this.currentSync.stats.new++;
    }
  }

  /**
   * Retry failed CVEs
   */
  async retryFailedCVEs() {
    const failedIds = [...this.currentSync.failedCveIds];
    this.currentSync.failedCveIds = [];
    
    for (const cveId of failedIds) {
      if (this.aborted) break;
      
      try {
        console.log(`   🔁 Retrying ${cveId}...`);
        
        // Fetch single CVE from NVD
        const cve = await nvdService.getCVEById(cveId);
        this.currentSync.stats.apiCalls.nvd++;
        
        // Fetch enrichment data
        const epssScores = await this.fetchEPSSScores([cveId]);
        const kevData = await this.checkCISAKEV([cveId]);
        
        // Process
        await this.processSingleCVE(cve, epssScores, kevData, {});
        
        console.log(`   ✅ Retry successful: ${cveId}`);
        this.currentSync.progress.successful++;
        this.currentSync.stats.errors--;
        
      } catch (error) {
        console.error(`   ❌ Retry failed: ${cveId}`, error.message);
        this.currentSync.failedCveIds.push(cveId);
      }
    }
    
    console.log(`   Retry complete: ${failedIds.length - this.currentSync.failedCveIds.length}/${failedIds.length} recovered`);
  }

  /**
   * Emit progress event
   */
  emitProgress() {
    const progress = this.currentSync.progress;
    const percentage = progress.total > 0 
      ? Math.floor((progress.processed / progress.total) * 100)
      : 0;
    
    // Estimate time remaining
    const elapsed = Date.now() - this.currentSync.startTime;
    const rate = progress.processed / (elapsed / 1000); // CVEs per second
    const remaining = progress.total - progress.processed;
    const estimatedSeconds = remaining / rate;
    
    this.emit('sync:progress', {
      phase: 'process',
      total: progress.total,
      processed: progress.processed,
      successful: progress.successful,
      failed: progress.failed,
      skipped: progress.skipped,
      percentage,
      rate: rate.toFixed(2),
      estimatedTimeRemaining: this.formatDuration(estimatedSeconds * 1000),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Save resume state to file
   */
  async saveResumeState() {
    try {
      const state = {
        syncId: this.currentSync.id,
        startTime: this.currentSync.startTime,
        progress: this.currentSync.progress,
        stats: this.currentSync.stats,
        failedCveIds: this.currentSync.failedCveIds,
        processedCveIds: Array.from(this.currentSync.processedCveIds),
        timestamp: Date.now()
      };
      
      await fs.writeFile(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('⚠️  Failed to save resume state:', error.message);
    }
  }

  /**
   * Load resume state from file
   */
  async loadResumeState() {
    try {
      const data = await fs.readFile(SYNC_STATE_FILE, 'utf8');
      const state = JSON.parse(data);
      
      console.log('📂 Loading resume state...');
      console.log(`   Sync ID: ${state.syncId}`);
      console.log(`   Processed: ${state.progress.processed}/${state.progress.total}`);
      
      this.currentSync.progress = state.progress;
      this.currentSync.stats = state.stats;
      this.currentSync.failedCveIds = state.failedCveIds;
      this.currentSync.processedCveIds = new Set(state.processedCveIds);
      
      console.log('✅ Resume state loaded');
    } catch (error) {
      console.log('ℹ️  No resume state found, starting fresh');
    }
  }

  /**
   * Clear resume state file
   */
  async clearResumeState() {
    try {
      await fs.unlink(SYNC_STATE_FILE);
    } catch (error) {
      // File doesn't exist, ignore
    }
  }

  /**
   * Abort current sync
   */
  abort() {
    if (this.currentSync && this.currentSync.status === 'running') {
      console.log('🛑 Aborting sync...');
      this.aborted = true;
      this.emit('sync:abort', {
        syncId: this.currentSync.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get current sync status
   */
  getStatus() {
    return this.currentSync;
  }

  /**
   * Format duration
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Export singleton instance
const syncService = new SyncService();

module.exports = syncService;
