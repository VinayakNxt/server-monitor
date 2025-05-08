/**
   * Server Monitor - Main Application
   */
  require('dotenv').config();
  const os = require('os');
  const { collectAllMetrics } = require('./collectors');
  const { storeMetrics, flushMetrics, cleanupOldMetrics } = require('./storage');
  const db = require('../db');
  const logger = require('./utils/logger');
  const formatter = require('./utils/formatter');
  
  // Configuration
  const REFRESH_INTERVAL = parseInt(process.env.REFRESH_INTERVAL) || 60000;
  const DISPLAY_METRICS = process.env.DISPLAY_METRICS === 'true';
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  const CLEANUP_DAYS_TO_KEEP = parseInt(process.env.CLEANUP_DAYS_TO_KEEP) || 30;

  // Get server IP address
  async function getServerIpAddress() {
    const networkInterfaces = os.networkInterfaces();
    
    // Find the first non-internal IPv4 address
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      
      for (const iface of interfaces) {
        // Skip internal and non-IPv4 addresses
        if (!iface.internal && iface.family === 'IPv4') {
          logger.info(`Using IP address ${iface.address} for server ID`);
          return iface.address;
        }
      }
    }
    return '';
  }
  /**
   * Main monitoring function
   */
  async function monitor() {
    try {
      logger.info('Collecting metrics...');
      
      // Collect all metrics
      const metrics = await collectAllMetrics();

      // Add IP address to server info if not already included
      metrics.server.hostname = await getServerIpAddress() || metrics.server.hostname;

      // Store metrics
      await storeMetrics(metrics);
      
      // Display metrics if enabled
      if (DISPLAY_METRICS) {
        displayMetrics(metrics);
      } else {
        // Simple log
        logger.info(`Collected metrics - CPU: ${metrics.cpu.usage}%, Memory: ${metrics.memory.percentage}%, Disk: ${metrics.disk.percentage}%`);
      }
    } catch (error) {
      logger.error('Error in monitoring cycle:', error);
    }
    
    // Schedule next update
    setTimeout(monitor, REFRESH_INTERVAL);
  }
  
  /**
   * Display metrics in the console
   */
  function displayMetrics(metrics) {
    const { cpu, memory, disk, network, server } = metrics;
    
    console.log('\n========== SERVER MONITOR ==========');
    console.log(`Server: ${server.hostname} (${server.platform} ${server.release})`);
    console.log(`Uptime: ${formatter.formatDuration(server.uptime * 1000)}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('=====================================');
    
    console.log(`\nCPU Usage: ${cpu.usage}% (${cpu.cores} cores)`);
    console.log(`Load Average: ${cpu.loadAvg[0].toFixed(2)}, ${cpu.loadAvg[1].toFixed(2)}, ${cpu.loadAvg[2].toFixed(2)}`);
    
    console.log(`\nMemory Usage: ${memory.percentage}% (${memory.formatted.used} / ${memory.formatted.total})`);
    if (memory.swap) {
      console.log(`Swap Usage: ${memory.swap.percentage.toFixed(2)}% (${memory.swap.formatted.used} / ${memory.swap.formatted.total})`);
    }
    
    console.log(`\nDisk Usage: ${disk.percentage}% (${disk.formatted.used} / ${disk.formatted.size})`);
    
    console.log(`\nNetwork (${network.interface}):`);
    console.log(`  Download: ${network.formatted.rx_rate}`);
    console.log(`  Upload: ${network.formatted.tx_rate}`);
    console.log(`  Connections: ${network.total_connections}`);
    
    if (metrics.processes?.topCpuProcesses?.length > 0) {
      console.log('\nTop CPU Processes:');
      console.log('  PID\tCPU%\tNAME');
      metrics.processes.topCpuProcesses.forEach(proc => {
        console.log(`  ${proc.pid}\t${proc.cpu.toFixed(1)}%\t${proc.name}`);
      });
    }
    
    console.log('\n=====================================');
    console.log(`Next update in ${formatter.formatDuration(REFRESH_INTERVAL)}`);
  }

/**
 * Scheduled cleanup task
 */
async function scheduledCleanup() {
    try {
      logger.info(`Running scheduled cleanup of metrics older than ${CLEANUP_DAYS_TO_KEEP} days`);
      const result = await cleanupOldMetrics();
      if (result) {
        logger.info('Cleanup completed successfully');
      } else {
        logger.warn('Cleanup may not have completed successfully');
      }
    } catch (error) {
      logger.error('Error during scheduled cleanup:', error);
    }
    
    // Schedule next cleanup
    setTimeout(scheduledCleanup, CLEANUP_INTERVAL);
  }
  
  /**
   * Initialize the application
   */
  async function initialize() {
    const SERVER_IP = await getServerIpAddress();
    const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME || os.hostname();
    const SERVER_ID = SERVER_IP || SERVER_HOSTNAME;
    logger.info('Starting Server Monitor');
    logger.info(`Server ID: ${SERVER_ID}`);
    logger.info(`Refresh interval: ${formatter.formatDuration(REFRESH_INTERVAL)}`);
    
    // Initialize database if needed
    if (process.env.DB_ENABLED === 'true') {
      logger.info('Initializing database connection');
      db.initializeDatabase();
    }
    
    // Start monitoring
    monitor();
    
    // Start cleanup scheduler
    if (process.env.DB_ENABLED === 'true') {
      logger.info(`Scheduling regular cleanup every 24 hours (keeping ${CLEANUP_DAYS_TO_KEEP} days of data)`);
      setTimeout(scheduledCleanup, 60000); // First cleanup after 1 minute
    }
  }
  
  /**
   * Cleanup function for graceful shutdown
   */
  async function cleanup() {
    logger.info('Shutting down...');
    
    // Flush any remaining metrics
    await flushMetrics();
    
    // Close database connection
    if (process.env.DB_ENABLED === 'true') {
      await db.closeDatabase();
    }
    
    logger.info('Cleanup complete, exiting');
    process.exit(0);
  }
  
  // Handle termination signals
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  // Start the application
  initialize();