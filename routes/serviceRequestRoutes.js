const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

// ✅ Fixed imports - import from the correct middleware path
const { ServiceRequest, User, ServiceOffer, Category } = require('../models');
const { authenticateToken, requireUserType, requireVerified } = require('../middleware/requestservice'); // ✅ Updated import path

// Debug middleware to check if models are loaded
router.use((req, res, next) => {
  console.log('🔍 Models check:', {
    ServiceRequest: !!ServiceRequest,
    User: !!User,
    ServiceOffer: !!ServiceOffer,
    Category: !!Category
  });
  next();
});

// GET /api/v1/request-service - Get all service requests with filters (PUBLIC)
router.get('/', async (req, res) => {
  try {
    // ✅ Add model validation
    if (!ServiceRequest) {
      throw new Error('ServiceRequest model is not defined');
    }

    const {
      category = 'all',
      budget = 'all',
      timeline = 'all',
      location = '',
      page = 1,
      limit = 10,
      status = 'open'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    // Apply filters
    if (category !== 'all') {
      whereClause.category = category;
    }

    if (budget !== 'all') {
      const budgetRange = budget.split('-');
      if (budgetRange.length === 2) {
        whereClause.budgetMin = { [Op.gte]: parseInt(budgetRange[0]) };
        if (budgetRange[1] !== '+') {
          whereClause.budgetMax = { [Op.lte]: parseInt(budgetRange[1]) };
        }
      }
    }

    if (timeline !== 'all') {
      whereClause.timeline = timeline;
    }

    if (location) {
      whereClause.location = { [Op.like]: `%${location}%` };
    }

    if (status) {
      whereClause.status = status;
    }

    console.log('🔍 Query whereClause:', whereClause);

    // ✅ Query with correct field names for your User model
    const { count, rows } = await ServiceRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'postedByUser', // ✅ This matches the fixed association alias
          attributes: [
            'id', 
            'firstName', 
            'lastName', 
            'avatar', 
            'emailVerifiedAt', 
            'phoneVerifiedAt',
            'userType'
          ],
          required: false
        },
        {
          model: ServiceOffer,
          as: 'offers', // ✅ This matches the association alias
          attributes: ['id'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    const totalPages = Math.ceil(count / parseInt(limit));
    const currentPage = parseInt(page);

    const formattedRequests = rows.map(request => ({
      id: request.id,
      title: request.title,
      category: request.category,
      description: request.description,
      budget: `$${request.budgetMin} - $${request.budgetMax}`,
      timeline: request.timeline,
      location: request.location,
      priority: request.priority,
      status: request.status,
      requirements: request.requirements || [],
      postedBy: request.postedByUser ? 
        `${request.postedByUser.firstName} ${request.postedByUser.lastName}` : 
        'Anonymous',
      verified: request.postedByUser ? 
        !!(request.postedByUser.emailVerifiedAt || request.postedByUser.phoneVerifiedAt) : 
        false, // ✅ Calculate verification from actual fields
      avatar: request.postedByUser?.avatar || null,
      userType: request.postedByUser?.userType || 'customer',
      offers: request.offers?.length || 0,
      postedTime: new Date(request.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }));

    res.json({
      success: true,
      data: {
        requests: formattedRequests,
        pagination: {
          currentPage,
          totalPages,
          totalCount: count,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching service requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service requests',
      error: error.message
    });
  }
});

// GET /api/v1/request-service/categories - Get service categories (PUBLIC)
router.get('/categories', async (req, res) => {
  try {
    // ✅ Get actual counts from database
    const categoryCounts = await ServiceRequest.findAll({
      attributes: [
        'category',
        [ServiceRequest.sequelize.fn('COUNT', ServiceRequest.sequelize.col('id')), 'count']
      ],
      where: {
        status: 'open'
      },
      group: ['category'],
      raw: true
    });

    // Create a map for easy lookup
    const countMap = {};
    categoryCounts.forEach(item => {
      countMap[item.category] = parseInt(item.count);
    });

    const categories = [
      { name: 'Home Services', icon: '🏠', color: 'bg-blue-100 text-blue-800', count: countMap['Home Services'] || 0 },
      { name: 'Auto Services', icon: '🚗', color: 'bg-green-100 text-green-800', count: countMap['Auto Services'] || 0 },
      { name: 'Beauty & Wellness', icon: '💄', color: 'bg-yellow-100 text-yellow-800', count: countMap['Beauty & Wellness'] || 0 },
      { name: 'Tech Support', icon: '💻', color: 'bg-purple-100 text-purple-800', count: countMap['Tech Support'] || 0 },
      { name: 'Event Services', icon: '🎉', color: 'bg-pink-100 text-pink-800', count: countMap['Event Services'] || 0 },
      { name: 'Tutoring', icon: '📚', color: 'bg-orange-100 text-orange-800', count: countMap['Tutoring'] || 0 },
      { name: 'Fitness', icon: '💪', color: 'bg-indigo-100 text-indigo-800', count: countMap['Fitness'] || 0 },
      { name: 'Photography', icon: '📸', color: 'bg-teal-100 text-teal-800', count: countMap['Photography'] || 0 },
      { name: 'Food & Catering', icon: '🍽️', color: 'bg-red-100 text-red-800', count: countMap['Food & Catering'] || 0 },
      { name: 'Legal Services', icon: '⚖️', color: 'bg-gray-100 text-gray-800', count: countMap['Legal Services'] || 0 },
      { name: 'Financial Services', icon: '💰', color: 'bg-yellow-100 text-yellow-800', count: countMap['Financial Services'] || 0 },
      { name: 'Healthcare', icon: '🏥', color: 'bg-red-100 text-red-800', count: countMap['Healthcare'] || 0 },
      { name: 'Pet Services', icon: '🐕', color: 'bg-green-100 text-green-800', count: countMap['Pet Services'] || 0 },
      { name: 'Moving & Storage', icon: '📦', color: 'bg-blue-100 text-blue-800', count: countMap['Moving & Storage'] || 0 },
      { name: 'Landscaping', icon: '🌱', color: 'bg-green-100 text-green-800', count: countMap['Landscaping'] || 0 },
      { name: 'Other', icon: '🔧', color: 'bg-gray-100 text-gray-800', count: countMap['Other'] || 0 }
    ];

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// POST /api/v1/request-service - Create new service request (AUTHENTICATED CUSTOMERS)
router.post('/', authenticateToken, requireUserType('customer'), async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      budgetMin,
      budgetMax,
      timeline,
      location,
      requirements = [],
      priority = 'normal'
    } = req.body;

    // ✅ Enhanced validation
    const errors = [];
    
    if (!title?.trim()) errors.push('Title is required');
    if (!category) errors.push('Category is required');
    if (!description?.trim()) errors.push('Description is required');
    if (!budgetMin || budgetMin <= 0) errors.push('Valid minimum budget is required');
    if (!budgetMax || budgetMax <= 0) errors.push('Valid maximum budget is required');
    if (!timeline) errors.push('Timeline is required');
    if (!location?.trim()) errors.push('Location is required');
    
    if (title && (title.length < 5 || title.length > 200)) {
      errors.push('Title must be between 5 and 200 characters');
    }
    
    if (description && (description.length < 10 || description.length > 2000)) {
      errors.push('Description must be between 10 and 2000 characters');
    }
    
    if (budgetMin && budgetMax && parseInt(budgetMin) >= parseInt(budgetMax)) {
      errors.push('Maximum budget must be greater than minimum budget');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // ✅ Validate category against allowed values
    const allowedCategories = [
      'Home Services', 'Auto Services', 'Beauty & Wellness', 'Tech Support',
      'Event Services', 'Tutoring', 'Fitness', 'Photography', 'Food & Catering',
      'Legal Services', 'Financial Services', 'Healthcare', 'Pet Services',
      'Moving & Storage', 'Landscaping', 'Other'
    ];

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category selected'
      });
    }

    // ✅ Validate timeline
    const allowedTimelines = ['urgent', 'thisweek', 'nextweek', 'thismonth', 'flexible'];
    if (!allowedTimelines.includes(timeline)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeline selected'
      });
    }

    // ✅ Validate priority
    const allowedPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority selected'
      });
    }

    const serviceRequest = await ServiceRequest.create({
      title: title.trim(),
      category,
      description: description.trim(),
      budgetMin: parseFloat(budgetMin),
      budgetMax: parseFloat(budgetMax),
      timeline,
      location: location.trim(),
      requirements: Array.isArray(requirements) ? requirements : [],
      priority,
      status: 'open',
      postedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: {
        id: serviceRequest.id,
        title: serviceRequest.title,
        category: serviceRequest.category,
        status: serviceRequest.status,
        budget: `$${serviceRequest.budgetMin} - $${serviceRequest.budgetMax}`,
        timeline: serviceRequest.timeline,
        location: serviceRequest.location,
        createdAt: serviceRequest.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error creating service request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/v1/request-service/offers - Get user's received offers (AUTHENTICATED CUSTOMERS)
router.get('/offers', authenticateToken, requireUserType('customer'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause for offers
    const offerWhere = {};
    if (status !== 'all') {
      offerWhere.status = status;
    }

    const { count, rows } = await ServiceOffer.findAndCountAll({
      where: offerWhere,
      include: [
        {
          model: ServiceRequest,
          as: 'request', // ✅ This matches the fixed association alias
          where: { postedBy: req.user.id },
          attributes: ['id', 'title', 'category', 'budgetMin', 'budgetMax'],
          required: true
        },
        {
          model: User,
          as: 'provider', // ✅ This matches the association alias
          attributes: [
            'id', 
            'firstName', 
            'lastName', 
            'avatar', 
            'emailVerifiedAt', 
            'phoneVerifiedAt',
            'userType'
          ],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    const totalPages = Math.ceil(count / parseInt(limit));
    const currentPage = parseInt(page);

    const formattedOffers = rows.map(offer => ({
      id: offer.id,
      requestId: offer.requestId,
      providerName: offer.provider ? 
        `${offer.provider.firstName} ${offer.provider.lastName}` : 
        'Anonymous',
      providerId: offer.providerId,
      verified: offer.provider ? 
        !!(offer.provider.emailVerifiedAt || offer.provider.phoneVerifiedAt) : 
        false,
      avatar: offer.provider?.avatar || null,
      rating: 0, // ✅ TODO: Add rating logic if you have a ratings system
      reviews: 0, // ✅ TODO: Add review count logic
      price: `$${offer.quotedPrice}`,
      quotedPrice: offer.quotedPrice,
      message: offer.message,
      availability: offer.availability,
      status: offer.status,
      requestTitle: offer.request?.title || 'Unknown Request',
      requestCategory: offer.request?.category || '',
      requestBudget: offer.request ? 
        `$${offer.request.budgetMin} - $${offer.request.budgetMax}` : '',
      estimatedDuration: offer.estimatedDuration,
      includesSupplies: offer.includesSupplies,
      warranty: offer.warranty,
      responseTime: calculateResponseTime(offer.createdAt), // ✅ Helper function
      createdAt: offer.createdAt,
      acceptedAt: offer.acceptedAt,
      rejectedAt: offer.rejectedAt
    }));

    res.json({
      success: true,
      data: {
        offers: formattedOffers,
        pagination: {
          currentPage,
          totalPages,
          totalCount: count,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching offers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch offers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/v1/request-service/my-requests - Get user's past requests (AUTHENTICATED CUSTOMERS)
router.get('/my-requests', authenticateToken, requireUserType('customer'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = { postedBy: req.user.id };
    if (status !== 'all') {
      whereClause.status = status;
    }

    const { count, rows } = await ServiceRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: ServiceOffer,
          as: 'offers',
          attributes: ['id', 'status', 'quotedPrice'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    const totalPages = Math.ceil(count / parseInt(limit));
    const currentPage = parseInt(page);

    const formattedRequests = rows.map(request => ({
      id: request.id,
      title: request.title,
      category: request.category,
      description: request.description,
      budget: `$${request.budgetMin} - $${request.budgetMax}`,
      timeline: request.timeline,
      location: request.location,
      priority: request.priority,
      status: request.status,
      requirements: request.requirements || [],
      offers: request.offers?.length || 0,
      pendingOffers: request.offers?.filter(o => o.status === 'pending').length || 0,
      acceptedOffers: request.offers?.filter(o => o.status === 'accepted').length || 0,
      finalRating: request.finalRating,
      finalReview: request.finalReview,
      createdAt: request.createdAt,
      completedAt: request.completedAt,
      cancelledAt: request.cancelledAt
    }));

    res.json({
      success: true,
      data: {
        requests: formattedRequests,
        pagination: {
          currentPage,
          totalPages,
          totalCount: count,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/v1/request-service/statistics - Get platform statistics (PUBLIC)
router.get('/statistics', async (req, res) => {
  try {
    // ✅ Get real statistics from database
    const [
      totalUsers,
      totalCustomers,
      totalMerchants,
      totalRequests,
      completedRequests,
      activeRequests,
      totalOffers
    ] = await Promise.all([
      User.count({ where: { isActive: true } }),
      User.count({ where: { userType: 'customer', isActive: true } }),
      User.count({ where: { userType: 'merchant', isActive: true } }),
      ServiceRequest.count(),
      ServiceRequest.count({ where: { status: 'completed' } }),
      ServiceRequest.count({ where: { status: 'open' } }),
      ServiceOffer.count()
    ]);

    const statistics = {
      totalUsers,
      totalCustomers,
      totalProviders: totalMerchants,
      totalRequests,
      completedRequests,
      activeRequests,
      totalOffers,
      averageRating: 4.8, // ✅ TODO: Calculate from actual ratings
      successRate: totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0
    };

    res.json({
      success: true,
      data: statistics
    });

  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// PUT /api/v1/request-service/:id/accept-offer - Accept an offer (AUTHENTICATED CUSTOMERS)
router.put('/:requestId/accept-offer/:offerId', authenticateToken, requireUserType('customer'), async (req, res) => {
  try {
    const { requestId, offerId } = req.params;

    // Verify the request belongs to the user
    const serviceRequest = await ServiceRequest.findOne({
      where: {
        id: requestId,
        postedBy: req.user.id,
        status: 'open'
      }
    });

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found or not accessible'
      });
    }

    // Verify the offer exists and belongs to this request
    const offer = await ServiceOffer.findOne({
      where: {
        id: offerId,
        requestId: requestId,
        status: 'pending'
      }
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or not available for acceptance'
      });
    }

    // Accept the offer and update request status
    await Promise.all([
      offer.update({
        status: 'accepted',
        acceptedAt: new Date()
      }),
      serviceRequest.update({
        status: 'in_progress',
        acceptedOfferId: offerId
      }),
      // Reject all other pending offers for this request
      ServiceOffer.update(
        { 
          status: 'rejected',
          rejectedAt: new Date()
        },
        {
          where: {
            requestId: requestId,
            id: { [Op.ne]: offerId },
            status: 'pending'
          }
        }
      )
    ]);

    res.json({
      success: true,
      message: 'Offer accepted successfully',
      data: {
        requestId,
        offerId,
        status: 'accepted'
      }
    });

  } catch (error) {
    console.error('❌ Error accepting offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept offer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Helper function to calculate response time
function calculateResponseTime(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const diffInHours = Math.floor((now - created) / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    return 'Quick responder';
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  } else {
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
}

module.exports = router;