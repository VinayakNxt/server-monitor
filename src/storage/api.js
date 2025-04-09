/**
 * API storage implementation
 */
const http = require('http'); // Import the HTTP module for making HTTP requests
const https = require('https'); // Import the HTTPS module for making HTTPS requests
const logger = require('../utils/logger'); // Import the logger utility for logging messages
const os = require('os'); // Import the OS module to retrieve system information

/**
 * Send metrics to API
 * @param {Object} metrics - The metrics data to be sent to the API
 * @returns {Promise<boolean>} - Resolves to true if metrics are sent successfully, otherwise false
 */
async function storeMetrics(metrics) {
  // Check if metrics are provided
  if (!metrics) {
    logger.error('No metrics provided for API storage'); // Log an error if no metrics are provided
    return false; // Return false to indicate failure
  }
  
  // Check if the API URL is configured in the environment variables
  if (!process.env.API_URL) {
    logger.error('API_URL not configured'); // Log an error if API_URL is missing
    return false; // Return false to indicate failure
  }
  
  // Return a promise to handle asynchronous API requests
  return new Promise((resolve, reject) => {
    try {
      const data = JSON.stringify(metrics); // Convert the metrics object to a JSON string
      
      // Parse the API URL to determine the protocol (http or https)
      const url = new URL(process.env.API_URL);
      const requester = url.protocol === 'https:' ? https : http; // Use the appropriate module based on the protocol
      
      // Configure the HTTP/HTTPS request options
      const options = {
        hostname: url.hostname, // API hostname
        port: url.port || (url.protocol === 'https:' ? 443 : 80), // API port (default to 443 for HTTPS, 80 for HTTP)
        path: url.pathname, // API path
        method: 'POST', // HTTP method
        headers: {
          'Content-Type': 'application/json', // Specify JSON content type
          'Content-Length': data.length, // Set the content length
          'Authorization': `ApiKey ${process.env.API_KEY || ''}`, // Include API key for authorization
          'X-Server-ID': os.hostname() // Include the server's hostname for identification
        }
      };
      
      // Create the HTTP/HTTPS request
      const req = requester.request(options, (res) => {
        let responseData = ''; // Variable to store the response data
        
        // Collect response data chunks
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        // Handle the end of the response
        res.on('end', () => {
          // Check if the response status code indicates success
          if (res.statusCode >= 200 && res.statusCode < 300) {
            logger.debug('Metrics sent successfully to API'); // Log success
            resolve(true); // Resolve the promise with true
          } else {
            logger.error(`HTTP Error: ${res.statusCode} - ${responseData}`); // Log the error with status code and response
            resolve(false); // Resolve the promise with false
          }
        });
      });
      
      // Handle request errors
      req.on('error', (error) => {
        logger.error('Error sending metrics to API:', error); // Log the error
        resolve(false); // Resolve the promise with false
      });
      
      req.write(data); // Write the metrics data to the request body
      req.end(); // End the request
    } catch (error) {
      logger.error('Exception sending metrics to API:', error); // Log any exceptions
      resolve(false); // Resolve the promise with false
    }
  });
}

module.exports = {
  storeMetrics // Export the storeMetrics function for use in other modules
};