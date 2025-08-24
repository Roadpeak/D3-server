const { Offer, Store, Service, sequelize } = require('../models');
const { Op } = require('sequelize');

// Helper function to format offers consistently
const formatOffer = (offer) => {
  if (!offer) return null;
  
  return {
    id: offer.id,
    title: offer.title || offer.service?.name || 'Special Offer',
    description: offer.description || offer.service?.description || 'Get exclusive offers with these amazing deals',
    discount: offer.discount, // Keep as number
    expiration_date: offer.expiration_date,
    status: offer.status,
    fee: offer.fee,
    featured: offer.featured || false,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    service: offer.service ? {
      id: offer.service.id,
      name: offer.service.name,
      price: parseFloat(offer.service.price) || 0,
      duration: offer.service.duration,
      type: offer.service.type,
      category: offer.service.category,
      description: offer.service.description,
      image_url: offer.service.image_url || '/api/placeholder/300/200',
      store_id: offer.service.store_id,
    } : null,
    store: offer.service?.store ? {
      id: offer.service.store.id,
      name: offer.service.store.name,
      logo_url: offer.service.store.logo_url || '/api/placeholder/20/20',
      location: offer.service.store.location,
    } : null
  };
};

// Helper function to get standard includes with proper aliases
const getOfferIncludes = (locationFilter = null) => [
  {
    model: Service,
    as: 'service',
    attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type', 'description', 'store_id'],
    include: [
      {
        model: Store,
        as: 'store',
        attributes: ['id', 'name', 'logo_url', 'location'],
        ...(locationFilter && locationFilter !== 'All Locations' && {
          where: {
            [Op.or]: [
              { location: locationFilter },
              { location: 'All Locations' }
            ]
          }
        })
      }
    ]
  }
];

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

exports.createOffer = async (req, res) => {
  try {
    const { discount, expiration_date, service_id, description, status, title, featured } = req.body;

    // Validation
    if (!discount || !expiration_date || !service_id) {
      return sendErrorResponse(res, 400, 'Discount, expiration date, and service ID are required');
    }

    // Validate discount range
    if (discount < 1 || discount > 100) {
      return sendErrorResponse(res, 400, 'Discount must be between 1 and 100');
    }

    // Check if service exists
    const service = await Service.findByPk(service_id, {
      include: [{ model: Store, as: 'store' }]
    });
    if (!service) {
      return sendErrorResponse(res, 404, 'Service not found');
    }

    // Validate expiration date
    const expirationDate = new Date(expiration_date);
    if (expirationDate <= new Date()) {
      return sendErrorResponse(res, 400, 'Expiration date must be in the future');
    }

    const fee = (discount * 0.05).toFixed(2);

    const newOffer = await Offer.create({
      discount: parseFloat(discount),
      expiration_date,
      service_id,
      description: description || null,
      status: status || 'active',
      fee: parseFloat(fee),
      title: title || null,
      featured: featured || false,
    });

    // Fetch the created offer with includes
    const createdOffer = await Offer.findByPk(newOffer.id, {
      include: getOfferIncludes()
    });

    return sendSuccessResponse(res, { offer: formatOffer(createdOffer) }, 'Offer created successfully', 201);
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error creating offer', err);
  }
};

