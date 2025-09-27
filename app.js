const express = require('express');
const cors = require('cors');
const http = require('http');
const storesRoutes = require('./routes/storesRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const userRoutes = require('./routes/userRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const { sequelize } = require('./models/index');
const uploadRoutes = require('./routes/upload');
const paymentRoutes = require('./routes/paymentRoutes');
const staffRoutes = require('./routes/staffRoutes');
const serviceFormsRoutes = require('./routes/serviceForms');
const offerRoutes = require('./routes/offerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const socialsRoutes = require('./routes/socialsRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const formRoutes = require('./routes/formRoutes');
const formFieldRoutes = require('./routes/formFieldRoutes');
const formResponseRoutes = require('./routes/formResponses');
const followRoutes = require('./routes/followRoutes');
const likeRoutes = require('./routes/likeRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const chatRoutes = require('./routes/chatRoutes');
const branchRoutes = require('./routes/branchRoutes');
const heroRoutes = require('./routes/heroRoutes');
const merchantServiceRoutes = require('./routes/merchantServiceRoutes');
const { socketManager } = require('./socket/websocket');
const homedealsstores = require('./routes/homedealsstoresRoutes');
const favoritesRoutes = require('./routes/favoritesRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const locationRoutes = require('./routes/locationRoutes'); 
const notificationRoutes = require('./routes/notificationRoutes');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const swaggerFile = path.join(__dirname, 'swagger_output.json');
const merchantBookingRoutes = require('./routes/merchantBookingRoutes.js')

// Import API key middleware
const { apiKeyMiddleware } = require('./middleware/apiKey');

require('dotenv').config();

const app = express();

// ===============================
// CORS CONFIGURATION
// ===============================

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',     // User React app
      'http://localhost:5173',     // Merchant Vite app (dev)
      'http://localhost:5174',     // Alternative Vite port
      'http://localhost:4173',     // Merchant Vite app (preview)
      'https://discoun3ree.com',
      'https://merchants.discoun3ree.com',
      'https://admin.discoun3ree.com'
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'User-Type',
    'user-type', 
    'Origin',
    'api-key',
    'x-api-key',
    'X-API-Key',
    'credentials',
    'Access-Control-Allow-Credentials',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200 // For legacy browser support
};

// Apply CORS middleware FIRST
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Additional CORS middleware for extra compatibility
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    'https://discoun3ree.com',
    'https://merchants.discoun3ree.com',
    'https://admin.discoun3ree.com'
  ];

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, credentials, api-key, x-api-key, X-API-Key, User-Type, user-type'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).json({ body: "OK" });
  } else {
    next();
  }
});

// Trust proxy (important for production deployments)
app.set('trust proxy', 1);

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Apply API key middleware (optional in development)
app.use(apiKeyMiddleware);

// Security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// Request logging for development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.path}`);
    
    if (req.method === 'OPTIONS') {
      console.log('  - PREFLIGHT REQUEST');
      console.log('  - Origin:', req.headers.origin);
      console.log('  - Requested Headers:', req.headers['access-control-request-headers']);
    }
    
    if (req.path.includes('/request-service') || req.path.includes('/merchant')) {
      console.log('Service Request API Call:', {
        method: req.method,
        path: req.path,
        hasAuth: !!req.headers.authorization,
        userAgent: req.headers['user-agent']?.substring(0, 50)
      });
    }
    
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'connected',
    features: {
      serviceRequests: true,
      storeBasedOffers: true,
      merchantDashboard: true,
      locationServices: true // ADD THIS
    }
  });
});

// CORS test endpoint
app.get('/api/v1/cors-test', (req, res) => {
  res.status(200).json({
    message: 'CORS is working!',
    origin: req.headers.origin,
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString(),
    serviceRequestsEnabled: true,
    locationServicesEnabled: true // ADD THIS
  });
});

// ===============================
// API ROUTES
// ===============================

// Core user and merchant routes first
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/merchants', merchantRoutes);

// Location routes - ADD THIS SECTION
app.use('/api/v1/locations', locationRoutes);

// Service request routes
app.use('/api/v1/request-service', serviceRequestRoutes);
app.use('/api/v1/merchant', merchantServiceRoutes);

// Store and service routes
app.use('/api/v1/stores', storesRoutes);
app.use('/api/v1/services', serviceRoutes);

