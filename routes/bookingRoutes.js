const express = require('express');
const BookingController = require('../controllers/bookingController');

const router = express.Router();

router.post('/', BookingController.create);
router.get('/', BookingController.getAll);
router.patch('/:id', BookingController.update);
router.delete('/:id', BookingController.delete);
router.post('/fullfil', BookingController.markAsFulfilled);
router.post('/validate', BookingController.validateAndFulfill);

module.exports = router;
