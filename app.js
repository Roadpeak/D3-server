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

require('dotenv').config();

const app = express();

// CORS Configuration
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
    'Origin'
  ],
  exposedHeaders: ['Authorization'],
  maxAge: 86400, // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Trust proxy (important for production deployments)
app.set('trust proxy', 1);

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
app.use('/api/v1/chats', chatRoutes);
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

// Temporary debug routes - add these to your app.js
app.get('/api/v1/users/test', (req, res) => {
  res.json({ message: 'User routes are working via app.js!' });
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

// Add this temporary login route to your app.js
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
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { userId: 1, email: email },
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

// Also add register route
app.post('/api/v1/users/register', (req, res) => {
  console.log('Registration attempt:', req.body);
  const { firstName, lastName, email, phoneNumber, password } = req.body;
  
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { userId: 2, email: email },
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
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
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

module.exports = app;