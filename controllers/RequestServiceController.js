// controllers/RequestServiceController.js
const { Op } = require('sequelize');
const moment = require('moment');

// Import models
let models = {};
try {
  models = require('../models');
} catch (error) {
  console.error('Failed to import models in RequestServiceController:', error);
}

const {
  ServiceRequest,
  ServiceOffer,
  User,
  Store,
  Merchant,
  sequelize
} = models;

/**
 * Get service categories with real counts from active stores
 */
exports.getServiceCategories = async (req, res) => {
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

    return res.json({
      success: true,
      data: categories,
      message: categories.length > 0 ? 'Service categories fetched successfully' : 'No categories available'
    });

  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch service categories',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get platform statistics
 */
exports.getPlatformStatistics = async (req, res) => {
  try {
    console.log('📊 Fetching platform statistics...');

    let stats = {
      totalRequests: 0,
      activeRequests: 0,
      completedRequests: 0,
      totalProviders: 0,
      averageRating: 0
    };

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

    return res.json({
      success: true,
      data: stats,
      message: 'Platform statistics fetched successfully'
    });

  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch platform statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get service requests for merchants (filtered by store categories)
 */
exports.getServiceRequestsForMerchants = async (req, res) => {
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
      requirements: Array.isArray(request.requirements) ? request.requirements : [],
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    }));

    return res.json({
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
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch service requests for merchant',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get all public service requests (for customers)
 */
exports.getPublicServiceRequests = async (req, res) => {
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
      requirements: Array.isArray(request.requirements) ? request.requirements : [],
      createdAt: request.createdAt
    }));

    return res.json({
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
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch service requests'
    });
  }
};

/**
 * Create new service request (Customer/User only)
 */
