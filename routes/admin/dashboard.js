const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/admin/dashboardController');
const authMiddleware = require('../../middleware/admin/authMiddleware');

router.get('/stats', authMiddleware.authenticateToken, dashboardController.getStats);
router.get('/top-stats', authMiddleware.authenticateToken, dashboardController.getTopStats);
router.get('/all-stats', authMiddleware.authenticateToken, dashboardController.getAllStats);
router.get('/activities', authMiddleware.authenticateToken, dashboardController.getRecentActivities);
router.get('/analytics', authMiddleware.authenticateToken, dashboardController.getAnalytics);

module.exports = router;