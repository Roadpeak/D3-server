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
  path.join(__dirname, 'routes/storeRoutes.js'),
  path.join(__dirname, 'routes/serviceRoutes.js'),
  path.join(__dirname, 'routes/upload.js'),
  path.join(__dirname, 'routes/paymentRoutes.js'),
  // Add all other route files here
];

// Generate the Swagger documentation
swaggerAutogen(outputFile, endpointsFiles, doc);
