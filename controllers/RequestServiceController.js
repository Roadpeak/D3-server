const { validationResult } = require('express-validator');
const ServiceRequest = require('../models/serviceRequest');
const ServiceOffer = require('../models/ServiceOffer');
const Store = require('../models/store');
const User = require('../models/user');
const { sendNotification } = require('../utils/notifications');

class UnifiedServiceController {
  // =================== PUBLIC ENDPOINTS ===================
  
  // Get all public service requests with filtering and pagination (PUBLIC)
  async getAllRequests(req, res) {
    try {
      const { 
        category, 
        budget, 
        timeline, 
        location, 
        status = 'open',
        page = 1, 
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter object - only show open requests publicly
      const filter = { status: 'open' };
      
      if (category && category !== 'all') {
        filter.category = category;
      }
      
      if (budget && budget !== 'all') {
        const [min, max] = budget.split('-');
        filter.budgetMin = { $gte: parseInt(min) };
        if (max !== '+') {
          filter.budgetMax = { $lte: parseInt(max) };
        }
      }
      
      if (timeline && timeline !== 'all') {
        filter.timeline = timeline;
      }
      
      if (location) {
        filter.location = { $regex: location, $options: 'i' };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Get requests with populated user data
      const requests = await ServiceRequest.find(filter)
        .populate('postedBy', 'firstName lastName avatar verified')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get offer counts for each request
      const requestIds = requests.map(r => r._id);
      const offerCounts = await ServiceOffer.aggregate([
        { $match: { requestId: { $in: requestIds } } },
        { $group: { _id: '$requestId', count: { $sum: 1 } } }
      ]);

      const offerCountMap = {};
      offerCounts.forEach(oc => {
        offerCountMap[oc._id.toString()] = oc.count;
      });

      // Get total count for pagination
      const totalCount = await ServiceRequest.countDocuments(filter);

      // Format response data
      const formattedRequests = requests.map(request => ({
        id: request._id,
        title: request.title,
        category: request.category,
        description: request.description,
        budget: `$${request.budgetMin} - $${request.budgetMax}`,
        timeline: request.timeline,
        location: request.location,
        postedBy: `${request.postedBy.firstName} ${request.postedBy.lastName.charAt(0)}.`,
        postedTime: this.formatTimeAgo(request.createdAt),
        offers: offerCountMap[request._id.toString()] || 0,
        status: request.status,
        priority: request.priority,
        requirements: request.requirements,
        verified: request.postedBy.verified
      }));

      res.json({
        success: true,
        data: {
          requests: formattedRequests,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Error fetching service requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch service requests'
      });
    }
  }

  // Get service categories with request counts (PUBLIC)
  async getServiceCategories(req, res) {
    try {
      const categories = await ServiceRequest.aggregate([
        { $match: { status: 'open' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      const categoryData = [
        { name: "Home Services", icon: "🏠", color: "bg-blue-100 text-blue-800" },
        { name: "Auto Services", icon: "🚗", color: "bg-green-100 text-green-800" },
        { name: "Beauty & Wellness", icon: "💄", color: "bg-pink-100 text-pink-800" },
        { name: "Tech Support", icon: "💻", color: "bg-purple-100 text-purple-800" },
        { name: "Event Services", icon: "🎉", color: "bg-yellow-100 text-yellow-800" },
        { name: "Tutoring", icon: "📚", color: "bg-indigo-100 text-indigo-800" },
        { name: "Fitness", icon: "💪", color: "bg-orange-100 text-orange-800" },
        { name: "Photography", icon: "📸", color: "bg-teal-100 text-teal-800" }
      ];

      const formattedCategories = categoryData.map(cat => {
        const categoryCount = categories.find(c => c._id === cat.name);
        return {
          ...cat,
          count: categoryCount ? categoryCount.count : 0
        };
      });

      res.json({
        success: true,
        data: formattedCategories
      });

    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch categories'
      });
    }
  }

  // Get platform statistics (PUBLIC)
  async getStatistics(req, res) {
    try {
      const [
        totalProviders,
        completedRequests,
        averageRating,
        activeRequests
      ] = await Promise.all([
        User.countDocuments({ role: 'provider', verified: true }),
        ServiceRequest.countDocuments({ status: 'completed' }),
        ServiceRequest.aggregate([
          { $match: { status: 'completed', finalRating: { $exists: true } } },
          { $group: { _id: null, avgRating: { $avg: '$finalRating' } } }
        ]),
        ServiceRequest.countDocuments({ status: 'open' })
      ]);

      res.json({
        success: true,
        data: {
          totalProviders,
          completedRequests,
          averageRating: averageRating[0]?.avgRating || 4.8,
          activeRequests
        }
      });

    } catch (error) {
      console.error('Error fetching statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch statistics'
      });
    }
  }

  // =================== USER ENDPOINTS (PRIVATE) ===================

  // Create a new service request (USER)
  async createRequest(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        title,
        category,
        description,
        budgetMin,
        budgetMax,
        timeline,
        location,
        requirements,
        priority = 'normal'
      } = req.body;

      const userId = req.user.id;

      // Validate budget
      if (parseInt(budgetMin) > parseInt(budgetMax)) {
        return res.status(400).json({
          success: false,
          message: 'Minimum budget cannot be greater than maximum budget'
        });
      }

      // Create new service request
      const newRequest = new ServiceRequest({
        title,
        category,
        description,
        budgetMin: parseInt(budgetMin),
        budgetMax: parseInt(budgetMax),
        timeline,
        location,
        requirements: requirements || [],
        priority,
        postedBy: userId,
        status: 'open'
      });

      await newRequest.save();
      await newRequest.populate('postedBy', 'firstName lastName avatar');

      res.status(201).json({
        success: true,
        message: 'Service request created successfully',
        data: {
          id: newRequest._id,
          title: newRequest.title,
          category: newRequest.category,
          status: newRequest.status,
          createdAt: newRequest.createdAt
        }
      });

      // Send notifications to relevant service providers (async)
      this.notifyServiceProviders(newRequest);

    } catch (error) {
      console.error('Error creating service request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create service request'
      });
    }
  }

  // Get offers for user's requests (USER)
  async getUserOffers(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      // Get user's requests
      const userRequests = await ServiceRequest.find({ postedBy: userId })
        .select('_id title');

      const requestIds = userRequests.map(req => req._id);

      // Get offers for user's requests
      const skip = (page - 1) * limit;
      const offers = await ServiceOffer.find({ 
        requestId: { $in: requestIds },
        status: { $in: ['pending', 'accepted'] }
      })
        .populate({
          path: 'storeId',
          select: 'name description rating reviewCount verified location'
        })
        .populate('providerId', 'firstName lastName avatar rating reviewCount verified businessName')
        .populate('requestId', 'title category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalCount = await ServiceOffer.countDocuments({
        requestId: { $in: requestIds },
        status: { $in: ['pending', 'accepted'] }
      });

      // Format offers to show store information
      const formattedOffers = offers.map(offer => ({
        id: offer._id,
        providerId: offer.providerId._id,
        requestId: offer.requestId._id,
        storeName: offer.storeId?.name || `${offer.providerId.firstName} ${offer.providerId.lastName}`,
        storeId: offer.storeId?._id,
        rating: offer.storeId?.rating || offer.providerId.rating || 0,
        reviews: offer.storeId?.reviewCount || offer.providerId.reviewCount || 0,
        price: `${offer.quotedPrice}`,
        message: offer.message,
        responseTime: this.formatTimeAgo(offer.createdAt),
        verified: offer.storeId?.verified || offer.providerId.verified || false,
        requestTitle: offer.requestId.title,
        status: offer.status,
        availability: offer.availability
      }));

      res.json({
        success: true,
        data: {
          offers: formattedOffers,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Error fetching user offers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch offers'
      });
    }
  }

