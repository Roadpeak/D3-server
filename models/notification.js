// models/notification.js - Enhanced with clear User-Store-Merchant logic
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    
    // RECIPIENT: Who receives the notification
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users', // Updated to match your User model tableName
        key: 'id',
      },
      onDelete: 'CASCADE',
      comment: 'The user who will receive this notification (customer, merchant, or admin)'
    },
    
    // SENDER: Who triggered the notification (optional for system notifications)
    senderId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
      comment: 'The user who triggered this notification (can be null for system notifications)'
    },
    
    // CONTEXT: What store/business context this notification relates to
    storeId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'stores',
        key: 'id',
      },
      onDelete: 'CASCADE',
      comment: 'The store context for this notification (chat, booking, offer, etc.)'
    },
    
    // ENTITY REFERENCES: What specific entities this notification relates to
    relatedEntityType: {
      type: DataTypes.ENUM(
        'chat',
        'message', 
        'booking',
        'offer',
        'service_request',
        'service_offer',
        'review',
        'payment',
        'store',
        'user',
        'system'
      ),
      allowNull: true,
      comment: 'The type of entity this notification relates to'
    },
    
    relatedEntityId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'The ID of the related entity (chatId, bookingId, offerId, etc.)'
    },
    
    // NOTIFICATION DETAILS
    type: {
      type: DataTypes.ENUM(
        // Customer ↔ Store Communication
        'new_message',
        'message_read',
        'chat_started',
        'store_online',
        'store_offline',
        
        // Booking & Service Related
        'booking_created',
        'booking_confirmed',
        'booking_cancelled',
        'booking_completed',
        'booking_reminder',
        
        // Service Marketplace
        'new_service_request',
        'service_request_offer',
        'offer_accepted',
        'offer_rejected',
        'offer_withdrawn',
        'service_completed',
        
        // Store & Merchant Management
        'store_follow',
        'store_unfollow',
        'new_review',
        'review_response',
        'store_approved',
        'store_suspended',
        
        // Payment & Financial
        'payment_received',
        'payment_pending',
        'payment_failed',
        'payment_refunded',
        
        // Account & Verification
        'account_verified',
        'merchant_approved',
        'merchant_rejected',
        'profile_updated',
        
        // System & Marketing
        'system_announcement',
        'promotional_offer',
        'reminder',
        'warning'
      ),
      allowNull: false,
      comment: 'Specific type of notification for proper handling and routing'
    },
    
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100],
        notEmpty: true,
      },
    },
    
    message: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        len: [1, 500],
        notEmpty: true,
      },
    },
    
    // STRUCTURED DATA: Context-specific information
    data: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Structured data specific to notification type (amounts, IDs, etc.)'
    },
    
    // READ STATUS
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    
    // NAVIGATION
    actionUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Deep link URL for notification action'
    },
    
    actionType: {
      type: DataTypes.ENUM('navigate', 'modal', 'external', 'none'),
      defaultValue: 'navigate',
      comment: 'How the frontend should handle the notification action'
    },
    
    // PRIORITY & DELIVERY
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal',
    },
    
    channels: {
      type: DataTypes.JSON,
      defaultValue: {
        inApp: true,
        email: false,
        sms: false,
        push: false,
      },
      comment: 'Which delivery channels to use for this notification'
    },
    
    deliveryStatus: {
      type: DataTypes.JSON,
      defaultValue: {
        inApp: 'pending',
        email: 'pending', 
        sms: 'pending',
        push: 'pending',
      },
      comment: 'Delivery status for each channel'
    },
    
    // LIFECYCLE
    expiresAt: {
      type: DataTypes.DATE,
      defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      comment: 'When this notification expires and can be cleaned up'
    },
    
    scheduledFor: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'For scheduled notifications (reminders, follow-ups, etc.)'
    },
    
    // GROUPING: For batching similar notifications
    groupKey: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Key for grouping similar notifications (e.g., "chat_messages_user123_store456")'
    }
    
  }, {
    tableName: 'notifications',
    timestamps: true,
    indexes: [
      // Core queries
      { fields: ['userId', 'read'] },
      { fields: ['userId', 'createdAt'] },
      { fields: ['type'] },
      { fields: ['priority'] },
      
      // Context queries
      { fields: ['storeId'] },
      { fields: ['senderId'] },
      { fields: ['relatedEntityType', 'relatedEntityId'] },
      
      // Cleanup queries
      { fields: ['expiresAt'] },
      { fields: ['scheduledFor'] },
      
      // Grouping queries
      { fields: ['groupKey'] },
      
      // Composite indexes for common queries
      { fields: ['userId', 'storeId', 'read'] },
      { fields: ['type', 'scheduledFor'] },
      { fields: ['userId', 'type', 'createdAt'] }
    ],
    scopes: {
      unread: {
        where: { read: false }
      },
      recent: {
        where: {
          createdAt: {
            [sequelize.Sequelize.Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      },
      highPriority: {
        where: {
          priority: ['high', 'urgent']
        }
      },
      forUser: (userId) => ({
        where: { userId }
      }),
      forStore: (storeId) => ({
        where: { storeId }
      }),
      byType: (type) => ({
        where: { type }
      })
    }
  });

  // ASSOCIATIONS
  Notification.associate = (models) => {
    // Recipient (who gets the notification)
    Notification.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'recipient',
      onDelete: 'CASCADE'
    });

    // Sender (who triggered the notification)
    Notification.belongsTo(models.User, {
      foreignKey: 'senderId', 
      as: 'sender',
      onDelete: 'SET NULL'
    });

    // Store context
    Notification.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store',
      onDelete: 'CASCADE'
    });

    // Dynamic associations based on relatedEntityType
    // These would be used programmatically, not as direct Sequelize associations
  };

  // VIRTUAL FIELDS
  Notification.prototype.isRead = function() {
    return this.read;
  };

  // INSTANCE METHODS
  
  Notification.prototype.markAsRead = async function() {
    if (!this.read) {
      this.read = true;
      this.readAt = new Date();
      await this.save();
    }
    return this;
  };

  Notification.prototype.getRelatedEntity = async function() {
    if (!this.relatedEntityType || !this.relatedEntityId) return null;
    
    const modelMap = {
      chat: 'Chat',
      message: 'Message',
      booking: 'Booking', 
      offer: 'Offer',
      service_request: 'ServiceRequest',
      service_offer: 'ServiceOffer',
      review: 'Review',
      payment: 'Payment',
      store: 'Store',
      user: 'User'
    };
    
    const modelName = modelMap[this.relatedEntityType];
    if (!modelName || !sequelize.models[modelName]) return null;
    
    return await sequelize.models[modelName].findByPk(this.relatedEntityId);
  };

  // Determine the notification context (customer, merchant, admin)
  Notification.prototype.getRecipientContext = async function() {
    const recipient = await this.getRecipient();
    if (!recipient) return 'unknown';
    
    return recipient.userType; // 'customer', 'merchant', 'admin'
  };

  // Generate appropriate action URL based on context
  Notification.prototype.generateActionUrl = function() {
    const { type, storeId, relatedEntityId, data } = this;
    
    const urlMap = {
      // Chat notifications
      new_message: `/chat/${data.chatId || relatedEntityId}`,
      chat_started: `/chat/${data.chatId || relatedEntityId}`,
      
      // Booking notifications  
      booking_created: `/bookings/${relatedEntityId}`,
      booking_confirmed: `/bookings/${relatedEntityId}`,
      booking_cancelled: `/bookings/${relatedEntityId}`,
      
      // Store notifications
      store_follow: `/stores/${storeId}`,
      new_review: `/stores/${storeId}/reviews`,
      
      // Service marketplace
      new_service_request: `/marketplace/requests/${relatedEntityId}`,
      service_request_offer: `/marketplace/offers/${relatedEntityId}`,
      
      // Account notifications
      account_verified: '/profile',
      merchant_approved: '/dashboard',
      
      // Default
      default: '/notifications'
    };
    
    return urlMap[type] || urlMap.default;
  };

  // CLASS METHODS

  // Create notification with smart defaults
  Notification.createSmart = async function(params) {
    const {
      userId,
      senderId,
      storeId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      data = {},
      priority = 'normal',
      channels,
      ...rest
    } = params;

    // Auto-generate action URL if not provided
    const notification = this.build({
      userId,
      senderId,
      storeId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      data,
      priority,
      channels: channels || await this.getDefaultChannelsForType(type),
      ...rest
    });

    if (!notification.actionUrl) {
      notification.actionUrl = notification.generateActionUrl();
    }

    return await notification.save();
  };

  // Get default notification channels based on type
  Notification.getDefaultChannelsForType = async function(type) {
    const channelMap = {
      // High priority - multiple channels
      booking_confirmed: { inApp: true, email: true, sms: true, push: true },
      payment_received: { inApp: true, email: true, push: true },
      booking_cancelled: { inApp: true, email: true, sms: true, push: true },
      
      // Medium priority - app + email
      new_message: { inApp: true, email: false, push: true },
      booking_created: { inApp: true, email: true, push: true },
      offer_accepted: { inApp: true, email: true, push: true },
      
      // Low priority - app only
      store_follow: { inApp: true, email: false, push: false },
      new_review: { inApp: true, email: false, push: false },
      
      // Default
      default: { inApp: true, email: false, sms: false, push: false }
    };
    
    return channelMap[type] || channelMap.default;
  };

  // Get notifications for a user with context
  Notification.getForUser = async function(userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      unreadOnly = false,
      type,
      storeId,
      includeExpired = false,
      groupSimilar = true
    } = options;

    let whereClause = { userId };
    
    if (unreadOnly) whereClause.read = false;
    if (type) whereClause.type = type;
    if (storeId) whereClause.storeId = storeId;
    if (!includeExpired) {
      whereClause.expiresAt = {
        [sequelize.Sequelize.Op.or]: [
          { [sequelize.Sequelize.Op.gt]: new Date() },
          { [sequelize.Sequelize.Op.is]: null }
        ]
      };
    }

    return await this.findAll({
      where: whereClause,
      include: [
        {
          model: sequelize.models.User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'userType']
        },
        {
          model: sequelize.models.Store,
          as: 'store',
          attributes: ['id', 'name', 'logo_url', 'category']
        }
      ],
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'DESC']
      ],
      limit,
      offset
    });
  };

  // Get unread count for user
  Notification.getUnreadCount = async function(userId, storeId = null) {
    let whereClause = { 
      userId, 
      read: false,
      expiresAt: {
        [sequelize.Sequelize.Op.or]: [
          { [sequelize.Sequelize.Op.gt]: new Date() },
          { [sequelize.Sequelize.Op.is]: null }
        ]
      }
    };
    
    if (storeId) whereClause.storeId = storeId;
    
    return await this.count({ where: whereClause });
  };

  // Mark multiple notifications as read
  Notification.markAllAsRead = async function(userId, filters = {}) {
    let whereClause = { userId, read: false };
    
    if (filters.type) whereClause.type = filters.type;
    if (filters.storeId) whereClause.storeId = filters.storeId;
    
    return await this.update(
      { 
        read: true, 
        readAt: new Date() 
      },
      { where: whereClause }
    );
  };

  // Clean up expired notifications
  Notification.cleanupExpired = async function() {
    return await this.destroy({
      where: {
        expiresAt: {
          [sequelize.Sequelize.Op.lt]: new Date()
        }
      }
    });
  };

  // HOOKS
  Notification.beforeCreate(async (notification) => {
    // Auto-generate groupKey for similar notifications
    if (!notification.groupKey && notification.type && notification.userId) {
      const baseKey = `${notification.type}_${notification.userId}`;
      if (notification.storeId) {
        notification.groupKey = `${baseKey}_${notification.storeId}`;
      } else if (notification.senderId) {
        notification.groupKey = `${baseKey}_${notification.senderId}`;
      } else {
        notification.groupKey = baseKey;
      }
    }
    
    // Auto-generate actionUrl if not provided
    if (!notification.actionUrl) {
      notification.actionUrl = notification.generateActionUrl();
    }
  });

  return Notification;
};