// controllers/notificationController.js - COMPLETE WITH UNIFIED SYSTEM + WEB PUSH (MERCHANT SUPPORT FIXED)
const { Op } = require('sequelize');
const webpush = require('web-push');

// Configure VAPID
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:info@discoun3ree.com',
  process.env.VAPID_PUBLIC_KEY || 'BKejhBqZqa4GnoAc7nFnQXtCTTbQBpMXjABBS_cMyk4RRpRkgOB6_52y2VQxObMi9XBvRyim7seUpvUm1HaoFms',
  process.env.VAPID_PRIVATE_KEY || 'vZYL5Wpd6wK74jj_ElqqD9Mxxui2GyWOouRfUgyB-SQ'
);

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
  Store,
  Merchant,
  PushSubscription,
  sequelize
} = models;

class NotificationController {

  // Helper method to extract userId from req.user (handles both user and merchant auth)
  getUserId(reqUser) {
    return reqUser.id || reqUser.merchant_id || reqUser.userId;
  }

  // ✅ Get recipient type from user
  getRecipientType(reqUser) {
    const userType = reqUser.type || reqUser.userType;
    if (userType === 'merchant') {
      return 'merchant';
    } else if (userType === 'admin') {
      return 'admin';
    }
    return 'user';
  }

  // ============================================
  // WEB PUSH HELPER METHODS
  // ============================================

  /**
   * Send web push notification to user's devices (supports both users and merchants)
   */
  async sendWebPushNotification(userId, userType, notification) {
    try {
      if (!PushSubscription) {
        console.log('PushSubscription model not available, skipping web push');
        return { sent: 0, skipped: true };
      }

      // Get push subscriptions for this user/merchant
      const subscriptions = await PushSubscription.findAll({
        where: {
          userId,
          userType: userType || 'user'
        },
        attributes: ['endpoint', 'p256dhKey', 'authKey']
      });

      if (subscriptions.length === 0) {
        console.log(`No push subscriptions for ${userType} ${userId}`);
        return { sent: 0 };
      }

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.message || notification.body,
        icon: notification.icon || '/icon-192x192.png',
        badge: '/badge-96x96.png',
        url: notification.actionUrl || '/',
        data: {
          notificationId: notification.id,
          type: notification.type,
          relatedId: notification.relatedId
        }
      });

