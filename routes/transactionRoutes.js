// src/routes/transactionRoutes.js
const express = require('express');
const {
    createSubscription,
    initiateTransaction,
    handleMpesaCallback,
} = require('../controllers/transactionController');

const router = express.Router();

router.post('/subscribe', createSubscription);
router.post('/pay', initiateTransaction);
router.post('/callback', handleMpesaCallback);

module.exports = router;
