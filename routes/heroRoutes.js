const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Offer } = require('../models/hero');

// ===========================
// HELPER FUNCTIONS
// ===========================

// Calculate time left for an offer
const getTimeLeft = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const timeDiff = expiry - now;

    if (timeDiff <= 0) return "Expired";

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
    return "Few minutes left";
};

// Add time left to offers
const addTimeLeftToOffers = (offers) => {
    return offers.map(offer => ({
        ...offer.toJSON(),
        timeLeft: getTimeLeft(offer.expiresAt)
    }));
};

// Common where clause for active offers
const getActiveOfferWhere = () => ({
    isActive: true,
    expiresAt: {
        [Op.gt]: new Date()
    }
});

// ===========================
// ROUTES
// ===========================

/**
 * @route   GET /api/hero/offers
 * @desc    Get all featured offers for hero carousel
 * @access  Public
 */
router.get('/offers', async (req, res) => {
    try {
        const offers = await Offer.findAll({
            where: {
                ...getActiveOfferWhere(),
                isFeatured: true
            },
            order: [['createdAt', 'DESC']]
        });

        const offersWithTimeLeft = addTimeLeftToOffers(offers);

        res.json({
            success: true,
            data: offersWithTimeLeft,
            count: offersWithTimeLeft.length
        });
    } catch (error) {
        console.error('Error fetching hero offers:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching hero offers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route   GET /api/hero/side-offers
 * @desc    Get all side offers
 * @access  Public
 */
router.get('/side-offers', async (req, res) => {
    try {
        const sideOffers = await Offer.findAll({
            where: {
                ...getActiveOfferWhere(),
                isFeatured: false
            },
            order: [['createdAt', 'DESC']]
        });

        const sideOffersWithTimeLeft = addTimeLeftToOffers(sideOffers);

        res.json({
            success: true,
            data: sideOffersWithTimeLeft,
            count: sideOffersWithTimeLeft.length
        });
    } catch (error) {
        console.error('Error fetching side offers:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching side offers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route   GET /api/hero/offers/:id
 * @desc    Get specific offer by ID
 * @access  Public
 */
router.get('/offers/:id', async (req, res) => {
    try {
        const offerId = parseInt(req.params.id);

        if (isNaN(offerId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid offer ID'
            });
        }

        const offer = await Offer.findOne({
            where: {
                id: offerId,
                ...getActiveOfferWhere()
            }
        });

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: 'Offer not found or has expired'
            });
        }

        res.json({
            success: true,
            data: {
                ...offer.toJSON(),
                timeLeft: getTimeLeft(offer.expiresAt)
            }
        });
    } catch (error) {
        console.error('Error fetching offer:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching offer',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route   POST /api/hero/offers
 * @desc    Create new offer
 * @access  Private (Admin)
 */
router.post('/offers', async (req, res) => {
    try {
        const {
            title,
            description,
            image,
            originalPrice,
            discountPercentage,
            store,
            durationDays,
            isFeatured = false
        } = req.body;

        // Validation
        if (!title || !description || !originalPrice || !discountPercentage || !store) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, description, originalPrice, discountPercentage, store'
            });
        }

        if (originalPrice <= 0 || discountPercentage <= 0 || discountPercentage >= 100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid price or discount percentage'
            });
        }

        const discountedPrice = originalPrice - (originalPrice * discountPercentage / 100);
        const expiresAt = new Date(Date.now() + (durationDays || 7) * 24 * 60 * 60 * 1000);

        const newOffer = await Offer.create({
            title,
            description,
            image: image || '/images/default.jpg',
            originalPrice: parseFloat(originalPrice),
            discountedPrice: parseFloat(discountedPrice.toFixed(2)),
            discountPercentage: parseInt(discountPercentage),
            store,
            expiresAt,
            isActive: true,
            isFeatured
        });

        res.status(201).json({
            success: true,
            message: 'Offer created successfully',
            data: {
                ...newOffer.toJSON(),
                timeLeft: getTimeLeft(newOffer.expiresAt)
            }
        });
    } catch (error) {
        console.error('Error creating offer:', error);

        // Handle Sequelize validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(err => ({
                    field: err.path,
                    message: err.message
                }))
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating offer',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route   PUT /api/hero/offers/:id
 * @desc    Update existing offer
 * @access  Private (Admin)
 */
router.put('/offers/:id', async (req, res) => {
    try {
        const offerId = parseInt(req.params.id);
        const updates = req.body;

        if (isNaN(offerId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid offer ID'
            });
        }

        const offer = await Offer.findByPk(offerId);

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: 'Offer not found'
            });
        }

        // Recalculate discounted price if price or discount changed
        if (updates.originalPrice || updates.discountPercentage) {
            const originalPrice = updates.originalPrice || offer.originalPrice;
            const discountPercentage = updates.discountPercentage || offer.discountPercentage;
            updates.discountedPrice = parseFloat((originalPrice - (originalPrice * discountPercentage / 100)).toFixed(2));
        }

        // Update the offer
        await offer.update(updates);

        res.json({
            success: true,
            message: 'Offer updated successfully',
            data: {
                ...offer.toJSON(),
                timeLeft: getTimeLeft(offer.expiresAt)
            }
        });
    } catch (error) {
        console.error('Error updating offer:', error);

        // Handle Sequelize validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors.map(err => ({
                    field: err.path,
                    message: err.message
                }))
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error updating offer',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route   DELETE /api/hero/offers/:id
 * @desc    Delete/deactivate offer
 * @access  Private (Admin)
 */
