const express = require('express');
const StaffController = require('../controllers/staffController');
const { authenticateMerchant } = require('../middleware/Merchantauth');

const router = express.Router();

router.use(authenticateMerchant);

// Staff CRUD routes (updated paths to match your app.js structure)
router.post('/', StaffController.create);
router.get('/', StaffController.getAll);
router.get('/:id', StaffController.getStaffById);
router.put('/:id', StaffController.update);
router.delete('/:id', StaffController.delete);

// Store-specific staff routes
router.get('/store/:storeId', StaffController.getStaffByStore);

// Service assignment routes
router.post('/assign-service', StaffController.assignService);
router.post('/unassign-service', StaffController.unassignService);

// Staff-specific data routes
router.get('/:staffId/services', StaffController.getServicesByStaffId);
router.get('/:staffId/bookings', StaffController.getBookingsByStaffId);

// Service-specific staff routes
router.get('/service/:serviceId', StaffController.getStaffByService);

router.get('/test', (req, res) => {
    res.json({ message: 'Staff routes are working!' });
});

router.post('/test', (req, res) => {
    res.json({ 
      message: 'POST routes are working!',
      body: req.body 
    });
  });

module.exports = router;