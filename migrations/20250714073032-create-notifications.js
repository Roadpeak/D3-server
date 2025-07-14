// /migrations/YYYYMMDDHHMMSS-create-notifications.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      recipientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      senderId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      type: {
        type: Sequelize.ENUM(
          'new_service_request',
          'new_store_offer',
          'offer_accepted',
          'offer_rejected',
          'offer_withdrawn',
          'service_completed',
          'review_received',
          'payment_received',
          'payment_released',
          'message_received',
          'account_verified',
          'store_approved',
          'system_announcement',
          'reminder'
        ),
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      message: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      data: {
        type: Sequelize.JSON,
        defaultValue: JSON.stringify({})
      },
      read: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      readAt: {
        type: Sequelize.DATE
      },
      actionUrl: {
        type: Sequelize.STRING(255)
      },
      priority: {
        type: Sequelize.ENUM('low', 'normal', 'high', 'urgent'),
        defaultValue: 'normal'
      },
      channels: {
        type: Sequelize.JSON,
        defaultValue: JSON.stringify({
          inApp: true,
          email: false,
          sms: false,
          push: false
        })
      },
      deliveryStatus: {
        type: Sequelize.JSON,
        defaultValue: JSON.stringify({
          inApp: 'pending',
          email: 'pending',
          sms: 'pending',
          push: 'pending'
        })
      },
      expiresAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('DATE_ADD(NOW(), INTERVAL 30 DAY)')
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('notifications', ['recipientId', 'read']);
    await queryInterface.addIndex('notifications', ['recipientId', 'createdAt']);
    await queryInterface.addIndex('notifications', ['type']);
    await queryInterface.addIndex('notifications', ['expiresAt']);
    await queryInterface.addIndex('notifications', ['priority']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('notifications');
  }
};

// /migrations/YYYYMMDDHHMMSS-add-foreign-key-constraints.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add foreign key constraint for acceptedOfferId in service_requests
    // This needs to be added after service_offers table is created
    await queryInterface.addConstraint('service_requests', {
      fields: ['acceptedOfferId'],
      type: 'foreign key',
      name: 'fk_service_requests_accepted_offer',
      references: {
        table: 'service_offers',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('service_requests', 'fk_service_requests_accepted_offer');
  }
};

// /utils/notifications.js - Notification utility functions
const { Notification } = require('../models');

/**
 * Send notification to a user
 * @param {number} recipientId - User ID to send notification to
 * @param {Object} notificationData - Notification data
 * @param {string} notificationData.type - Notification type
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.message - Notification message
 * @param {Object} notificationData.data - Additional notification data
 * @param {string} notificationData.actionUrl - URL for notification action
 * @param {string} notificationData.priority - Notification priority
 * @param {Object} notificationData.channels - Delivery channels
 * @param {number} senderId - ID of user sending notification (optional)
 */
async function sendNotification(recipientId, notificationData, senderId = null) {
  try {
    const notification = await Notification.create({
      recipientId,
      senderId,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data || {},
      actionUrl: notificationData.actionUrl || null,
      priority: notificationData.priority || 'normal',
      channels: notificationData.channels || {
        inApp: true,
        email: false,
        sms: false,
        push: false
      }
    });

    // Here you could add logic to actually send the notification
    // via email, SMS, push notification services, etc.
    
    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 * @param {number} notificationId - Notification ID
 * @param {number} userId - User ID (for security check)
 */
async function markAsRead(notificationId, userId) {
  try {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        recipientId: userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await notification.update({
      read: true,
      readAt: new Date()
    });

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Get user notifications with pagination
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {boolean} options.unreadOnly - Show only unread notifications
 */
async function getUserNotifications(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    unreadOnly = false
  } = options;

  try {
    const whereClause = { recipientId: userId };
    
    if (unreadOnly) {
      whereClause.read = false;
    }

    const { count, rows } = await Notification.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: require('../models').User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'avatar']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    return {
      notifications: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalCount: count,
        hasNext: page < Math.ceil(count / limit),
        hasPrev: page > 1
      }
    };
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 * @param {number} userId - User ID
 */
async function markAllAsRead(userId) {
  try {
    await Notification.update(
      { 
        read: true, 
        readAt: new Date() 
      },
      {
        where: {
          recipientId: userId,
          read: false
        }
      }
    );
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * Delete old notifications (cleanup job)
 * @param {number} daysOld - Delete notifications older than this many days
 */
async function deleteOldNotifications(daysOld = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const deletedCount = await Notification.destroy({
      where: {
        createdAt: {
          [require('sequelize').Op.lt]: cutoffDate
        }
      }
    });

    console.log(`Deleted ${deletedCount} old notifications`);
    return deletedCount;
  } catch (error) {
    console.error('Error deleting old notifications:', error);
    throw error;
  }
}

module.exports = {
  sendNotification,
  markAsRead,
  getUserNotifications,
  markAllAsRead,
  deleteOldNotifications
};