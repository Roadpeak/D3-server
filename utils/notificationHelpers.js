// utils/notificationHelpers.js - Clear logic for User-Store-Merchant notifications

const { Notification, User, Store, Merchant } = require('../models');

class NotificationService {
  
  /**
   * CORE NOTIFICATION CREATORS
   * These methods handle the three-party relationship logic
   */

  // Customer ↔ Store Chat Notifications
  static async createChatNotification(type, params) {
    const { chatId, senderId, recipientId, storeId, messageContent, messageId } = params;
    
    // Determine if sender is customer or merchant
    const sender = await User.findByPk(senderId);
    const recipient = await User.findByPk(recipientId);
    const store = storeId ? await Store.findByPk(storeId) : null;
    
    let title, message, actionUrl;
    
    if (sender.userType === 'customer' && recipient.userType === 'merchant') {
      // Customer messaging merchant
      title = `New message from ${sender.firstName}`;
      message = `"${this.truncateMessage(messageContent)}"`;
      actionUrl = `/merchant/chat/${chatId}`;
      
    } else if (sender.userType === 'merchant' && recipient.userType === 'customer') {
      // Merchant messaging customer
      title = store ? `New message from ${store.name}` : `New message from ${sender.firstName}`;
      message = `"${this.truncateMessage(messageContent)}"`;
      actionUrl = `/chat/${chatId}`;
    }

    return await Notification.createSmart({
      userId: recipientId,
      senderId,
      storeId,
      type: 'new_message',
      title,
      message,
      relatedEntityType: 'message',
      relatedEntityId: messageId,
      data: {
        chatId,
        messageId,
        storeName: store?.name,
        senderName: sender.firstName
      },
      priority: 'normal',
      channels: { inApp: true, push: true }
    });
  }

  // Booking Notifications (Customer ↔ Store)
  static async createBookingNotification(type, params) {
    const { bookingId, customerId, storeId, serviceTitle, bookingDate } = params;
    
    const customer = await User.findByPk(customerId);
    const store = await Store.findByPk(storeId);
    const merchant = store ? await User.findByPk(store.merchant_id) : null;
    
    const notifications = [];
    
    switch (type) {
      case 'booking_created':
        // Notify merchant about new booking
        if (merchant) {
          notifications.push(await Notification.createSmart({
            userId: merchant.id,
            senderId: customerId,
            storeId,
            type: 'booking_created',
            title: 'New Booking Request',
            message: `${customer.firstName} booked ${serviceTitle} for ${bookingDate}`,
            relatedEntityType: 'booking',
            relatedEntityId: bookingId,
            data: {
              customerName: customer.getFullName(),
              serviceTitle,
              bookingDate,
              storeName: store.name
            },
            priority: 'high',
            channels: { inApp: true, email: true, push: true }
          }));
        }
        
        // Notify customer about booking confirmation
        notifications.push(await Notification.createSmart({
          userId: customerId,
          senderId: merchant?.id,
          storeId,
          type: 'booking_confirmed',
          title: 'Booking Confirmed',
          message: `Your booking for ${serviceTitle} at ${store.name} is confirmed`,
          relatedEntityType: 'booking',
          relatedEntityId: bookingId,
          data: {
            serviceTitle,
            bookingDate,
            storeName: store.name
          },
          priority: 'high',
          channels: { inApp: true, email: true, sms: true, push: true }
        }));
        break;
        
      case 'booking_cancelled':
        // Determine who cancelled and notify the other party
        const { cancelledBy } = params;
        
        if (cancelledBy === 'customer') {
          // Customer cancelled, notify merchant
          if (merchant) {
            notifications.push(await Notification.createSmart({
              userId: merchant.id,
              senderId: customerId,
              storeId,
              type: 'booking_cancelled',
              title: 'Booking Cancelled',
              message: `${customer.firstName} cancelled their booking for ${serviceTitle}`,
              relatedEntityType: 'booking',
              relatedEntityId: bookingId,
              priority: 'high'
            }));
          }
        } else {
          // Merchant cancelled, notify customer
          notifications.push(await Notification.createSmart({
            userId: customerId,
            senderId: merchant?.id,
            storeId,
            type: 'booking_cancelled',
            title: 'Booking Cancelled',
            message: `Your booking for ${serviceTitle} at ${store.name} has been cancelled`,
            relatedEntityType: 'booking',
            relatedEntityId: bookingId,
            priority: 'high',
            channels: { inApp: true, email: true, sms: true, push: true }
          }));
        }
        break;
    }
    
    return notifications;
  }

