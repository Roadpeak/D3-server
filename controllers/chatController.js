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

module.exports = new ChatController();

// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// User/Customer routes
router.get('/conversations', 
  authenticateToken, 
  authorizeRole(['customer', 'merchant']), 
  (req, res) => {
    if (req.user.role === 'customer') {
      return chatController.getUserConversations(req, res);
    } else {
      return chatController.getMerchantConversations(req, res);
    }
  }
);

router.post('/conversations', 
  authenticateToken, 
  authorizeRole(['customer']), 
  chatController.startConversation
);

router.get('/conversations/:conversationId/messages', 
  authenticateToken, 
  chatController.getMessages
);

router.post('/messages', 
  authenticateToken, 
  chatController.sendMessage
);

router.patch('/messages/:messageId/status', 
  authenticateToken, 
  chatController.updateMessageStatus
);

router.get('/search', 
  authenticateToken, 
  chatController.searchConversations
);

// Merchant-specific routes
router.get('/analytics', 
  authenticateToken, 
  authorizeRole(['merchant']), 
  chatController.getConversationAnalytics
);

module.exports = router;

// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderType: {
    type: String,
    enum: ['customer', 'merchant'],
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'order', 'product'],
    default: 'text'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ sender: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);

// models/Conversation.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  participantTypes: [{
    type: String,
    enum: ['customer', 'merchant']
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'blocked'],
    default: 'active'
  },
  tags: [String],
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  }
}, {
  timestamps: true
});

conversationSchema.index({ storeId: 1, updatedAt: -1 });
conversationSchema.index({ participants: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);

// utils/socketManager.js
const socketIo = require('socket.io');

class SocketManager {
  constructor() {
    this.io = null;
    this.onlineUsers = new Map();
    this.conversationRooms = new Map();
  }

  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.io.on('connection', (socket) => {
      console.log('User connected:', socket.id);

      socket.on('user_join', (userData) => {
        this.handleUserJoin(socket, userData);
      });

      socket.on('join_conversation', (conversationId) => {
        this.handleJoinConversation(socket, conversationId);
      });

      socket.on('leave_conversation', (conversationId) => {
        this.handleLeaveConversation(socket, conversationId);
      });

      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleUserDisconnect(socket);
      });
    });
  }

  handleUserJoin(socket, userData) {
    socket.userId = userData.userId;
    socket.userRole = userData.role;
    this.onlineUsers.set(userData.userId, socket.id);
    
    // Join user to their personal room
    socket.join(`user_${userData.userId}`);
    
    // Broadcast online status
    socket.broadcast.emit('user_online', userData.userId);
  }

  handleJoinConversation(socket, conversationId) {
    socket.join(`conversation_${conversationId}`);
    
    if (!this.conversationRooms.has(conversationId)) {
      this.conversationRooms.set(conversationId, new Set());
    }
    this.conversationRooms.get(conversationId).add(socket.id);
  }

  handleLeaveConversation(socket, conversationId) {
    socket.leave(`conversation_${conversationId}`);
    
    if (this.conversationRooms.has(conversationId)) {
      this.conversationRooms.get(conversationId).delete(socket.id);
    }
  }

  handleTypingStart(socket, { conversationId, userId }) {
    socket.to(`conversation_${conversationId}`).emit('typing_start', {
      userId,
      conversationId
    });
  }

  handleTypingStop(socket, { conversationId, userId }) {
    socket.to(`conversation_${conversationId}`).emit('typing_stop', {
      userId,
      conversationId
    });
  }

  handleUserDisconnect(socket) {
    if (socket.userId) {
      this.onlineUsers.delete(socket.userId);
      socket.broadcast.emit('user_offline', socket.userId);
    }
    
    // Clean up conversation rooms
    this.conversationRooms.forEach((participants, conversationId) => {
      participants.delete(socket.id);
    });
  }

  emitToUser(userId, event, data) {
    this.io.to(`user_${userId}`).emit(event, data);
  }

  emitToConversation(conversationId, event, data) {
    this.io.to(`conversation_${conversationId}`).emit(event, data);
  }

  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers.keys());
  }
}

module.exports = {
  socketManager: new SocketManager()
};

// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRole
};

// app.js - Main application setup
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const chatRoutes = require('./routes/chatRoutes');
const { socketManager } = require('./utils/socketManager');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
socketManager.initialize(server);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/chat', chatRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat_app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;