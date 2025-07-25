// socket/websocket.js - Enhanced version with better event distribution
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../models/index');

class SocketManager {
  constructor() {
    this.io = null;
    this.initialized = false;
    this.onlineUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
    this.chatRooms = new Map(); // chatId -> Set of socketIds
    this.userRoles = new Map(); // userId -> role (user/merchant)
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
          const { User } = sequelize.models;
          user = await User.findByPk(decoded.id, {
            attributes: ['id', 'firstName', 'lastName', 'email', 'userType', 'isOnline', 'lastSeen']
          });
          userType = 'merchant';
        }
        // Fallback for old tokens
        else if (decoded.userId) {
          const { User } = sequelize.models;
          user = await User.findByPk(decoded.userId, {
            attributes: ['id', 'firstName', 'lastName', 'email', 'userType', 'isOnline', 'lastSeen']
          });
          userType = user ? (user.userType || 'user') : 'user';
        }
        else if (decoded.id) {
          const { User } = sequelize.models;
          user = await User.findByPk(decoded.id, {
            attributes: ['id', 'firstName', 'lastName', 'email', 'userType', 'isOnline', 'lastSeen']
          });
          userType = user ? (user.userType || 'user') : 'user';
        }
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user.id;
        socket.userRole = userType;
        socket.userEmail = user.email;
        socket.userName = `${user.firstName} ${user.lastName}`;
        
        // Store user role for better event routing
        this.userRoles.set(user.id, userType);
        
