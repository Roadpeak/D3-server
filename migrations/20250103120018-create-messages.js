'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
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
        comment: 'ID of sender: customer ID (users.id) OR merchant ID (merchants.id) based on sender_type'
      },
      sender_type: {
        type: Sequelize.ENUM('user', 'store'),
        allowNull: false,
        comment: 'Type of sender: "user" for customers, "store" for merchant replies as store'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Message content'
      },
      messageType: {
        type: Sequelize.ENUM('text', 'image', 'file', 'audio', 'video', 'location', 'contact', 'system'),
        defaultValue: 'text',
        allowNull: false,
        comment: 'Type of message content'
      },
      status: {
        type: Sequelize.ENUM('sent', 'delivered', 'read', 'failed'),
        defaultValue: 'sent',
        allowNull: false,
        comment: 'Message delivery status'
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
        defaultValue: '[]',
        comment: 'Array of attachment objects (images, files, etc.)'
      },
      metadata: {
        type: Sequelize.JSON,
        defaultValue: '{}',
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add optimized indexes
    await queryInterface.addIndex('messages', ['chat_id', 'createdAt'], {
      name: 'idx_messages_chat_created'
    });

    await queryInterface.addIndex('messages', ['sender_type', 'sender_id'], {
      name: 'idx_messages_sender_type_id'
    });

    await queryInterface.addIndex('messages', ['chat_id', 'sender_type', 'status'], {
      name: 'idx_messages_chat_sender_status'
    });

    await queryInterface.addIndex('messages', ['status'], {
      name: 'idx_messages_status'
    });

    await queryInterface.addIndex('messages', ['replyTo'], {
      name: 'idx_messages_reply_to'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('messages');
  }
};