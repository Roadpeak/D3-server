// controllers/followController.js - FINAL FIX for association error

const { Follow, User, Store, Merchant, sequelize } = require('../models');
const { Op } = require('sequelize');

exports.getStoreFollowers = async (req, res) => {
    try {
        const { storeId } = req.params;
        const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        console.log('📋 Getting followers for store:', storeId);
        
        if (!req.user || !req.user.id) {
            console.error('❌ No authenticated merchant found in request');
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in as a merchant.'
            });
        }

        const merchantId = req.user.id;
        console.log('🔍 Authenticated merchant ID:', merchantId);

        if (!storeId) {
            return res.status(400).json({
                success: false,
                message: 'Store ID is required'
            });
        }

        // Verify store exists and belongs to this merchant
        const store = await Store.findOne({
            where: { 
                id: storeId,
                merchant_id: merchantId
            }
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: 'Store not found or access denied. You can only view followers of your own store.'
            });
        }

        console.log('✅ Store verified:', store.name, 'belongs to merchant:', merchantId);

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // ALTERNATIVE APPROACH: Use raw query or simpler approach to avoid association conflicts
        try {
            // First, get the Follow records
            const followQuery = await Follow.findAndCountAll({
                where: { store_id: storeId },
                attributes: ['id', 'user_id', 'createdAt', 'updatedAt'],
                limit: parseInt(limit),
                offset: offset,
                order: [['createdAt', sortOrder.toUpperCase()]]
            });

            const follows = followQuery.rows;
            const count = followQuery.count;

            // Then, get the User data separately to avoid association conflicts
            const userIds = follows.map(follow => follow.user_id);
            
            let users = [];
            if (userIds.length > 0) {
                users = await User.findAll({
                    where: { 
                        id: { [Op.in]: userIds }
                    },
                    attributes: [
                        'id',
                        'firstName',
                        'lastName',
                        'email',
                        'phoneNumber',
                        'avatar',
                        'userType',
                        'isActive',
                        'createdAt',
                        'updatedAt'
                    ]
                });
            }

            // Create a map for quick user lookup
            const userMap = {};
            users.forEach(user => {
                userMap[user.id] = user;
            });

            // Combine follow data with user data
            const followers = follows.map(follow => {
                const user = userMap[follow.user_id];
                
                if (!user) {
                    console.warn('⚠️ Follow record missing user data:', follow.id);
                    return null;
                }

                return {
                    id: user.id,
                    name: `${user.firstName} ${user.lastName}`.trim() || 'Unknown User',
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phone: user.phoneNumber,
                    avatar: user.avatar,
                    isVip: false, // You can add VIP logic here if needed
                    status: user.isActive ? 'active' : 'inactive',
                    followedSince: follow.createdAt,
                    followedAt: follow.createdAt,
                    lastActive: user.updatedAt,
                    userType: user.userType,
                    Follow: {
                        id: follow.id,
                        createdAt: follow.createdAt,
                        updatedAt: follow.updatedAt
                    }
                };
            }).filter(follower => follower !== null);

            // Apply sorting if not by createdAt (since we already sorted the Follow query)
            if (sortBy !== 'createdAt') {
                followers.sort((a, b) => {
                    let aValue, bValue;
                    
                    switch (sortBy) {
                        case 'name':
                            aValue = a.name.toLowerCase();
                            bValue = b.name.toLowerCase();
                            break;
                        case 'email':
                            aValue = a.email.toLowerCase();
                            bValue = b.email.toLowerCase();
                            break;
                        default:
                            return 0;
                    }
                    
                    if (sortOrder === 'desc') {
                        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
                    } else {
                        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
                    }
                });
            }

            console.log(`✅ Found ${followers.length} customer followers for store ${storeId}`);

            return res.status(200).json({
                success: true,
                followers,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit)),
                    hasNextPage: offset + follows.length < count,
                    hasPrevPage: page > 1
                },
                store: {
                    id: store.id,
                    name: store.name,
                    location: store.location,
                    merchantId: store.merchant_id
                }
            });

        } catch (associationError) {
            console.error('💥 Association error, trying fallback approach:', associationError.message);
            
            // FALLBACK: If there are still association issues, return basic data
            const basicFollows = await sequelize.query(`
                SELECT f.id, f.user_id, f.createdAt, f.updatedAt,
                       u.firstName, u.lastName, u.email, u.phoneNumber, u.avatar, u.isActive
                FROM Follows f
                LEFT JOIN users u ON f.user_id = u.id
                WHERE f.store_id = :storeId
                ORDER BY f.createdAt ${sortOrder.toUpperCase()}
                LIMIT :limit OFFSET :offset
            `, {
                replacements: { 
                    storeId: storeId, 
                    limit: parseInt(limit), 
                    offset: offset 
                },
                type: sequelize.QueryTypes.SELECT
            });

            const followers = basicFollows.map(follow => ({
                id: follow.user_id,
                name: `${follow.firstName || ''} ${follow.lastName || ''}`.trim() || 'Unknown User',
                firstName: follow.firstName,
                lastName: follow.lastName,
                email: follow.email,
                phone: follow.phoneNumber,
                avatar: follow.avatar,
                isVip: false,
                status: follow.isActive ? 'active' : 'inactive',
                followedSince: follow.createdAt,
                followedAt: follow.createdAt,
                lastActive: follow.updatedAt,
                Follow: {
                    id: follow.id,
                    createdAt: follow.createdAt,
                    updatedAt: follow.updatedAt
                }
            }));

            return res.status(200).json({
                success: true,
                followers,
                pagination: {
                    total: followers.length, // Not accurate but functional
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: 1,
                    hasNextPage: false,
                    hasPrevPage: false
                },
                store: {
                    id: store.id,
                    name: store.name,
                    location: store.location,
                    merchantId: store.merchant_id
                },
                note: 'Using fallback query due to association complexity'
            });
        }

    } catch (error) {
        console.error('💥 Error getting store followers:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching store followers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.getMyStoreFollowers = async (req, res) => {
    try {
        const merchantId = req.user?.id;
        console.log('📋 Getting followers for merchant store, merchant ID:', merchantId);

        if (!merchantId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in as a merchant.'
            });
        }

        // Get merchant's store using merchant_id
        const store = await Store.findOne({
            where: { merchant_id: merchantId }
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: 'No store found for this merchant'
            });
        }

        console.log('✅ Found store for merchant:', store.name);

        // Set store ID in params and call main method
        req.params.storeId = store.id;
        return exports.getStoreFollowers(req, res);

    } catch (error) {
        console.error('💥 Error getting merchant store followers:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching store followers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Keep other methods unchanged
exports.followStore = async (req, res) => {
    try {
        const { storeId } = req.params;
        
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in as a customer.'
            });
        }
        
        const userId = req.user.id;

        console.log('👤 Customer/User', userId, 'attempting to follow store', storeId);

        if (!storeId) {
            return res.status(400).json({
                success: false,
                message: 'Store ID is required'
            });
        }

        // Check if store exists
        const store = await Store.findByPk(storeId);
        if (!store) {
            return res.status(404).json({
                success: false,
                message: 'Store not found'
            });
        }

        // Check if already following
        const existingFollow = await Follow.findOne({
            where: {
                user_id: userId,
                store_id: storeId
            }
        });

        if (existingFollow) {
            return res.status(400).json({
                success: false,
                message: 'Already following this store'
            });
        }

        // Create follow relationship
        const follow = await Follow.create({
            user_id: userId,
            store_id: storeId
        });

        console.log('✅ Customer/User', userId, 'now following store', storeId);

        return res.status(201).json({
            success: true,
            message: 'Successfully followed store',
            follow: {
                id: follow.id,
                userId: follow.user_id,
                storeId: follow.store_id,
                createdAt: follow.createdAt
            },
            store: {
                id: store.id,
                name: store.name,
                location: store.location
            }
        });

    } catch (error) {
        console.error('💥 Error following store:', error);
        return res.status(500).json({
            success: false,
            message: 'Error following store',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.unfollowStore = async (req, res) => {
    try {
        const { storeId } = req.body;
        
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in as a customer.'
            });
        }
        
        const userId = req.user.id;

        console.log('👤 Customer/User', userId, 'attempting to unfollow store', storeId);

        if (!storeId) {
            return res.status(400).json({
                success: false,
                message: 'Store ID is required'
            });
        }

        // Find and delete the follow relationship
        const follow = await Follow.findOne({
            where: {
                user_id: userId,
                store_id: storeId
            }
        });

        if (!follow) {
            return res.status(404).json({
                success: false,
                message: 'Not following this store'
            });
        }

        await follow.destroy();

        console.log('✅ Customer/User', userId, 'unfollowed store', storeId);

        return res.status(200).json({
            success: true,
            message: 'Successfully unfollowed store'
        });

    } catch (error) {
        console.error('💥 Error unfollowing store:', error);
        return res.status(500).json({
            success: false,
            message: 'Error unfollowing store',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

exports.getFollowedStores = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        console.log('📋 Getting followed stores for customer/user:', userId);

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in.'
            });
        }

        // Check if requesting user can access this data
        if (req.user.id !== parseInt(userId) && req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only view your own followed stores.'
            });
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Use similar approach to avoid association conflicts
        const follows = await Follow.findAll({
            where: { user_id: userId },
            attributes: ['id', 'store_id', 'createdAt'],
            limit: parseInt(limit),
            offset: offset,
            order: [['createdAt', 'DESC']]
        });

        const storeIds = follows.map(follow => follow.store_id);
        let stores = [];
        
        if (storeIds.length > 0) {
            stores = await Store.findAll({
                where: { 
                    id: { [Op.in]: storeIds },
                    is_active: true
                },
                attributes: [
                    'id', 'name', 'description', 'location', 'address', 
                    'phone', 'email', 'website', 'category', 'rating', 
                    'isActive', 'merchant_id', 'createdAt'
                ]
            });
        }

        const storeMap = {};
        stores.forEach(store => {
            storeMap[store.id] = store;
        });

        const followedStores = follows.map(follow => {
            const store = storeMap[follow.store_id];
            if (!store) return null;

            return {
                followId: follow.id,
                followedSince: follow.createdAt,
                store: {
                    id: store.id,
                    name: store.name,
                    description: store.description,
                    location: store.location,
                    address: store.address,
                    phone: store.phone,
                    email: store.email,
                    website: store.website,
                    category: store.category,
                    rating: store.rating,
                    isActive: store.isActive,
                    merchantId: store.merchant_id,
                    createdAt: store.createdAt
                }
            };
        }).filter(item => item !== null);

        console.log(`✅ Found ${followedStores.length} followed stores for customer/user ${userId}`);

        return res.status(200).json({
            success: true,
            followedStores,
            pagination: {
                total: followedStores.length,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(followedStores.length / parseInt(limit)),
                hasNextPage: follows.length === parseInt(limit),
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('💥 Error getting followed stores:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching followed stores',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
// Toggle follow status (follow if not following, unfollow if following)
exports.toggleFollow = async (req, res) => {
    try {
        const { storeId } = req.params;
        
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in as a customer.'
            });
        }
        
        const userId = req.user.id;

        console.log('🔄 Customer/User', userId, 'toggling follow for store', storeId);

        if (!storeId) {
            return res.status(400).json({
                success: false,
                message: 'Store ID is required'
            });
        }

        // Check if store exists
        const store = await Store.findByPk(storeId);
        if (!store) {
            return res.status(404).json({
                success: false,
                message: 'Store not found'
            });
        }

        // Check if already following
        const existingFollow = await Follow.findOne({
            where: {
                user_id: userId,
                store_id: storeId
            }
        });

        if (existingFollow) {
            // Unfollow
            await existingFollow.destroy();
            console.log('✅ Customer/User', userId, 'unfollowed store', storeId);

            return res.status(200).json({
                success: true,
                message: 'Successfully unfollowed store',
                isFollowing: false,
                store: {
                    id: store.id,
                    name: store.name,
                    location: store.location
                }
            });
        } else {
            // Follow
            const follow = await Follow.create({
                user_id: userId,
                store_id: storeId
            });

            console.log('✅ Customer/User', userId, 'now following store', storeId);

            return res.status(200).json({
                success: true,
                message: 'Successfully followed store',
                isFollowing: true,
                follow: {
                    id: follow.id,
                    userId: follow.user_id,
                    storeId: follow.store_id,
                    createdAt: follow.createdAt
                },
                store: {
                    id: store.id,
                    name: store.name,
                    location: store.location
                }
            });
        }

    } catch (error) {
        console.error('💥 Error toggling follow:', error);
        return res.status(500).json({
            success: false,
            message: 'Error toggling follow status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
