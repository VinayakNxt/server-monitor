/**
 * Disk metrics collector
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const formatter = require('../utils/formatter');

const execAsync = promisify(exec);

/**
 * Gets disk usage information
 */
async function getDiskInfo() {
  try {
    if (process.platform === 'win32') {
      return await getWindowsDiskInfo();
    } else {
      return await getUnixDiskInfo();
    }
  } catch (error) {
    logger.error('Error getting disk info:', error);
    
    // Return default values on error
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
    filesystem: parts[0],
    size,
    used,
    available,
    percentage,
    formatted: {
      size: formatter.formatBytes(size),
      used: formatter.formatBytes(used),
      available: formatter.formatBytes(available)
    }
  };
}

/**
 * Gets disk usage information for Windows systems
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
  const freeSpace = parseInt(parts[1]);
  const size = parseInt(parts[2]);
  const used = size - freeSpace;
  const percentage = (used / size) * 100;
  
  return {
    filesystem: 'C:',
    size,
    used,
    available: freeSpace,
    percentage,
    formatted: {
      size: formatter.formatBytes(size),
      used: formatter.formatBytes(used),
      available: formatter.formatBytes(freeSpace)
    }
  };
}

/**
 * Gets disk I/O statistics (Linux only)
 */
async function getDiskIO() {
  try {
    if (process.platform !== 'linux') {
      return null;
    }

    const { stdout } = await execAsync('iostat -d -x 1 2 | tail -n +7');
    const lines = stdout.trim().split('\n');
    const diskStats = {};
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 10 && parts[0] !== 'Device:') {
        diskStats[parts[0]] = {
          reads_per_sec: parseFloat(parts[3]),
          writes_per_sec: parseFloat(parts[4]),
          io_util_percent: parseFloat(parts[parts.length - 1])
        };
      }
    });
    
    return diskStats;
  } catch (error) {
    logger.error('Error getting disk I/O stats:', error);
    return null;
  }
}

/**
 * Collects disk metrics
 */
async function collectDiskMetrics() {
  try {
    // Get disk usage info
    const diskInfo = await getDiskInfo();
    
    // Get disk I/O info if available
    const diskIO = await getDiskIO();
    
    return {
      ...diskInfo,
      io: diskIO
    };
  } catch (error) {
    logger.error('Error collecting disk metrics:', error);
    
    // Return default values on error
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
      io: null
    };
  }
}

module.exports = {
  collectDiskMetrics
};