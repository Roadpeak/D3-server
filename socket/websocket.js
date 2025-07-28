// socket/websocket.js - FIXED: Proper message routing between customers and merchants
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../models/index');

class SocketManager {
  constructor() {
    this.io = null;
    this.initialized = false;
    this.onlineUsers = new Map();
    this.userSockets = new Map();
    this.chatRooms = new Map();
    this.userRoles = new Map();
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
        
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                     socket.handshake.query.token;
        
        console.log('🔍 Token check:', {
          hasAuthToken: !!socket.handshake.auth.token,
          hasHeaderAuth: !!socket.handshake.headers.authorization,
          hasQueryToken: !!socket.handshake.query.token,
          tokenLength: token ? token.length : 0
        });

        if (!token) {
          console.error('❌ No token provided in any location');
          return next(new Error('Authentication error: No token provided'));
        }

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
          console.log('✅ Token decoded successfully:', {
            userId: decoded.userId,
            id: decoded.id,
            type: decoded.type,
            userType: decoded.userType,
            iat: decoded.iat,
            exp: decoded.exp
          });
        } catch (jwtError) {
          console.error('❌ JWT verification failed:', jwtError.message);
          if (jwtError.name === 'TokenExpiredError') {
            return next(new Error('Authentication error: Token expired'));
          } else if (jwtError.name === 'JsonWebTokenError') {
            return next(new Error('Authentication error: Invalid token'));
          } else {
            return next(new Error('Authentication error: Token verification failed'));
          }
        }

        let userId = decoded.userId || decoded.id;
        
        if (!userId) {
          console.error('❌ No user ID found in token:', decoded);
          return next(new Error('Authentication error: No user ID in token'));
        }

        console.log('🔍 Attempting to find user with ID:', userId);

        let user = null;
        let userType = null;
        let foundInModel = null;

        const { User, Merchant } = sequelize.models;

        // Try different approaches to find the user
        if (decoded.type === 'user' || decoded.userType === 'customer') {
          if (User) {
            try {
              user = await User.findByPk(userId, {
                attributes: ['id', 'firstName', 'lastName', 'email', 'userType', 'isOnline', 'lastSeen']
              });
              if (user) {
                userType = 'user';
                foundInModel = 'User';
                console.log('✅ Found user in User model via token type');
              }
            } catch (error) {
              console.log('⚠️ Error querying User model:', error.message);
            }
          }
        } else if (decoded.type === 'merchant' || decoded.userType === 'merchant') {
          if (Merchant) {
            try {
              user = await Merchant.findByPk(userId, {
                attributes: ['id', 'firstName', 'lastName', 'email', 'userType', 'isOnline', 'lastSeen']
              });
              if (user) {
                userType = 'merchant';
                foundInModel = 'Merchant';
                console.log('✅ Found user in Merchant model via token type');
              }
            } catch (error) {
              console.log('⚠️ Error querying Merchant model:', error.message);
            }
          }
        }

        // Fallback - try both models
        if (!user) {
          console.log('🔄 Trying fallback user lookup in both models...');
          
          if (User) {
            try {
              user = await User.findByPk(userId, {
                attributes: ['id', 'firstName', 'lastName', 'email', 'userType', 'isOnline', 'lastSeen']
              });
              if (user) {
                userType = user.userType || 'user';
                foundInModel = 'User';
                console.log('✅ Found user in User model (fallback)');
              }
            } catch (error) {
              console.log('⚠️ Error in User model fallback:', error.message);
            }
          }
          
          if (!user && Merchant) {
            try {
              user = await Merchant.findByPk(userId, {
                attributes: ['id', 'firstName', 'lastName', 'email', 'userType', 'isOnline', 'lastSeen']
              });
              if (user) {
                userType = 'merchant';
                foundInModel = 'Merchant';
                console.log('✅ Found user in Merchant model (fallback)');
              }
            } catch (error) {
              console.log('⚠️ Error in Merchant model fallback:', error.message);
            }
          }
        }

        // Check available models if user not found
        if (!user) {
          console.log('🔍 Available models:', Object.keys(sequelize.models));
          
          const modelNames = Object.keys(sequelize.models);
          for (const modelName of modelNames) {
            if (modelName.toLowerCase().includes('user') || modelName.toLowerCase().includes('merchant')) {
              try {
                const Model = sequelize.models[modelName];
                const testUser = await Model.findByPk(userId, {
                  attributes: ['id', 'firstName', 'lastName', 'email']
                });
                if (testUser) {
                  user = testUser;
                  userType = modelName.toLowerCase().includes('merchant') ? 'merchant' : 'user';
                  foundInModel = modelName;
                  console.log(`✅ Found user in ${modelName} model`);
                  break;
                }
              } catch (error) {
                console.log(`⚠️ Error trying ${modelName}:`, error.message);
              }
            }
          }
        }
        
