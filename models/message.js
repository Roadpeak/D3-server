'use strict';

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    chat_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'chats',
        key: 'id'
      }
    },
    sender_id: {
      type: DataTypes.UUID,
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
        len: [1, 5000]
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
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    reactions: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    replyTo: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'messages',
        key: 'id'
      }
    },
    editHistory: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deletedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'messages',
    timestamps: true,
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
    defaultScope: {
      where: {
        isDeleted: false
      }
    },
    scopes: {
      withDeleted: {
        where: {}
      }
    }
  });

  // ADD THIS ASSOCIATION METHOD
  Message.associate = function(models) {
    // Message belongs to User (sender)
    Message.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender'
    });

    // Message belongs to Chat
    Message.belongsTo(models.Chat, {
      foreignKey: 'chat_id',
      as: 'chat'
    });

    // Message belongs to User (who deleted it)
    Message.belongsTo(models.User, {
      foreignKey: 'deletedBy',
      as: 'deletedByUser'
    });

    // Self-referencing association for replies
    Message.belongsTo(models.Message, {
      foreignKey: 'replyTo',
      as: 'replyToMessage'
    });

    Message.hasMany(models.Message, {
      foreignKey: 'replyTo',
      as: 'replies'
    });
  };

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
    reactions = reactions.filter(r => r.userId !== userId);
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
          model: sequelize.models.User, // Use model instead of association
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName'] // Updated to match your User model
        },
        {
          model: sequelize.models.Message, // Use model instead of association
          as: 'replyToMessage',
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