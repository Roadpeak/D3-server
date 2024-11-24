const express = require('express');
const StaffController = require('../controllers/staffController');

const router = express.Router();

router.post('/', StaffController.create); // Create staff
router.get('/', StaffController.getAll); // Get all staff
router.put('/:id', StaffController.update); // Update staff
router.delete('/:id', StaffController.delete); // Delete staff
router.post('/assign-service', StaffController.assignService);

// Unassign service from staff
router.post('/unassign-service', StaffController.unassignService);

// Get services assigned to a staff member
router.get('/:staffId/services', StaffController.getServicesByStaffId);

module.exports = router;
