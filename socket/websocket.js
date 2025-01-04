// socket/websocket.js
const WebSocket = require('ws');
const { Message } = require('../models'); // Adjust path as needed

const webSocketServer = new WebSocket.Server({ noServer: true });

webSocketServer.on('connection', (socket, req) => {
    console.log('New WebSocket connection established');

    socket.on('message', async (data) => {
        try {
            const message = JSON.parse(data);

            // Save the message to the database
            const newMessage = await Message.create({
                chatId: message.chatId,
                senderType: message.senderType,
                content: message.content,
            });

            // Broadcast the message to the relevant parties
            webSocketServer.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(newMessage));
                }
            });
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    });
});

module.exports = webSocketServer;
