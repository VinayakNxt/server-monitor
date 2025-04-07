/**
 * CPU metrics collector
 */
const os = require('os');
const logger = require('../utils/logger');

// Previous CPU info for calculating usage
let prevCpuInfo = null;

/**
 * Gets CPU information from the OS
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
 * Calculates CPU usage as a percentage
 */
function calculateCpuUsage(oldCpuInfo, newCpuInfo) {
  const oldTotal = Object.values(oldCpuInfo).reduce((acc, val) => acc + val, 0);
  const newTotal = Object.values(newCpuInfo).reduce((acc, val) => acc + val, 0);

  const totalDiff = newTotal - oldTotal;
  const idleDiff = newCpuInfo.idle - oldCpuInfo.idle;

  const usagePercentage = 100 - (idleDiff / totalDiff * 100);
  return Math.round(usagePercentage * 100) / 100;
}

/**
 * Collects CPU metrics
 */
function collectCpuMetrics() {
  try {
    // Initialize prevCpuInfo if not set
    if (!prevCpuInfo) {
      prevCpuInfo = getCpuInfo();
      // Wait a moment and collect again to get valid data
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
      usage: cpuUsage,
      cores: cpuInfo.length,
      model: cpuInfo[0].model,
      speed: cpuInfo[0].speed,
      loadAvg: os.loadavg()
    };
  } catch (error) {
    logger.error('Error collecting CPU metrics:', error);
    
    // Return default values on error
    return {
      usage: 0,
      cores: 0,
      model: 'Unknown',
      speed: 0,
      loadAvg: [0, 0, 0]
    };
  }
}

module.exports = {
  collectCpuMetrics
};