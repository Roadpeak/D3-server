const { Offer, Store, Service, Staff, StaffService, sequelize } = require('../models');
const { Op } = require('sequelize');

// Enhanced helper function to format offers with new service fields
const formatOffer = (offer) => {
  if (!offer) return null;
  
  return {
    id: offer.id,
    title: offer.title || offer.service?.name || 'Special Offer',
    description: offer.description || offer.service?.description || 'Get exclusive offers with these amazing deals',
    discount: offer.discount,
    expiration_date: offer.expiration_date,
    status: offer.status,
    fee: offer.fee,
    featured: offer.featured || false,
    offer_type: offer.offer_type || 'fixed',
    discount_explanation: offer.discount_explanation,
    requires_consultation: offer.requires_consultation || false,
    terms_conditions: offer.terms_conditions,
    max_redemptions: offer.max_redemptions,
    current_redemptions: offer.current_redemptions || 0,
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
      image_url: offer.service.image_url || (offer.service.images && offer.service.images[0]) || '/api/placeholder/300/200',
      images: offer.service.images || [],
      store_id: offer.service.store_id,
      // NEW: Enhanced booking settings
      auto_confirm_bookings: offer.service.auto_confirm_bookings,
      confirmation_message: offer.service.confirmation_message,
      require_prepayment: offer.service.require_prepayment,
      cancellation_policy: offer.service.cancellation_policy,
      min_cancellation_hours: offer.service.min_cancellation_hours,
      allow_early_checkin: offer.service.allow_early_checkin,
      early_checkin_minutes: offer.service.early_checkin_minutes,
      auto_complete_on_duration: offer.service.auto_complete_on_duration,
      grace_period_minutes: offer.service.grace_period_minutes,
      pricing_factors: offer.service.pricing_factors || [],
      price_range: offer.service.price_range,
      consultation_required: offer.service.consultation_required,
      featured: offer.service.featured || false
    } : null,
    store: offer.service?.store ? {
      id: offer.service.store.id,
      name: offer.service.store.name,
      logo_url: offer.service.store.logo_url || '/api/placeholder/20/20',
      location: offer.service.store.location,
    } : null
  };
};

