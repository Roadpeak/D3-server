const express = require('express');
const StaffController = require('../controllers/staffController');

const router = express.Router();

router.post('/staff', StaffController.create);
router.get('/staff', StaffController.getAll);
router.get('/staff/:id', StaffController.getStaffById);
router.put('/staff/:id', StaffController.update);
router.delete('/staff/:id', StaffController.delete);
router.post('/staff/assign-service', StaffController.assignService);
router.post('/staff/unassign-service', StaffController.unassignService);
router.get('/staff/:staffId/services', StaffController.getServicesByStaffId);
router.get('/staff/store/:storeId', StaffController.getStaffByStore);

module.exports = router;
