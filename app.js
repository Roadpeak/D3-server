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
const socialRoutes = require('./routes/socialsRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const formRoutes = require('./routes/formRoutes');
const formFieldRoutes = require('./routes/formFieldRoutes');
const formResponseRoutes = require('./routes/formResponses');
const followRoutes = require('./routes/followRoutes');
const likeRoutes = require('./routes/likeRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const chatRoutes = require('./routes/chatRoutes');
const heroRoutes = require('./routes/heroRoutes');
const { socketManager } = require('./socket/websocket');
const homedealsstores = require('./routes/homedealsstoresRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const swaggerFile = path.join(__dirname, 'swagger_output.json');

// Import API key middleware
const { apiKeyMiddleware } = require('./middleware/apiKey');

require('dotenv').config();

const app = express();

// CORS Configuration - FIXED VERSION
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
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

// ADDITIONAL CORS MIDDLEWARE for extra compatibility
app.use((req, res, next) => {
  // Get the origin from the request
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
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
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, credentials, api-key, x-api-key, X-API-Key'
  );
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).json({
      body: "OK"
    });
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

// Request logging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.method === 'OPTIONS') {
      console.log('  - PREFLIGHT REQUEST');
      console.log('  - Origin:', req.headers.origin);
      console.log('  - Requested Headers:', req.headers['access-control-request-headers']);
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
    database: 'connected'
  });
});

