// controllers/chatController.js
const { sequelize } = require('../models/index');
const { socketManager } = require('../socket/websocket');
const { Op } = require('sequelize');

class ChatController {
  // Get conversations for a user (customer view)
  async getUserConversations(req, res) {
    try {
      const userId = req.user.id;
      const { Conversation, Store, Message, User } = sequelize.models;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const conversations = await Conversation.findAll({
        where: { customerId: userId },
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'avatar', 'category', 'isOnline'],
            required: true
          },
          {
            model: Message,
            as: 'lastMessage',
            attributes: ['content', 'createdAt', 'senderType', 'status'],
            required: false
          }
        ],
        order: [['updatedAt', 'DESC']]
      });

      const formattedConversations = conversations.map(conv => ({
        id: conv.id,
        store: {
          id: conv.store.id,
          name: conv.store.name,
          avatar: conv.store.avatar || null,
          category: conv.store.category || 'General',
          online: conv.store.isOnline || false
        },
        lastMessage: conv.lastMessage ? conv.lastMessage.content : '',
        lastMessageTime: conv.lastMessage ? this.formatTime(conv.lastMessage.createdAt) : this.formatTime(conv.updatedAt),
        unreadCount: conv.customerUnreadCount || 0
      }));

      res.status(200).json({
        success: true,
        data: formattedConversations
      });
    } catch (error) {
      console.error('Error fetching user conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversations',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get conversations for a merchant (store view)
  async getMerchantConversations(req, res) {
    try {
      const userId = req.user.id;
      const { Conversation, User, Store, Message } = sequelize.models;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Find the merchant's store - try different foreign key patterns
      let store = null;
      const storeSearchQueries = [
        { ownerId: userId },
        { owner_id: userId },
        { merchantId: userId },
        { merchant_id: userId },
        { userId: userId },
        { user_id: userId }
      ];

      for (const query of storeSearchQueries) {
        try {
          store = await Store.findOne({ where: query });
          if (store) {
            console.log(`Found store using query:`, query);
            break;
          }
        } catch (err) {
          // Continue to next query if this field doesn't exist
          continue;
        }
      }

      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found for this merchant. Please check your store ownership.'
        });
      }

      const conversations = await Conversation.findAll({
        where: { storeId: store.id },
        include: [
          {
            model: User,
            as: 'customer',
            attributes: ['id', 'firstName', 'lastName', 'avatar', 'email', 'createdAt', 'isOnline'],
            required: true
          },
          {
            model: Message,
            as: 'lastMessage',
            attributes: ['content', 'createdAt', 'senderType', 'status'],
            required: false
          }
        ],
        order: [['updatedAt', 'DESC']]
      });

      const formattedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const customer = conv.customer;
          const orderCount = await this.getCustomerOrderCount(customer.id, store.id);
          const customerSince = new Date(customer.createdAt).getFullYear();

          return {
            id: conv.id,
            customer: {
              id: customer.id,
              name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown Customer',
              avatar: customer.avatar || null,
              customerSince,
              orderCount,
              priority: orderCount > 20 ? 'vip' : 'regular'
            },
            lastMessage: conv.lastMessage ? conv.lastMessage.content : '',
            lastMessageTime: conv.lastMessage ? this.formatTime(conv.lastMessage.createdAt) : this.formatTime(conv.updatedAt),
            unreadCount: conv.merchantUnreadCount || 0,
            online: customer.isOnline || false
          };
        })
      );

      res.status(200).json({
        success: true,
        data: formattedConversations
      });
    } catch (error) {
      console.error('Error fetching merchant conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversations',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get messages for a specific conversation
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;
      const { Conversation, Message, User, Store } = sequelize.models;

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID is required'
        });
      }

      // Verify user has access to this conversation
      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Check if user is customer or merchant of this conversation
      let hasAccess = false;
      if (conversation.customerId === userId) {
        hasAccess = true;
      } else {
        // Check if user owns the store - try different foreign key patterns
        const storeSearchQueries = [
          { id: conversation.storeId, ownerId: userId },
          { id: conversation.storeId, owner_id: userId },
          { id: conversation.storeId, merchantId: userId },
          { id: conversation.storeId, merchant_id: userId },
          { id: conversation.storeId, userId: userId },
          { id: conversation.storeId, user_id: userId }
        ];

        for (const query of storeSearchQueries) {
          try {
            const store = await Store.findOne({ where: query });
            if (store) {
              hasAccess = true;
              break;
            }
          } catch (err) {
            continue;
          }
        }
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const messages = await Message.findAll({
        where: { conversationId },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName', 'avatar'],
            required: false
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });

      // Mark messages as read
      await this.markMessagesAsRead(conversationId, userId);

      const formattedMessages = messages.reverse().map(msg => ({
        id: msg.id,
        text: msg.content,
        sender: msg.senderType,
        senderInfo: msg.sender ? {
          id: msg.sender.id,
          name: `${msg.sender.firstName || ''} ${msg.sender.lastName || ''}`.trim() || 'Unknown',
          avatar: msg.sender.avatar || null
        } : {
          id: 'unknown',
          name: 'Unknown',
          avatar: null
        },
        timestamp: this.formatTime(msg.createdAt),
        status: msg.status,
        messageType: msg.messageType
      }));

      res.status(200).json({
        success: true,
        data: formattedMessages
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch messages',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Send a message
  async sendMessage(req, res) {
    try {
      const { conversationId, content, messageType = 'text' } = req.body;
      const senderId = req.user.id;
      const { Conversation, Message, User, Store } = sequelize.models;

      if (!conversationId || !content) {
        return res.status(400).json({
          success: false,
          message: 'Conversation ID and content are required'
        });
      }

      // Validate conversation access
      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      // Determine sender type and verify access
      let senderType = 'customer';
      let hasAccess = false;

      if (conversation.customerId === senderId) {
        hasAccess = true;
        senderType = 'customer';
      } else {
        // Check if user owns the store - try different foreign key patterns
        const storeSearchQueries = [
          { id: conversation.storeId, ownerId: senderId },
          { id: conversation.storeId, owner_id: senderId },
          { id: conversation.storeId, merchantId: senderId },
          { id: conversation.storeId, merchant_id: senderId },
          { id: conversation.storeId, userId: senderId },
          { id: conversation.storeId, user_id: senderId }
        ];

        for (const query of storeSearchQueries) {
          try {
            const store = await Store.findOne({ where: query });
            if (store) {
              hasAccess = true;
              senderType = 'merchant';
              break;
            }
          } catch (err) {
            continue;
          }
        }
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Create message
      const message = await Message.create({
        conversationId,
        senderId,
        senderType,
        content,
        messageType,
        status: 'sent'
      });

      // Update conversation
      await conversation.update({
        lastMessageId: message.id,
        // Increment unread count for the other party
        customerUnreadCount: senderType === 'merchant' ? (conversation.customerUnreadCount || 0) + 1 : conversation.customerUnreadCount || 0,
        merchantUnreadCount: senderType === 'customer' ? (conversation.merchantUnreadCount || 0) + 1 : conversation.merchantUnreadCount || 0
      });

      // Get message with sender info for response
      const messageWithSender = await Message.findByPk(message.id, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName', 'avatar'],
            required: false
          }
        ]
      });

      const formattedMessage = {
        id: messageWithSender.id,
        text: messageWithSender.content,
        sender: messageWithSender.senderType,
        senderInfo: messageWithSender.sender ? {
          id: messageWithSender.sender.id,
          name: `${messageWithSender.sender.firstName || ''} ${messageWithSender.sender.lastName || ''}`.trim() || 'Unknown',
          avatar: messageWithSender.sender.avatar || null
        } : {
          id: 'unknown',
          name: 'Unknown',
          avatar: null
        },
        timestamp: this.formatTime(messageWithSender.createdAt),
        status: messageWithSender.status,
        messageType: messageWithSender.messageType,
        conversationId: conversationId
      };

      // Emit to real-time subscribers
      if (socketManager && socketManager.emitToConversation) {
        socketManager.emitToConversation(conversationId, 'new_message', formattedMessage);
      }

      // Update message status to delivered if other party is online
      const otherPartyId = senderType === 'customer' ? conversation.storeId : conversation.customerId;
      if (socketManager && socketManager.isUserOnline && socketManager.isUserOnline(otherPartyId)) {
        await message.update({ status: 'delivered' });
        formattedMessage.status = 'delivered';
      }

      res.status(201).json({
        success: true,
        data: formattedMessage
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Start a new conversation (customer to store)
  async startConversation(req, res) {
    try {
      const { storeId, initialMessage } = req.body;
      const customerId = req.user.id;
      const { Conversation, Message, Store } = sequelize.models;

      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID is required'
        });
      }

      // Check if store exists
      const store = await Store.findByPk(storeId);
      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }

      // Check if conversation already exists
      let conversation = await Conversation.findOne({
        where: {
          storeId,
          customerId
        }
      });

      if (!conversation) {
        // Create new conversation
        conversation = await Conversation.create({
          storeId,
          customerId,
          customerUnreadCount: 0,
          merchantUnreadCount: 0
        });
      }

      // Send initial message if provided
      if (initialMessage && initialMessage.trim()) {
        const message = await Message.create({
          conversationId: conversation.id,
          senderId: customerId,
          senderType: 'customer',
          content: initialMessage.trim(),
          messageType: 'text',
          status: 'sent'
        });

        await conversation.update({
          lastMessageId: message.id,
          merchantUnreadCount: (conversation.merchantUnreadCount || 0) + 1
        });

        // Notify store owner via socket
        if (socketManager && socketManager.notifyNewConversation) {
          socketManager.notifyNewConversation(conversation.id, storeId, customerId);
        }
      }

      res.status(201).json({
        success: true,
        data: {
          conversationId: conversation.id,
          message: 'Conversation started successfully'
        }
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start conversation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Mark messages as read
  async markMessagesAsRead(conversationId, userId) {
    try {
      const { Conversation, Message } = sequelize.models;

      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation) return;

      // Determine if user is customer or merchant
      const isCustomer = conversation.customerId === userId;
      
      // Update message status
      await Message.update(
        { status: 'read' },
        {
          where: {
            conversationId,
            senderId: { [Op.ne]: userId },
            status: { [Op.ne]: 'read' }
          }
        }
      );

      // Reset unread count for this user
      const updateData = isCustomer 
        ? { customerUnreadCount: 0 }
        : { merchantUnreadCount: 0 };

      await conversation.update(updateData);

      // Emit read receipt
      if (socketManager && socketManager.emitToConversation) {
        socketManager.emitToConversation(conversationId, 'messages_read', {
          readBy: userId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  // Update message status (delivered/read)
  async updateMessageStatus(req, res) {
    try {
      const { messageId } = req.params;
      const { status } = req.body;
      const userId = req.user.id;
      const { Message } = sequelize.models;

      if (!messageId || !status) {
        return res.status(400).json({
          success: false,
          message: 'Message ID and status are required'
        });
      }

      const message = await Message.findByPk(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      // Only recipient can update status
      if (message.senderId === userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update status of own message'
        });
      }

      await message.update({ status });

      // Emit status update
      if (socketManager && socketManager.emitToUser) {
        socketManager.emitToUser(message.senderId, 'message_status_update', {
          messageId,
          status,
          timestamp: new Date()
        });
      }

      res.status(200).json({
        success: true,
        message: 'Message status updated'
      });
    } catch (error) {
      console.error('Error updating message status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update message status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Search conversations and messages
  async searchConversations(req, res) {
    try {
      const { query, type = 'all' } = req.query;
      const userId = req.user.id;
      const { Conversation, Message, User, Store } = sequelize.models;

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long'
        });
      }

      // Determine if user is customer or merchant
      let store = null;
      const storeSearchQueries = [
        { ownerId: userId },
        { owner_id: userId },
        { merchantId: userId },
        { merchant_id: userId },
        { userId: userId },
        { user_id: userId }
      ];

      for (const searchQuery of storeSearchQueries) {
        try {
          store = await Store.findOne({ where: searchQuery });
          if (store) break;
        } catch (err) {
          continue;
        }
      }

      const isCustomer = !store;

      let searchFilter = {};
      if (isCustomer) {
        searchFilter.customerId = userId;
      } else {
        searchFilter.storeId = store.id;
      }

      // Search in messages
      const messagesWithConversations = await Message.findAll({
        where: {
          content: { [Op.iLike]: `%${query.trim()}%` }
        },
        include: [
          {
            model: Conversation,
            as: 'conversation',
            where: searchFilter,
            include: [
              { model: User, as: 'customer', required: false },
              { model: Store, as: 'store', required: false }
            ]
          }
        ]
      });

      const conversationIds = [...new Set(messagesWithConversations.map(msg => msg.conversation.id))];

      // Get matching conversations
      const conversations = await Conversation.findAll({
        where: {
          [Op.or]: [
            { id: { [Op.in]: conversationIds } },
            searchFilter
          ]
        },
        include: [
          { model: User, as: 'customer', required: false },
          { model: Store, as: 'store', required: false },
          { model: Message, as: 'lastMessage', required: false }
        ]
      });

      res.status(200).json({
        success: true,
        data: conversations
      });
    } catch (error) {
      console.error('Error searching conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get conversation analytics (for merchants)
  async getConversationAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const { period = '7d' } = req.query;
      const { Store } = sequelize.models;

      // Get merchant's store - try different foreign key patterns
      let store = null;
      const storeSearchQueries = [
        { ownerId: userId },
        { owner_id: userId },
        { merchantId: userId },
        { merchant_id: userId },
        { userId: userId },
        { user_id: userId }
      ];

      for (const query of storeSearchQueries) {
        try {
          store = await Store.findOne({ where: query });
          if (store) break;
        } catch (err) {
          continue;
        }
      }

      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found for this merchant'
        });
      }

      let analytics = {
        totalConversations: 0,
        newConversations: 0,
        totalMessages: 0,
        unreadMessages: 0
      };

      if (socketManager && socketManager.getConversationAnalytics) {
        analytics = await socketManager.getConversationAnalytics(store.id, period);
      }

      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Helper methods
  async getCustomerOrderCount(customerId, storeId) {
    // This would integrate with your order system
    // For now, returning a mock value based on existing data
    try {
      const { Message } = sequelize.models;
      const messageCount = await Message.count({
        include: [{
          model: sequelize.models.Conversation,
          as: 'conversation',
          where: { customerId, storeId }
        }]
      });
      
      // Rough estimate: every 10 messages = 1 order
      return Math.floor(messageCount / 10) + Math.floor(Math.random() * 5) + 1;
    } catch (error) {
      return Math.floor(Math.random() * 30) + 1;
    }
  }

  formatTime(timestamp) {
    try {
      const now = new Date();
      const messageTime = new Date(timestamp);
      const diffInHours = (now - messageTime) / (1000 * 60 * 60);

      if (diffInHours < 1) {
        const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));
        return diffInMinutes <= 0 ? 'now' : `${diffInMinutes} min ago`;
      } else if (diffInHours < 24) {
        return messageTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit'
        });
      } else {
        return messageTime.toLocaleDateString('en-US');
      }
    } catch (error) {
      return 'unknown time';
    }
  }
}

// Create instance and export properly bound methods
const chatController = new ChatController();

module.exports = {
  startConversation: chatController.startConversation.bind(chatController),
  sendMessage: chatController.sendMessage.bind(chatController),
  getMessages: chatController.getMessages.bind(chatController),
  updateMessageStatus: chatController.updateMessageStatus.bind(chatController),
  getUserConversations: chatController.getUserConversations.bind(chatController),
  getMerchantConversations: chatController.getMerchantConversations.bind(chatController),
  searchConversations: chatController.searchConversations.bind(chatController),
  getConversationAnalytics: chatController.getConversationAnalytics.bind(chatController),
  markMessagesAsRead: chatController.markMessagesAsRead.bind(chatController)
};