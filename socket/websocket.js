// socket/websocket.js
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../models/index');

class SocketManager {
  constructor() {
    this.io = null;
    this.initialized = false;
    this.onlineUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
    this.conversationRooms = new Map(); // conversationId -> Set of socketIds
  }

  initialize(server, options = {}) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
        ...options.cors
      }
    });

  // Authentication middleware
  this.io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Use your existing auth logic to determine user type
      let user = null;
      let userType = null;

      // Check if it's a user token
      if (decoded.userId && decoded.type === 'user') {
        const { User } = sequelize.models;
        user = await User.findByPk(decoded.userId, {
          attributes: ['id', 'firstName', 'lastName', 'email', 'userType', 'isOnline', 'lastSeen']
        });
        userType = 'user';
      }
      // Check if it's a merchant token
      else if (decoded.type === 'merchant' && decoded.id) {
        const { Merchant } = sequelize.models;
        user = await Merchant.findByPk(decoded.id, {
          attributes: ['id', 'firstName', 'lastName', 'email', 'isOnline', 'lastSeen']
        });
        userType = 'merchant';
      }
      // Fallback for old tokens
      else if (decoded.userId) {
        const { User } = sequelize.models;
        user = await User.findByPk(decoded.userId, {
          attributes: ['id', 'firstName', 'lastName', 'email', 'userType', 'isOnline', 'lastSeen']
        });
        userType = 'user';
      }
      else if (decoded.id) {
        const { Merchant } = sequelize.models;
        user = await Merchant.findByPk(decoded.id, {
          attributes: ['id', 'firstName', 'lastName', 'email', 'isOnline', 'lastSeen']
        });
        userType = 'merchant';
      }
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.userRole = userType;
      socket.userEmail = user.email;
      socket.userName = `${user.firstName} ${user.lastName}`;
      
      // For merchants, get their store
      if (userType === 'merchant') {
        const { Store } = sequelize.models;
        const store = await Store.findOne({ where: { ownerId: user.id } });
        socket.storeId = store?.id;
      }
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} (${socket.userName}) connected with socket ${socket.id}`);
      
      // Add user to online users
      this.onlineUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, socket.userId);

      // Update user online status in database
      this.updateUserOnlineStatus(socket.userId, true);

      // Broadcast user online status
      this.io.emit('user_online', socket.userId);

      // Handle user joining
      socket.on('user_join', (userData) => {
        console.log(`User ${userData.name || socket.userName} joined chat`);
        socket.userData = userData;
      });

      // Handle joining conversation rooms
      socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation_${conversationId}`);
        
        // Track conversation membership
        if (!this.conversationRooms.has(conversationId)) {
          this.conversationRooms.set(conversationId, new Set());
        }
        this.conversationRooms.get(conversationId).add(socket.id);
        
        console.log(`User ${socket.userId} joined conversation ${conversationId}`);
        
        // Mark messages as delivered when joining
        this.markMessagesAsDelivered(conversationId, socket.userId);
      });

      // Handle leaving conversation rooms
      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
        
        // Remove from conversation tracking
        if (this.conversationRooms.has(conversationId)) {
          this.conversationRooms.get(conversationId).delete(socket.id);
        }
        
        console.log(`User ${socket.userId} left conversation ${conversationId}`);
      });

      // Handle typing indicators
      socket.on('typing_start', ({ conversationId, userId }) => {
        socket.to(`conversation_${conversationId}`).emit('typing_start', {
          userId: userId || socket.userId,
          conversationId
        });
      });

      socket.on('typing_stop', ({ conversationId, userId }) => {
        socket.to(`conversation_${conversationId}`).emit('typing_stop', {
          userId: userId || socket.userId,
          conversationId
        });
      });

      // Handle message delivery confirmation
      socket.on('message_delivered', ({ messageId, conversationId }) => {
        this.updateMessageStatus(messageId, 'delivered');
        socket.to(`conversation_${conversationId}`).emit('message_status_update', {
          messageId,
          status: 'delivered'
        });
      });

      // Handle message read confirmation
      socket.on('message_read', ({ messageId, conversationId }) => {
        this.updateMessageStatus(messageId, 'read');
        socket.to(`conversation_${conversationId}`).emit('message_status_update', {
          messageId,
          status: 'read'
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        
        // Remove from online users
        this.onlineUsers.delete(socket.userId);
        this.userSockets.delete(socket.id);
        
        // Update user online status in database
        this.updateUserOnlineStatus(socket.userId, false);
        
        // Remove from all conversation rooms
        this.conversationRooms.forEach((sockets, conversationId) => {
          sockets.delete(socket.id);
        });
        
        // Broadcast user offline status
        this.io.emit('user_offline', socket.userId);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.userId}:`, error);
      });
    });

    this.initialized = true;
    console.log('Socket.IO server initialized with Sequelize integration');
  }

  // Check if socket manager is initialized
  isInitialized() {
    return this.initialized;
  }

  // Close socket connections
  async close() {
    if (this.io) {
      // Update all online users to offline
      for (const userId of this.onlineUsers.keys()) {
        await this.updateUserOnlineStatus(userId, false);
      }
      
      this.io.close();
      this.initialized = false;
      console.log('Socket.IO server closed');
    }
  }

  // Emit message to specific conversation
  emitToConversation(conversationId, event, data) {
    if (this.io) {
      this.io.to(`conversation_${conversationId}`).emit(event, data);
    }
  }

  // Emit message to specific user
  emitToUser(userId, event, data) {
    const socketId = this.onlineUsers.get(userId);
    if (socketId && this.io) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Emit to all users of a specific role
  emitToRole(role, event, data) {
    if (this.io) {
      this.io.fetchSockets().then(sockets => {
        sockets.forEach(socket => {
          if (socket.userRole === role) {
            socket.emit(event, data);
          }
        });
      });
    }
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.onlineUsers.size;
  }

  // Get users in conversation
  getUsersInConversation(conversationId) {
    const sockets = this.conversationRooms.get(conversationId) || new Set();
    return Array.from(sockets).map(socketId => this.userSockets.get(socketId)).filter(Boolean);
  }

  // Broadcast system message
  broadcastSystemMessage(message, targetRole = null) {
    if (targetRole) {
      this.emitToRole(targetRole, 'system_message', { message, timestamp: new Date() });
    } else {
      this.io.emit('system_message', { message, timestamp: new Date() });
    }
  }

  // Helper method to get user by ID using Sequelize
  async getUserById(userId) {
    try {
      const { User } = sequelize.models;
      return await User.findByPk(userId, {
        attributes: ['id', 'firstName', 'lastName', 'email', 'userType', 'isOnline', 'lastSeen']
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  // Helper method to get store by owner ID
  async getStoreByOwnerId(ownerId) {
    try {
      const { Store } = sequelize.models;
      return await Store.findOne({
        where: { ownerId: ownerId },
        attributes: ['id', 'name', 'isOnline', 'lastSeen']
      });
    } catch (error) {
      console.error('Error fetching store:', error);
      return null;
    }
  }

  // Update user's online status in database
  async updateUserOnlineStatus(userId, isOnline) {
    try {
      const { User } = sequelize.models;
      await User.update(
        { 
          isOnline,
          lastSeen: isOnline ? null : new Date()
        },
        { where: { id: userId } }
      );

      // Also update store status if user is a merchant
      const user = await this.getUserById(userId);
      if (user && user.userType === 'merchant') {
        const { Store } = sequelize.models;
        await Store.update(
          {
            isOnline,
            lastSeen: isOnline ? null : new Date()
          },
          { where: { ownerId: userId } }
        );
      }
    } catch (error) {
      console.error('Error updating user online status:', error);
    }
  }

  // Mark messages as delivered when user joins conversation
  async markMessagesAsDelivered(conversationId, userId) {
    try {
      const { Message } = sequelize.models;
      
      // Update messages that are not from this user and are still in 'sent' status
      await Message.update(
        { status: 'delivered' },
        {
          where: {
            conversationId: conversationId,
            senderId: { [sequelize.Op.ne]: userId },
            status: 'sent'
          }
        }
      );

      // Emit status update to conversation
      this.emitToConversation(conversationId, 'messages_delivered', {
        conversationId,
        deliveredBy: userId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error marking messages as delivered:', error);
    }
  }

  // Update individual message status
  async updateMessageStatus(messageId, status) {
    try {
      const { Message } = sequelize.models;
      await Message.update(
        { status },
        { where: { id: messageId } }
      );
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }

  // Get conversation analytics
  async getConversationAnalytics(storeId, period = '7d') {
    try {
      const { Conversation, Message } = sequelize.models;
      
      const startDate = this.getDateByPeriod(period);

      const analytics = await Promise.all([
        // Total conversations
        Conversation.count({ where: { storeId } }),

        // New conversations in period
        Conversation.count({
          where: {
            storeId,
            createdAt: { [sequelize.Op.gte]: startDate }
          }
        }),

        // Total messages in period
        Message.count({
          include: [{
            model: Conversation,
            as: 'conversation',
            where: { storeId },
            attributes: []
          }],
          where: {
            createdAt: { [sequelize.Op.gte]: startDate }
          }
        }),

        // Unread messages count
        this.getUnreadMessagesCount(storeId)
      ]);

      return {
        totalConversations: analytics[0],
        newConversations: analytics[1],
        totalMessages: analytics[2],
        unreadMessages: analytics[3]
      };
    } catch (error) {
      console.error('Error fetching conversation analytics:', error);
      return {
        totalConversations: 0,
        newConversations: 0,
        totalMessages: 0,
        unreadMessages: 0
      };
    }
  }

  // Get unread messages count for a store
  async getUnreadMessagesCount(storeId) {
    try {
      const { Conversation } = sequelize.models;
      
      const conversations = await Conversation.findAll({
        where: { storeId },
        attributes: ['merchantUnreadCount']
      });

      return conversations.reduce((total, conv) => total + (conv.merchantUnreadCount || 0), 0);
    } catch (error) {
      console.error('Error getting unread messages count:', error);
      return 0;
    }
  }

  // Helper method to get date by period
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

  // Notify users of new conversation
  async notifyNewConversation(conversationId, storeId, customerId) {
    try {
      const { Conversation, User, Store } = sequelize.models;
      
      const conversation = await Conversation.findByPk(conversationId, {
        include: [
          { model: User, as: 'customer' },
          { model: Store, as: 'store' }
        ]
      });

      if (conversation) {
        // Notify store owner
        const store = await Store.findByPk(storeId, {
          include: [{ model: User, as: 'owner' }]
        });

        if (store && store.owner) {
          this.emitToUser(store.owner.id, 'new_conversation', {
            conversationId,
            customer: {
              id: conversation.customer.id,
              name: `${conversation.customer.firstName} ${conversation.customer.lastName}`,
              email: conversation.customer.email
            },
            store: {
              id: conversation.store.id,
              name: conversation.store.name
            }
          });
        }
      }
    } catch (error) {
      console.error('Error notifying new conversation:', error);
    }
  }
}

// Create singleton instance
const socketManager = new SocketManager();

module.exports = { socketManager };