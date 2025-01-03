const express = require('express');
const BookingController = require('../controllers/bookingController');

const router = express.Router();

router.post('/bookings', BookingController.create);
router.get('/bookings', BookingController.getAll);
router.get('/bookings/:id', BookingController.getById);
router.get('/bookings/offer/:offerId', BookingController.getByOffer);
router.get('/bookings/store/:storeId', BookingController.getByStore);
router.get('/get-slots', BookingController.getAvailableSlots);
router.patch('/bookings/:id', BookingController.update);
router.delete('/bookings/:id', BookingController.delete);
router.post('/bookings/fullfil', BookingController.markAsFulfilled);
router.post('/bookings/validate', BookingController.validateAndFulfill);

module.exports = router;
