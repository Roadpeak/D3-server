const express = require('express');
const router = express.Router();
const serviceController = require('../../controllers/admin/serviceController');
const authMiddleware = require('../../middleware/admin/authMiddleware');

router.get('/', authMiddleware, serviceController.getAllServices);
router.get('/search', authMiddleware, serviceController.searchServices);
router.get('/store/:id', authMiddleware, serviceController.getServicesByStore);
router.get('/:id', authMiddleware, serviceController.getServiceById);
router.post('/', authMiddleware, serviceController.createService);
router.put('/:id', authMiddleware, serviceController.updateService);
router.delete('/:id', authMiddleware, serviceController.deleteService);

module.exports = router;