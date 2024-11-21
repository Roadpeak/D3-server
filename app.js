const express = require('express');
const userRoutes = require('./routes/userRoutes');
const { sequelize } = require('./models/index');
require('dotenv').config();

const app = express();

app.use(express.json());

app.use('/api/v1', userRoutes);

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
