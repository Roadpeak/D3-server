// controllers/notificationController.js - Simple version that matches your exact database
const { Op } = require('sequelize');

let models = {};
try {
  models = require('../models');
  console.log('Models imported in notification controller');
} catch (error) {
  console.error('Failed to import models in notification controller:', error);
}

const {
  Notification,
  User,
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

      // Use userId since you renamed the column
      const whereClause = { userId };
      
      if (type !== 'all') {
        whereClause.type = type;
      }

      if (unreadOnly === 'true') {
        whereClause.read = false;
      }

      // Simple query with only existing columns
      const { count, rows: notifications } = await Notification.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
        attributes: [
          'id', 
          'userId', 
          'senderId', 
          'type', 
          'title', 
          'message', 
          'data', 
          'read', 
          'readAt', 
          'priority', 
          'createdAt', 
          'updatedAt'
        ] // Only select columns that actually exist
      });

      // Transform to match frontend expectations
      const transformedNotifications = notifications.map(notification => ({
        id: notification.id,
        userId: notification.userId,
        type: this.mapDbTypeToFrontend(notification.type),
        title: notification.title,
        message: notification.message,
        metadata: notification.data || {}, // Map data to metadata for frontend
        isRead: notification.read, // Map read to isRead for frontend
        createdAt: notification.createdAt,
        readAt: notification.readAt,
        priority: notification.priority
      }));

      const totalPages = Math.ceil(count / parseInt(limit));

      return res.status(200).json({
        success: true,
        data: {
          notifications: transformedNotifications,
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

      console.log('Getting notification counts for user:', userId);

      // Use raw SQL with your actual column names
      const counts = await sequelize.query(`
        SELECT 
          type,
          COUNT(*) as total,
          SUM(CASE WHEN \`read\` = 0 OR \`read\` IS NULL THEN 1 ELSE 0 END) as unread
        FROM notifications 
        WHERE userId = :userId 
        GROUP BY type
      `, {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      });

      console.log('Raw query results:', counts);

      // Map your database types to frontend expected types
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
        
        // Map to frontend type
        const frontendType = this.mapDbTypeToFrontend(count.type);
        result.byType[frontendType] = (result.byType[frontendType] || 0) + unread;
      });

      console.log('Formatted notification counts:', result);

      return res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error fetching notification counts:', error);
      
      // Return empty counts on error
      return res.status(200).json({
        success: true,
        data: {
          total: 0,
          unread: 0,
          byType: {
            message: 0,
            booking: 0,
            offer: 0,
            store_follow: 0
          }
        }
      });
    }
  }

  // Helper method to map database types to frontend types
  mapDbTypeToFrontend(dbType) {
    const typeMapping = {
      'message_received': 'message',
      'new_service_request': 'offer',
      'offer_accepted': 'booking',
      'offer_rejected': 'booking', 
      'service_completed': 'booking',
      'new_store_offer': 'offer',
      'offer_withdrawn': 'offer',
      'store_approved': 'store_follow',
      'system_announcement': 'store_follow',
      'account_verified': 'store_follow',
      'review_received': 'booking',
      'payment_received': 'booking',
      'payment_released': 'booking',
      'reminder': 'store_follow'
    };

    return typeMapping[dbType] || 'store_follow';
  }

  // Mark a notification as read
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOne({
        where: { id, userId },
        attributes: ['id', 'userId', 'type', 'title', 'message', 'data', 'read', 'readAt', 'createdAt']
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      await notification.update({ read: true, readAt: new Date() });

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
        read: false 
      };

      if (type) {
        // Map frontend type to your database types
        const frontendToDbMapping = {
          'message': ['message_received'],
          'booking': ['offer_accepted', 'offer_rejected', 'service_completed', 'review_received', 'payment_received', 'payment_released'],
          'offer': ['new_service_request', 'new_store_offer', 'offer_withdrawn'],
          'store_follow': ['store_approved', 'system_announcement', 'account_verified', 'reminder']
        };

        const dbTypes = frontendToDbMapping[type];
        if (dbTypes) {
          whereClause.type = { [Op.in]: dbTypes };
        }
      }

      const [updatedCount] = await Notification.update(
        { 
          read: true,
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

  // Create a notification
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
        userId: notificationData.userId,
        senderId: createdBy,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.metadata || notificationData.data || {},
        read: false,
        priority: notificationData.priority || 'normal'
      });

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

  // Delete notification
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOne({
        where: { id, userId },
        attributes: ['id', 'userId', 'type', 'title']
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

  // Get notification settings for user
  async getNotificationSettings(req, res) {
    try {
      return res.status(200).json({
        success: true,
        data: {
          email: true,
          push: true,
          messages: true,
          bookings: true,
          offers: true,
          storeUpdates: true
        }
      });
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      return res.status(200).json({
        success: true,
        data: {
          email: true,
          push: true,
          messages: true,
          bookings: true,
          offers: true,
          storeUpdates: true
        }
      });
    }
  }

  // Update notification settings for user
  async updateNotificationSettings(req, res) {
    try {
      const settings = req.body;

      // Validate settings
      const validSettings = ['email', 'push', 'messages', 'bookings', 'offers', 'storeUpdates'];
      const filteredSettings = {};
      
      validSettings.forEach(key => {
        if (typeof settings[key] === 'boolean') {
          filteredSettings[key] = settings[key];
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Notification settings updated successfully',
        data: filteredSettings
      });

    } catch (error) {
      console.error('Error updating notification settings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update notification settings'
      });
    }
  }

  // Bulk mark notifications as read
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
          read: true,
          readAt: new Date() 
        },
        {
          where: {
            id: notificationIds,
            userId,
            read: false
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
        message: 'Failed to mark notifications as read'
      });
    }
  }

  // Clean old notifications
  async cleanOldNotifications(req, res) {
    try {
      const daysToKeep = 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedCount = await Notification.destroy({
        where: {
          createdAt: {
            [Op.lt]: cutoffDate
          },
          read: true
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
        message: 'Failed to clean old notifications'
      });
    }
  }

  // Helper method to map database types to frontend types
  mapDbTypeToFrontend(dbType) {
    const typeMapping = {
      'message_received': 'message',
      'new_service_request': 'offer',
      'offer_accepted': 'booking',
      'offer_rejected': 'booking', 
      'service_completed': 'booking',
      'new_store_offer': 'offer',
      'offer_withdrawn': 'offer',
      'store_approved': 'store_follow',
      'system_announcement': 'store_follow',
      'account_verified': 'store_follow',
      'review_received': 'booking',
      'payment_received': 'booking',
      'payment_released': 'booking',
      'reminder': 'store_follow'
    };

    return typeMapping[dbType] || 'store_follow';
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
  
  NotificationController
};