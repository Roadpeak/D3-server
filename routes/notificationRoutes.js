// routes/notificationRoutes.js - Complete fixed notification routes with dual auth
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');

// Import the enhanced controller
const {
  getNotifications,
  getNotificationCounts,
  markAsRead,
  markAllAsRead,
  createNotification,
  deleteNotification,
  getNotificationSettings,
  updateNotificationSettings,
  getNotificationsByStore,
  getNotificationAnalytics
} = require('../controllers/notificationController');

// Import both auth methods
const { authenticateUser } = require('../middleware/auth');
const { authenticateMerchant } = require('../middleware/Merchantauth');

// Fixed dual auth that actually works
const workingDualAuth = (req, res, next) => {
  console.log('🔐 Trying dual auth for notifications...');
  
  // Try merchant auth first since that's what your current frontend uses
  authenticateMerchant(req, res, (merchantErr) => {
    if (!merchantErr) {
      console.log('✅ Merchant auth successful for notifications');
      return next();
    }
    
    console.log('❌ Merchant auth failed, trying user auth...');
    
    // Fallback to user auth for your user side
    authenticateUser(req, res, (userErr) => {
      if (!userErr) {
        console.log('✅ User auth successful for notifications');
        return next();
      }
      
      console.log('❌ Both auth methods failed');
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
        code: 'AUTH_REQUIRED'
      });
    });
  });
};

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Use the working dual auth for all routes
router.use(workingDualAuth);

// CORE NOTIFICATION ROUTES

/**
 * @route   GET /api/v1/notifications
 * @desc    Get all notifications for authenticated user
 * @access  Private
 * @params  page, limit, type, unreadOnly, storeId, priority
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type').optional().isIn([
    'all', 'new_message', 'booking_created', 'booking_confirmed', 'booking_cancelled',
    'offer_accepted', 'offer_rejected', 'new_review', 'store_follow', 'payment_received'
  ]).withMessage('Invalid notification type'),
  query('unreadOnly').optional().isBoolean().withMessage('unreadOnly must be boolean'),
  query('storeId').optional().isUUID().withMessage('storeId must be valid UUID'),
  query('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
  handleValidationErrors
], getNotifications);

/**
 * @route   GET /api/v1/notifications/counts
 * @desc    Get notification counts by type and priority
 * @access  Private
 * @params  storeId (optional)
 */
router.get('/counts', [
  query('storeId').optional().isUUID().withMessage('storeId must be valid UUID'),
  handleValidationErrors
], getNotificationCounts);

/**
 * @route   GET /api/v1/notifications/analytics
 * @desc    Get notification analytics for user
 * @access  Private
 * @params  period, storeId
 */
router.get('/analytics', [
  query('period').optional().isIn(['1d', '7d', '30d']).withMessage('Invalid period'),
  query('storeId').optional().isUUID().withMessage('storeId must be valid UUID'),
  handleValidationErrors
], getNotificationAnalytics);

/**
 * @route   GET /api/v1/notifications/store/:storeId
 * @desc    Get notifications for specific store (merchants only)
 * @access  Private
 * @params  page, limit, unreadOnly
 */
router.get('/store/:storeId', [
  param('storeId').isUUID().withMessage('storeId must be valid UUID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('unreadOnly').optional().isBoolean().withMessage('unreadOnly must be boolean'),
  handleValidationErrors
], getNotificationsByStore);

/**
 * @route   POST /api/v1/notifications
 * @desc    Create a new notification
 * @access  Private
 * @body    userId, type, title, message, storeId, relatedEntityType, relatedEntityId, priority, etc.
 */
router.post('/', [
  body('userId').isUUID().withMessage('userId must be valid UUID'),
  body('type').isIn([
    'new_message', 'booking_created', 'booking_confirmed', 'booking_cancelled',
    'offer_accepted', 'offer_rejected', 'new_review', 'store_follow', 'payment_received',
    'service_request_offer', 'system_announcement', 'reminder'
  ]).withMessage('Invalid notification type'),
  body('title').isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
  body('message').isLength({ min: 1, max: 500 }).withMessage('Message must be 1-500 characters'),
  body('storeId').optional().isUUID().withMessage('storeId must be valid UUID'),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
  body('relatedEntityType').optional().isIn([
    'chat', 'message', 'booking', 'offer', 'service_request', 'service_offer',
    'review', 'payment', 'store', 'user', 'system'
  ]).withMessage('Invalid related entity type'),
  body('relatedEntityId').optional().isUUID().withMessage('relatedEntityId must be valid UUID'),
  body('actionType').optional().isIn(['navigate', 'modal', 'external', 'none']).withMessage('Invalid action type'),
  body('scheduledFor').optional().isISO8601().withMessage('scheduledFor must be valid ISO date'),
  handleValidationErrors
], createNotification);

/**
 * @route   PUT /api/v1/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:id/read', [
  param('id').isUUID().withMessage('Notification ID must be valid UUID'),
  handleValidationErrors
], markAsRead);

/**
 * @route   PUT /api/v1/notifications/mark-all-read
 * @desc    Mark all notifications as read (with optional filters)
 * @access  Private
 * @params  type, storeId, priority (optional filters)
 */
router.put('/mark-all-read', [
  query('type').optional().isIn([
    'new_message', 'booking_created', 'booking_confirmed', 'booking_cancelled',
    'offer_accepted', 'offer_rejected', 'new_review', 'store_follow', 'payment_received'
  ]).withMessage('Invalid notification type'),
  query('storeId').optional().isUUID().withMessage('storeId must be valid UUID'),
  query('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority'),
  handleValidationErrors
], markAllAsRead);

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', [
  param('id').isUUID().withMessage('Notification ID must be valid UUID'),
  handleValidationErrors
], deleteNotification);

