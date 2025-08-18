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
  skipVerification,
  requestPasswordReset,
  resetPassword,
  getUserBookings,
  getUserChats,
  getUserFavorites,
  // NEW: Referral system controllers
  getEarnings,
  getEarningActivities,
  validateReferral
} = require('../controllers/userController');

// Import stores controller for followed stores functionality
const { getFollowedStores } = require('../controllers/storesController');

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

// NEW: Referral validation (public endpoint for registration)
router.post('/validate-referral', validateReferral);

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

// ==========================================
// NEW: REFERRAL SYSTEM ROUTES
// ==========================================

// Get user earnings data
router.get('/earnings', authenticateUser, getEarnings);

// Get earning activities
router.get('/earning-activities', authenticateUser, getEarningActivities);

// ==========================================
// OTHER PROTECTED ROUTES
// ==========================================

// Followed stores route
router.get('/followed-stores', verifyToken, getFollowedStores);

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

// ==========================================
// ADDITIONAL USER MANAGEMENT ROUTES (OPTIONAL)
// ==========================================

// Get user referral statistics (detailed view)
router.get('/referral-stats', authenticateUser, async (req, res) => {
  try {
    const userService = require('../services/userService');
    const stats = await userService.getReferralStats(req.user.userId);
    
    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching referral statistics'
    });
  }
});

// Get user's referrals list
router.get('/referrals', authenticateUser, async (req, res) => {
  try {
    const userService = require('../services/userService');
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const referrals = await userService.getUserReferrals(req.user.userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      includeBookings: true
    });
    
    res.status(200).json({
      success: true,
      referrals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: referrals.length
      }
    });
  } catch (error) {
    console.error('Error fetching user referrals:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching referrals'
    });
  }
});

// Update user referral link (if needed)
router.put('/referral-link', authenticateUser, async (req, res) => {
  try {
    const userService = require('../services/userService');
    const { customSlug } = req.body;
    
    // Validate custom slug if provided
    if (customSlug && !/^[a-z0-9-]{3,50}$/.test(customSlug)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid slug format. Use only lowercase letters, numbers, and hyphens.'
      });
    }
    
    // Check if slug is already taken
    if (customSlug) {
      const existingUser = await userService.findUserByReferralSlug(customSlug);
      if (existingUser && existingUser.id !== req.user.userId) {
        return res.status(400).json({
          success: false,
          message: 'This referral slug is already taken'
        });
      }
    }
    
    // Generate new slug if custom not provided
    const newSlug = customSlug || generateReferralSlug(req.user.userId, req.user.firstName, req.user.lastName);
    const newLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accounts/sign-up?ref=${newSlug}`;
    
    await userService.updateReferralLink(req.user.userId, newSlug, newLink);
    
    res.status(200).json({
      success: true,
      referralSlug: newSlug,
      referralLink: newLink,
      message: 'Referral link updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating referral link:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating referral link'
    });
  }
});

// Get user activity summary
router.get('/activity-summary', authenticateUser, async (req, res) => {
  try {
    const userService = require('../services/userService');
    const summary = await userService.getUserActivitySummary(req.user.userId);
    
    res.status(200).json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error fetching activity summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity summary'
    });
  }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Helper function to generate referral slug
function generateReferralSlug(userId, firstName, lastName) {
  const nameSlug = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  const shortId = userId.toString().substring(0, 8);
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  
  return `${nameSlug}-${shortId}-${randomSuffix}`;
}

module.exports = router;