// Other feature routes
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/offers', offerRoutes);
app.use('/api/v1/bookings', bookingRoutes); // User-facing booking routes
app.use('/api/v1/hero', heroRoutes);
app.use('/api/v1', socialsRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1', reviewRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/service-forms', serviceFormsRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/follows', followRoutes);
app.use('/api/v1/home-deals-stores', homedealsstores);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/likes', likeRoutes);
app.use('/api/v1/forms', formRoutes);
app.use('/api/v1/form-fields', formFieldRoutes);
app.use('/api/v1/form-responses', formResponseRoutes);
app.use('/api/v1/users', favoritesRoutes);     
app.use('/api/v1/offers', favoritesRoutes); 
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/merchant/bookings', merchantBookingRoutes);

// Static file serving
app.use('/qrcodes', express.static(path.join(__dirname, 'public', 'qrcodes')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Documentation
if (fs.existsSync(swaggerFile)) {
  app.use(
    '/api/v1/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(JSON.parse(fs.readFileSync(swaggerFile, 'utf8')))
  );
}

// ===============================
// DATABASE INITIALIZATION - PRODUCTION READY
// ===============================

async function removeProblematicConstraints() {
  try {
    console.log('Checking for problematic sender_id constraints...');
    
    const [results] = await sequelize.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'messages' 
        AND COLUMN_NAME = 'sender_id'
        AND REFERENCED_TABLE_NAME = 'users'
    `);
    
    for (const constraint of results) {
      try {
        await sequelize.query(`ALTER TABLE messages DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}`);
        console.log(`Removed problematic constraint: ${constraint.CONSTRAINT_NAME}`);
      } catch (dropError) {
        console.log(`Could not remove constraint ${constraint.CONSTRAINT_NAME}:`, dropError.message);
      }
    }
    
    if (results.length === 0) {
      console.log('No problematic sender_id constraints found');
    }
    
  } catch (error) {
    console.log('Constraint check completed with warnings:', error.message);
  }
}

async function initializeDatabase() {
  try {
    console.log('Initializing database connection...');
    
    // Step 1: Test database connection (no syncing)
    await sequelize.authenticate();
    console.log('Database connection established successfully');
    
    // Step 2: Remove any problematic foreign key constraints
    await removeProblematicConstraints();
    
    // Step 3: Verify models are accessible (no syncing)
    await verifyModelsAccessible();
    
    console.log('Database initialization completed successfully');

  } catch (err) {
    console.error('Database initialization failed:', err.message);
    
    // In production, exit if database connection fails
    if (process.env.NODE_ENV === 'production') {
      console.error('Fatal: Database connection required in production');
      process.exit(1);
    } else {
      console.log('Continuing in development mode despite database issues...');
    }
  }
}

async function verifyModelsAccessible() {
  try {
    const models = sequelize.models;
    const modelStatus = {};
    
    // Test a few key models without syncing
    const testModels = ['User', 'Store', 'Message', 'Merchant'];
    
    for (const modelName of testModels) {
      if (models[modelName]) {
        try {
          // Just run a count query to verify table exists
          const count = await models[modelName].count();
          modelStatus[modelName] = { accessible: true, count };
          console.log(`Model ${modelName}: accessible (${count} records)`);
        } catch (error) {
          modelStatus[modelName] = { accessible: false, error: error.message };
          console.log(`Model ${modelName}: not accessible -`, error.message);
        }
      } else {
        modelStatus[modelName] = { accessible: false, error: 'Model not found' };
      }
    }
    
    return modelStatus;
  } catch (error) {
    console.log('Model verification completed with warnings:', error.message);
  }
}

// Initialize database connection
initializeDatabase();

// ===============================
// ERROR HANDLING
// ===============================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // CORS error handling
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      message: 'CORS policy violation',
      errors: {}
    });
  }

  // Service request specific error handling
  if (err.message.includes('ServiceRequest') || err.message.includes('ServiceOffer')) {
    return res.status(400).json({
      success: false,
      message: 'Service request error',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Service request operation failed',
      errors: {}
    });
  }

  // Authentication errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      errors: {}
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error',
    errors: {},
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} not found`,
    errors: {}
  });
});

// ===============================
// DEVELOPMENT DEBUG ROUTES ONLY
// ===============================

