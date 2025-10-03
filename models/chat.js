// models/Chat.js - Optimized with reduced indexes
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
        model: 'Users',
        key: 'id'
      },
      comment: 'Customer who is chatting with the store'
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Stores',
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
      // Unique constraint for one chat per customer-store pair
      {
        unique: true,
        fields: ['userId', 'storeId'],
        name: 'idx_chats_user_store_unique'
      },
      // Foreign key indexes
      {
        fields: ['userId'],
        name: 'idx_chats_user_id'
      },
      {
        fields: ['storeId'],
        name: 'idx_chats_store_id'
      },
      // Composite index for filtering store's active chats sorted by recency
      {
        fields: ['storeId', 'status', 'lastMessageAt'],
        name: 'idx_chats_store_status_recent'
      },
      // Composite index for priority filtering
      {
        fields: ['storeId', 'priority'],
        name: 'idx_chats_store_priority'
      }
    ]
  });

  Chat.associate = (models) => {
    Chat.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'chatUser',
      onDelete: 'CASCADE'
    });

    Chat.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store',
      onDelete: 'CASCADE'
    });

    Chat.hasMany(models.Message, {
      foreignKey: 'chat_id',
      as: 'messages',
      onDelete: 'CASCADE'
    });

    if (models.ChatAnalytics) {
      Chat.hasOne(models.ChatAnalytics, {
        foreignKey: 'chatId',
        as: 'analytics',
        onDelete: 'CASCADE'
      });
    }
  };

  Chat.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    values.participantType = 'customer_store';
    values.conversationType = 'customer_to_store';
    return values;
  };

  Chat.prototype.archive = async function() {
    this.status = 'archived';
    return await this.save();
  };

  Chat.prototype.block = async function() {
    this.status = 'blocked';
    return await this.save();
  };

  Chat.prototype.reactivate = async function() {
    this.status = 'active';
    return await this.save();
  };

  Chat.prototype.getUnreadCountForCustomer = async function() {
    const { Message } = sequelize.models;
    return await Message.count({
      where: {
        chat_id: this.id,
        sender_type: 'store',
        status: { [sequelize.Sequelize.Op.ne]: 'read' }
      }
    });
  };

  Chat.prototype.getUnreadCountForMerchant = async function() {
    const { Message } = sequelize.models;
    return await Message.count({
      where: {
        chat_id: this.id,
        sender_type: 'user',
        status: { [sequelize.Sequelize.Op.ne]: 'read' }
      }
    });
  };

  Chat.prototype.getMessageCount = async function() {
    const { Message } = sequelize.models;
    return await Message.count({
      where: { chat_id: this.id }
    });
  };

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

  Chat.prototype.updatePriority = async function(priority, merchantId) {
    const merchant = await this.getMerchant();
    if (!merchant || merchant.id !== merchantId) {
      throw new Error('Access denied: Merchant does not own this store');
    }
    
    this.priority = priority;
    return await this.save();
  };

  Chat.prototype.addTags = async function(tags, merchantId) {
    const merchant = await this.getMerchant();
    if (!merchant || merchant.id !== merchantId) {
      throw new Error('Access denied: Merchant does not own this store');
    }
    
    const currentTags = this.tags || [];
    const newTags = Array.isArray(tags) ? tags : [tags];
    this.tags = [...new Set([...currentTags, ...newTags])];
    
    return await this.save();
  };

  Chat.prototype.updateNotes = async function(notes, merchantId) {
    const merchant = await this.getMerchant();
    if (!merchant || merchant.id !== merchantId) {
      throw new Error('Access denied: Merchant does not own this store');
    }
    
    this.notes = notes;
    return await this.save();
  };

  Chat.findOrCreateCustomerStoreChat = async function(customerId, storeId) {
    const { Store } = sequelize.models;
    
    const store = await Store.findOne({
      where: { id: storeId, is_active: true }
    });
    
    if (!store) {
      throw new Error('Store not found or inactive');
    }
    
    let chat = await this.findOne({
      where: { userId: customerId, storeId: storeId }
    });
    
    if (!chat) {
      chat = await this.create({
        userId: customerId,
        storeId: storeId,
        lastMessageAt: new Date()
      });
    }
    
    return chat;
  };

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

  Chat.getCustomerConversationsForMerchant = async function(merchantId, options = {}) {
    const { limit = 50, offset = 0, status = 'active' } = options;
    const { Store } = sequelize.models;
    
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

  Chat.searchConversations = async function(query, searchOptions = {}) {
    const { 
      merchantId, 
      customerId, 
      storeId,
      searchType = 'all',
      limit = 50 
    } = searchOptions;

    let whereCondition = {};
    let includeConditions = [];

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