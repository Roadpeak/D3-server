// routes/merchantServiceRoutes.js - Backend API routes for merchant service requests
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

const { ServiceRequest, User, ServiceOffer, Store, Merchant } = require('../models');
const { authenticateToken, requireUserType } = require('../middleware/requestservice');

// Debug middleware to check if models are loaded
router.use((req, res, next) => {
  console.log('🏪 Merchant Service Routes - Models check:', {
    ServiceRequest: !!ServiceRequest,
    User: !!User,
    ServiceOffer: !!ServiceOffer,
    Store: !!Store,
    Merchant: !!Merchant
  });
  next();
});

// GET /api/v1/merchant/stores - Get merchant's stores
router.get('/stores', authenticateToken, requireUserType('merchant'), async (req, res) => {
  try {
    console.log('🏪 Getting stores for merchant:', req.user.id);

    const stores = await Store.findAll({
      where: { 
        merchant_id: req.user.id,
        is_active: true 
      },
      attributes: [
        'id', 'name', 'description', 'category', 'location', 
        'phone_number', 'primary_email', 'logo_url', 'rating', 
        'verification_status', 'is_active', 'created_at'
      ],
      order: [['created_at', 'DESC']]
    });

    const formattedStores = stores.map(store => ({
      id: store.id,
      name: store.name,
      description: store.description,
      category: store.category,
      location: store.location,
      phone_number: store.phone_number,
      primary_email: store.primary_email,
      logo_url: store.logo_url,
      rating: store.rating || 0,
      verified: store.verification_status === 'verified',
      status: store.is_active ? 'active' : 'inactive',
      created_at: store.created_at
    }));

    res.json({
      success: true,
      data: formattedStores
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

// GET /api/v1/merchant/service-requests - Get service requests filtered by merchant's store categories
router.get('/service-requests', authenticateToken, requireUserType('merchant'), async (req, res) => {
  try {
    const {
      category,
      budget,
      timeline,
      location,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('🔍 Getting service requests for merchant:', req.user.id);

    // Get merchant's stores and their categories
    const merchantStores = await Store.findAll({
      where: { 
        merchant_id: req.user.id, 
        is_active: true 
      },
      attributes: ['id', 'name', 'category']
    });

    if (!merchantStores.length) {
      return res.status(400).json({
        success: false,
        message: 'No active stores found. Please create a store first.'
      });
    }

    // Extract all categories from merchant's stores
    const storeCategories = [...new Set(
      merchantStores.flatMap(store => store.category)
    )];

    // Map store categories to service request categories
    const categoryMapping = {
      'Beauty & Salon': ['Beauty & Wellness'],
      'Beauty & Wellness': ['Beauty & Wellness'],
      'Automotive': ['Auto Services'],
      'Auto Services': ['Auto Services'],
      'Health & Fitness': ['Fitness', 'Healthcare'],
      'Professional Services': ['Home Services', 'Legal Services', 'Financial Services'],
      'Restaurant': ['Food & Catering'],
      'Food & Catering': ['Food & Catering'],
      'Entertainment': ['Event Services', 'Photography'],
      'Technology': ['Tech Support'],
      'Other': ['Other', 'Home Services']
    };

    const matchingServiceCategories = storeCategories.flatMap(
      storeCategory => categoryMapping[storeCategory] || ['Home Services']
    );

    // Build filter object
    const filter = { 
      status: 'open',
      category: { [Op.in]: matchingServiceCategories }
    };
    
    if (category && category !== 'all') {
      filter.category = category;
    }
    
    if (budget && budget !== 'all') {
      const [min, max] = budget.split('-');
      filter.budgetMin = { [Op.gte]: parseInt(min) };
      if (max !== '+') {
        filter.budgetMax = { [Op.lte]: parseInt(max) };
      }
    }
    
    if (timeline && timeline !== 'all') {
      filter.timeline = timeline;
    }
    
    if (location) {
      filter.location = { [Op.like]: `%${location}%` };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Get requests with populated user data and check for existing offers
    const { count, rows } = await ServiceRequest.findAndCountAll({
      where: filter,
      include: [
        {
          model: User,
          as: 'postedByUser',
          attributes: [
            'id', 'firstName', 'lastName', 'avatar', 
            'emailVerifiedAt', 'phoneVerifiedAt', 'userType'
          ],
          required: false
        },
        {
          model: ServiceOffer,
          as: 'offers',
          attributes: ['id', 'storeId', 'status'],
          required: false
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: skip
    });

    const totalPages = Math.ceil(count / parseInt(limit));
    const currentPage = parseInt(page);

    // Format response data with merchant-specific info
    const formattedRequests = rows.map(request => {
      // Check if this merchant already made an offer
      const merchantOffered = request.offers && request.offers.some(offer => 
        merchantStores.some(store => store.id === offer.storeId)
      );

      // Find eligible stores for this request
      const eligibleStores = merchantStores.filter(store => 
        matchingServiceCategories.includes(request.category)
      );

      return {
        id: request.id,
        title: request.title,
        category: request.category,
        description: request.description,
        budget: `$${request.budgetMin} - $${request.budgetMax}`,
        budgetMin: request.budgetMin,
        budgetMax: request.budgetMax,
        timeline: request.timeline,
        location: request.location,
        postedBy: request.postedByUser ? 
          `${request.postedByUser.firstName} ${request.postedByUser.lastName}` : 
          'Anonymous',
        verified: request.postedByUser ? 
          !!(request.postedByUser.emailVerifiedAt || request.postedByUser.phoneVerifiedAt) : 
          false,
        postedTime: formatTimeAgo(request.createdAt),
        offers: request.offers?.length || 0,
        status: request.status,
        priority: request.priority,
        requirements: request.requirements,
        merchantOffered,
        eligibleStores: eligibleStores.map(store => ({
          id: store.id,
          name: store.name,
          category: store.category
        }))
      };
    });

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
        },
        merchantStores: merchantStores.map(store => ({
          id: store.id,
          name: store.name,
          category: store.category
        })),
        matchingCategories: matchingServiceCategories
      }
    });

  } catch (error) {
    console.error('❌ Error fetching service requests for merchant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service requests',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/v1/service-requests/:requestId/offers - Create offer from merchant's store
router.post('/service-requests/:requestId/offers', authenticateToken, requireUserType('merchant'), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { storeId, quotedPrice, message, availability, estimatedDuration, includesSupplies } = req.body;
    const merchantId = req.user.id;

    console.log('📤 Creating offer for request:', requestId, 'from store:', storeId);

    // Verify the store belongs to the merchant
    const store = await Store.findOne({ 
      where: { 
        id: storeId, 
        merchant_id: merchantId, 
        is_active: true 
      }
    });

    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'Store not found or not accessible'
      });
    }

    // Check if request exists and is open
    const request = await ServiceRequest.findByPk(requestId);
    if (!request || request.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'Service request not available for offers'
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
        message: 'This store has already made an offer for this request'
      });
    }

    // Validate offer data
    if (!quotedPrice || parseFloat(quotedPrice) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quoted price is required'
      });
    }

    if (!message || message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 10 characters long'
      });
    }

    // Create new offer
    const newOffer = await ServiceOffer.create({
      requestId,
      providerId: merchantId,
      storeId,
      quotedPrice: parseFloat(quotedPrice),
      message: message.trim(),
      availability: availability.trim(),
      estimatedDuration: estimatedDuration?.trim() || null,
      includesSupplies: includesSupplies || false,
      status: 'pending'
    });

    console.log('✅ Offer created successfully:', newOffer.id);

    res.status(201).json({
      success: true,
      message: 'Offer submitted successfully',
      data: {
        offerId: newOffer.id,
        status: newOffer.status,
        storeName: store.name,
        quotedPrice: newOffer.quotedPrice
      }
    });

  } catch (error) {
    console.error('❌ Error creating store offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create offer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/v1/merchant/offers - Get merchant's offers across all stores
router.get('/offers', authenticateToken, requireUserType('merchant'), async (req, res) => {
  try {
    const { 
      status = 'all', 
      storeId = 'all',
      page = 1, 
      limit = 10 
    } = req.query;

    console.log('📋 Getting offers for merchant:', req.user.id);

    // Get merchant's stores
    const merchantStores = await Store.findAll({ 
      where: { merchant_id: req.user.id },
      attributes: ['id', 'name']
    });

    const storeIds = merchantStores.map(store => store.id);

    if (!storeIds.length) {
      return res.json({
        success: true,
        data: {
          offers: [],
          pagination: { currentPage: 1, totalPages: 0, totalCount: 0 },
          stores: []
        }
      });
    }

    // Build filter
    const filter = { storeId: { [Op.in]: storeIds } };
    
    if (status !== 'all') {
      filter.status = status;
    }
    
    if (storeId !== 'all') {
      filter.storeId = storeId;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get offers with populated data
    const { count, rows } = await ServiceOffer.findAndCountAll({
      where: filter,
      include: [
        {
          model: ServiceRequest,
          as: 'request',
          attributes: ['id', 'title', 'category', 'budgetMin', 'budgetMax', 'location'],
          include: [
            {
              model: User,
              as: 'postedByUser',
              attributes: ['id', 'firstName', 'lastName'],
              required: false
            }
          ]
        },
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: skip
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
        `${offer.request.postedByUser.firstName} ${offer.request.postedByUser.lastName}` : 
        'Unknown Customer',
      submittedAt: formatTimeAgo(offer.createdAt),
      requestBudget: offer.request ? 
        `$${offer.request.budgetMin} - $${offer.request.budgetMax}` : '',
      requestLocation: offer.request?.location || '',
      estimatedDuration: offer.estimatedDuration,
      includesSupplies: offer.includesSupplies
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
        },
        stores: merchantStores
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

// GET /api/v1/merchant/dashboard/stats - Get merchant dashboard statistics
router.get('/dashboard/stats', authenticateToken, requireUserType('merchant'), async (req, res) => {
  try {
    console.log('📊 Getting dashboard stats for merchant:', req.user.id);

    // Get merchant's stores
    const storeIds = (await Store.findAll({ 
      where: { merchant_id: req.user.id },
      attributes: ['id']
    })).map(store => store.id);

    if (!storeIds.length) {
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
      Store.count({ where: { merchant_id: req.user.id, is_active: true } })
    ]);

    const acceptanceRate = totalOffers > 0 ? 
      ((acceptedOffers / totalOffers) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        totalOffers,
        pendingOffers,
        acceptedOffers,
        rejectedOffers,
        totalEarnings: totalEarnings || 0,
        activeStores,
        acceptanceRate: parseFloat(acceptanceRate)
      }
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

// Helper function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diffInMs = now - new Date(date);
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
    return new Date(date).toLocaleDateString();
  }
}

module.exports = router;