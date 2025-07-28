// controllers/chatController.js - ENHANCED with comprehensive debugging
const { sequelize } = require('../models/index');
const { socketManager } = require('../socket/websocket');
const { Op } = require('sequelize');

class ChatController {
  // Get chats for a user (customer view)
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

      console.log('📂 Loading chats for customer user:', userId);

      const chats = await Chat.findAll({
        where: { userId },
        include: [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url', 'category'],
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

      console.log('💬 Found customer chats:', chats.length);

      const formattedChats = await Promise.all(
        chats.map(async (chat) => {
          const unreadCount = await Message.count({
            where: {
              chat_id: chat.id,
              sender_type: 'merchant',
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
              online: false
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

  // Get chats for a merchant (store view)
  async getMerchantChats(req, res) {
    try {
      const merchantId = req.user.id;
      const { Chat, User, Store, Message } = sequelize.models;
  
      console.log('🏪 === MERCHANT ID DEBUG SESSION ===');
      console.log('🏪 Request user object:', {
        id: req.user.id,
        email: req.user.email,
        type: req.user.type,
        userType: req.user.userType,
        merchant_id: req.user.merchant_id,
        profileId: req.user.profileId,
        allKeys: Object.keys(req.user)
      });
  
      if (!merchantId) {
        return res.status(400).json({
          success: false,
          message: 'Merchant ID is required'
        });
      }
  
      console.log('🔍 TESTING MULTIPLE ID FIELDS FOR STORE LOOKUP:');
      
      // Test all possible ID fields from the user object
      const possibleIds = [
        req.user.id,
        req.user.merchant_id,
        req.user.profileId,
        req.user.userId
      ].filter(Boolean);
  
      console.log('🔍 Testing these IDs:', possibleIds);
  
      let workingMerchantId = null;
      let stores = [];
  
      // Try each possible ID
      for (const testId of possibleIds) {
        console.log(`\n🧪 Testing merchant_id: ${testId} (type: ${typeof testId})`);
        
        try {
          const testStores = await Store.findAll({
            where: { merchant_id: testId },
            order: [['createdAt', 'DESC']],
            limit: 10 // Limit to prevent huge output
          });
  
          console.log(`   📊 Found ${testStores.length} stores with merchant_id: ${testId}`);
          
          if (testStores.length > 0) {
            console.log('   ✅ SUCCESS! This ID works');
            console.log('   📋 Store details:', testStores.map(s => ({
              id: s.id,
              name: s.name,
              merchant_id: s.merchant_id,
              is_active: s.is_active
            })));
            
            workingMerchantId = testId;
            stores = testStores;
            break;
          } else {
            console.log('   ❌ No stores found with this ID');
          }
        } catch (testError) {
          console.log(`   💥 Error testing ID ${testId}:`, testError.message);
        }
      }
  
      // If no working ID found, let's check what merchant_ids actually exist
      if (!workingMerchantId) {
        console.log('\n🔍 NO WORKING ID FOUND - Let\'s see what merchant_ids exist in stores table:');
        
        try {
          const allStores = await Store.findAll({
            attributes: ['id', 'name', 'merchant_id', 'is_active'],
            limit: 20
          });
          
          console.log('🏪 Sample stores in database:');
          allStores.forEach(store => {
            console.log(`   Store: ${store.name} | merchant_id: ${store.merchant_id} | active: ${store.is_active}`);
          });
  
          // Get unique merchant_ids
          const uniqueMerchantIds = [...new Set(allStores.map(s => s.merchant_id))];
          console.log('🔍 Unique merchant_ids in stores table:', uniqueMerchantIds);
          
        } catch (dbError) {
          console.log('💥 Error checking database:', dbError.message);
        }
  
        // Return empty result with debug info
        return res.status(200).json({
          success: true,
          data: [],
          message: 'No stores found for this merchant.',
          debug: {
            testedIds: possibleIds,
            userObject: req.user,
            suggestion: 'Check merchant ID mapping between user profile and stores table'
          }
        });
      }
  
      // If we found stores, continue with the normal flow
      console.log(`\n✅ Using working merchant_id: ${workingMerchantId}`);
      console.log(`🏬 Found ${stores.length} store(s) for merchant`);
  
      // Filter for active stores only
      const activeStores = stores.filter(store => store.is_active);
      console.log(`🏬 Active stores: ${activeStores.length}`);
  
      if (activeStores.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          message: 'No active stores found for this merchant.'
        });
      }
  
      const storeIds = activeStores.map(store => store.id);
      console.log('🏬 Store IDs for chat lookup:', storeIds);
  
      // Continue with normal chat loading...
      const chats = await Chat.findAll({
        where: { 
          storeId: { [Op.in]: storeIds }
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'avatar', 'email', 'createdAt'],
            required: true
          },
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name'],
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
  
      console.log('💬 Found merchant chats:', chats.length);
  
      // Format chats (rest of the existing code...)
      const formattedChats = await Promise.all(
        chats.map(async (chat) => {
          const customer = chat.user;
          const orderCount = await this.getCustomerOrderCount(customer.id, chat.storeId);
          const customerSince = new Date(customer.createdAt).getFullYear();
  
          const unreadCount = await Message.count({
            where: {
              chat_id: chat.id,
              sender_type: 'user',
              status: { [Op.ne]: 'read' }
            }
          });
  
          const lastMessage = chat.messages && chat.messages.length > 0 ? chat.messages[0] : null;
  
          return {
            id: chat.id,
            customer: {
              id: customer.id,
              name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown Customer',
              avatar: customer.avatar || null,
              customerSince,
              orderCount,
              priority: orderCount > 20 ? 'vip' : 'regular'
            },
            store: {
              id: chat.store.id,
              name: chat.store.name
            },
            lastMessage: lastMessage ? lastMessage.content : '',
            lastMessageTime: lastMessage ? this.formatTime(lastMessage.createdAt) : this.formatTime(chat.updatedAt),
            unreadCount: unreadCount || 0,
            online: false
          };
        })
      );
  
      console.log('✅ Returning formatted merchant chats:', formattedChats.length);
  
      res.status(200).json({
        success: true,
        data: formattedChats,
        debug: {
          workingMerchantId: workingMerchantId,
          storesFound: stores.length,
          activeStores: activeStores.length,
          chatsFound: chats.length
        }
      });
  
    } catch (error) {
      console.error('Error fetching merchant chats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch merchant chats',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  // Get messages with proper error handling
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
  
      console.log('🔍 Finding chat by ID...');
      const chat = await Chat.findByPk(chatId);
  
      if (!chat) {
        console.log('❌ Chat not found:', chatId);
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }
  
      console.log('✅ Chat found:', {
        id: chat.id,
        userId: chat.userId,
        storeId: chat.storeId
      });
  
      // Validate access permissions
      let hasAccess = false;
      
      if ((userType === 'user' || userType === 'customer') && chat.userId === userId) {
        hasAccess = true;
        console.log('✅ User access granted - customer owns chat');
      } else if (userType === 'merchant') {
        const store = await Store.findByPk(chat.storeId);
        hasAccess = store && store.merchant_id === userId;
        
        if (hasAccess) {
          console.log('✅ Merchant access granted - owns store');
        } else {
          console.log('❌ Merchant access denied - does not own store');
        }
      }
  
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
  
      console.log('📋 Fetching messages...');
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
  
      console.log(`✅ Found ${messages.length} messages`);
  
      // Mark messages as read
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
          sender: msg.sender_type,
          senderInfo: senderInfo,
          timestamp: this.formatTime(msg.createdAt),
          status: msg.status,
          messageType: msg.messageType
        };
      });
  
      console.log(`✅ Returning ${formattedMessages.length} formatted messages`);
  
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

  // ENHANCED: Send message with comprehensive debugging
  async sendMessage(req, res) {
    try {
      const { conversationId: chatId, content, messageType = 'text' } = req.body;
      const senderId = req.user.id;
      const userType = req.user.type || req.user.userType;
      const { Chat, Message, User, Store, Merchant } = sequelize.models;
  
      console.log('🚀 === ENHANCED SEND MESSAGE DEBUG ===');
      console.log('📤 Sending message:', {
        chatId,
        senderId,
        userType,
        contentLength: content?.length,
        timestamp: new Date().toISOString()
      });
  
      if (!chatId || !content) {
        return res.status(400).json({
          success: false,
          message: 'Chat ID and content are required'
        });
      }
  
      console.log('🔍 Validating chat access...');
      const chat = await Chat.findByPk(chatId);
  
      if (!chat) {
        console.log('❌ Chat not found:', chatId);
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }
  
      console.log('🔍 Getting chat participants...');
      const [customer, store] = await Promise.all([
        User.findByPk(chat.userId, {
          attributes: ['id', 'firstName', 'lastName', 'email', 'userType']
        }),
        Store.findByPk(chat.storeId, {
          attributes: ['id', 'name', 'logo_url', 'merchant_id']
        })
      ]);

      // Get merchant info
      let merchant = null;
      if (store && store.merchant_id) {
        if (Merchant) {
          merchant = await Merchant.findByPk(store.merchant_id, {
            attributes: ['id', 'firstName', 'lastName', 'email']
          });
        }
        
        if (!merchant) {
          merchant = await User.findOne({
            where: { 
              id: store.merchant_id,
              userType: 'merchant'
            },
            attributes: ['id', 'firstName', 'lastName', 'email', 'userType']
          });
        }
      }

      console.log('✅ Chat participants found:', {
        customer: customer ? `${customer.firstName} ${customer.lastName} (ID: ${customer.id})` : 'Unknown',
        store: store ? `${store.name} (ID: ${store.id})` : 'Unknown',
        merchant: merchant ? `${merchant.firstName} ${merchant.lastName} (ID: ${merchant.id})` : 'Unknown',
        merchantId: store?.merchant_id
      });
  
      // Determine sender type and verify access
      let senderType = 'user';
      let hasAccess = false;
      let recipientId = null;
      let recipientType = null;
  
      if ((userType === 'user' || userType === 'customer') && chat.userId === senderId) {
        hasAccess = true;
        senderType = 'user';
        recipientId = store?.merchant_id;
        recipientType = 'merchant';
        console.log('✅ Customer access granted for sending');
        console.log('🎯 Message will be sent to merchant:', recipientId);
      } else if (userType === 'merchant') {
        hasAccess = store && store.merchant_id === senderId;
        if (hasAccess) {
          senderType = 'merchant';
          recipientId = chat.userId;
          recipientType = 'customer';
          console.log('✅ Merchant access granted for sending');
          console.log('🎯 Message will be sent to customer:', recipientId);
        } else {
          console.log('❌ Merchant access denied for sending');
          console.log('🔍 Debug - Store merchant_id:', store?.merchant_id, 'Sender ID:', senderId);
        }
      }
  
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      if (!recipientId) {
        console.error('❌ No recipient identified for message');
        return res.status(400).json({
          success: false,
          message: 'Unable to identify message recipient'
        });
      }
  
      console.log('💬 Creating message...');
      const message = await Message.create({
        chat_id: chatId,
        sender_id: senderId,
        sender_type: senderType,
        content: content.trim(),
        messageType,
        status: 'sent'
      });
      console.log('✅ Message created with ID:', message.id);
  
      // Update chat's last message time
      try {
        await chat.update({
          lastMessageAt: new Date()
        });
        console.log('✅ Chat timestamp updated');
      } catch (updateError) {
        console.error('⚠️ Failed to update chat timestamp:', updateError);
      }
  
      // Get sender info
      let senderInfo = {
        id: senderId,
        name: 'Unknown',
        avatar: null
      };
  
      try {
        const sender = await User.findByPk(senderId, {
          attributes: ['id', 'firstName', 'lastName', 'avatar']
        });
        if (sender) {
          senderInfo = {
            id: sender.id,
            name: `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Unknown',
            avatar: sender.avatar || null
          };
        }
      } catch (senderError) {
        console.log('⚠️ Could not fetch sender info:', senderError);
      }
  
      // Format message for response and socket events
      const formattedMessage = {
        id: message.id,
        text: message.content,
        sender: message.sender_type,
        senderInfo: senderInfo,
        timestamp: this.formatTime(message.createdAt),
        status: message.status,
        messageType: message.messageType,
        conversationId: chatId,
        chatInfo: {
          customer: customer ? {
            id: customer.id,
            name: `${customer.firstName} ${customer.lastName}`,
            avatar: customer.avatar
          } : null,
          store: store ? {
            id: store.id,
            name: store.name,
            logo: store.logo_url
          } : null,
          merchant: merchant ? {
            id: merchant.id,
            name: `${merchant.firstName} ${merchant.lastName}`,
            avatar: merchant.avatar
          } : { id: store?.merchant_id }
        }
      };
  
      console.log('✅ Message formatted successfully');
  
      // ENHANCED: Socket event emission with comprehensive debugging
      try {
        if (socketManager && socketManager.isInitialized()) {
          console.log('🔊 === SOCKET EVENT EMISSION DEBUG ===');
          console.log('🔊 Socket manager is initialized');
          
          // Check if recipient is online
          const isRecipientOnline = socketManager.isUserOnline(recipientId);
          console.log(`🔊 Recipient ${recipientId} (${recipientType}) online status:`, isRecipientOnline);
          
          // Get socket manager debug info
          const debugInfo = socketManager.getDebugInfo();
          console.log('🔊 Socket manager debug info:', {
            onlineUsersCount: debugInfo.onlineUsersCount,
            onlineUsers: debugInfo.onlineUsers,
            userRoles: debugInfo.userRoles
          });
          
          if (senderType === 'user') {
            // Customer sent message - notify ONLY the merchant
            console.log(`📧 === CUSTOMER MESSAGE TO MERCHANT ===`);
            console.log(`📧 Notifying merchant ${recipientId} of new customer message`);
            
            // Primary event
            const emitResult1 = socketManager.emitToUser(recipientId, 'new_customer_message', {
              ...formattedMessage,
              type: 'customer_message',
              priority: 'high',
              chatId,
              customer: {
                id: customer.id,
                name: `${customer.firstName} ${customer.lastName}`,
                avatar: customer.avatar
              },
              store: {
                id: store.id,
                name: store.name
              }
            });
            console.log('📧 new_customer_message emit result:', emitResult1);
            
            // Secondary event
            const emitResult2 = socketManager.emitToUser(recipientId, 'new_message', {
              ...formattedMessage,
              type: 'customer_message'
            });
            console.log('📧 new_message emit result:', emitResult2);
            
            // Chat update event
            const unreadCount = await this.getUnreadCountForMerchant(chatId, recipientId);
            const emitResult3 = socketManager.emitToUser(recipientId, 'merchant_chat_update', {
              action: 'new_message',
              chatId,
              customerId: chat.userId,
              storeId: store.id,
              message: formattedMessage,
              unreadCount: unreadCount
            });
            console.log('📧 merchant_chat_update emit result:', emitResult3);
            
            // Also try broadcasting to all sockets (debug)
            console.log('🔊 Broadcasting debug event to all connections');
            socketManager.io.emit('debug_customer_message', {
              message: 'Customer message sent',
              targetMerchant: recipientId,
              chatId: chatId,
              content: content.substring(0, 50)
            });
            
          } else if (senderType === 'merchant') {
            // Merchant sent message - notify ONLY the customer
            console.log(`📧 === MERCHANT REPLY TO CUSTOMER ===`);
            console.log(`📧 Notifying customer ${recipientId} of new merchant reply`);
            
            // Primary event
            const emitResult1 = socketManager.emitToUser(recipientId, 'new_merchant_message', {
              ...formattedMessage,
              type: 'merchant_message',
              priority: 'normal',
              chatId,
              store: {
                id: store.id,
                name: store.name,
                logo: store.logo_url
              },
              merchant: {
                id: senderId,
                name: senderInfo.name
              }
            });
            console.log('📧 new_merchant_message emit result:', emitResult1);
            
            // Secondary event
            const emitResult2 = socketManager.emitToUser(recipientId, 'new_message', {
              ...formattedMessage,
              type: 'merchant_message'
            });
            console.log('📧 new_message emit result:', emitResult2);
            
            // Chat update event
            const unreadCount = await this.getUnreadCountForCustomer(chatId, recipientId);
            const emitResult3 = socketManager.emitToUser(recipientId, 'customer_chat_update', {
              action: 'new_message',
              chatId,
              storeId: store.id,
              merchantId: senderId,
              message: formattedMessage,
              unreadCount: unreadCount
            });
            console.log('📧 customer_chat_update emit result:', emitResult3);
          }
          
          console.log('✅ All socket events attempted');
        } else {
          console.log('⚠️ Socket manager not initialized');
        }
      } catch (socketError) {
        console.error('⚠️ Socket emission failed:', socketError);
      }
  
      console.log('🎉 === MESSAGE SEND COMPLETE ===');
      res.status(201).json({
        success: true,
        data: formattedMessage
      });
  
    } catch (error) {
      console.error('💥 Error sending message:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ENHANCED: Start conversation with better debugging
  async startConversation(req, res) {
    try {
      const { storeId, initialMessage = '' } = req.body;
      const userId = req.user.id;
      const userType = req.user.type || req.user.userType;
      const { Chat, Message, Store, User } = sequelize.models;
  
      console.log('🆕 === START CONVERSATION DEBUG ===');
      console.log('🆕 Starting conversation request:', {
        userId,
        userType,
        storeId,
        hasInitialMessage: !!initialMessage,
        timestamp: new Date().toISOString()
      });
  
      if (userType !== 'user' && userType !== 'customer') {
        console.log('❌ Non-user trying to start conversation:', userType);
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
  
      console.log('✅ Store found:', {
        id: store.id,
        name: store.name,
        merchant_id: store.merchant_id
      });
  
      // Find or create chat
      let chat = await Chat.findOne({
        where: {
          userId,
          storeId: store.id
        }
      });
  
      let created = false;
      if (!chat) {
        console.log('🆕 Creating new chat...');
        chat = await Chat.create({
          userId,
          storeId: store.id,
          lastMessageAt: new Date()
        });
        created = true;
        console.log('✅ New chat created with ID:', chat.id);
      } else {
        console.log('✅ Existing chat found with ID:', chat.id);
      }
  
      // Send initial message if provided
      if (initialMessage && initialMessage.trim()) {
        console.log('📨 Sending initial message...');
        try {
          const message = await Message.create({
            chat_id: chat.id,
            sender_id: userId,
            sender_type: 'user',
            content: initialMessage.trim(),
            messageType: 'text',
            status: 'sent'
          });
  
          await chat.update({
            lastMessageAt: new Date()
          });
  
          console.log('✅ Initial message sent with ID:', message.id);
  
          // ENHANCED: Socket events for initial message with debugging
          if (socketManager && socketManager.isInitialized()) {
            const customer = await User.findByPk(userId, {
              attributes: ['id', 'firstName', 'lastName', 'avatar', 'email']
            });
            
            const messageData = {
              id: message.id,
              text: message.content,
              sender: 'user',
              senderInfo: {
                id: customer.id,
                name: `${customer.firstName} ${customer.lastName}`,
                avatar: customer.avatar
              },
              timestamp: this.formatTime(message.createdAt),
              status: message.status,
              messageType: message.messageType,
              conversationId: chat.id
            };

            if (store.merchant_id) {
              console.log(`🔔 === INITIAL MESSAGE NOTIFICATION ===`);
              console.log(`🔔 Notifying merchant ${store.merchant_id} of new conversation`);
              
              // Check if merchant is online
              const isMerchantOnline = socketManager.isUserOnline(store.merchant_id);
              console.log(`🔔 Merchant ${store.merchant_id} online status:`, isMerchantOnline);
              
              // Emit new conversation event
              const conversationResult = socketManager.emitToUser(store.merchant_id, 'new_conversation', {
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
                created: created
              });
              console.log('🔔 new_conversation emit result:', conversationResult);
              
              // Emit new message event
              const messageResult = socketManager.emitToUser(store.merchant_id, 'new_customer_message', {
                ...messageData,
                type: 'customer_message',
                priority: 'high',
                isInitialMessage: true,
                customer: {
                  id: customer.id,
                  name: `${customer.firstName} ${customer.lastName}`,
                  avatar: customer.avatar
                },
                store: {
                  id: store.id,
                  name: store.name
                }
              });
              console.log('🔔 new_customer_message emit result:', messageResult);
              
              // Also emit general new_message event
              const generalResult = socketManager.emitToUser(store.merchant_id, 'new_message', {
                ...messageData,
                type: 'customer_message'
              });
              console.log('🔔 new_message emit result:', generalResult);
              
              // Broadcast debug event
              socketManager.io.emit('debug_new_conversation', {
                message: 'New conversation started',
                customerId: userId,
                merchantId: store.merchant_id,
                chatId: chat.id,
                storeName: store.name
              });
              
              console.log('✅ All initial message events emitted');
            } else {
              console.log('❌ No merchant_id found for store');
            }
          } else {
            console.log('⚠️ Socket manager not available for initial message');
          }
        } catch (messageError) {
          console.error('⚠️ Failed to send initial message:', messageError);
        }
      }
  
      const response = {
        success: true,
        data: {
          conversationId: chat.id,
          message: created ? 'Chat started successfully' : 'Chat already exists',
          created,
          store: {
            id: store.id,
            name: store.name,
            logo: store.logo_url
          }
        }
      };
  
      console.log('✅ Conversation response:', response);
      res.status(created ? 201 : 200).json(response);
  
    } catch (error) {
      console.error('💥 Error starting chat:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start chat',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Mark messages as read
  async markMessagesAsRead(chatId, userId, userType) {
    try {
      const { Message } = sequelize.models;

      console.log('📖 Marking messages as read:', {
        chatId,
        userId,
        userType
      });

      const updateCondition = {
        chat_id: chatId,
        sender_id: { [Op.ne]: userId },
        status: { [Op.ne]: 'read' }
      };

      if (userType === 'user' || userType === 'customer') {
        updateCondition.sender_type = 'merchant';
      } else if (userType === 'merchant') {
        updateCondition.sender_type = 'user';
      }

      const updatedCount = await Message.update(
        { status: 'read' },
        { where: updateCondition }
      );

      console.log(`📖 Marked ${updatedCount[0]} messages as read for ${userType} ${userId} in chat ${chatId}`);

      // Emit read receipt
      try {
        if (socketManager && socketManager.emitToConversation) {
          socketManager.emitToConversation(chatId, 'messages_read', {
            readBy: userId,
            userType: userType,
            timestamp: new Date()
          });
        }
      } catch (socketError) {
        console.error('⚠️ Socket read receipt failed:', socketError);
      }
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
    }
  }

  // Helper method to get unread count for merchant
  async getUnreadCountForMerchant(chatId, merchantId) {
    try {
      const { Message } = sequelize.models;
      return await Message.count({
        where: {
          chat_id: chatId,
          sender_type: 'user',
          status: { [Op.ne]: 'read' }
        }
      });
    } catch (error) {
      console.error('Error getting unread count for merchant:', error);
      return 0;
    }
  }

  // Helper method to get unread count for customer  
  async getUnreadCountForCustomer(chatId, customerId) {
    try {
      const { Message } = sequelize.models;
      return await Message.count({
        where: {
          chat_id: chatId,
          sender_type: 'merchant',
          status: { [Op.ne]: 'read' }
        }
      });
    } catch (error) {
      console.error('Error getting unread count for customer:', error);
      return 0;
    }
  }

  // Update message status (delivered/read)
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

  // Get conversation analytics (for merchants)
  async getConversationAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const userType = req.user.type || req.user.userType;
      const { Chat, Message, Store } = sequelize.models;

      console.log('📊 Getting analytics for user:', userId, 'type:', userType);

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

      const [
        totalChats,
        totalMessages,
        unreadMessages
      ] = await Promise.all([
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
            sender_type: 'user',
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

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const messagesByDay = await Message.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('Message.createdAt')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('Message.id')), 'count']
        ],
        where: {
          createdAt: { [Op.gte]: sevenDaysAgo }
        },
        include: [{
          model: Chat,
          as: 'chat',
          where: { storeId: { [Op.in]: storeIds } },
          attributes: []
        }],
        group: [sequelize.fn('DATE', sequelize.col('Message.createdAt'))],
        order: [[sequelize.fn('DATE', sequelize.col('Message.createdAt')), 'ASC']]
      });

      res.status(200).json({
        success: true,
        data: {
          totalChats,
          totalMessages,
          unreadMessages,
          averageResponseTime: Math.floor(Math.random() * 30) + 5,
          topCustomers: [],
          messagesByDay: messagesByDay.map(item => ({
            date: item.getDataValue('date'),
            count: parseInt(item.getDataValue('count'))
          })),
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

  // Search conversations
  async searchConversations(req, res) {
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

      console.log('🔍 Searching conversations:', { query, type, userId, userType });

      let whereCondition = {};
      let includeConditions = [];

      if (userType === 'user' || userType === 'customer') {
        whereCondition.userId = userId;
        includeConditions = [
          {
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'logo_url', 'category'],
            where: {
              name: { [Op.iLike]: `%${query}%` }
            }
          },
          {
            model: Message,
            as: 'messages',
            attributes: ['content', 'createdAt', 'sender_type'],
            where: type === 'all' ? {} : {
              content: { [Op.iLike]: `%${query}%` }
            },
            limit: 1,
            order: [['createdAt', 'DESC']],
            required: false
          }
        ];
      } else if (userType === 'merchant') {
        const stores = await Store.findAll({
          where: { merchant_id: userId },
          order: [['createdAt', 'DESC']]
        });

        if (stores.length === 0) {
          return res.status(200).json({
            success: true,
            data: []
          });
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
          },
          {
            model: Message,
            as: 'messages',
            attributes: ['content', 'createdAt', 'sender_type'],
            where: type === 'all' ? {} : {
              content: { [Op.iLike]: `%${query}%` }
            },
            limit: 1,
            order: [['createdAt', 'DESC']],
            required: false
          }
        ];
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const chats = await Chat.findAll({
        where: whereCondition,
        include: includeConditions,
        order: [['lastMessageAt', 'DESC']],
        limit: 50
      });

      const formattedResults = chats.map(chat => {
        const lastMessage = chat.messages && chat.messages.length > 0 ? chat.messages[0] : null;
        
        if (userType === 'user' || userType === 'customer') {
          return {
            id: chat.id,
            type: 'conversation',
            store: {
              id: chat.store.id,
              name: chat.store.name,
              avatar: chat.store.logo_url,
              category: chat.store.category
            },
            lastMessage: lastMessage ? lastMessage.content : '',
            lastMessageTime: lastMessage ? this.formatTime(lastMessage.createdAt) : this.formatTime(chat.updatedAt),
            matchType: 'store_name'
          };
        } else {
          return {
            id: chat.id,
            type: 'conversation',
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
            lastMessage: lastMessage ? lastMessage.content : '',
            lastMessageTime: lastMessage ? this.formatTime(lastMessage.createdAt) : this.formatTime(chat.updatedAt),
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

  // Helper methods
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
}

// Create instance and export properly bound methods
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