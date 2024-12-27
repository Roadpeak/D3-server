const express = require('express');
const router = express.Router();
const likeController = require('../controllers/likeController');

router.post('/service/like', likeController.likeServiceHandler);
router.post('/service/unlike', likeController.unlikeServiceHandler);
router.get('/user/:userId/services', likeController.getLikedServicesHandler);

router.post('/offer/like', likeController.likeOfferHandler);
router.post('/offer/unlike', likeController.unlikeOfferHandler);
router.get('/user/:userId/offers', likeController.getLikedOffersHandler);

module.exports = router;
