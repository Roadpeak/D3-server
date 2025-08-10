// routes/reviewRoutes.js - FIXED version with proper authentication and endpoints

const express = require('express');
const reviewController = require('../controllers/reviewController');
const { verifyToken } = require('../middleware/auth'); 
const router = express.Router();

// ===============================
// PUBLIC ROUTES (No authentication required)
// ===============================

// Get reviews for a specific store (public view)
router.get('/stores/:store_id/reviews', reviewController.getReviewsByStore);

// Get a single review by ID (public view)
router.get('/reviews/:id', reviewController.getReviewById);

// ===============================
// PROTECTED ROUTES (Authentication required)
// ===============================

// Create a new review (customers only)
router.post('/reviews', verifyToken, reviewController.createReview);

// Update a review (only by original reviewer)
router.put('/reviews/:id', verifyToken, reviewController.updateReview);

// Delete a review (by original reviewer or store owner)
router.delete('/reviews/:id', verifyToken, reviewController.deleteReview);

// Alternative store-specific review submission endpoint
router.post('/stores/:store_id/reviews', verifyToken, async (req, res) => {
  try {
    console.log('📝 Store-specific review submission:', req.params.store_id);
    
    // Add store_id to request body
    req.body.store_id = req.params.store_id;
    
    // Forward to main review creation controller
    return reviewController.createReview(req, res);
  } catch (error) {
    console.error('Store review submission route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error submitting review'
    });
  }
});

// ===============================
// MERCHANT ROUTES (For merchant dashboard)
// ===============================

// Get reviews for merchant's own store
router.get('/merchant/reviews', verifyToken, reviewController.getMerchantStoreReviews);

// Get reviews for a specific store (with ownership verification)
router.get('/merchant/stores/:store_id/reviews', verifyToken, async (req, res) => {
  try {
    const { Store } = require('../models');
    const { store_id } = req.params;
    const merchantId = req.user.id || req.user.userId;

    console.log('🏪 Merchant requesting reviews for store:', store_id);
    console.log('👤 Merchant ID:', merchantId);

    // Verify store ownership
    const store = await Store.findOne({
      where: { 
        id: store_id,
        merchant_id: merchantId 
      }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or access denied'
      });
    }

    console.log('✅ Store ownership verified');

    // Forward to reviews controller
    req.params.store_id = store_id;
    return reviewController.getReviewsByStore(req, res);
    
  } catch (error) {
    console.error('Merchant store reviews route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error accessing store reviews'
    });
  }
});

// ===============================
// ADMIN ROUTES (For admin management)
// ===============================

// Get all reviews with pagination (admin only)
router.get('/admin/reviews', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 'admin' && req.user.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { page = 1, limit = 50 } = req.query;
    const { Review, User, Store } = require('../models');

    const { count, rows } = await Review.findAndCountAll({
      limit: parseInt(limit),
      offset: (page - 1) * limit,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'merchant_id']
        }
      ]
    });

    return res.status(200).json({
      success: true,
      reviews: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        hasNextPage: (page * limit) < count
      }
    });

  } catch (error) {
    console.error('Admin reviews route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching admin reviews'
    });
  }
});

// ===============================
// UTILITY ROUTES (For testing and debugging)
// ===============================

// Test endpoint for connectivity
router.get('/reviews/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Review routes are working!',
    timestamp: new Date().toISOString(),
    endpoints: {
      public: [
        'GET /stores/:store_id/reviews',
        'GET /reviews/:id'
      ],
      protected: [
        'POST /reviews',
        'PUT /reviews/:id',
        'DELETE /reviews/:id',
        'POST /stores/:store_id/reviews'
      ],
      merchant: [
        'GET /merchant/reviews',
        'GET /merchant/stores/:store_id/reviews'
      ],
      admin: [
        'GET /admin/reviews'
      ]
    }
  });
});

// Authentication test endpoint
router.get('/reviews/auth-test', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication working for reviews',
    user: {
      id: req.user.id || req.user.userId,
      type: req.user.userType || req.user.type
    },
    timestamp: new Date().toISOString()
  });
});

// ===============================
// ERROR HANDLING MIDDLEWARE
// ===============================

// Catch-all error handler for review routes
router.use((error, req, res, next) => {
  console.error('Review routes error:', error);
  
  return res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error in review routes',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = router;