// Enhanced helper function to get standard includes with new service fields
const getOfferIncludes = (locationFilter = null) => [
  {
    model: Service,
    as: 'service',
    attributes: [
      'id', 'name', 'image_url', 'images', 'price', 'duration', 'category', 'type', 'description', 'store_id',
      // NEW: Include enhanced booking settings
      'auto_confirm_bookings', 'confirmation_message', 'require_prepayment', 'cancellation_policy',
      'min_cancellation_hours', 'allow_early_checkin', 'early_checkin_minutes', 'auto_complete_on_duration',
      'grace_period_minutes', 'pricing_factors', 'price_range', 'consultation_required', 'featured'
    ],
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

// Enhanced create offer with new fields
exports.createOffer = async (req, res) => {
  try {
    const { 
      discount, 
      expiration_date, 
      service_id, 
      description, 
      status, 
      title, 
      featured,
      // NEW: Enhanced offer fields
      discount_explanation,
      requires_consultation,
      terms_conditions,
      max_redemptions
    } = req.body;

    console.log('Creating enhanced offer:', { service_id, discount, expiration_date });

    // Validation
    if (!discount || !expiration_date || !service_id) {
      return sendErrorResponse(res, 400, 'Discount, expiration date, and service ID are required');
    }

    // Validate discount range
    if (discount < 1 || discount > 100) {
      return sendErrorResponse(res, 400, 'Discount must be between 1 and 100');
    }

    // Check if service exists and get its enhanced data
    const service = await Service.findByPk(service_id, {
      include: [{ 
        model: Store, 
        as: 'store',
        attributes: ['id', 'name', 'location']
      }]
    });
    if (!service) {
      return sendErrorResponse(res, 404, 'Service not found');
    }

    console.log('Found service:', {
      id: service.id,
      name: service.name,
      type: service.type,
      auto_confirm: service.auto_confirm_bookings
    });

    // Validate expiration date
    const expirationDate = new Date(expiration_date);
    if (expirationDate <= new Date()) {
      return sendErrorResponse(res, 400, 'Expiration date must be in the future');
    }

    // Determine offer type based on service
    const offer_type = service.type || 'fixed';
    
    // Calculate fee
    const fee = (discount * 0.05).toFixed(2);

    // Auto-generate discount explanation for dynamic services if not provided
    let finalDiscountExplanation = discount_explanation;
    if (offer_type === 'dynamic' && !discount_explanation) {
      finalDiscountExplanation = `${discount}% off the final quoted price that will be agreed upon after consultation`;
    }

    // Create offer with enhanced fields
    const newOffer = await Offer.create({
      discount: parseFloat(discount),
      expiration_date,
      service_id,
      description: description || null,
      status: status || 'active',
      fee: parseFloat(fee),
      title: title || null,
      featured: featured || false,
      // NEW: Enhanced fields
      offer_type,
      discount_explanation: finalDiscountExplanation,
      requires_consultation: requires_consultation || (offer_type === 'dynamic'),
      terms_conditions: terms_conditions || null,
      max_redemptions: max_redemptions ? parseInt(max_redemptions) : null
    });

    console.log('Offer created:', {
      id: newOffer.id,
      offer_type: newOffer.offer_type,
      requires_consultation: newOffer.requires_consultation
    });

    // Fetch the created offer with includes
    const createdOffer = await Offer.findByPk(newOffer.id, {
      include: getOfferIncludes()
    });

    return sendSuccessResponse(res, { 
      offer: formatOffer(createdOffer) 
    }, 'Offer created successfully', 201);
  } catch (err) {
    console.error('Create offer error:', err);
    return sendErrorResponse(res, 500, 'Error creating offer', err);
  }
};

// Enhanced get offers with new service data
exports.getOffers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 12, 
      category, 
      location,
      sortBy = 'latest', 
      store_id, 
      status = 'active',
      search,
      offer_type // NEW: Filter by offer type
    } = req.query;
    
    console.log('Getting offers with params:', { location, offer_type, status });
    
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
    // NEW: Filter by offer type
    if (offer_type && ['fixed', 'dynamic'].includes(offer_type)) {
      whereClause.offer_type = offer_type;
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
          required: true,
          attributes: [
            'id', 'name', 'image_url', 'images', 'price', 'duration', 'category', 'type', 'description', 'store_id',
            // NEW: Include enhanced booking settings
            'auto_confirm_bookings', 'confirmation_message', 'require_prepayment', 'cancellation_policy',
            'min_cancellation_hours', 'allow_early_checkin', 'early_checkin_minutes', 'auto_complete_on_duration',
            'grace_period_minutes', 'pricing_factors', 'price_range', 'consultation_required', 'featured'
          ],
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
      order: orderClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    console.log(`Found ${offers.length} enhanced offers`);

    const formattedOffers = offers.map(formatOffer);
    const totalPages = Math.ceil(count / limit);
    const currentPageNum = parseInt(page);

    return sendSuccessResponse(res, {
      offers: formattedOffers,
      location: location || 'All Locations',
      offer_type: offer_type || 'all',
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
    console.error('Error fetching enhanced offers:', err);
    return sendErrorResponse(res, 500, 'Error fetching offers', err);
  }
};

// Enhanced get offer by ID with service data
exports.getOfferById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Getting enhanced offer by ID:', id);

    // Simple ID validation
    if (!id || id.trim() === '') {
      return sendErrorResponse(res, 400, 'Offer ID is required');
    }

    // Validate ID format
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const isNumeric = /^\d+$/.test(id);
    
    if (!isUUID && !isNumeric) {
      return sendErrorResponse(res, 400, 'Valid offer ID is required (UUID or numeric)');
    }

    const offer = await Offer.findByPk(id, {
      include: getOfferIncludes(),
    });

    if (!offer) {
      return sendErrorResponse(res, 404, 'Offer not found');
    }

    console.log('Enhanced offer found:', {
      id: offer.id,
      type: offer.offer_type,
      service_type: offer.service?.type,
      auto_confirm: offer.service?.auto_confirm_bookings
    });

    // Check if offer is expired
    const isExpired = new Date(offer.expiration_date) < new Date();
    
    const formattedOffer = formatOffer(offer);
    
    return sendSuccessResponse(res, { 
      offer: formattedOffer,
      isExpired
    });
  } catch (err) {
    console.error('Error in enhanced getOfferById:', err);
    return sendErrorResponse(res, 500, 'Error fetching offer', err);
  }
};