  // Service Marketplace Notifications
  static async createServiceMarketplaceNotification(type, params) {
    const { serviceRequestId, serviceOfferId, requesterId, providerId, storeId } = params;
    
    const requester = await User.findByPk(requesterId);
    const provider = providerId ? await User.findByPk(providerId) : null;
    const store = storeId ? await Store.findByPk(storeId) : null;
    
    switch (type) {
      case 'new_service_request':
        // Notify relevant service providers in the area/category
        return await this.notifyRelevantProviders(serviceRequestId, params);
        
      case 'service_request_offer':
        // Provider made an offer, notify requester
        return await Notification.createSmart({
          userId: requesterId,
          senderId: providerId,
          storeId,
          type: 'service_request_offer',
          title: 'New Service Offer',
          message: `${store?.name || provider.getDisplayName()} made an offer for your service request`,
          relatedEntityType: 'service_offer',
          relatedEntityId: serviceOfferId,
          data: {
            providerName: provider.getDisplayName(),
            storeName: store?.name,
            serviceRequestId
          },
          priority: 'high'
        });
        
      case 'offer_accepted':
        // Requester accepted offer, notify provider
        return await Notification.createSmart({
          userId: providerId,
          senderId: requesterId,
          storeId,
          type: 'offer_accepted',
          title: 'Offer Accepted!',
          message: `${requester.firstName} accepted your service offer`,
          relatedEntityType: 'service_offer',
          relatedEntityId: serviceOfferId,
          priority: 'high',
          channels: { inApp: true, email: true, push: true }
        });
    }
  }

  // Store Follow/Interaction Notifications
  static async createStoreInteractionNotification(type, params) {
    const { userId, storeId, reviewId, rating } = params;
    
    const user = await User.findByPk(userId);
    const store = await Store.findByPk(storeId);
    const merchant = store ? await User.findByPk(store.merchant_id) : null;
    
    if (!merchant) return null;
    
    switch (type) {
      case 'store_follow':
        return await Notification.createSmart({
          userId: merchant.id,
          senderId: userId,
          storeId,
          type: 'store_follow',
          title: 'New Follower',
          message: `${user.firstName} started following ${store.name}`,
          relatedEntityType: 'store',
          relatedEntityId: storeId,
          priority: 'low'
        });
        
      case 'new_review':
        return await Notification.createSmart({
          userId: merchant.id,
          senderId: userId,
          storeId,
          type: 'new_review',
          title: 'New Review',
          message: `${user.firstName} left a ${rating}-star review for ${store.name}`,
          relatedEntityType: 'review',
          relatedEntityId: reviewId,
          data: {
            rating,
            reviewerName: user.firstName,
            storeName: store.name
          },
          priority: rating >= 4 ? 'normal' : 'high',
          channels: rating < 3 ? { inApp: true, email: true } : { inApp: true }
        });
    }
  }

  /**
   * CONTEXT-AWARE NOTIFICATION RETRIEVAL
   */

  // Get notifications with proper context for different user types
  static async getNotificationsForUser(userId, options = {}) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');
    
    const baseOptions = {
      limit: options.limit || 50,
      offset: options.offset || 0,
      unreadOnly: options.unreadOnly || false
    };
    
