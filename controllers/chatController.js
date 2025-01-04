const { Chat, Message, User, Store } = require('../models');

// Create or retrieve a chat
const createOrRetrieveChat = async (req, res) => {
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
};

const getChats = async (req, res) => {
    const { userId, storeId } = req.query;

    try {
        let chats;
        if (userId) {
            chats = await Chat.findAll({
                where: { userId },
                include: [
                    {
                        model: User,
                        as: 'user',
                        attributes: ['firstName', 'lastName', 'email', 'phoneNumber'],
                    },
                    {
                        model: Store,
                        as: 'store',
                        attributes: ['name', 'location', 'phone_number', 'logo_url'],
                    }
                ],
            });
        } else if (storeId) {
            // Fetch chats by storeId with the store and user data
            chats = await Chat.findAll({
                where: { storeId },
                include: [
                    {
                        model: User,
                        as: 'user',
                        attributes: ['firstName', 'lastName', 'email', 'phoneNumber'],
                    },
                    {
                        model: Store,
                        as: 'store',
                        attributes: ['name', 'location', 'phone_number', 'logo_url'],
                    }
                ],
            });
        } else {
            return res.status(400).json({ error: 'userId or storeId must be provided' });
        }

        const formattedChats = chats.map(chat => ({
            id: chat.id,
            user: {
                firstName: chat.user.firstName,
                lastName: chat.user.lastName,
                email: chat.user.email,
                phoneNumber: chat.user.phoneNumber,
            },
            store: {
                name: chat.store.name,
                location: chat.store.location,
                phoneNumber: chat.store.phone_number,
                logo: chat.store.logo_url,
            },
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
        }));

        res.json(formattedChats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const saveMessage = async (req, res) => {
    const { chatId, senderType, content } = req.body;

    try {
        const message = await Message.create({
            chatId,
            senderType,
            content,
        });

        res.json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const fetchMessages = async (req, res) => {
    try {
        const messages = await Message.findAll({
            where: { chatId: req.params.chatId },
            order: [['createdAt', 'ASC']],
        });

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const markMessageAsRead = async (req, res) => {
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
};

module.exports = {
    createOrRetrieveChat,
    getChats,
    saveMessage,
    fetchMessages,
    markMessageAsRead,
};
