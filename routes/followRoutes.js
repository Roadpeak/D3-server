const express = require('express');
const router = express.Router();
const followController = require('../controllers/followController');
const { authenticateUser } = require('../middleware/auth');           // For CUSTOMERS
const { authenticateMerchant } = require('../middleware/Merchantauth'); // For MERCHANTS

// CUSTOMER/USER routes (customers following stores)
router.post('/:storeId/toggle-follow', authenticateUser, followController.toggleFollow);
router.post('/follow/:storeId', authenticateUser, followController.followStore);        // Customer follows store
router.post('/unfollow', authenticateUser, followController.unfollowStore);             // Customer unfollows store  
router.get('/user/:userId/stores', authenticateUser, followController.getFollowedStores); // Customer's followed stores

// MERCHANT routes (merchants viewing their store followers)
router.get('/store/:storeId/followers', authenticateMerchant, followController.getStoreFollowers); // Merchant views followers
router.get('/my-store/followers', authenticateMerchant, followController.getMyStoreFollowers);     // Merchant convenience route

module.exports = router;