exports.getOffers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 12, 
      category, 
      location, // ADD: Location parameter
      sortBy = 'latest', 
      store_id, 
      status = 'active',
      search 
    } = req.query;
    
    console.log('🌍 getOffers called with location:', location);
    
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build order clause
    let orderClause = [['createdAt', 'DESC']];
    switch (sortBy) {
      case 'price_low_high':
        orderClause = [[{ model: Service, as: 'service' }, 'price', 'ASC']];
        break;
      case 'price_high_low':
        orderClause = [[{ model: Service, as: 'service' }, 'price', 'DESC']];
        break;
      case 'discount':
        orderClause = [['discount', 'DESC']];
        break;
      case 'latest':
      default:
        orderClause = [['createdAt', 'DESC']];
        break;
    }

    // Build where clause for offers
    const whereClause = {};
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // Build where clause for services
    const serviceWhere = {};
    if (store_id) {
      serviceWhere.store_id = store_id;
    }
    if (category) {
      serviceWhere.category = category;
    }
    
    // Search implementation
    if (search) {
      serviceWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    // Build where clause for stores (location filtering)
    const storeWhere = {};
    if (location && location !== 'All Locations') {
      storeWhere[Op.or] = [
        { location: location },
        { location: 'All Locations' }
      ];
    }

    const { count, rows: offers } = await Offer.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          as: 'service',
          where: Object.keys(serviceWhere).length > 0 ? serviceWhere : undefined,
          required: true, // Inner join to ensure service exists
          attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type', 'description', 'store_id'],
          include: [
            {
              model: Store,
              as: 'store',
              attributes: ['id', 'name', 'logo_url', 'location'],
              where: Object.keys(storeWhere).length > 0 ? storeWhere : undefined,
              required: true // Inner join to ensure store exists and matches location
            }
          ]
        }
      ],
      order: orderClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true, // Important for accurate count with includes
    });

    console.log(`🎯 Found ${offers.length} offers for location: ${location || 'All'}`);

    const formattedOffers = offers.map(formatOffer);
    const totalPages = Math.ceil(count / limit);
    const currentPageNum = parseInt(page);

    return sendSuccessResponse(res, {
      offers: formattedOffers,
      location: location || 'All Locations',
      pagination: {
        currentPage: currentPageNum,
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage: currentPageNum < totalPages,
        hasPrevPage: currentPageNum > 1
      }
    });
  } catch (err) {
    console.error('Error fetching offers with location:', err);
    return sendErrorResponse(res, 500, 'Error fetching offers', err);
  }
};

exports.getRandomOffers = async (req, res) => {
  try {
    const { limit = 12, location } = req.query; // ADD: Location parameter
    
    console.log('🎲 getRandomOffers called with limit:', limit, 'location:', location);

    // Validate limit
    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100) {
      return sendErrorResponse(res, 400, 'Invalid limit parameter. Must be between 1 and 100');
    }

    // Build where clause for stores (location filtering)
    const storeWhere = {};
    if (location && location !== 'All Locations') {
      storeWhere[Op.or] = [
        { location: location },
        { location: 'All Locations' }
      ];
    }

    const offers = await Offer.findAll({
      where: { 
        status: 'active',
        expiration_date: {
          [sequelize.Op.gt]: new Date()
        }
      },
      include: [
        {
          model: Service,
          as: 'service',
          required: true,
          attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type', 'description', 'store_id'],
          include: [
            {
              model: Store,
              as: 'store',
              attributes: ['id', 'name', 'logo_url', 'location'],
              where: Object.keys(storeWhere).length > 0 ? storeWhere : undefined,
              required: true
            }
          ]
        }
      ],
      order: sequelize.fn('RAND'), // Use RANDOM() for PostgreSQL, RAND() for MySQL
      limit: parsedLimit,
    });

    console.log(`✅ Found ${offers.length} random offers for location: ${location || 'All'}`);

    if (!offers || offers.length === 0) {
      return sendSuccessResponse(res, { 
        offers: [],
        location: location || 'All Locations'
      }, `No offers available${location ? ' for ' + location : ''}`);
    }

    const formattedOffers = offers.map(formatOffer);

    return sendSuccessResponse(res, { 
      offers: formattedOffers,
      location: location || 'All Locations'
    });
  } catch (error) {
    console.error('💥 Error in getRandomOffers:', error);
    return sendErrorResponse(res, 500, 'Error fetching random offers', error);
  }
};

// Update other methods to include location filtering where relevant...

