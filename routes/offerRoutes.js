// routes/offerRoutes.js
const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');

// CRITICAL: Specific routes MUST come before parameterized routes to avoid conflicts

// Static routes first
router.get('/random', offerController.getRandomOffers);
router.get('/categories', offerController.getCategoriesAlternative);
router.get('/top-deals', offerController.getTopDeals);
router.get('/featured', offerController.getFeaturedOffers);

// Store-specific routes
router.get('/store/:storeId', offerController.getOffersByStore);
router.get('/stats/:storeId?', offerController.getOffersStats);

// General listing route
router.get('/', offerController.getOffers);

// Dynamic ID route MUST be last to prevent conflicts
router.get('/:id', offerController.getOfferById);

// POST, PUT, DELETE routes
router.post('/', offerController.createOffer);
router.put('/:id', offerController.updateOffer);
router.delete('/:id', offerController.deleteOffer);
router.patch('/bulk-update', offerController.bulkUpdateOffers);

module.exports = router;