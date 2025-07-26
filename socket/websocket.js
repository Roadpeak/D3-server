// socket/websocket.js - Fixed authentication with comprehensive error handling
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

    // Enhanced authentication middleware with comprehensive error handling
    this.io.use(async (socket, next) => {
      try {
        console.log('🔐 Socket authentication attempt...');
        
        // Get token from multiple possible locations
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

        // Verify JWT token with detailed error handling
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

        // Extract user ID from different possible token structures
        let userId = decoded.userId || decoded.id;
        
        if (!userId) {
          console.error('❌ No user ID found in token:', decoded);
          return next(new Error('Authentication error: No user ID in token'));
        }

        console.log('🔍 Attempting to find user with ID:', userId);

        let user = null;
        let userType = null;
        let foundInModel = null;

        // Try different approaches to find the user
        const { User, Merchant } = sequelize.models;

        // Method 1: Try based on token type
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

        // Method 2: Fallback - try both models
        if (!user) {
          console.log('🔄 Trying fallback user lookup in both models...');
          
          // Try User model first
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
          
          // Try Merchant model if User not found
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

        // Method 3: Check if models exist
        if (!user) {
          console.log('🔍 Available models:', Object.keys(sequelize.models));
          console.log('🔍 User model exists:', !!User);
          console.log('🔍 Merchant model exists:', !!Merchant);
          
          // Try with exact model names from your database
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

    // Connection handler with better error handling
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

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.userId}:`, error);
      });
    });

    // Global error handling
    this.io.on('error', (error) => {
      console.error('Socket.IO server error:', error);
    });

    this.initialized = true;
    console.log('🚀 Socket.IO server initialized with enhanced authentication');
  }

  // ... (rest of the methods remain the same as before)
  
  // Enhanced method to emit new messages with proper routing
  emitNewMessage(chatId, messageData) {
    console.log(`💬 Emitting new message to chat ${chatId}:`, {
      sender: messageData.sender,
      messageId: messageData.id
    });

    this.io.to(`chat_${chatId}`).emit('new_message', {
      ...messageData,
      conversationId: chatId
    });

    this.notifyRelevantUsersForChat(chatId, 'new_message', messageData);
  }

  // Notify relevant users for a chat
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

      if (chat.userId) {
        this.emitToUser(chat.userId, event, data);
      }

      if (chat.store && chat.store.merchant_id) {
        this.emitToUser(chat.store.merchant_id, event, data);
        
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

  // Emit message to specific user
  emitToUser(userId, event, data) {
    const socketId = this.onlineUsers.get(userId.toString());
    if (socketId && this.io) {
      console.log(`📤 Emitting ${event} to user ${userId}`);
      this.io.to(socketId).emit(event, data);
    } else {
      console.log(`⚠️ User ${userId} not connected, cannot emit ${event}`);
    }
  }

  // Enhanced method to emit message to specific chat
  emitToConversation(chatId, event, data) {
    if (this.io) {
      console.log(`📡 Emitting ${event} to chat ${chatId}`);
      this.io.to(`chat_${chatId}`).emit(event, data);
      
      if (['new_message', 'message_status_update'].includes(event)) {
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
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }

  // Broadcast user online/offline status
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

  // Check if user is online
  isUserOnline(userId) {
    return this.onlineUsers.has(userId.toString());
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.onlineUsers.size;
  }

  // Check if socket manager is initialized
  isInitialized() {
    return this.initialized;
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