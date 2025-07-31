// models/Message.js - FIXED: Customer↔Store Message Model with Polymorphic Sender
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
      // REMOVED: Foreign key constraint - now polymorphic
      comment: 'ID of sender: customer ID (users.id) OR merchant ID (merchants.id) based on sender_type'
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
        fields: ['sender_type', 'sender_id'],
        name: 'messages_sender_type_id_index'
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
    ],
    // ADDED: Model validation to ensure sender_id exists in correct table
    validate: {
      validSender() {
        if (this.sender_type === 'user' && !this.sender_id) {
          throw new Error('sender_id is required for user messages');
        }
        if (this.sender_type === 'store' && !this.sender_id) {
          throw new Error('sender_id is required for store messages');
        }
      }
    }
  });

  // FIXED: Polymorphic associations for Customer↔Store communication
  Message.associate = (models) => {
    // Message belongs to a Chat
    Message.belongsTo(models.Chat, {
      foreignKey: 'chat_id',
      as: 'chat',
      onDelete: 'CASCADE'
    });

    // POLYMORPHIC: Message sender can be User OR Merchant
    // User sender (customers)
    Message.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'userSender',
      constraints: false, // No FK constraint - handled in validation
      scope: {
        sender_type: 'user'
      }
    });

    // Merchant sender (store messages)
    Message.belongsTo(models.Merchant, {
      foreignKey: 'sender_id',
      as: 'merchantSender',
      constraints: false, // No FK constraint - handled in validation
      scope: {
        sender_type: 'store'
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

  // ENHANCED: Instance Methods with sender validation
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

  // ENHANCED: Get message with proper sender info (polymorphic)
  Message.prototype.getWithSenderInfo = async function() {
    const { User, Merchant, Store, Chat } = sequelize.models;
    
    let senderInfo = null;
    
    if (this.sender_type === 'user') {
      // Customer message - get user info
      senderInfo = await User.findByPk(this.sender_id, {
        attributes: ['id', 'firstName', 'lastName', 'avatar', 'email']
      });
      
      if (senderInfo) {
        senderInfo = {
          id: senderInfo.id,
          name: `${senderInfo.firstName || ''} ${senderInfo.lastName || ''}`.trim(),
          avatar: senderInfo.avatar,
          email: senderInfo.email,
          type: 'customer'
        };
      }
    } else if (this.sender_type === 'store') {
      // Store message - get merchant info and store context
      const merchant = await Merchant.findByPk(this.sender_id);
      const chat = await Chat.findByPk(this.chat_id, {
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url', 'merchant_id']
          }
        ]
      });
      
      if (merchant && chat && chat.store) {
        senderInfo = {
          id: chat.store.id,
          name: chat.store.name,
          avatar: chat.store.logo_url,
          isStore: true,
          merchantId: merchant.id,
          merchantName: `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim(),
          type: 'store'
        };
      }
    }
    
    return {
      ...this.toJSON(),
      senderInfo
    };
  };

  // VALIDATION: Check if sender exists in correct table
  Message.prototype.validateSender = async function() {
    const { User, Merchant } = sequelize.models;
    
    if (this.sender_type === 'user') {
      const user = await User.findByPk(this.sender_id);
      if (!user) {
        throw new Error(`Customer with ID ${this.sender_id} not found`);
      }
      return user;
    } else if (this.sender_type === 'store') {
      const merchant = await Merchant.findByPk(this.sender_id);
      if (!merchant) {
        throw new Error(`Merchant with ID ${this.sender_id} not found`);
      }
      return merchant;
    }
    
    throw new Error(`Invalid sender_type: ${this.sender_type}`);
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
    
    if (this.isDeleted) {
      throw new Error('Cannot edit deleted message');
    }
    
    this.content = newContent.trim();
    this.isEdited = true;
    this.editedAt = new Date();
    
    return await this.save();
  };

  // ENHANCED: Class Methods with proper validation

  // Create customer message to store (sender_id = customer ID from users table)
  Message.createCustomerMessage = async function(chatId, customerId, content, messageType = 'text') {
    const { Chat, Store, User } = sequelize.models;
    
    // Validate customer exists
    const customer = await User.findByPk(customerId, {
      where: { userType: 'customer' } // Ensure it's a customer
    });
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }
    
    // Verify this is a valid customer↔store chat
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
      sender_id: customerId, // Customer ID (from users table)
      sender_type: 'user',
      content: content.trim(),
      messageType,
      status: 'sent'
    });
  };

  // Create store message to customer (sender_id = merchant ID from merchants table)
  Message.createStoreMessage = async function(chatId, merchantId, content, messageType = 'text') {
    const { Chat, Store, Merchant } = sequelize.models;
    
    // Validate merchant exists
    const merchant = await Merchant.findByPk(merchantId);
    if (!merchant) {
      throw new Error(`Merchant with ID ${merchantId} not found`);
    }
    
    // Verify merchant owns the store in this chat
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
      sender_id: merchantId, // Merchant ID (from merchants table)
      sender_type: 'store',
      content: content.trim(),
      messageType,
      status: 'sent'
    });
  };

  // Get messages with proper sender info
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
    
    const messages = await this.findAll({
      where: whereCondition,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    // Manually populate sender info for each message
    const messagesWithSenders = await Promise.all(
      messages.map(async (message) => {
        const messageWithSender = await message.getWithSenderInfo();
        return messageWithSender;
      })
    );

    return messagesWithSenders;
  };

  // Mark messages as read with polymorphic validation
  Message.markAsReadForChat = async function(chatId, readerId, readerType) {
    let whereCondition = {
      chat_id: chatId,
      status: { [sequelize.Sequelize.Op.ne]: 'read' }
    };
    
    // Mark messages based on reader type
    if (readerType === 'customer' || readerType === 'user') {
      // Customer reading store messages
      whereCondition.sender_type = 'store';
      whereCondition.sender_id = { [sequelize.Sequelize.Op.ne]: readerId };
    } else if (readerType === 'merchant') {
      // Merchant reading customer messages
      whereCondition.sender_type = 'user';
      // Don't exclude merchant's own messages since merchant can't send 'user' type messages
    }
    
    return await this.update(
      { status: 'read' },
      { where: whereCondition }
    );
  };

  // Get unread count for customer (messages FROM stores)
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

  // Get unread count for merchant (messages FROM customers)
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

  // BEFORE CREATE: Validate sender exists in correct table
  Message.beforeCreate(async (message) => {
    await message.validateSender();
  });

  // BEFORE UPDATE: Validate sender if changed
  Message.beforeUpdate(async (message) => {
    if (message.changed('sender_id') || message.changed('sender_type')) {
      await message.validateSender();
    }
  });

  return Message;
};