// Enhanced update offer
exports.updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      discount, 
      expiration_date, 
      service_id, 
      description, 
      status, 
      title, 
      featured,
      // NEW: Enhanced fields
      discount_explanation,
      requires_consultation,
      terms_conditions,
      max_redemptions
    } = req.body;

    console.log('Updating enhanced offer:', id);

    if (!id || id.trim() === '') {
      return sendErrorResponse(res, 400, 'Valid offer ID is required');
    }

    const offer = await Offer.findByPk(id, {
      include: [{
        model: Service,
        as: 'service'
      }]
    });
    
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

    // Handle discount explanation for dynamic offers
    let finalDiscountExplanation = discount_explanation;
    if (offer.offer_type === 'dynamic' && discount && !discount_explanation) {
      finalDiscountExplanation = `${discount}% off the final quoted price that will be agreed upon after consultation`;
    }

    const updatedOffer = await offer.update({
      discount: discount ? parseFloat(discount) : offer.discount,
      expiration_date: expiration_date || offer.expiration_date,
      service_id: service_id || offer.service_id,
      description: description !== undefined ? description : offer.description,
      status: status || offer.status,
      title: title !== undefined ? title : offer.title,
      featured: featured !== undefined ? featured : offer.featured,
      fee: parseFloat(fee),
      // NEW: Enhanced fields
      discount_explanation: finalDiscountExplanation !== undefined ? finalDiscountExplanation : offer.discount_explanation,
      requires_consultation: requires_consultation !== undefined ? requires_consultation : offer.requires_consultation,
      terms_conditions: terms_conditions !== undefined ? terms_conditions : offer.terms_conditions,
      max_redemptions: max_redemptions !== undefined ? (max_redemptions ? parseInt(max_redemptions) : null) : offer.max_redemptions
    });

    console.log('Offer updated with enhanced fields');

    // Fetch updated offer with includes
    const offerWithIncludes = await Offer.findByPk(updatedOffer.id, {
      include: getOfferIncludes()
    });

    return sendSuccessResponse(res, {
      offer: formatOffer(offerWithIncludes)
    }, 'Offer updated successfully');
  } catch (err) {
    console.error('Enhanced update offer error:', err);
    return sendErrorResponse(res, 500, 'Error updating offer', err);
  }
};

// Enhanced get offers for merchant store with new service data
exports.getOffersByStoreId = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { 
      page = 1, 
      limit = 12, 
      status = 'all',
      offer_type = 'all' // NEW: Filter by offer type
    } = req.query;
    
    console.log('Getting enhanced offers for store:', storeId, 'type:', offer_type);
    
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Validate store exists
    const store = await Store.findByPk(storeId);
    if (!store) {
      return sendErrorResponse(res, 404, 'Store not found');
    }

    // Build where clause
    const whereClause = {};
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    // NEW: Filter by offer type
    if (offer_type && offer_type !== 'all' && ['fixed', 'dynamic'].includes(offer_type)) {
      whereClause.offer_type = offer_type;
    }

    const { count, rows: offers } = await Offer.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          as: 'service',
          where: { store_id: storeId },
          required: true,
          attributes: [
            'id', 'name', 'image_url', 'images', 'price', 'duration', 'category', 'type', 'description', 'store_id',
            // NEW: Include enhanced booking settings
            'auto_confirm_bookings', 'confirmation_message', 'require_prepayment', 'cancellation_policy',
            'min_cancellation_hours', 'allow_early_checkin', 'early_checkin_minutes', 'auto_complete_on_duration',
            'grace_period_minutes', 'pricing_factors', 'price_range', 'consultation_required', 'featured'
          ],
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

    console.log(`Found ${offers.length} enhanced offers for store`);

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
    console.error('Error fetching enhanced store offers:', err);
    return sendErrorResponse(res, 500, 'Error fetching offers by store', err);
  }
};

// Keep all other existing methods but enhance them with new service fields
exports.getRandomOffers = async (req, res) => {
  try {
    const { limit = 12, location, offer_type } = req.query;
    
    console.log('Getting random enhanced offers:', { limit, location, offer_type });

    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100) {
      return sendErrorResponse(res, 400, 'Invalid limit parameter. Must be between 1 and 100');
    }

    // Build where clause for offers
    const offerWhere = { 
      status: 'active',
      expiration_date: {
        [Op.gt]: new Date()
      }
    };
    
    // NEW: Filter by offer type
    if (offer_type && ['fixed', 'dynamic'].includes(offer_type)) {
      offerWhere.offer_type = offer_type;
    }

    // Build store where clause for location filtering
    const storeWhere = {};
    if (location && location !== 'All Locations') {
      storeWhere[Op.or] = [
        { location: location },
        { location: 'All Locations' }
      ];
    }

    const offers = await Offer.findAll({
      where: offerWhere,
      include: getOfferIncludes(location),
      order: sequelize.fn('RAND'),
      limit: parsedLimit,
    });

    console.log(`Found ${offers.length} random enhanced offers`);

    const formattedOffers = offers.map(formatOffer);

    return sendSuccessResponse(res, { 
      offers: formattedOffers,
      location: location || 'All Locations',
      offer_type: offer_type || 'all'
    });
  } catch (error) {
    console.error('Error in enhanced getRandomOffers:', error);
    return sendErrorResponse(res, 500, 'Error fetching random offers', error);
  }
};

