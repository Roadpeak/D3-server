const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

router.post('/', serviceController.createService);
router.get('/', serviceController.getServices);
router.get('/:id', serviceController.getServiceById); 
router.put('/:id', serviceController.updateService);
router.delete('/:id', serviceController.deleteService);
router.get('/store/:storeId', serviceController.getServicesByStoreId);

module.exports = router;