// CORS test endpoint
app.get('/api/v1/cors-test', (req, res) => {
  res.status(200).json({
    message: 'CORS is working!',
    origin: req.headers.origin,
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/merchants', merchantRoutes);
app.use('/api/v1/stores', storesRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/offers', offerRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/hero', heroRoutes);
app.use('/api/v1/social', socialRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/service-forms', serviceFormsRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/follows', followRoutes);
app.use('/api/v1/home-deals-stores', homedealsstores);
app.use('/api/v1/chat', chatRoutes); // Chat routes - should now work with CORS fix
app.use('/api/v1/likes', likeRoutes);
app.use('/api/v1/forms', formRoutes);
app.use('/api/v1/form-fields', formFieldRoutes);
app.use('/api/v1/form-responses', formResponseRoutes);
app.use('/api/v1/service-requests', serviceRequestRoutes);

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

// Database Sync - Clean production-ready version
async function initializeDatabase() {
  try {
    const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    
    if (isDevelopment) {
      console.log('🔄 Development mode: Syncing database...');
      // Use alter in development to handle schema changes
      await sequelize.sync({ alter: true });
      console.log('✅ Database synced successfully!');
      
      // Add test data in development
      await seedTestData();
    } else {
      console.log('🔄 Production mode: Syncing database...');
      // Use safe sync in production
      await sequelize.sync();
      console.log('✅ Database synced successfully!');
    }
    
  } catch (err) {
    console.error('❌ Error syncing database:', err);
    process.exit(1);
  }
}

// Optional: Seed some test data (only in development)
async function seedTestData() {
  try {
    const { User } = sequelize.models;
    
    // Check if users already exist
    const userCount = await User.count();
    if (userCount > 0) {
      console.log('📊 Test data already exists, skipping seed...');
      return;
    }
    
    // Create test users
    const testUsers = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneNumber: '+1234567890',
        password: 'password123',
        userType: 'customer'
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phoneNumber: '+0987654321',
        password: 'password123',
        userType: 'merchant'
      },
      {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@discoun3ree.com',
        phoneNumber: '+1111111111',
        password: 'admin123',
        userType: 'admin'
      }
    ];
    
    for (const userData of testUsers) {
      await User.create(userData);
    }
    
    console.log('🌱 Test data seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // CORS error handling
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      message: 'CORS policy violation',
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

// Initialize database
initializeDatabase();

// Temporary debug routes for testing
if (process.env.NODE_ENV === 'development') {
  const jwt = require('jsonwebtoken');
  
  app.get('/api/v1/users/test', (req, res) => {
    res.json({ message: 'User routes are working via app.js!', timestamp: new Date().toISOString() });
  });

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

  // Test login route
  app.post('/api/v1/users/login', (req, res) => {
    console.log('Login attempt:', req.body);
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password required',
        errors: {}
      });
    }
    
    // Simple test login - accept any email/password for now
    const token = jwt.sign(
      { 
        userId: 1, 
        email: email,
        type: 'user' // Important: specify the type
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );
    
    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: 1,
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

  // Test register route
  app.post('/api/v1/users/register', (req, res) => {
    console.log('Registration attempt:', req.body);
    const { firstName, lastName, email, phoneNumber, password } = req.body;
    
    const token = jwt.sign(
      { 
        userId: 2, 
        email: email,
        type: 'user'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );
    
    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: 2,
        firstName: firstName,
        lastName: lastName,
        email: email,
        phoneNumber: phoneNumber,
        userType: 'customer',
      },
      access_token: token,
    });
  });

  // Test profile route for debugging auth
  app.get('/api/v1/users/profile', (req, res) => {
    // Simple middleware to check token
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
          id: decoded.userId,
          firstName: 'Test',
          lastName: 'User',
          email: decoded.email,
          phoneNumber: '+1234567890',
          userType: 'customer'
        }
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  });
}

// Create HTTP Server
const server = http.createServer(app);

// WebSocket Setup with CORS
socketManager.initialize(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://discoun3ree.com',
      'https://merchants.discoun3ree.com'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1/api-docs`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`🧪 CORS Test: http://localhost:${PORT}/api/v1/cors-test`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/v1/chat/*`);
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  
  server.close(async () => {
    console.log('📡 HTTP server closed');
    
    try {
      await sequelize.close();
      console.log('🗄️  Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database connection:', error);
    }
    
    console.log('✅ Process terminated');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after 10 seconds');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Route debugging middleware - add this AFTER your routes are defined
if (process.env.NODE_ENV === 'development') {
  console.log('\n🔍 DEBUGGING ROUTES:');
  
  // Function to extract routes from the app
  const printRoutes = (app) => {
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        // Direct route
        console.log(`📍 ${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
      } else if (middleware.name === 'router') {
        // Router middleware
        const routerPath = middleware.regexp.source
          .replace('\\', '')
          .replace('(?:', '')
          .replace('\\', '')
          .replace('$', '');
        
        console.log(`📁 Router found: ${routerPath}`);
        
        if (middleware.handle && middleware.handle.stack) {
          middleware.handle.stack.forEach((handler) => {
            if (handler.route) {
              const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
              console.log(`  └─ ${methods} ${routerPath}${handler.route.path}`);
            }
          });
        }
      }
    });
  };
  
  // Print routes after a short delay to ensure they're all loaded
  setTimeout(() => {
    console.log('\n📋 REGISTERED ROUTES:');
    printRoutes(app);
    console.log('\n');
  }, 1000);
}

// Simple route test endpoints for verification
app.get('/debug/routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        method: Object.keys(middleware.route.methods),
        path: middleware.route.path
      });
    } else if (middleware.name === 'router') {
      const routerPath = middleware.regexp.source
        .replace(/\\/g, '')
        .replace('(?:', '')
        .replace('$', '');
      
      if (middleware.handle && middleware.handle.stack) {
        middleware.handle.stack.forEach((handler) => {
          if (handler.route) {
            routes.push({
              method: Object.keys(handler.route.methods),
              path: routerPath + handler.route.path
            });
          }
        });
      }
    }
  });
  
  res.json({
    message: 'Registered routes',
    routes: routes,
    timestamp: new Date().toISOString()
  });
});

// Test specific merchant endpoints
app.get('/debug/test-merchant', async (req, res) => {
  const tests = {};
  
  try {
    // Test 1: Basic merchant test endpoint
    try {
      const testResponse = await fetch('http://localhost:4000/api/v1/merchants/test');
      tests.merchantTest = {
        status: testResponse.status,
        success: testResponse.ok
      };
    } catch (error) {
      tests.merchantTest = { error: error.message };
    }
    
    res.json({
      message: 'Merchant endpoint tests',
      tests,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: 'Test failed'
    });
  }
});

module.exports = app;