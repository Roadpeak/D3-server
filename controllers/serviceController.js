const { Service, Offer, Store, Follow } = require('../models');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

// Replace your existing createService method with this enhanced version

const {  Staff, StaffService, sequelize } = require('../models');
const { v4: uuidv4 } = require('uuid');

exports.createService = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { 
      name, 
      price, 
      duration, 
      image_url, 
      store_id, 
      category, 
      description, 
      type,
      staffIds = [], // Array of specific staff IDs to assign
      autoAssignAllStaff = true // Auto-assign all store staff if no specific staff provided
    } = req.body;

    console.log('📝 Creating service:', { name, type, store_id, staffIds, autoAssignAllStaff });

    // Validate required fields (keeping your existing validation)
    if (!name || !store_id || !category || !description || !type) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['name', 'store_id', 'category', 'description', 'type']
      });
    }

    // Check if store exists (keeping your existing validation)
    const store = await Store.findByPk(store_id);
    if (!store) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Store not found',
        store_id: store_id
      });
    }

    // Validate service type (keeping your existing validation)
    if (!['fixed', 'dynamic'].includes(type)) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Invalid service type. Must be "fixed" or "dynamic".' 
      });
    }

    // Validate fixed service requirements (keeping your existing validation)
    if (type === 'fixed' && (!price || !duration)) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: 'Fixed services require price and duration' 
      });
    }

    // Create the service (keeping your existing creation logic)
    const newService = await Service.create({
      name,
      price: type === 'fixed' ? parseFloat(price) : null,
      duration: type === 'fixed' ? parseInt(duration) : null,
      image_url,
      store_id,
      category,
      description,
      type,
    }, { transaction });

    console.log('✅ Service created:', newService.id);

    // NEW: Handle staff assignment
    let assignedStaffCount = 0;
    let assignedStaffIds = [];
    
    if (staffIds && Array.isArray(staffIds) && staffIds.length > 0) {
      // Option 1: Assign specific staff provided in the request
      console.log('👥 Assigning specific staff:', staffIds);
      
      // Verify all staff belong to the same store and are active
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
      // Option 2: Auto-assign all active staff from the store
      console.log('🤖 Auto-assigning all active store staff');
      
      const activeStaff = await Staff.findAll({
        where: { 
          storeId: store_id,
          status: 'active'
        },
        attributes: ['id', 'name']
      }, { transaction });
      
      assignedStaffIds = activeStaff.map(staff => staff.id);
      console.log(`📋 Found ${assignedStaffIds.length} active staff to assign:`, 
        activeStaff.map(s => s.name).join(', '));
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
      console.log(`✅ Created ${assignedStaffCount} staff assignments`);
    } else {
      console.log('⚠️ No staff assigned to service - offers cannot be created until staff are assigned');
    }

    await transaction.commit();
    
    // Fetch the created service with staff info for response
    let serviceWithStaff = newService;
    try {
      serviceWithStaff = await Service.findByPk(newService.id, {
        include: [{
          model: Staff,
          through: { 
            attributes: [] // Don't include junction table data in response
          },
          attributes: { exclude: ['password'] },
          as: 'Staff' // Make sure this matches your association alias
        }]
      });
      console.log('📊 Service response includes', serviceWithStaff?.Staff?.length || 0, 'staff members');
    } catch (includeError) {
      console.log('⚠️ Could not include staff in response:', includeError.message);
      // Continue with basic service data
    }
    
    return res.status(201).json({ 
      newService: serviceWithStaff || newService,
      staffAssigned: assignedStaffCount,
      message: assignedStaffCount > 0 
        ? `Service created successfully with ${assignedStaffCount} staff members assigned`
        : 'Service created successfully (no staff assigned)'
    });
    
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Service creation error:', err);
    return res.status(500).json({ 
      message: 'Error creating service',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getServices = async (req, res) => {
  try {
    const services = await Service.findAll();
    return res.status(200).json({ services });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching services' });
  }
};

exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    return res.status(200).json({ service });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching service' });
  }
};

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
    console.error(err);
    return res.status(500).json({ message: 'Error searching services and stores' });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    if (type && !['fixed', 'dynamic'].includes(type)) {
      return res.status(400).json({ message: 'Invalid service type. Must be "fixed" or "dynamic".' });
    }

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const updatedService = await service.update({
      ...req.body,
      price: type === 'dynamic' ? null : req.body.price || service.price,
      duration: type === 'dynamic' ? null : req.body.duration || service.duration,
    });

    return res.status(200).json({ message: 'Service updated successfully', service: updatedService });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error updating service' });
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
    console.error(err);
    return res.status(500).json({ message: 'Error deleting service' });
  }
};