      // Send to all user's devices
      const results = await Promise.allSettled(
        subscriptions.map(sub =>
          webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dhKey,
              auth: sub.authKey
            }
          }, payload)
            .catch(async (error) => {
              // Clean up expired subscriptions
              if (error.statusCode === 410) {
                console.log(`Removing expired push subscription: ${sub.endpoint}`);
                await PushSubscription.destroy({
                  where: { endpoint: sub.endpoint }
                });
              }
              throw error;
            })
        )
      );

      const sent = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`📱 Web push: sent ${sent}, failed ${failed} to ${userType} ${userId}`);

      return { sent, failed };
    } catch (error) {
      console.error('Web push error:', error);
      return { sent: 0, error: error.message };
    }
  }

  /**
   * Get VAPID public key for frontend subscription
   */
  async getVapidPublicKey(req, res) {
    try {
      return res.json({
        success: true,
        publicKey: process.env.VAPID_PUBLIC_KEY || 'BKejhBqZqa4GnoAc7nFnQXtCTTbQBpMXjABBS_cMyk4RRpRkgOB6_52y2VQxObMi9XBvRyim7seUpvUm1HaoFms'
      });
    } catch (error) {
      console.error('Error getting VAPID key:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get VAPID key'
      });
    }
  }

  /**
   * Subscribe to web push notifications - FIXED FOR MERCHANTS
   */
  async subscribePushNotifications(req, res) {
    try {
      const userId = this.getUserId(req.user);
      const userType = req.user.type || req.user.userType || 'user';
      const subscription = req.body;

      console.log('📱 Push subscription request:', {
        userId,
        userType,
        hasSubscription: !!subscription,
        endpoint: subscription?.endpoint
      });

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({
          success: false,
          message: 'Invalid subscription data'
        });
      }

      if (!PushSubscription) {
        return res.status(503).json({
          success: false,
          message: 'Push notifications not available'
        });
      }

      // Save subscription to database
      await PushSubscription.upsert({
        userId,
        userType,
        endpoint: subscription.endpoint,
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
        userAgent: req.headers['user-agent'],
        lastUsedAt: new Date()
      });

      console.log(`✅ ${userType} ${userId} subscribed to web push notifications`);

      // Send welcome notification
      try {
        await this.sendWebPushNotification(userId, userType, {
          title: userType === 'merchant' ? '🔔 Merchant Notifications Enabled!' : '🎉 Notifications Enabled!',
          message: userType === 'merchant'
            ? 'You\'ll now receive instant updates for customer messages, bookings, and reviews.'
            : 'You\'ll now receive instant updates even when the app is closed.',
          icon: '/logo192.png',
          actionUrl: userType === 'merchant' ? '/dashboard' : '/'
        });
      } catch (welcomeError) {
        console.warn('Failed to send welcome notification:', welcomeError);
      }

      return res.status(201).json({
        success: true,
        message: 'Successfully subscribed to push notifications',
        data: {
          userType,
          subscribed: true
        }
      });

    } catch (error) {
      console.error('Push subscription error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to subscribe to push notifications',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Unsubscribe from web push notifications
   */
  async unsubscribePushNotifications(req, res) {
    try {
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({
          success: false,
          message: 'Endpoint is required'
        });
      }

      if (!PushSubscription) {
        return res.status(503).json({
          success: false,
          message: 'Push notifications not available'
        });
      }

      await PushSubscription.destroy({
        where: { endpoint }
      });

      console.log(`✅ Unsubscribed from push notifications`);

      return res.json({
        success: true,
        message: 'Successfully unsubscribed'
      });

    } catch (error) {
      console.error('Push unsubscribe error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to unsubscribe'
      });
    }
  }

  /**
   * Get push notification statistics
   */
  async getPushStats(req, res) {
    try {
      const userId = this.getUserId(req.user);
      const userType = this.getRecipientType(req.user);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      if (!PushSubscription) {
        return res.json({
          success: true,
          data: {
            subscribed: false,
            deviceCount: 0,
            available: false
          }
        });
      }

      const subscriptions = await PushSubscription.findAll({
        where: {
          userId,
          userType
        },
        attributes: ['endpoint', 'userAgent', 'lastUsedAt', 'createdAt']
      });

      return res.json({
        success: true,
        data: {
          subscribed: subscriptions.length > 0,
          deviceCount: subscriptions.length,
          devices: subscriptions.map(sub => ({
            id: sub.endpoint.slice(-20),
            userAgent: sub.userAgent,
            lastUsed: sub.lastUsedAt,
            subscribedAt: sub.createdAt
          })),
          available: true
        }
      });

    } catch (error) {
      console.error('Error getting push stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get push statistics'
      });
    }
  }

  // ============================================
  // NOTIFICATION CRUD METHODS (WITH UNIFIED SYSTEM)
  // ============================================

  /**
   * Get all notifications for a user with enhanced context
   */
  async getNotifications(req, res) {
    try {
      const userId = this.getUserId(req.user);
      const recipientType = this.getRecipientType(req.user);

      if (!userId) {
        console.error('No userId found in req.user:', req.user);
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      const {
        page = 1,
        limit = 20,
        type = 'all',
        unreadOnly = false,
        storeId = null,
        priority = null
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build where clause with enhanced filtering
      const whereClause = {
        userId,
        recipientType
      };

      if (type !== 'all') {
        whereClause.type = type;
      }

      if (unreadOnly === 'true') {
        whereClause.read = false;
      }

      if (storeId) {
        whereClause.storeId = storeId;
      }

      if (priority) {
        whereClause.priority = priority;
      }

      // Enhanced query with associations and new columns
      const { count, rows: notifications } = await Notification.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName', 'avatar', 'userType'],
            required: false
          },
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url', 'category', 'location'],
            required: false
          }
        ],
        order: [
          ['priority', 'DESC'],
          ['createdAt', 'DESC']
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
        attributes: [
          'id',
          'userId',
          'recipientType',
          'senderId',
          'storeId',
          'type',
          'title',
          'message',
          'data',
          'read',
          'readAt',
          'actionUrl',
          'actionType',
          'priority',
          'channels',
          'deliveryStatus',
          'relatedEntityType',
          'relatedEntityId',
          'groupKey',
          'scheduledFor',
          'expiresAt',
          'createdAt',
          'updatedAt'
        ]
      });

      // Transform with enhanced context
      const transformedNotifications = notifications.map(notification => ({
        id: notification.id,
        userId: notification.userId,
        recipientType: notification.recipientType,
        senderId: notification.senderId,
        storeId: notification.storeId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        read: notification.read,
        readAt: notification.readAt,
        actionUrl: notification.actionUrl,
        actionType: notification.actionType,
        priority: notification.priority,
        channels: notification.channels || {},
        deliveryStatus: notification.deliveryStatus || {},
        relatedEntityType: notification.relatedEntityType,
        relatedEntityId: notification.relatedEntityId,
        groupKey: notification.groupKey,
        scheduledFor: notification.scheduledFor,
        expiresAt: notification.expiresAt,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
        // Enhanced context
        sender: notification.sender ? {
          id: notification.sender.id,
          name: `${notification.sender.firstName} ${notification.sender.lastName}`,
          avatar: notification.sender.avatar,
          userType: notification.sender.userType
        } : null,
        store: notification.store ? {
          id: notification.store.id,
          name: notification.store.name,
          logo: notification.store.logo_url,
          category: notification.store.category,
          location: notification.store.location
        } : null,
        // Computed fields for frontend compatibility
        isRead: notification.read,
        metadata: notification.data || {},
        timeAgo: this.formatTimeAgo(notification.createdAt),
        isNew: this.isNewNotification(notification.createdAt)
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

  /**
   * Enhanced notification counts with better grouping
   */
  async getNotificationCounts(req, res) {
    try {
      const userId = this.getUserId(req.user);
      const recipientType = this.getRecipientType(req.user);

      if (!userId) {
        console.error('No userId found in req.user for counts:', req.user);
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      const { storeId } = req.query;

      console.log('Getting enhanced notification counts for:', { userId, recipientType });

      // Build base where clause
      let whereClause = 'WHERE userId = :userId AND recipientType = :recipientType';
      const replacements = { userId, recipientType };

      if (storeId) {
        whereClause += ' AND storeId = :storeId';
        replacements.storeId = storeId;
      }

      // Enhanced query with new columns
      const counts = await sequelize.query(`
        SELECT 
          type,
          priority,
          COUNT(*) as total,
          SUM(CASE WHEN \`read\` = 0 OR \`read\` IS NULL THEN 1 ELSE 0 END) as unread,
          SUM(CASE WHEN scheduledFor IS NOT NULL AND scheduledFor > NOW() THEN 1 ELSE 0 END) as scheduled,
          SUM(CASE WHEN priority = 'urgent' AND (\`read\` = 0 OR \`read\` IS NULL) THEN 1 ELSE 0 END) as urgent
        FROM notifications 
        ${whereClause}
        GROUP BY type, priority
      `, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });

      console.log('Enhanced query results:', counts);

      // Enhanced result structure
      const result = {
        total: 0,
        unread: 0,
        urgent: 0,
        scheduled: 0,
        byType: {
          new_message: 0,
          new_conversation: 0,
          booking_created: 0,
          booking_confirmed: 0,
          booking_cancelled: 0,
          offer_accepted: 0,
          offer_rejected: 0,
          new_review: 0,
          store_follow: 0,
          payment_received: 0,
          service_request_offer: 0,
          system_announcement: 0
        },
        byPriority: {
          low: 0,
          normal: 0,
          high: 0,
          urgent: 0
        },
        byStore: {}
      };

      counts.forEach(count => {
        const total = parseInt(count.total);
        const unread = parseInt(count.unread);
        const scheduled = parseInt(count.scheduled);
        const urgent = parseInt(count.urgent);

        result.total += total;
        result.unread += unread;
        result.scheduled += scheduled;
        result.urgent += urgent;

        // Count by type
        if (result.byType.hasOwnProperty(count.type)) {
          result.byType[count.type] += unread;
        }

        // Count by priority
        if (result.byPriority.hasOwnProperty(count.priority)) {
          result.byPriority[count.priority] += unread;
        }
      });

      console.log('Enhanced notification counts:', result);

      return res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error fetching enhanced notification counts:', error);

      // Return enhanced empty counts on error
      return res.status(200).json({
        success: true,
        data: {
          total: 0,
          unread: 0,
          urgent: 0,
          scheduled: 0,
          byType: {
            new_message: 0,
            new_conversation: 0,
            booking_created: 0,
            booking_confirmed: 0,
            booking_cancelled: 0,
            offer_accepted: 0,
            offer_rejected: 0,
            new_review: 0,
            store_follow: 0,
            payment_received: 0,
            service_request_offer: 0,
            system_announcement: 0
          },
          byPriority: {
            low: 0,
            normal: 0,
            high: 0,
            urgent: 0
          },
          byStore: {}
        }
      });
    }
  }

  /**
   * Enhanced notification creation with web push delivery + unified system
   */
  async createNotification(req, res) {
    try {
      const notificationData = req.body;
      const createdBy = this.getUserId(req.user);

      if (!createdBy) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      // Validate required fields
      if (!notificationData.userId || !notificationData.type || !notificationData.title) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, type, title'
        });
      }

      // Determine recipient type
      const recipientType = notificationData.recipientType || 'user';

      // Enhanced notification data with smart defaults
      const enhancedData = {
        userId: notificationData.userId,
        recipientType: recipientType,
        senderId: notificationData.senderId || createdBy,
        storeId: notificationData.storeId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || notificationData.metadata || {},
        read: false,
        priority: notificationData.priority || 'normal',
        actionUrl: notificationData.actionUrl || this.generateActionUrl(notificationData),
        actionType: notificationData.actionType || 'navigate',
        channels: notificationData.channels || this.getDefaultChannels(notificationData.type),
        deliveryStatus: this.getInitialDeliveryStatus(),
        relatedEntityType: notificationData.relatedEntityType,
        relatedEntityId: notificationData.relatedEntityId,
        groupKey: notificationData.groupKey || this.generateGroupKey(notificationData),
        scheduledFor: notificationData.scheduledFor,
        expiresAt: notificationData.expiresAt || this.getDefaultExpiry()
      };

      // 1. Create in-app notification
      const notification = await Notification.create(enhancedData);
      console.log(`✅ Created in-app notification ${notification.id} for ${recipientType} ${notification.userId}`);

      // Load with associations for complete response
      const fullNotification = await Notification.findByPk(notification.id, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName', 'avatar', 'userType'],
            required: false
          },
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url', 'category'],
            required: false
          }
        ]
      });

      // 2. Emit real-time Socket.IO notification
      if (global.io) {
        global.io.to(`user_${notification.userId}`).emit('new_notification', {
          id: fullNotification.id,
          type: fullNotification.type,
          title: fullNotification.title,
          message: fullNotification.message,
          data: fullNotification.data,
          priority: fullNotification.priority,
          actionUrl: fullNotification.actionUrl,
          createdAt: fullNotification.createdAt,
          sender: fullNotification.sender,
          store: fullNotification.store
        });
        console.log(`✅ Sent Socket.IO notification to ${recipientType} ${notification.userId}`);
      }

      // 3. Send web push notification (supports both users and merchants)
      const pushResult = await this.sendWebPushNotification(
        notification.userId,
        recipientType,
        {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          actionUrl: notification.actionUrl,
          icon: notificationData.icon
        }
      );

      // Update delivery status based on push result
      if (pushResult.sent > 0) {
        await notification.update({
          deliveryStatus: {
            ...notification.deliveryStatus,
            push: 'delivered'
          }
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Notification created and delivered',
        data: {
          notification: fullNotification,
          delivery: {
            inApp: true,
            socketIO: !!global.io,
            webPush: pushResult.sent > 0,
            pushDevices: pushResult.sent || 0,
            pushFailed: pushResult.failed || 0,
            recipientType: recipientType
          }
        }
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

  /**
   * Enhanced mark as read with context
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req.user);
      const recipientType = this.getRecipientType(req.user);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      const notification = await Notification.findOne({
        where: {
          id,
          userId,
          recipientType
        },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName'],
            required: false
          },
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name'],
            required: false
          }
        ]
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      // Update with enhanced tracking
      await notification.update({
        read: true,
        readAt: new Date(),
        deliveryStatus: {
          ...notification.deliveryStatus,
          inApp: 'read'
        }
      });

      // Emit real-time update
      if (global.io) {
        global.io.to(`user_${userId}`).emit('notification_read', {
          notificationId: id,
          readAt: notification.readAt
        });
      }

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

  /**
   * Enhanced mark all as read with filtering
   */
  async markAllAsRead(req, res) {
    try {
      const userId = this.getUserId(req.user);
      const recipientType = this.getRecipientType(req.user);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      const { type, storeId, priority } = req.query;

      const whereClause = {
        userId,
        recipientType,
        read: false
      };

      if (type) {
        whereClause.type = type;
      }

      if (storeId) {
        whereClause.storeId = storeId;
      }

      if (priority) {
        whereClause.priority = priority;
      }

      const [updatedCount] = await Notification.update(
        {
          read: true,
          readAt: new Date(),
          deliveryStatus: sequelize.literal(`JSON_SET(deliveryStatus, '$.inApp', 'read')`)
        },
        {
          where: whereClause
        }
      );

      // Emit real-time update
      if (global.io) {
        global.io.to(`user_${userId}`).emit('notifications_bulk_read', {
          count: updatedCount,
          filters: { type, storeId, priority }
        });
      }

      return res.status(200).json({
        success: true,
        message: `${updatedCount} notifications marked as read`,
        data: { updatedCount, filters: { type, storeId, priority } }
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

  /**
   * Get notifications by store (for merchants)
   */
  async getNotificationsByStore(req, res) {
    try {
      const userId = this.getUserId(req.user);
      const recipientType = this.getRecipientType(req.user);
      const { storeId } = req.params;
      const { page = 1, limit = 20, unreadOnly = false } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      // Verify user has access to this store (for merchants)
      if (recipientType === 'merchant') {
        const store = await Store.findOne({
          where: { id: storeId, merchant_id: userId }
        });

        if (!store) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this store'
          });
        }
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const whereClause = {
        userId,
        recipientType,
        storeId
      };

      if (unreadOnly === 'true') {
        whereClause.read = false;
      }

      const { count, rows: notifications } = await Notification.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName', 'avatar', 'userType'],
            required: false
          },
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url'],
            required: false
          }
        ],
        order: [['priority', 'DESC'], ['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Get store info
      const store = notifications.length > 0 && notifications[0].store
        ? notifications[0].store
        : await Store.findByPk(storeId, { attributes: ['id', 'name', 'logo_url'] });

      return res.status(200).json({
        success: true,
        data: {
          store: store ? {
            id: store.id,
            name: store.name,
            logo: store.logo_url
          } : null,
          notifications,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit)),
            totalCount: count
          }
        }
      });

    } catch (error) {
      console.error('Error fetching store notifications:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch store notifications'
      });
    }
  }

  /**
   * Get notification analytics
   */
  async getNotificationAnalytics(req, res) {
    try {
      const userId = this.getUserId(req.user);
      const recipientType = this.getRecipientType(req.user);
      const { period = '7d', storeId } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      const startDate = this.getDateByPeriod(period);
      let whereClause = 'WHERE userId = :userId AND recipientType = :recipientType AND createdAt >= :startDate';
      const replacements = { userId, recipientType, startDate };

      if (storeId) {
        whereClause += ' AND storeId = :storeId';
        replacements.storeId = storeId;
      }

      const analytics = await sequelize.query(`
        SELECT 
          type,
          priority,
          DATE(createdAt) as date,
          COUNT(*) as total,
          SUM(CASE WHEN \`read\` = 1 THEN 1 ELSE 0 END) as read_count,
          AVG(CASE WHEN readAt IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, createdAt, readAt) END) as avg_read_time
        FROM notifications 
        ${whereClause}
        GROUP BY type, priority, DATE(createdAt)
        ORDER BY date DESC
      `, {
        replacements,
        type: sequelize.QueryTypes.SELECT
      });

      return res.status(200).json({
        success: true,
        data: {
          period,
          recipientType,
          analytics,
          summary: {
            totalNotifications: analytics.reduce((sum, a) => sum + parseInt(a.total), 0),
            readRate: this.calculateReadRate(analytics),
            avgReadTime: this.calculateAvgReadTime(analytics)
          }
        }
      });

    } catch (error) {
      console.error('Error fetching notification analytics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics'
      });
    }
  }

  /**
   * Delete notification with enhanced checking
   */
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req.user);
      const recipientType = this.getRecipientType(req.user);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      const notification = await Notification.findOne({
        where: {
          id,
          userId,
          recipientType
        }
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      await notification.destroy();

      // Emit real-time update
      if (global.io) {
        global.io.to(`user_${userId}`).emit('notification_deleted', {
          notificationId: id
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete notification'
      });
    }
  }

  /**
   * Get notification settings (enhanced)
   */
  async getNotificationSettings(req, res) {
    try {
      const userId = this.getUserId(req.user);
      const userType = this.getRecipientType(req.user);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      // Get user's notification preferences from appropriate model
      let settings;

      if (userType === 'merchant' && Merchant) {
        const merchant = await Merchant.findByPk(userId, {
          attributes: [
            'chatNotifications',
            'emailNotifications',
            'smsNotifications',
            'pushNotifications',
            'marketingEmails'
          ]
        });

        if (merchant) {
          settings = {
            chat: merchant.chatNotifications,
            email: merchant.emailNotifications,
            sms: merchant.smsNotifications,
            push: merchant.pushNotifications,
            marketing: merchant.marketingEmails,
            messages: merchant.chatNotifications,
            bookings: merchant.emailNotifications,
            offers: merchant.pushNotifications,
            storeUpdates: merchant.emailNotifications
          };
        }
      } else {
        const user = await User.findByPk(userId, {
          attributes: [
            'chatNotifications',
            'emailNotifications',
            'smsNotifications',
            'pushNotifications',
            'marketingEmails'
          ]
        });

        if (user) {
          settings = {
            chat: user.chatNotifications,
            email: user.emailNotifications,
            sms: user.smsNotifications,
            push: user.pushNotifications,
            marketing: user.marketingEmails,
            messages: user.chatNotifications,
            bookings: user.emailNotifications,
            offers: user.pushNotifications,
            storeUpdates: user.emailNotifications
          };
        }
      }

      // Default settings if not found
      if (!settings) {
        settings = {
          chat: true,
          email: true,
          sms: true,
          push: true,
          marketing: false,
          messages: true,
          bookings: true,
          offers: true,
          storeUpdates: true
        };
      }

      return res.status(200).json({
        success: true,
        data: settings
      });

    } catch (error) {
      console.error('Error fetching notification settings:', error);
      return res.status(200).json({
        success: true,
        data: {
          chat: true,
          email: true,
          sms: true,
          push: true,
          marketing: false,
          messages: true,
          bookings: true,
          offers: true,
          storeUpdates: true
        }
      });
    }
  }

  /**
   * Update notification settings (enhanced)
   */
  async updateNotificationSettings(req, res) {
    try {
      const userId = this.getUserId(req.user);
      const userType = this.getRecipientType(req.user);
      const settings = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found in request'
        });
      }

      // Map frontend settings to model fields
      const updateData = {};
      if (typeof settings.chat === 'boolean') updateData.chatNotifications = settings.chat;
      if (typeof settings.email === 'boolean') updateData.emailNotifications = settings.email;
      if (typeof settings.sms === 'boolean') updateData.smsNotifications = settings.sms;
      if (typeof settings.push === 'boolean') updateData.pushNotifications = settings.push;
      if (typeof settings.marketing === 'boolean') updateData.marketingEmails = settings.marketing;

      let updatedEntity;

      if (userType === 'merchant' && Merchant) {
        const merchant = await Merchant.findByPk(userId);
        if (!merchant) {
          return res.status(404).json({
            success: false,
            message: 'Merchant not found'
          });
        }
        await merchant.update(updateData);
        updatedEntity = merchant;
      } else {
        const user = await User.findByPk(userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }
        await user.update(updateData);
        updatedEntity = user;
      }

      return res.status(200).json({
        success: true,
        message: 'Notification settings updated successfully',
        data: {
          chat: updatedEntity.chatNotifications,
          email: updatedEntity.emailNotifications,
          sms: updatedEntity.smsNotifications,
          push: updatedEntity.pushNotifications,
          marketing: updatedEntity.marketingEmails
        }
      });

    } catch (error) {
      console.error('Error updating notification settings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update notification settings'
      });
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  generateActionUrl(notificationData) {
    const urlMap = {
      new_message: `/chat/${notificationData.relatedEntityId}`,
      new_conversation: `/chat/${notificationData.relatedEntityId}`,
      booking_created: `/bookings/${notificationData.relatedEntityId}`,
      booking_confirmed: `/bookings/${notificationData.relatedEntityId}`,
      new_review: `/stores/${notificationData.storeId}/reviews`,
      store_follow: `/stores/${notificationData.storeId}`,
      offer_accepted: `/marketplace/offers/${notificationData.relatedEntityId}`
    };

    return urlMap[notificationData.type] || '/notifications';
  }

  getDefaultChannels(type) {
    const channelMap = {
      booking_confirmed: { inApp: true, email: true, sms: true, push: true },
      booking_cancelled: { inApp: true, email: true, sms: true, push: true },
      payment_received: { inApp: true, email: true, push: true },
      new_message: { inApp: true, push: true },
      new_conversation: { inApp: true, email: true, push: true },
      offer_accepted: { inApp: true, email: true, push: true }
    };

    return channelMap[type] || { inApp: true, email: false, sms: false, push: true };
  }

  getInitialDeliveryStatus() {
    return {
      inApp: 'delivered',
      email: 'pending',
      sms: 'pending',
      push: 'pending'
    };
  }

  generateGroupKey(notificationData) {
    if (notificationData.groupKey) return notificationData.groupKey;

    const baseKey = `${notificationData.type}_${notificationData.userId}`;
    if (notificationData.storeId) {
      return `${baseKey}_${notificationData.storeId}`;
    }
    return baseKey;
  }

  getDefaultExpiry() {
    const now = new Date();
    now.setDate(now.getDate() + 30); // 30 days from now
    return now;
  }

  getDateByPeriod(period) {
    const now = new Date();
    switch (period) {
      case '1d': return new Date(now.setDate(now.getDate() - 1));
      case '7d': return new Date(now.setDate(now.getDate() - 7));
      case '30d': return new Date(now.setDate(now.getDate() - 30));
      default: return new Date(now.setDate(now.getDate() - 7));
    }
  }

  formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return time.toLocaleDateString();
  }

  isNewNotification(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    return diffInMinutes < 60;
  }

  calculateReadRate(analytics) {
    const totals = analytics.reduce((acc, a) => ({
      total: acc.total + parseInt(a.total),
      read: acc.read + parseInt(a.read_count)
    }), { total: 0, read: 0 });

    return totals.total > 0 ? Math.round((totals.read / totals.total) * 100) : 0;
  }

  calculateAvgReadTime(analytics) {
    const validTimes = analytics.filter(a => a.avg_read_time !== null);
    if (validTimes.length === 0) return 0;

    const avgTime = validTimes.reduce((sum, a) => sum + parseFloat(a.avg_read_time), 0) / validTimes.length;
    return Math.round(avgTime);
  }
}

