'use strict';

module.exports = (sequelize, DataTypes) => {
  const Chat = sequelize.define('Chat', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    storeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'stores',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'blocked'),
      defaultValue: 'active'
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Additional metadata
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {}
    }
  }, {
    tableName: 'chats',
    timestamps: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['storeId']
      },
      {
        fields: ['userId', 'storeId'],
        unique: true // Prevent duplicate chats between same user and store
      },
      {
        fields: ['lastMessageAt']
      }
    ]
  });

  // Instance methods
  Chat.prototype.updateLastMessage = function() {
    this.lastMessageAt = new Date();
    return this.save();
  };

  Chat.prototype.archive = function() {
    this.status = 'archived';
    return this.save();
  };

  Chat.prototype.block = function() {
    this.status = 'blocked';
    return this.save();
  };

  // Class methods
  Chat.findOrCreateChat = async function(userId, storeId) {
    const [chat, created] = await this.findOrCreate({
      where: { userId, storeId },
      defaults: { userId, storeId }
    });
    return { chat, created };
  };

  Chat.getUserChats = function(userId, page = 1, limit = 20) {
    return this.findAll({
      where: { userId },
      include: [
        {
          association: 'store',
          attributes: ['id', 'name', 'logo']
        },
        {
          association: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          attributes: ['id', 'content', 'messageType', 'createdAt']
        }
      ],
      order: [['lastMessageAt', 'DESC']],
      limit: limit,
      offset: (page - 1) * limit
    });
  };

  return Chat;
};