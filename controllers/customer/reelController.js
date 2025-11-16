// controllers/customer/reelController.js - Customer Reel Controller (Sequelize)
const { Reel, ReelLike, ReelView, Service, Store, User, sequelize } = require('../../models');
const { Op } = require('sequelize');

class CustomerReelController {
    /**
     * Get reels feed
     * GET /api/v1/reels
     */
    async getFeed(req, res) {
        try {
            const {
                limit = 20,
                offset = 0,
                location,
                category,
                store_id,
                sort = 'recent',
            } = req.query;

            const userId = req.user?.id;

            // Build where clause
            const whereClause = { status: 'published' };

            if (store_id) {
                whereClause.store_id = store_id;
            }

            // Build include clause
            const includeClause = [
                {
                    model: Service,
                    as: 'service',
                    attributes: ['id', 'name', 'price', 'duration', 'category_id'],
                    required: true,
                    ...(category && {
                        where: { category_id: category },
                    }),
                },
                {
                    model: Store,
                    as: 'store',
                    attributes: ['id', 'name', 'logo', 'verified', 'location'],
                    required: true,
                    ...(location && {
                        where: {
                            location: { [Op.like]: `%${location}%` },
                        },
                    }),
                },
            ];

            // Determine order
            const order = sort === 'trending'
                ? [['views', 'DESC'], ['created_at', 'DESC']]
                : [['created_at', 'DESC']];

            // Get reels
            const reels = await Reel.findAll({
                where: whereClause,
                include: includeClause,
                order: order,
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            // Get total count
            const total = await Reel.count({
                where: whereClause,
                include: includeClause.map(inc => ({
                    ...inc,
                    attributes: [],
                })),
            });

            // Format reels
            const formattedReels = await Promise.all(
                reels.map(async (reel) => {
                    let isLiked = false;

                    if (userId) {
                        const like = await ReelLike.findOne({
                            where: {
                                reel_id: reel.id,
                                user_id: userId,
                            },
                        });
                        isLiked = !!like;
                    }

                    return {
                        id: reel.id,
                        videoUrl: reel.video_url,
                        thumbnail: reel.thumbnail_url,
                        store: {
                            id: reel.store.id,
                            name: reel.store.name,
                            avatar: reel.store.logo,
                            verified: reel.store.verified === 1 || reel.store.verified === true,
                        },
                        service: {
                            id: reel.service.id,
                            name: reel.service.name,
                            price: reel.service.price,
                            duration: reel.service.duration,
                        },
                        description: reel.title,
                        likes: reel.likes,
                        shares: reel.shares,
                        isLiked: isLiked,
                        createdAt: this.formatTimeAgo(reel.created_at),
                    };
                })
            );

            res.json({
                success: true,
                data: formattedReels,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: parseInt(offset) + formattedReels.length < total,
                },
            });
        } catch (error) {
            console.error('Error getting reels feed:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching reels',
                error: error.message,
            });
        }
    }