exports.getOffersByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { page = 1, limit = 12, status = 'active', location } = req.query; // ADD: Location parameter
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Validate store exists and optionally filter by location
    const storeWhere = { id: storeId };
    if (location && location !== 'All Locations') {
      storeWhere[Op.or] = [
        { ...storeWhere, location: location },
        { ...storeWhere, location: 'All Locations' }
      ];
    }

    const store = await Store.findOne({
      where: storeWhere,
      attributes: ['id', 'name', 'logo_url', 'location']
    });
    
    if (!store) {
      return sendErrorResponse(res, 404, 'Store not found or not available in this location');
    }

    // Build where clause
    const whereClause = {};
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const { count, rows: offers } = await Offer.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          as: 'service',
          where: { store_id: storeId },
          required: true,
          attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type', 'description', 'store_id'],
          include: [
            {
              model: Store,
              as: 'store',
              attributes: ['id', 'name', 'logo_url', 'location'],
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    const formattedOffers = offers.map(formatOffer);
    const totalPages = Math.ceil(count / limit);
    const currentPageNum = parseInt(page);

    return sendSuccessResponse(res, {
      offers: formattedOffers,
      store: {
        id: store.id,
        name: store.name,
        logo_url: store.logo_url,
        location: store.location,
      },
      location: location || store.location,
      pagination: {
        currentPage: currentPageNum,
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage: currentPageNum < totalPages,
        hasPrevPage: currentPageNum > 1
      }
    });
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error fetching offers by store', err);
  }
};

exports.getOfferById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Enhanced logging
    console.log('🔍 getOfferById called with:', {
      rawId: id,
      idType: typeof id,
      idLength: id?.length,
      url: req.originalUrl,
      method: req.method
    });

    // Simple ID validation - accept both UUIDs and numeric IDs
    if (!id || id.trim() === '') {
      console.error('❌ No ID provided');
      return sendErrorResponse(res, 400, 'Offer ID is required');
    }

    // Validate ID format - accept either UUID or numeric
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const isNumeric = /^\d+$/.test(id);
    
    if (!isUUID && !isNumeric) {
      console.error('❌ Invalid ID format:', { id, isUUID, isNumeric });
      return sendErrorResponse(res, 400, 'Valid offer ID is required (UUID or numeric)');
    }

    console.log('✅ ID validation passed, fetching offer with ID:', id);

    // Use the original ID (don't parse it as integer)
    const offer = await Offer.findByPk(id, {
      include: getOfferIncludes(),
    });

    if (!offer) {
      console.log('❌ Offer not found for ID:', id);
      return sendErrorResponse(res, 404, 'Offer not found');
    }

    console.log('✅ Offer found:', {
      id: offer.id,
      title: offer.title,
      status: offer.status,
      hasService: !!offer.service,
      hasStore: !!offer.service?.store,
      storeLocation: offer.service?.store?.location
    });

    // Check if offer is expired
    const isExpired = new Date(offer.expiration_date) < new Date();
    
    const formattedOffer = formatOffer(offer);
    
    console.log('✅ Returning formatted offer');
    
    return sendSuccessResponse(res, { 
      offer: formattedOffer,
      isExpired
    });
  } catch (err) {
    console.error('💥 Error in getOfferById:', {
      error: err.message,
      stack: err.stack,
      id: req.params.id
    });
    return sendErrorResponse(res, 500, 'Error fetching offer', err);
  }
};

exports.updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { discount, expiration_date, service_id, description, status, title, featured } = req.body;

    if (!id || id.trim() === '') {
      return sendErrorResponse(res, 400, 'Valid offer ID is required');
    }

    const offer = await Offer.findByPk(id);
    if (!offer) {
      return sendErrorResponse(res, 404, 'Offer not found');
    }

    // Validation
    if (discount && (discount < 1 || discount > 100)) {
      return sendErrorResponse(res, 400, 'Discount must be between 1 and 100');
    }

    if (service_id) {
      const service = await Service.findByPk(service_id);
      if (!service) {
        return sendErrorResponse(res, 404, 'Service not found');
      }
    }

    if (expiration_date) {
      const expirationDate = new Date(expiration_date);
      if (expirationDate <= new Date()) {
        return sendErrorResponse(res, 400, 'Expiration date must be in the future');
      }
    }

    // Calculate new fee if discount is updated
    const newDiscount = discount || offer.discount;
    const fee = (newDiscount * 0.05).toFixed(2);

    const updatedOffer = await offer.update({
      discount: discount ? parseFloat(discount) : offer.discount,
      expiration_date: expiration_date || offer.expiration_date,
      service_id: service_id || offer.service_id,
      description: description !== undefined ? description : offer.description,
      status: status || offer.status,
      title: title !== undefined ? title : offer.title,
      featured: featured !== undefined ? featured : offer.featured,
      fee: parseFloat(fee),
    });

    // Fetch updated offer with includes
    const offerWithIncludes = await Offer.findByPk(updatedOffer.id, {
      include: getOfferIncludes()
    });

    return sendSuccessResponse(res, {
      offer: formatOffer(offerWithIncludes)
    }, 'Offer updated successfully');
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error updating offer', err);
  }
};

