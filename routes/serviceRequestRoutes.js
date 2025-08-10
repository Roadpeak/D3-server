const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

// ✅ Fixed imports - make sure to import ServiceOffer instead of Offer
const { ServiceRequest, User, ServiceOffer, Category } = require('../models');
const { authenticateToken } = require('../middleware/requestservice');

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

// GET /api/v1/service-requests - Get all service requests with filters
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
      whereClause.location = { [Op.like]: `%${location}%` }; // ✅ Changed to Op.like for MySQL
    }

    if (status) {
      whereClause.status = status;
    }

    console.log('🔍 Query whereClause:', whereClause);

    // ✅ This is line 51 - where the error was occurring
    const { count, rows } = await ServiceRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user', // ✅ This matches the association alias in models/index.js
          attributes: ['id', 'firstName', 'lastName'], // ✅ REMOVED 'verified' field
          required: false
        },
        {
          model: ServiceOffer,
          as: 'offers', // ✅ This matches the association alias in models/index.js
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
      postedBy: request.user ? 
        `${request.user.firstName} ${request.user.lastName}` : 
        'Anonymous',
      verified: false, // ✅ Default to false since column doesn't exist
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

// GET /api/v1/service-requests/categories - Get service categories
router.get('/categories', async (req, res) => {
  try {
    // You can either fetch from database or return static categories
    const categories = [
      { name: 'Home Services', icon: '🏠', color: 'bg-blue-100 text-blue-800', count: 45 },
      { name: 'Auto Services', icon: '🚗', color: 'bg-green-100 text-green-800', count: 32 },
      { name: 'Beauty & Wellness', icon: '💄', color: 'bg-yellow-100 text-yellow-800', count: 28 },
      { name: 'Tech Support', icon: '💻', color: 'bg-green-100 text-green-800', count: 23 },
      { name: 'Event Services', icon: '🎉', color: 'bg-purple-100 text-purple-800', count: 19 },
      { name: 'Tutoring', icon: '📚', color: 'bg-orange-100 text-orange-800', count: 15 },
      { name: 'Fitness', icon: '💪', color: 'bg-indigo-100 text-indigo-800', count: 12 },
      { name: 'Photography', icon: '📸', color: 'bg-pink-100 text-pink-800', count: 8 }
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

// POST /api/v1/service-requests - Create new service request
router.post('/', authenticateToken, async (req, res) => {
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

    // Validation
    if (!title || !category || !description || !budgetMin || !budgetMax || !timeline || !location) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    if (parseInt(budgetMin) >= parseInt(budgetMax)) {
      return res.status(400).json({
        success: false,
        message: 'Maximum budget must be greater than minimum budget'
      });
    }

    const serviceRequest = await ServiceRequest.create({
      title,
      category,
      description,
      budgetMin: parseInt(budgetMin),
      budgetMax: parseInt(budgetMax),
      timeline,
      location,
      requirements,
      priority,
      status: 'open',
      postedBy: req.user.id // ✅ Using postedBy as defined in the model
    });

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: serviceRequest
    });

  } catch (error) {
    console.error('❌ Error creating service request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service request',
      error: error.message
    });
  }
});

// GET /api/v1/service-requests/offers - Get user's received offers
router.get('/offers', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await ServiceOffer.findAndCountAll({
      include: [
        {
          model: ServiceRequest,
          as: 'serviceRequest', // ✅ This matches the association alias
          where: { postedBy: req.user.id },
          attributes: ['id', 'title']
        },
        {
          model: User,
          as: 'provider', // ✅ This matches the association alias
          attributes: ['id', 'firstName', 'lastName'] // ✅ REMOVED 'verified' field
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
      providerName: offer.provider ? 
        `${offer.provider.firstName} ${offer.provider.lastName}` : 
        'Anonymous',
      verified: false, // ✅ Default to false since column doesn't exist
      rating: 0, // You'll need to add rating logic
      reviews: 0, // You'll need to add review count logic
      price: `$${offer.quotedPrice}`,
      message: offer.message,
      availability: offer.availability,
      status: offer.status,
      requestTitle: offer.serviceRequest?.title || 'Unknown Request',
      responseTime: 'Quick responder' // You can calculate this based on timestamps
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
      error: error.message
    });
  }
});

// GET /api/v1/service-requests/statistics - Get platform statistics
router.get('/statistics', async (req, res) => {
  try {
    const statistics = {
      totalProviders: 2547,
      completedRequests: 15236,
      averageRating: 4.8,
      activeRequests: 523
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
      error: error.message
    });
  }
});

// Additional routes would go here...

module.exports = router;