const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.post('/payments', paymentController.createPayment);
router.get('/payments', paymentController.getAllPayments);
router.get('/payments/status/:status', paymentController.getPaymentsByStatus);
router.get('/payments/user/:user_id', paymentController.getPaymentsByUser);
router.get('/payments/offer/:offer_id', paymentController.getPaymentsByOffer);
router.get('/payments/store/:store_id', paymentController.getPaymentsByStore);
router.post('/payments/callback', paymentController.paymentCallback);

module.exports = router;
