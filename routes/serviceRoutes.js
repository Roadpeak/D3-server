const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

// Routes for services
router.post('/', serviceController.createService); // Create a new service
router.get('/', serviceController.getServices); // Get all services
router.get('/:id', serviceController.getServiceById); // Get a single service by ID
router.put('/:id', serviceController.updateService); // Update a service
router.delete('/:id', serviceController.deleteService); // Delete a service

// Route to get services by store ID
router.get('/store/:storeId', serviceController.getServicesByStoreId); // Get services by store ID

module.exports = router;
