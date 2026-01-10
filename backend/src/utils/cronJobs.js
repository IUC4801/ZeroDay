/**
 * Cron Jobs Scheduler
 * Manages scheduled tasks for CVE data sync, maintenance, and monitoring
 */

const cron = require('node-cron');
const syncService = require('../services/syncService');
const cisaKevService = require('../services/cisaKevService');
const epssService = require('../services/epssService');
const Cve = require('../models/Cve');
const mongoose = require('mongoose');
const { logger, cleanOldLogs } = require('../middleware/logger');

// Job registry
const jobs = new Map();
const jobStatus = new Map();
const jobLocks = new Map();

/**
 * Initialize job status
 */
const initJobStatus = (jobName) => {
  jobStatus.set(jobName, {
    name: jobName,
    lastRun: null,
    lastDuration: null,
    lastStatus: 'pending',
    lastError: null,
    runCount: 0,
    successCount: 0,
    failureCount: 0,
    isRunning: false
  });
};

/**
 * Update job status
 */
const updateJobStatus = (jobName, updates) => {
  const current = jobStatus.get(jobName);
  jobStatus.set(jobName, {
    ...current,
    ...updates
  });
};

/**
 * Acquire job lock
 */
const acquireLock = (jobName) => {
  if (jobLocks.get(jobName)) {
    return false; // Lock already held
  }
  
  jobLocks.set(jobName, {
    acquired: Date.now(),
    pid: process.pid
  });
  
  return true;
};

/**
 * Release job lock
 */
const releaseLock = (jobName) => {
  jobLocks.delete(jobName);
};

/**
 * Check if job is locked
 */
const isLocked = (jobName) => {
  return jobLocks.has(jobName);
};

/**
 * Execute job with error handling and status tracking
 */