    // Add context-specific filters based on user type
    if (user.userType === 'merchant') {
      return await this.getMerchantNotifications(userId, baseOptions);
    } else if (user.userType === 'customer') {
      return await this.getCustomerNotifications(userId, baseOptions);
    } else {
      return await Notification.getForUser(userId, baseOptions);
    }
  }

  static async getMerchantNotifications(merchantId, options) {
    // Get merchant's stores
    const stores = await Store.findAll({
      where: { merchant_id: merchantId },
      attributes: ['id']
    });
    const storeIds = stores.map(s => s.id);
    
    // Get notifications for merchant and their stores
    return await Notification.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { userId: merchantId }, // Direct notifications to merchant
          { storeId: { [sequelize.Sequelize.Op.in]: storeIds } } // Store-related notifications
        ],
        ...(options.unreadOnly && { read: false })
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'userType']
        },
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'logo_url']
        }
      ],
      order: [['priority', 'DESC'], ['createdAt', 'DESC']],
      limit: options.limit,
      offset: options.offset
    });
  }

  static async getCustomerNotifications(customerId, options) {
    return await Notification.findAll({
      where: {
        userId: customerId,
        ...(options.unreadOnly && { read: false })
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'userType']
        },
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'logo_url', 'category']
        }
      ],
      order: [['priority', 'DESC'], ['createdAt', 'DESC']],
      limit: options.limit,
      offset: options.offset
    });
  }

  /**
   * NOTIFICATION ANALYTICS & INSIGHTS
   */

  static async getNotificationStats(userId, period = '7d') {
    const user = await User.findByPk(userId);
    const startDate = this.getDateByPeriod(period);
    
    const stats = await Notification.findAll({
      where: {
        userId,
        createdAt: { [sequelize.Sequelize.Op.gte]: startDate }
      },
      attributes: [
        'type',
        [sequelize.fn('COUNT', '*'), 'count'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN read = false THEN 1 ELSE 0 END')), 'unread']
      ],
      group: ['type'],
      raw: true
    });
    
    return {
      userType: user.userType,
      period,
      byType: stats,
      totals: {
        sent: stats.reduce((sum, s) => sum + parseInt(s.count), 0),
        unread: stats.reduce((sum, s) => sum + parseInt(s.unread), 0)
      }
    };
  }

  /**
   * UTILITY METHODS
   */

  static truncateMessage(message, maxLength = 50) {
    return message.length > maxLength 
      ? message.substring(0, maxLength) + '...' 
      : message;
  }

  static getDateByPeriod(period) {
    const now = new Date();
    switch (period) {
      case '1d':
        return new Date(now.setDate(now.getDate() - 1));
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      default:
        return new Date(now.setDate(now.getDate() - 7));
    }
  }

  // Notify relevant service providers based on location/category
  static async notifyRelevantProviders(serviceRequestId, params) {
    const { category, location, budget, description } = params;
    
    // Find stores/merchants in relevant category and location
    const relevantStores = await Store.findAll({
      where: {
        category: category || { [sequelize.Sequelize.Op.ne]: null },
        location: location || { [sequelize.Sequelize.Op.ne]: null },
        is_active: true,
        isOnline: true
      },
      include: [{
        model: Merchant,
        as: 'merchant',
        where: { isActive: true }
      }],
      limit: 20 // Limit to prevent spam
    });

    const notifications = [];
    
    for (const store of relevantStores) {
      notifications.push(await Notification.createSmart({
        userId: store.merchant.id,
        storeId: store.id,
        type: 'new_service_request',
        title: 'New Service Request',
        message: `New ${category} request in ${location} - Budget: ${budget}`,
        relatedEntityType: 'service_request',
        relatedEntityId: serviceRequestId,
        data: {
          category,
          location,
          budget,
          description: this.truncateMessage(description),
          storeName: store.name
        },
        priority: 'normal'
      }));
    }
    
    return notifications;
  }

  /**
   * BATCH NOTIFICATION OPERATIONS
   */

  // Send notification to multiple recipients
  static async sendToMultiple(recipients, notificationData) {
    const notifications = [];
    
    for (const recipientId of recipients) {
      notifications.push(await Notification.createSmart({
        ...notificationData,
        userId: recipientId
      }));
    }
    
    return notifications;
  }

  // Create grouped notifications for similar events
  static async createGroupedNotification(groupKey, baseNotification, events) {
    // Check if there's already a notification in this group
    const existing = await Notification.findOne({
      where: {
        groupKey,
        userId: baseNotification.userId,
        read: false
      },
      order: [['createdAt', 'DESC']]
    });

    if (existing && events.length > 1) {
      // Update existing notification with aggregated info
      const count = events.length;
      existing.title = `${count} new ${baseNotification.type.replace('_', ' ')}s`;
      existing.message = `You have ${count} new notifications`;
      existing.data = {
        ...existing.data,
        count,
        latestEvents: events.slice(0, 3) // Keep last 3 events
      };
      await existing.save();
      return existing;
    } else {
      // Create new notification
      return await Notification.createSmart({
        ...baseNotification,
        groupKey
      });
    }
  }

  /**
   * REAL-TIME NOTIFICATION HELPERS
   */

  // Format notification for real-time delivery (WebSocket/Socket.io)
  static formatForRealtime(notification) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      actionUrl: notification.actionUrl,
      createdAt: notification.createdAt,
      sender: notification.sender ? {
        id: notification.sender.id,
        name: notification.sender.getDisplayName?.() || 
              `${notification.sender.firstName} ${notification.sender.lastName}`,
        avatar: notification.sender.avatar,
        userType: notification.sender.userType
      } : null,
      store: notification.store ? {
        id: notification.store.id,
        name: notification.store.name,
        logo: notification.store.logo_url,
        category: notification.store.category
      } : null
    };
  }

  // Get notification settings for user
  static async getUserNotificationSettings(userId) {
    const user = await User.findByPk(userId);
    if (!user) return null;

    return {
      chatNotifications: user.chatNotifications,
      emailNotifications: user.emailNotifications,
      smsNotifications: user.smsNotifications,
      pushNotifications: user.pushNotifications,
      marketingEmails: user.marketingEmails
    };
  }

  /**
   * NOTIFICATION TEMPLATES
   */

  static getTemplates() {
    return {
      // Customer templates
      customer: {
        booking_confirmed: {
          title: 'Booking Confirmed',
          messageTemplate: 'Your booking for {serviceTitle} at {storeName} is confirmed for {date}',
          priority: 'high',
          channels: { inApp: true, email: true, sms: true, push: true }
        },
        new_message: {
          title: 'New Message',
          messageTemplate: 'You have a new message from {storeName}',
          priority: 'normal', 
          channels: { inApp: true, push: true }
        },
        offer_received: {
          title: 'Service Offer Received',
          messageTemplate: '{providerName} sent you a service offer',
          priority: 'high',
          channels: { inApp: true, email: true, push: true }
        }
      },

      // Merchant templates
      merchant: {
        new_booking: {
          title: 'New Booking',
          messageTemplate: '{customerName} booked {serviceTitle} for {date}',
          priority: 'high',
          channels: { inApp: true, email: true, push: true }
        },
        new_message: {
          title: 'Customer Message',
          messageTemplate: 'New message from {customerName}',
          priority: 'normal',
          channels: { inApp: true, push: true }
        },
        service_request: {
          title: 'New Service Request',
          messageTemplate: 'New {category} request in {location}',
          priority: 'normal',
          channels: { inApp: true, push: true }
        },
        low_rating: {
          title: 'Review Received',
          messageTemplate: '{customerName} left a {rating}-star review',
          priority: 'high',
          channels: { inApp: true, email: true }
        }
      },

      // System templates
      system: {
        account_verified: {
          title: 'Account Verified',
          messageTemplate: 'Your account has been successfully verified',
          priority: 'high',
          channels: { inApp: true, email: true }
        },
        store_approved: {
          title: 'Store Approved',
          messageTemplate: 'Your store {storeName} has been approved and is now live',
          priority: 'high', 
          channels: { inApp: true, email: true }
        }
      }
    };
  }

  // Apply template to create notification
  static async createFromTemplate(templateType, userType, recipientId, templateData) {
    const templates = this.getTemplates();
    const template = templates[userType]?.[templateType];
    
    if (!template) {
      throw new Error(`Template not found: ${userType}.${templateType}`);
    }

    // Replace template variables
    let message = template.messageTemplate;
    Object.keys(templateData).forEach(key => {
      message = message.replace(`{${key}}`, templateData[key]);
    });

    return await Notification.createSmart({
      userId: recipientId,
      type: templateType,
      title: template.title,
      message,
      data: templateData,
      priority: template.priority,
      channels: template.channels,
      ...templateData.notificationOverrides
    });
  }

  /**
   * CLEANUP AND MAINTENANCE
   */

  // Archive old notifications instead of deleting
  static async archiveOldNotifications(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await Notification.update(
      { 
        data: sequelize.fn(
          'JSON_SET', 
          sequelize.col('data'), 
          '$.archived', 
          true,
          '$.archivedAt',
          new Date()
        )
      },
      {
        where: {
          createdAt: { [sequelize.Sequelize.Op.lt]: cutoffDate },
          'data.archived': { [sequelize.Sequelize.Op.ne]: true }
        }
      }
    );
  }

  // Get notification delivery metrics
  static async getDeliveryMetrics(period = '7d') {
    const startDate = this.getDateByPeriod(period);
    
    return await Notification.findAll({
      where: {
        createdAt: { [sequelize.Sequelize.Op.gte]: startDate }
      },
      attributes: [
        'type',
        'priority',
        [sequelize.fn('COUNT', '*'), 'total'],
        [sequelize.fn('SUM', sequelize.literal('CASE WHEN read = true THEN 1 ELSE 0 END')), 'read'],
        [sequelize.fn('AVG', sequelize.literal('TIMESTAMPDIFF(MINUTE, createdAt, readAt)')), 'avgReadTime']
      ],
      group: ['type', 'priority'],
      raw: true
    });
  }
}

module.exports = NotificationService;