  // Get user's past requests (USER)
  async getUserPastRequests(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      // Get user's completed/cancelled requests
      const requests = await ServiceRequest.find({ 
        postedBy: userId,
        status: { $in: ['completed', 'cancelled'] }
      })
        .populate({
          path: 'acceptedOffer',
          populate: {
            path: 'storeId',
            select: 'name'
          }
        })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalCount = await ServiceRequest.countDocuments({
        postedBy: userId,
        status: { $in: ['completed', 'cancelled'] }
      });

      // Format past requests
      const formattedRequests = requests.map(request => ({
        id: request._id,
        title: request.title,
        description: request.description,
        category: request.category,
        budget: `${request.budgetMin} - ${request.budgetMax}`,
        location: request.location,
        status: request.status,
        completedDate: request.updatedAt.toISOString().split('T')[0],
        acceptedOffer: request.acceptedOffer ? {
          storeName: request.acceptedOffer.storeId?.name || 'Provider',
          storeId: request.acceptedOffer.storeId?._id,
          price: `${request.acceptedOffer.quotedPrice}`,
          rating: request.finalRating,
          providerName: request.acceptedOffer.storeId?.name || 'Provider'
        } : null
      }));

      res.json({
        success: true,
        data: {
          requests: formattedRequests,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Error fetching past requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch past requests'
      });
    }
  }

