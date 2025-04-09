/**
 * Storage module
 * Handles storing metrics using different storage methods (API or PostgreSQL).
 * Includes functionality for batching, cleanup, and flushing metrics.
 */
const logger = require('../utils/logger');
const postgresqlStorage = require('./postgresql');
const apiStorage = require('./api');

// Metrics buffer for batching
let metricsBuffer = [];

/**
 * Store metrics using the configured storage method.
 * Adds metrics to a buffer and processes the buffer when it reaches a threshold.
 * 
 * @param {Object} metrics - The metrics data to store.
 * @returns {Promise<boolean>} - Returns true if metrics are successfully stored or buffered.
 */
async function storeMetrics(metrics) {
  if (!metrics) {
    logger.error('No metrics provided for storage');
    return false;
  }
  
  // Add metrics to the buffer
  metricsBuffer.push(metrics);
  
  // Process the buffer if it reaches the configured batch size
  const batchSize = parseInt(process.env.BATCH_SIZE) || 5;
  if (metricsBuffer.length >= batchSize) {
    return await processMetricsBatch();
  }
  
  return true;
}

/**
 * Process the metrics batch.
 * Sends the buffered metrics to the configured storage method in FIFO order.
 * 
 * @returns {Promise<boolean>} - Returns true if all metrics in the batch are successfully processed.
 */
async function processMetricsBatch() {
  if (metricsBuffer.length === 0) return true; // No metrics to process
  
  logger.info(`Processing batch of ${metricsBuffer.length} metrics`);
  
  // Copy the buffer and reset it
  const batchToProcess = [...metricsBuffer];
  metricsBuffer = [];
  
  let success = true;
  
  // Process each metric sequentially to avoid connection issues
  for (const metrics of batchToProcess) {
    try {
      let result = false;
      
      // Store metrics using the configured storage method
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
        // Log the failure but continue processing other metrics
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
 * Clean up old metrics from storage.
 * Only applicable for database storage.
 * 
 * @returns {Promise<boolean>} - Returns true if cleanup is successful.
 */
async function cleanupOldMetrics() {
  if (process.env.DB_ENABLED === 'true') {
    return await postgresqlStorage.cleanupOldMetrics();
  }
  
  // No cleanup needed for API storage
  return true;
}

/**
 * Flush any remaining metrics in the buffer.
 * Typically called during application shutdown to ensure no metrics are lost.
 * 
 * @returns {Promise<boolean>} - Returns true if the buffer is successfully flushed.
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