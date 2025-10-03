'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'The user who will receive this notification'
      },
      senderId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'The user who triggered this notification'
      },
      storeId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'stores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'The store context for this notification'
      },
      relatedEntityType: {
        type: Sequelize.ENUM(
          'chat', 'message', 'booking', 'offer', 'service_request', 
          'service_offer', 'review', 'payment', 'store', 'user', 'system'
        ),
        allowNull: true,
        comment: 'The type of entity this notification relates to'
      },
      relatedEntityId: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'The ID of the related entity'
      },
      type: {
        type: Sequelize.ENUM(
          'new_message', 'message_read', 'chat_started', 'store_online', 'store_offline',
          'booking_created', 'booking_confirmed', 'booking_cancelled', 'booking_completed', 'booking_reminder',
          'new_service_request', 'service_request_offer', 'offer_accepted', 'offer_rejected', 'offer_withdrawn', 'service_completed',
          'store_follow', 'store_unfollow', 'new_review', 'review_response', 'store_approved', 'store_suspended',
          'payment_received', 'payment_pending', 'payment_failed', 'payment_refunded',
          'account_verified', 'merchant_approved', 'merchant_rejected', 'profile_updated',
          'system_announcement', 'promotional_offer', 'reminder', 'warning'
        ),
        allowNull: false,
        comment: 'Specific type of notification'
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
        defaultValue: '{}',
        comment: 'Structured data specific to notification type'
      },
      read: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      readAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      actionUrl: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Deep link URL for notification action'
      },
      actionType: {
        type: Sequelize.ENUM('navigate', 'modal', 'external', 'none'),
        defaultValue: 'navigate',
        allowNull: false,
        comment: 'How the frontend should handle the notification action'
      },
      priority: {
        type: Sequelize.ENUM('low', 'normal', 'high', 'urgent'),
        defaultValue: 'normal',
        allowNull: false
      },
      channels: {
        type: Sequelize.JSON,
        defaultValue: '{"inApp":true,"email":false,"sms":false,"push":false}',
        comment: 'Which delivery channels to use'
      },
      deliveryStatus: {
        type: Sequelize.JSON,
        defaultValue: '{"inApp":"pending","email":"pending","sms":"pending","push":"pending"}',
        comment: 'Delivery status for each channel'
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this notification expires'
      },
      scheduledFor: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'For scheduled notifications'
      },
      groupKey: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Key for grouping similar notifications'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add optimized indexes
    await queryInterface.addIndex('notifications', ['userId', 'read', 'createdAt'], {
      name: 'idx_notifications_user_read_created'
    });

    await queryInterface.addIndex('notifications', ['userId', 'type', 'createdAt'], {
      name: 'idx_notifications_user_type_created'
    });

    await queryInterface.addIndex('notifications', ['userId', 'storeId'], {
      name: 'idx_notifications_user_store'
    });

    await queryInterface.addIndex('notifications', ['senderId'], {
      name: 'idx_notifications_sender_id'
    });

    await queryInterface.addIndex('notifications', ['storeId'], {
      name: 'idx_notifications_store_id'
    });

    await queryInterface.addIndex('notifications', ['relatedEntityType', 'relatedEntityId'], {
      name: 'idx_notifications_entity_type_id'
    });

    await queryInterface.addIndex('notifications', ['expiresAt'], {
      name: 'idx_notifications_expires_at'
    });

    await queryInterface.addIndex('notifications', ['scheduledFor'], {
      name: 'idx_notifications_scheduled_for'
    });

    await queryInterface.addIndex('notifications', ['groupKey'], {
      name: 'idx_notifications_group_key'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('notifications');
  }
};