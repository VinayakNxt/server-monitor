/**
 * Database Setup Script
 * Run this script to initialize the database schema
 */
require('dotenv').config(); // Load environment variables from .env file
const db = require('../db'); // Import database module
const logger = require('../src/utils/logger'); // Import logger utility

/**
 * Function to setup the database schema
 */
async function setupDatabase() {
  logger.info('Setting up database schema...'); // Log the start of the setup process
  
  try {
    // Initialize database connection
    db.initializeDatabase(); // Establish connection to the database
    
    // Setup schema
    const result = await db.setupSchema(); // Execute schema setup logic
    
    if (result) {
      logger.info('Database schema setup completed successfully'); // Log success message
    } else {
      logger.error('Failed to setup database schema'); // Log failure message
      process.exit(1); // Exit process with failure code
    }
  } catch (error) {
    // Handle any errors during the setup process
    logger.error('Error setting up database:', error); // Log error details
    process.exit(1); // Exit process with failure code
  } finally {
    // Close database connection
    await db.closeDatabase(); // Ensure database connection is closed
  }
  
  process.exit(0); // Exit process with success code
}

// Run the setup
setupDatabase(); // Execute the database setup function