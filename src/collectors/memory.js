/**
 * Memory metrics collector
 */
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const formatter = require('../utils/formatter');

// Promisify the exec function to use async/await
const execAsync = promisify(exec);

/**
 * Gets memory usage information from OS
 * @returns {Object} An object containing total, free, used memory, usage percentage, and formatted values
 */
function getBasicMemoryInfo() {
  const totalMem = os.totalmem(); // Total system memory
  const freeMem = os.freemem(); // Free system memory
  const usedMem = totalMem - freeMem; // Used memory calculated as total - free
  const usagePercentage = (usedMem / totalMem) * 100; // Memory usage percentage

  return {
    total: totalMem,
    free: freeMem,
    used: usedMem,
    percentage: Math.round(usagePercentage * 100) / 100, // Rounded to 2 decimal places
    formatted: {
      total: formatter.formatBytes(totalMem), // Formatted total memory
      free: formatter.formatBytes(freeMem), // Formatted free memory
      used: formatter.formatBytes(usedMem) // Formatted used memory
    }
  };
}

/**
 * Gets swap memory information (Linux only)
 * @returns {Object|null} An object containing swap memory details or null if not applicable
 */
async function getSwapInfo() {
  try {
    // Swap info is only available on Linux
    if (process.platform !== 'linux') {
      return null;
    }

    // Execute the 'free' command to get swap memory details
    const { stdout } = await execAsync('free -b | grep Swap');
    const parts = stdout.trim().split(/\s+/); // Split the output into parts
    
    // Parse the output - format is "Swap: total used free"
    const total = parseInt(parts[1]); // Total swap memory
    const used = parseInt(parts[2]); // Used swap memory
    const free = parseInt(parts[3]); // Free swap memory
    
    return {
      total,
      used,
      free,
      percentage: total > 0 ? (used / total) * 100 : 0, // Swap usage percentage
      formatted: {
        total: formatter.formatBytes(total), // Formatted total swap memory
        used: formatter.formatBytes(used), // Formatted used swap memory
        free: formatter.formatBytes(free) // Formatted free swap memory
      }
    };
  } catch (error) {
    // Log error and return null if something goes wrong
    logger.error('Error collecting swap info:', error);
    return null;
  }
}

/**
 * Collects memory metrics
 * @returns {Object} An object containing memory and swap metrics
 */
async function collectMemoryMetrics() {
  try {
    // Get basic memory info
    const memInfo = getBasicMemoryInfo();
    
    // Get swap info if available
    const swapInfo = await getSwapInfo();
    
    return {
      ...memInfo, // Include basic memory info
      swap: swapInfo // Include swap info
    };
  } catch (error) {
    // Log error and return default values on failure
    logger.error('Error collecting memory metrics:', error);
    
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

// Export the collectMemoryMetrics function for use in other modules
module.exports = {
  collectMemoryMetrics
};