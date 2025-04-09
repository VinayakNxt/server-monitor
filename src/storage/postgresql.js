/**
 * PostgreSQL storage implementation
 */
const db = require('../../db');
const logger = require('../utils/logger');

/**
 * Store metrics in PostgreSQL database
 * @param {Object} metrics - The metrics data to store
 * @returns {boolean} - Returns true if metrics are stored successfully, otherwise false
 */
async function storeMetrics(metrics) {
  if (!metrics) {
    logger.error('No metrics provided for storage');
    return false;
  }
  
  const pool = db.getPool();
  if (!pool) {
    logger.error('No database connection available');
    return false;
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN'); // Start a database transaction
    
    // Insert or update server record
    const serverQuery = `
      INSERT INTO servers (hostname, platform, release, last_seen)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (hostname) DO UPDATE
      SET platform = $2, release = $3, last_seen = CURRENT_TIMESTAMP
      RETURNING id
    `;
    
    await client.query(serverQuery, [
      metrics.server.hostname,
      metrics.server.platform,
      metrics.server.release
    ]);
    
    // Insert metrics record
    const metricsQuery = `
      INSERT INTO metrics (
        server_hostname, timestamp, 
        cpu_usage, cpu_cores, cpu_model, cpu_speed, 
        cpu_load_1m, cpu_load_5m, cpu_load_15m,
        memory_total, memory_free, memory_used, memory_percentage,
        disk_filesystem, disk_size, disk_used, disk_available, disk_percentage,
        network_interface, network_rx_bytes, network_tx_bytes, 
        network_rx_rate, network_tx_rate, network_connections
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      RETURNING id
    `;
    
    const metricsResult = await client.query(metricsQuery, [
      metrics.server.hostname,
      new Date(metrics.timestamp), // Convert timestamp to Date object
      metrics.cpu.usage,
      metrics.cpu.cores,
      metrics.cpu.model,
      metrics.cpu.speed,
      metrics.cpu.loadAvg[0],
      metrics.cpu.loadAvg[1],
      metrics.cpu.loadAvg[2],
      metrics.memory.total,
      metrics.memory.free,
      metrics.memory.used,
      metrics.memory.percentage,
      metrics.disk.filesystem,
      metrics.disk.size,
      metrics.disk.used,
      metrics.disk.available,
      metrics.disk.percentage,
      metrics.network.interface,
      metrics.network.rx_bytes,
      metrics.network.tx_bytes,
      metrics.network.rx_rate,
      metrics.network.tx_rate,
      metrics.network.connections?.ESTABLISHED || 0 // Default to 0 if undefined
    ]);
    
    const metricId = metricsResult.rows[0].id; // Get the ID of the inserted metrics record
    
    // Insert processes if available
    if (metrics.processes?.topCpuProcesses?.length > 0) {
      for (const process of metrics.processes.topCpuProcesses) {
        await client.query(`
          INSERT INTO processes (metric_id, pid, name, cpu_usage)
          VALUES ($1, $2, $3, $4)
        `, [
          metricId,
          process.pid,
          process.name,
          process.cpu
        ]);
      }
    }
    
    await client.query('COMMIT'); // Commit the transaction
    logger.debug('Metrics stored successfully in PostgreSQL');
    return true;
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback the transaction on error
    logger.error('Error storing metrics in PostgreSQL database:', error);
    return false;
  } finally {
    client.release(); // Release the database client
  }
}

/**
 * Clean up old metrics data
 * @param {number} daysToKeep - Number of days to retain metrics data
 * @returns {boolean} - Returns true if cleanup is successful, otherwise false
 */
async function cleanupOldMetrics(daysToKeep = 30) {
  const pool = db.getPool();
  if (!pool) {
    logger.error('No database connection available');
    return false;
  }
  
  try {
    // Call the database function to clean up old metrics
    const result = await pool.query('SELECT cleanup_old_metrics($1)', [daysToKeep]);
    const deletedCount = result.rows[0].cleanup_old_metrics; // Get the count of deleted records
    
    logger.info(`Cleaned up ${deletedCount} old metrics older than ${daysToKeep} days`);
    return true;
  } catch (error) {
    logger.error('Error cleaning up old metrics:', error);
    return false;
  }
}

module.exports = {
  storeMetrics,
  cleanupOldMetrics
};