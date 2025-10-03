'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('chats', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
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
        comment: 'Customer who is chatting with the store'
      },
      storeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'stores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Store that the customer is chatting with'
      },
      status: {
        type: Sequelize.ENUM('active', 'archived', 'blocked'),
        defaultValue: 'active',
        comment: 'Status of the customer↔store conversation'
      },
      lastMessageAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of the last message in this conversation'
      },
      priority: {
        type: Sequelize.ENUM('low', 'normal', 'high', 'urgent'),
        defaultValue: 'normal',
        comment: 'Priority level set by merchant for this customer conversation'
      },
      tags: {
        type: Sequelize.JSON,
        defaultValue: '[]',
        comment: 'Tags added by merchant for organizing customer conversations'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Private notes by merchant about this customer conversation'
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: '{}',
        comment: 'Additional metadata for the customer↔store conversation'
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

    // Add indexes
    await queryInterface.addIndex('chats', ['userId', 'storeId'], {
      unique: true,
      name: 'idx_chats_user_store_unique'
    });

    await queryInterface.addIndex('chats', ['userId'], {
      name: 'idx_chats_user_id'
    });

    await queryInterface.addIndex('chats', ['storeId'], {
      name: 'idx_chats_store_id'
    });

    await queryInterface.addIndex('chats', ['storeId', 'status', 'lastMessageAt'], {
      name: 'idx_chats_store_status_recent'
    });

    await queryInterface.addIndex('chats', ['storeId', 'priority'], {
      name: 'idx_chats_store_priority'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('chats');
  }
};