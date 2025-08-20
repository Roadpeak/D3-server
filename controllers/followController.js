// controllers/followController.js - Updated to work with your merchant auth

const { Follow, User, Store, Merchant, sequelize } = require('../models');
const { Op } = require('sequelize');

// Get all followers of a specific store with detailed user information
exports.getStoreFollowers = async (req, res) => {
    try {
        const { storeId } = req.params;
        const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        console.log('📋 Getting followers for store:', storeId);
        console.log('🔍 Authenticated merchant:', req.user.id);

        if (!storeId) {
            return res.status(400).json({
                success: false,
                message: 'Store ID is required'
            });
        }

        // Verify store exists and belongs to the merchant
        const store = await Store.findOne({
            where: { 
                id: storeId,
                merchant_id: req.user.id // Use the merchant ID from your auth middleware
            }
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: 'Store not found or access denied. You can only view followers of your own store.'
            });
        }

        console.log('✅ Store verified:', store.name);

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build order clause
        let orderClause = [];
        switch (sortBy) {
            case 'name':
                orderClause = [[User, 'first_name', sortOrder.toUpperCase()]];
                break;
            case 'email':
                orderClause = [[User, 'email', sortOrder.toUpperCase()]];
                break;
            case 'followedSince':
            case 'createdAt':
                orderClause = [['createdAt', sortOrder.toUpperCase()]];
                break;
            default:
                orderClause = [['createdAt', 'DESC']];
        }

        // Get followers with user details
        const { count, rows: follows } = await Follow.findAndCountAll({
            where: { store_id: storeId },
            include: [
                {
                    model: User,
                    attributes: [
                        'id',
                        'first_name',
                        'last_name',
                        'firstName', // Handle both naming conventions
                        'lastName',
                        'email',
                        'email_address', // Handle both naming conventions
                        'phone',
                        'phone_number',
                        'avatar',
                        'isVip',
                        'status',
                        'createdAt',
                        'updatedAt',
                        'lastActiveAt'
                    ],
                    required: true // Inner join - only get follows with valid users
                }
            ],
            order: orderClause,
            limit: parseInt(limit),
            offset: offset
        });

        // Format followers data
        const followers = follows.map(follow => {
            const user = follow.User;
            
            // Handle different naming conventions
            const firstName = user.first_name || user.firstName || '';
            const lastName = user.last_name || user.lastName || '';
            const email = user.email || user.email_address || '';
            const phone = user.phone || user.phone_number || '';

            return {
                id: user.id,
                name: `${firstName} ${lastName}`.trim() || 'Unknown User',
                firstName,
                lastName,
                email,
                phone,
                avatar: user.avatar,
                isVip: user.isVip || false,
                status: user.status || 'active',
                followedSince: follow.createdAt,
                followedAt: follow.createdAt,
                lastActive: user.lastActiveAt || user.updatedAt,
                Follow: {
                    id: follow.id,
                    createdAt: follow.createdAt,
                    updatedAt: follow.updatedAt
                }
            };
        });

        console.log(`✅ Found ${followers.length} followers for store ${storeId}`);

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
                location: store.location
            }
        });

    } catch (error) {
        console.error('💥 Error getting store followers:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching store followers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get followers for the authenticated merchant's store (convenience method)
exports.getMyStoreFollowers = async (req, res) => {
    try {
        console.log('📋 Getting followers for merchant store:', req.user.id);

        // Get merchant's store
        const store = await Store.findOne({
            where: { merchant_id: req.user.id }
        });

        if (!store) {
            return res.status(404).json({
                success: false,
                message: 'No store found for this merchant'
            });
        }

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

exports.followStore = async (req, res) => {
    try {
        const { storeId } = req.params;
        const userId = req.user.id; // Assuming your auth middleware adds user to req

        console.log('👤 User', userId, 'attempting to follow store', storeId);

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

        console.log('✅ User', userId, 'now following store', storeId);

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

// Unfollow a store
exports.unfollowStore = async (req, res) => {
    try {
        const { storeId } = req.body; // Expecting storeId in request body
        const userId = req.user.id;

        console.log('👤 User', userId, 'attempting to unfollow store', storeId);

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

        console.log('✅ User', userId, 'unfollowed store', storeId);

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

// Get all stores that a user follows
exports.getFollowedStores = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        console.log('📋 Getting followed stores for user:', userId);

        // Check if requesting user can access this data (optional security check)
        if (req.user.id !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only view your own followed stores.'
            });
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Get followed stores with store details
        const { count, rows: follows } = await Follow.findAndCountAll({
            where: { user_id: userId },
            include: [
                {
                    model: Store,
                    attributes: [
                        'id',
                        'name',
                        'description',
                        'location',
                        'address',
                        'phone',
                        'email',
                        'website',
                        'category',
                        'rating',
                        'isActive',
                        'createdAt'
                    ],
                    required: true // Inner join - only get follows with valid stores
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        // Format the response
        const followedStores = follows.map(follow => ({
            followId: follow.id,
            followedSince: follow.createdAt,
            store: {
                id: follow.Store.id,
                name: follow.Store.name,
                description: follow.Store.description,
                location: follow.Store.location,
                address: follow.Store.address,
                phone: follow.Store.phone,
                email: follow.Store.email,
                website: follow.Store.website,
                category: follow.Store.category,
                rating: follow.Store.rating,
                isActive: follow.Store.isActive,
                createdAt: follow.Store.createdAt
            }
        }));

        console.log(`✅ Found ${followedStores.length} followed stores for user ${userId}`);

        return res.status(200).json({
            success: true,
            followedStores,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / parseInt(limit)),
                hasNextPage: offset + follows.length < count,
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