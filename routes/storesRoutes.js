// routes/storeRoutes.js - Updated with followed stores route

const express = require('express');
const router = express.Router();
const storesController = require('../controllers/storesController');

// Import auth middleware
const { authenticateMerchant, verifyToken } = require('../middleware/auth');

// Debug middleware
router.use((req, res, next) => {
  console.log(`🏪 STORE ROUTE: ${req.method} ${req.originalUrl}`);
  next();
});

// ==========================================
// PUBLIC ROUTES - no auth required
// ==========================================
router.get('/categories', storesController.getCategories);
router.get('/locations', storesController.getLocations);
router.get('/random', storesController.getRandomStores);

// Public route to get store branches (for users viewing store page)
router.get('/:id/branches', storesController.getPublicStoreBranches);

// ==========================================
// USER-SPECIFIC ROUTES - require user authentication
// ==========================================

// Get stores followed by the current user
router.get('/followed', verifyToken, storesController.getFollowedStores);

// ==========================================
// MERCHANT-SPECIFIC ROUTES - these MUST come before /:id routes
// ==========================================

// Merchant stores management
router.get('/merchant/my-stores', authenticateMerchant, storesController.getMerchantStores);
router.get('/analytics', authenticateMerchant, storesController.getStoreAnalytics);
router.get('/dashboard', authenticateMerchant, storesController.getStoreDashboard);

// Merchant profile management routes
router.put('/merchant/profile', authenticateMerchant, storesController.updateMerchantProfile);

router.get('/merchant/:merchantId', authenticateMerchant, (req, res, next) => {
    if (req.user.id !== req.params.merchantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    storesController.getMerchantStores(req, res);
  });

// Store profile management routes (main branch info)
router.get('/profile/:storeId', authenticateMerchant, storesController.getStoreProfile);
router.put('/profile/:storeId', authenticateMerchant, storesController.updateStoreProfile);

// Store CRUD operations - merchant only
router.post('/', authenticateMerchant, storesController.createStore);

// ==========================================
// STORE INTERACTION ROUTES - these MUST come before the general /:id route
// ==========================================
router.post('/:id/follow', verifyToken, storesController.toggleFollowStore);
router.post('/:id/toggle-follow', verifyToken, storesController.toggleFollowStore);
router.delete('/:id/unfollow', verifyToken, storesController.toggleFollowStore);
router.post('/:id/reviews', verifyToken, storesController.submitReview);

// Store management routes - merchant only (specific actions before general update)
router.put('/:id', authenticateMerchant, storesController.updateStore);
router.delete('/:id', authenticateMerchant, storesController.deleteStore);

// ==========================================
// GENERAL STORE ROUTES
// ==========================================
router.get('/', storesController.getStores);

// IMPORTANT: This MUST be the last GET route because it catches everything
router.get('/:id', storesController.getStoreById);

// ==========================================
// ERROR HANDLING
// ==========================================
router.use((err, req, res, next) => {
  console.error('💥 Store routes error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error in store routes',
    code: err.code || 'STORE_ROUTE_ERROR'
  });
});

module.exports = router;