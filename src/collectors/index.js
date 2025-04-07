/**
 * Metrics collectors module
 */
const os = require('os');
const { collectCpuMetrics } = require('./cpu');
const { collectMemoryMetrics } = require('./memory');
const { collectDiskMetrics } = require('./disk');
const { collectNetworkMetrics } = require('./network');
const { collectProcessMetrics } = require('./processes');
const logger = require('../utils/logger');

/**
 * Collects all system metrics
 */
async function collectAllMetrics() {
  try {
    // Get server information
    const serverInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      uptime: os.uptime()
    };
    
    // Collect all metrics in parallel
    const [cpu, memory, disk, network, processes] = await Promise.all([
      collectCpuMetrics(),
      collectMemoryMetrics(),
      collectDiskMetrics(),
      collectNetworkMetrics(),
      collectProcessMetrics()
    ]);
    
    // Combine all metrics
    return {
      timestamp: Date.now(),
      server: serverInfo,
      cpu,
      memory,
      disk,
      network,
      processes
    };
  } catch (error) {
    logger.error('Error collecting metrics:', error);
    
    // Return minimal data on error
    return {
      timestamp: Date.now(),
      server: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        uptime: os.uptime()
      },
      error: error.message
    };
  }
}

module.exports = {
  collectAllMetrics,
  collectCpuMetrics,
  collectMemoryMetrics,
  collectDiskMetrics,
  collectNetworkMetrics,
  collectProcessMetrics
};