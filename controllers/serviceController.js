const { Service, Offer, Store, Follow, Staff, StaffService, sequelize } = require('../models');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const JWT_SECRET = process.env.JWT_SECRET;

// Enhanced createService with all new fields
exports.createService = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { 
      name, 
      price, 
      duration, 
      image_url, // Keep for backward compatibility
      images = [], // Handle images array
      store_id, 
      branch_id, // Added branch_id support
      category, 
      description, 
      type,
      staffIds = [],
      autoAssignAllStaff = true,
      // Dynamic service fields
      pricing_factors = [],
      price_range = '',
      consultation_required = false,
      // Booking capacity fields
      max_concurrent_bookings = 1,
      allow_overbooking = false,
      slot_interval,
      buffer_time = 0,
      min_advance_booking = 30,
      max_advance_booking = 10080,
      // NEW: Booking confirmation settings
      auto_confirm_bookings = true,
      confirmation_message = '',
      require_prepayment = false,
      cancellation_policy = '',
      min_cancellation_hours = 2,
      // NEW: Check-in and completion settings
      allow_early_checkin = true,
      early_checkin_minutes = 15,
      auto_complete_on_duration = true,
      grace_period_minutes = 10,
      // SEO fields
      tags = [],
      featured = false
    } = req.body;

    console.log('Creating service:', { 
      name, 
      type, 
      store_id, 
      branch_id,
      images: Array.isArray(images) ? images.length : 0,
      staffIds: Array.isArray(staffIds) ? staffIds.length : 0,
      auto_confirm_bookings,
      require_prepayment
    });

    // Validate required fields
    if (!name || !store_id || !category || !description || !type) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['name', 'store_id', 'category', 'description', 'type']
      });
    }

    // Check if store exists
    const store = await Store.findByPk(store_id);
    if (!store) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Store not found',
        store_id: store_id
      });
    }

    // Validate service type
    if (!['fixed', 'dynamic'].includes(type)) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Invalid service type. Must be "fixed" or "dynamic".' 
      });
    }

    // Validate fixed service requirements
    if (type === 'fixed' && (!price || !duration)) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Fixed services require price and duration' 
      });
    }

    // Validate dynamic service requirements
    if (type === 'dynamic' && (!price_range || pricing_factors.length === 0)) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Dynamic services require price_range and at least one pricing factor' 
      });
    }

    // Process images array - filter out empty/null values
    let processedImages = [];
    if (Array.isArray(images)) {
      processedImages = images.filter(img => img && typeof img === 'string' && img.trim() !== '');
      console.log(`Processing ${processedImages.length} images from frontend`);
    }

    // If no images in array but image_url provided, add it to array
    if (processedImages.length === 0 && image_url && image_url.trim() !== '') {
      processedImages = [image_url];
      console.log(`Using image_url as fallback:`, image_url);
    }

    // Fix branch_id - handle various formats from frontend
    let cleanBranchId = null;
    if (branch_id) {
      if (branch_id.startsWith('store-')) {
        // Frontend sent 'store-{storeId}' format, set to null (main store branch)
        cleanBranchId = null;
        console.log(`Branch ID indicates main store, setting to null: ${branch_id}`);
      } else if (branch_id.length === 36) {
        // Looks like a valid UUID
        cleanBranchId = branch_id;
        console.log(`Using branch_id as-is: ${branch_id}`);
      } else {
        console.log(`Invalid branch_id format: ${branch_id}`);
        cleanBranchId = null;
      }
    }

    // Validate booking confirmation settings
    if (!auto_confirm_bookings && !confirmation_message.trim()) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Confirmation message is required when auto-confirm is disabled' 
      });
    }

    // Validate numeric fields
    const numericValidations = [
      { field: 'min_cancellation_hours', value: min_cancellation_hours, min: 0, max: 48 },
      { field: 'early_checkin_minutes', value: early_checkin_minutes, min: 0, max: 60 },
      { field: 'grace_period_minutes', value: grace_period_minutes, min: 0, max: 60 },
      { field: 'max_concurrent_bookings', value: max_concurrent_bookings, min: 1, max: 50 }
    ];

    for (const validation of numericValidations) {
      const numValue = parseInt(validation.value);
      if (isNaN(numValue) || numValue < validation.min || numValue > validation.max) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: `${validation.field} must be between ${validation.min} and ${validation.max}` 
        });
      }
    }

    // Create the service data object
    const serviceData = {
      name,
      price: type === 'fixed' ? parseFloat(price) : null,
      duration: type === 'fixed' ? parseInt(duration) : null,
      images: processedImages,
      image_url: processedImages.length > 0 ? processedImages[0] : null,
      store_id,
      branch_id: cleanBranchId,
      category,
      description,
      type,
      // Dynamic service fields
      pricing_factors: pricing_factors,
      price_range: type === 'dynamic' ? price_range : null,
      consultation_required: type === 'dynamic' ? consultation_required : false,
      // Booking capacity fields
      max_concurrent_bookings: parseInt(max_concurrent_bookings) || 1,
      allow_overbooking: allow_overbooking || false,
      slot_interval: slot_interval ? parseInt(slot_interval) : null,
      buffer_time: parseInt(buffer_time) || 0,
      min_advance_booking: parseInt(min_advance_booking) || 30,
      max_advance_booking: parseInt(max_advance_booking) || 10080,
      // NEW: Booking confirmation settings
      auto_confirm_bookings: auto_confirm_bookings,
      confirmation_message: confirmation_message.trim(),
      require_prepayment: require_prepayment || false,
      cancellation_policy: cancellation_policy.trim(),
      min_cancellation_hours: parseInt(min_cancellation_hours) || 2,
      // NEW: Check-in settings
      allow_early_checkin: allow_early_checkin,
      early_checkin_minutes: parseInt(early_checkin_minutes) || 15,
      auto_complete_on_duration: auto_complete_on_duration,
      grace_period_minutes: parseInt(grace_period_minutes) || 10,
      // SEO fields
      tags: tags || [],
      featured: featured || false
    };

    console.log('Service data to create:', {
      ...serviceData,
      images: `Array(${processedImages.length})`,
      pricing_factors: `Array(${pricing_factors.length})`,
      tags: `Array(${tags.length})`
    });

    const newService = await Service.create(serviceData, { transaction });

    console.log('Service created:', {
      id: newService.id,
      name: newService.name,
      images_count: processedImages.length,
      auto_confirm: newService.auto_confirm_bookings
    });

    // Handle staff assignment
    let assignedStaffCount = 0;
    let assignedStaffIds = [];
    
    if (staffIds && Array.isArray(staffIds) && staffIds.length > 0) {
      console.log('Assigning specific staff:', staffIds);
      
      const staff = await Staff.findAll({
        where: { 
          id: staffIds,
          storeId: store_id,
          status: 'active'
        }
      }, { transaction });
      
      if (staff.length !== staffIds.length) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: 'Some staff members not found, inactive, or do not belong to this store',
          providedStaffIds: staffIds,
          validStaffFound: staff.length
        });
      }
      
      assignedStaffIds = staffIds;
      
    } else if (autoAssignAllStaff) {
      console.log('Auto-assigning all active store staff');
      
      const activeStaff = await Staff.findAll({
        where: { 
          storeId: store_id,
          status: 'active'
        },
        attributes: ['id', 'name']
      }, { transaction });
      
      assignedStaffIds = activeStaff.map(staff => staff.id);
      console.log(`Found ${assignedStaffIds.length} active staff to assign`);
    }

    // Create staff-service assignments
    if (assignedStaffIds.length > 0) {
      const assignments = assignedStaffIds.map(staffId => ({
        id: uuidv4(),
        staffId,
        serviceId: newService.id,
        isActive: true,
        assignedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      await StaffService.bulkCreate(assignments, { transaction });
      assignedStaffCount = assignments.length;
      console.log(`Created ${assignedStaffCount} staff assignments`);
    }

    await transaction.commit();
    
    // Fetch the created service with proper associations
    let serviceResponse = await Service.findByPk(newService.id, {
      include: [{
        model: Staff,
        through: { 
          attributes: ['isActive', 'assignedAt'] 
        },
        attributes: { exclude: ['password'] },
        as: 'staff'
      }]
    });

    // Convert to JSON and ensure proper data format
    if (serviceResponse) {
      serviceResponse = serviceResponse.toJSON();
      // Ensure arrays are always properly formatted for frontend
      serviceResponse.images = serviceResponse.images || [];
      serviceResponse.pricing_factors = serviceResponse.pricing_factors || [];
      serviceResponse.tags = serviceResponse.tags || [];
    }
    
    return res.status(201).json({ 
      newService: serviceResponse,
      staffAssigned: assignedStaffCount,
      message: assignedStaffCount > 0 
        ? `Service created successfully with ${assignedStaffCount} staff members assigned`
        : 'Service created successfully (no staff assigned)'
    });
    
  } catch (err) {
    await transaction.rollback();
    console.error('Service creation error:', err);
    return res.status(500).json({ 
      message: 'Error creating service',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update service with all new fields
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      type, 
      images = [], 
      image_url, 
      staffIds = [],
      // NEW: Booking confirmation settings
      auto_confirm_bookings,
      confirmation_message,
      require_prepayment,
      cancellation_policy,
      min_cancellation_hours,
      // NEW: Check-in settings
      allow_early_checkin,
      early_checkin_minutes,
      auto_complete_on_duration,
      grace_period_minutes,
      ...otherFields 
    } = req.body;

    console.log('Updating service:', id, 'with type:', type, 'auto_confirm:', auto_confirm_bookings);

    if (type && !['fixed', 'dynamic'].includes(type)) {
      return res.status(400).json({ message: 'Invalid service type. Must be "fixed" or "dynamic".' });
    }

    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Validate booking confirmation settings if provided
    if (auto_confirm_bookings === false && confirmation_message && !confirmation_message.trim()) {
      return res.status(400).json({ 
        message: 'Confirmation message is required when auto-confirm is disabled' 
      });
    }

    // Validate numeric fields if provided
    const numericFields = {
      min_cancellation_hours: { min: 0, max: 48 },
      early_checkin_minutes: { min: 0, max: 60 },
      grace_period_minutes: { min: 0, max: 60 },
      max_concurrent_bookings: { min: 1, max: 50 }
    };

    for (const [fieldName, validation] of Object.entries(numericFields)) {
      if (req.body[fieldName] !== undefined) {
        const numValue = parseInt(req.body[fieldName]);
        if (isNaN(numValue) || numValue < validation.min || numValue > validation.max) {
          return res.status(400).json({ 
            message: `${fieldName} must be between ${validation.min} and ${validation.max}` 
          });
        }
      }
    }

    // Process images
    let processedImages = [];
    if (Array.isArray(images)) {
      processedImages = images.filter(img => img && typeof img === 'string' && img.trim() !== '');
    }

    // If no images in array but image_url provided, add it
    if (processedImages.length === 0 && image_url && image_url.trim() !== '') {
      processedImages = [image_url];
    }

    const updateData = {
      ...otherFields,
      type: type || service.type,
      images: processedImages,
      image_url: processedImages.length > 0 ? processedImages[0] : service.image_url,
      price: type === 'dynamic' ? null : (otherFields.price ? parseFloat(otherFields.price) : service.price),
      duration: type === 'dynamic' ? null : (otherFields.duration ? parseInt(otherFields.duration) : service.duration),
      // NEW: Booking confirmation settings (only update if provided)
      ...(auto_confirm_bookings !== undefined && { auto_confirm_bookings }),
      ...(confirmation_message !== undefined && { confirmation_message: confirmation_message.trim() }),
      ...(require_prepayment !== undefined && { require_prepayment }),
      ...(cancellation_policy !== undefined && { cancellation_policy: cancellation_policy.trim() }),
      ...(min_cancellation_hours !== undefined && { min_cancellation_hours: parseInt(min_cancellation_hours) }),
      // NEW: Check-in settings (only update if provided)
      ...(allow_early_checkin !== undefined && { allow_early_checkin }),
      ...(early_checkin_minutes !== undefined && { early_checkin_minutes: parseInt(early_checkin_minutes) }),
      ...(auto_complete_on_duration !== undefined && { auto_complete_on_duration }),
      ...(grace_period_minutes !== undefined && { grace_period_minutes: parseInt(grace_period_minutes) })
    };

    const updatedService = await service.update(updateData);

    // Handle staff assignment updates if staffIds provided
    if (staffIds.length > 0) {
      // Remove existing assignments
      await StaffService.destroy({
        where: { serviceId: id }
      });

      // Create new assignments
      const assignments = staffIds.map(staffId => ({
        id: uuidv4(),
        staffId,
        serviceId: id,
        isActive: true,
        assignedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      await StaffService.bulkCreate(assignments);
      console.log(`Updated staff assignments: ${assignments.length} staff members`);
    }

    // Fetch updated service with associations
    const serviceWithAssociations = await Service.findByPk(id, {
      include: [{
        model: Staff,
        as: 'staff',
        through: { attributes: ['isActive', 'assignedAt'] },
        attributes: { exclude: ['password'] }
      }]
    });

    // Ensure proper data format
    const responseData = serviceWithAssociations.toJSON();
    responseData.images = responseData.images || [];
    responseData.pricing_factors = responseData.pricing_factors || [];
    responseData.tags = responseData.tags || [];

    return res.status(200).json({ 
      message: 'Service updated successfully', 
      service: responseData 
    });
  } catch (err) {
    console.error('Service update error:', err);
    return res.status(500).json({ 
      message: 'Error updating service',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get all services with enhanced data
exports.getServices = async (req, res) => {
  try {
    const services = await Service.findAll({
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'location']
        },
        {
          model: Staff,
          as: 'staff',
          through: { attributes: ['isActive', 'assignedAt'] },
          attributes: ['id', 'name', 'email', 'status'],
          required: false
        }
      ],
      order: [['featured', 'DESC'], ['createdAt', 'DESC']]
    });
    
    const processedServices = services.map(service => {
      const serviceData = service.toJSON();
      serviceData.images = serviceData.images || [];
      serviceData.pricing_factors = serviceData.pricing_factors || [];
      serviceData.tags = serviceData.tags || [];
      return serviceData;
    });
    
    return res.status(200).json({ services: processedServices });
  } catch (err) {
    console.error('Get services error:', err);
    return res.status(500).json({ message: 'Error fetching services' });
  }
};

// Get service by ID with all associations
exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findByPk(id, {
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'location']
        },
        {
          model: Staff,
          as: 'staff',
          through: { attributes: ['isActive', 'assignedAt'] },
          attributes: { exclude: ['password'] }
        }
      ]
    });

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const serviceData = service.toJSON();
    serviceData.images = serviceData.images || [];
    serviceData.pricing_factors = serviceData.pricing_factors || [];
    serviceData.tags = serviceData.tags || [];

    return res.status(200).json({ service: serviceData });
  } catch (err) {
    console.error('Get service by ID error:', err);
    return res.status(500).json({ message: 'Error fetching service' });
  }
};

// Search services (keeping existing logic)
exports.searchServices = async (req, res) => {
  try {
    const { term, minPrice, maxPrice } = req.query;

    const whereClause = {};
    const storeWhereClause = {};

    // Searching for services based on the term
    if (term) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${term}%` } },
        { category: { [Op.like]: `%${term}%` } },
        { description: { [Op.like]: `%${term}%` } }
      ];
      if (term.toLowerCase().includes('sale') || term.toLowerCase().includes('offer')) {
        whereClause[Op.or] = [
          ...(whereClause[Op.or] || []),
          { name: { [Op.like]: '%sale%' } },
          { description: { [Op.like]: '%offer%' } }
        ];
      }
    }

    // Searching stores based on the term
    if (term) {
      storeWhereClause[Op.or] = [
        { name: { [Op.like]: `%${term}%` } },
        { location: { [Op.like]: `%${term}%` } },
        { description: { [Op.like]: `%${term}%` } }
      ];
    }

    // Price range filtering for services
    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price[Op.gte] = parseFloat(minPrice);
      if (maxPrice) whereClause.price[Op.lte] = parseFloat(maxPrice);
    }

    // Fetch services based on the constructed whereClause and include associated Offers
    const services = await Service.findAll({
      where: whereClause,
      include: [{
        model: Offer,
        required: false // Include services even without offers
      }]
    });

    // Fetch stores based on the storeWhereClause
    const stores = await Store.findAll({
      where: storeWhereClause
    });

    // Get userId from the token
    let userId = null;
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded?.userId;
      } catch (err) {
        console.error('Error verifying token:', err);
        userId = null;
      }
    }

    // If the user is logged in, fetch followed stores
    let followedStoreIds = new Set();
    if (userId) {
      const followedStores = await Follow.findAll({
        where: { user_id: userId },
        attributes: ['store_id'],
      });

      followedStoreIds = new Set(followedStores.map(follow => follow.store_id));
    }

    // Now map stores with the follow status
    const storesWithFollowStatus = stores.map(store => {
      const isFollowing = followedStoreIds.has(store.id);
      return {
        ...store.toJSON(),
        following: isFollowing
      };
    });

    // If no stores or services match, send a 200 response with a message
    if (services.length === 0 && storesWithFollowStatus.length === 0) {
      return res.status(200).json({ message: 'No services or stores found matching your criteria' });
    }

    // Return both services and stores with follow status
    return res.status(200).json({ services, stores: storesWithFollowStatus });
  } catch (err) {
    console.error('Search services error:', err);
    return res.status(500).json({ message: 'Error searching services and stores' });
  }
};

// Delete a service
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    await service.destroy();
    return res.status(200).json({ message: 'Service deleted successfully' });
  } catch (err) {
    console.error('Delete service error:', err);
    return res.status(500).json({ message: 'Error deleting service' });
  }
};

// Get services by store ID with enhanced data
exports.getServicesByStoreId = async (req, res) => {
  try {
    const { storeId } = req.params;
    
    console.log('Getting services for store:', storeId);
    
    // Validate storeId parameter
    if (!storeId || storeId === 'undefined' || storeId === 'null') {
      return res.status(400).json({ 
        success: false,
        message: 'Valid store ID is required',
        services: []
      });
    }
    
    // Check if store exists
    const store = await Store.findByPk(storeId);
    if (!store) {
      return res.status(404).json({ 
        success: false,
        message: 'Store not found',
        services: []
      });
    }

    // If user is authenticated and is a merchant, verify ownership
    if (req.user && (req.user.type === 'merchant' || req.user.role === 'merchant')) {
      const merchantId = req.user.id || req.user.userId;
      console.log('Verifying store ownership for merchant:', merchantId);
      
      if (store.merchant_id !== merchantId) {
        console.log('Store ownership verification failed');
        return res.status(403).json({ 
          success: false,
          message: 'Access denied. You can only access your own store services.',
          services: []
        });
      }
      console.log('Store ownership verified');
    }

    // Fetch services for this specific store with all new fields
    const services = await Service.findAll({
      where: {
        store_id: storeId,
      },
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'location'],
          required: false
        },
        {
          model: Staff,
          as: 'staff',
          through: { 
            attributes: ['isActive', 'assignedAt'] 
          },
          attributes: ['id', 'name', 'email', 'status'],
          required: false
        }
      ],
      order: [['featured', 'DESC'], ['createdAt', 'DESC']]
    });

    console.log(`Found ${services.length} services for store ${storeId}`);

    // Process services to ensure proper data format
    const processedServices = services.map(service => {
      const serviceData = service.toJSON();
      
      // Ensure arrays are properly formatted
      serviceData.images = serviceData.images || [];
      serviceData.pricing_factors = serviceData.pricing_factors || [];
      serviceData.tags = serviceData.tags || [];
      
      // Log enhanced fields for debugging
      console.log(`Service "${serviceData.name}":`, {
        images: serviceData.images.length,
        auto_confirm: serviceData.auto_confirm_bookings,
        require_prepayment: serviceData.require_prepayment,
        type: serviceData.type
      });
      
      return serviceData;
    });

    return res.status(200).json({ 
      success: true,
      services: processedServices,
      storeInfo: {
        id: store.id,
        name: store.name,
        location: store.location
      },
      count: processedServices.length
    });
  } catch (err) {
    console.error('Error fetching services for store:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching services for this store',
      services: [],
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get services by merchant ID
exports.getServicesByMerchantId = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('Getting services for merchant:', merchantId);
    // SECURITY: Not logging user object to prevent sensitive data exposure
    
    // Check if requesting merchant is the same as the authenticated merchant
    if (req.user.id !== merchantId && req.user.userId !== merchantId) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. You can only access your own services.' 
      });
    }

    // Get all stores for this merchant
    const merchantStores = await Store.findAll({
      where: { merchant_id: merchantId },
      attributes: ['id', 'name', 'location']
    });

    if (merchantStores.length === 0) {
      return res.status(200).json({ 
        success: true,
        message: 'No stores found for this merchant. Please create a store first.',
        services: [],
        storeCount: 0
      });
    }

    const storeIds = merchantStores.map(store => store.id);
    console.log('Found stores:', storeIds);

    const services = await Service.findAll({
      where: {
        store_id: {
          [Op.in]: storeIds
        }
      },
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'location'],
          required: false
        },
        {
          model: Staff,
          as: 'staff',
          through: { 
            attributes: ['isActive', 'assignedAt'] 
          },
          attributes: ['id', 'name', 'email', 'status'],
          required: false
        }
      ],
      order: [['featured', 'DESC'], ['createdAt', 'DESC']]
    });

    console.log(`Found ${services.length} services for merchant ${merchantId}`);

    // Process services to ensure proper formatting
    const processedServices = services.map(service => {
      const serviceData = service.toJSON();
      serviceData.images = serviceData.images || [];
      serviceData.pricing_factors = serviceData.pricing_factors || [];
      serviceData.tags = serviceData.tags || [];
      return serviceData;
    });

    return res.status(200).json({ 
      success: true,
      services: processedServices,
      storeCount: merchantStores.length
    });
  } catch (err) {
    console.error('Error fetching services by merchant:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching services',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Alternative merchant services function
exports.getMerchantServices = async (req, res) => {
  try {
    const merchantId = req.user.id || req.user.userId;
    console.log('Getting all services for merchant:', merchantId);
    
    // Get all stores for this merchant first
    const merchantStores = await Store.findAll({
      where: { merchant_id: merchantId },
      attributes: ['id', 'name', 'location']
    });

    if (merchantStores.length === 0) {
      return res.status(200).json({ 
        success: true,
        message: 'No stores found. Please create a store first.',
        services: [],
        stores: []
      });
    }

    const storeIds = merchantStores.map(store => store.id);
    console.log('Found stores:', storeIds);

    // Fetch services only for these stores with all associations
    const services = await Service.findAll({
      where: {
        store_id: {
          [Op.in]: storeIds
        }
      },
      include: [
        {
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'location'],
          required: true // Ensure service has a valid store
        },
        {
          model: Staff,
          through: { 
            attributes: ['isActive', 'assignedAt'] 
          },
          attributes: ['id', 'name', 'email', 'status'],
          as: 'staff',
          required: false
        }
      ],
      order: [['featured', 'DESC'], ['createdAt', 'DESC']]
    });

    console.log(`Found ${services.length} total services across ${merchantStores.length} stores`);

    // Process services to ensure proper formatting
    const processedServices = services.map(service => {
      const serviceData = service.toJSON();
      serviceData.images = serviceData.images || [];
      serviceData.pricing_factors = serviceData.pricing_factors || [];
      serviceData.tags = serviceData.tags || [];
      return serviceData;
    });

    // Group services by store for debugging
    const servicesByStore = services.reduce((acc, service) => {
      const storeId = service.store_id;
      if (!acc[storeId]) acc[storeId] = [];
      acc[storeId].push(service.name);
      return acc;
    }, {});

    console.log('Services by store:', Object.entries(servicesByStore).map(
      ([storeId, serviceNames]) => `Store ${storeId}: ${serviceNames.length} services`
    ).join(', '));

    return res.status(200).json({ 
      success: true,
      services: processedServices,
      stores: merchantStores,
      servicesByStore: Object.keys(servicesByStore).length
    });
  } catch (err) {
    console.error('Error fetching merchant services:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching services',
      services: []
    });
  }
};

// Get service analytics
exports.getServiceAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check service ownership
    const service = await Service.findByPk(id, {
      include: [{
        model: Store,
        attributes: ['merchant_id'],
        required: true
      }]
    });

    if (!service) {
      return res.status(404).json({ 
        success: false,
        message: 'Service not found' 
      });
    }

    const merchantId = req.user.id || req.user.userId;
    if (service.Store.merchant_id !== merchantId) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Return analytics including new booking settings data
    return res.status(200).json({
      success: true,
      analytics: {
        views: Math.floor(Math.random() * 100) + 10,
        bookings: Math.floor(Math.random() * 20) + 1,
        rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 - 5.0
        autoConfirmRate: service.auto_confirm_bookings ? 100 : 0,
        cancellationRate: Math.floor(Math.random() * 10) + 1,
        earlyCheckins: Math.floor(Math.random() * 5) + 1,
        completionRate: Math.floor(Math.random() * 20) + 80
      },
      serviceSettings: {
        auto_confirm_bookings: service.auto_confirm_bookings,
        require_prepayment: service.require_prepayment,
        allow_early_checkin: service.allow_early_checkin,
        auto_complete_on_duration: service.auto_complete_on_duration,
        featured: service.featured
      }
    });
  } catch (err) {
    console.error('Get service analytics error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching service analytics'
    });
  }
};

// Add to favorites
exports.addToFavorites = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Add service to favorites functionality coming soon',
    serviceId: req.params.id,
    userId: req.user.userId || req.user.id
  });
};

// Remove from favorites
exports.removeFromFavorites = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Remove service from favorites functionality coming soon',
    serviceId: req.params.id,
    userId: req.user.userId || req.user.id
  });
};

// Submit review
exports.submitReview = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Submit service review functionality coming soon',
    serviceId: req.params.id,
    userId: req.user.userId || req.user.id
  });
};

// Get pending services for admin
exports.getPendingServices = async (req, res) => {
  try {
    const pendingServices = await Service.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: Store,
          attributes: ['id', 'name', 'merchant_id'],
          required: false
        },
        {
          model: Staff,
          as: 'staff',
          through: { attributes: ['isActive', 'assignedAt'] },
          attributes: ['id', 'name', 'status'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Process services
    const processedServices = pendingServices.map(service => {
      const serviceData = service.toJSON();
      serviceData.images = serviceData.images || [];
      serviceData.pricing_factors = serviceData.pricing_factors || [];
      serviceData.tags = serviceData.tags || [];
      return serviceData;
    });

    return res.status(200).json({
      success: true,
      services: processedServices
    });
  } catch (err) {
    console.error('Get pending services error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching pending services'
    });
  }
};

// Verify service (admin)
exports.verifyService = async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 'active' } = req.body;

    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    await service.update({ status });

    return res.status(200).json({
      success: true,
      message: `Service ${status === 'active' ? 'approved' : 'rejected'} successfully`,
      serviceId: id,
      newStatus: status
    });
  } catch (err) {
    console.error('Verify service error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error verifying service'
    });
  }
};

// Update service status (admin)
exports.updateServiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be active, inactive, or suspended'
      });
    }

    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    await service.update({ 
      status,
      ...(reason && { suspension_reason: reason })
    });

    return res.status(200).json({
      success: true,
      message: `Service status updated to ${status}`,
      serviceId: id,
      newStatus: status
    });
  } catch (err) {
    console.error('Update service status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating service status'
    });
  }
};

// Debug services (for development)
exports.debugServices = async (req, res) => {
  try {
    const merchantId = req.user.id || req.user.userId;
    
    // Get all services and their store associations
    const allServices = await Service.findAll({
      include: [{
        model: Store,
        attributes: ['id', 'name', 'merchant_id'],
        required: false
      }]
    });

    const merchantServices = allServices.filter(service => 
      service.Store && service.Store.merchant_id === merchantId
    );

    const debug = {
      merchant_id: merchantId,
      total_services_in_db: allServices.length,
      merchant_services: merchantServices.length,
      service_details: merchantServices.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        store_id: s.store_id,
        store_name: s.Store?.name,
        store_merchant_id: s.Store?.merchant_id,
        images_count: s.images ? s.images.length : 0,
        has_image_url: !!s.image_url,
        auto_confirm_bookings: s.auto_confirm_bookings,
        require_prepayment: s.require_prepayment,
        featured: s.featured,
        status: s.status
      }))
    };

    return res.status(200).json(debug);
  } catch (err) {
    console.error('Debug services error:', err);
    return res.status(500).json({ error: err.message });
  }
};