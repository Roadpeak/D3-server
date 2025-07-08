// controllers/chatController.js
const Message = require('../models/message');
const Conversation = require('../models/Conversation');
const User = require('../models/user');
const Store = require('../models/store');
const { socketManager } = require('../socket/websocket');

class ChatController {
  // Get conversations for a user (customer view)
  async getUserConversations(req, res) {
    try {
      const userId = req.user.id;

      const conversations = await Conversation.find({
        participants: userId,
        participantTypes: { $in: ['customer'] }
      })
        .populate('participants', 'name avatar email')
        .populate('storeId', 'name avatar category online')
        .populate({
          path: 'lastMessage',
          select: 'content timestamp sender status'
        })
        .sort({ updatedAt: -1 });

      const formattedConversations = conversations.map(conv => ({
        id: conv._id,
        store: {
          id: conv.storeId._id,
          name: conv.storeId.name,
          avatar: conv.storeId.avatar,
          category: conv.storeId.category,
          online: conv.storeId.online
        },
        lastMessage: conv.lastMessage ? conv.lastMessage.content : '',
        lastMessageTime: conv.lastMessage ? conv.lastMessage.timestamp : conv.updatedAt,
        unreadCount: conv.unreadCount[userId] || 0
      }));

      res.status(200).json({
        success: true,
        data: formattedConversations
      });
    } catch (error) {
      console.error('Error fetching user conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversations'
      });
    }
  }

  // Get conversations for a merchant (store view)
  async getMerchantConversations(req, res) {
    try {
      const storeId = req.user.storeId;

      const conversations = await Conversation.find({
        storeId: storeId
      })
        .populate('participants', 'name avatar email createdAt')
        .populate({
          path: 'lastMessage',
          select: 'content timestamp sender status'
        })
        .sort({ updatedAt: -1 });

      const formattedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const customer = conv.participants.find(p => p._id.toString() !== req.user.id);
          const orderCount = await this.getCustomerOrderCount(customer._id, storeId);
          const customerSince = new Date(customer.createdAt).getFullYear();

          return {
            id: conv._id,
            customer: {
              id: customer._id,
              name: customer.name,
              avatar: customer.avatar,
              customerSince,
              orderCount,
              priority: orderCount > 20 ? 'vip' : 'regular'
            },
            lastMessage: conv.lastMessage ? conv.lastMessage.content : '',
            lastMessageTime: conv.lastMessage ? conv.lastMessage.timestamp : conv.updatedAt,
            unreadCount: conv.unreadCount[storeId] || 0,
            online: await this.isUserOnline(customer._id)
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
        message: 'Failed to fetch conversations'
      });
    }
  }

  // Get messages for a specific conversation
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;

      // Verify user has access to this conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const hasAccess = conversation.participants.includes(userId) ||
        conversation.storeId.toString() === req.user.storeId;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const messages = await Message.find({ conversationId })
        .populate('sender', 'name avatar')
        .sort({ timestamp: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Mark messages as read
      await this.markMessagesAsRead(conversationId, userId);

      const formattedMessages = messages.reverse().map(msg => ({
        id: msg._id,
        text: msg.content,
        sender: msg.senderType,
        senderInfo: {
          id: msg.sender._id,
          name: msg.sender.name,
          avatar: msg.sender.avatar
        },
        timestamp: this.formatTime(msg.timestamp),
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
        message: 'Failed to fetch messages'
      });
    }
  }

  // Send a message
  async sendMessage(req, res) {
    try {
      const { conversationId, content, messageType = 'text' } = req.body;
      const senderId = req.user.id;
      const senderType = req.user.role; // 'customer' or 'merchant'

      // Validate conversation access
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const hasAccess = conversation.participants.includes(senderId) ||
        conversation.storeId.toString() === req.user.storeId;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Create message
      const message = new Message({
        conversationId,
        sender: senderId,
        senderType,
        content,
        messageType,
        timestamp: new Date(),
        status: 'sent'
      });

      await message.save();

      // Update conversation
      conversation.lastMessage = message._id;
      conversation.updatedAt = new Date();

      // Update unread counts
      const otherParticipants = senderType === 'customer'
        ? [conversation.storeId]
        : conversation.participants.filter(p => p.toString() !== senderId);

      otherParticipants.forEach(participantId => {
        conversation.unreadCount.set(participantId.toString(),
          (conversation.unreadCount.get(participantId.toString()) || 0) + 1);
      });

      await conversation.save();

      // Populate sender info for response
      await message.populate('sender', 'name avatar');

      const formattedMessage = {
        id: message._id,
        text: message.content,
        sender: message.senderType,
        senderInfo: {
          id: message.sender._id,
          name: message.sender.name,
          avatar: message.sender.avatar
        },
        timestamp: this.formatTime(message.timestamp),
        status: message.status,
        messageType: message.messageType
      };

      // Emit to real-time subscribers
      socketManager.emitToConversation(conversationId, 'new_message', formattedMessage);

      // Update message status to delivered
      message.status = 'delivered';
      await message.save();

      res.status(201).json({
        success: true,
        data: formattedMessage
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message'
      });
    }
  }

  // Start a new conversation (customer to store)
  async startConversation(req, res) {
    try {
      const { storeId, initialMessage } = req.body;
      const customerId = req.user.id;

      // Check if conversation already exists
      let conversation = await Conversation.findOne({
        storeId,
        participants: customerId
      });

      if (!conversation) {
        // Create new conversation
        conversation = new Conversation({
          storeId,
          participants: [customerId],
          participantTypes: ['customer'],
          unreadCount: new Map(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        await conversation.save();
      }

      // Send initial message if provided
      if (initialMessage) {
        const message = new Message({
          conversationId: conversation._id,
          sender: customerId,
          senderType: 'customer',
          content: initialMessage,
          messageType: 'text',
          timestamp: new Date(),
          status: 'sent'
        });

        await message.save();

        conversation.lastMessage = message._id;
        conversation.unreadCount.set(storeId.toString(), 1);
        await conversation.save();

        // Emit to store
        socketManager.emitToUser(storeId, 'new_conversation', {
          conversationId: conversation._id,
          customer: req.user,
          message: initialMessage
        });
      }

      res.status(201).json({
        success: true,
        data: {
          conversationId: conversation._id,
          message: 'Conversation started successfully'
        }
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start conversation'
      });
    }
  }

  // Mark messages as read
  async markMessagesAsRead(conversationId, userId) {
    try {
      // Update message status
      await Message.updateMany(
        {
          conversationId,
          sender: { $ne: userId },
          status: { $ne: 'read' }
        },
        { status: 'read' }
      );

      // Reset unread count for this user
      const conversation = await Conversation.findById(conversationId);
      if (conversation) {
        conversation.unreadCount.set(userId.toString(), 0);
        await conversation.save();

        // Emit read receipt
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

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      // Only recipient can update status
      if (message.sender.toString() === userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update status of own message'
        });
      }

      message.status = status;
      await message.save();

      // Emit status update
      socketManager.emitToUser(message.sender, 'message_status_update', {
        messageId,
        status,
        timestamp: new Date()
      });

      res.status(200).json({
        success: true,
        message: 'Message status updated'
      });
    } catch (error) {
      console.error('Error updating message status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update message status'
      });
    }
  }

  // Search conversations and messages
  async searchConversations(req, res) {
    try {
      const { query, type = 'all' } = req.query;
      const userId = req.user.id;
      const userRole = req.user.role;

      let searchFilter = {};

      if (userRole === 'customer') {
        searchFilter.participants = userId;
      } else {
        searchFilter.storeId = req.user.storeId;
      }

      // Search in messages
      const messages = await Message.find({
        content: { $regex: query, $options: 'i' }
      }).populate('conversationId');

      const conversationIds = messages
        .filter(msg => {
          const conv = msg.conversationId;
          return userRole === 'customer'
            ? conv.participants.includes(userId)
            : conv.storeId.toString() === req.user.storeId;
        })
        .map(msg => msg.conversationId._id);

      // Get matching conversations
      const conversations = await Conversation.find({
        $or: [
          { _id: { $in: conversationIds } },
          searchFilter
        ]
      })
        .populate('participants', 'name avatar')
        .populate('storeId', 'name avatar category')
        .populate('lastMessage');

      res.status(200).json({
        success: true,
        data: conversations
      });
    } catch (error) {
      console.error('Error searching conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed'
      });
    }
  }

  // Get conversation analytics (for merchants)
  async getConversationAnalytics(req, res) {
    try {
      const storeId = req.user.storeId;
      const { period = '7d' } = req.query;

      const startDate = this.getDateByPeriod(period);

      const analytics = await Promise.all([
        // Total conversations
        Conversation.countDocuments({ storeId }),

        // New conversations in period
        Conversation.countDocuments({
          storeId,
          createdAt: { $gte: startDate }
        }),

        // Total messages in period
        Message.countDocuments({
          timestamp: { $gte: startDate },
          conversationId: { $in: await Conversation.find({ storeId }).distinct('_id') }
        }),

        // Response time analytics
        this.getResponseTimeAnalytics(storeId, startDate)
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalConversations: analytics[0],
          newConversations: analytics[1],
          totalMessages: analytics[2],
          responseTime: analytics[3]
        }
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics'
      });
    }
  }

  // Helper methods
  async getCustomerOrderCount(customerId, storeId) {
    // This would integrate with your order system
    // For now, returning a mock value
    return Math.floor(Math.random() * 30) + 1;
  }

  async isUserOnline(userId) {
    return socketManager.isUserOnline(userId);
  }

  formatTime(timestamp) {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInHours = (now - messageTime) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    } else {
      return messageTime.toLocaleDateString('en-US');
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

  async getResponseTimeAnalytics(storeId, startDate) {
    // Complex aggregation to calculate average response time
    // This is a simplified version
    return {
      averageResponseTime: '2.5 minutes',
      medianResponseTime: '1.8 minutes'
    };
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
  getConversationAnalytics: chatController.getConversationAnalytics.bind(chatController)
};