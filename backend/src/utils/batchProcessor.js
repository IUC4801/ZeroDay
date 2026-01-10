/**
 * Batch Processing Utility
 * Efficient bulk data processing with progress tracking and error handling
 */

const EventEmitter = require('events');
const logger = require('./logger');

/**
 * Process items in batches
 * @param {Array} items - Items to process
 * @param {Number} batchSize - Size of each batch
 * @param {Function} processFn - Async function to process each batch
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing results
 */
const processBatch = async (items, batchSize, processFn, options = {}) => {
  const {
    onProgress = null,
    continueOnError = true,
    label = 'Batch Processing'
  } = options;

  const startTime = Date.now();
  const totalItems = items.length;
  const results = {
    total: totalItems,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
    results: [],
    duration: 0
  };

  try {
    logger.info(`${label} started`, { totalItems, batchSize });

    // Split into batches
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    // Process each batch sequentially
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;

      try {
        logger.debug(`Processing batch ${batchNumber}/${batches.length}`, {
          batchSize: batch.length
        });

        const batchResult = await processFn(batch, batchNumber);
        
        results.processed += batch.length;
        results.successful += batch.length;
        results.results.push(batchResult);

        // Report progress
        if (onProgress) {
          const progress = {
            processed: results.processed,
            total: totalItems,
            percentage: ((results.processed / totalItems) * 100).toFixed(2),
            batchNumber,
            totalBatches: batches.length
          };
          onProgress(progress);
        }

        // Clear batch from memory
        batches[i] = null;

      } catch (error) {
        logger.error(`Batch ${batchNumber} failed`, {
          error: error.message,
          batchSize: batch.length
        });

        results.failed += batch.length;
        results.errors.push({
          batch: batchNumber,
          error: error.message,
          items: batch
        });

        if (!continueOnError) {
          throw error;
        }
      }
    }

    results.duration = Date.now() - startTime;

    logger.info(`${label} completed`, {
      processed: results.processed,
      successful: results.successful,
      failed: results.failed,
      duration: `${results.duration}ms`
    });

    return results;

  } catch (error) {
    results.duration = Date.now() - startTime;
    logger.error(`${label} failed`, { error: error.message });
    throw error;
  }
};

/**
 * Process items in parallel with concurrency limit
 * @param {Array} items - Items to process
 * @param {Number} concurrency - Max concurrent operations
 * @param {Function} processFn - Async function to process each item
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing results
 */
const processParallel = async (items, concurrency, processFn, options = {}) => {
  const {
    onProgress = null,
    continueOnError = true,
    label = 'Parallel Processing'
  } = options;

  const startTime = Date.now();
  const totalItems = items.length;
  const results = {
    total: totalItems,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
    results: [],
    duration: 0
  };

  try {
    logger.info(`${label} started`, { totalItems, concurrency });

    // Split items into chunks based on concurrency
    const chunks = [];
    for (let i = 0; i < items.length; i += concurrency) {
      chunks.push(items.slice(i, i + concurrency));
    }

    // Process each chunk with Promise.all
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      const chunkPromises = chunk.map(async (item, itemIndex) => {
        try {
          const result = await processFn(item, itemIndex);
          results.successful++;
          return { success: true, result, item };
        } catch (error) {
          results.failed++;
          results.errors.push({
            item,
            error: error.message,
            stack: error.stack
          });

          if (!continueOnError) {
            throw error;
          }

          return { success: false, error: error.message, item };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.results.push(...chunkResults);
      results.processed += chunk.length;

      // Report progress
      if (onProgress) {
        const progress = {
          processed: results.processed,
          total: totalItems,
          percentage: ((results.processed / totalItems) * 100).toFixed(2),
          successful: results.successful,
          failed: results.failed
        };
        onProgress(progress);
      }

      // Clear chunk from memory
      chunks[chunkIndex] = null;
    }

    results.duration = Date.now() - startTime;

    logger.info(`${label} completed`, {
      processed: results.processed,
      successful: results.successful,
      failed: results.failed,
      duration: `${results.duration}ms`
    });

    return results;

  } catch (error) {
    results.duration = Date.now() - startTime;
    logger.error(`${label} failed`, { error: error.message });
    throw error;
  }
};

/**
 * Process with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {Number} maxRetries - Maximum retry attempts
 * @param {Number} initialDelay - Initial delay in milliseconds
 * @param {Object} options - Retry options
 * @returns {Promise<*>} Function result
 */
const processWithRetry = async (fn, maxRetries = 3, initialDelay = 1000, options = {}) => {
  const {
    exponentialBackoff = true,
    maxDelay = 30000,
    onRetry = null,
    retryCondition = null
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      if (attempt > 0) {
        logger.info(`Operation succeeded after ${attempt} retries`);
      }
      
      return result;

    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (retryCondition && !retryCondition(error)) {
        logger.warn('Retry condition not met, aborting', { error: error.message });
        throw error;
      }

      // Check if we have retries left
      if (attempt < maxRetries) {
        logger.warn(`Operation failed, retrying (${attempt + 1}/${maxRetries})`, {
          error: error.message,
          delay: `${delay}ms`
        });

        if (onRetry) {
          onRetry(attempt + 1, error, delay);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));

        // Calculate next delay with exponential backoff
        if (exponentialBackoff) {
          delay = Math.min(delay * 2, maxDelay);
        }

      } else {
        logger.error(`Operation failed after ${maxRetries} retries`, {
          error: error.message
        });
      }
    }
  }

  throw lastError;
};

/**
 * Batch Processor with EventEmitter for progress tracking
 */
class BatchProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      batchSize: options.batchSize || 100,
      concurrency: options.concurrency || 5,
      continueOnError: options.continueOnError !== false,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      label: options.label || 'Batch Processing',
      ...options
    };

    this.state = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      startTime: null,
      errors: [],
      isRunning: false,
      isPaused: false,
      isCancelled: false
    };
  }

  /**
   * Process items with full progress tracking
   * @param {Array} items - Items to process
   * @param {Function} processFn - Processing function
   * @returns {Promise<Object>} Processing results
   */
  async process(items, processFn) {
    if (this.state.isRunning) {
      throw new Error('Batch processor is already running');
    }

    this.state = {
      total: items.length,
      processed: 0,
      successful: 0,
      failed: 0,
      startTime: Date.now(),
      errors: [],
      isRunning: true,
      isPaused: false,
      isCancelled: false
    };

    this.emit('start', { total: this.state.total });
    logger.info(`${this.options.label} started`, { total: this.state.total });

    try {
      // Split into batches
      const batches = [];
      for (let i = 0; i < items.length; i += this.options.batchSize) {
        batches.push(items.slice(i, i + this.options.batchSize));
      }

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        // Check for cancellation
        if (this.state.isCancelled) {
          logger.warn(`${this.options.label} cancelled`);
          break;
        }

        // Check for pause
        while (this.state.isPaused && !this.state.isCancelled) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const batch = batches[batchIndex];
        
        try {
          // Process batch with retry logic
          const batchResult = await processWithRetry(
            () => processFn(batch),
            this.options.retryAttempts,
            this.options.retryDelay,
            {
              onRetry: (attempt, error, delay) => {
                this.emit('retry', { batch: batchIndex + 1, attempt, error: error.message, delay });
              }
            }
          );

          this.state.processed += batch.length;
          this.state.successful += batch.length;

          // Emit progress
          this._emitProgress();

        } catch (error) {
          this.state.failed += batch.length;
          this.state.errors.push({
            batch: batchIndex + 1,
            items: batch,
            error: error.message
          });

          this.emit('error', {
            batch: batchIndex + 1,
            error: error.message,
            itemCount: batch.length
          });

          if (!this.options.continueOnError) {
            throw error;
          }
        }

        // Clear batch from memory
        batches[batchIndex] = null;
      }

      const duration = Date.now() - this.state.startTime;
      
      const results = {
        total: this.state.total,
        processed: this.state.processed,
        successful: this.state.successful,
        failed: this.state.failed,
        errors: this.state.errors,
        duration,
        cancelled: this.state.isCancelled
      };

      this.emit('complete', results);
      logger.info(`${this.options.label} completed`, results);

      this.state.isRunning = false;
      
      return results;

    } catch (error) {
      const duration = Date.now() - this.state.startTime;
      
      this.emit('failed', {
        error: error.message,
        processed: this.state.processed,
        duration
      });

      this.state.isRunning = false;
      
      throw error;
    }
  }

  /**
   * Emit progress event with calculated metrics
   */
  _emitProgress() {
    const elapsed = Date.now() - this.state.startTime;
    const rate = this.state.processed / (elapsed / 1000); // items per second
    const remaining = this.state.total - this.state.processed;
    const estimatedTimeRemaining = remaining > 0 ? (remaining / rate) * 1000 : 0;

    const progress = {
      processed: this.state.processed,
      total: this.state.total,
      successful: this.state.successful,
      failed: this.state.failed,
      percentage: ((this.state.processed / this.state.total) * 100).toFixed(2),
      rate: rate.toFixed(2),
      elapsed,
      estimatedTimeRemaining: Math.round(estimatedTimeRemaining)
    };

    this.emit('progress', progress);
  }

  /**
   * Pause processing
   */
  pause() {
    if (this.state.isRunning && !this.state.isPaused) {
      this.state.isPaused = true;
      this.emit('paused');
      logger.info(`${this.options.label} paused`);
    }
  }

  /**
   * Resume processing
   */
  resume() {
    if (this.state.isRunning && this.state.isPaused) {
      this.state.isPaused = false;
      this.emit('resumed');
      logger.info(`${this.options.label} resumed`);
    }
  }

  /**
   * Cancel processing
   */
  cancel() {
    if (this.state.isRunning) {
      this.state.isCancelled = true;
      this.emit('cancelled');
      logger.info(`${this.options.label} cancelled`);
    }
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }
}

/**
 * Calculate progress percentage
 * @param {Number} processed - Processed items
 * @param {Number} total - Total items
 * @returns {Number} Percentage
 */
const calculateProgress = (processed, total) => {
  if (total === 0) return 0;
  return ((processed / total) * 100).toFixed(2);
};

/**
 * Estimate time remaining
 * @param {Number} processed - Processed items
 * @param {Number} total - Total items
 * @param {Number} elapsed - Elapsed time in milliseconds
 * @returns {Number} Estimated remaining time in milliseconds
 */
const estimateTimeRemaining = (processed, total, elapsed) => {
  if (processed === 0) return 0;
  
  const rate = processed / (elapsed / 1000); // items per second
  const remaining = total - processed;
  
  return remaining > 0 ? (remaining / rate) * 1000 : 0;
};

/**
 * Trigger garbage collection hint
 */
const gcHint = () => {
  if (global.gc) {
    global.gc();
    logger.debug('Garbage collection triggered');
  }
};

module.exports = {
  // Core functions
  processBatch,
  processParallel,
  processWithRetry,
  
  // Batch Processor class
  BatchProcessor,
  
  // Utility functions
  calculateProgress,
  estimateTimeRemaining,
  gcHint
};
