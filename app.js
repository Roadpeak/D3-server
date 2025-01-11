const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const storeRoutes = require('./routes/storeRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const userRoutes = require('./routes/userRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const { sequelize } = require('./models/index');
const uploadRoutes = require('./routes/upload');
const paymentRoutes = require('./routes/paymentRoutes');
const staffRoutes = require('./routes/staffRoutes');
const serviceFormsRoutes = require('./routes/serviceForms');
const offerRoutes = require('./routes/offerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const socialRoutes = require('./routes/socialsRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const formRoutes = require('./routes/formRoutes');
const formFieldRoutes = require('./routes/formFieldRoutes');
const formResponseRoutes = require('./routes/formResponses');
const followRoutes = require('./routes/followRoutes');
const likeRoutes = require('./routes/likeRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const chatRoutes = require('./routes/chatRoutes');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const swaggerFile = path.join(__dirname, 'swagger_output.json');

require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1', merchantRoutes);
app.use('/api/v1', storeRoutes);
app.use('/api/v1', serviceRoutes);
app.use('/api/v1', uploadRoutes);
app.use('/api/v1', paymentRoutes);
app.use('/api/v1', staffRoutes);
app.use('/api/v1', offerRoutes);
app.use('/api/v1', bookingRoutes);
app.use('/api/v1', socialRoutes);
app.use('/api/v1', reviewRoutes);
app.use('/api/v1', categoryRoutes);
app.use('/api/v1', serviceFormsRoutes);
app.use('/api/v1', transactionRoutes);
app.use('/api/v1', followRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/likes', likeRoutes);
app.use('/api/v1/forms', formRoutes);
app.use('/api/v1/form-fields', formFieldRoutes);
app.use('/api/v1/form-responses', formResponseRoutes);
app.use('/qrcodes', express.static(path.join(__dirname, 'public', 'qrcodes')));

app.use(
  '/api/v1/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(JSON.parse(fs.readFileSync(swaggerFile, 'utf8')))
);

// Database Sync
sequelize
  .sync({ alter: true })
  .then(() => {
    console.log('Database connected and synced');
  })
  .catch((err) => {
    console.error('Error syncing database: ', err);
  });

// Create HTTP Server
const server = http.createServer(app);

// WebSocket Setup
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');

  // Handle the status update (merchant comes online)
  ws.on('message', (message) => {
    const parsedMessage = JSON.parse(message);

    // If it's a status update, handle the merchant's online status
    if (parsedMessage.type === 'status') {
      const { storeId, status } = parsedMessage;

      // Save the status or handle it in any other way if needed
      console.log(`Merchant ${storeId} is now ${status}`);

      // Broadcast to all connected clients
      wss.clients.forEach((client) => {
        if (client.readyState === ws.OPEN) { // Use ws.OPEN here
          client.send(JSON.stringify({
            type: 'merchant_status',
            storeId,
            status,
          }));
        }
      });
    }
    // Handle messages here (like chat messages)
    else {
      // Broadcast other types of messages (e.g., chat messages)
      wss.clients.forEach((client) => {
        if (client.readyState === ws.OPEN) { // Use ws.OPEN here
          client.send(JSON.stringify(parsedMessage));
        }
      });
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    // Handle merchant going offline (need storeId tracking logic)
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
