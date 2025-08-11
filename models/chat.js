// models/Chat.js - Customer↔Store Conversation Model
'use strict';

module.exports = (sequelize, DataTypes) => {
  const Chat = sequelize.define('Chat', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users', // Customer
        key: 'id'
      },
      comment: 'Customer who is chatting with the store'
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stores', // Store being contacted
        key: 'id'
      },
      comment: 'Store that the customer is chatting with'
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'blocked'),
      defaultValue: 'active',
      comment: 'Status of the customer↔store conversation'
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp of the last message in this conversation'
    },
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal',
      comment: 'Priority level set by merchant for this customer conversation'
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Tags added by merchant for organizing customer conversations'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Private notes by merchant about this customer conversation'
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Additional metadata for the customer↔store conversation'
    }
  }, {
    tableName: 'chats',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'storeId'],
        name: 'unique_customer_store_chat'
      },
      {
        fields: ['userId'],
        name: 'chats_customer_index'
      },
      {
        fields: ['storeId'],
        name: 'chats_store_index'
      },
      {
        fields: ['status'],
        name: 'chats_status_index'
      },
      {
        fields: ['lastMessageAt'],
        name: 'chats_last_message_index'
      },
      {
        fields: ['priority'],
        name: 'chats_priority_index'
      }
    ]
  });

  // Associations for Customer↔Store communication
  Chat.associate = (models) => {
    // Chat belongs to a Customer (User)
    Chat.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'chatUser', // The customer
      onDelete: 'CASCADE'
    });

    // Chat belongs to a Store
    Chat.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store', // The store being contacted
      onDelete: 'CASCADE'
    });

    // Chat has many Messages
    Chat.hasMany(models.Message, {
      foreignKey: 'chat_id',
      as: 'messages',
      onDelete: 'CASCADE'
    });

    // Additional associations for analytics
    if (models.ChatAnalytics) {
      Chat.hasOne(models.ChatAnalytics, {
        foreignKey: 'chatId',
        as: 'analytics',
        onDelete: 'CASCADE'
      });
    }
  };

  // Instance Methods
  Chat.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    
    // Add computed properties
    values.participantType = 'customer_store';
    values.conversationType = 'customer_to_store';
    
    return values;
  };

  // Archive this customer↔store conversation
  Chat.prototype.archive = async function() {
    this.status = 'archived';
    return await this.save();
  };

  // Block this customer↔store conversation
  Chat.prototype.block = async function() {
    this.status = 'blocked';
    return await this.save();
  };

  // Reactivate this customer↔store conversation
  Chat.prototype.reactivate = async function() {
    this.status = 'active';
    return await this.save();
  };

  // Get unread message count for customer
  Chat.prototype.getUnreadCountForCustomer = async function() {
    const { Message } = sequelize.models;
    return await Message.count({
      where: {
        chat_id: this.id,
        sender_type: 'store', // Messages from store to customer
        status: { [sequelize.Sequelize.Op.ne]: 'read' }
      }
    });
  };

  // Get unread message count for merchant (store owner)
  Chat.prototype.getUnreadCountForMerchant = async function() {
    const { Message } = sequelize.models;
    return await Message.count({
      where: {
        chat_id: this.id,
        sender_type: 'user', // Messages from customer to store
        status: { [sequelize.Sequelize.Op.ne]: 'read' }
      }
    });
  };

  // Get total message count
  Chat.prototype.getMessageCount = async function() {
    const { Message } = sequelize.models;
    return await Message.count({
      where: { chat_id: this.id }
    });
  };

  // Get merchant who owns the store in this conversation
  Chat.prototype.getMerchant = async function() {
    const { Store, Merchant } = sequelize.models;
    
    const store = await Store.findByPk(this.storeId, {
      include: [
        {
          model: Merchant,
          as: 'storeMerchant',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });
    
    return store ? store.storeMerchant : null;
  };

  // Update conversation priority (merchant only)
  Chat.prototype.updatePriority = async function(priority, merchantId) {
    // Verify merchant owns the store
    const merchant = await this.getMerchant();
    if (!merchant || merchant.id !== merchantId) {
      throw new Error('Access denied: Merchant does not own this store');
    }
    
    this.priority = priority;
    return await this.save();
  };

  // Add tags to conversation (merchant only)
  Chat.prototype.addTags = async function(tags, merchantId) {
    // Verify merchant owns the store
    const merchant = await this.getMerchant();
    if (!merchant || merchant.id !== merchantId) {
      throw new Error('Access denied: Merchant does not own this store');
    }
    
    const currentTags = this.tags || [];
    const newTags = Array.isArray(tags) ? tags : [tags];
    this.tags = [...new Set([...currentTags, ...newTags])];
    
    return await this.save();
  };

  // Update notes for conversation (merchant only)
  Chat.prototype.updateNotes = async function(notes, merchantId) {
    // Verify merchant owns the store
    const merchant = await this.getMerchant();
    if (!merchant || merchant.id !== merchantId) {
      throw new Error('Access denied: Merchant does not own this store');
    }
    
    this.notes = notes;
    return await this.save();
  };

  // Class Methods
  
  // Find or create customer↔store chat
  Chat.findOrCreateCustomerStoreChat = async function(customerId, storeId) {
    const { Store } = sequelize.models;
    
    // Verify store exists and is active
    const store = await Store.findOne({
      where: { id: storeId, is_active: true }
    });
    
    if (!store) {
      throw new Error('Store not found or inactive');
    }
    
    // Find existing chat
    let chat = await this.findOne({
      where: { userId: customerId, storeId: storeId }
    });
    
    // Create if doesn't exist
    if (!chat) {
      chat = await this.create({
        userId: customerId,
        storeId: storeId,
        lastMessageAt: new Date()
      });
    }
    
    return chat;
  };

  // Get customer conversations for a specific store
  Chat.getCustomerConversationsForStore = async function(storeId, options = {}) {
    const { limit = 50, offset = 0, status = 'active' } = options;
    
    return await this.findAll({
      where: { 
        storeId,
        status
      },
      include: [
        {
          model: sequelize.models.User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'email', 'createdAt']
        },
        {
          model: sequelize.models.Message,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          required: false
        }
      ],
      order: [['lastMessageAt', 'DESC']],
      limit,
      offset
    });
  };

  // Get customer conversations for merchant (across all their stores)
  Chat.getCustomerConversationsForMerchant = async function(merchantId, options = {}) {
    const { limit = 50, offset = 0, status = 'active' } = options;
    const { Store } = sequelize.models;
    
    // Get merchant's stores
    const merchantStores = await Store.findAll({
      where: { merchant_id: merchantId, is_active: true },
      attributes: ['id']
    });
    
    const storeIds = merchantStores.map(store => store.id);
    
    if (storeIds.length === 0) {
      return [];
    }
    
    return await this.findAll({
      where: { 
        storeId: { [sequelize.Sequelize.Op.in]: storeIds },
        status
      },
      include: [
        {
          model: sequelize.models.User,
          as: 'chatUser',
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'email', 'createdAt']
        },
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'logo_url', 'merchant_id']
        },
        {
          model: sequelize.models.Message,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          required: false
        }
      ],
      order: [['lastMessageAt', 'DESC']],
      limit,
      offset
    });
  };

  // Get store conversations for customer
  Chat.getStoreConversationsForCustomer = async function(customerId, options = {}) {
    const { limit = 50, offset = 0, status = 'active' } = options;
    
    return await this.findAll({
      where: { 
        userId: customerId,
        status
      },
      include: [
        {
          model: sequelize.models.Store,
          as: 'store',
          attributes: ['id', 'name', 'logo_url', 'category', 'location', 'merchant_id', 'isOnline'],
          where: { is_active: true }
        },
        {
          model: sequelize.models.Message,
          as: 'messages',
          limit: 1,
          order: [['createdAt', 'DESC']],
          required: false
        }
      ],
      order: [['lastMessageAt', 'DESC']],
      limit,
      offset
    });
  };

  // Search conversations
  Chat.searchConversations = async function(query, searchOptions = {}) {
    const { 
      merchantId, 
      customerId, 
      storeId,
      searchType = 'all', // 'customer_name', 'store_name', 'all'
      limit = 50 
    } = searchOptions;

    let whereCondition = {};
    let includeConditions = [];

    // Build search conditions
    if (merchantId) {
      const { Store } = sequelize.models;
      const merchantStores = await Store.findAll({
        where: { merchant_id: merchantId },
        attributes: ['id']
      });
      const storeIds = merchantStores.map(store => store.id);
      whereCondition.storeId = { [sequelize.Sequelize.Op.in]: storeIds };
    }

    if (customerId) {
      whereCondition.userId = customerId;
    }

    if (storeId) {
      whereCondition.storeId = storeId;
    }

    // Include models based on search type
    if (searchType === 'customer_name' || searchType === 'all') {
      includeConditions.push({
        model: sequelize.models.User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'avatar', 'email'],
        where: {
          [sequelize.Sequelize.Op.or]: [
            { firstName: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } },
            { lastName: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } },
            { email: { [sequelize.Sequelize.Op.iLike]: `%${query}%` } }
          ]
        }
      });
    }

    if (searchType === 'store_name' || searchType === 'all') {
      includeConditions.push({
        model: sequelize.models.Store,
        as: 'store',
        attributes: ['id', 'name', 'logo_url', 'category'],
        where: {
          name: { [sequelize.Sequelize.Op.iLike]: `%${query}%` }
        }
      });
    }

    return await this.findAll({
      where: whereCondition,
      include: includeConditions,
      order: [['lastMessageAt', 'DESC']],
      limit
    });
  };

  return Chat;
};