// routes/merchantServiceRoutes.js - FIXED AUTHENTICATION
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { sequelize } = require('../models');

// ✅ SAFE: Import models and middleware with error handling
let ServiceRequest, User, ServiceOffer, Store;
let authenticateMerchant; // ✅ FIXED: Use merchant auth only

try {
  const models = require('../models');
  ServiceRequest = models.ServiceRequest;
  User = models.User;
  ServiceOffer = models.ServiceOffer;
  Store = models.Store;
  
  console.log('✅ Merchant Service - Models loaded:', {
    ServiceRequest: !!ServiceRequest,
    User: !!User,
    ServiceOffer: !!ServiceOffer,
    Store: !!Store
  });
} catch (modelError) {
  console.error('❌ Error loading models in merchant service:', modelError.message);
}

// ✅ FIXED: Use ONLY merchant authentication middleware
try {
  const merchantMiddleware = require('../middleware/Merchantauth');
  authenticateMerchant = merchantMiddleware.authenticateMerchant;
  
  console.log('✅ Merchant Service - Merchant middleware loaded');
} catch (middlewareError) {
  console.error('❌ Error loading merchant middleware:', middlewareError.message);
  
  // ✅ FALLBACK: Create basic merchant middleware if not found
  authenticateMerchant = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    console.log('🔍 Merchant Auth Check:', {
      hasHeader: !!authHeader,
      hasToken: !!token,
      tokenLength: token ? token.length : 0
    });
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }
    
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      console.log('✅ Token decoded:', {
        id: decoded.id,
        userId: decoded.userId,
        email: decoded.email,
        type: decoded.type
      });
      
      // ✅ CRITICAL: Check if token is for a merchant
      if (decoded.type !== 'merchant') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Merchant access required.',
          code: 'INVALID_TOKEN_TYPE'
        });
      }
      
      // ✅ FIXED: Set merchant user data correctly
      req.user = {
        id: decoded.id || decoded.userId, // Use id first, fallback to userId
        email: decoded.email,
        type: 'merchant',
        userType: 'merchant'
      };
      
      console.log('✅ Merchant authenticated:', req.user);
      next();
    } catch (error) {
      console.error('❌ Merchant auth failed:', error.message);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please log in again.',
          code: 'TOKEN_EXPIRED'
        });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please log in again.',
          code: 'INVALID_TOKEN'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Authentication failed',
        code: 'AUTH_FAILED'
      });
    }
  };
}

// Debug middleware
router.use((req, res, next) => {
  console.log(`🏪 Merchant Route: ${req.method} ${req.originalUrl}`);
  console.log('🔍 Auth Header:', req.headers.authorization ? 'Present' : 'Missing');
  next();
});

