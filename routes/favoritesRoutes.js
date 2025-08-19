// routes/favorites.js - USER FAVORITES ROUTES ONLY
const express = require('express');
const router = express.Router();
const favoritesController = require('../controllers/favoritesController');
const { authenticateUser } = require('../middleware/auth');

// ===============================
// USER FAVORITES ROUTES ONLY
// ===============================
// This router will be mounted at /api/v1/users
// Creating endpoints like: /api/v1/users/favorites

// GET /api/v1/users/favorites - Get user's favorite offers
router.get('/favorites', authenticateUser, favoritesController.getFavorites);

// GET /api/v1/users/favorites/count - Get user's favorites count
router.get('/favorites/count', authenticateUser, favoritesController.getFavoritesCount);

// GET /api/v1/users/favorites/filtered - Get user's filtered favorites
router.get('/favorites/filtered', authenticateUser, favoritesController.getFavoritesWithFilters);

module.exports = router;