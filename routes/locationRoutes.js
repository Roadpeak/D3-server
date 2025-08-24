// routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

// GET /api/v1/locations/available - Get all unique locations from stores and offers
router.get('/available', locationController.getAvailableLocations);

// POST /api/v1/locations/reverse-geocode - Convert coordinates to location name
router.post('/reverse-geocode', locationController.reverseGeocode);

// GET /api/v1/locations/stats - Get location statistics
router.get('/stats', locationController.getLocationStats);

module.exports = router;