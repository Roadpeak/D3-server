const express = require('express');
const router = express.Router();
const { ClientsController, checkSubscriptionStatus } = require('../controllers/clientsController');

// Apply subscription check middleware to all routes
router.use(checkSubscriptionStatus);

// Followers routes
router.get('/followers', ClientsController.getFollowers);
router.post('/followers', ClientsController.addFollower);
router.put('/followers/:followerId', ClientsController.updateFollower);
router.delete('/followers/:followerId', ClientsController.deleteFollower);

// Customers routes
router.get('/customers', ClientsController.getCustomers);

// Bulk email routes
router.post('/bulk-email', ClientsController.sendBulkEmail);
router.get('/bulk-email/history', ClientsController.getBulkEmailHistory);

// Statistics route
router.get('/stats', ClientsController.getClientStats);

module.exports = router;