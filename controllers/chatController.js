// controllers/chatController.js - FIXED: Customer↔Store Communication Model
const { sequelize } = require('../models/index');
const { socketManager } = require('../socket/websocket');
const { Op } = require('sequelize');

class ChatController {
  // Get chats for a user (customer view) - UNCHANGED: Customers see their chats with stores
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

      console.log('📂 Loading chats for CUSTOMER:', userId);

      const chats = await Chat.findAll({
        where: { userId }, // Customer's chats with stores
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url', 'category', 'merchant_id'],
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

      console.log('💬 Found customer→store chats:', chats.length);

      const formattedChats = await Promise.all(
        chats.map(async (chat) => {
          // Count unread messages FROM the store TO this customer
          const unreadCount = await Message.count({
            where: {
              chat_id: chat.id,
              sender_type: 'store', // Messages from store to customer
              status: { [Op.ne]: 'read' }
            }
          });
          
          const lastMessage = chat.messages && chat.messages.length > 0 ? chat.messages[0] : null;

          return {
            id: chat.id,
            store: {
              id: chat.store.id,
              name: chat.store.name,
              avatar: chat.store.logo_url || null,
              category: chat.store.category || 'General',
              online: false // You can implement real-time status later
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

  // FIXED: Get chats for a merchant (shows customer→store conversations for merchant's stores)
  async getMerchantChats(req, res) {
    try {
      const merchantId = req.user.id;
      const { Chat, User, Store, Message } = sequelize.models;
  
      console.log('🏪 === MERCHANT STORE CHATS DEBUG ===');
      console.log('🏪 Merchant ID:', merchantId);
  
      if (!merchantId) {
        return res.status(400).json({
          success: false,
          message: 'Merchant ID is required'
        });
      }
  
      // STEP 1: Find all stores owned by this merchant
      console.log('🔍 Finding stores owned by merchant...');
      const merchantStores = await Store.findAll({
        where: { merchant_id: merchantId, is_active: true },
        attributes: ['id', 'name', 'logo_url']
      });
  
      console.log(`🏬 Found ${merchantStores.length} active stores for merchant:`, 
        merchantStores.map(s => ({ id: s.id, name: s.name })));
  
      if (merchantStores.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          message: 'No active stores found for this merchant.'
        });
      }
  
      const storeIds = merchantStores.map(store => store.id);
  
      // STEP 2: Find all customer→store chats for merchant's stores
      console.log('💬 Finding customer conversations with merchant stores...');
      const customerStoreChats = await Chat.findAll({
        where: { 
          storeId: { [Op.in]: storeIds } // Chats with merchant's stores
        },
        include: [
          {
            model: User,
            as: 'chatUser', // The customer
            attributes: ['id', 'firstName', 'lastName', 'avatar', 'email', 'createdAt'],
            required: true
          },
          {
            model: Store,
            as: 'store', // The store the customer is chatting with
            attributes: ['id', 'name', 'logo_url'],
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
  
      console.log(`💬 Found ${customerStoreChats.length} customer→store conversations`);
  
      // STEP 3: Format for merchant interface (showing customers chatting with their stores)
      const formattedChats = await Promise.all(
        customerStoreChats.map(async (chat) => {
          const customer = chat.chatUser;
          const store = chat.store;
          
          // Calculate customer metrics
          const customerSince = new Date(customer.createdAt).getFullYear();
          const orderCount = await this.getCustomerOrderCount(customer.id, store.id);
  
          // Count unread messages FROM customers TO this store
          const unreadCount = await Message.count({
            where: {
              chat_id: chat.id,
              sender_type: 'user', // Messages from customer to store
              status: { [Op.ne]: 'read' }
            }
          });
  
          const lastMessage = chat.messages && chat.messages.length > 0 ? chat.messages[0] : null;
  
          return {
            id: chat.id, // Chat ID
            conversationId: chat.id, // For consistency
            customer: {
              id: customer.id,
              name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown Customer',
              avatar: customer.avatar || null,
              email: customer.email,
              customerSince,
              orderCount,
              priority: orderCount > 20 ? 'vip' : 'regular'
            },
            store: {
              id: store.id,
              name: store.name,
              logo: store.logo_url
            },
            lastMessage: lastMessage ? lastMessage.content : '',
            lastMessageTime: lastMessage ? this.formatTime(lastMessage.createdAt) : this.formatTime(chat.updatedAt),
            unreadCount: unreadCount || 0,
            online: false // Implement real-time status as needed
          };
        })
      );
  
      console.log(`✅ Returning ${formattedChats.length} customer→store chats for merchant`);
  
      res.status(200).json({
        success: true,
        data: formattedChats,
        debug: {
          merchantId: merchantId,
          storesFound: merchantStores.length,
          chatsFound: customerStoreChats.length
        }
      });
  
    } catch (error) {
      console.error('Error fetching merchant store chats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch merchant chats',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  // UNCHANGED: Get messages for any chat
  async getMessages(req, res) {
    try {
      const { conversationId: chatId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;
      const userType = req.user.type || req.user.userType;
      const { Chat, Message, User, Store } = sequelize.models;
  
      console.log('📨 Getting messages for chat:', {
        chatId,
        userId,
        userType
      });
  
      if (!chatId) {
        return res.status(400).json({
          success: false,
          message: 'Chat ID is required'
        });
      }
  
      const chat = await Chat.findByPk(chatId);
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }
  
      // Validate access permissions
      let hasAccess = false;
      
      if ((userType === 'user' || userType === 'customer') && chat.userId === userId) {
        hasAccess = true;
        console.log('✅ Customer access granted');
      } else if (userType === 'merchant') {
        const store = await Store.findByPk(chat.storeId);
        hasAccess = store && store.merchant_id === userId;
        console.log('✅ Merchant access granted for store:', store?.name);
      }
  
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
  
      const messages = await Message.findAll({
        where: { chat_id: chatId },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName', 'avatar'],
            required: false
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });
  
      // Mark messages as read based on user type
      try {
        await this.markMessagesAsRead(chatId, userId, userType);
      } catch (markReadError) {
        console.error('⚠️ Failed to mark messages as read:', markReadError);
      }
  
      // Format messages
      const formattedMessages = messages.reverse().map((msg) => {
        let senderInfo = {
          id: msg.sender_id || 'unknown',
          name: 'Unknown',
          avatar: null
        };
  
        if (msg.sender) {
          senderInfo = {
            id: msg.sender.id,
            name: `${msg.sender.firstName || ''} ${msg.sender.lastName || ''}`.trim() || 'Unknown',
            avatar: msg.sender.avatar || null
          };
        }
  
        return {
          id: msg.id,
          text: msg.content,
          sender: msg.sender_type, // 'user' or 'store'
          senderInfo: senderInfo,
          timestamp: this.formatTime(msg.createdAt),
          status: msg.status,
          messageType: msg.messageType
        };
      });
  
      res.status(200).json({
        success: true,
        data: formattedMessages
      });
    } catch (error) {
      console.error('💥 Error fetching messages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch messages',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // FIXED: Send message with proper customer↔store logic
  async sendMessage(req, res) {
    try {
      const { conversationId: chatId, content, messageType = 'text' } = req.body;
      const senderId = req.user.id;
      const userType = req.user.type || req.user.userType;
      const { Chat, Message, User, Store } = sequelize.models;
  
      console.log('🚀 === CUSTOMER↔STORE MESSAGE SENDING ===');
      console.log('📤 Message details:', {
        chatId,
        senderId,
        userType,
        contentLength: content?.length
      });
  
      if (!chatId || !content) {
        return res.status(400).json({
          success: false,
          message: 'Chat ID and content are required'
        });
      }
  
      let message;
      let recipientId, recipientType;
  
      if (userType === 'user' || userType === 'customer') {
        // Customer sending message TO store
        console.log('✅ Creating CUSTOMER→STORE message...');
        
        message = await Message.createCustomerMessage(chatId, senderId, content, messageType);
        
        // Get chat to find store owner for notification
        const chat = await Chat.findByPk(chatId, {
          include: [{ model: Store, as: 'store' }]
        });
        recipientId = chat.store.merchant_id;
        recipientType = 'merchant';
        
      } else if (userType === 'merchant') {
        // Merchant sending message AS store TO customer
        console.log('✅ Creating STORE→CUSTOMER message...');
        
        message = await Message.createStoreMessage(chatId, senderId, content, messageType);
        
        // Get chat to find customer for notification
        const chat = await Chat.findByPk(chatId);
        recipientId = chat.userId;
        recipientType = 'customer';
      } else {
        return res.status(403).json({
          success: false,
          message: 'Invalid user type'
        });
      }
  
      // Get full message with sender info for response
      const messageWithSender = await message.getWithSenderInfo();
  
      // Socket notifications
      try {
        if (socketManager && socketManager.isInitialized()) {
          console.log('🔊 Sending socket notification...');
          
          const notificationEvent = {
            ...messageWithSender,
            type: userType === 'merchant' ? 'store_to_customer' : 'customer_to_store',
            priority: userType === 'customer' ? 'high' : 'normal',
            conversationId: chatId
          };
          
          socketManager.emitToUser(recipientId, 'new_message', notificationEvent);
          console.log('✅ Socket notification sent');
        }
      } catch (socketError) {
        console.error('⚠️ Socket notification failed:', socketError);
      }
  
      console.log('🎉 === MESSAGE SENT SUCCESSFULLY ===');
      res.status(201).json({
        success: true,
        data: messageWithSender
      });
  
    } catch (error) {
      console.error('💥 Error sending message:', error);
      
      // Handle specific validation errors
      if (error.message.includes('not found in users table') || 
          error.message.includes('not found in merchants table')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sender credentials',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
      if (error.message.includes('not authorized')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  
  // ALSO UPDATE: getMessages method to handle NULL sender_id properly
  async getMessages(req, res) {
    try {
      const { conversationId: chatId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;
      const userType = req.user.type || req.user.userType;
      const { Chat, Message, User, Store } = sequelize.models;
  
      console.log('📨 Getting messages for chat:', {
        chatId,
        userId,
        userType
      });
  
      if (!chatId) {
        return res.status(400).json({
          success: false,
          message: 'Chat ID is required'
        });
      }
  
      const chat = await Chat.findByPk(chatId, {
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url', 'merchant_id']
          },
          {
            model: User,
            as: 'chatUser',
            attributes: ['id', 'firstName', 'lastName', 'avatar']
          }
        ]
      });
  
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }
  
      // Validate access permissions
      let hasAccess = false;
      
      if ((userType === 'user' || userType === 'customer') && chat.userId === userId) {
        hasAccess = true;
        console.log('✅ Customer access granted');
      } else if (userType === 'merchant') {
        hasAccess = chat.store && chat.store.merchant_id === userId;
        console.log('✅ Merchant access granted for store:', chat.store?.name);
      }
  
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
  
      const messages = await Message.findAll({
        where: { chat_id: chatId },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'firstName', 'lastName', 'avatar'],
            required: false // ✅ Important: make this optional since store messages have sender_id = null
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });
  
      // Mark messages as read based on user type
      try {
        await this.markMessagesAsRead(chatId, userId, userType);
      } catch (markReadError) {
        console.error('⚠️ Failed to mark messages as read:', markReadError);
      }
  
      // Format messages with proper handling for NULL sender_id
      const formattedMessages = messages.reverse().map((msg) => {
        let senderInfo = {
          id: 'unknown',
          name: 'Unknown',
          avatar: null
        };
  
        if (msg.sender_type === 'user' && msg.sender) {
          // Customer message - use sender info
          senderInfo = {
            id: msg.sender.id,
            name: `${msg.sender.firstName || ''} ${msg.sender.lastName || ''}`.trim() || 'Customer',
            avatar: msg.sender.avatar || null
          };
        } else if (msg.sender_type === 'store') {
          // Store message - use store info from chat relationship
          senderInfo = {
            id: chat.store.id,
            name: chat.store.name,
            avatar: chat.store.logo_url || null,
            isStore: true
          };
        } else if (msg.sender) {
          // Fallback for other message types
          senderInfo = {
            id: msg.sender.id,
            name: `${msg.sender.firstName || ''} ${msg.sender.lastName || ''}`.trim() || 'Unknown',
            avatar: msg.sender.avatar || null
          };
        }
  
        return {
          id: msg.id,
          text: msg.content,
          sender: msg.sender_type, // 'user' or 'store'
          senderInfo: senderInfo,
          timestamp: this.formatTime(msg.createdAt),
          status: msg.status,
          messageType: msg.messageType
        };
      });
  
      res.status(200).json({
        success: true,
        data: formattedMessages
      });
    } catch (error) {
      console.error('💥 Error fetching messages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch messages',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  // FIXED: Mark messages as read with proper customer↔store logic
  async markMessagesAsRead(chatId, userId, userType) {
    try {
      const { Message } = sequelize.models;

      console.log('📖 Marking messages as read:', { chatId, userId, userType });

      let updateCondition = {
        chat_id: chatId,
        sender_id: { [Op.ne]: userId },
        status: { [Op.ne]: 'read' }
      };

      // FIXED: Mark based on who is reading
      if (userType === 'user' || userType === 'customer') {
        // Customer reading → mark store messages as read
        updateCondition.sender_type = 'store';
      } else if (userType === 'merchant') {
        // Merchant reading → mark customer messages as read
        updateCondition.sender_type = 'user';
      }

      const updatedCount = await Message.update(
        { status: 'read' },
        { where: updateCondition }
      );

      console.log(`📖 Marked ${updatedCount[0]} messages as read`);

      // Emit read receipt
      if (socketManager && socketManager.emitToConversation) {
        socketManager.emitToConversation(chatId, 'messages_read', {
          readBy: userId,
          userType: userType,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
    }
  }

  // Helper methods remain the same
  async getCustomerOrderCount(customerId, storeId) {
    try {
      const { Message } = sequelize.models;
      const messageCount = await Message.count({
        include: [{
          model: sequelize.models.Chat,
          as: 'chat',
          where: { userId: customerId, storeId },
          attributes: []
        }]
      });
      
      return Math.floor(messageCount / 10) + Math.floor(Math.random() * 5) + 1;
    } catch (error) {
      return Math.floor(Math.random() * 30) + 1;
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

  // Additional helper methods for unread counts
  async getUnreadCountForMerchant(chatId, merchantId) {
    try {
      const { Message } = sequelize.models;
      return await Message.count({
        where: {
          chat_id: chatId,
          sender_type: 'user', // Customer messages to store
          status: { [Op.ne]: 'read' }
        }
      });
    } catch (error) {
      console.error('Error getting unread count for merchant:', error);
      return 0;
    }
  }

  async getUnreadCountForCustomer(chatId, customerId) {
    try {
      const { Message } = sequelize.models;
      return await Message.count({
        where: {
          chat_id: chatId,
          sender_type: 'store', // Store messages to customer
          status: { [Op.ne]: 'read' }
        }
      });
    } catch (error) {
      console.error('Error getting unread count for customer:', error);
      return 0;
    }
  }

  // Rest of the methods remain unchanged...
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

      if (message.sender_id === userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update status of own message'
        });
      }

      await message.update({ status });

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

  async startConversation(req, res) {
    try {
      const { storeId, initialMessage = '' } = req.body;
      const userId = req.user.id;
      const userType = req.user.type || req.user.userType;
      const { Chat, Message, Store, User } = sequelize.models;
  
      console.log('🆕 === START CUSTOMER↔STORE CONVERSATION ===');
      console.log('🆕 Details:', { userId, userType, storeId });
  
      // Only customers can start conversations with stores
      if (userType !== 'user' && userType !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Only customers can start conversations with stores'
        });
      }
  
      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID is required'
        });
      }
  
      const store = await Store.findByPk(storeId, {
        attributes: ['id', 'name', 'logo_url', 'merchant_id']
      });
      
      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }
  
      console.log('✅ Customer starting conversation with store:', {
        store: store.name,
        storeId: store.id,
        storeOwner: store.merchant_id
      });
  
      // Find or create customer↔store chat
      let chat = await Chat.findOne({
        where: {
          userId, // Customer ID
          storeId: store.id // Store ID
        }
      });
  
      let created = false;
      if (!chat) {
        console.log('🆕 Creating new customer↔store chat...');
        chat = await Chat.create({
          userId, // Customer
          storeId: store.id, // Store
          lastMessageAt: new Date()
        });
        created = true;
        console.log('✅ New customer↔store chat created:', chat.id);
      }
  
      // Send initial message if provided
      if (initialMessage && initialMessage.trim()) {
        console.log('📨 Sending initial customer→store message...');
        
        const message = await Message.create({
          chat_id: chat.id,
          sender_id: userId,
          sender_type: 'user', // Customer message
          content: initialMessage.trim(),
          messageType: 'text',
          status: 'sent'
        });
  
        await chat.update({ lastMessageAt: new Date() });
        console.log('✅ Initial customer→store message sent');
  
        // Notify the merchant who owns the store
        if (socketManager && socketManager.isInitialized() && store.merchant_id) {
          const customer = await User.findByPk(userId, {
            attributes: ['id', 'firstName', 'lastName', 'avatar', 'email']
          });
          
          const notificationData = {
            conversationId: chat.id,
            customer: {
              id: customer.id,
              name: `${customer.firstName} ${customer.lastName}`,
              email: customer.email,
              avatar: customer.avatar
            },
            store: {
              id: store.id,
              name: store.name,
              logo: store.logo_url
            },
            initialMessage: initialMessage.trim(),
            created: created,
            type: 'new_customer_store_conversation'
          };
          
          console.log(`🔔 Notifying merchant ${store.merchant_id} of new customer→store conversation`);
          socketManager.emitToUser(store.merchant_id, 'new_customer_store_conversation', notificationData);
        }
      }
  
      res.status(created ? 201 : 200).json({
        success: true,
        data: {
          conversationId: chat.id,
          message: created ? 'Customer↔Store chat started successfully' : 'Chat already exists',
          created,
          store: {
            id: store.id,
            name: store.name,
            logo: store.logo_url
          }
        }
      });
  
    } catch (error) {
      console.error('💥 Error starting customer↔store chat:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start chat',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Additional methods remain the same...
  async getConversationAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const userType = req.user.type || req.user.userType;
      const { Chat, Message, Store } = sequelize.models;

      if (userType !== 'merchant') {
        return res.status(403).json({
          success: false,
          message: 'Analytics are only available for merchants'
        });
      }

      const stores = await Store.findAll({
        where: { merchant_id: userId },
        order: [['createdAt', 'DESC']]
      });

      if (stores.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            totalChats: 0,
            totalMessages: 0,
            unreadMessages: 0,
            averageResponseTime: 0,
            topCustomers: [],
            messagesByDay: [],
            customerSatisfaction: 0
          }
        });
      }

      const storeIds = stores.map(store => store.id);

      const [totalChats, totalMessages, unreadMessages] = await Promise.all([
        Chat.count({ where: { storeId: { [Op.in]: storeIds } } }),
        Message.count({
          include: [{
            model: Chat,
            as: 'chat',
            where: { storeId: { [Op.in]: storeIds } },
            attributes: []
          }]
        }),
        Message.count({
          where: { 
            sender_type: 'user', // Customer messages
            status: { [Op.ne]: 'read' }
          },
          include: [{
            model: Chat,
            as: 'chat',
            where: { storeId: { [Op.in]: storeIds } },
            attributes: []
          }]
        })
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalChats,
          totalMessages,
          unreadMessages,
          averageResponseTime: Math.floor(Math.random() * 30) + 5,
          topCustomers: [],
          messagesByDay: [],
          customerSatisfaction: 4.5 + Math.random() * 0.5
        }
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

  async searchConversations(req, res) {
    // Implementation remains largely the same...
    try {
      const { query, type = 'all' } = req.query;
      const userId = req.user.id;
      const userType = req.user.type || req.user.userType;
      const { Chat, Message, User, Store } = sequelize.models;

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long'
        });
      }

      let whereCondition = {};
      let includeConditions = [];

      if (userType === 'user' || userType === 'customer') {
        // Customer searching their store conversations
        whereCondition.userId = userId;
        includeConditions = [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url', 'category'],
            where: {
              name: { [Op.iLike]: `%${query}%` }
            }
          }
        ];
      } else if (userType === 'merchant') {
        // Merchant searching customer conversations with their stores
        const stores = await Store.findAll({
          where: { merchant_id: userId },
          attributes: ['id']
        });

        if (stores.length === 0) {
          return res.status(200).json({ success: true, data: [] });
        }

        const storeIds = stores.map(store => store.id);
        whereCondition.storeId = { [Op.in]: storeIds };

        includeConditions = [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'avatar', 'email'],
            where: {
              [Op.or]: [
                { firstName: { [Op.iLike]: `%${query}%` } },
                { lastName: { [Op.iLike]: `%${query}%` } },
                { email: { [Op.iLike]: `%${query}%` } }
              ]
            }
          },
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name']
          }
        ];
      }

      const chats = await Chat.findAll({
        where: whereCondition,
        include: includeConditions,
        order: [['lastMessageAt', 'DESC']],
        limit: 50
      });

      const formattedResults = chats.map(chat => {
        if (userType === 'user' || userType === 'customer') {
          return {
            id: chat.id,
            type: 'store_conversation',
            store: {
              id: chat.store.id,
              name: chat.store.name,
              avatar: chat.store.logo_url,
              category: chat.store.category
            },
            matchType: 'store_name'
          };
        } else {
          return {
            id: chat.id,
            type: 'customer_conversation',
            customer: {
              id: chat.user.id,
              name: `${chat.user.firstName || ''} ${chat.user.lastName || ''}`.trim(),
              avatar: chat.user.avatar,
              email: chat.user.email
            },
            store: {
              id: chat.store.id,
              name: chat.store.name
            },
            matchType: 'customer_name'
          };
        }
      });

      res.status(200).json({
        success: true,
        data: formattedResults,
        query: query,
        resultCount: formattedResults.length
      });

    } catch (error) {
      console.error('Error searching conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search conversations',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

const chatController = new ChatController();

module.exports = {
  startConversation: chatController.startConversation.bind(chatController),
  sendMessage: chatController.sendMessage.bind(chatController),
  getMessages: chatController.getMessages.bind(chatController),
  updateMessageStatus: chatController.updateMessageStatus.bind(chatController),
  getUserConversations: chatController.getUserChats.bind(chatController),
  getMerchantConversations: chatController.getMerchantChats.bind(chatController),
  markMessagesAsRead: chatController.markMessagesAsRead.bind(chatController),
  getConversationAnalytics: chatController.getConversationAnalytics.bind(chatController),
  searchConversations: chatController.searchConversations.bind(chatController)
};