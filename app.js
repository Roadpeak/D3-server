const express = require('express');
const userRoutes = require('./routes/userRoutes');
const { sequelize } = require('./models');
require('dotenv').config();

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Routes with versioning prefix /api/v1
app.use('/api/v1', userRoutes);

// Sync Sequelize models with the database (connects and creates tables)
sequelize.sync({ alter: true })  // 'alter' updates the table schema if needed
  .then(() => {
    console.log('Database connected and synced');
  })
  .catch((err) => {
    console.error('Error syncing database: ', err);
  });

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
