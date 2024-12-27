const express = require('express');
const cors = require('cors');
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
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const apiKeyMiddleware = require('./milddlewares/apiKeyMiddleware');
const swaggerFile = path.join(__dirname, 'swagger_output.json');

require('dotenv').config();

const app = express();

app.use(cors());

app.use(express.json());

app.use('/api/v1/users', apiKeyMiddleware, userRoutes); 
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
app.use('/api/v1', serviceFormsRoutes);
app.use('/api/v1', transactionRoutes);
app.use('/api/v1/follow', followRoutes);
app.use('/api/v1/likes', likeRoutes);
app.use('/api/v1/forms', formRoutes);
app.use('/api/v1/form-fields', formFieldRoutes);
app.use('/api/v1/form-responses', formResponseRoutes);

app.use('/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(JSON.parse(fs.readFileSync(swaggerFile, 'utf8'))));

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
