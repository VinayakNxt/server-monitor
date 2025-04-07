/**
 * API storage implementation
 */
const http = require('http');
const https = require('https');
const logger = require('../utils/logger');
const os = require('os');

/**
 * Send metrics to API
 */
async function storeMetrics(metrics) {
  if (!metrics) {
    logger.error('No metrics provided for API storage');
    return false;
  }
  
  if (!process.env.API_URL) {
    logger.error('API_URL not configured');
    return false;
  }
  
  return new Promise((resolve, reject) => {
    try {
      const data = JSON.stringify(metrics);
      
      // Determine if we're using http or https
      const url = new URL(process.env.API_URL);
      const requester = url.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'Authorization': `ApiKey ${process.env.API_KEY || ''}`,
          'X-Server-ID': os.hostname()
        }
      };
      
      const req = requester.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            logger.debug('Metrics sent successfully to API');
            resolve(true);
          } else {
            logger.error(`HTTP Error: ${res.statusCode} - ${responseData}`);
            resolve(false);
          }
        });
      });
      
      req.on('error', (error) => {
        logger.error('Error sending metrics to API:', error);
        resolve(false);
      });
      
      req.write(data);
      req.end();
    } catch (error) {
      logger.error('Exception sending metrics to API:', error);
      resolve(false);
    }
  });
}

module.exports = {
  storeMetrics
};