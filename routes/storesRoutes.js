const express = require('express');
const router = express.Router();
const storesController = require('../controllers/storesController');

// Import unified auth middleware (replacing your old import)
const { 
  authenticateUser, 
  authenticateMerchant, 
  optionalAuth,
  verifyToken 
} = require('../middleware/auth');

// ==========================================
// PUBLIC ROUTES (No authentication required)
// ==========================================

// Get all stores - using optionalAuth to include user context if logged in
router.get('/', optionalAuth, storesController.getStores);

// Get random stores
router.get('/random', storesController.getRandomStores);

// Get store categories
router.get('/categories', storesController.getCategories);

// Get store locations
router.get('/locations', storesController.getLocations);

// Get specific store by ID - using optionalAuth for potential user-specific data
router.get('/:id', optionalAuth, storesController.getStoreById);

// ==========================================
// USER PROTECTED ROUTES (Users can interact)
// ==========================================

// Follow/unfollow store - requires user authentication
router.post('/:id/follow', authenticateUser, storesController.toggleFollowStore);

// Submit review - requires user authentication
router.post('/:id/reviews', authenticateUser, storesController.submitReview);

// ==========================================
// MERCHANT PROTECTED ROUTES (Store owners)
// ==========================================

// Create store - typically merchant only, but keeping your existing logic
// If users can create stores, use authenticateUser
// If only merchants can create stores, change to authenticateMerchant
router.post('/', authenticateUser, storesController.createStore);

// Update store - should verify ownership in controller
router.put('/:id', authenticateUser, storesController.updateStore);

// Delete store - should verify ownership in controller
router.delete('/:id', authenticateUser, storesController.deleteStore);

// ==========================================
// ADDITIONAL ROUTES (if you want to add them)
// ==========================================

// Get user's followed stores
router.get('/user/followed', authenticateUser, (req, res) => {
  // This would get stores followed by the current user
  res.status(200).json({
    message: 'Get user followed stores',
    userId: req.user.userId
  });
});

// Get merchant's stores (if applicable)
router.get('/merchant/my-stores', authenticateMerchant, (req, res) => {
  // This would get stores owned by the current merchant
  res.status(200).json({
    message: 'Get merchant stores',
    merchantId: req.user.userId
  });
});

module.exports = router;