router.delete('/offers/:id', async (req, res) => {
    try {
        const offerId = parseInt(req.params.id);

        if (isNaN(offerId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid offer ID'
            });
        }

        const offer = await Offer.findByPk(offerId);

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: 'Offer not found'
            });
        }

        // Soft delete by deactivating
        await offer.update({
            isActive: false,
            deletedAt: new Date()
        });

        res.json({
            success: true,
            message: 'Offer deactivated successfully'
        });
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting offer',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route   GET /api/hero/stats
 * @desc    Get offers statistics
 * @access  Private (Admin)
 */
router.get('/stats', async (req, res) => {
    try {
        const [
            totalOffers,
            activeOffers,
            expiredOffers,
            featuredOffers,
            sideOffers
        ] = await Promise.all([
            Offer.count(),
            Offer.count({ where: getActiveOfferWhere() }),
            Offer.count({
                where: {
                    [Op.or]: [
                        { isActive: false },
                        { expiresAt: { [Op.lte]: new Date() } }
                    ]
                }
            }),
            Offer.count({
                where: {
                    ...getActiveOfferWhere(),
                    isFeatured: true
                }
            }),
            Offer.count({
                where: {
                    ...getActiveOfferWhere(),
                    isFeatured: false
                }
            })
        ]);

        // Calculate total savings
        const activeOffersData = await Offer.findAll({
            where: getActiveOfferWhere(),
            attributes: ['originalPrice', 'discountedPrice']
        });

        const totalSavings = activeOffersData.reduce((sum, offer) =>
            sum + (offer.originalPrice - offer.discountedPrice), 0
        );

        res.json({
            success: true,
            data: {
                total: totalOffers,
                active: activeOffers,
                expired: expiredOffers,
                featured: featuredOffers,
                sideOffers: sideOffers,
                totalSavings: totalSavings.toFixed(2)
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching stats',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route   GET /api/hero/all
 * @desc    Get all offers (featured + side offers) combined
 * @access  Public
 */
router.get('/all', async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'createdAt', order = 'DESC' } = req.query;

        const offset = (page - 1) * limit;

        const { count, rows: offers } = await Offer.findAndCountAll({
            where: getActiveOfferWhere(),
            order: [[sort, order.toUpperCase()]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const offersWithTimeLeft = addTimeLeftToOffers(offers);

        res.json({
            success: true,
            data: offersWithTimeLeft,
            count: offersWithTimeLeft.length,
            totalCount: count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error('Error fetching all offers:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching all offers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route   POST /api/hero/offers/:id/activate
 * @desc    Reactivate a deactivated offer
 * @access  Private (Admin)
 */
router.post('/offers/:id/activate', async (req, res) => {
    try {
        const offerId = parseInt(req.params.id);

        if (isNaN(offerId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid offer ID'
            });
        }

        const offer = await Offer.findByPk(offerId);

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: 'Offer not found'
            });
        }

        await offer.update({
            isActive: true,
            reactivatedAt: new Date()
        });

        res.json({
            success: true,
            message: 'Offer reactivated successfully',
            data: {
                ...offer.toJSON(),
                timeLeft: getTimeLeft(offer.expiresAt)
            }
        });
    } catch (error) {
        console.error('Error reactivating offer:', error);
        res.status(500).json({
            success: false,
            message: 'Error reactivating offer',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

/**
 * @route   GET /api/hero/search
 * @desc    Search offers by title, description, or store
 * @access  Public
 */
router.get('/search', async (req, res) => {
    try {
        const { q, page = 1, limit = 10 } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const offset = (page - 1) * limit;

        const { count, rows: offers } = await Offer.findAndCountAll({
            where: {
                ...getActiveOfferWhere(),
                [Op.or]: [
                    { title: { [Op.iLike]: `%${q}%` } },
                    { description: { [Op.iLike]: `%${q}%` } },
                    { store: { [Op.iLike]: `%${q}%` } }
                ]
            },
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const offersWithTimeLeft = addTimeLeftToOffers(offers);

        res.json({
            success: true,
            data: offersWithTimeLeft,
            count: offersWithTimeLeft.length,
            totalCount: count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            searchQuery: q
        });
    } catch (error) {
        console.error('Error searching offers:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching offers',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;