/**
 * Database Setup Script
 * Run this script to initialize the database schema
 */
require('dotenv').config();
const db = require('../db');
const logger = require('../src/utils/logger');

async function setupDatabase() {
  logger.info('Setting up database schema...');
  
  try {
    // Initialize database connection
    db.initializeDatabase();
    
    // Setup schema
    const result = await db.setupSchema();
    
    if (result) {
      logger.info('Database schema setup completed successfully');
    } else {
      logger.error('Failed to setup database schema');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await db.closeDatabase();
  }
  
  process.exit(0);
}

// Run the setup
setupDatabase();