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
const quotesRoutes = require('./routes/quotes');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const swaggerFile = path.join(__dirname, 'swagger_output.json');

require('dotenv').config();

const app = express();

// Enable CORS for all origins
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Define your routes
app.use('/api/v1', userRoutes);
app.use('/api/v1', merchantRoutes);
app.use('/api/v1', storeRoutes);
app.use('/api/v1', serviceRoutes);
app.use('/api/v1', uploadRoutes);
app.use('/api/v1', paymentRoutes);
app.use('/api/v1', staffRoutes);
app.use('/api/v1/service-forms', serviceFormsRoutes);
app.use('/api/v1/form-responses', formResponsesRoutes);
app.use('/api/v1/quotes', quotesRoutes);

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
