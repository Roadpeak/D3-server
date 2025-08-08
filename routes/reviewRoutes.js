// routes/reviewRoutes.js - FIXED version

const express = require('express');
const reviewController = require('../controllers/reviewController');
const storesController = require('../controllers/storesController'); 
const { verifyToken } = require('../middleware/auth'); 
const router = express.Router();

// Public routes (no authentication required)
router.get('/stores/:store_id/reviews', reviewController.getReviewsByStore);
router.get('/reviews/:id', reviewController.getReviewById);

// Protected routes (authentication required)
// FIXED: Only include routes for functions that actually exist
router.post('/reviews', verifyToken, reviewController.createReview);

// CONDITIONAL: Only add these if the functions exist in your reviewController
if (reviewController.updateReview) {
  router.put('/reviews/:id', verifyToken, reviewController.updateReview);
}

if (reviewController.deleteReview) {
  router.delete('/reviews/:id', verifyToken, reviewController.deleteReview);
}

// FIXED: Store-specific review submission (using stores controller)
router.post('/stores/:store_id/reviews', verifyToken, async (req, res) => {
  try {
    // Reformat params for the stores controller
    req.params.id = req.params.store_id;
    
    // Make sure the function exists before calling it
    if (storesController.submitReview) {
      return storesController.submitReview(req, res);
    } else {
      // Fallback to review controller if stores controller doesn't have submitReview
      req.body.store_id = req.params.store_id;
      return reviewController.createReview(req, res);
    }
  } catch (error) {
    console.error('Review submission route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error submitting review'
    });
  }
});

// CONDITIONAL: Only add if the function exists
if (reviewController.getMerchantStoreReviews) {
  router.get('/merchant/reviews', verifyToken, reviewController.getMerchantStoreReviews);
}

// Merchant route to get reviews with verification
router.get('/merchant/stores/:store_id/reviews', verifyToken, async (req, res) => {
  try {
    const { Store } = require('../models');
    const { store_id } = req.params;
    const merchantId = req.user.id;

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

    // If store belongs to merchant, proceed with getting reviews
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

module.exports = router;