    /**
     * Get single reel
     * GET /api/v1/reels/:id
     */
    async getReel(req, res) {
        try {
            const reelId = req.params.id;
            const userId = req.user?.id;

            const reel = await Reel.findOne({
                where: {
                    id: reelId,
                    status: 'published',
                },
                include: [
                    {
                        model: Service,
                        as: 'service',
                        attributes: ['id', 'name', 'price', 'duration'],
                    },
                    {
                        model: Store,
                        as: 'store',
                        attributes: ['id', 'name', 'logo', 'verified'],
                    },
                ],
            });

            if (!reel) {
                return res.status(404).json({
                    success: false,
                    message: 'Reel not found',
                });
            }

            let isLiked = false;
            if (userId) {
                const like = await ReelLike.findOne({
                    where: {
                        reel_id: reelId,
                        user_id: userId,
                    },
                });
                isLiked = !!like;
            }

            res.json({
                success: true,
                data: {
                    id: reel.id,
                    videoUrl: reel.video_url,
                    thumbnail: reel.thumbnail_url,
                    store: {
                        id: reel.store.id,
                        name: reel.store.name,
                        avatar: reel.store.logo,
                        verified: reel.store.verified === 1 || reel.store.verified === true,
                    },
                    service: {
                        id: reel.service.id,
                        name: reel.service.name,
                        price: reel.service.price,
                        duration: reel.service.duration,
                    },
                    description: reel.title,
                    likes: reel.likes,
                    shares: reel.shares,
                    isLiked: isLiked,
                    createdAt: this.formatTimeAgo(reel.created_at),
                },
            });
        } catch (error) {
            console.error('Error getting reel:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching reel',
                error: error.message,
            });
        }
    }

    /**
     * Toggle like on reel
     * POST /api/v1/reels/:id/like
     */
    async toggleLike(req, res) {
        try {
            const reelId = req.params.id;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }

            const reel = await Reel.findByPk(reelId);
            if (!reel) {
                return res.status(404).json({
                    success: false,
                    message: 'Reel not found',
                });
            }

            const existingLike = await ReelLike.findOne({
                where: {
                    reel_id: reelId,
                    user_id: userId,
                },
            });

            let isLiked;

            if (existingLike) {
                // Unlike
                await existingLike.destroy();
                await reel.decrement('likes');
                isLiked = false;
            } else {
                // Like
                await ReelLike.create({
                    reel_id: reelId,
                    user_id: userId,
                });
                await reel.increment('likes');
                isLiked = true;
            }

            // Get updated like count
            await reel.reload();

            res.json({
                success: true,
                data: {
                    isLiked: isLiked,
                    totalLikes: reel.likes,
                },
            });
        } catch (error) {
            console.error('Error toggling like:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing like',
                error: error.message,
            });
        }
    }

    /**
     * Track reel view
     * POST /api/v1/reels/:id/view
     */
    async trackView(req, res) {
        try {
            const reelId = req.params.id;
            const userId = req.user?.id;
            const { duration = 0 } = req.body;

            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('user-agent');

            await ReelView.create({
                reel_id: reelId,
                user_id: userId || null,
                ip_address: ipAddress,
                user_agent: userAgent,
                view_duration: parseInt(duration),
            });

            // Increment views count
            await Reel.increment('views', { where: { id: reelId } });

            res.json({
                success: true,
                message: 'View tracked successfully',
            });
        } catch (error) {
            console.error('Error tracking view:', error);
            res.status(500).json({
                success: false,
                message: 'Error tracking view',
                error: error.message,
            });
        }
    }

    /**
     * Track share
     * POST /api/v1/reels/:id/share
     */
    async trackShare(req, res) {
        try {
            const reelId = req.params.id;

            await Reel.increment('shares', { where: { id: reelId } });

            res.json({
                success: true,
                message: 'Share tracked successfully',
            });
        } catch (error) {
            console.error('Error tracking share:', error);
            res.status(500).json({
                success: false,
                message: 'Error tracking share',
                error: error.message,
            });
        }
    }

    /**
     * Track chat initiation
     * POST /api/v1/reels/:id/chat
     */
    async trackChat(req, res) {
        try {
            const reelId = req.params.id;

            await Reel.increment('chats', { where: { id: reelId } });

            res.json({
                success: true,
                message: 'Chat tracked successfully',
            });
        } catch (error) {
            console.error('Error tracking chat:', error);
            res.status(500).json({
                success: false,
                message: 'Error tracking chat',
                error: error.message,
            });
        }
    }

    /**
     * Format time ago
     */
    formatTimeAgo(date) {
        const now = new Date();
        const then = new Date(date);
        const diffInSeconds = Math.floor((now - then) / 1000);

        if (diffInSeconds < 60) {
            return 'Just now';
        }

        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) {
            return `${diffInMinutes}m ago`;
        }

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
            return `${diffInHours}h ago`;
        }

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) {
            return `${diffInDays}d ago`;
        }

        const diffInWeeks = Math.floor(diffInDays / 7);
        if (diffInWeeks < 4) {
            return `${diffInWeeks}w ago`;
        }

        const diffInMonths = Math.floor(diffInDays / 30);
        return `${diffInMonths}mo ago`;
    }
}

module.exports = new CustomerReelController();