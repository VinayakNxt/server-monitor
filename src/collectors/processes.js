/**
 * Process metrics collector
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const logger = require('../utils/logger');

// Promisify the exec function to use async/await
const execAsync = promisify(exec);

/**
 * Gets top CPU consuming processes
 * @param {number} count - Number of top processes to retrieve
 * @returns {Promise<Array>} - List of top CPU consuming processes
 */
async function getTopCpuProcesses(count = 5) {
  try {
    // Check platform and call appropriate function
    if (process.platform === 'win32') {
      return await getWindowsTopProcesses(count);
    } else {
      return await getUnixTopProcesses(count);
    }
  } catch (error) {
    // Log error and return an empty array
    logger.error('Error getting top CPU processes:', error);
    return [];
  }
}

/**
 * Gets top CPU consuming processes on Unix-based systems
 * @param {number} count - Number of top processes to retrieve
 * @returns {Promise<Array>} - List of top CPU consuming processes
 */
async function getUnixTopProcesses(count) {
  // Command to fetch process details sorted by CPU usage
  const cmd = 'ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n ' + (count + 1);
  const { stdout } = await execAsync(cmd);
  
  // Parse Unix ps output and return formatted process details
  return stdout.trim().split('\n').slice(1, count + 1).map(line => {
    const parts = line.trim().split(/\s+/);
    return { 
      pid: parts[0], 
      name: parts[1], 
      cpu: parseFloat(parts[2]),
      memory: parseFloat(parts[3])
    };
  });
}

/**
 * Gets top CPU consuming processes on Windows
 * @param {number} count - Number of top processes to retrieve
 * @returns {Promise<Array>} - List of top CPU consuming processes
 */
async function getWindowsTopProcesses(count) {
  // Command to fetch process details using WMIC
  const { stdout } = await execAsync('wmic process get ProcessId,Name,PercentProcessorTime /format:csv');
  
  // Parse Windows WMIC output
  const lines = stdout.trim().split('\n').filter(line => line.trim());
  const header = lines[0].split(',');
  
  return lines.slice(1)
    .map(line => {
      const values = line.split(',');
      return {
        pid: values[header.indexOf('ProcessId')],
        name: values[header.indexOf('Name')],
        cpu: parseFloat(values[header.indexOf('PercentProcessorTime')] || 0) / os.cpus().length, // Normalize CPU usage
        memory: 0 // Memory usage not available in this command
      };
    })
    .sort((a, b) => b.cpu - a.cpu) // Sort by CPU usage in descending order
    .slice(0, count); // Limit to the specified count
}

/**
 * Gets top memory consuming processes
 * @param {number} count - Number of top processes to retrieve
 * @returns {Promise<Array>} - List of top memory consuming processes
 */
async function getTopMemoryProcesses(count = 5) {
  try {
    if (process.platform === 'win32') {
      // Windows implementation is not provided here
      return [];
    } else {
      // Command to fetch process details sorted by memory usage
      const cmd = 'ps -eo pid,comm,%mem --sort=-%mem | head -n ' + (count + 1);
      const { stdout } = await execAsync(cmd);
      
      // Parse Unix ps output and return formatted process details
      return stdout.trim().split('\n').slice(1, count + 1).map(line => {
        const parts = line.trim().split(/\s+/);
        return { 
          pid: parts[0], 
          name: parts[1], 
          memory: parseFloat(parts[2])
        };
      });
    }
  } catch (error) {
    // Log error and return an empty array
    logger.error('Error getting top memory processes:', error);
    return [];
  }
}

/**
 * Collects process metrics
 * @returns {Promise<Object>} - Object containing process metrics
 */
async function collectProcessMetrics() {
  try {
    // Get top CPU processes
    const topCpuProcesses = await getTopCpuProcesses(5);
    
    // Get top memory processes
    const topMemoryProcesses = await getTopMemoryProcesses(5);
    
    // Return collected metrics
    return {
      topCpuProcesses,
      topMemoryProcesses,
      count: {
        total: await getTotalProcessCount() // Get total process count
      }
    };
  } catch (error) {
    // Log error and return default values
    logger.error('Error collecting process metrics:', error);
    return {
      topCpuProcesses: [],
      topMemoryProcesses: [],
      count: {
        total: 0
      }
    };
  }
}

/**
 * Gets total process count
 * @returns {Promise<number>} - Total number of processes
 */
async function getTotalProcessCount() {
  try {
    if (process.platform === 'win32') {
      // Command to count processes on Windows
      const { stdout } = await execAsync('wmic process get processid | find /c /v ""');
      return parseInt(stdout.trim()) - 1; // Subtract header line
    } else {
      // Command to count processes on Unix-based systems
      const { stdout } = await execAsync('ps -e | wc -l');
      return parseInt(stdout.trim()) - 1; // Subtract header line
    }
  } catch (error) {
    // Log error and return 0
    logger.error('Error getting process count:', error);
    return 0;
  }
}

// Export the collectProcessMetrics function
module.exports = {
  collectProcessMetrics
};