const mongoose = require('mongoose');

// Connection pool and retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

// MongoDB connection options (for Mongoose 6.0+)
const connectionOptions = {
  maxPoolSize: 10, // Maximum number of connections in pool
  minPoolSize: 2, // Minimum number of connections in pool
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  heartbeatFrequencyMS: 10000, // Check server status every 10 seconds
};

/**
 * Connect to MongoDB with retry logic
 * @param {Number} retryCount - Current retry attempt (default: 0)
 * @returns {Promise<void>}
 */
const connectDB = async (retryCount = 0) => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    // Connect to MongoDB
    const conn = await mongoose.connect(mongoURI, connectionOptions);

    // Log success message with database name
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📦 Database Name: ${conn.connection.name}`);
    console.log(`🔗 Connection Pool: Min ${connectionOptions.minPoolSize}, Max ${connectionOptions.maxPoolSize}`);

    // Setup connection event monitoring
    setupConnectionMonitoring();

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error (Attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);

    // Retry logic with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount); // Exponential backoff
      console.log(`⏳ Retrying connection in ${delay / 1000} seconds...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDB(retryCount + 1);
    } else {
      console.error('💥 Max retry attempts reached. Unable to connect to MongoDB.');
      throw new Error('Failed to connect to MongoDB after multiple attempts');
    }
  }
};

/**
 * Setup connection event monitoring
 */
const setupConnectionMonitoring = () => {
  const db = mongoose.connection;

  // Connection successful
  db.on('connected', () => {
    console.log('🟢 Mongoose connected to MongoDB');
  });

  // Connection error
  db.on('error', (err) => {
    console.error('🔴 Mongoose connection error:', err);
  });

  // Connection disconnected
  db.on('disconnected', () => {
    console.log('🟡 Mongoose disconnected from MongoDB');
  });

  // Connection reconnected
  db.on('reconnected', () => {
    console.log('🔵 Mongoose reconnected to MongoDB');
  });

  // Connection timeout
  db.on('timeout', () => {
    console.warn('⚠️  Mongoose connection timeout');
  });

  // Connection close
  db.on('close', () => {
    console.log('⭕ Mongoose connection closed');
  });
};

/**
 * Graceful shutdown handler
 * Closes MongoDB connection cleanly
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n📴 ${signal} received. Closing MongoDB connection...`);
  
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during MongoDB connection closure:', error);
    process.exit(1);
  }
};

/**
 * Check database connection health
 * @returns {Object} Health status object
 */
const checkConnectionHealth = () => {
  const state = mongoose.connection.readyState;
  
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };

  const isHealthy = state === 1;
  const status = stateMap[state] || 'unknown';

  return {
    healthy: isHealthy,
    status: status,
    state: state,
    host: mongoose.connection.host || 'N/A',
    name: mongoose.connection.name || 'N/A',
    timestamp: new Date().toISOString()
  };
};

/**
 * Get detailed connection info
 * @returns {Object} Connection information
 */
const getConnectionInfo = () => {
  const conn = mongoose.connection;
  
  return {
    readyState: conn.readyState,
    host: conn.host || 'N/A',
    port: conn.port || 'N/A',
    name: conn.name || 'N/A',
    models: Object.keys(conn.models),
    collections: Object.keys(conn.collections),
  };
};

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed successfully');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
    throw error;
  }
};

// Register graceful shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = {
  connectDB,
  checkConnectionHealth,
  getConnectionInfo,
  disconnectDB,
  gracefulShutdown
};
