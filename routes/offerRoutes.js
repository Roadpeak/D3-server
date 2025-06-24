// routes/offerRoutes.js
const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');

// GET routes (public)
router.get('/', offerController.getOffers);
router.get('/random', offerController.getRandomOffers);
router.get('/categories', offerController.getCategories);
router.get('/top-deals', offerController.getTopDeals);
router.get('/featured', offerController.getFeaturedOffers);
router.get('/store/:storeId', offerController.getOffersByStore);
router.get('/:id', offerController.getOfferById);

// POST, PUT, DELETE routes (may require authentication middleware)
router.post('/', offerController.createOffer);
router.put('/:id', offerController.updateOffer);
router.delete('/:id', offerController.deleteOffer);

module.exports = router;