/**
 * Disk metrics collector
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const formatter = require('../utils/formatter');

// Promisify exec for async/await usage
const execAsync = promisify(exec);

/**
 * Gets disk usage information
 * Determines the platform and calls the appropriate function to fetch disk info.
 */
async function getDiskInfo() {
  try {
    if (process.platform === 'win32') {
      // Fetch disk info for Windows
      return await getWindowsDiskInfo();
    } else {
      // Fetch disk info for Unix-based systems
      return await getUnixDiskInfo();
    }
  } catch (error) {
    // Log error and return default values in case of failure
    logger.error('Error getting disk info:', error);
    
    return {
      filesystem: '/',
      size: 0,
      used: 0,
      available: 0, 
      percentage: 0,
      formatted: {
        size: '0 B',
        used: '0 B',
        available: '0 B'
      }
    };
  }
}

/**
 * Gets disk usage information for Unix-based systems
 * Uses the `df` command to fetch disk usage stats for the root filesystem.
 */
async function getUnixDiskInfo() {
  // Use df command for Unix-based systems
  const { stdout } = await execAsync("df -k / | tail -1");
  const parts = stdout.trim().split(/\s+/);
  
  // Parse the output
  const size = parseInt(parts[1]) * 1024; // Convert to bytes
  const used = parseInt(parts[2]) * 1024; // Convert to bytes
  const available = parseInt(parts[3]) * 1024; // Convert to bytes
  const percentage = parseFloat(parts[4].replace('%', ''));
  
  return {
    filesystem: parts[0], // Filesystem name
    size, // Total size in bytes
    used, // Used space in bytes
    available, // Available space in bytes
    percentage, // Used percentage
    formatted: {
      size: formatter.formatBytes(size), // Human-readable size
      used: formatter.formatBytes(used), // Human-readable used space
      available: formatter.formatBytes(available) // Human-readable available space
    }
  };
}

/**
 * Gets disk usage information for Windows systems
 * Uses the `wmic` command to fetch disk usage stats for the C: drive.
 */
async function getWindowsDiskInfo() {
  // Use wmic for Windows
  const { stdout } = await execAsync('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:csv');
  const lines = stdout.trim().split('\n');
  
  // Skip header and find C: drive
  if (lines.length < 2) {
    throw new Error('Unexpected wmic output format');
  }
  
  const parts = lines[1].split(',');
  const freeSpace = parseInt(parts[1]); // Free space in bytes
  const size = parseInt(parts[2]); // Total size in bytes
  const used = size - freeSpace; // Used space in bytes
  const percentage = (used / size) * 100; // Used percentage
  
  return {
    filesystem: 'C:', // Filesystem name
    size, // Total size in bytes
    used, // Used space in bytes
    available: freeSpace, // Available space in bytes
    percentage, // Used percentage
    formatted: {
      size: formatter.formatBytes(size), // Human-readable size
      used: formatter.formatBytes(used), // Human-readable used space
      available: formatter.formatBytes(freeSpace) // Human-readable available space
    }
  };
}

/**
 * Gets disk I/O statistics (Linux only)
 * Uses the `iostat` command to fetch disk I/O stats such as reads, writes, and utilization.
 */
async function getDiskIO() {
  try {
    // Only supported on Linux
    if (process.platform !== 'linux') {
      return null;
    }

    // Fetch disk I/O stats using iostat
    const { stdout } = await execAsync('iostat -d -x 1 2 | tail -n +7');
    const lines = stdout.trim().split('\n');
    const diskStats = {};
    
    // Parse the output for each disk
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 10 && parts[0] !== 'Device:') {
        diskStats[parts[0]] = {
          reads_per_sec: parseFloat(parts[3]), // Reads per second
          writes_per_sec: parseFloat(parts[4]), // Writes per second
          io_util_percent: parseFloat(parts[parts.length - 1]) // I/O utilization percentage
        };
      }
    });
    
    return diskStats;
  } catch (error) {
    // Log error and return null in case of failure
    logger.error('Error getting disk I/O stats:', error);
    return null;
  }
}

/**
 * Collects disk metrics
 * Combines disk usage and disk I/O statistics into a single object.
 */
async function collectDiskMetrics() {
  try {
    // Get disk usage info
    const diskInfo = await getDiskInfo();
    
    // Get disk I/O info if available
    const diskIO = await getDiskIO();
    
    return {
      ...diskInfo, // Disk usage info
      io: diskIO // Disk I/O stats
    };
  } catch (error) {
    // Log error and return default values in case of failure
    logger.error('Error collecting disk metrics:', error);
    
    return {
      filesystem: '/',
      size: 0,
      used: 0,
      available: 0,
      percentage: 0,
      formatted: {
        size: '0 B',
        used: '0 B',
        available: '0 B'
      },
      io: null // No I/O stats available
    };
  }
}

// Export the collectDiskMetrics function for use in other modules
module.exports = {
  collectDiskMetrics
};