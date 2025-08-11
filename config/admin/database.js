const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
};

const getConnection = () => {
  return mongoose.connection;
};

const setupConnectionEvents = () => {
  mongoose.connection.on('connected', () => console.log('MongoDB connection established'));
  mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err));
  mongoose.connection.on('disconnected', () => console.log('MongoDB disconnected'));
};

const handleConnectionError = (err) => {
  console.error('Database error:', err);
  throw err;
};

const reconnectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB reconnected');
  } catch (error) {
    console.error('MongoDB reconnect error:', error);
    setTimeout(reconnectDB, 5000);
  }
};

const checkDBHealth = async () => {
  return mongoose.connection.readyState === 1;
};

const configureConnectionPool = () => {
  mongoose.set('maxPoolSize', process.env.DB_POOL_SIZE || 10);
};

module.exports = {
  connectDB,
  disconnectDB,
  getConnection,
  setupConnectionEvents,
  handleConnectionError,
  reconnectDB,
  checkDBHealth,
  configureConnectionPool,
};