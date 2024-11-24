const express = require('express');
const storeRoutes = require('./routes/storeRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const userRoutes = require('./routes/userRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const { sequelize } = require('./models/index');
const uploadRoutes = require('./routes/upload');
const paymentRoutes = require('./routes/paymentRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const staffRoutes = require('./routes/staffRoutes');

require('dotenv').config();

const app = express();

app.use(express.json());

app.use('/api/v1', userRoutes);
app.use('/api/v1/merchants', merchantRoutes);
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/files', uploadRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/staff', staffRoutes);

sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database connected and synced');
  })
  .catch((err) => {
    console.error('Error syncing database: ', err);
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
