/**
 * Network metrics collector
 */
const os = require('os');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const formatter = require('../utils/formatter');

const execAsync = promisify(exec);

// Previous network stats for calculating rates
let prevNetStats = { rx: 0, tx: 0, timestamp: Date.now() };

/**
 * Gets network statistics
 * @returns {Promise<{rx: number, tx: number, interface: string}>} Network statistics including received and transmitted bytes
 */
async function getNetworkInfo() {
  try {
    // Determine the main network interface
    const interfaces = os.networkInterfaces();
    const mainIface = Object.keys(interfaces).find(iface => 
      interfaces[iface].some(addr => 
        !addr.internal && addr.family === 'IPv4'
      )
    ) || (process.platform === 'linux' ? 'eth0' : 'en0');
    
    if (process.platform === 'linux') {
      // Linux implementation
      try {
        // Read received and transmitted bytes from sysfs
        const rxData = await fs.readFile(`/sys/class/net/${mainIface}/statistics/rx_bytes`, 'utf8');
        const txData = await fs.readFile(`/sys/class/net/${mainIface}/statistics/tx_bytes`, 'utf8');
        
        const rx = parseInt(rxData.trim());
        const tx = parseInt(txData.trim());
        
        return { rx, tx, interface: mainIface };
      } catch (e) {
        // Fallback if specific interface stats aren't available
        const { stdout } = await execAsync("cat /proc/net/dev | grep :");
        const lines = stdout.trim().split('\n');
        
        // Find first non-loopback interface
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const iface = parts[0].replace(':', '');
          if (iface !== 'lo') {
            return {
              interface: iface,
              rx: parseInt(parts[1]),
              tx: parseInt(parts[9])
            };
          }
        }
      }
    } else if (process.platform === 'darwin') {
      // macOS implementation
      const { stdout } = await execAsync(`netstat -ib | grep -v Link | grep ${mainIface} | head -1`);
      const parts = stdout.trim().split(/\s+/);
      
      return {
        interface: mainIface,
        rx: parseInt(parts[6]),
        tx: parseInt(parts[9])
      };
    } else if (process.platform === 'win32') {
      // Windows implementation
      // Note: This is a simplified approach and may need refinement
      const { stdout } = await execAsync('netstat -e');
      const lines = stdout.trim().split('\n');
      
      // Parse the bytes received/sent
      let rx = 0;
      let tx = 0;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Bytes')) {
          const parts = lines[i+1].trim().split(/\s+/);
          rx = parseInt(parts[0]);
          tx = parseInt(parts[1]);
          break;
        }
      }
      
      return {
        interface: 'net0', // Windows doesn't report interface name in the same way
        rx,
        tx
      };
    }
  } catch (error) {
    logger.error('Error getting network info:', error);
  }
  
  // Fallback if everything fails
  return { interface: 'unknown', rx: 0, tx: 0 };
}

/**
 * Gets active network connections count
 * @returns {Promise<number>} Number of active connections in ESTABLISHED state
 */
async function getConnectionsCount() {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('netstat -an | find /c "ESTABLISHED"');
      return parseInt(stdout.trim());
    } else {
      const { stdout } = await execAsync('netstat -an | grep ESTABLISHED | wc -l');
      return parseInt(stdout.trim());
    }
  } catch (error) {
    logger.error('Error getting connections count:', error);
    return 0;
  }
}

/**
 * Gets TCP connection states count
 * @returns {Promise<Object>} Object containing counts of various TCP connection states
 */
async function getTcpStates() {
  try {
    if (process.platform === 'win32') {
      return { ESTABLISHED: await getConnectionsCount() };
    } else {
      const states = ['ESTABLISHED', 'TIME_WAIT', 'CLOSE_WAIT', 'SYN_SENT', 'SYN_RECV', 'FIN_WAIT1', 'FIN_WAIT2', 'LAST_ACK', 'CLOSING', 'LISTEN'];
      const result = {};
      
      for (const state of states) {
        try {
          const { stdout } = await execAsync(`netstat -an | grep ${state} | wc -l`);
          result[state] = parseInt(stdout.trim());
        } catch (e) {
          result[state] = 0;
        }
      }
      
      return result;
    }
  } catch (error) {
    logger.error('Error getting TCP states:', error);
    return { ESTABLISHED: 0 };
  }
}

/**
 * Calculates network transfer rates
 * @param {Object} current - Current network statistics
 * @returns {Object} Network transfer rates and formatted rates
 */
function calculateNetworkRates(current) {
  const now = Date.now();
  const elapsedMs = now - prevNetStats.timestamp;
  
  // Calculate rates (bytes per second)
  const rxRate = (current.rx - prevNetStats.rx) / (elapsedMs / 1000);
  const txRate = (current.tx - prevNetStats.tx) / (elapsedMs / 1000);
  
  // Update previous stats
  prevNetStats = {
    rx: current.rx,
    tx: current.tx,
    timestamp: now
  };
  
  return {
    rxRate,
    txRate,
    formatted: {
      rxRate: formatter.formatBytes(rxRate) + '/s',
      txRate: formatter.formatBytes(txRate) + '/s'
    }
  };
}

/**
 * Collects network metrics
 * @returns {Promise<Object>} Network metrics including rates, connection states, and formatted values
 */
async function collectNetworkMetrics() {
  try {
    // Get network interface info
    const netInfo = await getNetworkInfo();
    
    // Calculate network rates
    const rates = calculateNetworkRates(netInfo);
    
    // Get connection states
    const connectionStates = await getTcpStates();
    
    return {
      interface: netInfo.interface,
      rx_bytes: netInfo.rx,
      tx_bytes: netInfo.tx,
      rx_rate: rates.rxRate,
      tx_rate: rates.txRate,
      formatted: {
        rx_bytes: formatter.formatBytes(netInfo.rx),
        tx_bytes: formatter.formatBytes(netInfo.tx),
        rx_rate: rates.formatted.rxRate,
        tx_rate: rates.formatted.txRate
      },
      connections: connectionStates,
      total_connections: Object.values(connectionStates).reduce((sum, count) => sum + count, 0)
    };
  } catch (error) {
    logger.error('Error collecting network metrics:', error);
    
    // Return default values on error
    return {
      interface: 'unknown',
      rx_bytes: 0,
      tx_bytes: 0,
      rx_rate: 0,
      tx_rate: 0,
      formatted: {
        rx_bytes: '0 B',
        tx_bytes: '0 B',
        rx_rate: '0 B/s',
        tx_rate: '0 B/s'
      },
      connections: { ESTABLISHED: 0 },
      total_connections: 0
    };
  }
}

module.exports = {
  collectNetworkMetrics
};