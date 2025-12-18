// routes/serviceRequestRoutes.js - COMPLETE VERSION WITHOUT MOCK DATA
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

// ✅ Import models with error handling
let ServiceRequest, User, ServiceOffer, Store, Merchant, sequelize;

try {
  const models = require('../models');
  ServiceRequest = models.ServiceRequest;
  User = models.User;
  ServiceOffer = models.ServiceOffer;
  Store = models.Store;
  Merchant = models.Merchant;
  sequelize = models.sequelize;
  
  console.log('✅ Service Request Routes - Models loaded:', {
    ServiceRequest: !!ServiceRequest,
    User: !!User,
    ServiceOffer: !!ServiceOffer,
    Store: !!Store,
    Merchant: !!Merchant
  });
} catch (modelError) {
  console.error('❌ Error loading models in service request routes:', modelError.message);
}

// ✅ Import middleware systems
let authenticateToken, requireUserType, authenticateMerchant;

try {
  // For regular users
  const userMiddleware = require('../middleware/requestservice');
  authenticateToken = userMiddleware.authenticateToken;
  requireUserType = userMiddleware.requireUserType;
  
  // For merchants
  const merchantMiddleware = require('../middleware/Merchantauth');
  authenticateMerchant = merchantMiddleware.authenticateMerchant;
  
  console.log('✅ Service Request Routes - Both middleware systems loaded');
} catch (middlewareError) {
  console.error('❌ Error loading middleware in service request routes:', middlewareError.message);
  
  // Fallback middleware
  authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }
    
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  };
  
  requireUserType = (userType) => {
    return (req, res, next) => {
      if ((req.user.userType || req.user.type) !== userType) {
        return res.status(403).json({
          success: false,
          message: `Access denied. ${userType} role required.`
        });
      }
      next();
    };
  };
  
  authenticateMerchant = authenticateToken;
}

// Debug middleware
router.use((req, res, next) => {
  console.log(`🔍 Service Request Route: ${req.method} ${req.originalUrl}`);
  console.log('🔍 Auth Header:', req.headers.authorization ? 'Present' : 'Missing');
  next();
});

