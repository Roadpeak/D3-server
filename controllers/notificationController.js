// controllers/notificationController.js - Comprehensive notification management
const { Op } = require('sequelize');
const { socketManager } = require('../socket/websocket');

let models = {};
try {
  models = require('../models');
  console.log('✅ Models imported in notification controller');
} catch (error) {
  console.error('❌ Failed to import models in notification controller:', error);
}

const {
  Notification,
  User,
  Store,
  Booking,
  ServiceRequest,
  ServiceOffer,
  Chat,
  Message,
  sequelize
} = models;

class NotificationController {
  
  // Get all notifications for a user with pagination and filtering
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { 
        page = 1, 
        limit = 20, 
        type = 'all',
        unreadOnly = false 
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build where clause
      const whereClause = { userId };
      
      if (type !== 'all') {
        whereClause.type = type;
      }

      if (unreadOnly === 'true') {
        whereClause.isRead = false;
      }

      const { count, rows: notifications } = await Notification.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      });

      const totalPages = Math.ceil(count / parseInt(limit));

      return res.status(200).json({
        success: true,
        data: {
          notifications,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalCount: count,
            hasNext: parseInt(page) < totalPages,
            hasPrev: parseInt(page) > 1
          }
        }
      });

    } catch (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Get notification counts by type
  async getNotificationCounts(req, res) {
    try {
      const userId = req.user.id;

      // Get counts by type
      const counts = await Notification.findAll({
        where: { userId },
        attributes: [
          'type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('SUM', sequelize.case().when({ isRead: false }, 1).else(0)), 'unread']
        ],
        group: ['type'],
        raw: true
      });

      // Format the results
      const result = {
        total: 0,
        unread: 0,
        byType: {
          message: 0,
          booking: 0,
          offer: 0,
          store_follow: 0
        }
      };

      counts.forEach(count => {
        const total = parseInt(count.total);
        const unread = parseInt(count.unread);
        
        result.total += total;
        result.unread += unread;
        result.byType[count.type] = unread;
      });

      return res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error fetching notification counts:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch notification counts',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Mark a notification as read
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOne({
        where: { id, userId }
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      await notification.update({ isRead: true, readAt: new Date() });

      return res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification
      });

    } catch (error) {
      console.error('Error marking notification as read:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Mark all notifications as read
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { type } = req.query;

      const whereClause = { 
        userId, 
        isRead: false 
      };

      if (type) {
        whereClause.type = type;
      }

      const [updatedCount] = await Notification.update(
        { 
          isRead: true, 
          readAt: new Date() 
        },
        {
          where: whereClause
        }
      );

      return res.status(200).json({
        success: true,
        message: `${updatedCount} notifications marked as read`,
        data: { updatedCount }
      });

    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notifications as read',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Create a notification (internal use)
  async createNotification(req, res) {
    try {
      const notificationData = req.body;
      const createdBy = req.user.id;

      // Validate required fields
      if (!notificationData.userId || !notificationData.type || !notificationData.title) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, type, title'
        });
      }

      const notification = await Notification.create({
        ...notificationData,
        createdBy
      });

      // Send real-time notification via socket
      this.sendRealTimeNotification(notification);

      return res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: notification
      });

    } catch (error) {
      console.error('Error creating notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create notification',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Delete a notification
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOne({
        where: { id, userId }
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      await notification.destroy();

      return res.status(200).json({
        success: true,
        message: 'Notification deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // NOTIFICATION CREATION HELPERS

  // Create message notification
  async createMessageNotification(senderId, recipientId, chatId, messageContent) {
    try {
      console.log('🔔 Creating message notification:', { senderId, recipientId, chatId });

      // Get sender information
      const sender = await User.findByPk(senderId, {
        attributes: ['id', 'firstName', 'lastName']
      });

      const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';

      const notification = await Notification.create({
        userId: recipientId,
        type: 'message',
        title: 'New Message',
        message: `${senderName} sent you a message: "${messageContent.substring(0, 50)}${messageContent.length > 50 ? '...' : ''}"`,
        metadata: {
          chatId,
          senderId,
          conversationId: chatId
        },
        isRead: false
      });

      // Send real-time notification
      this.sendRealTimeNotification(notification);
      
      return notification;

    } catch (error) {
      console.error('Error creating message notification:', error);
      return null;
    }
  }

  // Create booking notification
  async createBookingNotification(userId, bookingId, type, additionalInfo = {}) {
    try {
      console.log('📅 Creating booking notification:', { userId, bookingId, type });

      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: Service,
            attributes: ['name']
          },
          {
            model: Store,
            attributes: ['name']
          }
        ]
      });

      if (!booking) {
        console.error('Booking not found for notification:', bookingId);
        return null;
      }

      const serviceName = booking.Service?.name || 'Service';
      const storeName = booking.Store?.name || 'Provider';

      const notificationTypes = {
        'booking_confirmed': {
          title: 'Booking Confirmed',
          message: `Your booking for "${serviceName}" with ${storeName} has been confirmed.`
        },
        'booking_cancelled': {
          title: 'Booking Cancelled',
          message: `Your booking for "${serviceName}" with ${storeName} has been cancelled.`
        },
        'booking_completed': {
          title: 'Booking Completed',
          message: `Your booking for "${serviceName}" with ${storeName} has been completed. Please rate your experience!`
        },
        'booking_reminder': {
          title: 'Booking Reminder',
          message: `Reminder: You have a booking for "${serviceName}" with ${storeName} tomorrow.`
        }
      };

      const notificationData = notificationTypes[type] || {
        title: 'Booking Update',
        message: `Your booking for "${serviceName}" has been updated.`
      };

      const notification = await Notification.create({
        userId,
        type: 'booking',
        title: notificationData.title,
        message: notificationData.message,
        metadata: {
          bookingId,
          storeId: booking.storeId,
          serviceId: booking.serviceId,
          ...additionalInfo
        },
        isRead: false
      });

      // Send real-time notification
      this.sendRealTimeNotification(notification);
      
      return notification;

    } catch (error) {
      console.error('Error creating booking notification:', error);
      return null;
    }
  }

  // Create service request offer notification
  async createOfferNotification(userId, requestId, offerId, providerId) {
    try {
      console.log('🎯 Creating offer notification:', { userId, requestId, offerId, providerId });

      const [serviceRequest, offer, provider] = await Promise.all([
        ServiceRequest.findByPk(requestId),
        ServiceOffer.findByPk(offerId, {
          include: [{
            model: Store,
            attributes: ['name']
          }]
        }),
        User.findByPk(providerId, {
          attributes: ['firstName', 'lastName']
        })
      ]);

      if (!serviceRequest || !offer) {
        console.error('Service request or offer not found for notification');
        return null;
      }

      const providerName = offer.Store?.name || 
        (provider ? `${provider.firstName} ${provider.lastName}` : 'Service Provider');

      const notification = await Notification.create({
        userId,
        type: 'offer',
        title: 'New Service Offer',
        message: `You received a new offer from ${providerName} for your "${serviceRequest.title}" request.`,
        metadata: {
          requestId,
          offerId,
          providerId,
          storeId: offer.storeId
        },
        isRead: false
      });

      // Send real-time notification
      this.sendRealTimeNotification(notification);
      
      return notification;

    } catch (error) {
      console.error('Error creating offer notification:', error);
      return null;
    }
  }

  // Create store follow notification
  async createStoreFollowNotification(userId, storeId, type, additionalInfo = {}) {
    try {
      console.log('🏪 Creating store follow notification:', { userId, storeId, type });

      const store = await Store.findByPk(storeId, {
        attributes: ['name']
      });

      if (!store) {
        console.error('Store not found for notification:', storeId);
        return null;
      }

      const notificationTypes = {
        'new_offer': {
          title: 'New Offer from Followed Store',
          message: `${store.name} has posted a new offer! Check it out before it expires.`
        },
        'price_drop': {
          title: 'Price Drop Alert',
          message: `Great news! ${store.name} has reduced prices on some services.`
        },
        'store_update': {
          title: 'Store Update',
          message: `${store.name} has updated their services and information.`
        }
      };

      const notificationData = notificationTypes[type] || {
        title: 'Store Notification',
        message: `${store.name} has an update for you.`
      };

      const notification = await Notification.create({
        userId,
        type: 'store_follow',
        title: notificationData.title,
        message: notificationData.message,
        metadata: {
          storeId,
          ...additionalInfo
        },
        isRead: false
      });

      // Send real-time notification
      this.sendRealTimeNotification(notification);
      
      return notification;

    } catch (error) {
      console.error('Error creating store follow notification:', error);
      return null;
    }
  }

  // Send real-time notification via socket
  sendRealTimeNotification(notification) {
    try {
      if (socketManager && socketManager.isInitialized()) {
        console.log('🔔 Sending real-time notification to user:', notification.userId);
        
        const notificationData = {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          metadata: notification.metadata,
          createdAt: notification.createdAt,
          isRead: notification.isRead
        };

        socketManager.emitToUser(notification.userId, 'new_notification', notificationData);
        socketManager.emitToUser(notification.userId, 'notification_count_update', {
          type: notification.type
        });
      }
    } catch (error) {
      console.error('Error sending real-time notification:', error);
    }
  }

  // Get notification settings for user
  async getNotificationSettings(req, res) {
    try {
      const userId = req.user.id;

      // Try to get user's notification settings
      let user;
      try {
        user = await User.findByPk(userId, {
          attributes: ['id', 'notificationSettings', 'email', 'phoneNumber']
        });
      } catch (error) {
        console.log('User model not available or no notificationSettings field');
        user = null;
      }

      // Default settings if no user found or no settings
      const defaultSettings = {
        email: true,
        push: true,
        messages: true,
        bookings: true,
        offers: true,
        storeUpdates: true
      };

      const settings = user?.notificationSettings || defaultSettings;

      return res.status(200).json({
        success: true,
        data: settings
      });

    } catch (error) {
      console.error('Error fetching notification settings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch notification settings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Update notification settings for user
  async updateNotificationSettings(req, res) {
    try {
      const userId = req.user.id;
      const settings = req.body;

      // Validate settings
      const validSettings = ['email', 'push', 'messages', 'bookings', 'offers', 'storeUpdates'];
      const filteredSettings = {};
      
      validSettings.forEach(key => {
        if (typeof settings[key] === 'boolean') {
          filteredSettings[key] = settings[key];
        }
      });

      // Try to update user's notification settings
      try {
        const user = await User.findByPk(userId);
        if (user) {
          await user.update({ notificationSettings: filteredSettings });
        }
      } catch (error) {
        console.log('User model not available or no notificationSettings field');
      }

      return res.status(200).json({
        success: true,
        message: 'Notification settings updated successfully',
        data: filteredSettings
      });

    } catch (error) {
      console.error('Error updating notification settings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update notification settings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Bulk operations
  async bulkMarkAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { notificationIds } = req.body;

      if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'notificationIds array is required'
        });
      }

      const [updatedCount] = await Notification.update(
        { 
          isRead: true, 
          readAt: new Date() 
        },
        {
          where: {
            id: notificationIds,
            userId,
            isRead: false
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: `${updatedCount} notifications marked as read`,
        data: { updatedCount }
      });

    } catch (error) {
      console.error('Error bulk marking notifications as read:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notifications as read',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Clean old notifications
  async cleanOldNotifications(req, res) {
    try {
      const daysToKeep = 30; // Keep notifications for 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedCount = await Notification.destroy({
        where: {
          createdAt: {
            [Op.lt]: cutoffDate
          },
          isRead: true
        }
      });

      return res.status(200).json({
        success: true,
        message: `Cleaned ${deletedCount} old notifications`,
        data: { deletedCount }
      });

    } catch (error) {
      console.error('Error cleaning old notifications:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to clean old notifications',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

// Create controller instance
const notificationController = new NotificationController();

// Export methods
module.exports = {
  getNotifications: notificationController.getNotifications.bind(notificationController),
  getNotificationCounts: notificationController.getNotificationCounts.bind(notificationController),
  markAsRead: notificationController.markAsRead.bind(notificationController),
  markAllAsRead: notificationController.markAllAsRead.bind(notificationController),
  createNotification: notificationController.createNotification.bind(notificationController),
  deleteNotification: notificationController.deleteNotification.bind(notificationController),
  getNotificationSettings: notificationController.getNotificationSettings.bind(notificationController),
  updateNotificationSettings: notificationController.updateNotificationSettings.bind(notificationController),
  bulkMarkAsRead: notificationController.bulkMarkAsRead.bind(notificationController),
  cleanOldNotifications: notificationController.cleanOldNotifications.bind(notificationController),

  // Helper methods for creating notifications
  createMessageNotification: notificationController.createMessageNotification.bind(notificationController),
  createBookingNotification: notificationController.createBookingNotification.bind(notificationController),
  createOfferNotification: notificationController.createOfferNotification.bind(notificationController),
  createStoreFollowNotification: notificationController.createStoreFollowNotification.bind(notificationController),
  
  // Export the class for use in other controllers
  NotificationController
};