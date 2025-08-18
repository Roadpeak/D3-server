// routes/favorites.js
const express = require('express');
const router = express.Router();
const favoritesController = require('../controllers/favoritesController');
const authMiddleware = require('../middleware/auth'); // Your auth middleware

// Apply authentication middleware to all routes
router.use(authMiddleware.authenticate);

// GET /api/users/favorites - Get user's favorites with pagination and filters
router.get('/', favoritesController.getFavorites);

// GET /api/users/favorites/count - Get user's favorites count
router.get('/count', favoritesController.getFavoritesCount);

// GET /api/users/favorites/filtered - Get filtered favorites
router.get('/filtered', favoritesController.getFavoritesWithFilters);

// POST /api/offers/:offerId/favorite - Add offer to favorites
router.post('/offers/:offerId/favorite', favoritesController.addToFavorites);

// DELETE /api/offers/:offerId/favorite - Remove offer from favorites
router.delete('/offers/:offerId/favorite', favoritesController.removeFromFavorites);

// GET /api/offers/:offerId/favorite/status - Check if offer is in favorites
router.get('/offers/:offerId/favorite/status', favoritesController.checkFavoriteStatus);

// POST /api/offers/:offerId/favorite/toggle - Toggle favorite status
router.post('/offers/:offerId/favorite/toggle', favoritesController.toggleFavorite);

module.exports = router;