const executeJob = async (jobName, jobFunction, retryCount = 0) => {
  const maxRetries = 3;
  const startTime = Date.now();
  
  // Check lock
  if (isLocked(jobName)) {
    logger.warn(`Job ${jobName} is already running. Skipping...`, {
      type: 'cron',
      job: jobName
    });
    return;
  }
  
  // Acquire lock
  if (!acquireLock(jobName)) {
    logger.warn(`Failed to acquire lock for job ${jobName}`, {
      type: 'cron',
      job: jobName
    });
    return;
  }
  
  try {
    logger.info(`🔄 Starting cron job: ${jobName}`, {
      type: 'cron',
      job: jobName,
      attempt: retryCount + 1
    });
    
    // Update status
    updateJobStatus(jobName, {
      isRunning: true,
      runCount: (jobStatus.get(jobName)?.runCount || 0) + 1
    });
    
    // Execute job
    await jobFunction();
    
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Update status on success
    updateJobStatus(jobName, {
      lastRun: new Date(),
      lastDuration: duration,
      lastStatus: 'success',
      lastError: null,
      isRunning: false,
      successCount: (jobStatus.get(jobName)?.successCount || 0) + 1
    });
    
    logger.info(`✅ Cron job completed: ${jobName} (${duration}ms)`, {
      type: 'cron',
      job: jobName,
      duration
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error(`❌ Cron job failed: ${jobName}`, {
      type: 'cron',
      job: jobName,
      error: error.message,
      stack: error.stack,
      attempt: retryCount + 1,
      duration
    });
    
    // Retry logic for transient errors
    if (retryCount < maxRetries && isTransientError(error)) {
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      logger.warn(`⏳ Retrying job ${jobName} in ${delay}ms...`, {
        type: 'cron',
        job: jobName,
        attempt: retryCount + 2
      });
      
      await sleep(delay);
      await executeJob(jobName, jobFunction, retryCount + 1);
    } else {
      // Update status on failure
      updateJobStatus(jobName, {
        lastRun: new Date(),
        lastDuration: duration,
        lastStatus: 'failed',
        lastError: error.message,
        isRunning: false,
        failureCount: (jobStatus.get(jobName)?.failureCount || 0) + 1
      });
      
      // Send alert for critical failures
      if (isCriticalJob(jobName)) {
        await sendAlert(jobName, error);
      }
    }
  } finally {
    // Always release lock
    releaseLock(jobName);
  }
};

/**
 * Check if error is transient (can be retried)
 */
const isTransientError = (error) => {
  const transientPatterns = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'timeout',
    'network',
    '503',
    '429'
  ];
  
  const message = error.message.toLowerCase();
  return transientPatterns.some(pattern => message.includes(pattern.toLowerCase()));
};

/**
 * Check if job is critical (requires alerts)
 */
const isCriticalJob = (jobName) => {
  const criticalJobs = ['syncRecentCVEs', 'updateKEVCatalog', 'healthCheck'];
  return criticalJobs.includes(jobName);
};

/**
 * Send alert for job failure
 */
const sendAlert = async (jobName, error) => {
  logger.security(`🚨 CRITICAL: Cron job ${jobName} failed`, {
    job: jobName,
    error: error.message,
    timestamp: new Date().toISOString()
  });
  
  // TODO: Integrate with alerting system (email, Slack, PagerDuty, etc.)
  console.error(`🚨 ALERT: Critical cron job failed: ${jobName}`);
  console.error(`   Error: ${error.message}`);
  console.error(`   Time: ${new Date().toISOString()}`);
};

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// Cron Job Definitions
// ============================================================================

/**
 * Sync Recent CVEs (Every 6 hours)
 * Fetches CVEs from last 7 days and updates EPSS scores
 */
const syncRecentCVEs = async () => {
  logger.info('📥 Starting recent CVE sync...');
  
  // Sync CVEs from last 7 days
  const result = await syncService.syncCVEData({
    incremental: true // Last 7 days
  });
  
  logger.info(`✅ Recent CVE sync complete: ${result.statistics.new} new, ${result.statistics.updated} updated`);
  
  return result;
};

/**
 * Update CISA KEV Catalog (Every 12 hours)
 * Fetches latest KEV catalog and marks CVEs in database
 */
const updateKEVCatalog = async () => {
  logger.info('🔐 Starting CISA KEV catalog update...');
  
  // Fetch latest KEV catalog
  const catalog = await cisaKevService.fetchKEVCatalog();
  
  logger.info(`📊 KEV Catalog: ${catalog.count} vulnerabilities`);
  
  // Get all KEV CVE IDs
  const kevCveIds = catalog.vulnerabilities.map(v => v.cveID.toUpperCase());
  
  // Update database: Mark CVEs as in KEV
  const bulkOps = [];
  
  for (const vuln of catalog.vulnerabilities) {
    bulkOps.push({
      updateOne: {
        filter: { cveId: vuln.cveID.toUpperCase() },
        update: {
          $set: {
            cisaKev: true,
            cisaKevData: {
              dateAdded: vuln.dateAdded,
              dueDate: vuln.dueDate,
              requiredAction: vuln.requiredAction,
              knownRansomwareCampaignUse: vuln.knownRansomwareCampaignUse === 'Known'
            },
            exploitAvailable: true
          }
        }
      }
    });
  }
  
  // Execute bulk update
  if (bulkOps.length > 0) {
    const result = await Cve.bulkWrite(bulkOps);
    logger.info(`✅ KEV catalog update complete: ${result.modifiedCount} CVEs marked`);
  }
  
  // Also mark CVEs NOT in KEV
  const unmarkResult = await Cve.updateMany(
    {
      cveId: { $nin: kevCveIds },
      cisaKev: true
    },
    {
      $set: {
        cisaKev: false,
        cisaKevData: null
      }
    }
  );
  
  logger.info(`✅ Unmarked ${unmarkResult.modifiedCount} CVEs no longer in KEV`);
  
  return {
    kevCount: catalog.count,
    markedCount: bulkOps.length,
    unmarkedCount: unmarkResult.modifiedCount
  };
};

/**
 * Cleanup Old Logs (Daily at midnight)
 * Removes logs older than 30 days
 */
const cleanupOldLogsJob = async () => {
  logger.info('🗑️  Starting log cleanup...');
  
  cleanOldLogs();
  
  logger.info('✅ Log cleanup complete');
};

/**
 * Generate Daily Report (Daily at 8 AM)
 * Generates statistics report and sends to monitoring system
 */
const generateDailyReport = async () => {
  logger.info('📊 Generating daily report...');
  
  // Get statistics
  const stats = await Cve.getStatistics();
  
  // Get recent additions (last 24 hours)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const recentAdditions = await Cve.countDocuments({
    publishedDate: { $gte: yesterday }
  });
  
  // Get high-risk CVEs (CRITICAL + exploit available)
  const highRiskCount = await Cve.countDocuments({
    'cvssV3.baseSeverity': 'CRITICAL',
    exploitAvailable: true
  });
  
  // Build report
  const report = {
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    statistics: {
      total: stats.total,
      bySeverity: stats.bySeverity,
      recentAdditions,
      highRisk: highRiskCount,
      cisaKev: stats.cisaKev,
      avgCvssScore: stats.avgCvssScore,
      avgEpssScore: stats.avgEpssScore
    },
    topVendors: stats.topVendors.slice(0, 5),
    jobStatus: getJobsStatus()
  };
  
  // Log report
  logger.info('📄 Daily Report:', report);
  
  // TODO: Send to monitoring system (Prometheus, Datadog, etc.)
  
  return report;
};

