const express = require('express');
const router = express.Router();

// Import controllers
const { 
  register, 
  login, 
  getProfile, 
  updateProfile,
  verifyOtp,
  resendOtp,
  skipVerification, // Add this
  requestPasswordReset,
  resetPassword,
  getUserBookings,
  getUserChats,
  getUserFavorites
} = require('../controllers/userController');

// Import unified auth middleware
const { 
  verifyToken, 
  authenticateUser, 
  optionalAuth 
} = require('../middleware/auth');

// ==========================================
// PUBLIC ROUTES (No authentication required)
// ==========================================

// Add this at the top of your routes for testing
router.get('/test', (req, res) => {
  res.json({ message: 'User routes are working!' });
});

// Test OTP endpoint
router.post('/test-otp', (req, res) => {
  console.log('Test OTP called with:', req.body);
  res.json({ 
    message: 'OTP test endpoint working!',
    body: req.body 
  });
});

// Authentication routes
router.post('/register', register);
router.post('/login', login);

// OTP routes
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);

// Development only - skip verification
if (process.env.NODE_ENV === 'development') {
  router.post('/skip-verification', skipVerification);
}

// Password reset routes
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

// ==========================================
// PROTECTED ROUTES (Authentication required)
// ==========================================

// Your existing protected route (keeping for compatibility)
router.get('/protected', verifyToken, (req, res) => {
  res.status(200).json({
    message: 'This is a protected route.',
    user: req.user
  });
});

// Profile management
router.get('/profile', authenticateUser, getProfile);
router.get('/me', verifyToken, getProfile); // Alternative endpoint name
router.put('/profile', authenticateUser, updateProfile);

// User-specific data routes
router.get('/bookings', authenticateUser, getUserBookings);
router.get('/chats', authenticateUser, getUserChats);
router.get('/favorites', authenticateUser, getUserFavorites);

// User dashboard data (summary endpoint)
router.get('/dashboard', authenticateUser, (req, res) => {
  res.status(200).json({
    message: 'User dashboard data',
    user: req.user,
    // Add dashboard-specific data here
  });
});

// User settings routes
router.put('/settings', authenticateUser, (req, res) => {
  res.status(200).json({
    message: 'Settings updated successfully'
  });
});

// Email/Phone verification status
router.get('/verification-status', authenticateUser, (req, res) => {
  res.status(200).json({
    user: {
      id: req.user.userId,
      email: req.user.email,
      isEmailVerified: req.user.isEmailVerified || false,
      isPhoneVerified: req.user.isPhoneVerified || false,
    }
  });
});

module.exports = router;