// Keep existing methods but add enhanced service data
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
    return sendSuccessResponse(res, { id }, 'Offer deleted successfully');
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error deleting offer', err);
  }
};

// Export all other existing methods with enhanced service data support
exports.getOffersByStore = exports.getOffersByStoreId;
exports.getTopDeals = async (req, res) => {
  try {
    const { limit = 3, location, offer_type } = req.query;

    const offerWhere = { 
      status: 'active',
      expiration_date: {
        [Op.gt]: new Date()
      }
    };
    
    if (offer_type && ['fixed', 'dynamic'].includes(offer_type)) {
      offerWhere.offer_type = offer_type;
    }

    const topDeals = await Offer.findAll({
      where: offerWhere,
      include: getOfferIncludes(location),
      order: [['discount', 'DESC']],
      limit: parseInt(limit),
    });

    const formattedDeals = topDeals.map(formatOffer);

    return sendSuccessResponse(res, { 
      topDeals: formattedDeals,
      location: location || 'All Locations',
      offer_type: offer_type || 'all'
    });
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error fetching top deals', err);
  }
};

exports.getFeaturedOffers = async (req, res) => {
  try {
    const { limit = 6, location, offer_type } = req.query;

    const offerWhere = { 
      featured: true,
      status: 'active',
      expiration_date: {
        [Op.gt]: new Date()
      }
    };
    
    if (offer_type && ['fixed', 'dynamic'].includes(offer_type)) {
      offerWhere.offer_type = offer_type;
    }

    const featuredOffers = await Offer.findAll({
      where: offerWhere,
      include: getOfferIncludes(location),
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
    });

    const formattedOffers = featuredOffers.map(formatOffer);

    return sendSuccessResponse(res, { 
      offers: formattedOffers,
      location: location || 'All Locations',
      offer_type: offer_type || 'all'
    });
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error fetching featured offers', err);
  }
};

// Keep other existing methods...
exports.getCategoriesAlternative = async (req, res) => {
  try {
    const { location } = req.query;

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
              [Op.gt]: new Date()
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

exports.getOffersStats = async (req, res) => {
  try {
    const { storeId, location } = req.params;

    const whereClause = storeId ? { '$service.store_id$': storeId } : {};
    
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
        'offer_type', // NEW: Include offer type in stats
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
      group: ['status', 'offer_type']
    });

    const formattedStats = {
      byStatus: {},
      byType: {},
      total: 0
    };

    stats.forEach(stat => {
      const status = stat.dataValues.status;
      const offer_type = stat.dataValues.offer_type;
      const count = parseInt(stat.dataValues.count);
      
      // Count by status
      if (!formattedStats.byStatus[status]) {
        formattedStats.byStatus[status] = 0;
      }
      formattedStats.byStatus[status] += count;
      
      // Count by type
      if (!formattedStats.byType[offer_type]) {
        formattedStats.byType[offer_type] = 0;
      }
      formattedStats.byType[offer_type] += count;
      
      formattedStats.total += count;
    });

    // Add default values for missing statuses and types
    const allStatuses = ['active', 'inactive', 'paused', 'expired'];
    const allTypes = ['fixed', 'dynamic'];
    
    allStatuses.forEach(status => {
      if (!formattedStats.byStatus[status]) {
        formattedStats.byStatus[status] = 0;
      }
    });
    
    allTypes.forEach(type => {
      if (!formattedStats.byType[type]) {
        formattedStats.byType[type] = 0;
      }
    });

    return sendSuccessResponse(res, {
      stats: formattedStats,
      location: location || 'All Locations'
    });
  } catch (err) {
    return sendErrorResponse(res, 500, 'Error fetching offer statistics', err);
  }
};

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

exports.healthCheck = async (req, res) => {
  try {
    console.log('Health check called');
    
    // Test database connection
    await sequelize.authenticate();
    
    // Get basic stats with enhanced offer types
    const totalOffers = await Offer.count();
    const activeOffers = await Offer.count({
      where: { status: 'active' }
    });
    const dynamicOffers = await Offer.count({
      where: { offer_type: 'dynamic', status: 'active' }
    });
    const fixedOffers = await Offer.count({
      where: { offer_type: 'fixed', status: 'active' }
    });

    return res.status(200).json({
      success: true,
      message: 'API is healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      stats: {
        totalOffers,
        activeOffers,
        dynamicOffers,
        fixedOffers
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(500).json({
      success: false,
      message: 'API health check failed',
      error: error.message
    });
  }
};