// models/Merchant.js - Enhanced for Customer↔Store Communication
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Merchant = sequelize.define('Merchant', {
    id: {
      type: DataTypes.UUID,
      defaultValue: uuidv4,
      primaryKey: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'first_name' // Map to snake_case if your DB uses it
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'last_name'
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
      unique: true,
      field: 'email_address' // Map to your actual DB field name
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'phone_number'
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Additional fields for enhanced merchant functionality
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Merchant profile picture URL'
    },
    businessName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'business_name',
      comment: 'Name of the merchant business'
    },
    businessType: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'business_type',
      comment: 'Type of business (retail, service, etc.)'
    },
    businessAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'business_address',
      comment: 'Business address'
    },
    taxId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'tax_id',
      comment: 'Business tax identification number'
    },
    verificationStatus: {
      type: DataTypes.ENUM('pending', 'verified', 'rejected'),
      defaultValue: 'pending',
      field: 'verification_status',
      comment: 'Merchant verification status'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
      comment: 'Whether merchant account is active'
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at',
      comment: 'Last login timestamp'
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'email_verified',
      comment: 'Whether email is verified'
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'phone_verified',
      comment: 'Whether phone is verified'
    },
    // Chat system related fields
    isOnline: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_online',
      comment: 'Real-time online status for chat system'
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_seen_at',
      comment: 'Last seen timestamp for chat system'
    },
    chatNotifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'chat_notifications',
      comment: 'Whether to receive chat notifications'
    },
    emailNotifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'email_notifications',
      comment: 'Whether to receive email notifications'
    },
    smsNotifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'sms_notifications',
      comment: 'Whether to receive SMS notifications'
    }
  }, {
    tableName: 'merchants',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['email_address'],
        name: 'merchants_email_unique'
      },
      {
        unique: true,
        fields: ['phone_number'],
        name: 'merchants_phone_unique'
      },
      {
        fields: ['verification_status'],
        name: 'merchants_verification_status_index'
      },
      {
        fields: ['is_active'],
        name: 'merchants_is_active_index'
      },
      {
        fields: ['is_online'],
        name: 'merchants_is_online_index'
      },
      {
        fields: ['business_type'],
        name: 'merchants_business_type_index'
      }
    ]
  });

  // Pre-hooks for validation and password hashing
  Merchant.beforeCreate(async (merchant) => {
    const existingMerchant = await Merchant.findOne({ 
      where: { email: merchant.email } 
    });
    if (existingMerchant) {
      throw new Error('Merchant with this email already exists');
    }

    const existingPhone = await Merchant.findOne({ 
      where: { phoneNumber: merchant.phoneNumber } 
    });
    if (existingPhone) {
      throw new Error('Merchant with this phone number already exists');
    }

    if (merchant.password) {
      const hashedPassword = await bcrypt.hash(merchant.password, 10);
      merchant.password = hashedPassword;
    }
  });

  Merchant.beforeUpdate(async (merchant) => {
    if (merchant.changed('password') && merchant.password) {
      const hashedPassword = await bcrypt.hash(merchant.password, 10);
      merchant.password = hashedPassword;
    }
  });

  // Enhanced Associations for Customer↔Store Communication
  Merchant.associate = (models) => {
    // Merchant owns multiple stores
    Merchant.hasMany(models.Store, {
      foreignKey: 'merchant_id',
      as: 'stores',
      onDelete: 'CASCADE',
    });

    // Alternative association names for backward compatibility
    Merchant.hasMany(models.Store, {
      foreignKey: 'merchant_id',
      as: 'ownedStores',
      onDelete: 'CASCADE',
    });

    Merchant.hasMany(models.Store, {
      foreignKey: 'created_by',
      as: 'createdStores',
      onDelete: 'SET NULL',
    });

    Merchant.hasMany(models.Store, {
      foreignKey: 'updated_by',
      as: 'updatedStores',
      onDelete: 'SET NULL',
    });

    // If you have other merchant-related models
    if (models.MerchantProfile) {
      Merchant.hasOne(models.MerchantProfile, {
        foreignKey: 'merchantId',
        as: 'profile',
        onDelete: 'CASCADE'
      });
    }

    if (models.BusinessDocument) {
      Merchant.hasMany(models.BusinessDocument, {
        foreignKey: 'merchantId',
        as: 'documents',
        onDelete: 'CASCADE'
      });
    }

    if (models.PaymentMethod) {
      Merchant.hasMany(models.PaymentMethod, {
        foreignKey: 'merchantId',
        as: 'paymentMethods',
        onDelete: 'CASCADE'
      });
    }

    // Analytics associations
    if (models.MerchantAnalytics) {
      Merchant.hasOne(models.MerchantAnalytics, {
        foreignKey: 'merchantId',
        as: 'analytics',
        onDelete: 'CASCADE'
      });
    }
  };

  // Instance Methods
  Merchant.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());
    
    // Remove sensitive information
    delete values.password;
    
    // Add computed properties
    values.fullName = `${values.firstName || ''} ${values.lastName || ''}`.trim();
    values.displayName = values.businessName || values.fullName;
    values.isVerified = values.verificationStatus === 'verified';
    
    return values;
  };

  // Password validation
  Merchant.prototype.validPassword = async function (password) {
    return bcrypt.compare(password, this.password);
  };

  // Update online status for chat system
  Merchant.prototype.updateOnlineStatus = async function(isOnline) {
    this.isOnline = isOnline;
    this.lastSeenAt = isOnline ? null : new Date();
    
    // Update all store online statuses
    if (this.stores) {
      await Promise.all(
        this.stores.map(store => 
          store.update({ isOnline, lastSeen: this.lastSeenAt })
        )
      );
    }
    
    return await this.save();
  };

  // Get merchant's customer conversations across all stores
  Merchant.prototype.getCustomerConversations = async function(options = {}) {
    const { Chat } = sequelize.models;
    return await Chat.getCustomerConversationsForMerchant(this.id, options);
  };

  // Get unread customer messages count across all stores
  Merchant.prototype.getUnreadCustomerMessagesCount = async function() {
    const { Message } = sequelize.models;
    return await Message.getUnreadCountForMerchant(this.id);
  };

  // Get total stores count
  Merchant.prototype.getStoresCount = async function() {
    const { Store } = sequelize.models;
    return await Store.count({
      where: { 
        merchant_id: this.id,
        is_active: true 
      }
    });
  };

  // Get active conversations count across all stores
  Merchant.prototype.getActiveConversationsCount = async function() {
    const { Chat, Store } = sequelize.models;
    
    const stores = await Store.findAll({
      where: { merchant_id: this.id },
      attributes: ['id']
    });
    
    const storeIds = stores.map(store => store.id);
    
    return await Chat.count({
      where: { 
        storeId: { [sequelize.Sequelize.Op.in]: storeIds },
        status: 'active'
      }
    });
  };

  // Get merchant dashboard stats for customer↔store communication
  Merchant.prototype.getChatDashboardStats = async function() {
    const [
      storesCount,
      activeConversations,
      unreadMessages,
      totalCustomers
    ] = await Promise.all([
      this.getStoresCount(),
      this.getActiveConversationsCount(),
      this.getUnreadCustomerMessagesCount(),
      this.getTotalCustomersCount()
    ]);

    return {
      storesCount,
      activeConversations,
      unreadMessages,
      totalCustomers,
      isOnline: this.isOnline,
      lastSeenAt: this.lastSeenAt
    };
  };

  // Get total unique customers across all stores
  Merchant.prototype.getTotalCustomersCount = async function() {
    const { Chat, Store } = sequelize.models;
    
    const stores = await Store.findAll({
      where: { merchant_id: this.id },
      attributes: ['id']
    });
    
    const storeIds = stores.map(store => store.id);
    
    if (storeIds.length === 0) return 0;
    
    const result = await Chat.findAll({
      where: { 
        storeId: { [sequelize.Sequelize.Op.in]: storeIds }
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('userId'))), 'count']
      ],
      raw: true
    });
    
    return result[0]?.count || 0;
  };

  // Get stores with their chat statistics
  Merchant.prototype.getStoresWithChatStats = async function() {
    const { Store, Chat, Message } = sequelize.models;
    
    const stores = await Store.findAll({
      where: { 
        merchant_id: this.id,
        is_active: true 
      },
      include: [
        {
          model: Chat,
          as: 'chats',
          include: [
            {
              model: Message,
              as: 'messages',
              where: {
                sender_type: 'user', // Customer messages
                status: { [sequelize.Sequelize.Op.ne]: 'read' }
              },
              required: false
            }
          ]
        }
      ]
    });
    
    return stores.map(store => ({
      ...store.toJSON(),
      stats: {
        totalChats: store.chats ? store.chats.length : 0,
        unreadMessages: store.chats ? 
          store.chats.reduce((sum, chat) => sum + (chat.messages ? chat.messages.length : 0), 0) : 0
      }
    }));
  };

  // Update notification preferences
  Merchant.prototype.updateNotificationPreferences = async function(preferences) {
    const allowedFields = ['chatNotifications', 'emailNotifications', 'smsNotifications'];
    
    allowedFields.forEach(field => {
      if (preferences.hasOwnProperty(field)) {
        this[field] = preferences[field];
      }
    });
    
    return await this.save();
  };

  // Class Methods
  
  // Find merchant by email or phone
  Merchant.findByEmailOrPhone = async function(identifier) {
    return await this.findOne({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { email: identifier },
          { phoneNumber: identifier }
        ]
      }
    });
  };

  // Get online merchants
  Merchant.getOnlineMerchants = async function() {
    return await this.findAll({
      where: {
        isOnline: true,
        isActive: true
      },
      attributes: ['id', 'firstName', 'lastName', 'businessName', 'lastSeenAt'],
      include: [
        {
          model: sequelize.models.Store,
          as: 'stores',
          where: { is_active: true },
          attributes: ['id', 'name'],
          required: false
        }
      ]
    });
  };

  // Search merchants
  Merchant.searchMerchants = async function(query, options = {}) {
    const { limit = 50, includeInactive = false } = options;
    
    let whereCondition = {
      [sequelize.Sequelize.Op.or]: [
        { firstName: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } },
        { lastName: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } },
        { businessName: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } },
        { email: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } }
      ]
    };
    
    if (!includeInactive) {
      whereCondition.isActive = true;
    }
    
    return await this.findAll({
      where: whereCondition,
      attributes: ['id', 'firstName', 'lastName', 'businessName', 'email', 'verificationStatus'],
      limit
    });
  };

  // Get merchants with most customer conversations
  Merchant.getTopMerchantsByConversations = async function(limit = 10) {
    const { Store, Chat } = sequelize.models;
    
    return await this.findAll({
      attributes: [
        'id',
        'firstName', 
        'lastName', 
        'businessName',
        [sequelize.fn('COUNT', sequelize.col('stores->chats.id')), 'conversationCount']
      ],
      include: [
        {
          model: Store,
          as: 'stores',
          attributes: [],
          include: [
            {
              model: Chat,
              as: 'chats',
              attributes: [],
              where: { status: 'active' },
              required: false
            }
          ]
        }
      ],
      group: ['Merchant.id'],
      order: [[sequelize.literal('conversationCount'), 'DESC']],
      limit
    });
  };

  // Verify merchant account
  Merchant.prototype.verify = async function() {
    this.verificationStatus = 'verified';
    this.emailVerified = true;
    return await this.save();
  };

  // Reject merchant verification
  Merchant.prototype.reject = async function() {
    this.verificationStatus = 'rejected';
    return await this.save();
  };

  // Deactivate merchant account
  Merchant.prototype.deactivate = async function() {
    this.isActive = false;
    this.isOnline = false;
    
    // Update all stores to offline
    const { Store } = sequelize.models;
    await Store.update(
      { isOnline: false },
      { where: { merchant_id: this.id } }
    );
    
    return await this.save();
  };

  // Reactivate merchant account
  Merchant.prototype.reactivate = async function() {
    this.isActive = true;
    return await this.save();
  };

  return Merchant;
};