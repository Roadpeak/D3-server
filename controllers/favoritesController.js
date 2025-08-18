// controllers/favoritesController.js
const { Offer, Service, Store, User, Favorite, sequelize } = require('../models');

// Helper function for error responses
const sendErrorResponse = (res, statusCode, message, error = null) => {
  console.error(`Error ${statusCode}:`, message, error);
  return res.status(statusCode).json({ 
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && error && { error: error.message })
  });
};

// Helper function for success responses
const sendSuccessResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data
  });
};

// Helper function to format favorite data
const formatFavoriteData = (favorite) => {
  if (!favorite) return null;
  
  return {
    id: favorite.id,
    offer_id: favorite.offer_id,
    user_id: favorite.user_id,
    created_at: favorite.created_at,
    offer: favorite.offer ? {
      id: favorite.offer.id,
      title: favorite.offer.title,
      description: favorite.offer.description,
      discount: favorite.offer.discount,
      expiration_date: favorite.offer.expiration_date,
      status: favorite.offer.status,
      featured: favorite.offer.featured,
      service: favorite.offer.service ? {
        id: favorite.offer.service.id,
        name: favorite.offer.service.name,
        price: parseFloat(favorite.offer.service.price) || 0,
        duration: favorite.offer.service.duration,
        category: favorite.offer.service.category,
        description: favorite.offer.service.description,
        image_url: favorite.offer.service.image_url || '/api/placeholder/300/200',
        store: favorite.offer.service.store ? {
          id: favorite.offer.service.store.id,
          name: favorite.offer.service.store.name,
          logo_url: favorite.offer.service.store.logo_url || '/api/placeholder/40/40',
          location: favorite.offer.service.store.location,
        } : null
      } : null
    } : null
  };
};

// Add offer to favorites
exports.addToFavorites = async (req, res) => {
  try {
    const { offerId } = req.params;
    const userId = req.user.id; // Assuming user ID comes from auth middleware

    // Validate offer exists and is active
    const offer = await Offer.findByPk(offerId, {
      include: [{
        model: Service,
        as: 'service',
        include: [{
          model: Store,
          as: 'store'
        }]
      }]
    });

    if (!offer) {
      return sendErrorResponse(res, 404, 'Offer not found');
    }

    // Check if already in favorites
    const existingFavorite = await Favorite.findOne({
      where: {
        user_id: userId,
        offer_id: offerId
      }
    });

    if (existingFavorite) {
      return sendErrorResponse(res, 400, 'Offer is already in your favorites');
    }

    // Add to favorites
    const favorite = await Favorite.create({
      user_id: userId,
      offer_id: offerId
    });

    // Fetch the created favorite with includes
    const createdFavorite = await Favorite.findByPk(favorite.id, {
      include: [{
        model: Offer,
        as: 'offer',
        include: [{
          model: Service,
          as: 'service',
          include: [{
            model: Store,
            as: 'store'
          }]
        }]
      }]
    });

    return sendSuccessResponse(res, {
      favorite: formatFavoriteData(createdFavorite)
    }, 'Added to favorites successfully', 201);

  } catch (error) {
    return sendErrorResponse(res, 500, 'Error adding to favorites', error);
  }
};

// Remove offer from favorites
exports.removeFromFavorites = async (req, res) => {
  try {
    const { offerId } = req.params;
    const userId = req.user.id;

    const favorite = await Favorite.findOne({
      where: {
        user_id: userId,
        offer_id: offerId
      }
    });

    if (!favorite) {
      return sendErrorResponse(res, 404, 'Favorite not found');
    }

    await favorite.destroy();

    return sendSuccessResponse(res, {
      offer_id: parseInt(offerId)
    }, 'Removed from favorites successfully');

  } catch (error) {
    return sendErrorResponse(res, 500, 'Error removing from favorites', error);
  }
};

