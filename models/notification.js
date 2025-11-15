// models/notification.js - UNIFIED SYSTEM (Enhanced with recipientType)
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
      allowNull: true, // ✅ CHANGED: Nullable for unified system
      comment: 'The recipient ID - can be user or merchant depending on recipientType'
    },

    // ✅ NEW: Recipient Type - Enables unified notification system
    recipientType: {
      type: DataTypes.ENUM('user', 'merchant', 'admin'),
      allowNull: false,
      defaultValue: 'user',
      comment: 'Type of recipient - determines which table userId references'
    },

    // SENDER: Who triggered the notification (optional for system notifications)
    senderId: {
      type: DataTypes.UUID,
      allowNull: true, // ✅ CHANGED: Nullable (merchants can't be senders)
      comment: 'The user who triggered this notification (null for merchant/system senders)'
    },

    // CONTEXT: What store/business context this notification relates to
    storeId: {
      type: DataTypes.UUID,
      allowNull: true,
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
        'warning',

        // ✅ NEW: Additional types for unified system
        'new_conversation'
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
      // ✅ NEW: Composite index with recipientType
      {
        fields: ['userId', 'recipientType', 'read', 'createdAt'],
        name: 'idx_notifications_recipient_read_created'
      },
      {
        fields: ['userId', 'recipientType', 'type', 'createdAt'],
        name: 'idx_notifications_recipient_type_created'
      },

      // OPTIMIZED: Core composite indexes
      {
        fields: ['userId', 'read', 'createdAt'],
        name: 'idx_notifications_user_read_created'
      },
      {
        fields: ['userId', 'type', 'createdAt'],
        name: 'idx_notifications_user_type_created'
      },
      {
        fields: ['userId', 'storeId'],
        name: 'idx_notifications_user_store'
      },

      // ✅ NEW: recipientType index
      {
        fields: ['recipientType'],
        name: 'idx_notifications_recipient_type'
      },

      // Foreign key indexes
      {
        fields: ['senderId'],
        name: 'idx_notifications_sender_id'
      },
      {
        fields: ['storeId'],
        name: 'idx_notifications_store_id'
      },

      // Entity reference lookup
      {
        fields: ['relatedEntityType', 'relatedEntityId'],
        name: 'idx_notifications_entity_type_id'
      },

      // Lifecycle and cleanup
      {
        fields: ['expiresAt'],
        name: 'idx_notifications_expires_at'
      },
      {
        fields: ['scheduledFor'],
        name: 'idx_notifications_scheduled_for'
      },

      // Grouping
      {
        fields: ['groupKey'],
        name: 'idx_notifications_group_key'
      }
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
        where: { userId, recipientType: 'user' } // ✅ UPDATED
      }),
      forMerchant: (userId) => ({ // ✅ NEW
        where: { userId, recipientType: 'merchant' }
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
    // ✅ UPDATED: Recipient (no FK constraint for unified system)
    Notification.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'recipient',
      constraints: false // ✅ No FK - userId can be merchant ID
    });

    // ✅ NEW: Merchant recipient association
    Notification.belongsTo(models.Merchant, {
      foreignKey: 'userId',
      as: 'merchantRecipient',
      constraints: false
    });

    // ✅ UPDATED: Sender (no FK constraint)
    Notification.belongsTo(models.User, {
      foreignKey: 'senderId',
      as: 'sender',
      constraints: false // ✅ No FK - senderId can be null
    });

    // Store context
    Notification.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store',
      constraints: false // ✅ No FK for flexibility
    });
  };

  // VIRTUAL FIELDS
  Notification.prototype.isRead = function () {
    return this.read;
  };

  // INSTANCE METHODS

  Notification.prototype.markAsRead = async function () {
    if (!this.read) {
      this.read = true;
      this.readAt = new Date();
      await this.save();
    }
    return this;
  };

  Notification.prototype.getRelatedEntity = async function () {
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

  // ✅ UPDATED: Get recipient context
  Notification.prototype.getRecipientContext = function () {
    return this.recipientType; // Returns 'user', 'merchant', or 'admin'
  };

  // Generate appropriate action URL based on context
  Notification.prototype.generateActionUrl = function () {
    const { type, storeId, relatedEntityId, data, recipientType } = this;

    // ✅ UPDATED: Context-aware URLs based on recipient type
    const baseUrl = recipientType === 'merchant' ? '/dashboard' : '';

    const urlMap = {
      // Chat notifications
      new_message: `${baseUrl}/chat/${data.chatId || relatedEntityId}`,
      chat_started: `${baseUrl}/chat/${data.chatId || relatedEntityId}`,
      new_conversation: `${baseUrl}/chat/${data.chatId || relatedEntityId}`,

      // Booking notifications  
      booking_created: `${baseUrl}/bookings/${relatedEntityId}`,
      booking_confirmed: `${baseUrl}/bookings/${relatedEntityId}`,
      booking_cancelled: `${baseUrl}/bookings/${relatedEntityId}`,

      // Store notifications
      store_follow: `/stores/${storeId}`,
      new_review: recipientType === 'merchant' ? `/dashboard/reviews` : `/stores/${storeId}/reviews`,

      // Service marketplace
      new_service_request: `/marketplace/requests/${relatedEntityId}`,
      service_request_offer: `/marketplace/offers/${relatedEntityId}`,

      // Account notifications
      account_verified: '/profile',
      merchant_approved: '/dashboard',

      // Default
      default: `${baseUrl}/notifications`
    };

    return urlMap[type] || urlMap.default;
  };

  // CLASS METHODS

  // ✅ UPDATED: Create notification with recipientType support
  Notification.createSmart = async function (params) {
    const {
      userId,
      recipientType = 'user', // ✅ NEW parameter
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
      recipientType, // ✅ NEW
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
  Notification.getDefaultChannelsForType = async function (type) {
    const channelMap = {
      // High priority - multiple channels
      booking_confirmed: { inApp: true, email: true, sms: true, push: true },
      payment_received: { inApp: true, email: true, push: true },
      booking_cancelled: { inApp: true, email: true, sms: true, push: true },

      // Medium priority - app + push
      new_message: { inApp: true, email: false, push: true },
      new_conversation: { inApp: true, email: true, push: true }, // ✅ NEW
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

  // ✅ UPDATED: Get notifications for a user/merchant with recipientType
  Notification.getForUser = async function (userId, recipientType = 'user', options = {}) {
    const {
      limit = 50,
      offset = 0,
      unreadOnly = false,
      type,
      storeId,
      includeExpired = false,
      groupSimilar = true
    } = options;

    let whereClause = {
      userId,
      recipientType // ✅ NEW: Filter by recipient type
    };

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
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'userType'],
          required: false // ✅ Optional since senderId can be null
        },
        {
          model: sequelize.models.Store,
          as: 'store',
          attributes: ['id', 'name', 'logo_url', 'category'],
          required: false
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

  // ✅ UPDATED: Get unread count with recipientType
  Notification.getUnreadCount = async function (userId, recipientType = 'user', storeId = null) {
    let whereClause = {
      userId,
      recipientType, // ✅ NEW
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

  // ✅ UPDATED: Mark all as read with recipientType
  Notification.markAllAsRead = async function (userId, recipientType = 'user', filters = {}) {
    let whereClause = {
      userId,
      recipientType, // ✅ NEW
      read: false
    };

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
  Notification.cleanupExpired = async function () {
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
      const baseKey = `${notification.type}_${notification.userId}_${notification.recipientType}`; // ✅ UPDATED
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