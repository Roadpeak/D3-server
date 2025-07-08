// Example of consistent model definitions

// User.js
'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED, // Make sure this matches across all models
      primaryKey: true,
      autoIncrement: true,
    },
    // ... other user fields
  });
  return User;
};

// Store.js
'use strict';
module.exports = (sequelize, DataTypes) => {
  const Store = sequelize.define('Store', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED, // Consistent with User
      primaryKey: true,
      autoIncrement: true,
    },
    // ... other store fields
  });
  return Store;
};

// Chat.js (your updated model)
'use strict';
module.exports = (sequelize, DataTypes) => {
  const Chat = sequelize.define('Chat', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED, // Consistent with User and Store
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED, // Must match User.id exactly
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    storeId: {
      type: DataTypes.INTEGER.UNSIGNED, // Must match Store.id exactly
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

  // Your instance methods remain the same
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