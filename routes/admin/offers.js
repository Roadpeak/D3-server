const express = require('express');
const router = express.Router();
const offerController = require('../../controllers/admin/offerController');
const authMiddleware = require('../../middleware/admin/authMiddleware');

router.get('/', authMiddleware, offerController.getAllOffers);
router.get('/search', authMiddleware, offerController.searchOffers);
router.get('/:id', authMiddleware, offerController.getOfferById);
router.post('/', authMiddleware, offerController.createOffer);
router.put('/:id', authMiddleware, offerController.updateOffer);
router.put('/:id/activate', authMiddleware, offerController.activateOffer);
router.put('/:id/deactivate', authMiddleware, offerController.deactivateOffer);
router.delete('/:id', authMiddleware, offerController.deleteOffer);

module.exports = router;