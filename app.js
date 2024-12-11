const express = require('express');
const cors = require('cors'); // Import the cors package
const storeRoutes = require('./routes/storeRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const userRoutes = require('./routes/userRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const { sequelize } = require('./models/index');
const uploadRoutes = require('./routes/upload');
const paymentRoutes = require('./routes/paymentRoutes');
const staffRoutes = require('./routes/staffRoutes');
const serviceFormsRoutes = require('./routes/serviceForms');
const formResponsesRoutes = require('./routes/formResponses');
const offerRoutes = require('./routes/offerRoutes');
const quotesRoutes = require('./routes/quotesRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const socialRoutes = require('./routes/socialsRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const apiKeyMiddleware = require('./milddlewares/apiKeyMiddleware');
const swaggerFile = path.join(__dirname, 'swagger_output.json');

require('dotenv').config();

const app = express();

app.use(cors());

app.use(express.json());

app.use('/api/v1/users', apiKeyMiddleware, userRoutes); // Apply API key middleware to user routes
app.use('/api/v1', merchantRoutes); // Apply API key middleware to merchant routes

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
app.use('/api/v1/forms', formRoutes);
app.use('/api/v1/form-fields', formFieldRoutes);
app.use('/api/v1/form-responses', formResponseRoutes);

// Serve Swagger API docs
app.use('/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(JSON.parse(fs.readFileSync(swaggerFile, 'utf8'))));

// Sync Sequelize models
sequelize.sync({ alter: true })
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
