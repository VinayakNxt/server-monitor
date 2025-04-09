/**
 * Database connection module
 * This module provides functionality to initialize, manage, and close a PostgreSQL database connection pool.
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

// PostgreSQL connection pool instance
let pool = null;

/**
 * Initialize database connection
 * This function sets up the PostgreSQL connection pool using environment variables.
 * If the database is disabled via configuration, it logs the information and skips initialization.
 * 
 * @returns {Pool|null} The initialized connection pool or null if disabled or failed.
 */
function initializeDatabase() {
  if (process.env.DB_ENABLED !== 'true') {
    logger.info('Database connection disabled by configuration');
    return null;
  }

  try {
    // Database connection configuration
    const config = {
      user: process.env.DB_USER, // Database username
      host: process.env.DB_HOST, // Database host
      database: process.env.DB_NAME, // Database name
      password: process.env.DB_PASSWORD, // Database password
      port: parseInt(process.env.DB_PORT) || 5432, // Database port (default: 5432)
    };

    // Add SSL configuration if enabled
    if (process.env.DB_SSL === 'true') {
      config.ssl = {
        rejectUnauthorized: false // For development - set to true in production with proper CA
      };
    }

    // Create a new connection pool
    pool = new Pool(config);

    // Test the connection by executing a simple query
    pool.query('SELECT NOW()')
      .then(() => {
        logger.info('Successfully connected to PostgreSQL database');
      })
      .catch(err => {
        logger.error('Database connection error:', err);
      });

    // Handle unexpected errors on the pool
    pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });

    return pool;
  } catch (error) {
    logger.error('Failed to initialize database connection:', error);
    return null;
  }
}

/**
 * Get the database connection pool
 * This function returns the existing connection pool or initializes it if not already created.
 * 
 * @returns {Pool|null} The connection pool or null if not initialized.
 */
function getPool() {
  if (!pool && process.env.DB_ENABLED === 'true') {
    return initializeDatabase();
  }
  return pool;
}

/**
 * Set up the database schema
 * This function reads the schema SQL file and executes it to set up the database schema.
 * If the database is disabled or the connection is unavailable, it logs the appropriate message and skips setup.
 * 
 * @returns {Promise<boolean>} True if the schema was set up successfully, false otherwise.
 */
async function setupSchema() {
  if (process.env.DB_ENABLED !== 'true') {
    logger.info('Database setup skipped - database disabled by configuration');
    return false;
  }

  const pool = getPool();
  if (!pool) {
    logger.error('Cannot set up schema - no database connection');
    return false;
  }

  const client = await pool.connect();
  try {
    logger.info('Setting up database schema...');
    
    // Read the schema file from the file system
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema SQL commands
    await client.query(schema);
    
    logger.info('Database schema set up successfully');
    return true;
  } catch (error) {
    logger.error('Error setting up database schema:', error);
    return false;
  } finally {
    // Release the client back to the pool
    client.release();
  }
}

/**
 * Close database connections
 * This function gracefully closes all connections in the pool and cleans up resources.
 * 
 * @returns {Promise<void>} Resolves when the connections are closed.
 */
async function closeDatabase() {
  if (pool) {
    logger.info('Closing database connections...');
    await pool.end(); // Close all connections in the pool
    pool = null; // Reset the pool instance
    logger.info('Database connections closed');
  }
}

// Export the module functions
module.exports = {
  initializeDatabase,
  getPool,
  setupSchema,
  closeDatabase
};