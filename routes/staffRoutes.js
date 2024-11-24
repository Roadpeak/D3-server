const express = require('express');
const StaffController = require('../controllers/staffController');

const router = express.Router();

router.post('/staff/', StaffController.create); // Create staff
router.get('/staff/', StaffController.getAll); // Get all staff
router.put('/staff/:id', StaffController.update); // Update staff
router.delete('/staff/:id', StaffController.delete); // Delete staff
router.post('/staff/assign-service', StaffController.assignService);

// Unassign service from staff
router.post('/staff/unassign-service', StaffController.unassignService);

// Get services assigned to a staff member
router.get('/staff/:staffId/services', StaffController.getServicesByStaffId);

module.exports = router;
