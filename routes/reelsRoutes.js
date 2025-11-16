// routes/reelsRoutes.js - Unified Reels Routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body, param, query } = require('express-validator');

// Import controllers
const merchantReelController = require('../controllers/merchant/reelController');
const customerReelController = require('../controllers/customer/reelController');

// Import middleware - using your existing auth structure
const { authenticateToken } = require('../middleware/auth'); // lowercase 'a' to match your existing files
const { authenticateMerchant } = require('../middleware/Merchantauth'); // Capital 'M' to match your existing file
const { optionalAuth } = require('../middleware/optionalAuth'); // For optional auth

// Configure multer for memory storage (upload to Cloudflare R2)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'video') {
            if (file.mimetype.startsWith('video/')) {
                cb(null, true);
            } else {
                cb(new Error('Only video files are allowed'), false);
            }
        } else if (file.fieldname === 'thumbnail') {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed'), false);
            }
        } else {
            cb(new Error('Unexpected field'), false);
        }
    },
});

// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

const createReelValidation = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ min: 1, max: 100 })
        .withMessage('Title must be between 1 and 100 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters'),
    body('serviceId')
        .notEmpty()
        .withMessage('Service ID is required')
        .isInt()
        .withMessage('Service ID must be a valid integer'),
    body('status')
        .optional()
        .isIn(['draft', 'published'])
        .withMessage('Status must be either draft or published'),
    body('duration')
        .notEmpty()
        .withMessage('Duration is required')
        .isInt({ min: 1, max: 60 })
        .withMessage('Duration must be between 1 and 60 seconds'),
];

const updateReelValidation = [
    param('id')
        .isInt()
        .withMessage('Reel ID must be a valid integer'),
    body('title')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Title must be between 1 and 100 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters'),
    body('status')
        .optional()
        .isIn(['draft', 'published', 'pending'])
        .withMessage('Invalid status'),
    body('serviceId')
        .optional()
        .isInt()
        .withMessage('Service ID must be a valid integer'),
];

const reelIdValidation = [
    param('id')
        .isInt()
        .withMessage('Reel ID must be a valid integer'),
];

const feedValidation = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50'),
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be a positive integer'),
    query('location')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Location must be less than 100 characters'),
    query('category')
        .optional()
        .isInt()
        .withMessage('Category must be a valid integer'),
    query('store_id')
        .optional()
        .isInt()
        .withMessage('Store ID must be a valid integer'),
    query('sort')
        .optional()
        .isIn(['recent', 'trending'])
        .withMessage('Sort must be either recent or trending'),
];

const trackViewValidation = [
    param('id')
        .isInt()
        .withMessage('Reel ID must be a valid integer'),
    body('duration')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Duration must be a positive integer'),
];

// ==========================================
// MERCHANT ROUTES
// ==========================================

/**
 * @route   GET /api/v1/merchant/reels
 * @desc    Get all reels for authenticated merchant
 * @access  Private (Merchant)
 */
router.get('/merchant', authenticateMerchant, merchantReelController.getReels);

/**
 * @route   POST /api/v1/merchant/reels
 * @desc    Upload new reel
 * @access  Private (Merchant)
 */
router.post(
    '/merchant',
    authenticateMerchant,
    upload.fields([
        { name: 'video', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
    ]),
    createReelValidation,
    merchantReelController.createReel
);

/**
 * @route   GET /api/v1/merchant/reels/:id
 * @desc    Get single reel by ID
 * @access  Private (Merchant)
 */
router.get(
    '/merchant/:id',
    authenticateMerchant,
    reelIdValidation,
    merchantReelController.getReel
);

/**
 * @route   PUT /api/v1/merchant/reels/:id
 * @desc    Update reel
 * @access  Private (Merchant)
 */
router.put(
    '/merchant/:id',
    authenticateMerchant,
    updateReelValidation,
    merchantReelController.updateReel
);

/**
 * @route   DELETE /api/v1/merchant/reels/:id
 * @desc    Delete reel
 * @access  Private (Merchant)
 */
router.delete(
    '/merchant/:id',
    authenticateMerchant,
    reelIdValidation,
    merchantReelController.deleteReel
);

/**
 * @route   GET /api/v1/merchant/reels/:id/analytics
 * @desc    Get reel analytics
 * @access  Private (Merchant)
 */
router.get(
    '/merchant/:id/analytics',
    authenticateMerchant,
    reelIdValidation,
    merchantReelController.getAnalytics
);

// ==========================================
// CUSTOMER ROUTES
// ==========================================

/**
 * @route   GET /api/v1/reels
 * @desc    Get reels feed
 * @access  Public (optional auth for likes)
 */
router.get('/', optionalAuth, feedValidation, customerReelController.getFeed);

/**
 * @route   GET /api/v1/reels/:id
 * @desc    Get single reel by ID
 * @access  Public (optional auth for likes)
 */
router.get('/:id', optionalAuth, reelIdValidation, customerReelController.getReel);

/**
 * @route   POST /api/v1/reels/:id/like
 * @desc    Toggle like on reel
 * @access  Private (Customer)
 */
router.post('/:id/like', authenticateToken, reelIdValidation, customerReelController.toggleLike);

/**
 * @route   POST /api/v1/reels/:id/view
 * @desc    Track reel view
 * @access  Public (optional auth for analytics)
 */
router.post('/:id/view', optionalAuth, trackViewValidation, customerReelController.trackView);

/**
 * @route   POST /api/v1/reels/:id/share
 * @desc    Track reel share
 * @access  Public
 */
router.post('/:id/share', reelIdValidation, customerReelController.trackShare);

/**
 * @route   POST /api/v1/reels/:id/chat
 * @desc    Track chat initiation from reel
 * @access  Public
 */
router.post('/:id/chat', reelIdValidation, customerReelController.trackChat);

// ==========================================
// ERROR HANDLING
// ==========================================

// Multer error handling
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 100MB',
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    } else if (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
    next();
});

module.exports = router;