exports.deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || id.trim() === '') {
      return sendErrorResponse(res, 400, 'Valid offer ID is required');
    }

    const offer = await Offer.findByPk(id);
    if (!offer) {
      return sendErrorResponse(res, 404, 'Offer not found');
    }

    await offer.destroy();
    return sendSuccessResponse(res, { id: parseInt(id) }, 'Offer deleted successfully');
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error deleting offer', err);
  }
};

// Health check endpoint
exports.healthCheck = async (req, res) => {
  try {
    console.log('🏥 Health check called');
    
    // Test database connection
    await sequelize.authenticate();
    
    // Get basic stats
    const totalOffers = await Offer.count();
    const activeOffers = await Offer.count({
      where: { status: 'active' }
    });

    return res.status(200).json({
      success: true,
      message: 'API is healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      stats: {
        totalOffers,
        activeOffers
      }
    });
  } catch (error) {
    console.error('💥 Health check failed:', error);
    return res.status(500).json({
      success: false,
      message: 'API health check failed',
      error: error.message
    });
  }
};

// Categories endpoint with counts (location-aware)
exports.getCategoriesAlternative = async (req, res) => {
  try {
    const { location } = req.query; // ADD: Location parameter

    // Build store where clause for location filtering
    const storeWhere = {};
    if (location && location !== 'All Locations') {
      storeWhere[Op.or] = [
        { location: location },
        { location: 'All Locations' }
      ];
    }

    const categories = await Service.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('offers.id'))), 'count']
      ],
      include: [
        {
          model: Offer,
          as: 'offers',
          attributes: [],
          where: { 
            status: 'active',
            expiration_date: {
              [sequelize.Op.gt]: new Date()
            }
          },
          required: true
        },
        {
          model: Store,
          as: 'store',
          attributes: [],
          where: Object.keys(storeWhere).length > 0 ? storeWhere : undefined,
          required: true
        }
      ],
      group: [sequelize.col('Service.category')],
      having: sequelize.where(
        sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('offers.id'))), 
        '>', 
        0
      ),
      order: [[sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('offers.id'))), 'DESC']],
      raw: true
    });

    const formattedCategories = categories.map(cat => ({
      name: cat.category,
      count: parseInt(cat.count)
    }));

    return res.status(200).json({
      success: true,
      message: 'Categories fetched successfully',
      categories: formattedCategories,
      location: location || 'All Locations'
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      categories: []
    });
  }
};

// Top deals endpoint (location-aware)
exports.getTopDeals = async (req, res) => {
  try {
    const { limit = 3, location } = req.query; // ADD: Location parameter

    // Build store where clause for location filtering
    const storeWhere = {};
    if (location && location !== 'All Locations') {
      storeWhere[Op.or] = [
        { location: location },
        { location: 'All Locations' }
      ];
    }

    const topDeals = await Offer.findAll({
      where: { 
        status: 'active',
        expiration_date: {
          [sequelize.Op.gt]: new Date()
        }
      },
      include: [
        {
          model: Service,
          as: 'service',
          required: true,
          attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type', 'description', 'store_id'],
          include: [
            {
              model: Store,
              as: 'store',
              attributes: ['id', 'name', 'logo_url', 'location'],
              where: Object.keys(storeWhere).length > 0 ? storeWhere : undefined,
              required: true
            }
          ]
        }
      ],
      order: [['discount', 'DESC']],
      limit: parseInt(limit),
    });

    const formattedDeals = topDeals.map(formatOffer);

    return sendSuccessResponse(res, { 
      topDeals: formattedDeals,
      location: location || 'All Locations'
    });
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error fetching top deals', err);
  }
};

