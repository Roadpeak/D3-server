'use strict';
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 50],
        notEmpty: true
      }
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 50],
        notEmpty: true
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        len: [5, 100]
      },
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [10, 15],
        isNumeric: false
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [6, 255]
      }
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    userType: {
      type: DataTypes.ENUM('customer', 'merchant', 'admin'),
      defaultValue: 'customer',
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    emailVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    phoneVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isOnline: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Real-time online status for chat system'
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last seen timestamp for chat system'
    },
    chatNotifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether to receive chat notifications'
    },
    emailNotifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether to receive email notifications'
    },
    smsNotifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether to receive SMS notifications'
    },
    pushNotifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether to receive push notifications'
    },
    marketingEmails: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether to receive marketing emails'
    },
    dateOfBirth: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Customer date of birth'
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other', 'prefer_not_to_say'),
      allowNull: true,
      comment: 'Customer gender'
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Customer address'
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Customer city'
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Kenya',
      comment: 'Customer country'
    },
    postalCode: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Customer postal code'
    },
    googleId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      comment: 'Google OAuth ID for this user'
    },
    authProvider: {
      type: DataTypes.ENUM('email', 'google', 'facebook', 'apple'),
      defaultValue: 'email',
      allowNull: false,
      comment: 'Primary authentication provider used to create account'
    },
    googleLinkedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When Google account was first linked'
    },
    profileVisibility: {
      type: DataTypes.ENUM('public', 'private', 'friends_only'),
      defaultValue: 'public',
      comment: 'Profile visibility setting'
    },
    referralSlug: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      comment: 'Unique referral slug for this user (user-friendly)'
    },
    referralLink: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Full referral link for this user'
    },
    referredBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: 'ID of user who referred this user'
    },
    referredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When this user was referred'
    },
  }, {
    tableName: 'users',
    timestamps: true,
    indexes: [
      // Essential query indexes
      {
        fields: ['phoneNumber'],
        name: 'idx_phone_number'
      },
      {
        fields: ['userType', 'isActive'],
        name: 'idx_user_type_active'
      },
      {
        fields: ['userType', 'isOnline'],
        name: 'idx_user_type_online'
      },
      // Useful for admin dashboards and analytics
      {
        fields: ['userType', 'createdAt'],
        name: 'idx_user_type_created'
      },
      // Location-based queries (composite instead of separate indexes)
      {
        fields: ['country', 'city'],
        name: 'idx_location'
      },
      // Foreign key index for referrals
      {
        fields: ['referredBy'],
        name: 'idx_referred_by'
      }
    ],
    defaultScope: {
      attributes: {
        exclude: ['password']
      }
    },
    scopes: {
      withPassword: {
        attributes: {}
      },
      customersOnly: {
        where: {
          userType: 'customer'
        }
      },
      merchantsOnly: {
        where: {
          userType: 'merchant'
        }
      },
      onlineUsers: {
        where: {
          isOnline: true
        }
      }
    }
  });

  // Hash password before creating user
  User.beforeCreate(async (user) => {
    if (user.password) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      user.password = hashedPassword;
    }
  });

  // Hash password before updating if password is changed
  User.beforeUpdate(async (user) => {
    if (user.changed('password')) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      user.password = hashedPassword;
    }
  });

  // Instance methods
  User.prototype.validPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
  };

  User.prototype.getFullName = function () {
    return `${this.firstName} ${this.lastName}`;
  };

  User.prototype.isEmailVerified = function () {
    return this.emailVerifiedAt !== null;
  };

  User.prototype.isPhoneVerified = function () {
    // If no phone number, consider it as "not applicable" rather than "not verified"
    if (!this.phoneNumber) return null; // or return false, depending on your logic
    return this.phoneVerifiedAt !== null;
  };

  User.prototype.updateLastLogin = function () {
    this.lastLoginAt = new Date();
    this.isOnline = true;
    return this.save();
  };

  User.prototype.verifyEmail = function () {
    this.emailVerifiedAt = new Date();
    return this.save();
  };

  User.prototype.verifyPhone = function () {
    this.phoneVerifiedAt = new Date();
    return this.save();
  };

  User.prototype.updateOnlineStatus = async function (isOnline) {
    this.isOnline = isOnline;
    this.lastSeenAt = isOnline ? null : new Date();
    return await this.save();
  };

  User.prototype.getStoreConversations = async function (options = {}) {
    if (this.userType !== 'customer') return [];

    const { Chat } = sequelize.models;
    return await Chat.findAll({
      where: {
        userId: this.id,
        status: options.status || 'active'
      },
      include: [
        {
          model: sequelize.models.Store,
          as: 'store',
          attributes: ['id', 'name', 'logo_url', 'category', 'location', 'merchant_id', 'isOnline'],
          where: { is_active: true }
        }
      ],
      order: [['lastMessageAt', 'DESC']],
      limit: options.limit || 50
    });
  };

  User.prototype.getCustomerConversations = async function (options = {}) {
    if (this.userType !== 'merchant') return [];

    const { Chat, Store } = sequelize.models;
    const merchantStores = await Store.findAll({
      where: { merchant_id: this.id, is_active: true },
      attributes: ['id']
    });

    const storeIds = merchantStores.map(store => store.id);
    if (storeIds.length === 0) return [];

    return await Chat.findAll({
      where: {
        storeId: { [sequelize.Sequelize.Op.in]: storeIds },
        status: options.status || 'active'
      },
      include: [
        {
          model: User.scope('defaultScope'),
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'email', 'createdAt']
        },
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'logo_url', 'merchant_id']
        }
      ],
      order: [['lastMessageAt', 'DESC']],
      limit: options.limit || 50
    });
  };

  User.prototype.getUnreadMessagesCount = async function () {
    const { Message, Chat, Store } = sequelize.models;

    if (this.userType === 'customer') {
      const customerChats = await Chat.findAll({
        where: { userId: this.id },
        attributes: ['id']
      });
      const chatIds = customerChats.map(chat => chat.id);

      if (chatIds.length === 0) return 0;

      return await Message.count({
        where: {
          chat_id: { [sequelize.Sequelize.Op.in]: chatIds },
          sender_type: 'store',
          status: { [sequelize.Sequelize.Op.ne]: 'read' }
        }
      });
    } else if (this.userType === 'merchant') {
      const merchantStores = await Store.findAll({
        where: { merchant_id: this.id },
        attributes: ['id']
      });
      const storeIds = merchantStores.map(store => store.id);

      if (storeIds.length === 0) return 0;

      const storeChats = await Chat.findAll({
        where: { storeId: { [sequelize.Sequelize.Op.in]: storeIds } },
        attributes: ['id']
      });
      const chatIds = storeChats.map(chat => chat.id);

      if (chatIds.length === 0) return 0;

      return await Message.count({
        where: {
          chat_id: { [sequelize.Sequelize.Op.in]: chatIds },
          sender_type: 'user',
          status: { [sequelize.Sequelize.Op.ne]: 'read' }
        }
      });
    }

    return 0;
  };

  User.prototype.getConversationsCount = async function () {
    const { Chat, Store } = sequelize.models;

    if (this.userType === 'customer') {
      return await Chat.count({
        where: {
          userId: this.id,
          status: 'active'
        }
      });
    } else if (this.userType === 'merchant') {
      const merchantStores = await Store.findAll({
        where: { merchant_id: this.id },
        attributes: ['id']
      });
      const storeIds = merchantStores.map(store => store.id);

      if (storeIds.length === 0) return 0;

      return await Chat.count({
        where: {
          storeId: { [sequelize.Sequelize.Op.in]: storeIds },
          status: 'active'
        }
      });
    }

    return 0;
  };

  User.prototype.updateNotificationPreferences = async function (preferences) {
    const allowedFields = [
      'chatNotifications',
      'emailNotifications',
      'smsNotifications',
      'pushNotifications',
      'marketingEmails'
    ];

    allowedFields.forEach(field => {
      if (preferences.hasOwnProperty(field)) {
        this[field] = preferences[field];
      }
    });

    return await this.save();
  };

  User.prototype.startConversationWithStore = async function (storeId, initialMessage = '') {
    if (this.userType !== 'customer') {
      throw new Error('Only customers can start conversations with stores');
    }

    const { Chat } = sequelize.models;
    return await Chat.findOrCreate({
      where: {
        userId: this.id,
        storeId: storeId
      },
      defaults: {
        userId: this.id,
        storeId: storeId,
        lastMessageAt: new Date()
      }
    });
  };

  // Class methods
  User.findByEmail = function (email) {
    return this.scope('withPassword').findOne({
      where: { email: email.toLowerCase() }
    });
  };

  User.findByPhone = function (phoneNumber) {
    return this.findOne({
      where: { phoneNumber }
    });
  };

  User.findByEmailOrPhone = async function (identifier) {
    return await this.findOne({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { email: identifier.toLowerCase() },
          { phoneNumber: identifier }
        ]
      }
    });
  };

  User.getOnlineUsers = async function (userType = null) {
    let whereCondition = {
      isOnline: true,
      isActive: true
    };

    if (userType) {
      whereCondition.userType = userType;
    }

    return await this.findAll({
      where: whereCondition,
      attributes: ['id', 'firstName', 'lastName', 'avatar', 'userType', 'lastSeenAt']
    });
  };

  User.searchUsers = async function (query, options = {}) {
    const { limit = 50, userType = null, includeInactive = false } = options;

    let whereCondition = {
      [sequelize.Sequelize.Op.or]: [
        { firstName: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } },
        { lastName: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } },
        { email: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } }
      ]
    };

    if (!includeInactive) {
      whereCondition.isActive = true;
    }

    if (userType) {
      whereCondition.userType = userType;
    }

    return await this.findAll({
      where: whereCondition,
      attributes: ['id', 'firstName', 'lastName', 'email', 'avatar', 'userType', 'isActive'],
      limit
    });
  };

  User.prototype.getIsVerified = function () {
    // For Google sign-in users without phone, only check email verification
    if (!this.phoneNumber) {
      return this.isEmailVerified();
    }
    return this.isEmailVerified() && this.isPhoneVerified();
  };

  User.prototype.getAge = function () {
    if (!this.dateOfBirth) return null;
    return Math.floor((new Date() - new Date(this.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000));
  };

  User.prototype.getDisplayName = function () {
    return this.getFullName() || this.email.split('@')[0];
  };

  User.associate = function (models) {
    User.hasMany(models.Chat, {
      foreignKey: 'userId',
      as: 'chats',
      onDelete: 'CASCADE'
    });

    User.hasMany(models.Message, {
      foreignKey: 'sender_id',
      as: 'sentMessages',
      onDelete: 'CASCADE'
    });

    User.hasMany(models.Store, {
      foreignKey: 'merchant_id',
      as: 'stores',
      scope: {
        userType: 'merchant'
      },
      onDelete: 'CASCADE'
    });

    if (models.Order) {
      User.hasMany(models.Order, {
        foreignKey: 'userId',
        as: 'orders',
        onDelete: 'CASCADE'
      });
    }

    if (models.Follow) {
      User.hasMany(models.Follow, {
        foreignKey: 'user_id',
        as: 'follows',
        onDelete: 'CASCADE'
      });
    }

    if (models.Follow) {
      User.hasMany(models.Follow, {
        foreignKey: 'userId',
        as: 'following',
        onDelete: 'CASCADE'
      });
    }

    User.hasMany(models.User, {
      foreignKey: 'referredBy',
      as: 'referrals'
    });

    User.belongsTo(models.User, {
      foreignKey: 'referredBy',
      as: 'referrer'
    });

    User.hasMany(models.Favorite, {
      foreignKey: 'user_id',
      as: 'favorites',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    User.belongsToMany(models.Offer, {
      through: models.Favorite,
      foreignKey: 'user_id',
      otherKey: 'offer_id',
      as: 'favoriteOffers',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    if (models.Wishlist) {
      User.hasMany(models.Wishlist, {
        foreignKey: 'userId',
        as: 'wishlists',
        onDelete: 'CASCADE'
      });
    }
  };

  User.beforeSave(async (user) => {
    if (user.email) {
      user.email = user.email.toLowerCase().trim();
    }
    if (user.firstName) {
      user.firstName = user.firstName.trim();
    }
    if (user.lastName) {
      user.lastName = user.lastName.trim();
    }
  });

  return User;
};