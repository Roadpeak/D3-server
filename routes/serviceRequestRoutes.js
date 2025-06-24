const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { ServiceRequest, User, Offer, Category } = require('../models'); // Adjust imports based on your models
const { authenticateToken } = require('../middleware/requestservice');


// GET /api/v1/service-requests - Get all service requests with filters
router.get('/', async (req, res) => {
  try {
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
      whereClause.location = { [Op.iLike]: `%${location}%` };
    }

    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await ServiceRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'verified']
        },
        {
          model: Offer,
          as: 'offers',
          attributes: ['id']
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
      postedBy: request.user?.name || 'Anonymous',
      verified: request.user?.verified || false,
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
    console.error('Error fetching service requests:', error);
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
      { name: 'Home Cleaning', icon: '🧹', color: 'bg-blue-100 text-blue-800', count: 45 },
      { name: 'Plumbing', icon: '🔧', color: 'bg-green-100 text-green-800', count: 32 },
      { name: 'Electrical', icon: '⚡', color: 'bg-yellow-100 text-yellow-800', count: 28 },
      { name: 'Gardening', icon: '🌱', color: 'bg-green-100 text-green-800', count: 23 },
      { name: 'Painting', icon: '🎨', color: 'bg-purple-100 text-purple-800', count: 19 },
      { name: 'Moving', icon: '📦', color: 'bg-orange-100 text-orange-800', count: 15 },
      { name: 'IT Support', icon: '💻', color: 'bg-indigo-100 text-indigo-800', count: 12 },
      { name: 'Tutoring', icon: '📚', color: 'bg-pink-100 text-pink-800', count: 8 }
    ];

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
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
      userId: req.user.id // Assuming req.user is set by auth middleware
    });

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: serviceRequest
    });

  } catch (error) {
    console.error('Error creating service request:', error);
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

    const { count, rows } = await Offer.findAndCountAll({
      include: [
        {
          model: ServiceRequest,
          as: 'serviceRequest',
          where: { userId: req.user.id },
          attributes: ['id', 'title']
        },
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name', 'verified', 'rating', 'reviewCount']
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
      providerName: offer.provider?.name || 'Anonymous',
      verified: offer.provider?.verified || false,
      rating: offer.provider?.rating || 0,
      reviews: offer.provider?.reviewCount || 0,
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
    console.error('Error fetching offers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch offers',
      error: error.message
    });
  }
});

// POST /api/v1/service-requests/:id/offers - Create offer for a request
router.post('/:id/offers', authenticateToken, async (req, res) => {
  try {
    const { id: requestId } = req.params;
    const { quotedPrice, message, availability } = req.body;

    // Validation
    if (!quotedPrice || !message || !availability) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if service request exists and is open
    const serviceRequest = await ServiceRequest.findOne({
      where: { id: requestId, status: 'open' }
    });

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found or no longer accepting offers'
      });
    }

    // Check if user already made an offer for this request
    const existingOffer = await Offer.findOne({
      where: {
        serviceRequestId: requestId,
        providerId: req.user.id
      }
    });

    if (existingOffer) {
      return res.status(400).json({
        success: false,
        message: 'You have already made an offer for this request'
      });
    }

    const offer = await Offer.create({
      serviceRequestId: requestId,
      providerId: req.user.id,
      quotedPrice: parseFloat(quotedPrice),
      message,
      availability,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Offer submitted successfully',
      data: offer
    });

  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create offer',
      error: error.message
    });
  }
});

// PUT /api/v1/offers/:id/accept - Accept an offer (moved from main offers route)
router.put('/offers/:id/accept', authenticateToken, async (req, res) => {
  try {
    const { id: offerId } = req.params;

    const offer = await Offer.findOne({
      where: { id: offerId },
      include: [
        {
          model: ServiceRequest,
          as: 'serviceRequest',
          where: { userId: req.user.id } // Only allow request owner to accept
        }
      ]
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found or you are not authorized to accept this offer'
      });
    }

    if (offer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This offer has already been processed'
      });
    }

    // Update offer status
    await offer.update({ status: 'accepted' });

    // Update service request status
    await offer.serviceRequest.update({ status: 'in_progress' });

    // Optionally reject other pending offers for this request
    await Offer.update(
      { status: 'rejected' },
      {
        where: {
          serviceRequestId: offer.serviceRequestId,
          id: { [Op.ne]: offerId },
          status: 'pending'
        }
      }
    );

    res.json({
      success: true,
      message: 'Offer accepted successfully',
      data: offer
    });

  } catch (error) {
    console.error('Error accepting offer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept offer',
      error: error.message
    });
  }
});

// GET /api/v1/service-requests/statistics - Get platform statistics
router.get('/statistics', async (req, res) => {
  try {
    // You can calculate these from your database or return static values
    const statistics = {
      totalProviders: 2547,
      completedRequests: 15236,
      averageRating: 4.8,
      activeRequests: 523
    };

    // If you want to calculate from database:
    /*
    const [totalProviders, completedRequests, activeRequests] = await Promise.all([
      User.count({ where: { role: 'provider' } }),
      ServiceRequest.count({ where: { status: 'completed' } }),
      ServiceRequest.count({ where: { status: 'open' } })
    ]);

    const avgRatingResult = await User.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('rating')), 'averageRating']],
      where: { role: 'provider' }
    });

    const statistics = {
      totalProviders,
      completedRequests,
      averageRating: parseFloat(avgRatingResult.dataValues.averageRating) || 4.8,
      activeRequests
    };
    */

    res.json({
      success: true,
      data: statistics
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

// GET /api/v1/service-requests/:id - Get specific service request details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const serviceRequest = await ServiceRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'verified', 'rating']
        },
        {
          model: Offer,
          as: 'offers',
          include: [
            {
              model: User,
              as: 'provider',
              attributes: ['id', 'name', 'verified', 'rating', 'reviewCount']
            }
          ]
        }
      ]
    });

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }

    res.json({
      success: true,
      data: serviceRequest
    });

  } catch (error) {
    console.error('Error fetching service request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service request',
      error: error.message
    });
  }
});

// PUT /api/v1/service-requests/:id - Update service request
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const serviceRequest = await ServiceRequest.findOne({
      where: { id, userId: req.user.id }
    });

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found or you are not authorized to update it'
      });
    }

    await serviceRequest.update(updates);

    res.json({
      success: true,
      message: 'Service request updated successfully',
      data: serviceRequest
    });

  } catch (error) {
    console.error('Error updating service request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service request',
      error: error.message
    });
  }
});

// DELETE /api/v1/service-requests/:id - Delete service request
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const serviceRequest = await ServiceRequest.findOne({
      where: { id, userId: req.user.id }
    });

    if (!serviceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found or you are not authorized to delete it'
      });
    }

    await serviceRequest.destroy();

    res.json({
      success: true,
      message: 'Service request deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting service request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service request',
      error: error.message
    });
  }
});

module.exports = router;