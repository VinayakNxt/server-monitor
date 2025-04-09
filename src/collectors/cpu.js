/**
 * CPU metrics collector
 */
const os = require('os');
const logger = require('../utils/logger');

// Previous CPU info for calculating usage
let prevCpuInfo = null;

/**
 * Gets CPU information from the OS.
 * Aggregates the CPU times for all cores.
 * @returns {Object} An object containing aggregated CPU times.
 */
function getCpuInfo() {
  const cpus = os.cpus();
  return cpus.reduce((acc, cpu) => {
    Object.keys(cpu.times).forEach(type => {
      acc[type] = (acc[type] || 0) + cpu.times[type];
    });
    return acc;
  }, {});
}

/**
 * Calculates CPU usage as a percentage.
 * Compares the old and new CPU times to determine usage.
 * @param {Object} oldCpuInfo - Previous CPU times.
 * @param {Object} newCpuInfo - Current CPU times.
 * @returns {number} CPU usage percentage.
 */
function calculateCpuUsage(oldCpuInfo, newCpuInfo) {
  const oldTotal = Object.values(oldCpuInfo).reduce((acc, val) => acc + val, 0);
  const newTotal = Object.values(newCpuInfo).reduce((acc, val) => acc + val, 0);

  const totalDiff = newTotal - oldTotal;
  const idleDiff = newCpuInfo.idle - oldCpuInfo.idle;

  // Calculate usage percentage and round to two decimal places
  const usagePercentage = 100 - (idleDiff / totalDiff * 100);
  return Math.round(usagePercentage * 100) / 100;
}

/**
 * Collects CPU metrics.
 * Retrieves CPU usage, core count, model, speed, and load averages.
 * @returns {Object} An object containing CPU metrics.
 */
function collectCpuMetrics() {
  try {
    // Initialize prevCpuInfo if not set
    if (!prevCpuInfo) {
      prevCpuInfo = getCpuInfo();
      // Return initial data with usage set to 0
      return {
        usage: 0,
        cores: os.cpus().length,
        model: os.cpus()[0].model,
        speed: os.cpus()[0].speed,
        loadAvg: os.loadavg()
      };
    }

    // Get updated CPU info
    const newCpuInfo = getCpuInfo();
    const cpuUsage = calculateCpuUsage(prevCpuInfo, newCpuInfo);
    prevCpuInfo = newCpuInfo;

    // Get CPU details
    const cpuInfo = os.cpus();
    
    return {
      usage: cpuUsage, // CPU usage percentage
      cores: cpuInfo.length, // Number of CPU cores
      model: cpuInfo[0].model, // Model of the CPU
      speed: cpuInfo[0].speed, // Speed of the CPU in MHz
      loadAvg: os.loadavg() // Load averages for 1, 5, and 15 minutes
    };
  } catch (error) {
    // Log error and return default values
    logger.error('Error collecting CPU metrics:', error);
    
    return {
      usage: 0, // Default usage
      cores: 0, // Default core count
      model: 'Unknown', // Default model
      speed: 0, // Default speed
      loadAvg: [0, 0, 0] // Default load averages
    };
  }
}

// Export the collectCpuMetrics function
module.exports = {
  collectCpuMetrics
};