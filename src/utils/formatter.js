/**
 * Utility functions for formatting data
 */

/**
 * Formats bytes into human-readable format
 * @param {Number} bytes - Number of bytes
 * @param {Number} decimals - Number of decimal places (default: 2)
 * @returns {String} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }
  
  /**
   * Formats milliseconds into human-readable duration
   * @param {Number} ms - Number of milliseconds
   * @returns {String} Formatted duration string
   */
  function formatDuration(ms) {
    if (ms < 1000) {
      return ms + 'ms';
    }
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
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
   * @param {Number} num - Number to format
   * @returns {String} Formatted number string
   */
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  /**
   * Creates a text-based progress bar
   * @param {Number} percentage - Percentage value (0-100)
   * @param {Number} width - Width of the bar
   * @returns {String} Text progress bar
   */
  function createTextProgressBar(percentage, width = 20) {
    const filled = Math.round(width * percentage / 100);
    const empty = width - filled;
    
    return '[' + '='.repeat(filled) + ' '.repeat(empty) + '] ' + percentage.toFixed(1) + '%';
  }
  
  module.exports = {
    formatBytes,
    formatDuration,
    formatNumber,
    createTextProgressBar
  };