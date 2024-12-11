const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');

// Create a new quote
router.post('/create', quoteController.createQuote);

// Get all quotes for a form response
router.get('/:form_response_id', quoteController.getQuotesForFormResponse);

// Update quote status
router.patch('/:id/status', quoteController.updateQuoteStatus);

module.exports = router;
