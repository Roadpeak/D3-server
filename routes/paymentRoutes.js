const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

// Create a payment
router.post('/payments', paymentController.createPayment);

module.exports = router;
