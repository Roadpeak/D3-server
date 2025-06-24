const express = require('express');
const router = express.Router();
const storesController = require('../controllers/storesController');
const { authenticateUser } = require('../middleware/authMiddleware');

// Public routes
router.get('/', storesController.getStores);
router.get('/random', storesController.getRandomStores);
router.get('/categories', storesController.getCategories);
router.get('/locations', storesController.getLocations);
router.get('/:id', storesController.getStoreById);

// Protected routes
router.post('/stores/:id/follow', storesController.toggleFollowStore);
router.post('/stores/:id/reviews', storesController.submitReview);
router.post('/', authenticateUser, storesController.createStore);
router.put('/:id', authenticateUser, storesController.updateStore);
router.delete('/:id', authenticateUser, storesController.deleteStore);

module.exports = router;