        // For merchants, get their stores
        if (userType === 'merchant' || user.userType === 'merchant') {
          const { Store } = sequelize.models;
          const stores = await Store.findAll({ 
            where: { 
              [sequelize.Op.or]: [
                { ownerId: user.id },
                { owner_id: user.id },
                { merchantId: user.id },
                { merchant_id: user.id },
                { userId: user.id },
                { user_id: user.id }
              ]
            }
          });
          socket.storeIds = stores.map(store => store.id);
          console.log(`🏪 Merchant ${user.id} manages stores:`, socket.storeIds);
        }
        
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`✅ User ${socket.userId} (${socket.userRole}) connected with socket ${socket.id}`);
      
      // Add user to online users
      this.onlineUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, socket.userId);

      // Update user online status in database
      this.updateUserOnlineStatus(socket.userId, true);

      // Broadcast user online status to relevant users
      this.broadcastUserOnlineStatus(socket.userId, true);

      // Handle user joining specific conversations
      socket.on('join_conversation', (chatId) => {
        console.log(`📞 User ${socket.userId} (${socket.userRole}) joining chat ${chatId}`);
        
        socket.join(`chat_${chatId}`);
        
        // Track chat membership
        if (!this.chatRooms.has(chatId)) {
          this.chatRooms.set(chatId, new Set());
        }
        this.chatRooms.get(chatId).add(socket.id);
        
        // Mark messages as delivered when joining
        this.markMessagesAsDelivered(chatId, socket.userId);
        
        // Notify other participants that user joined
        socket.to(`chat_${chatId}`).emit('user_joined_chat', {
          userId: socket.userId,
          userRole: socket.userRole,
          chatId
        });
      });

      // Handle leaving chat rooms
      socket.on('leave_conversation', (chatId) => {
        console.log(`📞 User ${socket.userId} (${socket.userRole}) leaving chat ${chatId}`);
        
        socket.leave(`chat_${chatId}`);
        
        // Remove from chat tracking
        if (this.chatRooms.has(chatId)) {
          this.chatRooms.get(chatId).delete(socket.id);
        }
        
        // Notify other participants that user left
        socket.to(`chat_${chatId}`).emit('user_left_chat', {
          userId: socket.userId,
          userRole: socket.userRole,
          chatId
        });
      });

      // Handle typing indicators
      socket.on('typing_start', ({ conversationId, userId }) => {
        console.log(`⌨️ User ${socket.userId} started typing in chat ${conversationId}`);
        socket.to(`chat_${conversationId}`).emit('typing_start', {
          userId: userId || socket.userId,
          userRole: socket.userRole,
          conversationId
        });
      });

      socket.on('typing_stop', ({ conversationId, userId }) => {
        console.log(`⌨️ User ${socket.userId} stopped typing in chat ${conversationId}`);
        socket.to(`chat_${conversationId}`).emit('typing_stop', {
          userId: userId || socket.userId,
          userRole: socket.userRole,
          conversationId
        });
      });

      // Handle message delivery confirmation
      socket.on('message_delivered', ({ messageId, conversationId }) => {
        this.updateMessageStatus(messageId, 'delivered');
        socket.to(`chat_${conversationId}`).emit('message_status_update', {
          messageId,
          status: 'delivered'
        });
      });

      // Handle message read confirmation
      socket.on('message_read', ({ messageId, conversationId }) => {
        this.updateMessageStatus(messageId, 'read');
        socket.to(`chat_${conversationId}`).emit('message_status_update', {
          messageId,
          status: 'read'
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`❌ User ${socket.userId} (${socket.userRole}) disconnected`);
        
        // Remove from online users
        this.onlineUsers.delete(socket.userId);
        this.userSockets.delete(socket.id);
        this.userRoles.delete(socket.userId);
        
        // Update user online status in database
        this.updateUserOnlineStatus(socket.userId, false);
        
        // Remove from all chat rooms
        this.chatRooms.forEach((sockets, chatId) => {
          sockets.delete(socket.id);
        });
        
        // Broadcast user offline status to relevant users
        this.broadcastUserOnlineStatus(socket.userId, false);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.userId}:`, error);
      });
    });

    this.initialized = true;
    console.log('🚀 Socket.IO server initialized with enhanced Chat system');
  }

  // Enhanced method to emit new messages with proper routing
  emitNewMessage(chatId, messageData) {
    console.log(`💬 Emitting new message to chat ${chatId}:`, {
      sender: messageData.sender,
      senderRole: messageData.senderRole,
      messageId: messageData.id
    });

    // Emit to all participants in the chat room
    this.io.to(`chat_${chatId}`).emit('new_message', {
      ...messageData,
      conversationId: chatId
    });

    // Additionally, emit directly to relevant users who might not be in the room
    this.notifyRelevantUsersForChat(chatId, 'new_message', messageData);
  }

  // Notify relevant users for a chat (both customers and merchants)
  async notifyRelevantUsersForChat(chatId, event, data) {
    try {
      const { Chat, Store } = sequelize.models;
      
      const chat = await Chat.findByPk(chatId, {
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'merchant_id']
          }
        ]
      });

      if (!chat) return;

      // Notify customer (always)
      if (chat.userId) {
        this.emitToUser(chat.userId, event, data);
      }

      // Notify merchant (store owner)
      if (chat.store && chat.store.merchant_id) {
        this.emitToUser(chat.store.merchant_id, event, data);
        
        // Also emit a merchant-specific event
        this.emitToUser(chat.store.merchant_id, `merchant_${event}`, {
          ...data,
          chatId,
          customerId: chat.userId,
          storeId: chat.store.id
        });
      }

    } catch (error) {
      console.error('Error notifying relevant users:', error);
    }
  }

  // Broadcast user online/offline status to relevant users
  async broadcastUserOnlineStatus(userId, isOnline) {
    try {
      const userRole = this.userRoles.get(userId) || 'user';
      
      // If user is a merchant, notify customers who have chats with their stores
      if (userRole === 'merchant') {
        const { Chat, Store } = sequelize.models;
        
        const stores = await Store.findAll({
          where: { merchant_id: userId }
        });
        
        if (stores.length > 0) {
          const storeIds = stores.map(store => store.id);
          
          const customerChats = await Chat.findAll({
            where: { storeId: { [sequelize.Op.in]: storeIds } },
            attributes: ['userId']
          });
          
          const customerIds = [...new Set(customerChats.map(chat => chat.userId))];
          
          customerIds.forEach(customerId => {
            this.emitToUser(customerId, 'merchant_status_update', {
              merchantId: userId,
              isOnline,
              storeIds
            });
          });
        }
      }
      
      // If user is a customer, notify merchants of stores they have chats with
      else if (userRole === 'user') {
        const { Chat } = sequelize.models;
        
        const chats = await Chat.findAll({
          where: { userId },
          include: [
            {
              model: sequelize.models.Store,
              as: 'store',
              attributes: ['id', 'merchant_id']
            }
          ]
        });
        
        const merchantIds = [...new Set(chats.map(chat => chat.store?.merchant_id).filter(Boolean))];
        
        merchantIds.forEach(merchantId => {
          this.emitToUser(merchantId, 'customer_status_update', {
            customerId: userId,
            isOnline
          });
        });
      }
      
    } catch (error) {
      console.error('Error broadcasting user status:', error);
    }
  }

  // Enhanced method to emit message to specific chat
  emitToConversation(chatId, event, data) {
    if (this.io) {
      console.log(`📡 Emitting ${event} to chat ${chatId}`);
      this.io.to(`chat_${chatId}`).emit(event, data);
      
      // For important events, also notify relevant users directly
      if (['new_message', 'message_status_update'].includes(event)) {
        this.notifyRelevantUsersForChat(chatId, event, data);
      }
    }
  }

  // Emit message to specific user
  emitToUser(userId, event, data) {
    const socketId = this.onlineUsers.get(userId.toString());
    if (socketId && this.io) {
      console.log(`📤 Emitting ${event} to user ${userId} (socket: ${socketId})`);
      this.io.to(socketId).emit(event, data);
    } else {
      console.log(`⚠️ User ${userId} not connected, cannot emit ${event}`);
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
    return this.onlineUsers.has(userId.toString());
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.onlineUsers.size;
  }

  // Get users in chat
  getUsersInChat(chatId) {
    const sockets = this.chatRooms.get(chatId) || new Set();
    return Array.from(sockets).map(socketId => this.userSockets.get(socketId)).filter(Boolean);
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
      const userRole = this.userRoles.get(userId) || 'user';
      if (userRole === 'merchant') {
        const { Store } = sequelize.models;
        await Store.update(
          {
            isOnline,
            lastSeen: isOnline ? null : new Date()
          },
          { 
            where: { 
              [sequelize.Op.or]: [
                { ownerId: userId },
                { owner_id: userId },
                { merchantId: userId },
                { merchant_id: userId },
                { userId: userId },
                { user_id: userId }
              ]
            }
          }
        );
      }
    } catch (error) {
      console.error('Error updating user online status:', error);
    }
  }

  // Mark messages as delivered when user joins chat
  async markMessagesAsDelivered(chatId, userId) {
    try {
      const { Message } = sequelize.models;
      
      // Update messages that are not from this user and are still in 'sent' status
      const updatedCount = await Message.update(
        { status: 'delivered' },
        {
          where: {
            chat_id: chatId,
            sender_id: { [sequelize.Op.ne]: userId },
            status: 'sent'
          }
        }
      );

      if (updatedCount[0] > 0) {
        console.log(`📬 Marked ${updatedCount[0]} messages as delivered in chat ${chatId}`);
        
        // Emit status update to chat
        this.emitToConversation(chatId, 'messages_delivered', {
          chatId,
          deliveredBy: userId,
          timestamp: new Date(),
          count: updatedCount[0]
        });
      }
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
      console.log(`📝 Updated message ${messageId} status to ${status}`);
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }

  // Enhanced new conversation notification
  async notifyNewConversation(chatId, storeId, customerId) {
    try {
      const { Chat, User, Store } = sequelize.models;
      
      console.log(`🔔 Notifying new conversation: chat=${chatId}, store=${storeId}, customer=${customerId}`);
      
      const chat = await Chat.findByPk(chatId, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'avatar']
          },
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url', 'merchant_id']
          }
        ]
      });

      if (!chat) {
        console.error('❌ Chat not found for notification');
        return;
      }

      // Notify store owner/merchant
      if (chat.store && chat.store.merchant_id) {
        const merchantId = chat.store.merchant_id;
        
        console.log(`📧 Notifying merchant ${merchantId} of new conversation`);
        
        this.emitToUser(merchantId, 'new_conversation', {
          conversationId: chatId,
          customer: {
            id: chat.user.id,
            name: `${chat.user.firstName} ${chat.user.lastName}`,
            email: chat.user.email,
            avatar: chat.user.avatar
          },
          store: {
            id: chat.store.id,
            name: chat.store.name,
            logo: chat.store.logo_url
          },
          timestamp: new Date()
        });

        // Also emit a merchant-specific new chat event
        this.emitToUser(merchantId, 'merchant_new_chat', {
          chatId,
          customerId,
          storeId,
          customerInfo: {
            name: `${chat.user.firstName} ${chat.user.lastName}`,
            email: chat.user.email,
            avatar: chat.user.avatar
          },
          storeInfo: {
            name: chat.store.name,
            logo: chat.store.logo_url
          }
        });
      }

      // Notify customer (confirmation)
      this.emitToUser(customerId, 'conversation_started', {
        conversationId: chatId,
        store: {
          id: chat.store.id,
          name: chat.store.name,
          logo: chat.store.logo_url
        },
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error notifying new conversation:', error);
    }
  }

  // Broadcast system message
  broadcastSystemMessage(message, targetRole = null) {
    console.log(`📢 Broadcasting system message to ${targetRole || 'all users'}: ${message}`);
    
    if (targetRole) {
      this.emitToRole(targetRole, 'system_message', { message, timestamp: new Date() });
    } else {
      this.io.emit('system_message', { message, timestamp: new Date() });
    }
  }

  // Get chat analytics
  async getChatAnalytics(storeId, period = '7d') {
    try {
      const { Chat, Message } = sequelize.models;
      
      const startDate = this.getDateByPeriod(period);

      const analytics = await Promise.all([
        // Total chats
        Chat.count({ where: { storeId } }),

        // New chats in period
        Chat.count({
          where: {
            storeId,
            createdAt: { [sequelize.Op.gte]: startDate }
          }
        }),

        // Total messages in period
        Message.count({
          include: [{
            model: Chat,
            as: 'chat',
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
      console.error('Error fetching chat analytics:', error);
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
      const { Chat, Message } = sequelize.models;
      
      const chats = await Chat.findAll({
        where: { storeId },
        attributes: ['id']
      });

      const chatIds = chats.map(chat => chat.id);

      return await Message.count({
        where: {
          chat_id: { [sequelize.Op.in]: chatIds },
          sender_type: 'user', // Messages from customers
          status: { [sequelize.Op.ne]: 'read' }
        }
      });
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
}

// Create singleton instance
const socketManager = new SocketManager();

module.exports = { socketManager };