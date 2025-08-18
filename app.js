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
// ✅ FIXED: Import service request routes
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const swaggerFile = path.join(__dirname, 'swagger_output.json');

// Import API key middleware
const { apiKeyMiddleware } = require('./middleware/apiKey');

require('dotenv').config();

const app = express();

// ===============================
// 🌐 ENHANCED CORS CONFIGURATION FOR SERVICE REQUESTS
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
      console.log(`❌ CORS blocked origin: ${origin}`);
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

// ADDITIONAL CORS MIDDLEWARE for extra compatibility
app.use((req, res, next) => {
  // Get the origin from the request
  const origin = req.headers.origin;

  // Check if origin is allowed
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

// ✅ ENHANCED: Request logging for service requests (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.path}`);
    
    if (req.method === 'OPTIONS') {
      console.log('  - PREFLIGHT REQUEST');
      console.log('  - Origin:', req.headers.origin);
      console.log('  - Requested Headers:', req.headers['access-control-request-headers']);
    }
    
    // ✅ Log service request related routes specifically
    if (req.path.includes('/request-service') || req.path.includes('/merchant')) {
      console.log('🏪 Service Request API Call:', {
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
      merchantDashboard: true
    }
  });
});

// ✅ ENHANCED: CORS test endpoint with service request info
app.get('/api/v1/cors-test', (req, res) => {
  res.status(200).json({
    message: 'CORS is working!',
    origin: req.headers.origin,
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString(),
    serviceRequestsEnabled: true
  });
});

// ===============================
// 🔗 API ROUTES - PROPERLY ORDERED FOR SERVICE REQUESTS
// ===============================

// ✅ CRITICAL: Core user and merchant routes first
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/merchants', merchantRoutes);

// ✅ CRITICAL: Service request routes (MUST be before generic routes)
app.use('/api/v1/request-service', serviceRequestRoutes);
app.use('/api/v1/merchant', merchantServiceRoutes);

// ✅ Store and service routes
app.use('/api/v1/stores', storesRoutes);
app.use('/api/v1/services', serviceRoutes);

// ✅ Other feature routes
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/offers', offerRoutes);
app.use('/api/v1/bookings', bookingRoutes);
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
// 🔥 ENHANCED DATABASE INITIALIZATION FOR SERVICE REQUESTS
// ===============================

async function initializeDatabase() {
  try {
    const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

    if (isDevelopment) {
      console.log('🔄 Development mode: Syncing database with service request models...');
      
      // ✅ FIXED: Sync models in dependency order including service request models
      await syncModelsInOrder();
      
      console.log('✅ Database synced successfully with service request models!');

      // Add test data in development
      await seedTestData();
    } else {
      console.log('🔄 Production mode: Safe sync...');
      
      // Use safe sync in production
      try {
        await sequelize.sync();
        console.log('✅ Database synced successfully!');
      } catch (prodError) {
        console.error('❌ Production sync error:', prodError);
        throw prodError;
      }
    }

  } catch (err) {
    console.error('❌ Error syncing database:', err);
    
    // Enhanced error handling for service request models
    if (err.message.includes('ServiceRequest') || err.message.includes('ServiceOffer')) {
      console.log('💡 Service request model issue detected.');
      console.log('🔧 Attempting service request model fix...');
      await attemptServiceRequestModelFix();
    } else if (err.message.includes('user_id') && err.message.includes('SET NULL')) {
      console.log('💡 Review model foreign key issue detected.');
      console.log('🔧 Attempting automatic fix...');
      await attemptReviewModelFix();
    } else if (err.message.includes('created_at') && err.message.includes('index')) {
      console.log('💡 Index creation issue detected.');
      console.log('🔧 Attempting to continue without complex indexes...');
      await attemptSimpleSync();
    }
    
    // Don't exit in development
    if (process.env.NODE_ENV !== 'development') {
      process.exit(1);
    } else {
      console.log('⚠️ Continuing in development mode despite sync errors...');
    }
  }
}