exports.getServicesByStoreId = async (req, res) => {
  try {
    const { storeId } = req.params;
    const services = await Service.findAll({
      where: {
        store_id: storeId,
      },
    });

    if (services.length === 0) {
      return res.status(404).json({ message: 'No services found for this store' });
    }

    return res.status(200).json({ services });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching services for this store' });
  }
};

// Function that your frontend is calling: /services/merchant/:merchantId
exports.getServicesByMerchantId = async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    console.log('🔍 Getting services for merchant:', merchantId);
    console.log('🔍 Authenticated user:', req.user);
    
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
    console.log('🏪 Found stores:', storeIds);

    const services = await Service.findAll({
      where: {
        store_id: {
          [Op.in]: storeIds
        }
      },
      include: [{
        model: Store,
        attributes: ['id', 'name', 'location'],
        required: false
      }],
      order: [['createdAt', 'DESC']]
    });

    console.log(`✅ Found ${services.length} services for merchant ${merchantId}`);

    return res.status(200).json({ 
      success: true,
      services,
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
    
    // Get all stores for this merchant
    const merchantStores = await Store.findAll({
      where: { merchant_id: merchantId },
      attributes: ['id', 'name', 'location']
    });

    if (merchantStores.length === 0) {
      return res.status(200).json({ 
        success: true,
        message: 'No stores found. Please create a store first.',
        services: []
      });
    }

    const storeIds = merchantStores.map(store => store.id);

    const services = await Service.findAll({
      where: {
        store_id: {
          [Op.in]: storeIds
        }
      },
      include: [{
        model: Store,
        attributes: ['id', 'name', 'location'],
        required: false
      }],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({ 
      success: true,
      services
    });
  } catch (err) {
    console.error('Error fetching merchant services:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching services'
    });
  }
};

// Function that your frontend might call: /services/store/:storeId
exports.getServicesByStoreId = async (req, res) => {
  try {
    const { storeId } = req.params;
    
    console.log('🔍 Getting services for store:', storeId);
    
    // Check if store exists
    const store = await Store.findByPk(storeId);
    if (!store) {
      return res.status(404).json({ 
        success: false,
        message: 'Store not found' 
      });
    }

    // If user is authenticated and is a merchant, check ownership
    if (req.user && req.user.type === 'merchant') {
      const merchantId = req.user.id || req.user.userId;
      if (store.merchant_id !== merchantId) {
        return res.status(403).json({ 
          success: false,
          message: 'Access denied. You can only access your own store services.' 
        });
      }
    }

    const services = await Service.findAll({
      where: {
        store_id: storeId,
      },
      include: [{
        model: Store,
        attributes: ['id', 'name', 'location'],
        required: false
      }],
      order: [['createdAt', 'DESC']]
    });

    console.log(`✅ Found ${services.length} services for store ${storeId}`);

    return res.status(200).json({ 
      success: true,
      services 
    });
  } catch (err) {
    console.error('Error fetching services for store:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching services for this store',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Placeholder functions for the other routes (implement as needed)
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

    // Return mock analytics for now
    return res.status(200).json({
      success: true,
      analytics: {
        views: Math.floor(Math.random() * 100) + 10,
        bookings: Math.floor(Math.random() * 20) + 1,
        rating: (Math.random() * 2 + 3).toFixed(1) // 3.0 - 5.0
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

exports.addToFavorites = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Add service to favorites functionality coming soon',
    serviceId: req.params.id,
    userId: req.user.userId || req.user.id
  });
};

exports.removeFromFavorites = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Remove service from favorites functionality coming soon',
    serviceId: req.params.id,
    userId: req.user.userId || req.user.id
  });
};

exports.submitReview = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Submit service review functionality coming soon',
    serviceId: req.params.id,
    userId: req.user.userId || req.user.id
  });
};

exports.getPendingServices = async (req, res) => {
  try {
    const pendingServices = await Service.findAll({
      where: { status: 'pending' }, // Assuming you have a status field
      include: [{
        model: Store,
        attributes: ['id', 'name', 'merchant_id'],
        required: false
      }],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      services: pendingServices
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching pending services'
    });
  }
};

exports.verifyService = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Verify service functionality coming soon',
    serviceId: req.params.id
  });
};

exports.updateServiceStatus = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Update service status functionality coming soon',
    serviceId: req.params.id
  });
};