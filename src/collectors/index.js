/**
 * Metrics collectors module
 * This module is responsible for collecting various system metrics such as CPU, memory, disk, network, and process information.
 */
const os = require('os');
const { collectCpuMetrics } = require('./cpu'); // Module to collect CPU metrics
const { collectMemoryMetrics } = require('./memory'); // Module to collect memory metrics
const { collectDiskMetrics } = require('./disk'); // Module to collect disk metrics
const { collectNetworkMetrics } = require('./network'); // Module to collect network metrics
const { collectProcessMetrics } = require('./processes'); // Module to collect process metrics
const logger = require('../utils/logger'); // Logger utility for logging errors and information

/**
 * Collects all system metrics
 * This function gathers metrics from various sources and combines them into a single object.
 * It also handles errors gracefully by logging them and returning minimal data.
 */
async function collectAllMetrics() {
  try {
    // Get server information such as hostname, platform, release, and uptime
    const serverInfo = {
      hostname: os.hostname(), // Server hostname
      platform: os.platform(), // Operating system platform
      release: os.release(), // Operating system release version
      uptime: os.uptime() // Server uptime in seconds
    };
    
    // Collect all metrics in parallel using Promise.all for better performance
    const [cpu, memory, disk, network, processes] = await Promise.all([
      collectCpuMetrics(), // Collect CPU metrics
      collectMemoryMetrics(), // Collect memory metrics
      collectDiskMetrics(), // Collect disk metrics
      collectNetworkMetrics(), // Collect network metrics
      collectProcessMetrics() // Collect process metrics
    ]);
    
    // Combine all collected metrics into a single object
    return {
      timestamp: Date.now(), // Current timestamp
      server: serverInfo, // Server information
      cpu, // CPU metrics
      memory, // Memory metrics
      disk, // Disk metrics
      network, // Network metrics
      processes // Process metrics
    };
  } catch (error) {
    // Log the error and return minimal data
    logger.error('Error collecting metrics:', error);
    
    // Return minimal data on error, including server information and error message
    return {
      timestamp: Date.now(), // Current timestamp
      server: {
        hostname: os.hostname(), // Server hostname
        platform: os.platform(), // Operating system platform
        release: os.release(), // Operating system release version
        uptime: os.uptime() // Server uptime in seconds
      },
      error: error.message // Error message
    };
  }
}

// Export the metrics collection functions for use in other modules
module.exports = {
  collectAllMetrics, // Function to collect all metrics
  collectCpuMetrics, // Function to collect CPU metrics
  collectMemoryMetrics, // Function to collect memory metrics
  collectDiskMetrics, // Function to collect disk metrics
  collectNetworkMetrics, // Function to collect network metrics
  collectProcessMetrics // Function to collect process metrics
};