        if (!user) {
          console.error('❌ User not found in any model:', {
            userId,
            availableModels: Object.keys(sequelize.models),
            hasUserModel: !!User,
            hasMerchantModel: !!Merchant
          });
          return next(new Error('Authentication error: User not found'));
        }

        console.log('✅ User authenticated successfully:', {
          userId: user.id,
          userType,
          foundInModel,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim()
        });

        // Set socket properties
        socket.userId = user.id;
        socket.userRole = userType;
        socket.userEmail = user.email;
        socket.userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        // Store user role for better event routing
        this.userRoles.set(user.id, userType);
        
        // For merchants, get their stores
        if (userType === 'merchant') {
          try {
            const { Store } = sequelize.models;
            if (Store) {
              const stores = await Store.findAll({ 
                where: { merchant_id: user.id },
                attributes: ['id', 'name']
              });
              socket.storeIds = stores.map(store => store.id);
              console.log(`🏪 Merchant ${user.id} manages ${stores.length} stores:`, socket.storeIds);
            }
          } catch (storeError) {
            console.log('⚠️ Error fetching merchant stores:', storeError.message);
            socket.storeIds = [];
          }
        }
        
        next();
      } catch (error) {
        console.error('💥 Socket authentication error:', error);
        next(new Error(`Authentication error: ${error.message}`));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      console.log(`✅ User ${socket.userId} (${socket.userRole}) connected with socket ${socket.id}`);
      
      // Add user to online users
      this.onlineUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, socket.userId);

      // Update user online status in database
      this.updateUserOnlineStatus(socket.userId, socket.userRole, true);

      // Broadcast user online status to relevant users
      this.broadcastUserOnlineStatus(socket.userId, socket.userRole, true);

      // Handle user joining specific conversations
      socket.on('join_conversation', (chatId) => {
        console.log(`📞 User ${socket.userId} (${socket.userRole}) joining chat ${chatId}`);
        
        socket.join(`chat_${chatId}`);
        
        if (!this.chatRooms.has(chatId)) {
          this.chatRooms.set(chatId, new Set());
        }
        this.chatRooms.get(chatId).add(socket.id);
        
        this.markMessagesAsDelivered(chatId, socket.userId);
        
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
        
        if (this.chatRooms.has(chatId)) {
          this.chatRooms.get(chatId).delete(socket.id);
        }
        
        socket.to(`chat_${chatId}`).emit('user_left_chat', {
          userId: socket.userId,
          userRole: socket.userRole,
          chatId
        });
      });

      // Handle typing indicators
      socket.on('typing_start', ({ conversationId, userId }) => {
        socket.to(`chat_${conversationId}`).emit('typing_start', {
          userId: userId || socket.userId,
          userRole: socket.userRole,
          conversationId
        });
      });

      socket.on('typing_stop', ({ conversationId, userId }) => {
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
        
        this.onlineUsers.delete(socket.userId);
        this.userSockets.delete(socket.id);
        const userRole = this.userRoles.get(socket.userId);
        this.userRoles.delete(socket.userId);
        
        this.updateUserOnlineStatus(socket.userId, userRole, false);
        
        this.chatRooms.forEach((sockets, chatId) => {
          sockets.delete(socket.id);
        });
        
        this.broadcastUserOnlineStatus(socket.userId, userRole, false);
      });

      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.userId}:`, error);
      });
    });

    this.io.on('error', (error) => {
      console.error('Socket.IO server error:', error);
    });

    this.initialized = true;
    console.log('🚀 Socket.IO server initialized with enhanced authentication');
  }

  // FIXED: Enhanced method to emit new messages with proper routing
  emitNewMessage(chatId, messageData) {
    console.log(`💬 Emitting new message to chat ${chatId}:`, {
      sender: messageData.sender,
      messageId: messageData.id,
      senderType: messageData.sender_type || messageData.sender
    });

    // CRITICAL FIX: Do NOT emit to chat room (this causes messages to appear in sender's interface)
    // Instead, use targeted notifications based on message routing
    console.log('🚫 Skipping chat room broadcast to prevent duplicate messages');

    // The controller will handle targeted notifications via notifyRelevantUsersForChat
    this.notifyRelevantUsersForChat(chatId, 'new_message', messageData);
  }

  // FIXED: Notify relevant users for a chat - targeted notifications only
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

      console.log('🎯 Notifying relevant users for chat:', {
        chatId,
        customerId: chat.userId,
        merchantId: chat.store?.merchant_id,
        event,
        messageSender: data.sender || data.sender_type
      });

      // FIXED: Only notify the RECIPIENT of the message, not the sender
      if (data.sender === 'user' || data.sender_type === 'user') {
        // Customer sent message - notify ONLY merchant
        if (chat.store && chat.store.merchant_id) {
          console.log(`📧 Notifying ONLY merchant ${chat.store.merchant_id} of customer message`);
          this.emitToUser(chat.store.merchant_id, event, data);
        }
      } else if (data.sender === 'merchant' || data.sender_type === 'merchant') {
        // Merchant sent message - notify ONLY customer
        if (chat.userId) {
          console.log(`📧 Notifying ONLY customer ${chat.userId} of merchant message`);
          this.emitToUser(chat.userId, event, data);
        }
      }

    } catch (error) {
      console.error('Error notifying relevant users:', error);
    }
  }

  // FIXED: Emit message to specific user with better logging
  emitToUser(userId, event, data) {
    const socketId = this.onlineUsers.get(userId.toString());
    if (socketId && this.io) {
      console.log(`📤 Emitting ${event} to user ${userId} (socket: ${socketId})`);
      this.io.to(socketId).emit(event, data);
      return true;
    } else {
      console.log(`⚠️ User ${userId} not connected, cannot emit ${event}`);
      return false;
    }
  }

  // FIXED: Enhanced method to emit message to specific chat - use sparingly
  emitToConversation(chatId, event, data) {
    if (this.io) {
      console.log(`📡 Emitting ${event} to chat room ${chatId}`);
      
      // CRITICAL: Only use for non-message events like typing, read receipts, etc.
      if (!['new_message', 'new_customer_message', 'new_merchant_message'].includes(event)) {
        this.io.to(`chat_${chatId}`).emit(event, data);
      } else {
        console.log('🚫 Blocked chat room emission for message event - using targeted routing instead');
        this.notifyRelevantUsersForChat(chatId, event, data);
      }
    }
  }

  // Update user's online status in database
  async updateUserOnlineStatus(userId, userRole, isOnline) {
    try {
      if (userRole === 'merchant') {
        const { Merchant } = sequelize.models;
        if (Merchant) {
          await Merchant.update(
            { 
              isOnline,
              lastSeen: isOnline ? null : new Date()
            },
            { where: { id: userId } }
          );
        }

        const { Store } = sequelize.models;
        if (Store) {
          await Store.update(
            {
              isOnline,
              lastSeen: isOnline ? null : new Date()
            },
            { where: { merchant_id: userId } }
          );
        }
      } else {
        const { User } = sequelize.models;
        if (User) {
          await User.update(
            { 
              isOnline,
              lastSeen: isOnline ? null : new Date()
            },
            { where: { id: userId } }
          );
        }
      }
    } catch (error) {
      console.error('Error updating user online status:', error);
    }
  }

  // Mark messages as delivered when user joins chat
  async markMessagesAsDelivered(chatId, userId) {
    try {
      const { Message } = sequelize.models;
      
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
        console.log(`📬 Marked ${updatedCount[0]} messages as delivered`);
        
        // FIXED: Only emit to chat room for delivery status (not new messages)
        this.io.to(`chat_${chatId}`).emit('messages_delivered', {
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
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }

  // FIXED: Broadcast user online/offline status with targeted notifications
  async broadcastUserOnlineStatus(userId, userRole, isOnline) {
    try {
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
      } else if (userRole === 'user') {
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

  // FIXED: Broadcast system message with proper targeting
  broadcastSystemMessage(message, targetRole = null) {
    if (!this.io) return;

    console.log('📢 Broadcasting system message:', { message, targetRole });

    if (targetRole) {
      // Send to specific user role
      this.userRoles.forEach((role, userId) => {
        if (role === targetRole) {
          this.emitToUser(userId, 'system_message', {
            message,
            timestamp: new Date(),
            targetRole
          });
        }
      });
    } else {
      // Send to all connected users
      this.io.emit('system_message', {
        message,
        timestamp: new Date()
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

  // Get online users by role
  getOnlineUsersByRole(role) {
    const onlineUsersOfRole = [];
    this.userRoles.forEach((userRole, userId) => {
      if (userRole === role && this.isUserOnline(userId)) {
        onlineUsersOfRole.push(userId);
      }
    });
    return onlineUsersOfRole;
  }

  // Check if socket manager is initialized
  isInitialized() {
    return this.initialized;
  }

  // FIXED: Get socket statistics for debugging
  getStats() {
    return {
      isInitialized: this.initialized,
      onlineUsers: this.onlineUsers.size,
      chatRooms: this.chatRooms.size,
      userRoles: Object.fromEntries(this.userRoles),
      onlineUsersByRole: {
        customers: this.getOnlineUsersByRole('user').length,
        merchants: this.getOnlineUsersByRole('merchant').length
      }
    };
  }

  // Close socket connections
  async close() {
    if (this.io) {
      for (const [userId, userRole] of this.userRoles.entries()) {
        await this.updateUserOnlineStatus(userId, userRole, false);
      }
      
      this.io.close();
      this.initialized = false;
      console.log('Socket.IO server closed');
    }
  }
}

// Create singleton instance
const socketManager = new SocketManager();

module.exports = { socketManager };