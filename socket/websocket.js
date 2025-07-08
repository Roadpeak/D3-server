// socket/websocket.js
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Message = require('../models/message');
const Conversation = require('../models/Conversation');

class SocketManager {
  constructor() {
    this.io = null;
    this.onlineUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
    this.conversationRooms = new Map(); // conversationId -> Set of socketIds
    this.typingUsers = new Map(); // conversationId -> Set of userIds
  }

  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
          return next(new Error('Authentication error: Invalid token'));
        }

        socket.user = user;
        next();
      } catch (error) {
        console.error('Socket auth error:', error);
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.user.name} (${socket.user.role}) - Socket ID: ${socket.id}`);

      this.handleUserConnection(socket);
      this.setupEventHandlers(socket);
    });

    console.log('Socket.IO server initialized');
  }

  handleUserConnection(socket) {
    const userId = socket.user._id.toString();

    // Store user connection
    this.onlineUsers.set(userId, socket.id);
    this.userSockets.set(socket.id, userId);

    // Join user to their personal room
    socket.join(`user_${userId}`);

    // Join merchant to store room if applicable
    if (socket.user.role === 'merchant' && socket.user.storeId) {
      socket.join(`store_${socket.user.storeId}`);
    }

    // Broadcast online status to relevant users
    this.broadcastUserStatus(userId, 'online');

    // Send current online users to the newly connected user
    socket.emit('online_users', this.getOnlineUsers());
  }

  setupEventHandlers(socket) {
    // Join conversation room
    socket.on('join_conversation', async (data) => {
      await this.handleJoinConversation(socket, data);
    });

    // Leave conversation room
    socket.on('leave_conversation', (data) => {
      this.handleLeaveConversation(socket, data);
    });

    // Handle new message
    socket.on('send_message', async (data) => {
      await this.handleSendMessage(socket, data);
    });

    // Typing indicators
    socket.on('typing_start', (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on('typing_stop', (data) => {
      this.handleTypingStop(socket, data);
    });

    // Message status updates
    socket.on('message_read', async (data) => {
      await this.handleMessageRead(socket, data);
    });

    // Store status updates (for merchants)
    socket.on('store_status_update', (data) => {
      this.handleStoreStatusUpdate(socket, data);
    });

    // Get conversation participants
    socket.on('get_conversation_participants', async (data) => {
      await this.handleGetConversationParticipants(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleUserDisconnect(socket);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.user.name}:`, error);
    });

    // Enhanced store status with merchant online/offline tracking
    socket.on('merchant_status_update', (data) => {
      this.handleMerchantStatusUpdate(socket, data);
    });

    // Generic message handler for backward compatibility
    socket.on('message', (data) => {
      this.handleGenericMessage(socket, data);
    });
  }

  async handleJoinConversation(socket, { conversationId }) {
    try {
      const userId = socket.user._id.toString();

      // Verify user has access to this conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const hasAccess = conversation.participants.includes(userId) ||
        (socket.user.storeId && conversation.storeId.toString() === socket.user.storeId.toString());

      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Join the conversation room
      socket.join(`conversation_${conversationId}`);

      // Track conversation participants
      if (!this.conversationRooms.has(conversationId)) {
        this.conversationRooms.set(conversationId, new Set());
      }
      this.conversationRooms.get(conversationId).add(socket.id);

      // Notify other participants that user joined
      socket.to(`conversation_${conversationId}`).emit('user_joined_conversation', {
        conversationId,
        user: {
          id: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
          role: socket.user.role
        }
      });

      console.log(`User ${socket.user.name} joined conversation ${conversationId}`);
    } catch (error) {
      console.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  }

  handleLeaveConversation(socket, { conversationId }) {
    socket.leave(`conversation_${conversationId}`);

    if (this.conversationRooms.has(conversationId)) {
      this.conversationRooms.get(conversationId).delete(socket.id);

      // Clean up empty conversation rooms
      if (this.conversationRooms.get(conversationId).size === 0) {
        this.conversationRooms.delete(conversationId);
      }
    }

    // Stop typing if user was typing
    this.handleTypingStop(socket, { conversationId });

    // Notify other participants
    socket.to(`conversation_${conversationId}`).emit('user_left_conversation', {
      conversationId,
      userId: socket.user._id
    });

    console.log(`User ${socket.user.name} left conversation ${conversationId}`);
  }

  async handleSendMessage(socket, messageData) {
    try {
      const { conversationId, content, messageType = 'text' } = messageData;
      const senderId = socket.user._id.toString();
      const senderType = socket.user.role;

      // Verify conversation access (same as in controller)
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const hasAccess = conversation.participants.includes(senderId) ||
        (socket.user.storeId && conversation.storeId.toString() === socket.user.storeId.toString());

      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied' });
        return;
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
      await message.populate('sender', 'name avatar');

      // Update conversation
      conversation.lastMessage = message._id;
      conversation.updatedAt = new Date();

      // Update unread counts
      const otherParticipants = senderType === 'customer'
        ? [conversation.storeId.toString()]
        : conversation.participants.filter(p => p.toString() !== senderId);

      otherParticipants.forEach(participantId => {
        const currentCount = conversation.unreadCount.get(participantId) || 0;
        conversation.unreadCount.set(participantId, currentCount + 1);
      });

      await conversation.save();

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
        messageType: message.messageType,
        conversationId
      };

      // Emit to conversation participants
      this.io.to(`conversation_${conversationId}`).emit('new_message', formattedMessage);

      // Update message status to delivered if there are online participants
      const conversationParticipants = this.conversationRooms.get(conversationId);
      if (conversationParticipants && conversationParticipants.size > 1) {
        message.status = 'delivered';
        await message.save();

        formattedMessage.status = 'delivered';
        this.io.to(`conversation_${conversationId}`).emit('message_status_update', {
          messageId: message._id,
          status: 'delivered'
        });
      }

      // Stop typing indicator for sender
      this.handleTypingStop(socket, { conversationId });

      console.log(`Message sent in conversation ${conversationId} by ${socket.user.name}`);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  handleTypingStart(socket, { conversationId }) {
    const userId = socket.user._id.toString();

    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Set());
    }

    this.typingUsers.get(conversationId).add(userId);

    socket.to(`conversation_${conversationId}`).emit('typing_start', {
      conversationId,
      user: {
        id: socket.user._id,
        name: socket.user.name
      }
    });
  }

  handleTypingStop(socket, { conversationId }) {
    const userId = socket.user._id.toString();

    if (this.typingUsers.has(conversationId)) {
      this.typingUsers.get(conversationId).delete(userId);

      if (this.typingUsers.get(conversationId).size === 0) {
        this.typingUsers.delete(conversationId);
      }
    }

    socket.to(`conversation_${conversationId}`).emit('typing_stop', {
      conversationId,
      userId: socket.user._id
    });
  }

  async handleMessageRead(socket, { messageIds, conversationId }) {
    try {
      const userId = socket.user._id.toString();

      // Update message status
      await Message.updateMany(
        {
          _id: { $in: messageIds },
          sender: { $ne: userId }
        },
        { status: 'read' }
      );

      // Reset unread count for this user
      const conversation = await Conversation.findById(conversationId);
      if (conversation) {
        conversation.unreadCount.set(userId, 0);
        await conversation.save();
      }

      // Emit read receipt to conversation
      this.io.to(`conversation_${conversationId}`).emit('messages_read', {
        conversationId,
        messageIds,
        readBy: {
          id: socket.user._id,
          name: socket.user.name
        },
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error marking messages as read:', error);
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  }

  handleStoreStatusUpdate(socket, { status }) {
    if (socket.user.role !== 'merchant' || !socket.user.storeId) {
      socket.emit('error', { message: 'Unauthorized to update store status' });
      return;
    }

    const storeId = socket.user.storeId.toString();

    // Broadcast store status to all clients
    this.io.emit('store_status_update', {
      storeId,
      status,
      timestamp: new Date()
    });

    console.log(`Store ${storeId} status updated to: ${status}`);
  }

  async handleGetConversationParticipants(socket, { conversationId }) {
    try {
      const conversation = await Conversation.findById(conversationId)
        .populate('participants', 'name avatar')
        .populate('storeId', 'name avatar');

      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const participants = [
        ...conversation.participants.map(p => ({
          id: p._id,
          name: p.name,
          avatar: p.avatar,
          role: 'customer',
          online: this.isUserOnline(p._id.toString())
        })),
        {
          id: conversation.storeId._id,
          name: conversation.storeId.name,
          avatar: conversation.storeId.avatar,
          role: 'merchant',
          online: this.isStoreOnline(conversation.storeId._id.toString())
        }
      ];

      socket.emit('conversation_participants', {
        conversationId,
        participants
      });

    } catch (error) {
      console.error('Error getting conversation participants:', error);
      socket.emit('error', { message: 'Failed to get participants' });
    }
  }

  handleUserDisconnect(socket) {
    const userId = this.userSockets.get(socket.id);

    if (userId) {
      // Remove from online users
      this.onlineUsers.delete(userId);
      this.userSockets.delete(socket.id);

      // Clean up conversation rooms
      this.conversationRooms.forEach((participants, conversationId) => {
        if (participants.has(socket.id)) {
          participants.delete(socket.id);

          // Stop typing if user was typing
          if (this.typingUsers.has(conversationId)) {
            this.typingUsers.get(conversationId).delete(userId);
          }

          // Notify other participants
          socket.to(`conversation_${conversationId}`).emit('user_left_conversation', {
            conversationId,
            userId
          });
        }
      });

      // Broadcast offline status
      this.broadcastUserStatus(userId, 'offline');

      console.log(`User ${socket.user?.name || userId} disconnected`);
    }
  }

  // Public methods for external use
  emitToUser(userId, event, data) {
    const socketId = this.onlineUsers.get(userId.toString());
    if (socketId) {
      this.io.to(`user_${userId}`).emit(event, data);
      return true;
    }
    return false;
  }

  emitToConversation(conversationId, event, data) {
    this.io.to(`conversation_${conversationId}`).emit(event, data);
  }

  emitToStore(storeId, event, data) {
    this.io.to(`store_${storeId}`).emit(event, data);
  }

  isUserOnline(userId) {
    return this.onlineUsers.has(userId.toString());
  }

  isStoreOnline(storeId) {
    // Check if any merchant from this store is online
    return Array.from(this.onlineUsers.keys()).some(userId => {
      const socket = this.io.sockets.sockets.get(this.onlineUsers.get(userId));
      return socket?.user?.storeId?.toString() === storeId.toString();
    });
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers.keys());
  }

  getConversationParticipants(conversationId) {
    const participants = this.conversationRooms.get(conversationId);
    return participants ? Array.from(participants) : [];
  }

  // Helper methods
  broadcastUserStatus(userId, status) {
    this.io.emit('user_status_update', {
      userId,
      status,
      timestamp: new Date()
    });
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

  handleMerchantStatusUpdate(socket, { storeId, status }) {
    if (socket.user.role !== 'merchant') {
      socket.emit('error', { message: 'Unauthorized to update merchant status' });
      return;
    }

    console.log(`Merchant ${storeId} is now ${status}`);

    // Broadcast to all connected clients
    this.io.emit('merchant_status', {
      type: 'merchant_status',
      storeId,
      status,
      timestamp: new Date()
    });
  }

  handleGenericMessage(socket, messageData) {
    try {
      const parsedMessage = typeof messageData === 'string'
        ? JSON.parse(messageData)
        : messageData;

      // Handle status updates
      if (parsedMessage.type === 'status') {
        this.handleMerchantStatusUpdate(socket, parsedMessage);
      }
      // Handle other message types
      else if (parsedMessage.type === 'chat') {
        // Route to existing chat handler
        this.handleSendMessage(socket, parsedMessage);
      }
      // Broadcast other types of messages
      else {
        this.io.emit('message', parsedMessage);
      }
    } catch (error) {
      console.error('Error handling generic message:', error);
      socket.emit('error', { message: 'Invalid message format' });
    }
  }

  // Enhanced user connection handling with automatic status broadcasting
  handleUserConnection(socket) {
    const userId = socket.user._id.toString();

    // Store user connection
    this.onlineUsers.set(userId, socket.id);
    this.userSockets.set(socket.id, userId);

    // Join user to their personal room
    socket.join(`user_${userId}`);

    // Join merchant to store room if applicable
    if (socket.user.role === 'merchant' && socket.user.storeId) {
      socket.join(`store_${socket.user.storeId}`);

      // Automatically broadcast merchant coming online
      this.io.emit('merchant_status', {
        type: 'merchant_status',
        storeId: socket.user.storeId,
        status: 'online',
        timestamp: new Date()
      });
    }

    // Broadcast online status to relevant users
    this.broadcastUserStatus(userId, 'online');

    // Send current online users to the newly connected user
    socket.emit('online_users', this.getOnlineUsers());
  }

  // Enhanced disconnect handling
  handleUserDisconnect(socket) {
    const userId = this.userSockets.get(socket.id);

    if (userId) {
      // Remove from online users
      this.onlineUsers.delete(userId);
      this.userSockets.delete(socket.id);

      // If merchant is disconnecting, broadcast offline status
      if (socket.user.role === 'merchant' && socket.user.storeId) {
        this.io.emit('merchant_status', {
          type: 'merchant_status',
          storeId: socket.user.storeId,
          status: 'offline',
          timestamp: new Date()
        });
      }

      // Clean up conversation rooms
      this.conversationRooms.forEach((participants, conversationId) => {
        if (participants.has(socket.id)) {
          participants.delete(socket.id);

          // Stop typing if user was typing
          if (this.typingUsers.has(conversationId)) {
            this.typingUsers.get(conversationId).delete(userId);
          }

          // Notify other participants
          socket.to(`conversation_${conversationId}`).emit('user_left_conversation', {
            conversationId,
            userId
          });
        }
      });

      // Broadcast offline status
      this.broadcastUserStatus(userId, 'offline');

      console.log(`User ${socket.user?.name || userId} disconnected`);
    }
  }

  // Add method to get merchant status
  getMerchantStatus(storeId) {
    return Array.from(this.onlineUsers.keys()).some(userId => {
      const socket = this.io.sockets.sockets.get(this.onlineUsers.get(userId));
      return socket?.user?.storeId?.toString() === storeId.toString() &&
        socket?.user?.role === 'merchant';
    });
  }

  // Add method to get all online merchants
  getOnlineMerchants() {
    const onlineMerchants = [];

    this.onlineUsers.forEach((socketId, userId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket?.user?.role === 'merchant' && socket?.user?.storeId) {
        onlineMerchants.push({
          userId,
          storeId: socket.user.storeId,
          name: socket.user.name,
          socketId
        });
      }
    });

    return onlineMerchants;
  }

}

// Create singleton instance
const socketManager = new SocketManager();

module.exports = {
  socketManager,
  SocketManager
};
