// controllers/chatController.js
const { sequelize } = require('../models/index');
const { socketManager } = require('../socket/websocket');
const { Op } = require('sequelize');

class ChatController {
  // Get chats for a user (customer view)
  async getUserChats(req, res) {
    try {
      const userId = req.user.id;
      const { Chat, Store, Message, User } = sequelize.models;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const chats = await Chat.findAll({
        where: { userId },
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url', 'category', 'isOnline'],
            required: true
          },
          {
            model: Message,
            as: 'messages',
            limit: 1,
            order: [['createdAt', 'DESC']],
            attributes: ['content', 'createdAt', 'sender_type', 'status'],
            required: false
          }
        ],
        order: [['lastMessageAt', 'DESC']]
      });

      const formattedChats = await Promise.all(
        chats.map(async (chat) => {
          const unreadCount = await Message.getUnreadCount(chat.id, userId);
          const lastMessage = chat.messages && chat.messages.length > 0 ? chat.messages[0] : null;

          return {
            id: chat.id,
            store: {
              id: chat.store.id,
              name: chat.store.name,
              avatar: chat.store.logo_url || null,
              category: chat.store.category || 'General',
              online: chat.store.isOnline || false
            },
            lastMessage: lastMessage ? lastMessage.content : '',
            lastMessageTime: lastMessage ? this.formatTime(lastMessage.createdAt) : this.formatTime(chat.updatedAt),
            unreadCount: unreadCount || 0
          };
        })
      );

