// routes/storesRoutes.js - Basic version to get server running
const express = require('express');
const router = express.Router();
const storesController = require('../controllers/storesController');

// Import auth middleware (use the original one you have)
const { authenticateMerchant } = require('../middleware/auth');

// Basic routes using only the methods you definitely have
router.get('/', storesController.getStores);
router.get('/random', storesController.getRandomStores);
router.get('/categories', storesController.getCategories);
router.get('/locations', storesController.getLocations);
router.get('/:id', storesController.getStoreById);

// Merchant routes
router.post('/', authenticateMerchant, storesController.createStore);
router.get('/merchant/my-stores', authenticateMerchant, storesController.getMerchantStores);
router.put('/:id', authenticateMerchant, storesController.updateStore);
router.delete('/:id', authenticateMerchant, storesController.deleteStore);

// Store interactions
router.post('/:id/follow', authenticateMerchant, storesController.toggleFollowStore);
router.post('/:id/reviews', authenticateMerchant, storesController.submitReview);

module.exports = router;