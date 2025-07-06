'use strict';

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    chat_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'chats',
        key: 'id'
      }
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    senderType: {
      type: DataTypes.ENUM('customer', 'merchant'),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [1, 5000] // Limit message length
      }
    },
    messageType: {
      type: DataTypes.ENUM('text', 'image', 'file', 'order', 'product', 'system'),
      defaultValue: 'text'
    },
    status: {
      type: DataTypes.ENUM('sent', 'delivered', 'read', 'failed'),
      defaultValue: 'sent'
    },
    // Store metadata as JSON
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {}
      // For images: { fileName, fileSize, mimeType, url }
      // For files: { fileName, fileSize, mimeType, url }
      // For orders: { orderId, orderNumber, status }
      // For products: { productId, name, price, image }
    },
    // Store reactions as JSON array
    reactions: {
      type: DataTypes.JSON,
      defaultValue: []
      // Format: [{ userId, reaction, timestamp }]
    },
    // For reply/thread functionality
    replyTo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'messages',
        key: 'id'
      }
    },
    // Store edit history as JSON
    editHistory: {
      type: DataTypes.JSON,
      defaultValue: []
      // Format: [{ content, editedAt }]
    },
    // Soft delete flag
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deletedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'messages',
    timestamps: true, // Adds createdAt and updatedAt
    indexes: [
      {
        fields: ['chat_id', 'createdAt']
      },
      {
        fields: ['sender_id', 'createdAt']
      },
      {
        fields: ['chat_id', 'status']
      },
      {
        fields: ['chat_id', 'messageType']
      }
    ],
    // Default scope to exclude deleted messages
    defaultScope: {
      where: {
        isDeleted: false
      }
    },
    scopes: {
      // Include deleted messages
      withDeleted: {
        where: {}
      }
    }
  });

  // Instance methods
  Message.prototype.markAsRead = function() {
    this.status = 'read';
    return this.save();
  };

  Message.prototype.markAsDelivered = function() {
    this.status = 'delivered';
    return this.save();
  };

  Message.prototype.addReaction = function(userId, reaction) {
    let reactions = this.reactions || [];
    // Remove existing reaction from this user
    reactions = reactions.filter(r => r.userId !== userId);
    
    // Add new reaction
    reactions.push({ userId, reaction, timestamp: new Date() });
    this.reactions = reactions;
    return this.save();
  };

  Message.prototype.removeReaction = function(userId) {
    let reactions = this.reactions || [];
    this.reactions = reactions.filter(r => r.userId !== userId);
    return this.save();
  };

  Message.prototype.softDelete = function(deletedBy) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    return this.save();
  };

  // Class methods
  Message.getUnreadCount = function(chatId, userId) {
    return this.count({
      where: {
        chat_id: chatId,
        sender_id: { [sequelize.Sequelize.Op.ne]: userId },
        status: { [sequelize.Sequelize.Op.ne]: 'read' },
        isDeleted: false
      }
    });
  };

  Message.getConversationMessages = function(chatId, page = 1, limit = 50) {
    return this.findAll({
      where: { 
        chat_id: chatId,
        isDeleted: false 
      },
      include: [
        {
          association: 'sender',
          attributes: ['id', 'name', 'avatar']
        },
        {
          association: 'replyToMessage',
          attributes: ['id', 'content', 'sender_id']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: limit,
      offset: (page - 1) * limit
    });
  };

  // Virtual for checking if message is edited
  Message.prototype.getIsEdited = function() {
    return this.editHistory && this.editHistory.length > 0;
  };

  return Message;
};