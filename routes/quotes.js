const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');

// Create a quote
router.post('/', quoteController.createQuote);

// Get all quotes
router.get('/', quoteController.getQuotes);

// Get a quote by ID
router.get('/:id', quoteController.getQuoteById);

// Update a quote
router.put('/:id', quoteController.updateQuote);

// Delete a quote
router.delete('/:id', quoteController.deleteQuote);

module.exports = router;
