// routes/merchantRoutes.js - Safe version with proper imports
const express = require('express');
const router = express.Router();

// Import merchant controller
const merchantController = require('../controllers/merchantController');

// Import auth middleware with error handling
let authenticateMerchant, authenticateAdmin, authRateLimit;

try {
  const authMiddleware = require('../middleware/auth');
  authenticateMerchant = authMiddleware.authenticateMerchant;
  authenticateAdmin = authMiddleware.authenticateAdmin;
  authRateLimit = authMiddleware.authRateLimit;
  
  console.log('✅ Auth middleware imported successfully:', {
    authenticateMerchant: !!authenticateMerchant,
    authenticateAdmin: !!authenticateAdmin,
    authRateLimit: !!authRateLimit
  });
} catch (error) {
  console.error('❌ Error importing auth middleware:', error);
  
  // Fallback: create a simple rate limiter if import fails
  authRateLimit = (maxAttempts, windowMs) => {
    console.warn('⚠️ Using fallback rate limiter');
    return (req, res, next) => next(); // No-op for now
  };
  
  // Fallback auth functions
  authenticateMerchant = (req, res, next) => {
    console.warn('⚠️ Using fallback authenticateMerchant');
    return res.status(501).json({
      success: false,
      message: 'Authentication middleware not available'
    });
  };
  
  authenticateAdmin = authenticateMerchant; // Same fallback
}

// Debug middleware
router.use((req, res, next) => {
  console.log(`🔍 MERCHANT ROUTE: ${req.method} ${req.originalUrl}`);
  next();
});

// ==========================================
// TEST ROUTES
// ==========================================

router.get('/test', (req, res) => {
  console.log('✅ Merchant test endpoint hit');
  res.json({
    success: true,
    message: 'Merchant routes are working!',
    timestamp: new Date().toISOString(),
    middleware: {
      authRateLimit: !!authRateLimit,
      authenticateMerchant: !!authenticateMerchant
    }
  });
});

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Registration - with safe rate limiting
router.post('/register', (req, res, next) => {
  if (authRateLimit) {
    return authRateLimit(5, 15 * 60 * 1000)(req, res, next);
  }
  next();
}, merchantController.register);

// Login - with safe rate limiting
router.post('/login', (req, res, next) => {
  if (authRateLimit) {
    return authRateLimit(10, 15 * 60 * 1000)(req, res, next);
  }
  next();
}, merchantController.login);

// Password reset routes
router.post('/request-password-reset', (req, res, next) => {
  if (authRateLimit) {
    return authRateLimit(3, 15 * 60 * 1000)(req, res, next);
  }
  next();
}, merchantController.requestPasswordReset);

router.post('/reset-password', (req, res, next) => {
  if (authRateLimit) {
    return authRateLimit(5, 15 * 60 * 1000)(req, res, next);
  }
  next();
}, merchantController.resetPassword);

// ==========================================
// PROTECTED ROUTES
// ==========================================

// Current merchant profile - THE KEY ROUTE
router.get('/profile', (req, res, next) => {
  console.log('📋 Profile endpoint accessed');
  
  if (!authenticateMerchant) {
    return res.status(501).json({
      success: false,
      message: 'Authentication middleware not available'
    });
  }
  
  authenticateMerchant(req, res, (err) => {
    if (err) return next(err);
    
    console.log('📋 Setting merchantId for profile:', req.user.id);
    req.params.merchantId = req.user.id;
    merchantController.getMerchantProfile(req, res);
  });
});

// Get specific merchant profile by ID
router.get('/:merchantId', (req, res, next) => {
  if (!authenticateMerchant) {
    return res.status(501).json({
      success: false,
      message: 'Authentication middleware not available'
    });
  }
  
  authenticateMerchant(req, res, (err) => {
    if (err) return next(err);
    merchantController.getMerchantProfile(req, res);
  });
});

// Update merchant profile
router.put('/:merchantId', (req, res, next) => {
  if (!authenticateMerchant) {
    return res.status(501).json({
      success: false,
      message: 'Authentication middleware not available'
    });
  }
  
  authenticateMerchant(req, res, (err) => {
    if (err) return next(err);
    merchantController.updateMerchantProfile(req, res);
  });
});

// Change password
router.put('/:merchantId/change-password', (req, res, next) => {
  if (!authenticateMerchant) {
    return res.status(501).json({
      success: false,
      message: 'Authentication middleware not available'
    });
  }
  
  authenticateMerchant(req, res, (err) => {
    if (err) return next(err);
    merchantController.changePassword(req, res);
  });
});

// Refresh token
router.post('/refresh-token', (req, res, next) => {
  if (!authenticateMerchant) {
    return res.status(501).json({
      success: false,
      message: 'Authentication middleware not available'
    });
  }
  
  authenticateMerchant(req, res, (err) => {
    if (err) return next(err);
    merchantController.refreshToken(req, res);
  });
});

// ==========================================
// ADMIN ROUTES (if available)
// ==========================================

if (authenticateAdmin && merchantController.createMerchant) {
  router.post('/create', (req, res, next) => {
    authenticateAdmin(req, res, (err) => {
      if (err) return next(err);
      merchantController.createMerchant(req, res);
    });
  });
}

if (authenticateAdmin && merchantController.searchMerchants) {
  router.get('/search', (req, res, next) => {
    authenticateAdmin(req, res, (err) => {
      if (err) return next(err);
      merchantController.searchMerchants(req, res);
    });
  });
}

// ==========================================
// ERROR HANDLING
// ==========================================

router.use((err, req, res, next) => {
  console.error('💥 Merchant routes error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    code: err.code || 'MERCHANT_ROUTE_ERROR'
  });
});

// 404 handler
router.use('*', (req, res) => {
  console.log(`❌ Merchant route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Merchant route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /test',
      'POST /register',
      'POST /login', 
      'GET /profile (requires auth)',
      'GET /:merchantId (requires auth)'
    ]
  });
});

console.log('📋 Merchant routes module loaded successfully');

module.exports = router;