/**
 * Health Check (Every 5 minutes)
 * Checks database connection and API availability
 */
const healthCheck = async () => {
  const checks = {
    timestamp: new Date().toISOString(),
    database: false,
    nvdApi: false,
    epssApi: false,
    cisaApi: false
  };
  
  // Check database
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      checks.database = true;
    }
  } catch (error) {
    logger.error('❌ Database health check failed:', { error: error.message });
  }
  
  // Check NVD API (lightweight check)
  try {
    const nvdService = require('../services/nvdService');
    const status = nvdService.getServiceStatus();
    checks.nvdApi = status.baseURL !== null;
  } catch (error) {
    logger.error('❌ NVD API health check failed:', { error: error.message });
  }
  
  // Check EPSS API
  try {
    const status = epssService.getServiceStatus();
    checks.epssApi = status.baseURL !== null;
  } catch (error) {
    logger.error('❌ EPSS API health check failed:', { error: error.message });
  }
  
  // Check CISA KEV API
  try {
    const status = cisaKevService.getServiceStatus();
    checks.cisaApi = status.url !== null;
  } catch (error) {
    logger.error('❌ CISA API health check failed:', { error: error.message });
  }
  
  // Log results
  const allHealthy = Object.values(checks).every(v => v === true || typeof v === 'string');
  
  if (allHealthy) {
    logger.info('✅ Health check passed', checks);
  } else {
    logger.warn('⚠️  Health check failed', checks);
  }
  
  return checks;
};

// ============================================================================
// Cron Job Scheduler
// ============================================================================

/**
 * Initialize and start all cron jobs
 */
const initCronJobs = () => {
  logger.info('⏰ Initializing cron jobs...');
  
  // Sync Recent CVEs - Every 6 hours
  initJobStatus('syncRecentCVEs');
  const syncJob = cron.schedule('0 */6 * * *', () => {
    executeJob('syncRecentCVEs', syncRecentCVEs);
  }, {
    scheduled: false,
    timezone: 'UTC'
  });
  jobs.set('syncRecentCVEs', syncJob);
  
  // Update KEV Catalog - Every 12 hours
  initJobStatus('updateKEVCatalog');
  const kevJob = cron.schedule('0 */12 * * *', () => {
    executeJob('updateKEVCatalog', updateKEVCatalog);
  }, {
    scheduled: false,
    timezone: 'UTC'
  });
  jobs.set('updateKEVCatalog', kevJob);
  
  // Cleanup Old Logs - Daily at midnight
  initJobStatus('cleanupOldLogs');
  const cleanupJob = cron.schedule('0 0 * * *', () => {
    executeJob('cleanupOldLogs', cleanupOldLogsJob);
  }, {
    scheduled: false,
    timezone: 'UTC'
  });
  jobs.set('cleanupOldLogs', cleanupJob);
  
  // Generate Daily Report - Daily at 8 AM
  initJobStatus('generateDailyReport');
  const reportJob = cron.schedule('0 8 * * *', () => {
    executeJob('generateDailyReport', generateDailyReport);
  }, {
    scheduled: false,
    timezone: 'UTC'
  });
  jobs.set('generateDailyReport', reportJob);
  
  // Health Check - Every 5 minutes
  initJobStatus('healthCheck');
  const healthJob = cron.schedule('*/5 * * * *', () => {
    executeJob('healthCheck', healthCheck);
  }, {
    scheduled: false,
    timezone: 'UTC'
  });
  jobs.set('healthCheck', healthJob);
  
  logger.info(`✅ Initialized ${jobs.size} cron jobs`);
};

