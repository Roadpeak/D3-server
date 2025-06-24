const { validationResult } = require('express-validator');
const ServiceRequest = require('../models/ServiceRequest');
const ServiceOffer = require('../models/ServiceOffer');
const User = require('../models/user');
const { sendNotification } = require('../utils/notifications');

class ServiceRequestController {
  // Get all public service requests with filtering and pagination
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

      // Build filter object
      const filter = { status: { $in: ['open', 'in_progress'] } };
      
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
        .populate('offersCount')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

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
        offers: request.offersCount || 0,
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

  // Get service categories with request counts
  async getServiceCategories(req, res) {
    try {
      const categories = await ServiceRequest.aggregate([
        { $match: { status: { $in: ['open', 'in_progress'] } } },
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

  // Create a new service request
  async createRequest(req, res) {
    try {
      // Check for validation errors
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

      const userId = req.user.id; // Assuming user is authenticated

      // Create new service request
      const newRequest = new ServiceRequest({
        title,
        category,
        description,
        budgetMin,
        budgetMax,
        timeline,
        location,
        requirements: requirements || [],
        priority,
        postedBy: userId,
        status: 'open'
      });

      await newRequest.save();
      await newRequest.populate('postedBy', 'firstName lastName avatar');

      // Send response
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

  // Get offers for user's requests (private - only for request owner)
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

      // Format offers
      const formattedOffers = offers.map(offer => ({
        id: offer._id,
        providerId: offer.providerId._id,
        requestId: offer.requestId._id,
        providerName: offer.providerId.businessName || 
          `${offer.providerId.firstName} ${offer.providerId.lastName}`,
        rating: offer.providerId.rating || 0,
        reviews: offer.providerId.reviewCount || 0,
        price: `$${offer.quotedPrice}`,
        message: offer.message,
        responseTime: this.formatTimeAgo(offer.createdAt),
        verified: offer.providerId.verified,
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

  // Get single request details
  async getRequestDetails(req, res) {
    try {
      const { requestId } = req.params;
      const userId = req.user?.id;

      const request = await ServiceRequest.findById(requestId)
        .populate('postedBy', 'firstName lastName avatar verified')
        .lean();

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Service request not found'
        });
      }

      // Check if user is the owner to show private details
      const isOwner = userId && request.postedBy._id.toString() === userId;

      const response = {
        id: request._id,
        title: request.title,
        category: request.category,
        description: request.description,
        budget: `$${request.budgetMin} - $${request.budgetMax}`,
        timeline: request.timeline,
        location: request.location,
        postedBy: `${request.postedBy.firstName} ${request.postedBy.lastName.charAt(0)}.`,
        postedTime: this.formatTimeAgo(request.createdAt),
        status: request.status,
        priority: request.priority,
        requirements: request.requirements,
        verified: request.postedBy.verified
      };

      // Add private details if user is owner
      if (isOwner) {
        const offerCount = await ServiceOffer.countDocuments({ requestId });
        response.offers = offerCount;
        response.isOwner = true;
      }

      res.json({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Error fetching request details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch request details'
      });
    }
  }

  // Create an offer for a service request
  async createOffer(req, res) {
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
      const { quotedPrice, message, availability } = req.body;
      const providerId = req.user.id;

      // Check if request exists and is open
      const request = await ServiceRequest.findById(requestId);
      if (!request || request.status !== 'open') {
        return res.status(400).json({
          success: false,
          message: 'Service request not available for offers'
        });
      }

      // Check if provider already made an offer
      const existingOffer = await ServiceOffer.findOne({ requestId, providerId });
      if (existingOffer) {
        return res.status(400).json({
          success: false,
          message: 'You have already made an offer for this request'
        });
      }

      // Create new offer
      const newOffer = new ServiceOffer({
        requestId,
        providerId,
        quotedPrice,
        message,
        availability,
        status: 'pending'
      });

      await newOffer.save();

      // Send notification to request owner
      await sendNotification(request.postedBy, {
        type: 'new_offer',
        title: 'New Offer Received',
        message: `You received a new offer for "${request.title}"`,
        data: { requestId, offerId: newOffer._id }
      });

      res.status(201).json({
        success: true,
        message: 'Offer submitted successfully',
        data: {
          offerId: newOffer._id,
          status: newOffer.status
        }
      });

    } catch (error) {
      console.error('Error creating offer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create offer'
      });
    }
  }

  // Accept an offer (only request owner)
  async acceptOffer(req, res) {
    try {
      const { offerId } = req.params;
      const userId = req.user.id;

      const offer = await ServiceOffer.findById(offerId)
        .populate('requestId')
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

      // Update offer status
      offer.status = 'accepted';
      await offer.save();

      // Update request status
      offer.requestId.status = 'in_progress';
      offer.requestId.acceptedOffer = offerId;
      await offer.requestId.save();

      // Reject other pending offers
      await ServiceOffer.updateMany(
        { requestId: offer.requestId._id, _id: { $ne: offerId } },
        { status: 'rejected' }
      );

      // Send notifications
      await sendNotification(offer.providerId._id, {
        type: 'offer_accepted',
        title: 'Offer Accepted',
        message: `Your offer for "${offer.requestId.title}" has been accepted!`,
        data: { requestId: offer.requestId._id, offerId }
      });

      res.json({
        success: true,
        message: 'Offer accepted successfully',
        data: {
          offerId,
          requestId: offer.requestId._id,
          status: 'accepted'
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

  // Get platform statistics
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
          { $match: { status: 'completed' } },
          { $group: { _id: null, avgRating: { $avg: '$finalRating' } } }
        ]),
        ServiceRequest.countDocuments({ status: { $in: ['open', 'in_progress'] } })
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

  // Helper method to format time ago
  formatTimeAgo(date) {
    const now = new Date();
    const diffInMs = now - new Date(date);
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  }

  // Helper method to notify service providers
  async notifyServiceProviders(request) {
    try {
      // Find providers in the same category and location
      const providers = await User.find({
        role: 'provider',
        categories: request.category,
        'location.city': { $regex: request.location.split(',')[0], $options: 'i' },
        verified: true,
        notificationPreferences: { $in: ['new_requests', 'all'] }
      }).select('_id');

      // Send notifications to relevant providers
      const notifications = providers.map(provider => ({
        userId: provider._id,
        type: 'new_request',
        title: 'New Service Request',
        message: `New ${request.category} request in your area: "${request.title}"`,
        data: { requestId: request._id }
      }));

      if (notifications.length > 0) {
        await sendNotification(notifications);
      }
    } catch (error) {
      console.error('Error notifying providers:', error);
    }
  }
}

module.exports = new ServiceRequestController();