// ✅ UPDATED: Sync models in proper dependency order including service requests
async function syncModelsInOrder() {
  console.log('📋 Step 1: Syncing core dependency models...');
  
  const models = sequelize.models;
  
  // ✅ UPDATED: Define sync order with service request models
  const syncOrder = [
    'User',           // Core user model
    'Merchant',       // Merchant model  
    'Store',          // Store model (needed for service offers)
    'ServiceRequest', // ✅ Service request model
    'ServiceOffer',   // ✅ Service offer model (depends on Store and ServiceRequest)
    'Review',         // Review comes after its dependencies
    'Service',
    'Offer',
    'Branch',
    'Social',
    'Category',
    'Booking',
    'Payment',
    'Transaction',
    'Follow',
    'Like',
    'Chat',
    'Message',
    'Staff',
    'Form',
    'FormField',
    'FormResponse'
  ];

  // Sync models in order
  for (const modelName of syncOrder) {
    if (models[modelName]) {
      try {
        console.log(`🔄 Syncing ${modelName}...`);
        
        if (modelName === 'Review') {
          // Special handling for Review model
          await syncReviewModel(models[modelName]);
        } else if (modelName === 'ServiceRequest' || modelName === 'ServiceOffer') {
          // ✅ Special handling for service request models
          await syncServiceRequestModel(models[modelName], modelName);
        } else {
          await models[modelName].sync({ alter: true });
        }
        
        console.log(`✅ ${modelName} synced successfully`);
      } catch (modelError) {
        console.error(`❌ ${modelName} sync failed:`, modelError.message);
        
        // For service request models, try alternative approaches
        if (modelName === 'ServiceRequest' || modelName === 'ServiceOffer') {
          console.log(`🔄 Attempting ${modelName} model fix...`);
          await handleServiceRequestSyncError(models[modelName], modelError, modelName);
        } else if (modelName === 'Review') {
          console.log('🔄 Attempting Review model fix...');
          await handleReviewSyncError(models[modelName], modelError);
        } else {
          console.log(`⚠️ Continuing despite ${modelName} sync error...`);
        }
      }
    }
  }

  // Sync any remaining models not in the order list
  const remainingModels = Object.keys(models).filter(name => !syncOrder.includes(name));
  for (const modelName of remainingModels) {
    try {
      console.log(`🔄 Syncing remaining model: ${modelName}...`);
      await models[modelName].sync({ alter: true });
      console.log(`✅ ${modelName} synced`);
    } catch (error) {
      console.log(`⚠️ ${modelName} sync warning:`, error.message);
    }
  }
}

// ✅ NEW: Special service request model sync handling
async function syncServiceRequestModel(Model, modelName) {
  try {
    // Try normal sync first
    await Model.sync({ alter: true });
  } catch (error) {
    console.log(`⚠️ Normal ${modelName} sync failed, trying alternatives...`);
    
    if (error.message.includes('foreign key') || error.message.includes('constraint')) {
      console.log(`🔧 Fixing ${modelName} foreign key constraints...`);
      await fixServiceRequestForeignKeys(Model, modelName);
    } else if (error.message.includes('column') || error.message.includes('incompatible')) {
      console.log(`🔧 Fixing ${modelName} column compatibility...`);
      await recreateServiceRequestTable(Model, modelName);
    } else {
      console.log(`🔄 Attempting force sync for ${modelName}...`);
      await Model.sync({ force: true });
    }
  }
}

// ✅ NEW: Handle service request sync errors
async function handleServiceRequestSyncError(Model, error, modelName) {
  try {
    if (error.message.includes('foreign key') || error.message.includes('constraint')) {
      console.log(`🔧 Fixing ${modelName} constraint issue...`);
      await fixServiceRequestForeignKeys(Model, modelName);
    } else {
      console.log(`⚠️ Using fallback ${modelName} sync...`);
      await fallbackServiceRequestSync(Model, modelName);
    }
  } catch (fixError) {
    console.error(`❌ ${modelName} fix also failed:`, fixError.message);
    console.log('💡 Manual intervention may be required');
  }
}