// ✅ FIXED: GET /api/v1/merchant/stores - Get merchant's stores
router.get('/stores', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    console.log(`🏪 Fetching stores for merchant: ${merchantId}`);

    if (!Store) {
      console.warn('⚠️ Store model not available, returning fallback data');
      const fallbackStores = [
        {
          id: 'fallback-store-1',
          name: 'Test Store 1',
          description: 'A test store for development',
          category: 'Home Services',
          location: 'Test Location',
          rating: 4.5,
          logo_url: null,
          status: 'open',
          verified: true,
          createdAt: new Date()
        }
      ];

      return res.json({
        success: true,
        data: {
          stores: fallbackStores
        }
      });
    }

    const stores = await Store.findAll({
      where: { 
        merchant_id: merchantId,
        is_active: true 
      },
      attributes: [
        'id', 'name', 'description', 'category', 'location', 
        'rating', 'logo_url', 'status', 'created_by', 'createdAt'
      ],
      order: [['createdAt', 'DESC']]
    });

    const formattedStores = stores.map(store => ({
      id: store.id,
      name: store.name,
      description: store.description,
      category: store.category,
      location: store.location,
      rating: store.rating || 0,
      logo_url: store.logo_url,
      status: store.status,
      verified: true,
      createdAt: store.createdAt
    }));

    console.log(`✅ Found ${stores.length} stores for merchant`);

    res.json({
      success: true,
      data: {
        stores: formattedStores
      }
    });

  } catch (error) {
    console.error('❌ Error fetching merchant stores:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stores',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: GET /api/v1/merchant/service-requests - Get filtered service requests for merchant
router.get('/service-requests', authenticateMerchant, async (req, res) => {
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
    console.log('🔍 Query filters:', { budget, timeline, location, category, status });

    if (!ServiceRequest || !Store) {
      console.warn('⚠️ Required models not available, returning fallback data');
      
      const fallbackRequests = [
        {
          id: 'req-001',
          title: 'Kitchen Plumbing Repair',
          description: 'Need a professional plumber to fix a leaky kitchen sink and replace the faucet.',
          category: 'Home Services',
          location: 'Downtown Nairobi',
          budget: '$150 - $300',
          budgetMin: 150,
          budgetMax: 300,
          timeline: 'urgent',
          urgency: 'IMMEDIATE', // ✅ NEW
          scheduledDateTime: null, // ✅ NEW
          cutoffTime: null, // ✅ NEW
          priority: 'high',
          status: 'open',
          postedBy: 'Sarah K.',
          postedTime: '2 hours ago',
          offers: 3,
          verified: true,
          merchantOffered: false,
          requirements: ['Licensed plumber', 'Same day service'],
          createdAt: new Date()
        }
      ];

      return res.json({
        success: true,
        data: {
          requests: fallbackRequests,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: fallbackRequests.length,
            hasNext: false,
            hasPrev: false,
            limit: parseInt(limit)
          },
          filters: { budget, timeline, location, category, status },
          merchantStoreCategories: ['Home Services']
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
      console.log('⚠️ No stores found for merchant');
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

    // Get unique categories from merchant's stores
    const merchantCategories = [...new Set(merchantStores.map(store => store.category))];
    console.log('🏪 Merchant store categories:', merchantCategories);

    // Build query filters
    const whereClause = {
      status: status === 'all' ? { [Op.ne]: 'closed' } : status,
      category: { [Op.in]: merchantCategories } // Only show requests matching merchant's store categories
    };

    // Apply additional filters
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

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get service requests with user information
    const includeOptions = [];
    
    if (User) {
      includeOptions.push({
        model: User,
        as: 'postedByUser',
        attributes: ['id', 'firstName', 'lastName', 'avatar', ],
        required: false
      });
    }

    const { count, rows } = await ServiceRequest.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      order: [
        // ✅ ENHANCED: Sort IMMEDIATE requests first, then by priority, then by newest
        [
          sequelize.literal(`CASE WHEN urgency = 'IMMEDIATE' THEN 0 WHEN urgency = 'SCHEDULED' THEN 1 ELSE 2 END`),
          'ASC'
        ],
        ['priority', 'DESC'], // Then urgent/high priority
        ['createdAt', 'DESC']  // Then newest
      ],
      limit: parseInt(limit),
      offset: offset
    });

    const totalPages = Math.ceil(count / parseInt(limit));
    const currentPage = parseInt(page);

    // Check if merchant has already made offers for these requests
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

    // Format the service requests
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
      urgency: request.urgency || 'CHECK_LATER', // ✅ NEW: Uber-style urgency field
      scheduledDateTime: request.scheduledDateTime || null, // ✅ NEW: Scheduled date/time
      cutoffTime: request.cutoffTime || null, // ✅ NEW: Cutoff time for offers
      priority: request.priority || 'normal', // ✅ FIXED: Changed from 'medium' to 'normal'
      status: request.status,
      postedBy: request.postedByUser ?
        `${request.postedByUser.firstName} ${request.postedByUser.lastName.charAt(0)}.` :
        'Unknown User',
      postedTime: calculateTimeAgo(request.createdAt),
      offers: request.offerCount || 0,
      verified: request.postedByUser?.verified || false,
      merchantOffered: !!merchantOfferMap[request.id],
      requirements: request.requirements ?
        (Array.isArray(request.requirements) ? request.requirements : JSON.parse(request.requirements || '[]')) :
        [],
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    }));

    console.log(`✅ Found ${count} service requests matching merchant categories`);

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

// ✅ FIXED: GET /api/v1/merchant/offers - Get merchant's offers across all stores
router.get('/offers', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { 
      status = 'all', 
      storeId = 'all',
      page = 1, 
      limit = 10 
    } = req.query;

    console.log(`📤 Fetching offers for merchant: ${merchantId}`);

    if (!ServiceOffer || !Store) {
      console.warn('⚠️ Required models not available, returning fallback data');
      
      const fallbackOffers = [
        {
          id: 'offer-1',
          requestId: 'req-1',
          requestTitle: 'Plumbing Repair Needed',
          requestCategory: 'Home Services',
          quotedPrice: 150,
          message: 'I can fix your plumbing issue quickly and efficiently.',
          availability: 'Available tomorrow morning',
          status: 'pending',
          storeName: 'Test Plumbing Store',
          storeId: 'store-1',
          customerName: 'John D.',
          submittedAt: 'Just now',
          requestBudget: '$100 - $200',
          requestLocation: 'Downtown',
          createdAt: new Date()
        }
      ];

      return res.json({
        success: true,
        data: {
          offers: fallbackOffers,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: fallbackOffers.length,
            hasNext: false,
            hasPrev: false
          },
          stores: [
            { id: 'store-1', name: 'Test Store' }
          ],
          stats: {
            pending: 1,
            accepted: 0,
            rejected: 0
          }
        }
      });
    }

    // Get merchant's stores
    const merchantStores = await Store.findAll({ 
      where: { merchant_id: merchantId },
      attributes: ['id', 'name']
    });

    const storeIds = merchantStores.map(store => store.id);

    if (storeIds.length === 0) {
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
          },
          stores: [],
          stats: {
            pending: 0,
            accepted: 0,
            rejected: 0
          }
        }
      });
    }

    // Build filter
    const whereClause = { storeId: { [Op.in]: storeIds } };
    
    if (status !== 'all') {
      whereClause.status = status;
    }
    
    if (storeId !== 'all') {
      whereClause.storeId = storeId;
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get offers with populated data
    const includeOptions = [];
    
    if (ServiceRequest) {
      includeOptions.push({
        model: ServiceRequest,
        as: 'request',
        attributes: ['id', 'title', 'category', 'budgetMin', 'budgetMax', 'location'],
        include: User ? [{
          model: User,
          as: 'postedByUser',
          attributes: ['id', 'firstName', 'lastName', 'avatar'],
          required: false
        }] : [],
        required: false
      });
    }
    
    if (Store) {
      includeOptions.push({
        model: Store,
        as: 'store',
        attributes: ['id', 'name', 'category'],
        required: false
      });
    }

    const { count, rows } = await ServiceOffer.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    const totalPages = Math.ceil(count / parseInt(limit));
    const currentPage = parseInt(page);

    // Format offers
    const formattedOffers = rows.map(offer => ({
      id: offer.id,
      requestId: offer.requestId,
      requestTitle: offer.request?.title || 'Unknown Request',
      requestCategory: offer.request?.category || '',
      quotedPrice: offer.quotedPrice,
      message: offer.message,
      availability: offer.availability,
      status: offer.status,
      storeName: offer.store?.name || 'Unknown Store',
      storeId: offer.storeId,
      customerName: offer.request?.postedByUser ? 
        `${offer.request.postedByUser.firstName} ${offer.request.postedByUser.lastName.charAt(0)}.` : 
        'Unknown',
      submittedAt: calculateTimeAgo(offer.createdAt),
      requestBudget: offer.request ? 
        `KSH ${offer.request.budgetMin} - KSH ${offer.request.budgetMax}` : '',
      requestLocation: offer.request?.location || '',
      createdAt: offer.createdAt
    }));

    // Get stats
    const stats = await Promise.all([
      ServiceOffer.count({ 
        where: { storeId: { [Op.in]: storeIds }, status: 'pending' }
      }),
      ServiceOffer.count({ 
        where: { storeId: { [Op.in]: storeIds }, status: 'accepted' }
      }),
      ServiceOffer.count({ 
        where: { storeId: { [Op.in]: storeIds }, status: 'rejected' }
      })
    ]);

    console.log(`✅ Found ${count} offers for merchant`);

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
        },
        stores: merchantStores,
        stats: {
          pending: stats[0],
          accepted: stats[1],
          rejected: stats[2]
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching merchant offers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch offers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: GET /api/v1/merchant/dashboard/stats - Get merchant dashboard statistics
router.get('/dashboard/stats', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    console.log(`📊 Fetching dashboard stats for merchant: ${merchantId}`);

    if (!Store || !ServiceOffer) {
      console.warn('⚠️ Required models not available, returning fallback stats');
      
      const fallbackStats = {
        totalOffers: 5,
        pendingOffers: 2,
        acceptedOffers: 2,
        rejectedOffers: 1,
        totalEarnings: 750,
        activeStores: 2,
        acceptanceRate: 40.0
      };

      return res.json({
        success: true,
        data: fallbackStats
      });
    }

    // Get merchant's stores
    const storeIds = (await Store.findAll({ 
      where: { merchant_id: merchantId },
      attributes: ['id']
    })).map(store => store.id);

    if (storeIds.length === 0) {
      return res.json({
        success: true,
        data: {
          totalOffers: 0,
          pendingOffers: 0,
          acceptedOffers: 0,
          rejectedOffers: 0,
          totalEarnings: 0,
          activeStores: 0,
          acceptanceRate: 0
        }
      });
    }

    const [
      totalOffers,
      pendingOffers,
      acceptedOffers,
      rejectedOffers,
      totalEarnings,
      activeStores
    ] = await Promise.all([
      ServiceOffer.count({ where: { storeId: { [Op.in]: storeIds } } }),
      ServiceOffer.count({ where: { storeId: { [Op.in]: storeIds }, status: 'pending' } }),
      ServiceOffer.count({ where: { storeId: { [Op.in]: storeIds }, status: 'accepted' } }),
      ServiceOffer.count({ where: { storeId: { [Op.in]: storeIds }, status: 'rejected' } }),
      ServiceOffer.sum('quotedPrice', { 
        where: { storeId: { [Op.in]: storeIds }, status: 'accepted' }
      }),
      Store.count({ where: { merchant_id: merchantId, is_active: true } })
    ]);

    const acceptanceRate = totalOffers > 0 ? 
      ((acceptedOffers / totalOffers) * 100).toFixed(1) : 0;

    const stats = {
      totalOffers,
      pendingOffers,
      acceptedOffers,
      rejectedOffers,
      totalEarnings: totalEarnings || 0,
      activeStores,
      acceptanceRate: parseFloat(acceptanceRate)
    };

    console.log('✅ Dashboard stats calculated:', stats);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error fetching merchant dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: PUT /api/v1/merchant/offers/:offerId - Update offer status
router.put('/offers/:offerId', authenticateMerchant, async (req, res) => {
  try {
    const { offerId } = req.params;
    const { status, reason } = req.body;
    const merchantId = req.user.id;

    console.log(`🔄 Updating offer ${offerId} status to ${status} for merchant ${merchantId}`);

    // Validate status
    const validStatuses = ['pending', 'withdrawn'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided'
      });
    }

    if (!ServiceOffer) {
      throw new Error('ServiceOffer model is not available');
    }

    // Find the offer and verify ownership through store
    const includeOptions = [];
    
    if (Store) {
      includeOptions.push({
        model: Store,
        as: 'store',
        attributes: ['id', 'name', 'merchant_id'],
        required: false
      });
    }
    
    if (ServiceRequest) {
      includeOptions.push({
        model: ServiceRequest,
        as: 'request',
        attributes: ['id', 'title', 'postedBy'],
        required: false
      });
    }

    const offer = await ServiceOffer.findByPk(offerId, {
      include: includeOptions
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    // Check if merchant owns the store that made the offer
    if (Store && offer.store && offer.store.merchant_id !== merchantId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this offer'
      });
    }

    // Check if offer can be updated
    if (offer.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify an accepted offer'
      });
    }

    // Update offer status
    const updateData = { status, updatedAt: new Date() };
    if (reason) {
      updateData.statusReason = reason;
    }
    if (status === 'withdrawn') {
      updateData.withdrawnAt = new Date();
    }

    await offer.update(updateData);

    console.log(`✅ Offer ${offerId} updated to ${status}`);

    res.json({
      success: true,
      message: `Offer ${status} successfully`,
      data: {
        offerId,
        status,
        storeName: offer.store?.name || 'Unknown Store',
        requestTitle: offer.request?.title || 'Unknown Request'
      }
    });

  } catch (error) {
    console.error('❌ Error updating offer status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update offer status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ DEBUG: Test merchant authentication
router.get('/debug-auth', authenticateMerchant, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      type: req.user.type
    },
    message: 'Merchant authentication working'
  });
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