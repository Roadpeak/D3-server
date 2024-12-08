const express = require('express');
const reviewController = require('../controllers/reviewController');
const router = express.Router();

router.post('/reviews', reviewController.createReview);
router.get('/stores/:store_id/reviews', reviewController.getReviewsByStore);
router.get('/reviews/:id', reviewController.getReviewById);
router.put('/reviews/:id', reviewController.updateReview);
router.delete('/reviews/:id', reviewController.deleteReview);

module.exports = router;