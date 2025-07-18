// routes/branchRoutes.js - Fixed version
const express = require('express');
const router = express.Router();

// Import branch controller
const branchController = require('../controllers/branchController');

// Import auth middleware
const { authenticateMerchant } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateMerchant);

// Debug middleware
router.use((req, res, next) => {
  console.log(`🏢 BRANCH ROUTE: ${req.method} ${req.originalUrl}`);
  console.log(`👤 Merchant ID: ${req.user?.id}`);
  next();
});

// ==========================================
// BRANCH ROUTES
// ==========================================

// Get all branches for the authenticated merchant (across all stores)
router.get('/', branchController.getMerchantBranches);

// Get all branches for a specific store (including store as main branch)
router.get('/store/:storeId', branchController.getBranchesByStore);

// Create a new additional branch for a specific store
router.post('/store/:storeId', branchController.createBranch);

// Get a specific branch (handles both store-based and regular branches)
router.get('/:branchId', branchController.getBranch);

// Update a specific branch (additional branches only)
router.put('/:branchId', branchController.updateBranch);

// Delete a specific branch (additional branches only)
router.delete('/:branchId', branchController.deleteBranch);

// ==========================================
// UTILITY ROUTES
// ==========================================

// Test route
router.get('/test/connection', (req, res) => {
  res.json({
    success: true,
    message: 'Branch routes are working - Store serves as main branch',
    merchantId: req.user.id,
    timestamp: new Date().toISOString(),
    info: 'Store information automatically serves as the main branch'
  });
});

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('💥 Branch routes error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error in branch routes',
    code: err.code || 'BRANCH_ROUTE_ERROR'
  });
});

module.exports = router;