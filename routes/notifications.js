// routes/notifications.js - Complete notification routes
const express = require('express');
const router = express.Router();

// Import the notification controller
const {
  getNotifications,
  getNotificationCounts,
  markAsRead,
  markAllAsRead,
  createNotification,
  deleteNotification,
  bulkMarkAsRead,
  cleanOldNotifications
} = require('../controllers/notificationController');

// Import authentication middleware
const { authenticateUser, verifyToken } = require('../middleware/auth');

// Apply authentication middleware to all notification routes
router.use(authenticateUser);

/**
 * @route   GET /api/v1/notifications
 * @desc    Get all notifications for authenticated user with pagination and filtering
 * @access  Private
 * @query   page, limit, type, unreadOnly
 */
router.get('/', getNotifications);

/**
 * @route   GET /api/v1/notifications/counts
 * @desc    Get notification counts by type for authenticated user
 * @access  Private
 */
router.get('/counts', getNotificationCounts);

/**
 * @route   PUT /api/v1/notifications/mark-all-read
 * @desc    Mark all notifications as read (optionally filtered by type)
 * @access  Private
 * @query   type (optional) - notification type to filter by
 */
router.put('/mark-all-read', markAllAsRead);

/**
 * @route   PUT /api/v1/notifications/bulk-mark-read
 * @desc    Mark multiple notifications as read
 * @access  Private
 * @body    { notificationIds: string[] }
 */
router.put('/bulk-mark-read', bulkMarkAsRead);

/**
 * @route   PUT /api/v1/notifications/:id/read
 * @desc    Mark a specific notification as read
 * @access  Private
 * @param   id - notification ID
 */
router.put('/:id/read', markAsRead);

/**
 * @route   POST /api/v1/notifications
 * @desc    Create a new notification (admin/system use)
 * @access  Private
 * @body    { userId, type, title, message, metadata }
 */
router.post('/', createNotification);

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete a specific notification
 * @access  Private
 * @param   id - notification ID
 */
router.delete('/:id', deleteNotification);

/**
 * @route   POST /api/v1/notifications/clean-old
 * @desc    Clean old read notifications (admin/cleanup)
 * @access  Private
 */
router.post('/clean-old', cleanOldNotifications);

module.exports = router;