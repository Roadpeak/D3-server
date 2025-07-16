const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

// Import unified auth middleware
const { 
  authenticateUser, 
  authenticateMerchant, 
  optionalAuth,
  authenticateAdmin,
  verifyToken 
} = require('../middleware/auth');

// ==========================================
// IMPORTANT: Specific routes MUST come before parameterized routes (:id)
// ==========================================

// ==========================================
// MERCHANT DASHBOARD ROUTES (Must come first)
// ==========================================

// Get merchant's services - this is what your frontend is calling
router.get('/merchant/:merchantId', authenticateMerchant, serviceController.getServicesByMerchantId);

// Alternative merchant services route
router.get('/merchant/my-services', authenticateMerchant, serviceController.getMerchantServices);

// Get service analytics/stats for merchant
router.get('/:id/analytics', authenticateMerchant, serviceController.getServiceAnalytics);

// ==========================================
// STORE-SPECIFIC ROUTES (Must come before /:id)
// ==========================================

// Get services by store ID - this is also what your frontend might call
router.get('/store/:storeId', optionalAuth, serviceController.getServicesByStoreId);

// ==========================================
// SEARCH AND FILTERING (Must come before /:id)
// ==========================================

// Search services - public but with optional user context
router.get('/search', optionalAuth, serviceController.searchServices);

// ==========================================
// USER INTERACTION ROUTES (Must come before /:id)
// ==========================================

// Add service to favorites (if you have favorites feature)
router.post('/:id/favorite', authenticateUser, serviceController.addToFavorites);

// Remove service from favorites
router.delete('/:id/favorite', authenticateUser, serviceController.removeFromFavorites);

// Submit service review/rating
router.post('/:id/reviews', authenticateUser, serviceController.submitReview);

// ==========================================
// ADMIN ROUTES (Must come before general /:id routes)
// ==========================================

// Admin get pending services for verification
router.get('/admin/pending', authenticateAdmin, serviceController.getPendingServices);

// Admin verify/approve service
router.put('/:id/verify', authenticateAdmin, serviceController.verifyService);

// Admin suspend/unsuspend service
router.put('/:id/status', authenticateAdmin, serviceController.updateServiceStatus);

// ==========================================
// CRUD OPERATIONS
// ==========================================

// Create service - merchants only
router.post('/', authenticateMerchant, serviceController.createService);

// Update service - should verify ownership in controller
router.put('/:id', authenticateMerchant, serviceController.updateService);

// Delete service - should verify ownership in controller
router.delete('/:id', authenticateMerchant, serviceController.deleteService);

// ==========================================
// PUBLIC ROUTES (These should come LAST)
// ==========================================

// Get all services - using optionalAuth for potential user-specific data
router.get('/', optionalAuth, serviceController.getServices);

// IMPORTANT: This MUST be the very last route because /:id catches everything
// Get specific service by ID - public with optional user context
router.get('/:id', optionalAuth, serviceController.getServiceById);

module.exports = router;