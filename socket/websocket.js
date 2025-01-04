const { Message } = require('../models');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });

let onlineMerchants = {};

wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');

    ws.on('message', async (message) => {
        console.log('Received:', message);
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === 'status') {
            const { storeId, status } = parsedMessage;

            onlineMerchants[storeId] = status;

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'merchant_status',
                        storeId,
                        status,
                    }));
                }
            });
        } else {
            const newMessage = await Message.create({
                chatId: parsedMessage.chatId,
                senderId: parsedMessage.senderId,
                content: parsedMessage.content,
            });

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        chatId: parsedMessage.chatId,
                        message: newMessage,
                    }));
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

module.exports = wss;