// NOTIFICATION SETTINGS ROUTES

/**
 * @route   GET /api/v1/notifications/settings
 * @desc    Get user's notification settings
 * @access  Private
 */
router.get('/settings', getNotificationSettings);

/**
 * @route   PUT /api/v1/notifications/settings
 * @desc    Update user's notification settings
 * @access  Private
 * @body    chat, email, sms, push, marketing (boolean values)
 */
router.put('/settings', [
  body('chat').optional().isBoolean().withMessage('chat setting must be boolean'),
  body('email').optional().isBoolean().withMessage('email setting must be boolean'),
  body('sms').optional().isBoolean().withMessage('sms setting must be boolean'),
  body('push').optional().isBoolean().withMessage('push setting must be boolean'),
  body('marketing').optional().isBoolean().withMessage('marketing setting must be boolean'),
  handleValidationErrors
], updateNotificationSettings);

// DEBUG ROUTES (development only)
if (process.env.NODE_ENV === 'development') {
  /**
   * @route   GET /api/v1/notifications/debug-auth
   * @desc    Debug authentication - shows which user type is authenticated
   * @access  Private
   */
  router.get('/debug-auth', (req, res) => {
    res.json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: req.user.id,
        email: req.user.email,
        type: req.user.type || 'unknown',
        userType: req.user.userType || req.user.type || 'unknown'
      },
      timestamp: new Date().toISOString()
    });
  });
}

// BULK OPERATIONS

/**
 * @route   PUT /api/v1/notifications/bulk/mark-read
 * @desc    Mark multiple notifications as read
 * @access  Private
 * @body    notificationIds (array of UUIDs)
 */
router.put('/bulk/mark-read', [
  body('notificationIds').isArray({ min: 1 }).withMessage('notificationIds must be non-empty array'),
  body('notificationIds.*').isUUID().withMessage('Each notification ID must be valid UUID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user.id || req.user.merchant_id || req.user.userId;
    const { notificationIds } = req.body;

    const { Notification } = require('../models');
    
    const [updatedCount] = await Notification.update(
      { 
        read: true,
        readAt: new Date(),
        deliveryStatus: require('sequelize').literal(`JSON_SET(deliveryStatus, '$.inApp', 'read')`)
      },
      {
        where: {
          id: notificationIds,
          userId,
          read: false
        }
      }
    );

    // Emit real-time update
    if (global.io) {
      global.io.to(`user_${userId}`).emit('notifications_bulk_read', {
        notificationIds,
        count: updatedCount
      });
    }

    return res.status(200).json({
      success: true,
      message: `${updatedCount} notifications marked as read`,
      data: { updatedCount, notificationIds }
    });

  } catch (error) {
    console.error('Error bulk marking notifications as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read'
    });
  }
});

/**
 * @route   DELETE /api/v1/notifications/bulk
 * @desc    Delete multiple notifications
 * @access  Private
 * @body    notificationIds (array of UUIDs)
 */
router.delete('/bulk', [
  body('notificationIds').isArray({ min: 1 }).withMessage('notificationIds must be non-empty array'),
  body('notificationIds.*').isUUID().withMessage('Each notification ID must be valid UUID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user.id || req.user.merchant_id || req.user.userId;
    const { notificationIds } = req.body;

    const { Notification } = require('../models');
    
    const deletedCount = await Notification.destroy({
      where: {
        id: notificationIds,
        userId
      }
    });

    // Emit real-time update
    if (global.io) {
      global.io.to(`user_${userId}`).emit('notifications_bulk_deleted', {
        notificationIds,
        count: deletedCount
      });
    }

    return res.status(200).json({
      success: true,
      message: `${deletedCount} notifications deleted`,
      data: { deletedCount, notificationIds }
    });

  } catch (error) {
    console.error('Error bulk deleting notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notifications'
    });
  }
});

// HEALTH CHECK ROUTE

/**
 * @route   GET /api/v1/notifications/health
 * @desc    Health check for notification system
 * @access  Private
 */
router.get('/health', async (req, res) => {
  try {
    const { Notification, sequelize } = require('../models');
    
    // Test database connection
    await sequelize.authenticate();
    
    // Test notification table access
    const count = await Notification.count({ limit: 1 });
    
    return res.status(200).json({
      success: true,
      message: 'Notification system is healthy',
      data: {
        database: 'connected',
        notifications: 'accessible',
        userType: req.user.type || 'unknown',
        userId: req.user.id,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Notification system health check failed:', error);
    return res.status(503).json({
      success: false,
      message: 'Notification system is unhealthy',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Service unavailable'
    });
  }
});

// ERROR HANDLING MIDDLEWARE
router.use((error, req, res, next) => {
  console.error('Notification route error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors
    });
  }
  
  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Database validation error',
      errors: error.errors.map(e => ({ field: e.path, message: e.message }))
    });
  }
  
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});


module.exports = router;