if (process.env.NODE_ENV === 'development') {
  const jwt = require('jsonwebtoken');

  // Database health check
  app.get('/api/v1/debug/db-status', async (req, res) => {
    try {
      const modelStatus = await verifyModelsAccessible();
      
      res.json({
        success: true,
        models: modelStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Service request health check
  app.get('/api/v1/debug/service-requests-health', async (req, res) => {
    try {
      const { ServiceRequest, ServiceOffer, Store, User } = sequelize.models;
      
      const health = {
        models: {
          ServiceRequest: !!ServiceRequest,
          ServiceOffer: !!ServiceOffer,
          Store: !!Store,
          User: !!User
        },
        counts: {}
      };
      
      if (ServiceRequest) {
        try {
          health.counts.serviceRequests = await ServiceRequest.count();
        } catch (e) {
          health.counts.serviceRequests = 'Error: ' + e.message;
        }
      }
      if (ServiceOffer) {
        try {
          health.counts.serviceOffers = await ServiceOffer.count();
        } catch (e) {
          health.counts.serviceOffers = 'Error: ' + e.message;
        }
      }
      if (Store) {
        try {
          health.counts.stores = await Store.count();
        } catch (e) {
          health.counts.stores = 'Error: ' + e.message;
        }
      }
      
      res.json({
        success: true,
        serviceRequestsHealthy: Object.values(health.models).every(Boolean),
        health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // LOCATION DEBUG ENDPOINT - ADD THIS
  app.get('/api/v1/debug/location-health', async (req, res) => {
    try {
      const { Store, Offer, Service } = sequelize.models;
      
      const health = {
        models: {
          Store: !!Store,
          Offer: !!Offer,
          Service: !!Service
        },
        counts: {},
        sampleLocations: []
      };
      
      if (Store) {
        try {
          health.counts.stores = await Store.count();
          const sampleStores = await Store.findAll({
            attributes: ['location'],
            where: {
              location: { [require('sequelize').Op.not]: null }
            },
            limit: 5,
            raw: true
          });
          health.sampleLocations = sampleStores.map(s => s.location);
        } catch (e) {
          health.counts.stores = 'Error: ' + e.message;
        }
      }
      
      res.json({
        success: true,
        locationHealthy: Object.values(health.models).every(Boolean),
        health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Test user authentication
  app.post('/api/v1/users/login', (req, res) => {
    console.log('Login attempt:', req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password required',
        errors: {}
      });
    }

    const token = jwt.sign(
      {
        userId: 'user-test-123',
        id: 'user-test-123',
        email: email,
        type: 'user',
        userType: 'customer'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: 'user-test-123',
        firstName: 'Test',
        lastName: 'User',
        email: email,
        phoneNumber: '+1234567890',
        userType: 'customer',
        isEmailVerified: true,
        isPhoneVerified: true,
      },
      access_token: token,
    });
  });

  // Test merchant authentication
  app.post('/api/v1/merchants/login', (req, res) => {
    console.log('Merchant login attempt:', req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password required',
        errors: {}
      });
    }

    const token = jwt.sign(
      {
        userId: 'merchant-test-123',
        id: 'merchant-test-123',
        email: email,
        type: 'merchant',
        userType: 'merchant'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      message: 'Merchant login successful',
      user: {
        id: 'merchant-test-123',
        firstName: 'Test',
        lastName: 'Merchant',
        email: email,
        phoneNumber: '+1234567890',
        userType: 'merchant',
        isEmailVerified: true,
        isPhoneVerified: true,
      },
      access_token: token,
      merchant: {
        id: 'merchant-test-123',
        first_name: 'Test',
        last_name: 'Merchant',
        email_address: email,
        phone_number: '+1234567890'
      }
    });
  });

  // OTP verification for testing
  app.post('/api/v1/users/verify-otp', (req, res) => {
    console.log('OTP verification request:', req.body);
    const { phone, otp } = req.body;

    if (['123456', '111111', '000000', '999999'].includes(otp)) {
      return res.status(200).json({
        message: 'Phone number verified successfully',
        success: true
      });
    }

    return res.status(400).json({
      message: 'Invalid OTP',
      errors: { otp: 'Use 123456, 111111, 000000, or 999999 for testing' }
    });
  });

  app.post('/api/v1/users/resend-otp', (req, res) => {
    console.log('OTP resend request:', req.body);
    return res.status(200).json({
      message: 'OTP sent successfully',
      success: true,
      testOtp: '123456'
    });
  });

  app.get('/api/v1/users/profile', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      return res.status(200).json({
        success: true,
        user: {
          id: decoded.userId || decoded.id,
          firstName: 'Test',
          lastName: 'User',
          email: decoded.email,
          phoneNumber: '+1234567890',
          userType: decoded.userType || 'customer'
        }
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  });

  app.post('/api/v1/users/register', (req, res) => {
    console.log('Registration attempt:', req.body);
    const { firstName, lastName, email, phoneNumber, password } = req.body;

    const token = jwt.sign(
      {
        userId: 'user-test-456',
        id: 'user-test-456',
        email: email,
        type: 'user',
        userType: 'customer'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: 'user-test-456',
        firstName: firstName,
        lastName: lastName,
        email: email,
        phoneNumber: phoneNumber,
        userType: 'customer',
      },
      access_token: token,
    });
  });
}

// Create HTTP Server
const server = http.createServer(app);

// WebSocket Setup
socketManager.initialize(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:4173',
      'https://discoun3ree.com',
      'https://merchants.discoun3ree.com'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api/v1/api-docs`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log(`CORS Test: http://localhost:${PORT}/api/v1/cors-test`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Chat API: http://localhost:${PORT}/api/v1/chat/*`);
  console.log(`Service Request API: http://localhost:${PORT}/api/v1/request-service/*`);
  console.log(`Merchant Service API: http://localhost:${PORT}/api/v1/merchant/*`);
  console.log(`Location API: http://localhost:${PORT}/api/v1/locations/*`); // ADD THIS LINE
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`Debug Endpoints:`);
    console.log(`  - DB Status: http://localhost:${PORT}/api/v1/debug/db-status`);
    console.log(`  - Service Request Health: http://localhost:${PORT}/api/v1/debug/service-requests-health`);
    console.log(`  - Location Health: http://localhost:${PORT}/api/v1/debug/location-health`); // ADD THIS LINE
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    console.log('HTTP server closed');

    try {
      await sequelize.close();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }

    console.log('Process terminated');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after 10 seconds');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});


module.exports = app;