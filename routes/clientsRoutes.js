// routes/clientRoutes.js - New routes file for client management

const express = require('express');
const router = express.Router();
const followController = require('../controllers/followController');
const bookingController = require('../controllers/bookingController'); // or enhancedBookingController
const { authenticateUser, authenticateMerchant } = require('../middleware/authMiddleware');

// ==================== FOLLOWER ROUTES ====================

// Get followers for a specific store (for merchants)
router.get('/stores/:storeId/followers', authenticateMerchant, followController.getStoreFollowers);

// Get follower statistics
router.get('/stores/:storeId/followers/stats', authenticateMerchant, followController.getFollowerStats);

// Follow/unfollow actions (for users)
router.post('/follow/:storeId', authenticateUser, followController.followStore);
router.post('/unfollow', authenticateUser, followController.unfollowStore);

// Get stores followed by a user
router.get('/users/:userId/followed-stores', authenticateUser, followController.getFollowedStores);

// ==================== CUSTOMER/BOOKING ROUTES ====================

// Get bookings with detailed customer information (for merchants)
router.get('/bookings/customers', authenticateMerchant, bookingController.getBookingsWithCustomers);

// Get unique customers from bookings (for merchants)  
router.get('/customers', authenticateMerchant, bookingController.getUniqueCustomers);

// Get customer analytics (for merchants)
router.get('/analytics/customers', authenticateMerchant, bookingController.getCustomerAnalytics);

module.exports = router;

// ==================== UPDATED FOLLOW ROUTES ====================
// Update your existing routes/followRoutes.js with these enhanced routes:

/*
const express = require('express');
const router = express.Router();
const followController = require('../controllers/followController');
const { authenticateUser, authenticateMerchant } = require('../middleware/authMiddleware');

// Enhanced follower management
router.post('/follow/:storeId', authenticateUser, followController.followStore);
router.post('/unfollow', authenticateUser, followController.unfollowStore);
router.get('/user/:userId/stores', authenticateUser, followController.getFollowedStores);

// ENHANCED: Store follower management for merchants
router.get('/store/:storeId/followers', authenticateMerchant, followController.getStoreFollowers);
router.get('/store/:storeId/followers/stats', authenticateMerchant, followController.getFollowerStats);

module.exports = router;
*/

// ==================== UPDATED BOOKING ROUTES ====================
// Add these routes to your existing routes/bookingRoutes.js:

/*
// Enhanced customer management routes (add to existing booking routes)
router.get('/bookings/customers', authenticateMerchant, bookingController.getBookingsWithCustomers);
router.get('/bookings/customers/unique', authenticateMerchant, bookingController.getUniqueCustomers);
router.get('/bookings/analytics/customers', authenticateMerchant, bookingController.getCustomerAnalytics);
*/

// ==================== APP.JS INTEGRATION ====================
// Add this to your main app.js file:

/*
// Import the new client routes
const clientRoutes = require('./routes/clientRoutes');

// Use the client routes
app.use('/api/v1/clients', clientRoutes);

// OR if you prefer to integrate with existing routes:
// Update existing routes:
app.use('/api/v1/follow', require('./routes/followRoutes'));
app.use('/api/v1/bookings', require('./routes/bookingRoutes'));
*/

// ==================== MIDDLEWARE EXAMPLES ====================
// Make sure you have proper authentication middleware:

/*
// middleware/authMiddleware.js additions:

const jwt = require('jsonwebtoken');
const { User, Merchant } = require('../models');

const authenticateUser = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.type === 'user') {
            const user = await User.findByPk(decoded.userId || decoded.id);
            if (!user) {
                return res.status(401).json({ success: false, message: 'Invalid token.' });
            }
            req.user = { ...user.toJSON(), type: 'user' };
        } else {
            return res.status(401).json({ success: false, message: 'User authentication required.' });
        }
        
        next();
    } catch (error) {
        res.status(400).json({ success: false, message: 'Invalid token.' });
    }
};

const authenticateMerchant = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.type === 'merchant') {
            const merchant = await Merchant.findByPk(decoded.id);
            if (!merchant) {
                return res.status(401).json({ success: false, message: 'Invalid token.' });
            }
            req.user = { ...merchant.toJSON(), type: 'merchant' };
        } else {
            return res.status(401).json({ success: false, message: 'Merchant authentication required.' });
        }
        
        next();
    } catch (error) {
        res.status(400).json({ success: false, message: 'Invalid token.' });
    }
};

// Flexible authentication (accepts both user and merchant)
const authenticateAny = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.type === 'user') {
            const user = await User.findByPk(decoded.userId || decoded.id);
            if (user) {
                req.user = { ...user.toJSON(), type: 'user' };
                return next();
            }
        } else if (decoded.type === 'merchant') {
            const merchant = await Merchant.findByPk(decoded.id);
            if (merchant) {
                req.user = { ...merchant.toJSON(), type: 'merchant' };
                return next();
            }
        }
        
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    } catch (error) {
        res.status(400).json({ success: false, message: 'Invalid token.' });
    }
};

module.exports = {
    authenticateUser,
    authenticateMerchant,
    authenticateAny
};
*/