module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define('Notification', {
      id: {
        type: DataTypes.UUID,           // Change from INTEGER to UUID
        defaultValue: DataTypes.UUIDV4, // Add UUID generation
        primaryKey: true,
      },
      recipientId: {
        type: DataTypes.UUID,           // Change to UUID
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      senderId: {
        type: DataTypes.UUID,           // Change to UUID
        defaultValue: null,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      type: {
        type: DataTypes.ENUM(
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
      data: {
        type: DataTypes.JSON,
        defaultValue: {},
      },
      read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
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
    });
  
    return Notification;
  };