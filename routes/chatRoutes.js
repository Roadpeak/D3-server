// routes/chatRoutes.js
const express = require('express');
const { Chat, Message } = require('../models');
const router = express.Router();

// Create or retrieve a chat
router.post('/', async (req, res) => {
    const { userId, storeId } = req.body;

    try {
        let chat = await Chat.findOne({ where: { userId, storeId } });

        if (!chat) {
            chat = await Chat.create({ userId, storeId });
        }

        res.json(chat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch chat messages
router.get('/:chatId/messages', async (req, res) => {
    try {
        const messages = await Message.findAll({
            where: { chatId: req.params.chatId },
            order: [['createdAt', 'ASC']],
        });

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark message as read
router.post('/messages/:id/read', async (req, res) => {
    try {
        const message = await Message.findByPk(req.params.id);

        if (!message) {
            return res.status(404).send('Message not found');
        }

        message.isRead = true;
        await message.save();

        res.json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
