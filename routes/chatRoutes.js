const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { verifyToken, authorizeRole } = require('../middleware/auth');

// Create or retrieve chat -> startConversation
router.post('/',
    verifyToken,
    authorizeRole(['User']),
    (req, res) => {
        console.log('POST / route hit');
        console.log('req.user:', req.user);
        console.log('req.body:', req.body);

        // Check if the method exists before calling
        if (typeof chatController.startConversation === 'function') {
            return chatController.startConversation(req, res);
        } else {
            console.error('startConversation method not found');
            return res.status(500).json({ error: 'Method not found' });
        }
    }
);

// Save message -> sendMessage
router.post('/messages',
    verifyToken,
    (req, res) => {
        console.log('POST /messages route hit');
        console.log('req.user:', req.user);
        console.log('req.body:', req.body);

        if (typeof chatController.sendMessage === 'function') {
            return chatController.sendMessage(req, res);
        } else {
            console.error('sendMessage method not found');
            return res.status(500).json({ error: 'Method not found' });
        }
    }
);

// Fetch messages -> getMessages (but need to handle chatId vs conversationId)
router.get('/:chatId/messages',
    verifyToken,
    (req, res) => {
        console.log('GET /:chatId/messages route hit');
        console.log('req.params:', req.params);

        // Map chatId to conversationId parameter
        req.params.conversationId = req.params.chatId;

        if (typeof chatController.getMessages === 'function') {
            return chatController.getMessages(req, res);
        } else {
            console.error('getMessages method not found');
            return res.status(500).json({ error: 'Method not found' });
        }
    }
);

// Mark message as read -> updateMessageStatus
router.post('/messages/:id/read',
    verifyToken,
    (req, res) => {
        console.log('POST /messages/:id/read route hit');
        console.log('req.params:', req.params);

        // Map id to messageId and set status to read
        req.params.messageId = req.params.id;
        req.body.status = 'read';

        if (typeof chatController.updateMessageStatus === 'function') {
            return chatController.updateMessageStatus(req, res);
        } else {
            console.error('updateMessageStatus method not found');
            return res.status(500).json({ error: 'Method not found' });
        }
    }
);

// Get chats -> getUserConversations or getMerchantConversations based on role
router.get('/',
    verifyToken,
    authorizeRole(['User', 'merchant']),
    (req, res) => {
        console.log('GET / route hit');
        console.log('req.user:', req.user);

        if (req.user.role === 'User') {
            if (typeof chatController.getUserConversations === 'function') {
                return chatController.getUserConversations(req, res);
            } else {
                console.error('getUserConversations method not found');
                return res.status(500).json({ error: 'Method not found' });
            }
        } else {
            if (typeof chatController.getMerchantConversations === 'function') {
                return chatController.getMerchantConversations(req, res);
            } else {
                console.error('getMerchantConversations method not found');
                return res.status(500).json({ error: 'Method not found' });
            }
        }
    }
);

module.exports = router;