// Featured offers endpoint (location-aware)
exports.getFeaturedOffers = async (req, res) => {
  try {
    const { limit = 6, location } = req.query; // ADD: Location parameter

    // Build store where clause for location filtering
    const storeWhere = {};
    if (location && location !== 'All Locations') {
      storeWhere[Op.or] = [
        { location: location },
        { location: 'All Locations' }
      ];
    }

    const featuredOffers = await Offer.findAll({
      where: { 
        featured: true,
        status: 'active',
        expiration_date: {
          [sequelize.Op.gt]: new Date()
        }
      },
      include: [
        {
          model: Service,
          as: 'service',
          required: true,
          attributes: ['id', 'name', 'image_url', 'price', 'duration', 'category', 'type', 'description', 'store_id'],
          include: [
            {
              model: Store,
              as: 'store',
              attributes: ['id', 'name', 'logo_url', 'location'],
              where: Object.keys(storeWhere).length > 0 ? storeWhere : undefined,
              required: true
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
    });

    const formattedOffers = featuredOffers.map(formatOffer);

    return sendSuccessResponse(res, { 
      offers: formattedOffers,
      location: location || 'All Locations'
    });
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error fetching featured offers', err);
  }
};

// Get offers statistics (location-aware)
exports.getOffersStats = async (req, res) => {
  try {
    const { storeId, location } = req.params; // ADD: Location parameter from params or query

    // Build where clause
    const whereClause = storeId ? { '$service.store_id$': storeId } : {};
    
    // Build store where clause for location filtering
    const storeWhere = {};
    if (location && location !== 'All Locations') {
      storeWhere[Op.or] = [
        { location: location },
        { location: 'All Locations' }
      ];
    }

    const stats = await Offer.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('Offer.id')), 'count']
      ],
      include: [
        {
          model: Service,
          as: 'service',
          attributes: [],
          ...(storeId && { where: { store_id: storeId } }),
          include: [
            {
              model: Store,
              as: 'store',
              attributes: [],
              where: Object.keys(storeWhere).length > 0 ? storeWhere : undefined,
              required: true
            }
          ]
        }
      ],
      where: whereClause,
      group: ['status']
    });

    const formattedStats = stats.reduce((acc, stat) => {
      acc[stat.status] = parseInt(stat.dataValues.count);
      return acc;
    }, {});

    // Add default values for missing statuses
    const allStatuses = ['active', 'inactive', 'paused', 'expired'];
    allStatuses.forEach(status => {
      if (!formattedStats[status]) {
        formattedStats[status] = 0;
      }
    });

    // Calculate totals
    const total = Object.values(formattedStats).reduce((sum, count) => sum + count, 0);
    
    return sendSuccessResponse(res, {
      stats: {
        ...formattedStats,
        total
      },
      location: location || 'All Locations'
    });
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error fetching offer statistics', err);
  }
};

// Bulk update offers status
exports.bulkUpdateOffers = async (req, res) => {
  try {
    const { offerIds, status } = req.body;

    if (!offerIds || !Array.isArray(offerIds) || offerIds.length === 0) {
      return sendErrorResponse(res, 400, 'Offer IDs array is required');
    }

    if (!['active', 'inactive', 'paused'].includes(status)) {
      return sendErrorResponse(res, 400, 'Invalid status');
    }

    const [affectedRows] = await Offer.update(
      { status },
      {
        where: {
          id: offerIds
        }
      }
    );

    return sendSuccessResponse(res, {
      affectedRows
    }, `${affectedRows} offers updated successfully`);
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error updating offers', err);
  }
};