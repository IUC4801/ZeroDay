/**
 * ZeroDay CVE Tracker - Backend Server
 * Main application entry point
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');

// Import configuration
const { connectDB, checkConnectionHealth, gracefulShutdown: dbShutdown } = require('./config/database');

// Import routes
const cveRoutes = require('./routes/cveRoutes');

// Import middleware
const { corsMiddleware, securityHeaders } = require('./middleware/cors');
const { requestLogger, errorLogger, logger } = require('./middleware/logger');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler, getErrorHandler } = require('./middleware/errorHandler');
const { sanitizeInputs } = require('./middleware/validateRequest');

// Import cron jobs
const cronJobs = require('./utils/cronJobs');

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_NAME = 'ZeroDay CVE Tracker';
const VERSION = '1.0.0';

// ============================================================================
// ASCII Art Banner
// ============================================================================

const printBanner = () => {
  console.log('\x1b[36m%s\x1b[0m', `
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ███████╗███████╗██████╗  ██████╗ ██████╗  █████╗ ██╗   ██╗    ║
║   ╚══███╔╝██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝    ║
║     ███╔╝ █████╗  ██████╔╝██║   ██║██║  ██║███████║ ╚████╔╝     ║
║    ███╔╝  ██╔══╝  ██╔══██╗██║   ██║██║  ██║██╔══██║  ╚██╔╝      ║
║   ███████╗███████╗██║  ██║╚██████╔╝██████╔╝██║  ██║   ██║       ║
║   ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝       ║
║                                                                   ║
║                    CVE Tracker Backend API                        ║
║                        Version ${VERSION}                           ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
  `);
};

const printConfig = () => {
  console.log('\x1b[33m%s\x1b[0m', '📋 Configuration:');
  console.log('   Environment:', NODE_ENV);
  console.log('   Port:', PORT);
  console.log('   Database:', process.env.MONGODB_URI ? 'Configured' : 'Not configured');
  console.log('   Cron Jobs:', process.env.ENABLE_CRON_JOBS !== 'false' ? 'Enabled' : 'Disabled');
  console.log('   Redis:', process.env.USE_REDIS === 'true' ? 'Enabled' : 'Disabled');
  console.log('   Log Level:', process.env.LOG_LEVEL || 'info');
  console.log('');
};

// ============================================================================
// Initialize Express App
// ============================================================================

const app = express();

// ============================================================================
// Apply Middleware (Order Matters!)
// ============================================================================

// 1. Security headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// 2. Additional security headers
app.use(securityHeaders);

// 3. CORS configuration
app.use(corsMiddleware);

// 4. Compression
app.use(compression());

// 5. Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 6. Request logging
app.use(requestLogger);

// 7. Input sanitization
app.use(sanitizeInputs);

// 8. Global rate limiting (applied to all routes)
if (NODE_ENV === 'production') {
  app.use(generalLimiter);
  logger.info('✅ Global rate limiting enabled');
}

// ============================================================================
// Health Check Endpoint
// ============================================================================

app.get('/api/health', async (req, res) => {
  try {
    const health = await checkConnectionHealth();
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      version: VERSION,
      database: health,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ============================================================================
// API Status Endpoint
// ============================================================================

app.get('/api/status', (req, res) => {
  const cronStatus = cronJobs.getJobsStatus();
  
  res.json({
    success: true,
    api: {
      name: APP_NAME,
      version: VERSION,
      environment: NODE_ENV
    },
    server: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    },
    cronJobs: cronStatus
  });
});

// ============================================================================
// Manual Cron Job Trigger Endpoints
// ============================================================================

app.post('/api/cron/trigger/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    
    await cronJobs.triggerJob(jobName);
    
    res.json({
      success: true,
      message: `Job ${jobName} triggered successfully`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/cron/status', (req, res) => {
  const status = cronJobs.getJobsStatus();
  
  res.json({
    success: true,
    jobs: status
  });
});

app.get('/api/cron/status/:jobName', (req, res) => {
  try {
    const { jobName } = req.params;
    const status = cronJobs.getJobStatus(jobName);
    
    res.json({
      success: true,
      job: status
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// Mount API Routes
// ============================================================================

app.use('/api/cves', cveRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to ZeroDay CVE Tracker API',
    version: VERSION,
    documentation: '/api/docs',
    health: '/api/health',
    status: '/api/status'
  });
});

// ============================================================================
// Error Handling Middleware
// ============================================================================

// Error logger
app.use(errorLogger);

// 404 handler (must come after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(getErrorHandler());

// ============================================================================
// Process Error Handlers
// ============================================================================

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 UNCAUGHT EXCEPTION! Shutting down...', {
    error: error.message,
    stack: error.stack
  });
  
  console.error('💥 Uncaught Exception:', error);
  
  // Perform cleanup
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 UNHANDLED REJECTION! Shutting down...', {
    reason: reason,
    promise: promise
  });
  
  console.error('💥 Unhandled Rejection:', reason);
  
  // Perform cleanup
  gracefulShutdown('unhandledRejection');
});

// Handle termination signals
process.on('SIGTERM', () => {
  logger.info('👋 SIGTERM received. Shutting down gracefully...');
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  logger.info('👋 SIGINT received. Shutting down gracefully...');
  gracefulShutdown('SIGINT');
});

// ============================================================================
// Graceful Shutdown Handler
// ============================================================================

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('⚠️  Shutdown already in progress...');
    return;
  }
  
  isShuttingDown = true;
  
  console.log(`\n🛑 Graceful shutdown initiated (${signal})...`);
  
  try {
    // Stop accepting new requests
    if (server) {
      console.log('⏹️  Closing HTTP server...');
      server.close(() => {
        console.log('✅ HTTP server closed');
      });
    }
    
    // Stop cron jobs
    console.log('⏹️  Stopping cron jobs...');
    await cronJobs.gracefulShutdown();
    
    // Close database connection
    console.log('⏹️  Closing database connection...');
    await dbShutdown();
    
    console.log('✅ Graceful shutdown complete');
    
    // Exit process
    process.exit(signal === 'uncaughtException' || signal === 'unhandledRejection' ? 1 : 0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// ============================================================================
// Server Initialization
// ============================================================================

let server;

const startServer = async () => {
  try {
    // Print banner
    printBanner();
    printConfig();
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');
    
    // Start HTTP server
    server = app.listen(PORT, () => {
      console.log('\x1b[32m%s\x1b[0m', `🚀 Server is running!`);
      console.log('   URL:', `http://localhost:${PORT}`);
      console.log('   Health:', `http://localhost:${PORT}/api/health`);
      console.log('   API:', `http://localhost:${PORT}/api/cves`);
      console.log('');
      
      logger.info('Server started', {
        port: PORT,
        environment: NODE_ENV,
        pid: process.pid
      });
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Error: Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });
    
    // Initialize and start cron jobs
    if (process.env.ENABLE_CRON_JOBS !== 'false') {
      console.log('⏰ Initializing cron jobs...');
      cronJobs.initCronJobs();
      cronJobs.startCronJobs();
      console.log('✅ Cron jobs started\n');
    } else {
      console.log('⏸️  Cron jobs disabled\n');
    }
    
    console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════════════════════════');
    console.log('\x1b[32m%s\x1b[0m', '✨ Application started successfully!');
    console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    logger.error('Server startup failed', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// ============================================================================
// Start Application
// ============================================================================

startServer();

// ============================================================================
// Export for testing
// ============================================================================

module.exports = app;