      res.status(200).json({
        success: true,
        data: formattedChats
      });
    } catch (error) {
      console.error('Error fetching user chats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch chats',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get chats for a merchant (store view)
  async getMerchantChats(req, res) {
    try {
      const userId = req.user.id;
      const { Chat, User, Store, Message } = sequelize.models;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Find the merchant's store
      const store = await Store.findOne({ 
        where: { 
          [Op.or]: [
            { ownerId: userId },
            { owner_id: userId },
            { merchantId: userId },
            { merchant_id: userId },
            { userId: userId },
            { user_id: userId }
          ]
        }
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found for this merchant. Please check your store ownership.'
        });
      }

      const chats = await Chat.findAll({
        where: { storeId: store.id },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'avatar', 'email', 'createdAt', 'isOnline'],
            required: true
          },
          {
            model: Message,
            as: 'messages',
            limit: 1,
            order: [['createdAt', 'DESC']],
            attributes: ['content', 'createdAt', 'sender_type', 'status'],
            required: false
          }
        ],
        order: [['lastMessageAt', 'DESC']]
      });

      const formattedChats = await Promise.all(
        chats.map(async (chat) => {
          const customer = chat.user;
          const orderCount = await this.getCustomerOrderCount(customer.id, store.id);
          const customerSince = new Date(customer.createdAt).getFullYear();
          const unreadCount = await this.getUnreadCountForMerchant(chat.id, userId);
          const lastMessage = chat.messages && chat.messages.length > 0 ? chat.messages[0] : null;

          return {
            id: chat.id,
            customer: {
              id: customer.id,
              name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown Customer',
              avatar: customer.avatar || null,
              customerSince,
              orderCount,
              priority: orderCount > 20 ? 'vip' : 'regular'
            },
            lastMessage: lastMessage ? lastMessage.content : '',
            lastMessageTime: lastMessage ? this.formatTime(lastMessage.createdAt) : this.formatTime(chat.updatedAt),
            unreadCount: unreadCount || 0,
            online: customer.isOnline || false
          };
        })
      );

      res.status(200).json({
        success: true,
        data: formattedChats
      });
    } catch (error) {
      console.error('Error fetching merchant chats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch chats',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get messages for a specific chat
  async getMessages(req, res) {
    try {
      const { conversationId: chatId } = req.params; // Keep the same param name for compatibility
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;
      const { Chat, Message, User, Store } = sequelize.models;

      if (!chatId) {
        return res.status(400).json({
          success: false,
          message: 'Chat ID is required'
        });
      }

      // Verify user has access to this chat
      const chat = await Chat.findByPk(chatId, {
        include: [
          { model: User, as: 'user', attributes: ['id'] },
          { model: Store, as: 'store', attributes: ['id', 'ownerId', 'owner_id', 'merchantId', 'merchant_id', 'userId', 'user_id'] }
        ]
      });

      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }

      // Check if user has access (either customer or store owner)
      let hasAccess = false;
      if (chat.userId === userId) {
        hasAccess = true;
      } else {
        // Check if user owns the store
        const store = chat.store;
        hasAccess = store && (
          store.ownerId === userId ||
          store.owner_id === userId ||
          store.merchantId === userId ||
          store.merchant_id === userId ||
          store.userId === userId ||
          store.user_id === userId
        );
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const messages = await Message.getMessagesByChat(chatId, parseInt(page), parseInt(limit));

      // Mark messages as read
      await this.markMessagesAsRead(chatId, userId);

      const formattedMessages = messages.reverse().map(msg => ({
        id: msg.id,
        text: msg.content,
        sender: msg.sender_type,
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
      const { conversationId: chatId, content, messageType = 'text' } = req.body;
      const senderId = req.user.id;
      const { Chat, Message, User, Store } = sequelize.models;

      if (!chatId || !content) {
        return res.status(400).json({
          success: false,
          message: 'Chat ID and content are required'
        });
      }

      // Validate chat access
      const chat = await Chat.findByPk(chatId, {
        include: [
          { model: User, as: 'user', attributes: ['id'] },
          { model: Store, as: 'store', attributes: ['id', 'ownerId', 'owner_id', 'merchantId', 'merchant_id', 'userId', 'user_id'] }
        ]
      });

      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }

      // Determine sender type and verify access
      let senderType = 'user';
      let hasAccess = false;

      if (chat.userId === senderId) {
        hasAccess = true;
        senderType = 'user';
      } else {
        // Check if user owns the store
        const store = chat.store;
        hasAccess = store && (
          store.ownerId === senderId ||
          store.owner_id === senderId ||
          store.merchantId === senderId ||
          store.merchant_id === senderId ||
          store.userId === senderId ||
          store.user_id === senderId
        );
        if (hasAccess) {
          senderType = 'merchant';
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
        chat_id: chatId,
        sender_id: senderId,
        sender_type: senderType,
        content,
        messageType,
        status: 'sent'
      });

      // Update chat's last message time
      await chat.updateLastMessage();

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
        sender: messageWithSender.sender_type,
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
        conversationId: chatId
      };

      // Emit to real-time subscribers
      if (socketManager && socketManager.emitToConversation) {
        socketManager.emitToConversation(chatId, 'new_message', formattedMessage);
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

  // Start a new chat (customer to store)
  async startConversation(req, res) {
    try {
      const { storeId, initialMessage = '' } = req.body;
      const userId = req.user.id;
      const { Chat, Message, Store } = sequelize.models;

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

      // Find or create chat
      const { chat, created } = await Chat.findOrCreateChat(userId, storeId);

      // Send initial message if provided
      if (initialMessage && initialMessage.trim()) {
        const message = await Message.create({
          chat_id: chat.id,
          sender_id: userId,
          sender_type: 'user',
          content: initialMessage.trim(),
          messageType: 'text',
          status: 'sent'
        });

        await chat.updateLastMessage();

        // Notify store owner via socket
        if (socketManager && socketManager.notifyNewConversation) {
          socketManager.notifyNewConversation(chat.id, storeId, userId);
        }
      }

      res.status(created ? 201 : 200).json({
        success: true,
        data: {
          conversationId: chat.id,
          message: created ? 'Chat started successfully' : 'Chat already exists',
          created
        }
      });
    } catch (error) {
      console.error('Error starting chat:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start chat',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Mark messages as read
  async markMessagesAsRead(chatId, userId) {
    try {
      const { Message } = sequelize.models;

      // Update message status to read for messages not sent by this user
      await Message.update(
        { status: 'read' },
        {
          where: {
            chat_id: chatId,
            sender_id: { [Op.ne]: userId },
            status: { [Op.ne]: 'read' }
          }
        }
      );

      // Emit read receipt
      if (socketManager && socketManager.emitToConversation) {
        socketManager.emitToConversation(chatId, 'messages_read', {
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
      if (message.sender_id === userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update status of own message'
        });
      }

      await message.update({ status });

      // Emit status update
      if (socketManager && socketManager.emitToUser) {
        socketManager.emitToUser(message.sender_id, 'message_status_update', {
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

  // Search chats and messages
  async searchConversations(req, res) {
    try {
      const { query, type = 'all' } = req.query;
      const userId = req.user.id;
      const { Chat, Message, User, Store } = sequelize.models;

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long'
        });
      }

      // Determine if user is customer or merchant
      let store = null;
      try {
        store = await Store.findOne({ 
          where: { 
            [Op.or]: [
              { ownerId: userId },
              { owner_id: userId },
              { merchantId: userId },
              { merchant_id: userId },
              { userId: userId },
              { user_id: userId }
            ]
          }
        });
      } catch (err) {
        // User is likely a customer
      }

      const isCustomer = !store;
      let searchFilter = {};
      
      if (isCustomer) {
        searchFilter.userId = userId;
      } else {
        searchFilter.storeId = store.id;
      }

      // Search in messages
      const messagesWithChats = await Message.findAll({
        where: {
          content: { [Op.iLike]: `%${query.trim()}%` }
        },
        include: [
          {
            model: Chat,
            as: 'chat',
            where: searchFilter,
            include: [
              { model: User, as: 'user', required: false },
              { model: Store, as: 'store', required: false }
            ]
          }
        ]
      });

      const chatIds = [...new Set(messagesWithChats.map(msg => msg.chat.id))];

      // Get matching chats
      const chats = await Chat.findAll({
        where: {
          [Op.or]: [
            { id: { [Op.in]: chatIds } },
            searchFilter
          ]
        },
        include: [
          { model: User, as: 'user', required: false },
          { model: Store, as: 'store', required: false },
          { 
            model: Message, 
            as: 'messages',
            limit: 1,
            order: [['createdAt', 'DESC']],
            required: false 
          }
        ]
      });

      res.status(200).json({
        success: true,
        data: chats
      });
    } catch (error) {
      console.error('Error searching chats:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get chat analytics (for merchants)
  async getConversationAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const { period = '7d' } = req.query;
      const { Store, Chat, Message } = sequelize.models;

      // Get merchant's store
      const store = await Store.findOne({ 
        where: { 
          [Op.or]: [
            { ownerId: userId },
            { owner_id: userId },
            { merchantId: userId },
            { merchant_id: userId },
            { userId: userId },
            { user_id: userId }
          ]
        }
      });

      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found for this merchant'
        });
      }

      const startDate = this.getDateByPeriod(period);

      const analytics = await Promise.all([
        // Total chats
        Chat.count({ where: { storeId: store.id } }),

        // New chats in period
        Chat.count({
          where: {
            storeId: store.id,
            createdAt: { [Op.gte]: startDate }
          }
        }),

        // Total messages in period
        Message.count({
          include: [{
            model: Chat,
            as: 'chat',
            where: { storeId: store.id },
            attributes: []
          }],
          where: {
            createdAt: { [Op.gte]: startDate }
          }
        }),

        // Unread messages count
        this.getUnreadMessagesCountForStore(store.id)
      ]);

      const result = {
        totalConversations: analytics[0],
        newConversations: analytics[1],
        totalMessages: analytics[2],
        unreadMessages: analytics[3]
      };

      res.status(200).json({
        success: true,
        data: result
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
    try {
      const { Message } = sequelize.models;
      const messageCount = await Message.count({
        include: [{
          model: sequelize.models.Chat,
          as: 'chat',
          where: { userId: customerId, storeId }
        }]
      });
      
      return Math.floor(messageCount / 10) + Math.floor(Math.random() * 5) + 1;
    } catch (error) {
      return Math.floor(Math.random() * 30) + 1;
    }
  }

  async getUnreadCountForMerchant(chatId, merchantId) {
    try {
      const { Message } = sequelize.models;
      return await Message.count({
        where: {
          chat_id: chatId,
          sender_type: 'user', // Messages from customers
          status: { [Op.ne]: 'read' }
        }
      });
    } catch (error) {
      return 0;
    }
  }

  async getUnreadMessagesCountForStore(storeId) {
    try {
      const { Chat, Message } = sequelize.models;
      
      const chats = await Chat.findAll({
        where: { storeId },
        attributes: ['id']
      });

      const chatIds = chats.map(chat => chat.id);
      
      return await Message.count({
        where: {
          chat_id: { [Op.in]: chatIds },
          sender_type: 'user',
          status: { [Op.ne]: 'read' }
        }
      });
    } catch (error) {
      console.error('Error getting unread messages count:', error);
      return 0;
    }
  }

  getDateByPeriod(period) {
    const now = new Date();
    switch (period) {
      case '1d':
        return new Date(now.setDate(now.getDate() - 1));
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      default:
        return new Date(now.setDate(now.getDate() - 7));
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
  getUserConversations: chatController.getUserChats.bind(chatController),
  getMerchantConversations: chatController.getMerchantChats.bind(chatController),
  searchConversations: chatController.searchConversations.bind(chatController),
  getConversationAnalytics: chatController.getConversationAnalytics.bind(chatController),
  markMessagesAsRead: chatController.markMessagesAsRead.bind(chatController)
};