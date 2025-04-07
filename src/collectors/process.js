/**
 * Process metrics collector
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

/**
 * Gets top CPU consuming processes
 */
async function getTopCpuProcesses(count = 5) {
  try {
    if (process.platform === 'win32') {
      return await getWindowsTopProcesses(count);
    } else {
      return await getUnixTopProcesses(count);
    }
  } catch (error) {
    logger.error('Error getting top CPU processes:', error);
    return [];
  }
}

/**
 * Gets top CPU consuming processes on Unix-based systems
 */
async function getUnixTopProcesses(count) {
  const cmd = 'ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n ' + (count + 1);
  const { stdout } = await execAsync(cmd);
  
  // Parse Unix ps output
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
 */
async function getWindowsTopProcesses(count) {
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
        cpu: parseFloat(values[header.indexOf('PercentProcessorTime')] || 0) / os.cpus().length,
        memory: 0 // Windows doesn't provide this in the same command
      };
    })
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, count);
}

/**
 * Gets memory consuming processes
 */
async function getTopMemoryProcesses(count = 5) {
  try {
    if (process.platform === 'win32') {
      // Windows implementation is more complex and not provided here
      return [];
    } else {
      const cmd = 'ps -eo pid,comm,%mem --sort=-%mem | head -n ' + (count + 1);
      const { stdout } = await execAsync(cmd);
      
      // Parse Unix ps output
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
    logger.error('Error getting top memory processes:', error);
    return [];
  }
}

/**
 * Collects process metrics
 */
async function collectProcessMetrics() {
  try {
    // Get top CPU processes
    const topCpuProcesses = await getTopCpuProcesses(5);
    
    // Get top memory processes
    const topMemoryProcesses = await getTopMemoryProcesses(5);
    
    return {
      topCpuProcesses,
      topMemoryProcesses,
      count: {
        total: await getTotalProcessCount()
      }
    };
  } catch (error) {
    logger.error('Error collecting process metrics:', error);
    
    // Return default values on error
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
 */
async function getTotalProcessCount() {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('wmic process get processid | find /c /v ""');
      return parseInt(stdout.trim()) - 1; // Subtract header line
    } else {
      const { stdout } = await execAsync('ps -e | wc -l');
      return parseInt(stdout.trim()) - 1; // Subtract header line
    }
  } catch (error) {
    logger.error('Error getting process count:', error);
    return 0;
  }
}

module.exports = {
  collectProcessMetrics
};