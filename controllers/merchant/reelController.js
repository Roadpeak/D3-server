// controllers/merchant/reelController.js - Merchant Reel Controller (Sequelize)
const { Reel, ReelLike, ReelView, Service, Store, sequelize } = require('../../models');
const r2Service = require('../../services/cloudflareR2Service');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

class ReelController {
    /**
     * Get all reels for merchant
     * GET /api/v1/merchant/reels
     */
    async getReels(req, res) {
        try {
            const merchantId = req.user.id; // From auth middleware
            const { status, limit = 50, offset = 0 } = req.query;

            const whereClause = { merchant_id: merchantId };
            if (status) {
                whereClause.status = status;
            }

            const reels = await Reel.findAll({
                where: whereClause,
                include: [
                    {
                        model: Service,
                        as: 'service',
                        attributes: ['id', 'name', 'price', 'duration'],
                    },
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
            });

            // Format response
            const formattedReels = reels.map(reel => ({
                id: reel.id,
                title: reel.title,
                description: reel.description,
                video_url: reel.video_url,
                thumbnail_url: reel.thumbnail_url,
                duration: reel.duration,
                status: reel.status,
                service: reel.service ? {
                    id: reel.service.id,
                    name: reel.service.name,
                    price: reel.service.price,
                    duration: reel.service.duration,
                } : null,
                views: reel.views,
                likes: reel.likes,
                chats: reel.chats,
                shares: reel.shares,
                created_at: reel.created_at,
                published_at: reel.published_at,
            }));

            res.json({
                success: true,
                data: formattedReels,
            });
        } catch (error) {
            console.error('Error getting merchant reels:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching reels',
                error: error.message,
            });
        }
    }

