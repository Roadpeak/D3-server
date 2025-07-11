// routes/merchantRoutes.js
const express = require('express');
const router = express.Router();

// Import your existing merchant controller
const {
  register,
  login,
  requestPasswordReset,
  resetPassword,
  getMerchantProfile,
  createMerchant,
  searchMerchants
} = require('../controllers/merchantController');

// Import unified auth middleware
const { 
  authenticateMerchant, 
  verifyToken, 
  authenticateAdmin 
} = require('../middleware/auth');

// ==========================================
// PUBLIC ROUTES (No authentication required)
// ==========================================

// Authentication routes
router.post('/register', register);
router.post('/login', login);

// Password reset routes
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

// ==========================================
// PROTECTED ROUTES (Authentication required)
// ==========================================

// Merchant profile routes
router.get('/profile/:merchantId', authenticateMerchant, getMerchantProfile);
router.get('/me', authenticateMerchant, (req, res) => {
  // Get current merchant profile
  getMerchantProfile(req, res);
});

// ==========================================
// ADMIN ROUTES (Admin access only)
// ==========================================

// Admin can create merchants
router.post('/create', authenticateAdmin, createMerchant);

// Admin can search merchants
router.get('/search', authenticateAdmin, searchMerchants);

// Admin can get all merchants
router.get('/all', authenticateAdmin, (req, res) => {
  // Implement get all merchants logic
  res.status(200).json({
    message: 'Get all merchants endpoint',
    // Add your logic here
  });
});

module.exports = router;