// Get user's favorites
exports.getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: favorites } = await Favorite.findAndCountAll({
      where: { user_id: userId },
      include: [{
        model: Offer,
        as: 'offer',
        include: [{
          model: Service,
          as: 'service',
          include: [{
            model: Store,
            as: 'store'
          }]
        }]
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    const formattedFavorites = favorites.map(formatFavoriteData);

    return sendSuccessResponse(res, {
      favorites: formattedFavorites,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < Math.ceil(count / limit),
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    return sendErrorResponse(res, 500, 'Error fetching favorites', error);
  }
};

// Check if offer is in favorites
exports.checkFavoriteStatus = async (req, res) => {
  try {
    const { offerId } = req.params;
    const userId = req.user.id;

    const favorite = await Favorite.findOne({
      where: {
        user_id: userId,
        offer_id: offerId
      }
    });

    return sendSuccessResponse(res, {
      isFavorite: !!favorite,
      favorite_id: favorite ? favorite.id : null
    });

  } catch (error) {
    return sendErrorResponse(res, 500, 'Error checking favorite status', error);
  }
};

// Get favorites count
exports.getFavoritesCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await Favorite.count({
      where: { user_id: userId },
      include: [{
        model: Offer,
        as: 'offer',
        where: { status: 'active' }, // Only count active offers
        required: true
      }]
    });

    return sendSuccessResponse(res, { count });

  } catch (error) {
    return sendErrorResponse(res, 500, 'Error fetching favorites count', error);
  }
};

// Toggle favorite status (add if not exists, remove if exists)
exports.toggleFavorite = async (req, res) => {
  try {
    const { offerId } = req.params;
    const userId = req.user.id;

    // Check if already in favorites
    const existingFavorite = await Favorite.findOne({
      where: {
        user_id: userId,
        offer_id: offerId
      }
    });

    if (existingFavorite) {
      // Remove from favorites
      await existingFavorite.destroy();
      return sendSuccessResponse(res, {
        action: 'removed',
        offer_id: parseInt(offerId)
      }, 'Removed from favorites successfully');
    } else {
      // Validate offer exists
      const offer = await Offer.findByPk(offerId);
      if (!offer) {
        return sendErrorResponse(res, 404, 'Offer not found');
      }

      // Add to favorites
      const favorite = await Favorite.create({
        user_id: userId,
        offer_id: offerId
      });

      // Fetch the created favorite with includes
      const createdFavorite = await Favorite.findByPk(favorite.id, {
        include: [{
          model: Offer,
          as: 'offer',
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store'
            }]
          }]
        }]
      });

      return sendSuccessResponse(res, {
        action: 'added',
        favorite: formatFavoriteData(createdFavorite)
      }, 'Added to favorites successfully', 201);
    }

  } catch (error) {
    return sendErrorResponse(res, 500, 'Error toggling favorite', error);
  }
};

// Get user's favorite offers with filtering
exports.getFavoritesWithFilters = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20, 
      category, 
      status = 'active',
      expired 
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause for offers
    const offerWhere = {};
    if (status && status !== 'all') {
      offerWhere.status = status;
    }

    // Handle expired filter
    if (expired === 'true') {
      offerWhere.expiration_date = {
        [sequelize.Op.lt]: new Date()
      };
    } else if (expired === 'false') {
      offerWhere.expiration_date = {
        [sequelize.Op.gt]: new Date()
      };
    }

    // Build where clause for services
    const serviceWhere = {};
    if (category) {
      serviceWhere.category = category;
    }

    const { count, rows: favorites } = await Favorite.findAndCountAll({
      where: { user_id: userId },
      include: [{
        model: Offer,
        as: 'offer',
        where: Object.keys(offerWhere).length > 0 ? offerWhere : undefined,
        required: true,
        include: [{
          model: Service,
          as: 'service',
          where: Object.keys(serviceWhere).length > 0 ? serviceWhere : undefined,
          include: [{
            model: Store,
            as: 'store'
          }]
        }]
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    const formattedFavorites = favorites.map(formatFavoriteData);

    return sendSuccessResponse(res, {
      favorites: formattedFavorites,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < Math.ceil(count / limit),
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    return sendErrorResponse(res, 500, 'Error fetching filtered favorites', error);
  }
};