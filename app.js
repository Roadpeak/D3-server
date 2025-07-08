const express = require('express');
const cors = require('cors');
const http = require('http');
const storesRoutes = require('./routes/storesRoutes');
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
const heroRoutes = require('./routes/heroRoutes');
const { socketManager } = require('./socket/websocket');
const homedealsstores = require('./routes/homedealsstoresRoutes');
// Add the new service request routes
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
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
app.use('/api/v1/stores', storesRoutes);
app.use('/api/v1', serviceRoutes);
app.use('/api/v1', uploadRoutes);
app.use('/api/v1', paymentRoutes);
app.use('/api/v1', staffRoutes);
app.use('/api/v1', offerRoutes);
app.use('/api/v1', bookingRoutes);
app.use('/api/v1/hero', heroRoutes);
app.use('/api/v1', socialRoutes);
app.use('/api/v1', reviewRoutes);
app.use('/api/v1', categoryRoutes);
app.use('/api/v1', serviceFormsRoutes);
app.use('/api/v1', transactionRoutes);
app.use('/api/v1', followRoutes);
app.use('/api/v1', homedealsstores);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/likes', likeRoutes);
app.use('/api/v1/forms', formRoutes);
app.use('/api/v1/form-fields', formFieldRoutes);
app.use('/api/v1/form-responses', formResponseRoutes);
// Add the new service request routes
app.use('/api/v1/service-requests', serviceRequestRoutes);
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
socketManager.initialize(server);

// Note: The WebSocket event handlers should be inside your socketManager 
// or in a proper WebSocket connection context, not here in the main app.js

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});