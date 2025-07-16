// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Import your existing auth middleware
const { verifyToken, authenticateUser, authenticateMerchant, optionalAuth } = require('../middleware/auth');

// Customer routes - Users can start conversations and view their conversations
router.get('/conversations', verifyToken, chatController.getUserConversations);
router.post('/conversations', verifyToken, chatController.startConversation);

// Merchant routes - Merchants can view their store conversations and analytics
router.get('/merchant/conversations', verifyToken, chatController.getMerchantConversations);
router.get('/analytics', verifyToken, chatController.getConversationAnalytics);

// Shared routes - Both users and merchants can access these
router.get('/conversations/:conversationId/messages', verifyToken, chatController.getMessages);
router.post('/messages', verifyToken, chatController.sendMessage);
router.put('/messages/:messageId/status', verifyToken, chatController.updateMessageStatus);

// Mark messages as read endpoint
router.post('/conversations/:conversationId/read', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    
    await chatController.markMessagesAsRead(conversationId, userId);
    
    res.status(200).json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
});

// Search routes
router.get('/search', verifyToken, chatController.searchConversations);

// Health check for chat system
router.get('/health', (req, res) => {
  const { socketManager } = require('../socket/websocket');
  
  res.status(200).json({
    success: true,
    status: 'Chat system operational',
    socketConnected: socketManager.isInitialized(),
    onlineUsers: socketManager.getOnlineUsersCount(),
    timestamp: new Date().toISOString()
  });
});

// Get online status of users
router.get('/users/online', verifyToken, (req, res) => {
  const { socketManager } = require('../socket/websocket');
  const { userIds } = req.query;
  
  if (!userIds) {
    return res.status(400).json({
      success: false,
      message: 'userIds parameter required'
    });
  }

  const userIdArray = userIds.split(',').map(id => parseInt(id));
  const onlineStatus = {};
  
  userIdArray.forEach(userId => {
    onlineStatus[userId] = socketManager.isUserOnline(userId);
  });

  res.status(200).json({
    success: true,
    data: onlineStatus
  });
});

// Send typing indicators
router.post('/conversations/:conversationId/typing', verifyToken, (req, res) => {
  const { conversationId } = req.params;
  const { action } = req.body; // 'start' or 'stop'
  const { socketManager } = require('../socket/websocket');
  
  if (action === 'start') {
    socketManager.emitToConversation(conversationId, 'typing_start', {
      userId: req.user.id,
      conversationId
    });
  } else if (action === 'stop') {
    socketManager.emitToConversation(conversationId, 'typing_stop', {
      userId: req.user.id,
      conversationId
    });
  }

  res.status(200).json({
    success: true,
    message: `Typing ${action} sent`
  });
});

// Broadcast system message (admin only)
router.post('/system/broadcast', verifyToken, (req, res) => {
  // Check if user is admin
  if (req.user.userType !== 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  const { message, targetRole } = req.body;
  const { socketManager } = require('../socket/websocket');
  
  socketManager.broadcastSystemMessage(message, targetRole);
  
  res.status(200).json({
    success: true,
    message: 'System message broadcasted'
  });
});

// Get conversation participants
router.get('/conversations/:conversationId/participants', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { sequelize } = require('../models/index');
    const { Conversation, User, Store } = sequelize.models;

    const conversation = await Conversation.findByPk(conversationId, {
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'isOnline']
        },
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'avatar', 'isOnline'],
          include: [
            {
              model: User,
              as: 'owner',
              attributes: ['id', 'firstName', 'lastName', 'avatar', 'isOnline']
            }
          ]
        }
      ]
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Verify access - user must be customer or store owner
    const hasAccess = conversation.customerId === req.user.id || 
                     (conversation.store.owner && conversation.store.owner.id === req.user.id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        customer: conversation.customer,
        store: conversation.store,
        merchant: conversation.store.owner
      }
    });
  } catch (error) {
    console.error('Error fetching conversation participants:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch participants'
    });
  }
});

// Update conversation settings (merchants only)
router.put('/conversations/:conversationId/settings', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { priority, tags, notes } = req.body;
    const { sequelize } = require('../models/index');
    const { Conversation, Store } = sequelize.models;

    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check if user is the merchant (only merchants can update settings)
    const store = await Store.findOne({ 
      where: { id: conversation.storeId, ownerId: req.user.id } 
    });
    
    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'Only store owners can update conversation settings'
      });
    }

    const updateData = {};
    if (priority) updateData.customerPriority = priority;
    if (tags) updateData.tags = tags;
    if (notes !== undefined) updateData.notes = notes;

    await conversation.update(updateData);

    res.status(200).json({
      success: true,
      message: 'Conversation settings updated',
      data: conversation
    });
  } catch (error) {
    console.error('Error updating conversation settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update conversation settings'
    });
  }
});

// Get message history with pagination
router.get('/conversations/:conversationId/messages/history', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50, before } = req.query;
    const { sequelize } = require('../models/index');
    const { Conversation, Message, User, Store } = sequelize.models;

    // Verify access to conversation
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    let hasAccess = conversation.customerId === req.user.id;
    if (!hasAccess) {
      const store = await Store.findOne({ 
        where: { id: conversation.storeId, ownerId: req.user.id } 
      });
      hasAccess = !!store;
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    let whereCondition = { conversationId };
    if (before) {
      whereCondition.createdAt = { [sequelize.Op.lt]: new Date(before) };
    }

    const messages = await Message.findAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'firstName', 'lastName', 'avatar']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    const formattedMessages = messages.reverse().map(msg => ({
      id: msg.id,
      text: msg.content,
      sender: msg.senderType,
      senderInfo: {
        id: msg.sender.id,
        name: `${msg.sender.firstName} ${msg.sender.lastName}`,
        avatar: msg.sender.avatar
      },
      timestamp: msg.createdAt,
      status: msg.status,
      messageType: msg.messageType
    }));

    res.status(200).json({
      success: true,
      data: formattedMessages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: messages.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch message history'
    });
  }
});

module.exports = router;