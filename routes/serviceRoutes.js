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
// PUBLIC ROUTES (Browsable by everyone)
// ==========================================

// Get all services - using optionalAuth for potential user-specific data (favorites, etc.)
router.get('/services', optionalAuth, serviceController.getServices);

// Search services - public but with optional user context
router.get('/services/search', optionalAuth, serviceController.searchServices);

// Get specific service by ID - public with optional user context
router.get('/services/:id', optionalAuth, serviceController.getServiceById);

// Get services by store ID - public browsing
router.get('/services/store/:storeId', optionalAuth, serviceController.getServicesByStoreId);

// ==========================================
// MERCHANT PROTECTED ROUTES (Service owners)
// ==========================================

// Create service - typically merchants only
// Change to authenticateUser if regular users can also create services
router.post('/services', authenticateMerchant, serviceController.createService);

// Update service - should verify ownership in controller
// Change to authenticateUser if regular users can also update their services
router.put('/services/:id', authenticateMerchant, serviceController.updateService);

// Delete service - should verify ownership in controller
// Change to authenticateUser if regular users can also delete their services
router.delete('/services/:id', authenticateMerchant, serviceController.deleteService);

// ==========================================
// USER INTERACTION ROUTES (if you want to add them)
// ==========================================

// Add service to favorites (if you have favorites feature)
router.post('/services/:id/favorite', authenticateUser, (req, res) => {
  res.status(200).json({
    message: 'Add service to favorites',
    serviceId: req.params.id,
    userId: req.user.userId
  });
});

// Remove service from favorites
router.delete('/services/:id/favorite', authenticateUser, (req, res) => {
  res.status(200).json({
    message: 'Remove service from favorites',
    serviceId: req.params.id,
    userId: req.user.userId
  });
});

// Submit service review/rating
router.post('/services/:id/reviews', authenticateUser, (req, res) => {
  res.status(200).json({
    message: 'Submit service review',
    serviceId: req.params.id,
    userId: req.user.userId
  });
});

// ==========================================
// MERCHANT DASHBOARD ROUTES
// ==========================================

// Get merchant's services
router.get('/merchant/my-services', authenticateMerchant, (req, res) => {
  res.status(200).json({
    message: 'Get merchant services',
    merchantId: req.user.userId
  });
});

// Get service analytics/stats for merchant
router.get('/services/:id/analytics', authenticateMerchant, (req, res) => {
  res.status(200).json({
    message: 'Get service analytics',
    serviceId: req.params.id,
    merchantId: req.user.userId
  });
});

// ==========================================
// ADMIN ROUTES (Service verification/management)
// ==========================================

// Admin verify/approve service
router.put('/services/:id/verify', authenticateAdmin, (req, res) => {
  res.status(200).json({
    message: 'Verify service',
    serviceId: req.params.id
  });
});

// Admin get pending services for verification
router.get('/admin/pending-services', authenticateAdmin, (req, res) => {
  res.status(200).json({
    message: 'Get pending services for verification'
  });
});

// Admin suspend/unsuspend service
router.put('/services/:id/status', authenticateAdmin, (req, res) => {
  res.status(200).json({
    message: 'Update service status',
    serviceId: req.params.id
  });
});

module.exports = router;