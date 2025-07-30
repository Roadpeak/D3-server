// migrations/YYYYMMDDHHMMSS-create-chats-table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create Chats table for Customer↔Store conversations
    await queryInterface.createTable('chats', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users', // Customer
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
          model: 'stores', // Store
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Store that the customer is chatting with'
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'active',
        allowNull: false,
        comment: 'Status of the customer↔store conversation (active, archived, blocked)'
      },
      lastMessageAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of the last message in this conversation'
      },
      priority: {
        type: Sequelize.STRING,
        defaultValue: 'normal',
        allowNull: false,
        comment: 'Priority level set by merchant for this customer conversation (low, normal, high, urgent)'
      },
      tags: {
        type: Sequelize.JSON,
        defaultValue: [],
        allowNull: true,
        comment: 'Tags added by merchant for organizing customer conversations'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Private notes by merchant about this customer conversation'
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: true,
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes for Chats table - IMPORTANT for performance!
    // Check if indexes exist before creating them
    try {
      await queryInterface.addIndex('chats', {
        fields: ['userId', 'storeId'],
        unique: true,
        name: 'unique_customer_store_chat'
      });
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Duplicate key')) {
        throw error;
      }
      console.log('Index unique_customer_store_chat already exists, skipping...');
    }

    try {
      await queryInterface.addIndex('chats', {
        fields: ['userId'],
        name: 'chats_customer_index'
      });
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Duplicate key')) {
        throw error;
      }
      console.log('Index chats_customer_index already exists, skipping...');
    }

    try {
      await queryInterface.addIndex('chats', {
        fields: ['storeId'],
        name: 'chats_store_index'
      });
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Duplicate key')) {
        throw error;
      }
      console.log('Index chats_store_index already exists, skipping...');
    }

    try {
      await queryInterface.addIndex('chats', {
        fields: ['status'],
        name: 'chats_status_index'
      });
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Duplicate key')) {
        throw error;
      }
      console.log('Index chats_status_index already exists, skipping...');
    }

    try {
      await queryInterface.addIndex('chats', {
        fields: ['lastMessageAt'],
        name: 'chats_last_message_index'
      });
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Duplicate key')) {
        throw error;
      }
      console.log('Index chats_last_message_index already exists, skipping...');
    }

    try {
      await queryInterface.addIndex('chats', {
        fields: ['priority'],
        name: 'chats_priority_index'
      });
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Duplicate key')) {
        throw error;
      }
      console.log('Index chats_priority_index already exists, skipping...');
    }

    try {
      await queryInterface.addIndex('chats', {
        fields: ['createdAt'],
        name: 'chats_created_at_index'
      });
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Duplicate key')) {
        throw error;
      }
      console.log('Index chats_created_at_index already exists, skipping...');
    }

    // Composite indexes for common queries
    try {
      await queryInterface.addIndex('chats', {
        fields: ['storeId', 'status', 'lastMessageAt'],
        name: 'chats_store_status_last_message_index'
      });
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Duplicate key')) {
        throw error;
      }
      console.log('Index chats_store_status_last_message_index already exists, skipping...');
    }

    try {
      await queryInterface.addIndex('chats', {
        fields: ['userId', 'status', 'lastMessageAt'],
        name: 'chats_user_status_last_message_index'
      });
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('Duplicate key')) {
        throw error;
      }
      console.log('Index chats_user_status_last_message_index already exists, skipping...');
    }

    console.log('✅ Successfully created chats table with indexes');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    try {
      await queryInterface.removeIndex('chats', 'unique_customer_store_chat');
      await queryInterface.removeIndex('chats', 'chats_customer_index');
      await queryInterface.removeIndex('chats', 'chats_store_index');
      await queryInterface.removeIndex('chats', 'chats_status_index');
      await queryInterface.removeIndex('chats', 'chats_last_message_index');
      await queryInterface.removeIndex('chats', 'chats_priority_index');
      await queryInterface.removeIndex('chats', 'chats_created_at_index');
      await queryInterface.removeIndex('chats', 'chats_store_status_last_message_index');
      await queryInterface.removeIndex('chats', 'chats_user_status_last_message_index');
    } catch (error) {
      console.log('Some indexes may not exist, continuing...');
    }

    // Drop the table
    await queryInterface.dropTable('chats');

    console.log('✅ Successfully dropped chats table');
  }
};