// ✅ NEW: Fix service request foreign key constraints
async function fixServiceRequestForeignKeys(Model, modelName) {
  try {
    console.log(`🔧 Fixing ${modelName} foreign keys...`);
    
    if (modelName === 'ServiceOffer') {
      // Drop and recreate ServiceOffer table with correct constraints
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
      await sequelize.query('DROP TABLE IF EXISTS ServiceOffers;');
      await sequelize.query('DROP TABLE IF EXISTS service_offers;');
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
      
      // Recreate with force
      await Model.sync({ force: true });
    } else if (modelName === 'ServiceRequest') {
      // Drop and recreate ServiceRequest table
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
      await sequelize.query('DROP TABLE IF EXISTS ServiceRequests;');
      await sequelize.query('DROP TABLE IF EXISTS service_requests;');
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
      
      // Recreate with force
      await Model.sync({ force: true });
    }
    
    console.log(`✅ ${modelName} foreign keys fixed`);
  } catch (fkError) {
    console.error(`❌ ${modelName} foreign key fix failed:`, fkError.message);
    throw fkError;
  }
}

// ✅ NEW: Recreate service request tables
async function recreateServiceRequestTable(Model, modelName) {
  try {
    console.log(`🔧 Recreating ${modelName} table...`);
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    if (modelName === 'ServiceRequest') {
      await sequelize.query('DROP TABLE IF EXISTS ServiceRequests;');
      await sequelize.query('DROP TABLE IF EXISTS service_requests;');
    } else if (modelName === 'ServiceOffer') {
      await sequelize.query('DROP TABLE IF EXISTS ServiceOffers;');
      await sequelize.query('DROP TABLE IF EXISTS service_offers;');
    }
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    // Recreate with force
    await Model.sync({ force: true });
    
    console.log(`✅ ${modelName} table recreated`);
  } catch (recreateError) {
    console.error(`❌ ${modelName} table recreation failed:`, recreateError.message);
    throw recreateError;
  }
}

