/**
 * Utility functions for formatting data
 */

/**
 * Formats bytes into human-readable format
 * Converts a given number of bytes into a more readable format (e.g., KB, MB, GB).
 * @param {Number} bytes - Number of bytes to format
 * @param {Number} decimals - Number of decimal places to include (default: 2)
 * @returns {String} Formatted string representing the size in human-readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  
  const k = 1024; // Conversion factor for bytes to kilobytes
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']; // Units of measurement
  const i = Math.floor(Math.log(bytes) / Math.log(k)); // Determine the appropriate unit
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}
  
/**
 * Formats milliseconds into human-readable duration
 * Converts a duration in milliseconds into a more readable format (e.g., days, hours, minutes, seconds).
 * @param {Number} ms - Number of milliseconds to format
 * @returns {String} Formatted duration string
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return ms + 'ms'; // Return milliseconds if less than 1 second
  }
  
  const seconds = Math.floor(ms / 1000); // Convert to seconds
  const minutes = Math.floor(seconds / 60); // Convert to minutes
  const hours = Math.floor(minutes / 60); // Convert to hours
  const days = Math.floor(hours / 24); // Convert to days
  
  // Format the duration based on the largest unit
  if (days > 0) {
    return days + 'd ' + (hours % 24) + 'h ' + (minutes % 60) + 'm';
  }
  if (hours > 0) {
    return hours + 'h ' + (minutes % 60) + 'm ' + (seconds % 60) + 's';
  }
  if (minutes > 0) {
    return minutes + 'm ' + (seconds % 60) + 's';
  }
  return seconds + 's';
}
  
/**
 * Formats a number with thousands separators
 * Adds commas as thousands separators to a given number for better readability.
 * @param {Number} num - Number to format
 * @returns {String} Formatted number string with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); // Regular expression for adding commas
}
  
/**
 * Creates a text-based progress bar
 * Generates a visual representation of progress as a text-based bar.
 * @param {Number} percentage - Percentage value (0-100) representing progress
 * @param {Number} width - Width of the progress bar (default: 20 characters)
 * @returns {String} Text progress bar with percentage
 */
function createTextProgressBar(percentage, width = 20) {
  const filled = Math.round(width * percentage / 100); // Calculate the number of filled segments
  const empty = width - filled; // Calculate the number of empty segments
  
  return '[' + '='.repeat(filled) + ' '.repeat(empty) + '] ' + percentage.toFixed(1) + '%'; // Construct the progress bar
}
  
// Export the utility functions for use in other modules
module.exports = {
  formatBytes,
  formatDuration,
  formatNumber,
  createTextProgressBar
};