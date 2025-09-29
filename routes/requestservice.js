// const express = require('express');
// const { body, param, query } = require('express-validator');
// const requestServiceController = require('../controllers/RequestServiceController');
// const auth = require('../middleware/auth');
// const providerAuth = require('../middleware/providerAuth');

// const router = express.Router();

// // Validation middleware
// const validateCreateRequest = [
//     body('title')
//         .trim()
//         .isLength({ min: 10, max: 200 })
//         .withMessage('Title must be between 10 and 200 characters'),

//     body('category')
//         .trim()
//         .notEmpty()
//         .withMessage('Category is required')
//         .isIn([
//             'Web Development',
//             'Graphic Design',
//             'Writing & Translation',
//             'Digital Marketing',
//             'Video & Animation',
//             'Music & Audio',
//             'Programming',
//             'Business',
//             'Health & Fitness',
//             'Beauty & Salon',
//             'Photography',
//             'Home Services',
//             'Automotive',
//             'Education',
//             'Technology',
//             'Legal Services',
//             'Consulting',
//             'Healthcare',
//             'Food & Catering',
//             'Event Services',
//             'Pet Services',
//             'Moving & Storage',
//             'Landscaping',
//             'Cleaning Services',
//             'Repair Services',
//             'Installation Services',
//             'Financial Services',
//             'Other'
//         ])
//         .withMessage('Invalid category selected'),

//     body('description')
//         .trim()
//         .isLength({ min: 20, max: 1000 })
//         .withMessage('Description must be between 20 and 1000 characters'),

//     body('budgetRange')
//         .trim()
//         .notEmpty()
//         .withMessage('Budget range is required'),

//     body('timeline')
//         .trim()
//         .notEmpty()
//         .withMessage('Timeline is required'),

//     body('location')
//         .trim()
//         .isLength({ min: 3, max: 100 })
//         .withMessage('Location must be between 3 and 100 characters'),

//     body('requirements')
//         .optional()
//         .isArray()
//         .withMessage('Requirements must be an array'),

//     body('priority')
//         .optional()
//         .isIn(['Normal', 'High', 'Urgent'])
//         .withMessage('Invalid priority level')
// ];

// const validateCreateOffer = [
//     body('price')
//         .isFloat({ min: 1 })
//         .withMessage('Price must be a positive number'),

//     body('message')
//         .trim()
//         .isLength({ min: 10, max: 500 })
//         .withMessage('Message must be between 10 and 500 characters'),

//     body('timelineOffered')
//         .optional()
//         .trim()
//         .isLength({ max: 100 })
//         .withMessage('Timeline offered must be less than 100 characters')
// ];

// const validateObjectId = [
//     param('id')
//         .isMongoId()
//         .withMessage('Invalid request ID')
// ];

// const validateOfferObjectId = [
//     param('offerId')
//         .isMongoId()
//         .withMessage('Invalid offer ID')
// ];

// // Public routes (no authentication required)

// // GET /api/requests - Get all service requests with filtering
// router.get('/', requestServiceController.getAllRequests);

// // GET /api/requests/categories - Get service categories
// router.get('/categories', requestServiceController.getServiceCategories);

// // GET /api/requests/stats - Get platform statistics
// router.get('/stats', requestServiceController.getPlatformStats);

// // GET /api/requests/search - Search requests
// router.get('/search', requestServiceController.searchRequests);

// // GET /api/requests/recent-offers - Get recent offers
// router.get('/recent-offers', requestServiceController.getRecentOffers);

// // GET /api/requests/:id - Get specific request by ID
// router.get('/:id', validateObjectId, requestServiceController.getRequestById);

// // Protected routes (authentication required)

// // POST /api/requests - Create new service request
// router.post('/',
//     auth,
//     validateCreateRequest,
//     requestServiceController.createRequest
// );

// // PUT /api/requests/:id/status - Update request status
// router.put('/:id/status',
//     auth,
//     validateObjectId,
//     body('status')
//         .isIn(['Open', 'In Progress', 'Completed', 'Cancelled'])
//         .withMessage('Invalid status'),
//     requestServiceController.updateRequestStatus
// );

// // POST /api/requests/:id/offers - Create offer for a request (providers only)
// router.post('/:id/offers',
//     providerAuth,
//     validateObjectId,
//     validateCreateOffer,
//     requestServiceController.createOffer
// );

// // PUT /api/requests/offers/:offerId/accept - Accept an offer
// router.put('/offers/:offerId/accept',
//     auth,
//     validateOfferObjectId,
//     requestServiceController.acceptOffer
// );

// module.exports = router;