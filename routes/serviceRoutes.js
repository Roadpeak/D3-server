const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

router.post('/services', serviceController.createService);
router.get('/services/search', serviceController.searchServices);
router.get('/services', serviceController.getServices);
router.get('/services/:id', serviceController.getServiceById);
router.put('/services/:id', serviceController.updateService);
router.delete('/services/:id', serviceController.deleteService);
router.get('/services/store/:storeId', serviceController.getServicesByStoreId);
router.get('/services/search', serviceController.searchServices);

module.exports = router;
