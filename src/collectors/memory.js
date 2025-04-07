/**
 * Memory metrics collector
 */
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const formatter = require('../utils/formatter');

const execAsync = promisify(exec);

/**
 * Gets memory usage information from OS
 */
function getBasicMemoryInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const usagePercentage = (usedMem / totalMem) * 100;

  return {
    total: totalMem,
    free: freeMem,
    used: usedMem,
    percentage: Math.round(usagePercentage * 100) / 100,
    formatted: {
      total: formatter.formatBytes(totalMem),
      free: formatter.formatBytes(freeMem),
      used: formatter.formatBytes(usedMem)
    }
  };
}

/**
 * Gets swap memory information (Linux only)
 */
async function getSwapInfo() {
  try {
    if (process.platform !== 'linux') {
      return null;
    }

    const { stdout } = await execAsync('free -b | grep Swap');
    const parts = stdout.trim().split(/\s+/);
    
    // Parse the output - format is "Swap: total used free"
    const total = parseInt(parts[1]);
    const used = parseInt(parts[2]);
    const free = parseInt(parts[3]);
    
    return {
      total,
      used,
      free,
      percentage: total > 0 ? (used / total) * 100 : 0,
      formatted: {
        total: formatter.formatBytes(total),
        used: formatter.formatBytes(used),
        free: formatter.formatBytes(free)
      }
    };
  } catch (error) {
    logger.error('Error collecting swap info:', error);
    return null;
  }
}

/**
 * Collects memory metrics
 */
async function collectMemoryMetrics() {
  try {
    // Get basic memory info
    const memInfo = getBasicMemoryInfo();
    
    // Get swap info if available
    const swapInfo = await getSwapInfo();
    
    return {
      ...memInfo,
      swap: swapInfo
    };
  } catch (error) {
    logger.error('Error collecting memory metrics:', error);
    
    // Return default values on error
    return {
      total: 0,
      free: 0,
      used: 0,
      percentage: 0,
      formatted: {
        total: '0 B',
        free: '0 B',
        used: '0 B'
      },
      swap: null
    };
  }
}

module.exports = {
  collectMemoryMetrics
};