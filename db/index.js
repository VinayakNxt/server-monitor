/**
 * Database connection module
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

// PostgreSQL connection pool
let pool = null;

/**
 * Initialize database connection
 */
function initializeDatabase() {
  if (process.env.DB_ENABLED !== 'true') {
    logger.info('Database connection disabled by configuration');
    return null;
  }

  try {
    const config = {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT) || 5432,
    };

    // Add SSL configuration if enabled
    if (process.env.DB_SSL === 'true') {
      config.ssl = {
        rejectUnauthorized: false // For development - set to true in production with proper CA
      };
    }

    pool = new Pool(config);

    // Test the connection
    pool.query('SELECT NOW()')
      .then(() => {
        logger.info('Successfully connected to PostgreSQL database');
      })
      .catch(err => {
        logger.error('Database connection error:', err);
      });

    // Handle pool errors
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
 */
function getPool() {
  if (!pool && process.env.DB_ENABLED === 'true') {
    return initializeDatabase();
  }
  return pool;
}

/**
 * Set up the database schema
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
    
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await client.query(schema);
    
    logger.info('Database schema set up successfully');
    return true;
  } catch (error) {
    logger.error('Error setting up database schema:', error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Close database connections
 */
async function closeDatabase() {
  if (pool) {
    logger.info('Closing database connections...');
    await pool.end();
    pool = null;
    logger.info('Database connections closed');
  }
}

module.exports = {
  initializeDatabase,
  getPool,
  setupSchema,
  closeDatabase
};