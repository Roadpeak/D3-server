// routes/discountRoutes.js - Compatibility routes for existing frontend

const express = require('express');
const router = express.Router();
const discountsController = require('../controllers/discountsController');

// GET /api/v1/discounts - Get all discounts (compatibility endpoint)
router.get('/', discountsController.getDiscounts);

// GET /api/v1/discounts/:id - Get discount by ID (compatibility endpoint)
router.get('/:id', discountsController.getDiscountById);

module.exports = router;