  // Accept offer (USER)
  async acceptOffer(req, res) {
    try {
      const { offerId } = req.params;
      const userId = req.user.id;

      const offer = await ServiceOffer.findById(offerId)
        .populate('requestId')
        .populate('storeId', 'name')
        .populate('providerId', 'firstName lastName businessName');

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: 'Offer not found'
        });
      }

      // Check if user owns the request
      if (offer.requestId.postedBy.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to accept this offer'
        });
      }

      // Check if offer is still pending
      if (offer.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'This offer is no longer available'
        });
      }

      // Update offer status
      offer.status = 'accepted';
      await offer.save();

      // Update request status and link accepted offer
      offer.requestId.status = 'in_progress';
      offer.requestId.acceptedOffer = offerId;
      await offer.requestId.save();

      // Reject other pending offers for this request
      await ServiceOffer.updateMany(
        { requestId: offer.requestId._id, _id: { $ne: offerId } },
        { status: 'rejected' }
      );

      // Send notifications
      await sendNotification(offer.providerId._id, {
        type: 'offer_accepted',
        title: 'Offer Accepted',
        message: `Your offer from ${offer.storeId?.name || 'your business'} for "${offer.requestId.title}" has been accepted!`,
        data: { 
          requestId: offer.requestId._id, 
          offerId,
          storeName: offer.storeId?.name 
        }
      });

      res.json({
        success: true,
        message: 'Offer accepted successfully',
        data: {
          offerId,
          requestId: offer.requestId._id,
          status: 'accepted',
          storeName: offer.storeId?.name
        }
      });

    } catch (error) {
      console.error('Error accepting offer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to accept offer'
      });
    }
  }

  // =================== MERCHANT ENDPOINTS (PRIVATE) ===================

  // Get service requests filtered by merchant's store categories (MERCHANT)
  async getServiceRequestsForMerchant(req, res) {
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

      const merchantId = req.user.id;

      // Get merchant's stores and their categories
      const merchantStores = await Store.find({ 
        ownerId: merchantId, 
        status: 'active' 
      }).select('categories name');

      if (!merchantStores.length) {
        return res.status(400).json({
          success: false,
          message: 'No active stores found. Please create a store first.'
        });
      }

      // Extract all categories from merchant's stores
      const storeCategories = [...new Set(
        merchantStores.flatMap(store => store.categories)
      )];

      // Build filter object
      const filter = { 
        status: 'open',
        category: { $in: storeCategories } // Only show requests matching store categories
      };
      
      if (category && category !== 'all') {
        filter.category = category; // Override with specific category if selected
      }
      
      if (budget && budget !== 'all') {
        const [min, max] = budget.split('-');
        filter.budgetMin = { $gte: parseInt(min) };
        if (max !== '+') {
          filter.budgetMax = { $lte: parseInt(max) };
        }
      }
      
      if (timeline && timeline !== 'all') {
        filter.timeline = timeline;
      }
      
      if (location) {
        filter.location = { $regex: location, $options: 'i' };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Get requests with populated user data and offer counts
      const requests = await ServiceRequest.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'users',
            localField: 'postedBy',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'serviceoffers',
            localField: '_id',
            foreignField: 'requestId',
            as: 'offers'
          }
        },
        {
          $addFields: {
            offersCount: { $size: '$offers' },
            user: { $arrayElemAt: ['$user', 0] },
            // Check if merchant already made an offer through any of their stores
            merchantOffered: {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: '$offers',
                      cond: { $in: ['$this.storeId', merchantStores.map(s => s._id)] }
                    }
                  }
                },
                0
              ]
            }
          }
        },
        { $sort: sortOptions },
        { $skip: skip },
        { $limit: parseInt(limit) }
      ]);

      // Get total count for pagination
      const totalCount = await ServiceRequest.countDocuments(filter);

      // Format response data
      const formattedRequests = requests.map(request => ({
        id: request._id,
        title: request.title,
        category: request.category,
        description: request.description,
        budget: `${request.budgetMin} - ${request.budgetMax}`,
        timeline: request.timeline,
        location: request.location,
        postedBy: `${request.user.firstName} ${request.user.lastName.charAt(0)}.`,
        postedTime: this.formatTimeAgo(request.createdAt),
        offers: request.offersCount || 0,
        status: request.status,
        priority: request.priority,
        requirements: request.requirements,
        verified: request.user.verified,
        merchantOffered: request.merchantOffered,
        eligibleStores: merchantStores.filter(store => 
          store.categories.includes(request.category)
        ).map(store => ({
          id: store._id,
          name: store.name
        }))
      }));

      res.json({
        success: true,
        data: {
          requests: formattedRequests,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
          },
          merchantStores: merchantStores.map(store => ({
            id: store._id,
            name: store.name,
            categories: store.categories
          }))
        }
      });

    } catch (error) {
      console.error('Error fetching merchant service requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch service requests'
      });
    }
  }

  // Create offer from a specific store (MERCHANT)
  async createStoreOffer(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { requestId } = req.params;
      const { storeId, quotedPrice, message, availability } = req.body;
      const merchantId = req.user.id;

      // Verify the store belongs to the merchant
      const store = await Store.findOne({ 
        _id: storeId, 
        ownerId: merchantId, 
        status: 'active' 
      });

      if (!store) {
        return res.status(400).json({
          success: false,
          message: 'Store not found or not accessible'
        });
      }

      // Check if request exists and is open
      const request = await ServiceRequest.findById(requestId);
      if (!request || request.status !== 'open') {
        return res.status(400).json({
          success: false,
          message: 'Service request not available for offers'
        });
      }

      // Verify store category matches request category
      if (!store.categories.includes(request.category)) {
        return res.status(400).json({
          success: false,
          message: 'Store category does not match request category'
        });
      }

      // Check if this store already made an offer
      const existingOffer = await ServiceOffer.findOne({ 
        requestId, 
        storeId 
      });

      if (existingOffer) {
        return res.status(400).json({
          success: false,
          message: 'This store has already made an offer for this request'
        });
      }

      // Validate quoted price
      if (parseFloat(quotedPrice) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Quoted price must be greater than 0'
        });
      }

      // Create new offer
      const newOffer = new ServiceOffer({
        requestId,
        providerId: merchantId, // Merchant ID
        storeId, // Store making the offer
        quotedPrice: parseFloat(quotedPrice),
        message,
        availability,
        status: 'pending'
      });

      await newOffer.save();

      // Send notification to request owner
      await sendNotification(request.postedBy, {
        type: 'new_store_offer',
        title: 'New Offer Received',
        message: `You received a new offer from ${store.name} for "${request.title}"`,
        data: { 
          requestId, 
          offerId: newOffer._id, 
          storeName: store.name,
          storeId 
        }
      });

      res.status(201).json({
        success: true,
        message: 'Offer submitted successfully',
        data: {
          offerId: newOffer._id,
          status: newOffer.status,
          storeName: store.name
        }
      });

    } catch (error) {
      console.error('Error creating store offer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create offer'
      });
    }
  }

  // Get merchant's store offers with status tracking (MERCHANT)
  async getMerchantOffers(req, res) {
    try {
      const merchantId = req.user.id;
      const { 
        status = 'all', 
        storeId = 'all',
        page = 1, 
        limit = 10 
      } = req.query;

      // Get merchant's stores
      const merchantStores = await Store.find({ 
        ownerId: merchantId 
      }).select('name');

      const storeIds = merchantStores.map(store => store._id);

      // Build filter
      const filter = { storeId: { $in: storeIds } };
      
      if (status !== 'all') {
        filter.status = status;
      }
      
      if (storeId !== 'all') {
        filter.storeId = storeId;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get offers with populated data
      const offers = await ServiceOffer.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'servicerequests',
            localField: 'requestId',
            foreignField: '_id',
            as: 'request'
          }
        },
        {
          $lookup: {
            from: 'stores',
            localField: 'storeId',
            foreignField: '_id',
            as: 'store'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'request.postedBy',
            foreignField: '_id',
            as: 'requestOwner'
          }
        },
        {
          $addFields: {
            request: { $arrayElemAt: ['$request', 0] },
            store: { $arrayElemAt: ['$store', 0] },
            requestOwner: { $arrayElemAt: ['$requestOwner', 0] }
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
      ]);

      const totalCount = await ServiceOffer.countDocuments(filter);

      // Format offers
      const formattedOffers = offers.map(offer => ({
        id: offer._id,
        requestId: offer.requestId,
        requestTitle: offer.request.title,
        requestCategory: offer.request.category,
        quotedPrice: offer.quotedPrice,
        message: offer.message,
        availability: offer.availability,
        status: offer.status,
        storeName: offer.store.name,
        storeId: offer.storeId,
        customerName: offer.requestOwner ? 
          `${offer.requestOwner.firstName} ${offer.requestOwner.lastName.charAt(0)}.` : 'Unknown',
        submittedAt: this.formatTimeAgo(offer.createdAt),
        requestBudget: `${offer.request.budgetMin} - ${offer.request.budgetMax}`,
        requestLocation: offer.request.location
      }));

      res.json({
        success: true,
        data: {
          offers: formattedOffers,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
          },
          stores: merchantStores,
          stats: {
            pending: await ServiceOffer.countDocuments({ 
              storeId: { $in: storeIds }, 
              status: 'pending' 
            }),
            accepted: await ServiceOffer.countDocuments({ 
              storeId: { $in: storeIds }, 
              status: 'accepted' 
            }),
            rejected: await ServiceOffer.countDocuments({ 
              storeId: { $in: storeIds }, 
              status: 'rejected' 
            })
          }
        }
      });

    } catch (error) {
      console.error('Error fetching merchant offers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch offers'
      });
    }
  }

  // Get merchant's stores (MERCHANT)
  async getMerchantStores(req, res) {
    try {
      const merchantId = req.user.id;

      const stores = await Store.find({ ownerId: merchantId })
        .populate('ownerId', 'firstName lastName')
        .lean();

      const formattedStores = stores.map(store => ({
        id: store._id,
        name: store.name,
        description: store.description,
        categories: store.categories,
        location: store.location,
        status: store.status,
        rating: store.rating || 0,
        reviewCount: store.reviewCount || 0,
        verified: store.verified || false,
        createdAt: store.createdAt
      }));

      res.json({
        success: true,
        data: formattedStores
      });

    } catch (error) {
      console.error('Error fetching merchant stores:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stores'
      });
    }
  }

  // Get merchant dashboard statistics (MERCHANT)
  async getMerchantDashboardStats(req, res) {
    try {
      const merchantId = req.user.id;

      // Get merchant's stores
      const storeIds = (await Store.find({ ownerId: merchantId }))
        .map(store => store._id);

      const [
        totalOffers,
        pendingOffers,
        acceptedOffers,
        rejectedOffers,
        totalEarnings,
        activeStores
      ] = await Promise.all([
        ServiceOffer.countDocuments({ storeId: { $in: storeIds } }),
        ServiceOffer.countDocuments({ storeId: { $in: storeIds }, status: 'pending' }),
        ServiceOffer.countDocuments({ storeId: { $in: storeIds }, status: 'accepted' }),
        ServiceOffer.countDocuments({ storeId: { $in: storeIds }, status: 'rejected' }),
        ServiceOffer.aggregate([
          { $match: { storeId: { $in: storeIds }, status: 'accepted' } },
          { $group: { _id: null, total: { $sum: '$quotedPrice' } } }
        ]),
        Store.countDocuments({ ownerId: merchantId, status: 'active' })
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
          totalEarnings: totalEarnings[0]?.total || 0,
          activeStores,
          acceptanceRate: parseFloat(acceptanceRate)
        }
      });

    } catch (error) {
      console.error('Error fetching merchant dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics'
      });
    }
  }

  // Update offer status (MERCHANT)
  async updateOfferStatus(req, res) {
    try {
      const { offerId } = req.params;
      const { status, reason } = req.body;
      const merchantId = req.user.id;

      // Validate status
      const validStatuses = ['pending', 'accepted', 'rejected', 'withdrawn'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status provided'
        });
      }

      // Find the offer and verify ownership through store
      const offer = await ServiceOffer.findById(offerId)
        .populate('storeId', 'ownerId name')
        .populate('requestId', 'title postedBy');

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: 'Offer not found'
        });
      }

      // Check if merchant owns the store that made the offer
      if (offer.storeId.ownerId.toString() !== merchantId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this offer'
        });
      }

      // Check if offer can be updated
      if (offer.status === 'accepted' && status !== 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify an accepted offer'
        });
      }

      // Update offer status
      offer.status = status;
      if (reason) {
        offer.statusReason = reason;
      }
      offer.updatedAt = new Date();
      await offer.save();

      // Send notification to request owner about status change
      if (status === 'withdrawn') {
        await sendNotification(offer.requestId.postedBy, {
          type: 'offer_withdrawn',
          title: 'Offer Withdrawn',
          message: `${offer.storeId.name} has withdrawn their offer for "${offer.requestId.title}"`,
          data: { 
            requestId: offer.requestId._id, 
            offerId,
            storeName: offer.storeId.name 
          }
        });
      }

      res.json({
        success: true,
        message: `Offer ${status} successfully`,
        data: {
          offerId,
          status,
          storeName: offer.storeId.name,
          requestTitle: offer.requestId.title
        }
      });

    } catch (error) {
      console.error('Error updating offer status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update offer status'
      });
    }
  }

  // =================== HELPER METHODS ===================

  // Format time ago utility
  formatTimeAgo(date) {
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

  // Notify relevant service providers about new requests
  async notifyServiceProviders(request) {
    try {
      // Find stores that match the request category
      const relevantStores = await Store.find({
        categories: request.category,
        status: 'active'
      }).populate('ownerId', '_id');

      // Send notifications to store owners
      const notifications = relevantStores.map(store => 
        sendNotification(store.ownerId._id, {
          type: 'new_service_request',
          title: 'New Service Request Available',
          message: `A new ${request.category} request has been posted: "${request.title}"`,
          data: {
            requestId: request._id,
            category: request.category,
            budget: `${request.budgetMin} - ${request.budgetMax}`,
            location: request.location,
            timeline: request.timeline
          }
        })
      );

      await Promise.all(notifications);
    } catch (error) {
      console.error('Error notifying service providers:', error);
      // Don't throw error as this is a background operation
    }
  }

  // =================== VALIDATION HELPERS ===================

  // Validate service request data
  validateServiceRequestData(data) {
    const errors = [];
    
    if (!data.title || data.title.trim().length < 5) {
      errors.push('Title must be at least 5 characters long');
    }
    
    if (!data.category) {
      errors.push('Category is required');
    }
    
    if (!data.description || data.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters long');
    }
    
    if (!data.budgetMin || !data.budgetMax) {
      errors.push('Budget range is required');
    }
    
    if (data.budgetMin && data.budgetMax && parseInt(data.budgetMin) > parseInt(data.budgetMax)) {
      errors.push('Minimum budget cannot exceed maximum budget');
    }
    
    if (!data.timeline) {
      errors.push('Timeline is required');
    }
    
    if (!data.location || data.location.trim().length < 3) {
      errors.push('Location must be at least 3 characters long');
    }
    
    return errors;
  }

  // Validate offer data
  validateOfferData(data) {
    const errors = [];
    
    if (!data.storeId) {
      errors.push('Store selection is required');
    }
    
    if (!data.quotedPrice || parseFloat(data.quotedPrice) <= 0) {
      errors.push('Valid quoted price is required');
    }
    
    if (!data.message || data.message.trim().length < 10) {
      errors.push('Message must be at least 10 characters long');
    }
    
    if (!data.availability) {
      errors.push('Availability information is required');
    }
    
    return errors;
  }

  // =================== ANALYTICS METHODS ===================

  // Get request analytics for merchants
  async getRequestAnalytics(req, res) {
    try {
      const merchantId = req.user.id;
      const { period = '30d' } = req.query;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      // Get merchant's stores
      const storeIds = (await Store.find({ ownerId: merchantId }))
        .map(store => store._id);

      // Get analytics data
      const [
        offersByDay,
        offersByCategory,
        acceptanceRateByStore,
        averageResponseTime
      ] = await Promise.all([
        // Daily offer counts
        ServiceOffer.aggregate([
          {
            $match: {
              storeId: { $in: storeIds },
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),

        // Offers by category
        ServiceOffer.aggregate([
          {
            $match: {
              storeId: { $in: storeIds },
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $lookup: {
              from: 'servicerequests',
              localField: 'requestId',
              foreignField: '_id',
              as: 'request'
            }
          },
          {
            $group: {
              _id: { $arrayElemAt: ['$request.category', 0] },
              count: { $sum: 1 }
            }
          }
        ]),

        // Acceptance rate by store
        ServiceOffer.aggregate([
          {
            $match: {
              storeId: { $in: storeIds },
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $lookup: {
              from: 'stores',
              localField: 'storeId',
              foreignField: '_id',
              as: 'store'
            }
          },
          {
            $group: {
              _id: '$storeId',
              storeName: { $first: { $arrayElemAt: ['$store.name', 0] } },
              totalOffers: { $sum: 1 },
              acceptedOffers: {
                $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
              }
            }
          },
          {
            $addFields: {
              acceptanceRate: {
                $multiply: [
                  { $divide: ['$acceptedOffers', '$totalOffers'] },
                  100
                ]
              }
            }
          }
        ]),

        // Average response time (hours between request creation and offer)
        ServiceOffer.aggregate([
          {
            $match: {
              storeId: { $in: storeIds },
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $lookup: {
              from: 'servicerequests',
              localField: 'requestId',
              foreignField: '_id',
              as: 'request'
            }
          },
          {
            $addFields: {
              responseTimeHours: {
                $divide: [
                  { $subtract: ['$createdAt', { $arrayElemAt: ['$request.createdAt', 0] }] },
                  1000 * 60 * 60 // Convert to hours
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              averageResponseTime: { $avg: '$responseTimeHours' }
            }
          }
        ])
      ]);

      res.json({
        success: true,
        data: {
          period,
          dateRange: { startDate, endDate },
          offersByDay,
          offersByCategory,
          acceptanceRateByStore,
          averageResponseTime: averageResponseTime[0]?.averageResponseTime || 0
        }
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics data'
      });
    }
  }

  // =================== SEARCH AND FILTERING ===================

  // Advanced search for service requests
  async searchServiceRequests(req, res) {
    try {
      const {
        query,
        category,
        minBudget,
        maxBudget,
        timeline,
        location,
        priority,
        hasRequirements,
        postedWithin, // days
        sortBy = 'relevance',
        page = 1,
        limit = 10
      } = req.query;

      // Build search filter
      const filter = { status: 'open' };

      // Text search
      if (query) {
        filter.$text = { $search: query };
      }

      // Category filter
      if (category && category !== 'all') {
        filter.category = category;
      }

      // Budget filters
      if (minBudget) {
        filter.budgetMax = { $gte: parseInt(minBudget) };
      }
      if (maxBudget) {
        filter.budgetMin = { $lte: parseInt(maxBudget) };
      }

      // Timeline filter
      if (timeline && timeline !== 'all') {
        filter.timeline = timeline;
      }

      // Location filter
      if (location) {
        filter.location = { $regex: location, $options: 'i' };
      }

      // Priority filter
      if (priority && priority !== 'all') {
        filter.priority = priority;
      }

      // Requirements filter
      if (hasRequirements === 'true') {
        filter.requirements = { $exists: true, $ne: [] };
      }

      // Posted within filter
      if (postedWithin) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(postedWithin));
        filter.createdAt = { $gte: daysAgo };
      }

      // Build sort options
      let sortOptions = {};
      switch (sortBy) {
        case 'newest':
          sortOptions = { createdAt: -1 };
          break;
        case 'oldest':
          sortOptions = { createdAt: 1 };
          break;
        case 'budget_high':
          sortOptions = { budgetMax: -1 };
          break;
        case 'budget_low':
          sortOptions = { budgetMin: 1 };
          break;
        case 'priority':
          sortOptions = { priority: -1, createdAt: -1 };
          break;
        default: // relevance
          if (query) {
            sortOptions = { score: { $meta: 'textScore' } };
          } else {
            sortOptions = { createdAt: -1 };
          }
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute search
      let searchQuery = ServiceRequest.find(filter)
        .populate('postedBy', 'firstName lastName avatar verified')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      // Add text score for relevance sorting
      if (query && sortBy === 'relevance') {
        searchQuery = searchQuery.select({ score: { $meta: 'textScore' } });
      }

      const [requests, totalCount] = await Promise.all([
        searchQuery.lean(),
        ServiceRequest.countDocuments(filter)
      ]);

      // Get offer counts
      const requestIds = requests.map(r => r._id);
      const offerCounts = await ServiceOffer.aggregate([
        { $match: { requestId: { $in: requestIds } } },
        { $group: { _id: '$requestId', count: { $sum: 1 } } }
      ]);

      const offerCountMap = {};
      offerCounts.forEach(oc => {
        offerCountMap[oc._id.toString()] = oc.count;
      });

      // Format results
      const formattedRequests = requests.map(request => ({
        id: request._id,
        title: request.title,
        category: request.category,
        description: request.description,
        budget: `${request.budgetMin} - ${request.budgetMax}`,
        timeline: request.timeline,
        location: request.location,
        postedBy: `${request.postedBy.firstName} ${request.postedBy.lastName.charAt(0)}.`,
        postedTime: this.formatTimeAgo(request.createdAt),
        offers: offerCountMap[request._id.toString()] || 0,
        status: request.status,
        priority: request.priority,
        requirements: request.requirements,
        verified: request.postedBy.verified,
        relevanceScore: request.score || 0
      }));

      res.json({
        success: true,
        data: {
          requests: formattedRequests,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNext: page < Math.ceil(totalCount / limit),
            hasPrev: page > 1
          },
          searchParams: {
            query,
            category,
            minBudget,
            maxBudget,
            timeline,
            location,
            priority,
            hasRequirements,
            postedWithin,
            sortBy
          }
        }
      });

    } catch (error) {
      console.error('Error in advanced search:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform search'
      });
    }
  }
}

module.exports = new UnifiedServiceController();