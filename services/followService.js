const { Follow, Store, User } = require('../models');

const followStore = async (userId, storeId) => {
    const existingFollow = await Follow.findOne({ where: { user_id: userId, store_id: storeId } });
    if (existingFollow) {
        throw new Error('Already following this store');
    }
    return await Follow.create({ user_id: userId, store_id: storeId });
};

const unfollowStore = async (userId, storeId) => {
    const follow = await Follow.findOne({ where: { user_id: userId, store_id: storeId } });
    if (!follow) {
        throw new Error('Not following this store');
    }
    return await follow.destroy();
};

const getFollowedStores = async (userId) => {
    return await Follow.findAll({
        where: { user_id: userId },
        include: [{ model: Store, as: 'store' }],
    });
};

const getStoreFollowers = async (storeId) => {
    return await Follow.findAll({
        where: { store_id: storeId },
        include: [{ model: User, as: 'user' }],
    });
};

module.exports = {
    followStore,
    unfollowStore,
    getFollowedStores,
    getStoreFollowers,
};
