const express = require('express');
const {
    createOrRetrieveChat,
    fetchMessages,
    markMessageAsRead,
    getChats,
    saveMessage,
} = require('../controllers/chatController');
const router = express.Router();

router.post('/', createOrRetrieveChat);
router.post('/messages', saveMessage);
router.get('/:chatId/messages', fetchMessages);
router.post('/messages/:id/read', markMessageAsRead);
router.get('/', getChats);

module.exports = router;