// Create controller instance
const notificationController = new NotificationController();

// Export methods with enhanced functionality
module.exports = {
  // Existing exports
  getNotifications: notificationController.getNotifications.bind(notificationController),
  getNotificationCounts: notificationController.getNotificationCounts.bind(notificationController),
  markAsRead: notificationController.markAsRead.bind(notificationController),
  markAllAsRead: notificationController.markAllAsRead.bind(notificationController),
  createNotification: notificationController.createNotification.bind(notificationController),
  deleteNotification: notificationController.deleteNotification.bind(notificationController),
  getNotificationSettings: notificationController.getNotificationSettings.bind(notificationController),
  updateNotificationSettings: notificationController.updateNotificationSettings.bind(notificationController),
  getNotificationsByStore: notificationController.getNotificationsByStore.bind(notificationController),
  getNotificationAnalytics: notificationController.getNotificationAnalytics.bind(notificationController),

  // Web push exports
  getVapidPublicKey: notificationController.getVapidPublicKey.bind(notificationController),
  subscribePushNotifications: notificationController.subscribePushNotifications.bind(notificationController),
  unsubscribePushNotifications: notificationController.unsubscribePushNotifications.bind(notificationController),
  getPushStats: notificationController.getPushStats.bind(notificationController),
  sendWebPushNotification: notificationController.sendWebPushNotification.bind(notificationController),

  NotificationController
};