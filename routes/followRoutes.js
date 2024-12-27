const express = require('express');
const router = express.Router();
const followController = require('../controllers/followController');

router.post('/follow', followController.followStore); // Follow a store
router.post('/unfollow', followController.unfollowStore); // Unfollow a store
router.get('/user/:userId/stores', followController.getFollowedStores); // Get all stores a user follows
router.get('/store/:storeId/followers', followController.getStoreFollowers); // Get all followers of a store

module.exports = router;
