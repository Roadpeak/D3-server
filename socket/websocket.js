// socket/websocket.js - FIXED: Customer↔Store Communication Events
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../models/index');
const { Op } = require('sequelize');

class SocketManager {
  constructor() {
    this.io = null;
    this.initialized = false;
    this.onlineUsers = new Map();
    this.userSockets = new Map();
    this.chatRooms = new Map();
    this.userRoles = new Map();
    this.merchantStores = new Map(); // Track which stores each merchant owns
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

    // Enhanced authentication middleware
    this.io.use(async (socket, next) => {
      try {
        console.log('🔐 Socket authentication attempt...');

        // Helper to extract token from cookies
        const getTokenFromCookies = (cookieHeader) => {
          if (!cookieHeader) return null;
          const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
          }, {});
          return cookies.access_token || cookies.authToken || cookies.token || null;
        };

        // Try multiple token sources including cookies
        const token = socket.handshake.auth.token ||
                     socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                     socket.handshake.query.token ||
                     getTokenFromCookies(socket.handshake.headers.cookie);

        console.log('🔐 Token sources:', {
          auth: !!socket.handshake.auth.token,
          header: !!socket.handshake.headers.authorization,
          query: !!socket.handshake.query.token,
          cookie: !!getTokenFromCookies(socket.handshake.headers.cookie)
        });

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
          return next(new Error(`Authentication error: ${jwtError.message}`));
        }

        let userId = decoded.userId || decoded.id;
        if (!userId) {
          return next(new Error('Authentication error: No user ID in token'));
        }

        let user = null;
        let userType = null;

        const { User, Merchant } = sequelize.models;

        // Find user based on token type
        if (decoded.type === 'merchant') {
          if (Merchant) {
            user = await Merchant.findByPk(userId, {
              attributes: ['id', 'first_name', 'last_name', 'email_address']
            });
            if (user) {
              userType = 'merchant';
              
              // FIXED: Load merchant's stores for proper routing
              await this.loadMerchantStores(userId);
            }
          }
          
          if (!user && User) {
            user = await User.findByPk(userId, {
              attributes: ['id', 'firstName', 'lastName', 'email']
            });
            if (user) userType = 'merchant';
          }
        } else {
          if (User) {
            user = await User.findByPk(userId, {
              attributes: ['id', 'firstName', 'lastName', 'email']
            });
            if (user) userType = 'customer';
          }
        }
        
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        // Set socket properties
        socket.userId = user.id;
        socket.userRole = userType;
        socket.userType = userType;
        socket.userEmail = user.email_address || user.email;
        socket.userName = userType === 'merchant' 
          ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
          : `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        this.userRoles.set(user.id, userType);
        
        console.log(`✅ ${userType} authenticated:`, {
          userId: user.id,
          name: socket.userName,
          stores: userType === 'merchant' ? this.merchantStores.get(user.id) : 'N/A'
        });
        
        next();
      } catch (error) {
        console.error('💥 Socket authentication error:', error);
        next(new Error(`Authentication error: ${error.message}`));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      console.log(`✅ ${socket.userType} ${socket.userId} connected`);
      
      this.onlineUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, socket.userId);

      // FIXED: Join appropriate rooms based on user type
      if (socket.userType === 'merchant') {
        // Merchants join rooms for each of their stores
        const merchantStores = this.merchantStores.get(socket.userId) || [];
        merchantStores.forEach(storeId => {
          socket.join(`store_${storeId}`);
          console.log(`🏪 Merchant ${socket.userId} joined store room: store_${storeId}`);
        });
        
        // Also join general merchant room
        socket.join(`merchant_${socket.userId}`);
      } else {
        // Customers join customer room
        socket.join(`customer_${socket.userId}`);
        console.log(`👤 Customer ${socket.userId} joined customer room`);
      }

      this.broadcastUserOnlineStatus(socket.userId, socket.userType, true);

      // FIXED: Handle joining customer↔store conversations
      socket.on('join_conversation', async (data) => {
        try {
          const chatId = data.conversationId || data;
          console.log(`📞 ${socket.userType} ${socket.userId} joining chat ${chatId}`);
          
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
          
          if (!chat) {
            socket.emit('error', { message: 'Chat not found' });
            return;
          }

          // FIXED: Check permissions for customer↔store chat
          let hasAccess = false;
          if (socket.userType === 'customer' && chat.userId === socket.userId) {
            hasAccess = true;
            console.log('✅ Customer access to store chat granted');
          } else if (socket.userType === 'merchant' && chat.store.merchant_id === socket.userId) {
            hasAccess = true;
            console.log('✅ Merchant access to customer↔store chat granted');
          }

          if (!hasAccess) {
            socket.emit('error', { message: 'Access denied to conversation' });
            return;
          }
          
          socket.join(`chat_${chatId}`);
          
          if (!this.chatRooms.has(chatId)) {
            this.chatRooms.set(chatId, new Set());
          }
          this.chatRooms.get(chatId).add(socket.id);
          
          this.markMessagesAsDelivered(chatId, socket.userId, socket.userType);
          
          socket.to(`chat_${chatId}`).emit('user_joined_chat', {
            userId: socket.userId,
            userType: socket.userType,
            chatId
          });
        } catch (error) {
          console.error('Error joining conversation:', error);
          socket.emit('error', { message: 'Failed to join conversation' });
        }
      });

      // Handle leaving chat rooms
      socket.on('leave_conversation', (data) => {
        const chatId = data.conversationId || data;
        console.log(`📞 ${socket.userType} ${socket.userId} leaving chat ${chatId}`);
        
        socket.leave(`chat_${chatId}`);
        
        if (this.chatRooms.has(chatId)) {
          this.chatRooms.get(chatId).delete(socket.id);
        }
        
        socket.to(`chat_${chatId}`).emit('user_left_chat', {
          userId: socket.userId,
          userType: socket.userType,
          chatId
        });
      });

      // Handle typing indicators
      socket.on('typing_start', ({ conversationId, userId }) => {
        socket.to(`chat_${conversationId}`).emit('typing_start', {
          userId: userId || socket.userId,
          userType: socket.userType,
          conversationId
        });
      });

      socket.on('typing_stop', ({ conversationId, userId }) => {
        socket.to(`chat_${conversationId}`).emit('typing_stop', {
          userId: userId || socket.userId,
          userType: socket.userType,
          conversationId
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`❌ ${socket.userType} ${socket.userId} disconnected`);
        
        this.onlineUsers.delete(socket.userId);
        this.userSockets.delete(socket.id);
        this.userRoles.delete(socket.userId);
        
        this.chatRooms.forEach((sockets, chatId) => {
          sockets.delete(socket.id);
        });
        
        this.broadcastUserOnlineStatus(socket.userId, socket.userType, false);
      });
    });

    this.initialized = true;
    console.log('🚀 Socket.IO server initialized with customer↔store communication');
  }

  // FIXED: Load merchant's stores for proper event routing
  async loadMerchantStores(merchantId) {
    try {
      const { Store } = sequelize.models;
      if (Store) {
        const stores = await Store.findAll({
          where: { merchant_id: merchantId },
          attributes: ['id', 'name']
        });
        
        const storeIds = stores.map(store => store.id);
        this.merchantStores.set(merchantId, storeIds);
        
        console.log(`🏪 Loaded ${stores.length} stores for merchant ${merchantId}:`, 
          stores.map(s => ({ id: s.id, name: s.name })));
      }
    } catch (error) {
      console.error('Error loading merchant stores:', error);
      this.merchantStores.set(merchantId, []);
    }
  }

  // FIXED: Enhanced message routing for customer↔store communication
  async notifyRelevantUsersForChat(chatId, event, data) {
    try {
      const { Chat, Store } = sequelize.models;
      
      const chat = await Chat.findByPk(chatId, {
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'merchant_id']
          }
        ]
      });

      if (!chat) {
        console.log('⚠️ Chat not found for notification:', chatId);
        return;
      }

      console.log('🎯 Routing customer↔store message:', {
        chatId,
        customerId: chat.userId,
        storeId: chat.storeId,
        storeName: chat.store?.name,
        merchantId: chat.store?.merchant_id,
        messageSender: data.sender || data.sender_type
      });

      // FIXED: Route based on customer↔store communication model
      if (data.sender === 'user' || data.sender_type === 'user') {
        // CUSTOMER→STORE: Notify the merchant who owns the store
        if (chat.store && chat.store.merchant_id) {
          console.log(`📧 CUSTOMER→STORE: Notifying merchant ${chat.store.merchant_id} about customer message`);
          
          const merchantNotification = {
            ...data,
            type: 'customer_to_store_message',
            recipient_type: 'merchant',
            customer: {
              id: chat.userId,
              name: data.senderInfo?.name || 'Customer'
            },
            store: {
              id: chat.store.id,
              name: chat.store.name,
              merchantId: chat.store.merchant_id
            }
          };
          
          // Send to specific merchant
          this.emitToUser(chat.store.merchant_id, 'new_customer_to_store_message', merchantNotification);
          this.emitToUser(chat.store.merchant_id, event, merchantNotification);
          
          // Also emit to store room in case merchant has multiple sessions
          this.io.to(`store_${chat.storeId}`).emit('new_customer_message', merchantNotification);
          
          return true;
        }
      } else if (data.sender === 'store' || data.sender_type === 'store') {
        // STORE→CUSTOMER: Notify the customer
        if (chat.userId) {
          console.log(`📧 STORE→CUSTOMER: Notifying customer ${chat.userId} about store response`);
          
          const customerNotification = {
            ...data,
            type: 'store_to_customer_message',
            recipient_type: 'customer',
            store: {
              id: chat.store.id,
              name: chat.store.name,
              logo: data.senderInfo?.avatar
            },
            customer: {
              id: chat.userId
            }
          };
          
          // Send to specific customer
          this.emitToUser(chat.userId, 'new_store_to_customer_message', customerNotification);
          this.emitToUser(chat.userId, event, customerNotification);
          
          // Also emit to customer room
          this.io.to(`customer_${chat.userId}`).emit('new_store_message', customerNotification);
          
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error routing customer↔store message:', error);
      return false;
    }
  }

  // Enhanced user-specific notification
  emitToUser(userId, event, data) {
    const socketId = this.onlineUsers.get(userId.toString());
    if (socketId && this.io) {
      console.log(`📤 Emitting ${event} to user ${userId} (socket: ${socketId})`);
      try {
        this.io.to(socketId).emit(event, data);
        return true;
      } catch (emitError) {
        console.error(`❌ Error emitting to user ${userId}:`, emitError.message);
        return false;
      }
    } else {
      console.log(`⚠️ User ${userId} not connected, cannot emit ${event}`);
      return false;
    }
  }

  // FIXED: Emit to conversation with better targeting
  emitToConversation(chatId, event, data) {
    if (this.io) {
      console.log(`📡 Emitting ${event} to chat room ${chatId}`);
      
      // For non-message events (typing, read receipts, etc.)
      if (!['new_message', 'new_customer_to_store_message', 'new_store_to_customer_message'].includes(event)) {
        try {
          this.io.to(`chat_${chatId}`).emit(event, data);
          return true;
        } catch (emitError) {
          console.error(`❌ Error emitting to chat room:`, emitError.message);
          return false;
        }
      } else {
        // For message events, use targeted routing
        console.log('🎯 Using targeted routing for message event');
        return this.notifyRelevantUsersForChat(chatId, event, data);
      }
    }
    return false;
  }

  // FIXED: Mark messages as delivered for customer↔store chats
  async markMessagesAsDelivered(chatId, userId, userType) {
    try {
      const { Message } = sequelize.models;
      
      let updateCondition = {
        chat_id: chatId,
        sender_id: { [Op.ne]: userId },
        status: 'sent'
      };

      // FIXED: Mark based on who joined
      if (userType === 'customer') {
        // Customer joined → mark store messages as delivered
        updateCondition.sender_type = 'store';
      } else if (userType === 'merchant') {
        // Merchant joined → mark customer messages as delivered
        updateCondition.sender_type = 'user';
      }
      
      const updatedCount = await Message.update(
        { status: 'delivered' },
        { where: updateCondition }
      );

      if (updatedCount[0] > 0) {
        console.log(`📬 Marked ${updatedCount[0]} messages as delivered for ${userType}`);
        
        this.emitToConversation(chatId, 'messages_delivered', {
          chatId,
          deliveredBy: userId,
          userType,
          timestamp: new Date(),
          count: updatedCount[0]
        });
      }
    } catch (error) {
      console.error('Error marking messages as delivered:', error);
    }
  }

  // FIXED: Broadcast user status with customer↔store awareness
  async broadcastUserOnlineStatus(userId, userType, isOnline) {
    try {
      console.log(`📡 Broadcasting ${userType} ${userId} status: ${isOnline ? 'online' : 'offline'}`);
      
      if (userType === 'merchant') {
        // Notify customers who have chats with this merchant's stores
        const merchantStores = this.merchantStores.get(userId) || [];
        
        if (merchantStores.length > 0) {
          const { Chat } = sequelize.models;
          
          // Find all customers who have chats with this merchant's stores
          const customerChats = await Chat.findAll({
            where: { storeId: { [Op.in]: merchantStores } },
            attributes: ['userId'],
            group: ['userId']
          });
          
          const customerIds = customerChats.map(chat => chat.userId);
          
          console.log(`📡 Notifying ${customerIds.length} customers about merchant's store status`);
          
          customerIds.forEach(customerId => {
            this.emitToUser(customerId, 'merchant_store_status_update', {
              merchantId: userId,
              storeIds: merchantStores,
              isOnline,
              timestamp: new Date().toISOString(),
              type: 'store_owner_status'
            });
          });
        }
      } else if (userType === 'customer') {
        // Notify merchants whose stores this customer has chats with
        const { Chat, Store } = sequelize.models;
        
        const customerChats = await Chat.findAll({
          where: { userId },
          include: [
            {
              model: Store,
              as: 'store',
              attributes: ['id', 'merchant_id']
            }
          ]
        });
        
        const merchantIds = [...new Set(customerChats.map(chat => chat.store?.merchant_id).filter(Boolean))];
        
        console.log(`📡 Notifying ${merchantIds.length} merchants about customer status`);
        
        merchantIds.forEach(merchantId => {
          this.emitToUser(merchantId, 'customer_store_status_update', {
            customerId: userId,
            isOnline,
            timestamp: new Date().toISOString(),
            type: 'customer_status'
          });
        });
      }
    } catch (error) {
      console.error('Error broadcasting user status:', error.message);
    }
  }

  // Enhanced method for new conversation notifications
  notifyNewCustomerStoreConversation(chatId, customerData, storeData, merchantId, initialMessage) {
    console.log(`🆕 Notifying merchant ${merchantId} of new customer↔store conversation`);
    
    const notificationData = {
      type: 'new_customer_store_conversation',
      chatId,
      customer: customerData,
      store: storeData,
      initialMessage,
      timestamp: new Date().toISOString()
    };

    // Notify the merchant
    this.emitToUser(merchantId, 'new_customer_store_conversation', notificationData);
    
    // Also emit to store room
    this.io.to(`store_${storeData.id}`).emit('new_conversation', notificationData);
    
    // General merchant notification
    this.io.to(`merchant_${merchantId}`).emit('new_conversation', notificationData);
  }

  // Broadcast system message with store context
  broadcastSystemMessage(message, targetRole = null, storeId = null) {
    if (!this.io) return;

    console.log('📢 Broadcasting system message:', { message, targetRole, storeId });

    try {
      const systemMessage = {
        message,
        timestamp: new Date(),
        targetRole,
        storeId
      };

      if (storeId) {
        // Send to specific store
        this.io.to(`store_${storeId}`).emit('system_message', systemMessage);
      } else if (targetRole) {
        // Send to specific user role
        this.userRoles.forEach((role, userId) => {
          if (role === targetRole) {
            this.emitToUser(userId, 'system_message', systemMessage);
          }
        });
      } else {
        // Send to all connected users
        this.io.emit('system_message', systemMessage);
      }
    } catch (error) {
      console.error('Error broadcasting system message:', error);
    }
  }

  // Utility methods
  isUserOnline(userId) {
    return this.onlineUsers.has(userId.toString());
  }

  getOnlineUsersCount() {
    return this.onlineUsers.size;
  }

  getOnlineUsersByRole(role) {
    const onlineUsersOfRole = [];
    this.userRoles.forEach((userRole, userId) => {
      if (userRole === role && this.isUserOnline(userId)) {
        onlineUsersOfRole.push(userId);
      }
    });
    return onlineUsersOfRole;
  }

  isInitialized() {
    return this.initialized;
  }

  getStats() {
    return {
      isInitialized: this.initialized,
      onlineUsers: this.onlineUsers.size,
      chatRooms: this.chatRooms.size,
      userRoles: Object.fromEntries(this.userRoles),
      merchantStores: Object.fromEntries(this.merchantStores),
      onlineUsersByRole: {
        customers: this.getOnlineUsersByRole('customer').length,
        merchants: this.getOnlineUsersByRole('merchant').length
      }
    };
  }

  getDebugInfo() {
    return {
      onlineUsersCount: this.onlineUsers.size,
      onlineUsers: Array.from(this.onlineUsers.keys()),
      userRoles: Object.fromEntries(this.userRoles),
      merchantStores: Object.fromEntries(this.merchantStores),
      chatRoomsCount: this.chatRooms.size
    };
  }

  async close() {
    if (this.io) {
      console.log('🧹 Cleaning up socket connections...');
      this.io.close();
      this.initialized = false;
      console.log('Socket.IO server closed');
    }
  }
}

// Create singleton instance
const socketManager = new SocketManager();

module.exports = { socketManager };