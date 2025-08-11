const swaggerAutogen = require('swagger-autogen')();
const path = require('path');

const doc = {
  info: {
    title: 'Discoun3 API',
    description: 'API documentation for Discoun3 platform',
  },
  host: 'localhost:3000', // Change to your production URL when deploying
  schemes: ['http'],
};

const outputFile = path.join(__dirname, 'swagger_output.json'); // Output file to store the generated Swagger docs
const endpointsFiles = [
  path.join(__dirname, 'routes/userRoutes.js'),
  path.join(__dirname, 'routes/merchantRoutes.js'),
  path.join(__dirname, 'routes/storesRoutes.js'),
  path.join(__dirname, 'routes/serviceRoutes.js'),
  path.join(__dirname, 'routes/upload.js'),
  path.join(__dirname, 'routes/paymentRoutes.js'),
  // Admin endpoints
  path.join(__dirname, 'routes/admin/auth.js'),
  path.join(__dirname, 'routes/admin/dashboard.js'),
  path.join(__dirname, 'routes/admin/users.js'),
  path.join(__dirname, 'routes/admin/merchants.js'),
  path.join(__dirname, 'routes/admin/stores.js'),
  path.join(__dirname, 'routes/admin/services.js'),
  path.join(__dirname, 'routes/admin/bookings.js'),
  path.join(__dirname, 'routes/admin/offers.js'),
  path.join(__dirname, 'routes/admin/promos.js'),
  path.join(__dirname, 'routes/admin/serviceRequests.js'),
  path.join(__dirname, 'routes/admin/payments.js'),
  path.join(__dirname, 'routes/admin/account.js'),
];

// Generate the Swagger documentation
swaggerAutogen(outputFile, endpointsFiles, doc);
