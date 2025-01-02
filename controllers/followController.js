const followService = require('../services/followService');

const followStore = async (req, res) => {
    try {
        const storeId = req.params.storeId;
        const userId = req.user.userId;  // This comes from the decoded JWT token

        if (!userId) {
            return res.status(400).json({ error: "User ID not found in token" });
        }

        // Call your service to follow the store
        const result = await followService.followStore(userId, storeId);

        res.status(201).json(result);  // Send response
    } catch (error) {
        console.error(error); // Log the error
        res.status(400).json({ error: error.message });
    }
};

const unfollowStore = async (req, res) => {
    try {
        const { userId, storeId } = req.body;
        await followService.unfollowStore(userId, storeId);
        res.status(200).json({ message: 'Unfollowed successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getFollowedStores = async (req, res) => {
    try {
        const { userId } = req.params;
        const stores = await followService.getFollowedStores(userId);
        res.status(200).json(stores);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getStoreFollowers = async (req, res) => {
    try {
        const { storeId } = req.params;
        const followers = await followService.getStoreFollowers(storeId);
        res.status(200).json(followers);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    followStore,
    unfollowStore,
    getFollowedStores,
    getStoreFollowers,
};
