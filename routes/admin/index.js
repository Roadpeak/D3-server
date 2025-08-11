const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./auth');
const dashboardRoutes = require('./dashboard');
const userRoutes = require('./users');
const merchantRoutes = require('./merchants');
const storeRoutes = require('./stores');
const serviceRoutes = require('./services');
const bookingRoutes = require('./bookings');
const offerRoutes = require('./offers');
const promoRoutes = require('./promos');
const serviceRequestRoutes = require('./serviceRequests');
const paymentRoutes = require('./payments');
const accountRoutes = require('./account');

const setupCors = () => {
  return cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  });
};

const setupRateLimiting = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
  });
};

const setupRoutes = (app) => {
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/merchants', merchantRoutes);
  app.use('/api/stores', storeRoutes);
  app.use('/api/services', serviceRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/offers', offerRoutes);
  app.use('/api/promos', promoRoutes);
  app.use('/api/service-requests', serviceRequestRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/account', accountRoutes);
};

const mountRoutes = (app) => {
  app.use(setupCors());
  app.use(setupRateLimiting());
  setupRoutes(app);
};

module.exports = { setupRoutes, mountRoutes, setupCors, setupRateLimiting };