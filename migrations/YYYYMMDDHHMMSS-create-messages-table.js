// migrations/YYYYMMDDHHMMSS-create-messages-table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create Messages table for Customer↔Store messages
    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      chat_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'chats',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Customer↔Store conversation this message belongs to'
      },
      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'ID of the actual sender (customer ID or merchant ID)'
      },
      sender_type: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Type of sender: "user" for customers, "store" for merchant replies as store'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Message content'
      },
      messageType: {
        type: Sequelize.STRING,
        defaultValue: 'text',
        allowNull: false,
        comment: 'Type of message content (text, image, file, audio, video, location, contact, system)'
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'sent',
        allowNull: false,
        comment: 'Message delivery status (sent, delivered, read, failed)'
      },
      replyTo: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'messages',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Message this is replying to (for threaded conversations)'
      },
      attachments: {
        type: Sequelize.JSON,
        defaultValue: [],
        allowNull: true,
        comment: 'Array of attachment objects (images, files, etc.)'
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: {},
        allowNull: true,
        comment: 'Additional message metadata (read receipts, etc.)'
      },
      isEdited: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether this message has been edited'
      },
      editedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the message was last edited'
      },
      isDeleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Soft delete flag'
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the message was deleted'
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

    // Create indexes for Messages table - CRITICAL for chat performance!
    await queryInterface.addIndex('messages', {
      fields: ['chat_id'],
      name: 'messages_chat_index'
    });

    await queryInterface.addIndex('messages', {
      fields: ['sender_id'],
      name: 'messages_sender_index'
    });

    await queryInterface.addIndex('messages', {
      fields: ['sender_type'],
      name: 'messages_sender_type_index'
    });

    await queryInterface.addIndex('messages', {
      fields: ['status'],
      name: 'messages_status_index'
    });

    await queryInterface.addIndex('messages', {
      fields: ['messageType'],
      name: 'messages_type_index'
    });

    await queryInterface.addIndex('messages', {
      fields: ['createdAt'],
      name: 'messages_created_index'
    });

    await queryInterface.addIndex('messages', {
      fields: ['isDeleted'],
      name: 'messages_is_deleted_index'
    });

    await queryInterface.addIndex('messages', {
      fields: ['replyTo'],
      name: 'messages_reply_to_index'
    });

    // Composite indexes for common chat queries
    await queryInterface.addIndex('messages', {
      fields: ['chat_id', 'createdAt'],
      name: 'messages_chat_created_index'
    });

    await queryInterface.addIndex('messages', {
      fields: ['chat_id', 'sender_type', 'status'],
      name: 'messages_chat_sender_status_index'
    });

    // Performance indexes for unread message counts (VERY IMPORTANT!)
    await queryInterface.addIndex('messages', {
      fields: ['sender_type', 'status'],
      name: 'messages_sender_type_status_index'
    });

    await queryInterface.addIndex('messages', {
      fields: ['chat_id', 'sender_type', 'status', 'createdAt'],
      name: 'messages_chat_sender_status_created_index'
    });

    // Index for message search functionality
    await queryInterface.addIndex('messages', {
      fields: ['content'],
      name: 'messages_content_index',
      // Note: For PostgreSQL, you might want to use a GIN index for full-text search
      // type: 'GIN' // Uncomment if using PostgreSQL
    });

    // Index for soft deletes and active messages
    await queryInterface.addIndex('messages', {
      fields: ['chat_id', 'isDeleted', 'createdAt'],
      name: 'messages_chat_deleted_created_index'
    });

    console.log('✅ Successfully created messages table with performance indexes');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    try {
      await queryInterface.removeIndex('messages', 'messages_chat_index');
      await queryInterface.removeIndex('messages', 'messages_sender_index');
      await queryInterface.removeIndex('messages', 'messages_sender_type_index');
      await queryInterface.removeIndex('messages', 'messages_status_index');
      await queryInterface.removeIndex('messages', 'messages_type_index');
      await queryInterface.removeIndex('messages', 'messages_created_index');
      await queryInterface.removeIndex('messages', 'messages_is_deleted_index');
      await queryInterface.removeIndex('messages', 'messages_reply_to_index');
      await queryInterface.removeIndex('messages', 'messages_chat_created_index');
      await queryInterface.removeIndex('messages', 'messages_chat_sender_status_index');
      await queryInterface.removeIndex('messages', 'messages_sender_type_status_index');
      await queryInterface.removeIndex('messages', 'messages_chat_sender_status_created_index');
      await queryInterface.removeIndex('messages', 'messages_content_index');
      await queryInterface.removeIndex('messages', 'messages_chat_deleted_created_index');
    } catch (error) {
      console.log('Some indexes may not exist, continuing...');
    }

    // Drop the table
    await queryInterface.dropTable('messages');

    console.log('✅ Successfully dropped messages table');
  }
};