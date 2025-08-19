// routes/offerRoutes.js - UPDATED WITH FAVORITES ROUTES
const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');
const favoritesController = require('../controllers/favoritesController');
const { authenticateUser } = require('../middleware/auth');

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

// ===============================
// ✅ FAVORITES ROUTES FOR SPECIFIC OFFERS
// ===============================
// These create: /api/v1/offers/:offerId/favorite/*
// IMPORTANT: These must come BEFORE the dynamic /:id route

// POST /api/v1/offers/:offerId/favorite - Add to favorites
router.post('/:offerId/favorite', authenticateUser, favoritesController.addToFavorites);

// DELETE /api/v1/offers/:offerId/favorite - Remove from favorites  
router.delete('/:offerId/favorite', authenticateUser, favoritesController.removeFromFavorites);

// GET /api/v1/offers/:offerId/favorite/status - Check if favorited
router.get('/:offerId/favorite/status', authenticateUser, favoritesController.checkFavoriteStatus);

// POST /api/v1/offers/:offerId/favorite/toggle - Toggle favorite status
router.post('/:offerId/favorite/toggle', authenticateUser, favoritesController.toggleFavorite);

// ===============================
// Dynamic ID route MUST be last to prevent conflicts
// ===============================
router.get('/:id', offerController.getOfferById);

// POST, PUT, DELETE routes
router.post('/', offerController.createOffer);
router.put('/:id', offerController.updateOffer);
router.delete('/:id', offerController.deleteOffer);
router.patch('/bulk-update', offerController.bulkUpdateOffers);

module.exports = router;