const express = require('express');
const router = express.Router();
const bookingController = require('../../controllers/admin/bookingController');
const authMiddleware = require('../../middleware/admin/authMiddleware');

router.get('/', authMiddleware, bookingController.getAllBookings);
router.get('/search', authMiddleware, bookingController.searchBookings);
router.get('/:id', authMiddleware, bookingController.getBookingById);
router.post('/', authMiddleware, bookingController.createBooking);
router.put('/:id', authMiddleware, bookingController.updateBooking);
router.put('/:id/confirm', authMiddleware, bookingController.confirmBooking);
router.put('/:id/cancel', authMiddleware, bookingController.cancelBooking);
router.delete('/:id', authMiddleware, bookingController.deleteBooking);

module.exports = router;