const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');

router.post('/offers', offerController.createOffer);
router.get('/offers/:storeId/store', offerController.getOffersByStore);
router.get('/offers/random', offerController.getRandomOffers);
router.get('/offers', offerController.getOffers);
router.get('/offers/:id', offerController.getOfferById);
router.put('/offers/:id', offerController.updateOffer);
router.delete('/offers/:id', offerController.deleteOffer);

module.exports = router;
