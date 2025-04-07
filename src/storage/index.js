/**
 * Storage module
 */
const logger = require('../utils/logger');
const postgresqlStorage = require('./postgresql');
const apiStorage = require('./api');

// Metrics buffer for batching
let metricsBuffer = [];

/**
 * Store metrics using configured storage method
 */
async function storeMetrics(metrics) {
  if (!metrics) {
    logger.error('No metrics provided for storage');
    return false;
  }
  
  // Add to buffer
  metricsBuffer.push(metrics);
  
  // Process buffer if it reaches threshold
  const batchSize = parseInt(process.env.BATCH_SIZE) || 5;
  if (metricsBuffer.length >= batchSize) {
    return await processMetricsBatch();
  }
  
  return true;
}

/**
 * Process metrics batch
 */
async function processMetricsBatch() {
  if (metricsBuffer.length === 0) return true;
  
  logger.info(`Processing batch of ${metricsBuffer.length} metrics`);
  
  // Process metrics in FIFO order
  const batchToProcess = [...metricsBuffer];
  metricsBuffer = [];
  
  let success = true;
  
  // Sequential processing to avoid connection issues
  for (const metrics of batchToProcess) {
    try {
      let result = false;
      
      // Store using configured storage method
      if (process.env.API_ENABLED === 'true') {
        result = await apiStorage.storeMetrics(metrics);
      } else if (process.env.DB_ENABLED === 'true') {
        result = await postgresqlStorage.storeMetrics(metrics);
      } else {
        logger.warn('No storage method enabled, metrics not stored');
        result = true; // Consider successful since it was a configuration choice
      }
      
      if (!result) {
        success = false;
        // Log but continue with other metrics
        logger.error(`Failed to store metrics for ${metrics.timestamp}`);
      }
    } catch (error) {
      success = false;
      logger.error('Error processing metrics batch item:', error);
    }
  }
  
  return success;
}

/**
 * Clean up old metrics
 */
async function cleanupOldMetrics() {
  if (process.env.DB_ENABLED === 'true') {
    return await postgresqlStorage.cleanupOldMetrics();
  }
  
  // No cleanup needed for API storage
  return true;
}

/**
 * Flush any remaining metrics in buffer (for shutdown)
 */
async function flushMetrics() {
  return await processMetricsBatch();
}

module.exports = {
  storeMetrics,
  processMetricsBatch,
  cleanupOldMetrics,
  flushMetrics
};