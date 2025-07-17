const express = require('express');
const router = express.Router();
const storesController = require('../controllers/storesController');

// Import auth middleware
const { authenticateMerchant, verifyToken } = require('../middleware/auth');

// IMPORTANT: Specific routes MUST come before parameterized routes (:id)

// Public routes - no auth required
router.get('/categories', storesController.getCategories);
router.get('/locations', storesController.getLocations);
router.get('/random', storesController.getRandomStores);

// Merchant-specific routes - these MUST come before /:id routes
router.get('/merchant/my-stores', authenticateMerchant, storesController.getMerchantStores);

// ADD THIS NEW ROUTE - Get stores by merchant ID (public route)
router.get('/merchant/:merchantId', storesController.getStoresByMerchantId);

router.get('/analytics', authenticateMerchant, storesController.getStoreAnalytics);
router.get('/dashboard', authenticateMerchant, storesController.getStoreDashboard);

// Store CRUD operations - merchant only
router.post('/', authenticateMerchant, storesController.createStore);

// FIXED: Store interaction routes - these MUST come before the general /:id route
router.post('/:id/follow', verifyToken, storesController.toggleFollowStore);
router.post('/:id/toggle-follow', verifyToken, storesController.toggleFollowStore); // Alternative endpoint
router.post('/:id/reviews', verifyToken, storesController.submitReview);

// Store management routes - merchant only
router.put('/:id', authenticateMerchant, storesController.updateStore);
router.delete('/:id', authenticateMerchant, storesController.deleteStore);

// General store routes
router.get('/', storesController.getStores);

// IMPORTANT: This MUST be the last GET route because it catches everything
router.get('/:id', storesController.getStoreById);

module.exports = router;