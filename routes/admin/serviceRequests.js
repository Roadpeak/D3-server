const express = require('express');
const router = express.Router();
const serviceRequestController = require('../../controllers/admin/serviceRequestController');
const authMiddleware = require('../../middleware/admin/authMiddleware');

router.get('/', authMiddleware, serviceRequestController.getAllServiceRequests);
router.get('/search', authMiddleware, serviceRequestController.searchServiceRequests);
router.get('/:id', authMiddleware, serviceRequestController.getServiceRequestById);
router.post('/', authMiddleware, serviceRequestController.createServiceRequest);
router.put('/:id', authMiddleware, serviceRequestController.updateServiceRequest);
router.put('/:id/assign', authMiddleware, serviceRequestController.assignServiceRequest);
router.put('/:id/status', authMiddleware, serviceRequestController.updateStatus);
router.delete('/:id', authMiddleware, serviceRequestController.deleteServiceRequest);

module.exports = router;