// ✅ GET /api/v1/request-service/categories - Get service categories
router.get('/categories', async (req, res) => {
  try {
    console.log('📋 Fetching service categories...');

    let categories = [];
    
    if (Store) {
      try {
        // Get unique categories from active stores
        const storeCategories = await Store.findAll({
          attributes: ['category'],
          where: { is_active: true },
          group: ['category'],
          raw: true
        });

        if (storeCategories.length > 0) {
          const categoryPromises = storeCategories.map(async (cat, index) => {
            const count = await Store.count({
              where: { 
                category: cat.category,
                is_active: true 
              }
            });
            
            return {
              id: index + 1,
              name: cat.category,
              count: count,
              icon: getCategoryIcon(cat.category),
              color: getCategoryColor(cat.category)
            };
          });

          categories = await Promise.all(categoryPromises);
          console.log(`✅ Found ${categories.length} real categories from stores`);
        }
      } catch (dbError) {
        console.warn('⚠️ Could not fetch categories from database:', dbError.message);
      }
    }

    // If no real categories found, return empty array (no mock data)
    if (categories.length === 0) {
      console.log('📋 No categories found in database');
      categories = [];
    }

    res.json({
      success: true,
      data: categories,
      message: categories.length > 0 ? 'Service categories fetched successfully' : 'No categories available'
    });

  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service categories',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET /api/v1/request-service/statistics - Get platform statistics
router.get('/statistics', async (req, res) => {
  try {
    console.log('📊 Fetching platform statistics...');

    let stats = {
      totalRequests: 0,
      activeRequests: 0,
      completedRequests: 0,
      totalProviders: 0,
      averageRating: 0
    };

    // Get real statistics from database
    if (ServiceRequest) {
      try {
        const [totalRequests, activeRequests, completedRequests] = await Promise.all([
          ServiceRequest.count(),
          ServiceRequest.count({ where: { status: 'open' } }),
          ServiceRequest.count({ where: { status: 'completed' } })
        ]);

        stats.totalRequests = totalRequests;
        stats.activeRequests = activeRequests;
        stats.completedRequests = completedRequests;

        console.log(`✅ Real stats - Total: ${totalRequests}, Active: ${activeRequests}, Completed: ${completedRequests}`);
      } catch (dbError) {
        console.warn('⚠️ Could not fetch request statistics:', dbError.message);
      }
    }

    if (Store) {
      try {
        const totalProviders = await Store.count({ where: { is_active: true } });
        stats.totalProviders = totalProviders;
        
        console.log(`✅ Real provider count: ${totalProviders}`);
      } catch (dbError) {
        console.warn('⚠️ Could not fetch provider count:', dbError.message);
      }
    }

    res.json({
      success: true,
      data: stats,
      message: 'Platform statistics fetched successfully'
    });

  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET /api/v1/request-service/nearby-stores - Get nearby stores for map
router.get('/nearby-stores', async (req, res) => {
  try {
    const { lat, lng, radius = 5000, limit = 20 } = req.query;

    console.log('📍 Fetching nearby stores for location:', { lat, lng, radius });

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: lat, lng'
      });
    }

    if (!Store) {
      return res.json({
        success: true,
        data: { stores: [] }
      });
    }

    // Get active stores
    const stores = await Store.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'category', 'location', 'latitude', 'longitude', 'rating', 'logo_url'],
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    // Format stores for map display
    const formattedStores = stores.map(store => ({
      id: store.id,
      name: store.name,
      category: store.category,
      lat: store.latitude || (parseFloat(lat) + (Math.random() - 0.5) * 0.02),
      lng: store.longitude || (parseFloat(lng) + (Math.random() - 0.5) * 0.02),
      rating: store.rating || 4.0,
      logo_url: store.logo_url
    }));

    console.log(`✅ Found ${formattedStores.length} nearby stores`);

    res.json({
      success: true,
      data: {
        stores: formattedStores
      }
    });

  } catch (error) {
    console.error('❌ Error fetching nearby stores:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch nearby stores',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ Helper function for category icons
function getCategoryIcon(categoryName) {
  const iconMap = {
    'Web Development': '💻',
    'Graphic Design': '🎨',
    'Writing & Translation': '✍️',
    'Digital Marketing': '📱',
    'Video & Animation': '🎬',
    'Music & Audio': '🎵',
    'Programming': '⚡',
    'Business': '💼',
    'Home Services': '🏠',
    'Health & Fitness': '💪',
    'Photography': '📸',
    'Education': '📚',
    'Legal': '⚖️',
    'Consulting': '🎯',
    'Technology': '🔧',
    'Arts & Crafts': '🎭'
  };

  return iconMap[categoryName] || '🔧';
}

// ✅ Helper function for category colors
function getCategoryColor(categoryName) {
  const colorMap = {
    'Web Development': 'bg-blue-100 text-blue-800',
    'Graphic Design': 'bg-purple-100 text-purple-800',
    'Writing & Translation': 'bg-green-100 text-green-800',
    'Digital Marketing': 'bg-red-100 text-red-800',
    'Video & Animation': 'bg-yellow-100 text-yellow-800',
    'Music & Audio': 'bg-indigo-100 text-indigo-800',
    'Programming': 'bg-orange-100 text-orange-800',
    'Business': 'bg-gray-100 text-gray-800',
    'Home Services': 'bg-teal-100 text-teal-800',
    'Health & Fitness': 'bg-emerald-100 text-emerald-800',
    'Photography': 'bg-pink-100 text-pink-800',
    'Education': 'bg-lime-100 text-lime-800',
    'Legal': 'bg-slate-100 text-slate-800',
    'Consulting': 'bg-cyan-100 text-cyan-800',
    'Technology': 'bg-violet-100 text-violet-800',
    'Arts & Crafts': 'bg-rose-100 text-rose-800'
  };
  
  return colorMap[categoryName] || 'bg-gray-100 text-gray-800';
}

// ✅ GET /api/v1/request-service/for-merchants - Merchant authentication
router.get('/for-merchants', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const {
      budget = 'all',
      timeline = 'all', 
      location = '',
      page = 1,
      limit = 20,
      category = 'all',
      status = 'open'
    } = req.query;

    console.log(`📋 Fetching service requests for merchant: ${merchantId}`);

    if (!ServiceRequest || !Store) {
      return res.json({
        success: true,
        data: {
          requests: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalCount: 0,
            hasNext: false,
            hasPrev: false,
            limit: parseInt(limit)
          },
          filters: { budget, timeline, location, category, status },
          merchantStoreCategories: []
        }
      });
    }

    // Get merchant's stores and their categories
    const merchantStores = await Store.findAll({
      where: { 
        merchant_id: merchantId,
        is_active: true 
      },
      attributes: ['id', 'name', 'category']
    });

    if (merchantStores.length === 0) {
      return res.json({
        success: true,
        data: {
          requests: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalCount: 0,
            hasNext: false,
            hasPrev: false,
            limit: parseInt(limit)
          },
          message: 'No stores found. Please create a store first to see relevant service requests.',
          merchantStoreCategories: []
        }
      });
    }

    const merchantCategories = [...new Set(merchantStores.map(store => store.category))];

    // Build query filters
    const whereClause = {
      status: status === 'all' ? { [Op.ne]: 'closed' } : status,
      category: { [Op.in]: merchantCategories }
    };

    if (timeline !== 'all') {
      whereClause.timeline = timeline;
    }

    if (location) {
      whereClause.location = { [Op.iLike]: `%${location}%` };
    }

    if (budget !== 'all') {
      if (budget.includes('+')) {
        const minBudget = parseInt(budget.replace('+', ''));
        whereClause.budgetMin = { [Op.gte]: minBudget };
      } else if (budget.includes('-')) {
        const [min, max] = budget.split('-').map(b => parseInt(b.trim()));
        whereClause[Op.and] = [
          { budgetMin: { [Op.lte]: max } },
          { budgetMax: { [Op.gte]: min } }
        ];
      }
    }

    if (category !== 'all') {
      whereClause.category = category;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const includeOptions = [];
    if (User) {
      includeOptions.push({
        model: User,
        as: 'postedByUser',
        attributes: ['id', 'firstName', 'lastName'],
        required: false
      });
    }

    const { count, rows } = await ServiceRequest.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'DESC']
      ],
      limit: parseInt(limit),
      offset: offset
    });

    const totalPages = Math.ceil(count / parseInt(limit));
    const currentPage = parseInt(page);

    // Check for existing offers
    let merchantOfferMap = {};
    if (ServiceOffer && rows.length > 0) {
      try {
        const storeIds = merchantStores.map(store => store.id);
        const existingOffers = await ServiceOffer.findAll({
          where: {
            requestId: { [Op.in]: rows.map(req => req.id) },
            storeId: { [Op.in]: storeIds }
          },
          attributes: ['requestId', 'storeId', 'status']
        });

        merchantOfferMap = existingOffers.reduce((acc, offer) => {
          acc[offer.requestId] = true;
          return acc;
        }, {});
      } catch (offerError) {
        console.warn('⚠️ Could not check existing offers:', offerError.message);
      }
    }

    const formattedRequests = rows.map(request => ({
      id: request.id,
      title: request.title,
      description: request.description,
      category: request.category,
      location: request.location,
      budget: `KSH ${request.budgetMin} - KSH ${request.budgetMax}`,
      budgetMin: request.budgetMin,
      budgetMax: request.budgetMax,
      timeline: request.timeline,
      priority: request.priority || 'medium',
      status: request.status,
      postedBy: request.postedByUser ? 
        `${request.postedByUser.firstName} ${request.postedByUser.lastName.charAt(0)}.` : 
        'Anonymous',
      postedTime: calculateTimeAgo(request.createdAt),
      offers: 0,
      verified: false,
      merchantOffered: !!merchantOfferMap[request.id],
      requirements: request.requirements ? 
        (Array.isArray(request.requirements) ? request.requirements : JSON.parse(request.requirements || '[]')) : 
        [],
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
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
          hasPrev: currentPage > 1,
          limit: parseInt(limit)
        },
        filters: { budget, timeline, location, category, status },
        merchantStoreCategories: merchantCategories,
        merchantStores: merchantStores.map(store => ({
          id: store.id,
          name: store.name,
          category: store.category
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error fetching service requests for merchant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service requests for merchant',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET /api/v1/request-service - Get all service requests (for customers)
router.get('/', async (req, res) => {
  try {
    const {
      category = 'all',
      location = '',
      budget = 'all',
      timeline = 'all',
      page = 1,
      limit = 20
    } = req.query;

    console.log('📋 Fetching public service requests');

    if (!ServiceRequest) {
      return res.json({
        success: true,
        data: {
          requests: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalCount: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    }

    const whereClause = { status: 'open' };

    if (category !== 'all') {
      whereClause.category = category;
    }

    if (location) {
      whereClause.location = { [Op.iLike]: `%${location}%` };
    }

    if (budget !== 'all') {
      if (budget.includes('+')) {
        const minBudget = parseInt(budget.replace('+', ''));
        whereClause.budgetMin = { [Op.gte]: minBudget };
      } else if (budget.includes('-')) {
        const [min, max] = budget.split('-').map(b => parseInt(b.trim()));
        whereClause[Op.and] = [
          { budgetMin: { [Op.lte]: max } },
          { budgetMax: { [Op.gte]: min } }
        ];
      }
    }

    if (timeline !== 'all') {
      whereClause.timeline = timeline;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const includeOptions = [];
    if (User) {
      includeOptions.push({
        model: User,
        as: 'postedByUser',
        attributes: ['id', 'firstName', 'lastName'],
        required: false
      });
    }

    const { count, rows } = await ServiceRequest.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      order: [
        ['priority', 'DESC'],
        ['createdAt', 'DESC']
      ],
      limit: parseInt(limit),
      offset: offset
    });

    const formattedRequests = rows.map(request => ({
      id: request.id,
      title: request.title,
      description: request.description,
      category: request.category,
      location: request.location,
      budget: `KSH ${request.budgetMin} - KSH ${request.budgetMax}`,
      budgetMin: request.budgetMin,
      budgetMax: request.budgetMax,
      timeline: request.timeline,
      priority: request.priority || 'medium',
      status: request.status,
      postedBy: request.postedByUser ? 
        `${request.postedByUser.firstName} ${request.postedByUser.lastName.charAt(0)}.` : 
        'Anonymous',
      postedTime: calculateTimeAgo(request.createdAt),
      offers: 0,
      verified: false,
      requirements: request.requirements ? 
        (Array.isArray(request.requirements) ? request.requirements : JSON.parse(request.requirements || '[]')) : 
        [],
      createdAt: request.createdAt
    }));

    res.json({
      success: true,
      data: {
        requests: formattedRequests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
          totalCount: count,
          hasNext: parseInt(page) < Math.ceil(count / parseInt(limit)),
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching service requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service requests'
    });
  }
});

// ✅ POST /api/v1/request-service - Create new service request
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType || req.user.type;
    
    // Allow both 'customer' and 'user' types to create service requests
    if (!['customer', 'user'].includes(userType)) {
      return res.status(403).json({
        success: false,
        message: 'Only customers and users can create service requests'
      });
    }

    const {
      title,
      description,
      category,
      location,
      budgetMin,
      budgetMax,
      timeline,
      urgency,
      scheduledDateTime,
      cutoffTime,
      priority = 'normal',
      requirements = []
    } = req.body;

    console.log('📝 Creating service request for user:', userId, 'urgency:', urgency);
    console.log('📝 Category:', category);

    // Validation
    if (!title || !description || !category || !location || !budgetMin || !budgetMax) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Map priority values correctly
    // Valid priority values: 'low', 'normal', 'high', 'urgent'
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    let mappedPriority = priority;

    // Map common invalid values to valid ones
    if (!validPriorities.includes(mappedPriority)) {
      const priorityMap = {
        'medium': 'normal',
        'MEDIUM': 'normal',
        'NORMAL': 'normal',
        'LOW': 'low',
        'HIGH': 'high',
        'URGENT': 'urgent',
        'IMMEDIATE': 'urgent'
      };
      mappedPriority = priorityMap[mappedPriority] || 'normal';
    }

    // Validate SCHEDULED requests
    if (urgency === 'SCHEDULED') {
      if (!scheduledDateTime) {
        return res.status(400).json({
          success: false,
          message: 'scheduledDateTime is required for SCHEDULED requests'
        });
      }
      if (!cutoffTime) {
        return res.status(400).json({
          success: false,
          message: 'cutoffTime is required for SCHEDULED requests'
        });
      }
    }

    // Map timeline values correctly
    // Valid timeline values: 'urgent', 'thisweek', 'nextweek', 'thismonth', 'flexible'
    const validTimelines = ['urgent', 'thisweek', 'nextweek', 'thismonth', 'flexible'];
    let mappedTimeline = timeline;

    // If timeline is not provided or invalid, derive from urgency
    if (!mappedTimeline || !validTimelines.includes(mappedTimeline)) {
      if (urgency === 'IMMEDIATE') {
        mappedTimeline = 'urgent';
      } else if (urgency === 'SCHEDULED') {
        mappedTimeline = 'flexible'; // Will be scheduled for specific time
      } else {
        mappedTimeline = 'flexible'; // Default for CHECK_LATER
      }
    }

    if (!ServiceRequest) {
      throw new Error('ServiceRequest model not available');
    }

    const serviceRequest = await ServiceRequest.create({
      title,
      description,
      category, // ✅ NO MAPPING NEEDED - ENUM now matches frontend exactly
      location,
      budgetMin: parseFloat(budgetMin),
      budgetMax: parseFloat(budgetMax),
      timeline: mappedTimeline,
      urgency: urgency || 'CHECK_LATER', // ✅ NEW: Uber-style urgency field
      scheduledDateTime: scheduledDateTime ? new Date(scheduledDateTime) : null, // ✅ NEW
      cutoffTime: cutoffTime ? new Date(cutoffTime) : null, // ✅ NEW
      priority: mappedPriority,
      requirements: JSON.stringify(requirements),
      status: 'open',
      postedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Service request created:', serviceRequest.id);

    // ✅ NEW: Emit Socket.IO event for IMMEDIATE requests
    if (urgency === 'IMMEDIATE' && req.app.locals.io) {
      console.log('📡 Broadcasting IMMEDIATE request to merchants in category:', category);
      req.app.locals.io.to(`category:${category}`).emit('service-request:new', {
        requestId: serviceRequest.id,
        title: serviceRequest.title,
        category: serviceRequest.category,
        location: serviceRequest.location,
        budgetMin: serviceRequest.budgetMin,
        budgetMax: serviceRequest.budgetMax,
        urgency: serviceRequest.urgency,
        createdAt: serviceRequest.createdAt
      });
    }

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: {
        serviceRequest: {
          id: serviceRequest.id,
          title: serviceRequest.title,
          description: serviceRequest.description,
          category: category,
          location: serviceRequest.location,
          budget: `$${serviceRequest.budgetMin} - $${serviceRequest.budgetMax}`,
          timeline: serviceRequest.timeline,
          urgency: serviceRequest.urgency, // ✅ NEW
          scheduledDateTime: serviceRequest.scheduledDateTime, // ✅ NEW
          status: serviceRequest.status
        }
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

// ✅ GET /api/v1/request-service/offers - Get all offers for current user
router.get('/offers', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status = 'all' } = req.query;

    console.log('📋 Fetching user offers for user:', userId);

    if (!ServiceRequest || !ServiceOffer || !Store) {
      return res.json({
        success: true,
        data: {
          offers: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalCount: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    }

    // Get service requests posted by the user
    const userRequests = await ServiceRequest.findAll({
      where: { postedBy: userId },
      attributes: ['id', 'title']
    });

    if (userRequests.length === 0) {
      return res.json({
        success: true,
        data: {
          offers: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalCount: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    }

    const requestIds = userRequests.map(req => req.id);

    const whereClause = {
      requestId: { [Op.in]: requestIds }
    };

    if (status !== 'all') {
      whereClause.status = status;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await ServiceOffer.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'category', 'location', 'rating', 'logo_url'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    const requestTitleMap = userRequests.reduce((acc, req) => {
      acc[req.id] = req.title;
      return acc;
    }, {});

    const formattedOffers = rows.map(offer => ({
      id: offer.id,
      requestId: offer.requestId,
      requestTitle: requestTitleMap[offer.requestId] || 'Unknown Request',
      storeId: offer.storeId,
      storeName: offer.store?.name || 'Unknown Store',
      providerName: offer.store?.name || 'Unknown Provider',
      price: `KSH ${offer.quotedPrice}`,
      message: offer.message,
      availability: offer.availability,
      status: offer.status,
      rating: offer.store?.rating || 0,
      reviews: 0,
      responseTime: calculateTimeAgo(offer.createdAt),
      verified: false,
      estimatedDuration: offer.estimatedDuration,
      includesSupplies: offer.includesSupplies,
      storeDetails: offer.store ? {
        id: offer.store.id,
        name: offer.store.name
      } : null,
      createdAt: offer.createdAt
    }));

    const totalPages = Math.ceil(count / parseInt(limit));

    console.log(`✅ Found ${count} offers for user`);

    res.json({
      success: true,
      data: {
        offers: formattedOffers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount: count,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user offers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user offers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET /api/v1/request-service/user/my-requests - Get user's service requests with offers
router.get('/user/my-requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status = 'all' } = req.query;

    console.log('📋 Fetching user service requests for user:', userId);

    if (!ServiceRequest) {
      return res.json({
        success: true,
        data: {
          requests: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalCount: 0,
            hasNext: false,
            hasPrev: false
          }
        }
      });
    }

    const whereClause = {
      postedBy: userId
    };

    if (status !== 'all') {
      whereClause.status = status;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await ServiceRequest.findAndCountAll({
      where: whereClause,
      order: [
        // ✅ Sort IMMEDIATE requests first
        [
          sequelize.literal(`CASE WHEN urgency = 'IMMEDIATE' THEN 0 WHEN urgency = 'SCHEDULED' THEN 1 ELSE 2 END`),
          'ASC'
        ],
        ['createdAt', 'DESC']
      ],
      limit: parseInt(limit),
      offset: offset
    });

    const formattedRequests = rows.map(request => ({
      id: request.id,
      title: request.title,
      description: request.description,
      category: request.category,
      location: request.location,
      budgetMin: request.budgetMin,
      budgetMax: request.budgetMax,
      budget: `KSH ${request.budgetMin} - KSH ${request.budgetMax}`,
      timeline: request.timeline,
      urgency: request.urgency || 'CHECK_LATER', // ✅ NEW
      scheduledDateTime: request.scheduledDateTime, // ✅ NEW
      cutoffTime: request.cutoffTime, // ✅ NEW
      priority: request.priority || 'normal',
      status: request.status,
      offerCount: request.offerCount || 0, // ✅ NEW: Show offer count
      completedAt: request.completedAt,
      acceptedOfferId: request.acceptedOfferId,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    }));

    const totalPages = Math.ceil(count / parseInt(limit));

    console.log(`✅ Found ${count} requests for user`);

    res.json({
      success: true,
      data: {
        requests: formattedRequests,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount: count,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user requests',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ KEEP OLD ENDPOINT FOR BACKWARD COMPATIBILITY
router.get('/my-requests', authenticateToken, async (req, res) => {
  // Redirect to new endpoint
  req.url = '/user/my-requests';
  return router.handle(req, res);
});

// ✅ POST /api/v1/request-service/:requestId/offers - Create store-based offer
router.post('/:requestId/offers', authenticateMerchant, async (req, res) => {
  try {
    const { requestId } = req.params;
    const merchantId = req.user.id;
    const {
      storeId,
      quotedPrice,
      message,
      availability,
      estimatedDuration,
      includesSupplies = false
    } = req.body;

    console.log('📤 Creating store offer for request:', requestId, 'by merchant:', merchantId);

    // Validation
    if (!storeId || !quotedPrice || !message || !availability) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: storeId, quotedPrice, message, availability'
      });
    }

    if (parseFloat(quotedPrice) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quoted price must be greater than 0'
      });
    }

    if (!ServiceRequest || !ServiceOffer || !Store) {
      throw new Error('Required models not available');
    }

    // Verify the service request exists
    const serviceRequest = await ServiceRequest.findByPk(requestId);
    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }

    if (serviceRequest.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'Service request is no longer open for offers'
      });
    }

    // Verify the store belongs to the merchant
    const store = await Store.findOne({
      where: { 
        id: storeId, 
        merchant_id: merchantId,
        is_active: true 
      }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found, inactive, or does not belong to you'
      });
    }

    // Check if this store already made an offer
    const existingOffer = await ServiceOffer.findOne({
      where: {
        requestId,
        storeId
      }
    });

    if (existingOffer) {
      return res.status(400).json({
        success: false,
        message: 'This store has already made an offer for this service request'
      });
    }

    // Create the offer
    const offer = await ServiceOffer.create({
      requestId,
      storeId,
      providerId: merchantId,
      quotedPrice: parseFloat(quotedPrice),
      message: message.trim(),
      availability: availability.trim(),
      estimatedDuration: estimatedDuration ? estimatedDuration.trim() : null,
      includesSupplies,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Store offer created successfully:', offer.id);

    // ✅ FIXED: Emit Socket.IO event to notify client in real-time (for ALL requests)
    if (req.app.locals.io) {
      console.log('📡 Broadcasting new offer to request room:', requestId);
      req.app.locals.io.to(`request:${requestId}`).emit('offer:new', {
        id: offer.id,
        requestId: offer.requestId,
        storeId: offer.storeId, // ✅ CRITICAL: Added storeId for mapping
        storeName: store.name, // ✅ Added store name
        merchant: {
          id: merchantId,
          name: store.name,
          avatar: store.logo_url || null,
          rating: store.rating || 0
        },
        quotedPrice: offer.quotedPrice, // ✅ CRITICAL: Added quotedPrice
        price: offer.quotedPrice,
        message: offer.message,
        availability: offer.availability,
        estimatedDuration: offer.estimatedDuration,
        responseTime: 'Just now',
        createdAt: offer.createdAt,
        isNew: true
      });
      console.log('✅ Offer emitted to client via Socket.IO');
    } else {
      console.warn('⚠️ Socket.IO not available - offer not broadcasted');
    }

    res.status(201).json({
      success: true,
      message: 'Store offer submitted successfully',
      data: {
        offer: {
          id: offer.id,
          requestId: offer.requestId,
          storeId: offer.storeId,
          storeName: store.name,
          storeCategory: store.category,
          quotedPrice: offer.quotedPrice,
          message: offer.message,
          availability: offer.availability,
          status: offer.status,
          createdAt: offer.createdAt
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating store offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create store offer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ GET /api/v1/request-service/:requestId/offers - Get all offers for a request
router.get('/:requestId/offers', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    console.log('📋 Fetching offers for request:', requestId, 'by user:', userId);

    if (!ServiceRequest || !ServiceOffer || !Store) {
      return res.status(400).json({
        success: false,
        message: 'Required models not available'
      });
    }

    // Verify the request belongs to the user
    const serviceRequest = await ServiceRequest.findOne({
      where: { id: requestId, postedBy: userId }
    });

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found or you do not have permission to view its offers'
      });
    }

    // Get all offers for this request with store details
    const offers = await ServiceOffer.findAll({
      where: { requestId },
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'category', 'location', 'rating', 'logo_url', 'description'],
          required: true
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    const formattedOffers = offers.map(offer => ({
      id: offer.id,
      storeId: offer.storeId,
      storeName: offer.store.name,
      storeCategory: offer.store.category,
      storeLocation: offer.store.location,
      storeRating: offer.store.rating || 0,
      storeLogo: offer.store.logo_url,
      storeDescription: offer.store.description,
      quotedPrice: offer.quotedPrice,
      message: offer.message,
      availability: offer.availability,
      estimatedDuration: offer.estimatedDuration,
      includesSupplies: offer.includesSupplies,
      status: offer.status,
      submittedAt: calculateTimeAgo(offer.createdAt),
      createdAt: offer.createdAt
    }));

    console.log(`✅ Found ${offers.length} offers for request`);

    res.json({
      success: true,
      data: {
        requestTitle: serviceRequest.title,
        requestBudget: `$${serviceRequest.budgetMin} - $${serviceRequest.budgetMax}`,
        offers: formattedOffers
      }
    });

  } catch (error) {
    console.error('❌ Error fetching request offers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch request offers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ PUT /api/v1/request-service/:requestId/accept-offer/:offerId - Accept an offer
router.put('/:requestId/accept-offer/:offerId', authenticateToken, async (req, res) => {
  try {
    const { requestId, offerId } = req.params;
    const userId = req.user.id;

    console.log('✅ Accepting offer:', offerId, 'for request:', requestId, 'by user:', userId);

    if (!ServiceRequest || !ServiceOffer) {
      return res.status(400).json({
        success: false,
        message: 'Required models not available'
      });
    }

    // Verify the request belongs to the user
    const serviceRequest = await ServiceRequest.findOne({
      where: { id: requestId, postedBy: userId }
    });

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found or you do not have permission'
      });
    }

    if (serviceRequest.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'Service request is no longer open'
      });
    }

    // Find the offer
    const offer = await ServiceOffer.findOne({
      where: { id: offerId, requestId }
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending offers can be accepted'
      });
    }

    // Start transaction
    const transaction = await ServiceOffer.sequelize.transaction();

    try {
      // Accept this offer
      await offer.update({
        status: 'accepted',
        acceptedAt: new Date()
      }, { transaction });

      // Update the service request - use 'booked' status for Uber-style flow
      await serviceRequest.update({
        status: 'booked', // ✅ CHANGED: from 'in_progress' to 'booked'
        acceptedOfferId: offerId
      }, { transaction });

      // Reject all other pending offers for this request
      await ServiceOffer.update({
        status: 'rejected',
        rejectedAt: new Date(),
        statusReason: 'Another offer was accepted'
      }, {
        where: {
          requestId,
          id: { [Op.ne]: offerId },
          status: 'pending'
        },
        transaction
      });

      await transaction.commit();

      console.log('✅ Offer accepted successfully');

      // ✅ NEW: Emit Socket.IO event to notify merchants of accepted offer
      if (req.app.locals.io) {
        req.app.locals.io.to(`request:${requestId}`).emit('offer:accepted', {
          requestId,
          offerId,
          acceptedOfferId: offerId,
          newStatus: 'booked'
        });
        console.log('📡 Broadcasted offer acceptance to request room:', requestId);
      }

      res.json({
        success: true,
        message: 'Offer accepted successfully',
        data: {
          offerId,
          requestId,
          newStatus: 'booked' // ✅ CHANGED: from 'in_progress' to 'booked'
        }
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('❌ Error accepting offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept offer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ NEW: PUT /api/v1/request-service/:requestId/reject-offer/:offerId - Reject an offer
router.put('/:requestId/reject-offer/:offerId', authenticateToken, async (req, res) => {
  try {
    const { requestId, offerId } = req.params;
    const userId = req.user.id;
    const { reason = '' } = req.body;

    console.log('❌ Rejecting offer:', offerId, 'for request:', requestId, 'by user:', userId);

    if (!ServiceRequest || !ServiceOffer) {
      return res.status(400).json({
        success: false,
        message: 'Required models not available'
      });
    }

    // Verify the request belongs to the user
    const serviceRequest = await ServiceRequest.findOne({
      where: { id: requestId, postedBy: userId }
    });

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found or you do not have permission'
      });
    }

    // Find the offer
    const offer = await ServiceOffer.findOne({
      where: { id: offerId, requestId }
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending offers can be rejected'
      });
    }

    // Reject the offer
    await offer.update({
      status: 'rejected',
      rejectedAt: new Date(),
      statusReason: reason || 'Rejected by customer'
    });

    console.log('❌ Offer rejected successfully');

    res.json({
      success: true,
      message: 'Offer rejected successfully',
      data: {
        offerId,
        requestId,
        status: 'rejected'
      }
    });

  } catch (error) {
    console.error('❌ Error rejecting offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject offer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Helper function to calculate time ago
function calculateTimeAgo(date) {
  const now = new Date();
  const created = new Date(date);
  const diffInMs = now - created;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return 'Just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  } else {
    return created.toLocaleDateString();
  }
}

module.exports = router;