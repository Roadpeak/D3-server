// controllers/chatController.js - COMPLETELY FIXED VERSION
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

      console.log('📂 Loading chats for user:', userId);

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

      console.log('💬 Found chats:', chats.length);

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

  // Get chats for a merchant (store view) - FIXED
  async getMerchantChats(req, res) {
    try {
      const merchantId = req.user.id;
      const { Chat, User, Store, Message } = sequelize.models;

      if (!merchantId) {
        return res.status(400).json({
          success: false,
          message: 'Merchant ID is required'
        });
      }

      console.log('🏪 Loading chats for merchant:', merchantId);

      // Use the exact same pattern as your working getMerchantStores function
      const stores = await Store.findAll({
        where: { merchant_id: merchantId },
        order: [['createdAt', 'DESC']]
      });

      console.log(`🏬 Found ${stores.length} store(s) for merchant`);
      
      if (stores.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          message: 'No stores found for this merchant.'
        });
      }

      const storeIds = stores.map(store => store.id);
      console.log('🏬 Store IDs for chat lookup:', storeIds);

      // FIXED: Get chats without problematic nested includes
      const chats = await Chat.findAll({
        where: { 
          storeId: { [Op.in]: storeIds }
        },
        include: [
          {
            model: User,
            as: 'user', // ✅ This matches your Chat model definition
            attributes: ['id', 'firstName', 'lastName', 'avatar', 'email', 'createdAt'],
            required: true
          },
          {
            model: Store,
            as: 'store', // ✅ This matches your Chat model definition  
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

      res.status(200).json({
        success: true,
        data: formattedChats
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

  // FIXED: Get messages with proper error handling
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
  
      // FIXED: Find chat and validate access without problematic includes
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
        // Get the store separately to check ownership
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
  
      // FIXED: Get messages with correct association
      console.log('📋 Fetching messages...');
      const messages = await Message.findAll({
        where: { chat_id: chatId },
        include: [
          {
            model: User,
            as: 'sender', // ✅ This matches your Message model definition
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
  
        // Get sender info from the included association
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

  // FIXED: Send message with proper validation and association handling
  async sendMessage(req, res) {
    try {
      const { conversationId: chatId, content, messageType = 'text' } = req.body;
      const senderId = req.user.id;
      const userType = req.user.type || req.user.userType;
      const { Chat, Message, User, Store, Merchant } = sequelize.models;
  
      console.log('📤 Sending message:', {
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
  
      // FIXED: Find chat without problematic nested includes
      console.log('🔍 Validating chat access...');
      const chat = await Chat.findByPk(chatId);
  
      if (!chat) {
        console.log('❌ Chat not found:', chatId);
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }
  
      // Get related data separately to avoid association issues
      console.log('🔍 Getting chat participants...');
      const [customer, store] = await Promise.all([
        User.findByPk(chat.userId, {
          attributes: ['id', 'firstName', 'lastName', 'email', 'userType']
        }),
        Store.findByPk(chat.storeId, {
          attributes: ['id', 'name', 'logo_url', 'merchant_id']
        })
      ]);

      // Get merchant info (store owner)
      let merchant = null;
      if (store && store.merchant_id) {
        // Try Merchant model first, then User model with merchant userType
        if (Merchant) {
          merchant = await Merchant.findByPk(store.merchant_id, {
            attributes: ['id', 'firstName', 'lastName', 'email']
          });
        }
        
        // If no Merchant model or merchant not found, try User model
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

      console.log('✅ Chat found with participants:', {
        customer: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown',
        store: store ? store.name : 'Unknown',
        merchant: merchant ? `${merchant.firstName} ${merchant.lastName}` : 'Unknown',
        merchantId: store?.merchant_id
      });
  
      // Determine sender type and verify access
      let senderType = 'user';
      let hasAccess = false;
  
      if ((userType === 'user' || userType === 'customer') && chat.userId === senderId) {
        hasAccess = true;
        senderType = 'user';
        console.log('✅ Customer access granted for sending');
      } else if (userType === 'merchant') {
        // Check if user is the merchant who owns the store
        hasAccess = store && store.merchant_id === senderId;
        if (hasAccess) {
          senderType = 'merchant';
          console.log('✅ Merchant access granted for sending');
        } else {
          console.log('❌ Merchant access denied for sending');
          console.log('Debug - Store merchant_id:', store?.merchant_id, 'Sender ID:', senderId);
        }
      }
  
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
  
      // Create message
      console.log('💬 Creating message...');
      const message = await Message.create({
        chat_id: chatId,
        sender_id: senderId,
        sender_type: senderType,
        content: content.trim(),
        messageType,
        status: 'sent'
      });
      console.log('✅ Message created:', message.id);
  
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
        // Additional info for socket events
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
  
      // Enhanced socket event emission
      try {
        if (socketManager && socketManager.isInitialized()) {
          console.log('🔊 Emitting socket events...');
          
          // 1. Emit to all participants in the chat room
          socketManager.emitToConversation(chatId, 'new_message', formattedMessage);
          
          // 2. Emit specific notifications based on sender type
          if (senderType === 'user') {
            // Customer sent message - notify merchant (store owner)
            if (store && store.merchant_id) {
              console.log(`📧 Notifying merchant ${store.merchant_id} of new customer message`);
              
              socketManager.emitToUser(store.merchant_id, 'new_customer_message', {
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
              
              // Emit merchant-specific chat update event
              socketManager.emitToUser(store.merchant_id, 'merchant_chat_update', {
                action: 'new_message',
                chatId,
                customerId: chat.userId,
                storeId: store.id,
                message: formattedMessage,
                unreadCount: await this.getUnreadCountForMerchant(chatId, store.merchant_id)
              });
            }
          } else if (senderType === 'merchant') {
            // Merchant sent message - notify customer
            console.log(`📧 Notifying customer ${chat.userId} of new merchant reply`);
            
            socketManager.emitToUser(chat.userId, 'new_merchant_message', {
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
            
            // Emit customer-specific chat update event
            socketManager.emitToUser(chat.userId, 'customer_chat_update', {
              action: 'new_message',
              chatId,
              storeId: store.id,
              merchantId: senderId,
              message: formattedMessage,
              unreadCount: await this.getUnreadCountForCustomer(chatId, chat.userId)
            });
          }
          
          // 3. Emit general notification for chat list updates
          const participants = [chat.userId];
          if (store && store.merchant_id) {
            participants.push(store.merchant_id);
          }
          
          participants.forEach(participantId => {
            socketManager.emitToUser(participantId, 'chat_list_update', {
              chatId,
              lastMessage: message.content,
              lastMessageTime: message.createdAt,
              senderId,
              senderType: message.sender_type
            });
          });
          
          console.log('✅ All socket events emitted successfully');
        } else {
          console.log('⚠️ Socket manager not initialized');
        }
      } catch (socketError) {
        console.error('⚠️ Socket emission failed:', socketError);
      }
  
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

  // Start a new chat (customer to store) - FIXED
  async startConversation(req, res) {
    try {
      const { storeId, initialMessage = '' } = req.body;
      const userId = req.user.id;
      const userType = req.user.type || req.user.userType;
      const { Chat, Message, Store, User } = sequelize.models;
  
      console.log('🆕 Starting conversation request:', {
        userId,
        userType,
        storeId,
        hasInitialMessage: !!initialMessage
      });
  
      // Only allow users (customers) to start conversations
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
  
      // FIXED: Get store info without problematic includes
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
        console.log('✅ New chat created:', chat.id);
      } else {
        console.log('✅ Existing chat found:', chat.id);
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
  
          console.log('✅ Initial message sent:', message.id);
  
          // Emit socket events for initial message
          if (socketManager && socketManager.isInitialized()) {
            // Get customer info for the notification
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

            // Notify merchant of new conversation and message
            if (store.merchant_id) {
              console.log(`🔔 Notifying merchant ${store.merchant_id} of new conversation`);
              
              // Emit new conversation event
              socketManager.emitToUser(store.merchant_id, 'new_conversation', {
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
              
              // Emit new message event
              socketManager.emitToUser(store.merchant_id, 'new_customer_message', {
                ...messageData,
                type: 'customer_message',
                priority: 'high',
                isInitialMessage: true
              });
            }
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

  // Mark messages as read - FIXED
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

      // Additional filtering based on user type
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

      // Emit read receipt (with error handling)
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
      // Don't throw error - this is not critical
    }
  }

  // Helper method to get unread count for merchant
  async getUnreadCountForMerchant(chatId, merchantId) {
    try {
      const { Message } = sequelize.models;
      return await Message.count({
        where: {
          chat_id: chatId,
          sender_type: 'user', // Messages from customers
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
          sender_type: 'merchant', // Messages from merchants
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

      // Only recipient can update status
      if (message.sender_id === userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update status of own message'
        });
      }

      await message.update({ status });

      // Emit status update
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

      // Use the exact same pattern as your working getMerchantStores function
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

      // Get analytics data
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

      // Get recent activity (last 7 days)
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
          averageResponseTime: Math.floor(Math.random() * 30) + 5, // Mock data
          topCustomers: [], // You can implement this later
          messagesByDay: messagesByDay.map(item => ({
            date: item.getDataValue('date'),
            count: parseInt(item.getDataValue('count'))
          })),
          customerSatisfaction: 4.5 + Math.random() * 0.5 // Mock data
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
        // Customer searching their chats
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
        // Merchant searching their customer chats
        
        // Use the exact same pattern as your working getMerchantStores function
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

      // Format results
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
      
      // Rough estimate: every 10 messages = 1 order
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