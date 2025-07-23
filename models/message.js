'use strict';
module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
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
    sender_type: {
      type: DataTypes.ENUM('user', 'merchant', 'system'),
      allowNull: false,
      defaultValue: 'user'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    messageType: {
      type: DataTypes.ENUM('text', 'image', 'file', 'system'),
      defaultValue: 'text'
    },
    status: {
      type: DataTypes.ENUM('sent', 'delivered', 'read'),
      defaultValue: 'sent'
    },
    attachments: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    edited_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'messages',
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        fields: ['chat_id']
      },
      {
        fields: ['sender_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['chat_id', 'createdAt']
      }
    ]
  });

  // Associations
  Message.associate = (models) => {
    Message.belongsTo(models.Chat, {
      foreignKey: 'chat_id',
      as: 'chat',
      onDelete: 'CASCADE',
    });

    Message.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender',
      onDelete: 'CASCADE',
    });
  };

  // Instance methods
  Message.prototype.markAsRead = function () {
    this.status = 'read';
    return this.save();
  };

  Message.prototype.markAsDelivered = function () {
    this.status = 'delivered';
    return this.save();
  };

  Message.prototype.softDelete = function () {
    this.deleted_at = new Date();
    return this.save();
  };

  // Class methods
  Message.getMessagesByChat = function (chatId, page = 1, limit = 50) {
    return this.findAll({
      where: { 
        chat_id: chatId,
        deleted_at: null
      },
      include: [
        {
          model: sequelize.models.User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'avatar']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: limit,
      offset: (page - 1) * limit
    });
  };

  Message.getUnreadCount = function (chatId, userId) {
    return this.count({
      where: {
        chat_id: chatId,
        sender_id: { [sequelize.Op.ne]: userId },
        status: { [sequelize.Op.ne]: 'read' },
        deleted_at: null
      }
    });
  };

  return Message;
};