    /**
     * Upload new reel
     * POST /api/v1/merchant/reels
     */
    async createReel(req, res) {
        try {
            // Validate request
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation errors',
                    errors: errors.array(),
                });
            }

            const merchantId = req.user.id;
            const { title, description, serviceId, status, duration } = req.body;

            // Get store_id from merchant
            const { Store: StoreModel } = require('../../models');
            const store = await StoreModel.findOne({
                where: { merchant_id: merchantId },
            });

            if (!store) {
                return res.status(400).json({
                    success: false,
                    message: 'Merchant has no store',
                });
            }

            // Check if files are uploaded
            if (!req.files || !req.files.video) {
                return res.status(400).json({
                    success: false,
                    message: 'Video file is required',
                });
            }

            const videoFile = req.files.video[0];
            const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;

            // Validate video file
            const videoValidation = r2Service.validateVideoFile(videoFile);
            if (!videoValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: videoValidation.error,
                });
            }

            // Validate thumbnail if provided
            if (thumbnailFile) {
                const thumbnailValidation = r2Service.validateThumbnailFile(thumbnailFile);
                if (!thumbnailValidation.valid) {
                    return res.status(400).json({
                        success: false,
                        message: thumbnailValidation.error,
                    });
                }
            }

            // Upload video to R2
            const videoUpload = await r2Service.uploadVideo(videoFile);
            let thumbnailUpload = null;

            // Upload thumbnail if provided
            if (thumbnailFile) {
                thumbnailUpload = await r2Service.uploadThumbnail(thumbnailFile);
            }

            // Create reel record
            const reel = await Reel.create({
                merchant_id: merchantId,
                store_id: store.id,
                service_id: serviceId,
                video_url: videoUpload.url,
                thumbnail_url: thumbnailUpload?.url || null,
                title,
                description,
                duration: parseInt(duration),
                status: status || 'draft',
                published_at: status === 'published' ? new Date() : null,
            });

            res.status(201).json({
                success: true,
                message: 'Reel uploaded successfully',
                data: {
                    id: reel.id,
                    video_url: reel.video_url,
                    thumbnail_url: reel.thumbnail_url,
                    status: reel.status,
                },
            });
        } catch (error) {
            console.error('Error creating reel:', error);
            res.status(500).json({
                success: false,
                message: 'Error uploading reel',
                error: error.message,
            });
        }
    }

    /**
     * Update reel
     * PUT /api/v1/merchant/reels/:id
     */
    async updateReel(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation errors',
                    errors: errors.array(),
                });
            }

            const merchantId = req.user.id;
            const reelId = req.params.id;
            const { title, description, status, serviceId } = req.body;

            const reel = await Reel.findOne({
                where: {
                    id: reelId,
                    merchant_id: merchantId,
                },
            });

            if (!reel) {
                return res.status(404).json({
                    success: false,
                    message: 'Reel not found or unauthorized',
                });
            }

            const updates = {};
            if (title !== undefined) updates.title = title;
            if (description !== undefined) updates.description = description;
            if (status !== undefined) {
                updates.status = status;
                if (status === 'published' && !reel.published_at) {
                    updates.published_at = new Date();
                }
            }
            if (serviceId !== undefined) updates.service_id = serviceId;

            await reel.update(updates);

            res.json({
                success: true,
                message: 'Reel updated successfully',
            });
        } catch (error) {
            console.error('Error updating reel:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating reel',
                error: error.message,
            });
        }
    }

    /**
     * Delete reel
     * DELETE /api/v1/merchant/reels/:id
     */
    async deleteReel(req, res) {
        try {
            const merchantId = req.user.id;
            const reelId = req.params.id;

            const reel = await Reel.findOne({
                where: {
                    id: reelId,
                    merchant_id: merchantId,
                },
            });

            if (!reel) {
                return res.status(404).json({
                    success: false,
                    message: 'Reel not found or unauthorized',
                });
            }

            // Delete from database
            await reel.destroy();

            // Delete files from R2 (don't wait for completion)
            if (reel.video_url) {
                r2Service.deleteFile(reel.video_url).catch(err =>
                    console.error('Error deleting video from R2:', err)
                );
            }

            if (reel.thumbnail_url) {
                r2Service.deleteFile(reel.thumbnail_url).catch(err =>
                    console.error('Error deleting thumbnail from R2:', err)
                );
            }

            res.json({
                success: true,
                message: 'Reel deleted successfully',
            });
        } catch (error) {
            console.error('Error deleting reel:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting reel',
                error: error.message,
            });
        }
    }

    /**
     * Get reel analytics
     * GET /api/v1/merchant/reels/:id/analytics
     */
    async getAnalytics(req, res) {
        try {
            const merchantId = req.user.id;
            const reelId = req.params.id;

            const reel = await Reel.findOne({
                where: {
                    id: reelId,
                    merchant_id: merchantId,
                },
            });

            if (!reel) {
                return res.status(404).json({
                    success: false,
                    message: 'Reel not found or unauthorized',
                });
            }

            // Get views by date (last 30 days)
            const viewsByDate = await ReelView.findAll({
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('viewed_at')), 'date'],
                    [sequelize.fn('COUNT', '*'), 'views'],
                ],
                where: {
                    reel_id: reelId,
                    viewed_at: {
                        [Op.gte]: sequelize.literal('DATE_SUB(NOW(), INTERVAL 30 DAY)'),
                    },
                },
                group: [sequelize.fn('DATE', sequelize.col('viewed_at'))],
                order: [[sequelize.fn('DATE', sequelize.col('viewed_at')), 'ASC']],
                raw: true,
            });

            // Get peak viewing hours
            const peakHours = await ReelView.findAll({
                attributes: [
                    [sequelize.fn('HOUR', sequelize.col('viewed_at')), 'hour'],
                    [sequelize.fn('COUNT', '*'), 'views'],
                ],
                where: { reel_id: reelId },
                group: [sequelize.fn('HOUR', sequelize.col('viewed_at'))],
                order: [[sequelize.fn('COUNT', '*'), 'DESC']],
                limit: 5,
                raw: true,
            });

            // Get average watch time
            const avgWatchTime = await ReelView.findOne({
                attributes: [
                    [sequelize.fn('AVG', sequelize.col('view_duration')), 'avg_duration'],
                ],
                where: { reel_id: reelId },
                raw: true,
            });

            const engagementRate = reel.views > 0
                ? (((reel.likes + reel.shares) / reel.views) * 100).toFixed(2)
                : 0;

            res.json({
                success: true,
                data: {
                    totalViews: reel.views,
                    totalLikes: reel.likes,
                    totalShares: reel.shares,
                    totalChats: reel.chats,
                    averageWatchTime: Math.round(avgWatchTime?.avg_duration || 0),
                    engagementRate: parseFloat(engagementRate),
                    viewsByDate: viewsByDate,
                    peakHours: peakHours.map(h => h.hour),
                },
            });
        } catch (error) {
            console.error('Error getting analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching analytics',
                error: error.message,
            });
        }
    }

    /**
     * Get single reel
     * GET /api/v1/merchant/reels/:id
     */
    async getReel(req, res) {
        try {
            const merchantId = req.user.id;
            const reelId = req.params.id;

            const reel = await Reel.findOne({
                where: {
                    id: reelId,
                    merchant_id: merchantId,
                },
                include: [
                    {
                        model: Service,
                        as: 'service',
                        attributes: ['id', 'name', 'price'],
                    },
                    {
                        model: Store,
                        as: 'store',
                        attributes: ['id', 'name'],
                    },
                ],
            });

            if (!reel) {
                return res.status(404).json({
                    success: false,
                    message: 'Reel not found or unauthorized',
                });
            }

            res.json({
                success: true,
                data: {
                    id: reel.id,
                    title: reel.title,
                    description: reel.description,
                    video_url: reel.video_url,
                    thumbnail_url: reel.thumbnail_url,
                    duration: reel.duration,
                    status: reel.status,
                    service: reel.service ? {
                        id: reel.service.id,
                        name: reel.service.name,
                        price: reel.service.price,
                    } : null,
                    store: reel.store ? {
                        id: reel.store.id,
                        name: reel.store.name,
                    } : null,
                    views: reel.views,
                    likes: reel.likes,
                    created_at: reel.created_at,
                    published_at: reel.published_at,
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
}

module.exports = new ReelController();