exports.createServiceRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType || req.user.type;
    
    // Allow both 'customer' and 'user' types
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
      priority = 'normal',
      requirements = []
    } = req.body;

    console.log('📝 Creating service request for user:', userId);

    // Validation
    if (!title || !description || !category || !location || !budgetMin || !budgetMax) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, description, category, location, budgetMin, budgetMax'
      });
    }

    if (parseFloat(budgetMin) >= parseFloat(budgetMax)) {
      return res.status(400).json({
        success: false,
        message: 'Maximum budget must be greater than minimum budget'
      });
    }

    if (!ServiceRequest) {
      throw new Error('ServiceRequest model not available');
    }

    const serviceRequest = await ServiceRequest.create({
      title,
      description,
      category,
      location,
      budgetMin: parseFloat(budgetMin),
      budgetMax: parseFloat(budgetMax),
      timeline,
      priority,
      requirements: JSON.stringify(requirements),
      status: 'open',
      postedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Service request created:', serviceRequest.id);

    return res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: {
        serviceRequest: {
          id: serviceRequest.id,
          title: serviceRequest.title,
          description: serviceRequest.description,
          category: category,
          location: serviceRequest.location,
          budget: `KSH ${serviceRequest.budgetMin} - KSH ${serviceRequest.budgetMax}`,
          timeline: serviceRequest.timeline,
          status: serviceRequest.status
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating service request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create service request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get user's received offers
 */
exports.getUserOffers = async (req, res) => {
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

    // Get user's service requests
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
    const whereClause = { requestId: { [Op.in]: requestIds } };

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
      quotedPrice: offer.quotedPrice,
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
        name: offer.store.name,
        category: offer.store.category,
        location: offer.store.location,
        rating: offer.store.rating,
        logo_url: offer.store.logo_url
      } : null,
      createdAt: offer.createdAt
    }));

    const totalPages = Math.ceil(count / parseInt(limit));

    console.log(`✅ Found ${count} offers for user`);

    return res.json({
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
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user offers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get user's past service requests
 */
exports.getUserPastRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status = 'all' } = req.query;

    console.log('📋 Fetching user past requests for user:', userId);

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

    const whereClause = { postedBy: userId };

    if (status !== 'all') {
      whereClause.status = status;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await ServiceRequest.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
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
      status: request.status,
      offers: 0,
      completedAt: request.completedAt,
      acceptedOffer: request.acceptedOfferId ? {
        storeName: 'Service Provider',
        price: `KSH ${request.budgetMax}`,
        rating: null
      } : null,
      createdAt: request.createdAt
    }));

    const totalPages = Math.ceil(count / parseInt(limit));

    console.log(`✅ Found ${count} past requests for user`);

    return res.json({
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
    console.error('❌ Error fetching user past requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user past requests',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Create store offer for a service request (Merchant only)
 */
exports.createStoreOffer = async (req, res) => {
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
      where: { requestId, storeId }
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

    return res.status(201).json({
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
    return res.status(500).json({
      success: false,
      message: 'Failed to create store offer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Accept an offer
 */
exports.acceptOffer = async (req, res) => {
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

    // Verify request belongs to user
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

      // Update the service request
      await serviceRequest.update({
        status: 'in_progress',
        acceptedOfferId: offerId
      }, { transaction });

      // Reject all other pending offers
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

      return res.json({
        success: true,
        message: 'Offer accepted successfully',
        data: {
          offerId,
          requestId,
          newStatus: 'in_progress'
        }
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('❌ Error accepting offer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept offer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Reject an offer
 */
exports.rejectOffer = async (req, res) => {
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

    // Verify request belongs to user
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

    return res.json({
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
    return res.status(500).json({
      success: false,
      message: 'Failed to reject offer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get all offers for a specific request
 */
exports.getRequestOffers = async (req, res) => {
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

    // Verify request belongs to user
    const serviceRequest = await ServiceRequest.findOne({
      where: { id: requestId, postedBy: userId }
    });

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found or you do not have permission to view its offers'
      });
    }

    // Get all offers with store details
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

    return res.json({
      success: true,
      data: {
        requestTitle: serviceRequest.title,
        requestBudget: `KSH ${serviceRequest.budgetMin} - KSH ${serviceRequest.budgetMax}`,
        offers: formattedOffers
      }
    });

  } catch (error) {
    console.error('❌ Error fetching request offers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch request offers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get single service request by ID
 */
exports.getServiceRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ServiceRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'postedByUser',
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'emailVerifiedAt']
        }
      ]
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }

    const formattedRequest = {
      id: request.id,
      title: request.title,
      description: request.description,
      category: request.category,
      location: request.location,
      budget: `KSH ${request.budgetMin} - KSH ${request.budgetMax}`,
      budgetMin: request.budgetMin,
      budgetMax: request.budgetMax,
      timeline: request.timeline,
      priority: request.priority,
      status: request.status,
      requirements: Array.isArray(request.requirements) ? request.requirements : [],
      postedBy: request.postedByUser ? {
        name: `${request.postedByUser.firstName} ${request.postedByUser.lastName}`,
        verified: !!request.postedByUser.emailVerifiedAt
      } : null,
      postedTime: calculateTimeAgo(request.createdAt),
      createdAt: request.createdAt
    };

    return res.json({
      success: true,
      data: formattedRequest
    });

  } catch (error) {
    console.error('❌ Error fetching service request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch service request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Update service request
 */
exports.updateServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const request = await ServiceRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }

    // Check ownership
    if (request.postedBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this request'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'title', 'description', 'category', 'location',
      'budgetMin', 'budgetMax', 'timeline', 'priority',
      'requirements', 'status'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    await request.update(updates);

    return res.status(200).json({
      success: true,
      message: 'Service request updated successfully',
      data: request
    });

  } catch (error) {
    console.error('❌ Error updating service request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update service request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Delete/Close service request
 */
exports.deleteServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const request = await ServiceRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }

    // Check ownership
    if (request.postedBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this request'
      });
    }

    // Soft delete by updating status
    await request.update({ status: 'cancelled' });

    return res.status(200).json({
      success: true,
      message: 'Service request closed successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting service request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete service request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Calculate time ago from a date
 */
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

/**
 * Get category icon
 */
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
    'Legal Services': '⚖️',
    'Consulting': '🎯',
    'Technology': '🔧',
    'Arts & Crafts': '🎭',
    'Beauty & Salon': '💄',
    'Automotive': '🚗',
    'Food & Catering': '🍽️',
    'Event Services': '🎉',
    'Pet Services': '🐕',
    'Moving & Storage': '📦',
    'Landscaping': '🌱',
    'Cleaning Services': '🧹',
    'Repair Services': '🔧',
    'Installation Services': '⚙️',
    'Financial Services': '💰',
    'Healthcare': '🏥'
  };
  
  return iconMap[categoryName] || '🔧';
}

/**
 * Get category color
 */
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
    'Legal Services': 'bg-slate-100 text-slate-800',
    'Consulting': 'bg-cyan-100 text-cyan-800',
    'Technology': 'bg-violet-100 text-violet-800',
    'Arts & Crafts': 'bg-rose-100 text-rose-800',
    'Beauty & Salon': 'bg-pink-100 text-pink-800',
    'Automotive': 'bg-blue-100 text-blue-800',
    'Food & Catering': 'bg-orange-100 text-orange-800',
    'Event Services': 'bg-purple-100 text-purple-800',
    'Pet Services': 'bg-green-100 text-green-800',
    'Moving & Storage': 'bg-indigo-100 text-indigo-800',
    'Landscaping': 'bg-green-100 text-green-800',
    'Cleaning Services': 'bg-blue-100 text-blue-800',
    'Repair Services': 'bg-orange-100 text-orange-800',
    'Installation Services': 'bg-gray-100 text-gray-800',
    'Financial Services': 'bg-yellow-100 text-yellow-800',
    'Healthcare': 'bg-red-100 text-red-800'
  };
  
  return colorMap[categoryName] || 'bg-gray-100 text-gray-800';
}