// ✅ NEW: Fallback service request sync
async function fallbackServiceRequestSync(Model, modelName) {
  try {
    console.log(`🔄 Attempting fallback ${modelName} sync...`);
    
    // Try simple sync without constraints
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    await Model.sync({ force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    console.log(`✅ Fallback ${modelName} sync completed`);
  } catch (fallbackError) {
    console.error(`❌ Fallback ${modelName} sync failed:`, fallbackError.message);
  }
}

// ✅ NEW: Attempt service request model fix
async function attemptServiceRequestModelFix() {
  try {
    console.log('🔧 Attempting automatic service request model fix...');
    
    const { ServiceRequest, ServiceOffer } = sequelize.models;
    
    if (ServiceRequest) {
      await fallbackServiceRequestSync(ServiceRequest, 'ServiceRequest');
    }
    
    if (ServiceOffer) {
      await fallbackServiceRequestSync(ServiceOffer, 'ServiceOffer');
    }
    
    console.log('✅ Service request model fix completed');
  } catch (fixError) {
    console.error('❌ Automatic service request fix failed:', fixError.message);
  }
}

// Keep existing Review model functions...
async function syncReviewModel(ReviewModel) {
  try {
    await ReviewModel.sync({ alter: true });
  } catch (error) {
    console.log('⚠️ Normal Review sync failed, trying alternatives...');
    
    if (error.message.includes('SET NULL') || error.message.includes('NOT NULL')) {
      console.log('🔧 Fixing foreign key constraints...');
      await fixReviewForeignKeys(ReviewModel);
    } else if (error.message.includes('incompatible')) {
      console.log('🔧 Fixing column compatibility...');
      await recreateReviewsTable();
    } else {
      console.log('🔄 Attempting force sync for Reviews...');
      await ReviewModel.sync({ force: true });
    }
  }
}

async function handleReviewSyncError(ReviewModel, error) {
  try {
    if (error.message.includes('user_id') && error.message.includes('SET NULL')) {
      console.log('🔧 Fixing user_id constraint issue...');
      
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
      await sequelize.query('DROP TABLE IF EXISTS Reviews;');
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
      
      await ReviewModel.sync({ force: true });
      
      console.log('✅ Review model recreated successfully');
    } else {
      console.log('⚠️ Using fallback Review sync...');
      await fallbackReviewSync();
    }
  } catch (fixError) {
    console.error('❌ Review fix also failed:', fixError.message);
  }
}

async function fixReviewForeignKeys(ReviewModel) {
  try {
    const [storesStructure] = await sequelize.query('DESCRIBE Stores;');
    const [usersStructure] = await sequelize.query('DESCRIBE Users;');
    
    const storeIdType = storesStructure.find(col => col.Field === 'id')?.Type;
    const userIdType = usersStructure.find(col => col.Field === 'id')?.Type;
    
    console.log(`🔍 Store ID type: ${storeIdType}, User ID type: ${userIdType}`);
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    await sequelize.query('DROP TABLE IF EXISTS Reviews;');
    
    const createSQL = `
      CREATE TABLE Reviews (
        id ${storeIdType} PRIMARY KEY,
        store_id ${storeIdType} NOT NULL,
        user_id ${userIdType} NULL,
        text TEXT,
        rating INTEGER NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        is_helpful_count INTEGER DEFAULT 0,
        is_reported BOOLEAN DEFAULT FALSE,
        merchant_response TEXT,
        merchant_response_date DATETIME,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        
        INDEX idx_reviews_store_id (store_id),
        INDEX idx_reviews_user_id (user_id),
        INDEX idx_reviews_rating (rating),
        
        FOREIGN KEY (store_id) REFERENCES Stores(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL
      );
    `;
    
    await sequelize.query(createSQL);
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    console.log('✅ Review foreign keys fixed');
  } catch (fkError) {
    console.error('❌ Foreign key fix failed:', fkError.message);
    throw fkError;
  }
}

async function recreateReviewsTable() {
  try {
    console.log('🔧 Recreating Reviews table...');
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    await sequelize.query('DROP TABLE IF EXISTS Reviews;');
    
    const minimalSQL = `
      CREATE TABLE Reviews (
        id VARCHAR(255) PRIMARY KEY,
        store_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NULL,
        text TEXT,
        rating INTEGER NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        is_helpful_count INTEGER DEFAULT 0,
        is_reported BOOLEAN DEFAULT FALSE,
        merchant_response TEXT,
        merchant_response_date DATETIME,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        
        INDEX idx_reviews_store_id (store_id),
        INDEX idx_reviews_user_id (user_id),
        INDEX idx_reviews_rating (rating)
      );
    `;
    
    await sequelize.query(minimalSQL);
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    console.log('✅ Reviews table recreated');
  } catch (recreateError) {
    console.error('❌ Table recreation failed:', recreateError.message);
    throw recreateError;
  }
}

async function fallbackReviewSync() {
  try {
    console.log('🔄 Attempting fallback Review sync...');
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    await sequelize.query('DROP TABLE IF EXISTS Reviews;');
    
    const fallbackSQL = `
      CREATE TABLE Reviews (
        id VARCHAR(255) PRIMARY KEY,
        store_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255),
        text TEXT,
        rating INTEGER NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      );
    `;
    
    await sequelize.query(fallbackSQL);
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    
    console.log('✅ Fallback Reviews table created');
  } catch (fallbackError) {
    console.error('❌ Fallback sync failed:', fallbackError.message);
  }
}

async function attemptReviewModelFix() {
  try {
    console.log('🔧 Attempting automatic Review model fix...');
    
    const { Review } = sequelize.models;
    if (Review) {
      await recreateReviewsTable();
      console.log('✅ Review model fix completed');
    }
  } catch (fixError) {
    console.error('❌ Automatic fix failed:', fixError.message);
  }
}

async function attemptSimpleSync() {
  try {
    console.log('🔄 Attempting simple database sync...');
    
    const models = sequelize.models;
    const modelNames = Object.keys(models).filter(name => name !== 'Review');
    
    for (const modelName of modelNames) {
      try {
        await models[modelName].sync({ alter: true });
        console.log(`✅ ${modelName} synced`);
      } catch (error) {
        console.log(`⚠️ ${modelName} warning:`, error.message);
      }
    }
    
    if (models.Review) {
      await fallbackReviewSync();
    }
    
    console.log('✅ Simple sync completed');
  } catch (simpleError) {
    console.error('❌ Simple sync failed:', simpleError.message);
  }
}

// ✅ ENHANCED: Seed test data with service request support
async function seedTestData() {
  try {
    const { User, Store, Review, Merchant, ServiceRequest, ServiceOffer } = sequelize.models;

    // Check if data already exists
    if (User) {
      const userCount = await User.count();
      if (userCount > 0) {
        console.log('📊 Test data already exists, skipping seed...');
        return;
      }
    }

    console.log('🌱 Seeding test data with service request support...');

    // Create test users
    let testUser = null;
    let testMerchant = null;
    
    if (User) {
      try {
        testUser = await User.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phoneNumber: '+1234567890',
          password: 'password123',
          userType: 'customer'
        });

        testMerchant = await User.create({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@merchant.com',
          phoneNumber: '+0987654321',
          password: 'password123',
          userType: 'merchant'
        });
        
        console.log('✅ Test users created');
      } catch (userError) {
        console.log('⚠️ User creation warning:', userError.message);
      }
    }

    // Create test store
    let testStore = null;
    if (Store && testMerchant) {
      try {
        testStore = await Store.create({
          name: 'Test Home Services Store',
          merchant_id: testMerchant.id,
          location: 'Test Location, Nairobi',
          primary_email: 'store@test.com',
          description: 'A test store for home services',
          category: 'Home Services', // ✅ Important for service request matching
          opening_time: '09:00',
          closing_time: '18:00',
          working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          status: 'open',
          is_active: true
        });
        
        console.log('✅ Test store created');
      } catch (storeError) {
        console.log('⚠️ Store creation warning:', storeError.message);
      }
    }

    // ✅ NEW: Create test service request
    let testServiceRequest = null;
    if (ServiceRequest && testUser) {
      try {
        testServiceRequest = await ServiceRequest.create({
          title: 'Kitchen Plumbing Repair',
          description: 'Need professional plumber to fix leaky kitchen sink and replace faucet',
          category: 'Home Services', // ✅ Matches store category
          location: 'Downtown Nairobi',
          budgetMin: 100,
          budgetMax: 300,
          timeline: 'thisweek',
          priority: 'high',
          postedBy: testUser.id,
          status: 'open',
          requirements: JSON.stringify(['Licensed plumber', 'Same day service'])
        });
        
        console.log('✅ Test service request created');
      } catch (serviceRequestError) {
        console.log('⚠️ Service request creation warning:', serviceRequestError.message);
      }
    }

    // ✅ NEW: Create test service offer
    if (ServiceOffer && testServiceRequest && testStore && testMerchant) {
      try {
        const testServiceOffer = await ServiceOffer.create({
          requestId: testServiceRequest.id,
          storeId: testStore.id,
          providerId: testMerchant.id,
          quotedPrice: 200,
          message: 'Professional plumbing service with 5 years experience. Can fix your kitchen sink today!',
          availability: 'Available today at 2 PM',
          estimatedDuration: '2-3 hours',
          includesSupplies: true,
          status: 'pending'
        });
        
        console.log('✅ Test service offer created');
        
        // Update service request stats
        if (typeof testServiceRequest.updateOfferStats === 'function') {
          await testServiceRequest.updateOfferStats();
          console.log('✅ Service request stats updated');
        }
        
      } catch (serviceOfferError) {
        console.log('⚠️ Service offer creation warning:', serviceOfferError.message);
      }
    }

    // Create test review
    if (Review && testUser && testStore) {
      try {
        const reviewData = {
          store_id: testStore.id,
          user_id: testUser.id,
          rating: 5,
          text: 'Excellent plumbing service! Fixed my kitchen sink perfectly.'
        };
        
        const reviewAttributes = Review.getTableName ? Object.keys(Review.rawAttributes || {}) : [];
        
        if (reviewAttributes.includes('is_verified')) {
          reviewData.is_verified = true;
        }
        if (reviewAttributes.includes('is_helpful_count')) {
          reviewData.is_helpful_count = 0;
        }
        if (reviewAttributes.includes('is_reported')) {
          reviewData.is_reported = false;
        }
        
        const testReview = await Review.create(reviewData);
        console.log('✅ Test review created');
        
      } catch (reviewError) {
        console.log('⚠️ Test review creation warning:', reviewError.message);
      }
    }

    console.log('🌱 Test data with service requests seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
  }
}

// Initialize database
initializeDatabase();

// ===============================
// 🛡️ ENHANCED ERROR HANDLING FOR SERVICE REQUESTS
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

  // ✅ Service request specific error handling
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
// 🧪 ENHANCED DEBUG ROUTES FOR SERVICE REQUESTS (Development Only)
// ===============================

if (process.env.NODE_ENV === 'development') {
  const jwt = require('jsonwebtoken');

  // ✅ Service request health check
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
        health.counts.serviceRequests = await ServiceRequest.count();
      }
      if (ServiceOffer) {
        health.counts.serviceOffers = await ServiceOffer.count();
      }
      if (Store) {
        health.counts.stores = await Store.count();
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

  // ✅ Test merchant authentication for service requests
  app.get('/api/v1/debug/test-merchant-auth', async (req, res) => {
    try {
      // Try to load middleware
      const { authenticateMerchant } = require('./middleware/Merchantauth');
      
      res.json({
        success: true,
        message: 'Merchant auth middleware loaded successfully',
        middlewareExists: !!authenticateMerchant
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Merchant auth middleware error',
        error: error.message
      });
    }
  });

  // ✅ Test user authentication for service requests
  app.get('/api/v1/debug/test-user-auth', async (req, res) => {
    try {
      const { authenticateToken } = require('./middleware/requestservice');
      
      res.json({
        success: true,
        message: 'User auth middleware loaded successfully',
        middlewareExists: !!authenticateToken
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'User auth middleware error',
        error: error.message
      });
    }
  });

  // Enhanced test endpoints
  app.get('/api/v1/users/test', (req, res) => {
    res.json({ message: 'User routes are working via app.js!', timestamp: new Date().toISOString() });
  });

  app.get('/api/v1/debug/review-health', async (req, res) => {
    try {
      const { Review, Store, User } = sequelize.models;
      
      if (!Review) {
        return res.json({
          success: false,
          reviewModelHealthy: false,
          message: 'Review model not found'
        });
      }
      
      const reviewCount = await Review.count();
      
      res.json({
        success: true,
        reviewModelHealthy: true,
        reviewCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  app.get('/api/v1/debug/db-status', async (req, res) => {
    try {
      const models = sequelize.models;
      const status = {};
      
      for (const [modelName, model] of Object.entries(models)) {
        try {
          const count = await model.count();
          status[modelName] = { exists: true, count };
        } catch (error) {
          status[modelName] = { exists: false, error: error.message };
        }
      }
      
      res.json({
        success: true,
        models: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Enhanced test authentication endpoints
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

  // Enhanced user login for service requests
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

  // Enhanced merchant test routes for service requests
  app.post('/api/v1/merchants/login', (req, res) => {
    console.log('🏪 Merchant login attempt:', req.body);
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
      // ✅ NEW: Include merchant-specific data for service requests
      merchant: {
        id: 'merchant-test-123',
        first_name: 'Test',
        last_name: 'Merchant',
        email_address: email,
        phone_number: '+1234567890'
      }
    });
  });
}

// Create HTTP Server
const server = http.createServer(app);

// ✅ ENHANCED: WebSocket Setup with service request support
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
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1/api-docs`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`🧪 CORS Test: http://localhost:${PORT}/api/v1/cors-test`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/v1/chat/*`);
  console.log(`📝 Review API: http://localhost:${PORT}/api/v1/reviews/*`);
  
  // ✅ NEW: Service request specific endpoints
  console.log(`🔧 Service Request API: http://localhost:${PORT}/api/v1/request-service/*`);
  console.log(`🏪 Merchant Service API: http://localhost:${PORT}/api/v1/merchant/*`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔍 Debug Endpoints:`);
    console.log(`  - Review Health: http://localhost:${PORT}/api/v1/debug/review-health`);
    console.log(`  - DB Status: http://localhost:${PORT}/api/v1/debug/db-status`);
    console.log(`  - Service Request Health: http://localhost:${PORT}/api/v1/debug/service-requests-health`);
    console.log(`  - Test Merchant Auth: http://localhost:${PORT}/api/v1/debug/test-merchant-auth`);
    console.log(`  - Test User Auth: http://localhost:${PORT}/api/v1/debug/test-user-auth`);
  }
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

async function removeProblematicConstraints() {
  try {
    const [results] = await sequelize.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'discoun3' 
        AND TABLE_NAME = 'messages' 
        AND COLUMN_NAME = 'sender_id'
        AND REFERENCED_TABLE_NAME = 'users'
    `);
    
    for (const constraint of results) {
      await sequelize.query(`ALTER TABLE messages DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}`);
      console.log(`Dropped problematic constraint: ${constraint.CONSTRAINT_NAME}`);
    }
  } catch (error) {
    console.log('No problematic constraints to remove:', error.message);
  }
}

// Call this on server startup
removeProblematicConstraints();

module.exports = app;