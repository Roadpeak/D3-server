'use strict';
module.exports = (sequelize, DataTypes) => {
  const Chat = sequelize.define('Chat', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    storeId: {
      type: DataTypes.UUID,
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
        unique: true
      },
      {
        fields: ['lastMessageAt']
      }
    ]
  });

  // Associations
  Chat.associate = (models) => {
    Chat.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE',
    });

    Chat.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store',
      onDelete: 'CASCADE',
    });

    Chat.hasMany(models.Message, {
      foreignKey: 'chat_id', // Updated to match Message model field name
      as: 'messages',
      onDelete: 'CASCADE',
    });
  };

  // Instance methods
  Chat.prototype.updateLastMessage = function () {
    this.lastMessageAt = new Date();
    return this.save();
  };

  Chat.prototype.archive = function () {
    this.status = 'archived';
    return this.save();
  };

  Chat.prototype.block = function () {
    this.status = 'blocked';
    return this.save();
  };

  // Class methods
  Chat.findOrCreateChat = async function (userId, storeId) {
    const [chat, created] = await this.findOrCreate({
      where: { userId, storeId },
      defaults: { userId, storeId }
    });
    return { chat, created };
  };

  Chat.getUserChats = function (userId, page = 1, limit = 20) {
    return this.findAll({
      where: { userId },
      include: [
        {
          model: sequelize.models.Store,
          as: 'store',
          attributes: ['id', 'name', 'logo_url']
        },
        {
          model: sequelize.models.Message,
          as: 'messages',
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