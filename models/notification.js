// models/notification.js - Corrected notification model
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {  // Using userId after database migration
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    senderId: {
      type: DataTypes.UUID,
      defaultValue: null,
      references: {
        model: 'Users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    type: {
      type: DataTypes.ENUM(
        // Your existing types
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
        'reminder',
        // Additional frontend-expected types
        'message',
        'booking',
        'offer',
        'store_follow'
      ),
      allowNull: false,
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
    // Remove metadata field since it doesn't exist in your database
    // data field already exists and serves the same purpose
    data: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    // ADDED: Both read and isRead for flexibility  
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isRead: {  // Added for frontend compatibility
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('read');
      },
      set(value) {
        this.setDataValue('read', value);
      }
    },
    readAt: {
      type: DataTypes.DATE,
      defaultValue: null,
    },
    actionUrl: {
      type: DataTypes.STRING(255),
      defaultValue: null,
    },
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
    },
    deliveryStatus: {
      type: DataTypes.JSON,
      defaultValue: {
        inApp: 'pending',
        email: 'pending',
        sms: 'pending',
        push: 'pending',
      },
    },
    expiresAt: {
      type: DataTypes.DATE,
      defaultValue: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  }, {
    tableName: 'notifications',
    timestamps: true,
    hooks: {
      beforeSave: (notification) => {
        // Sync metadata with data if one is updated
        if (notification.changed('data') && !notification.changed('metadata')) {
          notification.metadata = notification.data;
        }
        if (notification.changed('metadata') && !notification.changed('data')) {
          notification.data = notification.metadata;
        }
      }
    }
  });

  return Notification;
};