/**
 * Start all cron jobs
 */
const startCronJobs = () => {
  logger.info('▶️  Starting cron jobs...');
  
  jobs.forEach((job, name) => {
    job.start();
    logger.info(`   ✅ Started: ${name}`);
  });
  
  logger.info(`✅ All cron jobs started (${jobs.size} total)`);
};

/**
 * Stop all cron jobs
 */
const stopCronJobs = () => {
  logger.info('⏹️  Stopping cron jobs...');
  
  jobs.forEach((job, name) => {
    job.stop();
    logger.info(`   ⏹️  Stopped: ${name}`);
  });
  
  logger.info('✅ All cron jobs stopped');
};

/**
 * Stop specific job
 */
const stopJob = (jobName) => {
  const job = jobs.get(jobName);
  
  if (!job) {
    throw new Error(`Job not found: ${jobName}`);
  }
  
  job.stop();
  logger.info(`⏹️  Stopped job: ${jobName}`);
};

/**
 * Start specific job
 */
const startJob = (jobName) => {
  const job = jobs.get(jobName);
  
  if (!job) {
    throw new Error(`Job not found: ${jobName}`);
  }
  
  job.start();
  logger.info(`▶️  Started job: ${jobName}`);
};

/**
 * Manually trigger a job
 */
const triggerJob = async (jobName) => {
  logger.info(`🔧 Manually triggering job: ${jobName}`);
  
  const jobFunctions = {
    syncRecentCVEs,
    updateKEVCatalog,
    cleanupOldLogs: cleanupOldLogsJob,
    generateDailyReport,
    healthCheck
  };
  
  const jobFunction = jobFunctions[jobName];
  
  if (!jobFunction) {
    throw new Error(`Job not found: ${jobName}`);
  }
  
  return await executeJob(jobName, jobFunction);
};

/**
 * Get status of all jobs
 */
const getJobsStatus = () => {
  const status = {};
  
  jobStatus.forEach((value, key) => {
    status[key] = {
      ...value,
      isLocked: isLocked(key)
    };
  });
  
  return status;
};

/**
 * Get status of specific job
 */
const getJobStatus = (jobName) => {
  const status = jobStatus.get(jobName);
  
  if (!status) {
    throw new Error(`Job not found: ${jobName}`);
  }
  
  return {
    ...status,
    isLocked: isLocked(jobName)
  };
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async () => {
  logger.info('🛑 Graceful shutdown initiated...');
  
  // Stop all cron jobs
  stopCronJobs();
  
  // Wait for running jobs to complete (max 30 seconds)
  const maxWait = 30000;
  const startWait = Date.now();
  
  while (Date.now() - startWait < maxWait) {
    const runningJobs = Array.from(jobStatus.values()).filter(s => s.isRunning);
    
    if (runningJobs.length === 0) {
      logger.info('✅ All jobs completed');
      break;
    }
    
    logger.info(`⏳ Waiting for ${runningJobs.length} jobs to complete...`);
    await sleep(1000);
  }
  
  // Force release all locks
  jobLocks.clear();
  
  logger.info('✅ Graceful shutdown complete');
};

// Handle process signals
process.on('SIGTERM', async () => {
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await gracefulShutdown();
  process.exit(0);
});

module.exports = {
  initCronJobs,
  startCronJobs,
  stopCronJobs,
  startJob,
  stopJob,
  triggerJob,
  getJobsStatus,
  getJobStatus,
  gracefulShutdown,
  // Export individual job functions for testing
  syncRecentCVEs,
  updateKEVCatalog,
  cleanupOldLogsJob,
  generateDailyReport,
  healthCheck
};
