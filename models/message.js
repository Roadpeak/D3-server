// models/Message.js - Customer↔Store Message Model
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
        model: 'Chats',
        key: 'id'
      },
      comment: 'Customer↔Store conversation this message belongs to'
    },
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'ID of the actual sender (customer ID or merchant ID)'
    },
    sender_type: {
      type: DataTypes.ENUM('user', 'store'),
      allowNull: false,
      comment: 'Type of sender: "user" for customers, "store" for merchant replies as store'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [1, 2000],
        notEmpty: true
      },
      comment: 'Message content'
    },
    messageType: {
      type: DataTypes.ENUM('text', 'image', 'file', 'audio', 'video', 'location', 'contact', 'system'),
      defaultValue: 'text',
      comment: 'Type of message content'
    },
    status: {
      type: DataTypes.ENUM('sent', 'delivered', 'read', 'failed'),
      defaultValue: 'sent',
      comment: 'Message delivery status'
    },
    replyTo: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Messages',
        key: 'id'
      },
      comment: 'Message this is replying to (for threaded conversations)'
    },
    attachments: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of attachment objects (images, files, etc.)'
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {},
      comment: 'Additional message metadata (read receipts, etc.)'
    },
    isEdited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this message has been edited'
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the message was last edited'
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Soft delete flag'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the message was deleted'
    }
  }, {
    tableName: 'messages',
    timestamps: true,
    paranoid: true, // Enable soft deletes
    indexes: [
      {
        fields: ['chat_id'],
        name: 'messages_chat_index'
      },
      {
        fields: ['sender_id'],
        name: 'messages_sender_index'
      },
      {
        fields: ['sender_type'],
        name: 'messages_sender_type_index'
      },
      {
        fields: ['status'],
        name: 'messages_status_index'
      },
      {
        fields: ['messageType'],
        name: 'messages_type_index'
      },
      {
        fields: ['createdAt'],
        name: 'messages_created_index'
      },
      {
        fields: ['chat_id', 'createdAt'],
        name: 'messages_chat_created_index'
      },
      {
        fields: ['chat_id', 'sender_type', 'status'],
        name: 'messages_chat_sender_status_index'
      }
    ]
  });

  // Associations for Customer↔Store communication
  Message.associate = (models) => {
    // Message belongs to a Chat
    Message.belongsTo(models.Chat, {
      foreignKey: 'chat_id',
      as: 'chat',
      onDelete: 'CASCADE'
    });

    // Message has a sender (polymorphic - can be User or handled via sender_type)
    Message.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender',
      constraints: false,
      scope: {
        sender_type: 'user'
      }
    });

    // Self-referencing for reply functionality
    Message.belongsTo(models.Message, {
      foreignKey: 'replyTo',
      as: 'parentMessage',
      onDelete: 'SET NULL'
    });

    Message.hasMany(models.Message, {
      foreignKey: 'replyTo',
      as: 'replies',
      onDelete: 'SET NULL'
    });

    // Message analytics (if needed)
    if (models.MessageAnalytics) {
      Message.hasOne(models.MessageAnalytics, {
        foreignKey: 'messageId',
        as: 'analytics',
        onDelete: 'CASCADE'
      });
    }
  };

  // Instance Methods
  Message.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    
    // Add computed properties
    values.isSentByCustomer = values.sender_type === 'user';
    values.isSentByStore = values.sender_type === 'store';
    values.hasAttachments = values.attachments && values.attachments.length > 0;
    
    // Don't expose deleted messages content
    if (values.isDeleted) {
      values.content = '[Message deleted]';
      values.attachments = [];
    }
    
    return values;
  };

  // Mark message as read
  Message.prototype.markAsRead = async function() {
    if (this.status !== 'read') {
      this.status = 'read';
      return await this.save();
    }
    return this;
  };

  // Mark message as delivered
  Message.prototype.markAsDelivered = async function() {
    if (this.status === 'sent') {
      this.status = 'delivered';
      return await this.save();
    }
    return this;
  };

  // Edit message content
  Message.prototype.editContent = async function(newContent, editorId) {
    // Only sender can edit their own message
    if (this.sender_id !== editorId) {
      throw new Error('Only the sender can edit this message');
    }
    
    // Can't edit deleted messages
    if (this.isDeleted) {
      throw new Error('Cannot edit deleted message');
    }
    
    this.content = newContent.trim();
    this.isEdited = true;
    this.editedAt = new Date();
    
    return await this.save();
  };

  // Soft delete message
  Message.prototype.softDelete = async function(deleterId) {
    // Only sender can delete their own message
    if (this.sender_id !== deleterId) {
      throw new Error('Only the sender can delete this message');
    }
    
    this.isDeleted = true;
    this.deletedAt = new Date();
    
    return await this.save();
  };

  // Get message with sender info (handles customer↔store context)
  Message.prototype.getWithSenderInfo = async function() {
    const { User, Store, Chat } = sequelize.models;
    
    let senderInfo = null;
    
    if (this.sender_type === 'user') {
      // Customer message - get user info
      senderInfo = await User.findByPk(this.sender_id, {
        attributes: ['id', 'firstName', 'lastName', 'avatar', 'email']
      });
    } else if (this.sender_type === 'store') {
      // Store message - get store info (merchant responding as store)
      const chat = await Chat.findByPk(this.chat_id, {
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url', 'merchant_id']
          }
        ]
      });
      
      if (chat && chat.store) {
        senderInfo = {
          id: chat.store.id,
          name: chat.store.name,
          avatar: chat.store.logo_url,
          isStore: true,
          merchantId: chat.store.merchant_id
        };
      }
    }
    
    return {
      ...this.toJSON(),
      senderInfo
    };
  };

  // Class Methods

  // Create customer message to store
  Message.createCustomerMessage = async function(chatId, customerId, content, messageType = 'text') {
    // Verify this is a valid customer↔store chat
    const { Chat, Store } = sequelize.models;
    
    const chat = await Chat.findByPk(chatId, {
      include: [
        {
          model: Store,
          as: 'store',
          where: { is_active: true }
        }
      ]
    });
    
    if (!chat) {
      throw new Error('Chat not found or store is inactive');
    }
    
    if (chat.userId !== customerId) {
      throw new Error('Customer not authorized for this chat');
    }
    
    return await this.create({
      chat_id: chatId,
      sender_id: customerId,
      sender_type: 'user', // Customer message
      content: content.trim(),
      messageType,
      status: 'sent'
    });
  };

  // Create store message to customer (merchant responding as store)
  Message.createStoreMessage = async function(chatId, merchantId, content, messageType = 'text') {
    // Verify merchant owns the store in this chat
    const { Chat, Store } = sequelize.models;
    
    const chat = await Chat.findByPk(chatId, {
      include: [
        {
          model: Store,
          as: 'store',
          where: { 
            merchant_id: merchantId,
            is_active: true 
          }
        }
      ]
    });
    
    if (!chat) {
      throw new Error('Chat not found or merchant not authorized');
    }
    
    return await this.create({
      chat_id: chatId,
      sender_id: merchantId, // Merchant ID (but message type is 'store')
      sender_type: 'store', // Message sent as store
      content: content.trim(),
      messageType,
      status: 'sent'
    });
  };

  // Get messages for customer↔store chat
  Message.getMessagesForChat = async function(chatId, options = {}) {
    const { 
      limit = 50, 
      offset = 0, 
      before = null,
      includeDeleted = false 
    } = options;
    
    let whereCondition = { chat_id: chatId };
    
    if (!includeDeleted) {
      whereCondition.isDeleted = false;
    }
    
    if (before) {
      whereCondition.createdAt = {
        [sequelize.Sequelize.Op.lt]: new Date(before)
      };
    }
    
    return await this.findAll({
      where: whereCondition,
      include: [
        {
          model: sequelize.models.User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'avatar'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  };

  // Mark messages as read for customer↔store chat
  Message.markAsReadForChat = async function(chatId, readerId, readerType) {
    let whereCondition = {
      chat_id: chatId,
      sender_id: { [sequelize.Sequelize.Op.ne]: readerId },
      status: { [sequelize.Sequelize.Op.ne]: 'read' }
    };
    
    // Mark messages based on reader type
    if (readerType === 'customer') {
      // Customer reading store messages
      whereCondition.sender_type = 'store';
    } else if (readerType === 'merchant') {
      // Merchant reading customer messages
      whereCondition.sender_type = 'user';
    }
    
    return await this.update(
      { status: 'read' },
      { where: whereCondition }
    );
  };

  // Mark messages as delivered for customer↔store chat
  Message.markAsDeliveredForChat = async function(chatId, deliveredToId, deliveredToType) {
    let whereCondition = {
      chat_id: chatId,
      sender_id: { [sequelize.Sequelize.Op.ne]: deliveredToId },
      status: 'sent'
    };
    
    // Mark messages based on delivery target
    if (deliveredToType === 'customer') {
      // Delivering store messages to customer
      whereCondition.sender_type = 'store';
    } else if (deliveredToType === 'merchant') {
      // Delivering customer messages to merchant
      whereCondition.sender_type = 'user';
    }
    
    return await this.update(
      { status: 'delivered' },
      { where: whereCondition }
    );
  };

  // Get unread count for customer
  Message.getUnreadCountForCustomer = async function(customerId, chatId = null) {
    let whereCondition = {
      sender_type: 'store', // Messages from stores
      status: { [sequelize.Sequelize.Op.ne]: 'read' }
    };
    
    if (chatId) {
      whereCondition.chat_id = chatId;
    } else {
      // Count across all chats for this customer
      const { Chat } = sequelize.models;
      const customerChats = await Chat.findAll({
        where: { userId: customerId },
        attributes: ['id']
      });
      const chatIds = customerChats.map(chat => chat.id);
      whereCondition.chat_id = { [sequelize.Sequelize.Op.in]: chatIds };
    }
    
    return await this.count({ where: whereCondition });
  };

  // Get unread count for merchant
  Message.getUnreadCountForMerchant = async function(merchantId, storeId = null) {
    const { Store, Chat } = sequelize.models;
    
    let storeIds = [];
    
    if (storeId) {
      // Verify merchant owns this store
      const store = await Store.findOne({
        where: { id: storeId, merchant_id: merchantId }
      });
      if (store) storeIds = [storeId];
    } else {
      // Get all stores owned by merchant
      const merchantStores = await Store.findAll({
        where: { merchant_id: merchantId },
        attributes: ['id']
      });
      storeIds = merchantStores.map(store => store.id);
    }
    
    if (storeIds.length === 0) return 0;
    
    // Get chats for these stores
    const storeChats = await Chat.findAll({
      where: { storeId: { [sequelize.Sequelize.Op.in]: storeIds } },
      attributes: ['id']
    });
    const chatIds = storeChats.map(chat => chat.id);
    
    if (chatIds.length === 0) return 0;
    
    return await this.count({
      where: {
        chat_id: { [sequelize.Sequelize.Op.in]: chatIds },
        sender_type: 'user', // Messages from customers
        status: { [sequelize.Sequelize.Op.ne]: 'read' }
      }
    });
  };

  // Search messages in customer↔store chats
  Message.searchInChats = async function(query, searchOptions = {}) {
    const { 
      chatIds = [], 
      senderId = null,
      senderType = null,
      messageType = null,
      dateFrom = null,
      dateTo = null,
      limit = 50 
    } = searchOptions;

    let whereCondition = {
      content: { [sequelize.Sequelize.Op.iLike]: `%${query}%` },
      isDeleted: false
    };

    if (chatIds.length > 0) {
      whereCondition.chat_id = { [sequelize.Sequelize.Op.in]: chatIds };
    }

    if (senderId) {
      whereCondition.sender_id = senderId;
    }

    if (senderType) {
      whereCondition.sender_type = senderType;
    }

    if (messageType) {
      whereCondition.messageType = messageType;
    }

    if (dateFrom || dateTo) {
      whereCondition.createdAt = {};
      if (dateFrom) {
        whereCondition.createdAt[sequelize.Sequelize.Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        whereCondition.createdAt[sequelize.Sequelize.Op.lte] = new Date(dateTo);
      }
    }

    return await this.findAll({
      where: whereCondition,
      include: [
        {
          model: sequelize.models.Chat,
          as: 'chat',
          include: [
            {
              model: sequelize.models.User,
              as: 'user',
              attributes: ['id', 'firstName', 'lastName']
            },
            {
              model: sequelize.models.Store,
              as: 'store',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit
    });
  };

  return Message;
};