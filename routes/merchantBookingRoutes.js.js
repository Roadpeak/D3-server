const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

// Import controllers
const serviceBookingController = require('../controllers/serviceBookingController');
const offerBookingController = require('../controllers/offerBookingController');

// Import middleware
const { authenticateMerchant } = require('../middleware/Merchantauth');

// Import models
const { Booking, Service, Store, User, Staff, Offer, Payment } = require('../models');

// ==========================================
// MERCHANT SERVICE BOOKINGS
// ==========================================

// FINAL FIXED VERSION - routes/merchantBookingRoutes.js

/**
 * Get all service bookings for authenticated merchant
 * GET /api/v1/merchant/bookings/services
 */
router.get('/services', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user?.id;
    
    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: 'Merchant authentication required'
      });
    }

    const { 
      status, 
      limit = 50, 
      offset = 0, 
      startDate, 
      endDate,
      storeId,
      staffId 
    } = req.query;

    console.log('Fetching service bookings for merchant:', merchantId);

    // Build where conditions
    const whereConditions = { 
      serviceId: { [Op.ne]: null },
      bookingType: 'service'
    };
    
    if (status) {
      whereConditions.status = status;
    }

    if (startDate) {
      whereConditions.startTime = { [Op.gte]: new Date(startDate) };
    }

    if (endDate) {
      whereConditions.startTime = {
        ...whereConditions.startTime,
        [Op.lte]: new Date(endDate)
      };
    }

    if (storeId) {
      whereConditions.storeId = storeId;
    }

    if (staffId) {
      whereConditions.staffId = staffId;
    }

    // CORRECTED: Use exact aliases from your models/index.js
    const bookings = await Booking.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'bookingUser', // This matches: Booking.belongsTo(User, { as: 'bookingUser' })
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'],
          required: false
        },
        {
          model: Service,
          as: 'service', // This matches: Booking.belongsTo(Service, { as: 'service' })
          required: false,
          attributes: ['id', 'name', 'price', 'duration'],
          include: [{
            model: Store,
            as: 'store', // This matches: Service.belongsTo(Store, { as: 'store' })
            where: {
              merchant_id: merchantId // Filter by merchant's stores
            },
            attributes: ['id', 'name', 'location'],
            required: true // This ensures only merchant's bookings are returned
          }]
        },
        {
          model: Staff,
          as: 'staff', // This matches: Booking.belongsTo(Staff, { as: 'staff' })
          required: false,
          attributes: ['id', 'name', 'email', 'phoneNumber', 'role', 'status']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log(`Found ${bookings.count} service bookings for merchant ${merchantId}`);

    // Format response with CORRECTED property access
    const formattedBookings = bookings.rows.map(booking => {
      const bookingData = booking.toJSON();
      
      // CORRECTED: Use the exact aliases from your associations
      const user = bookingData.bookingUser; // This is the correct alias
      const service = bookingData.service;   // This is the correct alias
      const staff = bookingData.staff;       // This is the correct alias
      
      return {
        ...bookingData,
        // Add standardized properties for frontend compatibility
        customerName: user 
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
          : 'Unknown Customer',
        serviceName: service?.name || 'Unknown Service',
        storeName: service?.store?.name || 'Unknown Store',
        staffName: staff?.name || null,
        isUpcoming: new Date(bookingData.startTime) > new Date(),
        isPast: new Date(bookingData.startTime) < new Date(),
        canModify: ['pending', 'confirmed'].includes(bookingData.status) && 
                  new Date(bookingData.startTime) > new Date(),
        
        // IMPORTANT: Also provide the capitalized versions for frontend compatibility
        User: user ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber
        } : null,
        
        Service: service ? {
          id: service.id,
          name: service.name,
          price: service.price,
          duration: service.duration,
          store: service.store
        } : null,
        
        Staff: staff ? {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          phoneNumber: staff.phoneNumber,
          role: staff.role,
          status: staff.status
        } : null
      };
    });

    return res.json({
      success: true,
      bookings: formattedBookings,
      pagination: {
        total: bookings.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < bookings.count
      },
      summary: {
        total: bookings.count,
        pending: formattedBookings.filter(b => b.status === 'pending').length,
        confirmed: formattedBookings.filter(b => b.status === 'confirmed').length,
        in_progress: formattedBookings.filter(b => b.status === 'in_progress').length,
        completed: formattedBookings.filter(b => b.status === 'completed').length,
        cancelled: formattedBookings.filter(b => b.status === 'cancelled').length
      },
      debug: {
        merchantId: merchantId,
        totalBookingsFound: bookings.count,
        queryUsed: {
          aliases: ['bookingUser', 'service', 'staff'],
          merchantFilter: `store.merchant_id = ${merchantId}`
        }
      }
    });

  } catch (error) {
    console.error('Error fetching merchant service bookings:', error);
    
    // Enhanced error handling for debugging
    if (error.name === 'SequelizeEagerLoadingError') {
      console.error('Association error details:', {
        message: error.message,
        include: error.include
      });
      
      return res.status(500).json({
        success: false,
        message: 'Database association error - check model relationships',
        error: process.env.NODE_ENV === 'development' ? {
          name: error.name,
          message: error.message,
          include: error.include,
          stack: error.stack
        } : 'Internal server error',
        debug: {
          merchantId: merchantId,
          expectedAssociations: [
            'Booking -> User (as: bookingUser)',
            'Booking -> Service (as: service)',
            'Service -> Store (as: store)', 
            'Booking -> Staff (as: staff)'
          ]
        }
      });
    }
    
    // Provide fallback mock data for development
    if (process.env.NODE_ENV === 'development') {
      console.log('Providing mock service bookings for development');
      return res.json({
        success: true,
        bookings: generateMockServiceBookings(parseInt(req.query.limit) || 10),
        pagination: {
          total: 10,
          limit: parseInt(req.query.limit) || 10,
          offset: parseInt(req.query.offset) || 0,
          hasMore: false
        },
        message: 'Using mock data - database query failed',
        error: error.message,
        debug: {
          merchantId: merchantId,
          errorDetails: {
            name: error.name,
            message: error.message
          }
        }
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch service bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get specific service booking by ID
 * GET /api/v1/merchant/bookings/services/:bookingId
 */
router.get('/services/:bookingId', authenticateMerchant, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const merchantId = req.user.id;

    const booking = await Booking.findOne({
      where: {
        id: bookingId,
        serviceId: { [Op.ne]: null },
        bookingType: 'service'
      },
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Service,
          as: 'Service',
          required: true,
          attributes: ['id', 'name', 'price', 'duration'],
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            attributes: ['id', 'name', 'location'],
            required: true
          }]
        },
        {
          model: Staff,
          as: 'Staff',
          required: false,
          attributes: ['id', 'name', 'email', 'phoneNumber', 'role', 'status']
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Service booking not found or not accessible'
      });
    }

    return res.json({
      success: true,
      booking: booking
    });

  } catch (error) {
    console.error('Error fetching service booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch service booking details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Update service booking status
 * PUT /api/v1/merchant/bookings/services/:bookingId/status
 */
router.put('/services/:bookingId/status', authenticateMerchant, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, notes } = req.body;
    const merchantId = req.user.id;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided'
      });
    }

    // Find the booking and verify merchant ownership
    const booking = await Booking.findOne({
      where: {
        id: bookingId,
        serviceId: { [Op.ne]: null },
        bookingType: 'service'
      },
      include: [{
        model: Service,
        as: 'Service',
        required: true,
        include: [{
          model: Store,
          as: 'store',
          where: {
            merchant_id: merchantId
          },
          required: true
        }]
      }]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Service booking not found or not accessible'
      });
    }

    // Update the booking
    const updateData = { 
      status,
      updatedBy: merchantId
    };

    // Add timestamp fields based on status
    switch (status) {
      case 'confirmed':
        updateData.confirmedAt = new Date();
        updateData.confirmedBy = req.user.name || req.user.email;
        break;
      case 'in_progress':
        updateData.checked_in_at = new Date();
        updateData.service_started_at = new Date();
        updateData.checked_in_by = req.user.name || req.user.email;
        break;
      case 'completed':
        updateData.completedAt = new Date();
        updateData.completed_by = req.user.name || req.user.email;
        break;
      case 'cancelled':
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = notes || 'Cancelled by merchant';
        break;
    }

    // Add notes if provided
    if (notes) {
      updateData.merchantNotes = booking.merchantNotes 
        ? `${booking.merchantNotes}\n\n[${new Date().toISOString()}] ${notes}`
        : notes;
    }

    await booking.update(updateData);

    return res.json({
      success: true,
      message: `Service booking ${status} successfully`,
      booking: booking
    });

  } catch (error) {
    console.error('Error updating service booking status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update service booking status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==========================================
// MERCHANT OFFER BOOKINGS
// ==========================================

/**
 * Get all offer bookings for authenticated merchant
 * GET /api/v1/merchant/bookings/offers
 */
router.get('/offers', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user?.id;
    
    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: 'Merchant authentication required'
      });
    }

    const { 
      status, 
      limit = 50, 
      offset = 0, 
      startDate, 
      endDate,
      storeId,
      staffId 
    } = req.query;

    console.log('Fetching offer bookings for merchant:', merchantId);

    // Build where conditions
    const whereConditions = { 
      offerId: { [Op.ne]: null },
      bookingType: 'offer'
    };
    
    if (status) {
      whereConditions.status = status;
    }

    if (startDate) {
      whereConditions.startTime = { [Op.gte]: new Date(startDate) };
    }

    if (endDate) {
      whereConditions.startTime = {
        ...whereConditions.startTime,
        [Op.lte]: new Date(endDate)
      };
    }

    if (storeId) {
      whereConditions.storeId = storeId;
    }

    if (staffId) {
      whereConditions.staffId = staffId;
    }

    // Query bookings with merchant filtering
    const bookings = await Booking.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'],
          required: false
        },
        {
          model: Offer,
          as: 'Offer',
          required: true,
          attributes: ['id', 'title', 'description', 'discount', 'original_price', 'discounted_price'],
          include: [{
            model: Service,
            as: 'service',
            attributes: ['id', 'name', 'price', 'duration'],
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId // Filter by merchant's stores
              },
              attributes: ['id', 'name', 'location'],
              required: true
            }]
          }]
        },
        {
          model: Staff,
          as: 'Staff',
          required: false,
          attributes: ['id', 'name', 'email', 'phoneNumber', 'role', 'status']
        },
        {
          model: Payment,
          as: 'Payment',
          required: false,
          attributes: ['id', 'amount', 'status', 'method', 'transaction_id']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log(`Found ${bookings.count} offer bookings for merchant ${merchantId}`);

    // Format response
    const formattedBookings = bookings.rows.map(booking => {
      const bookingData = booking.toJSON();
      
      const user = bookingData.User || bookingData.user;
      const offer = bookingData.Offer || bookingData.offer;
      const staff = bookingData.Staff || bookingData.staff;
      const payment = bookingData.Payment || bookingData.payment;
      
      return {
        ...bookingData,
        customerName: user 
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
          : 'Unknown Customer',
        offerTitle: offer?.title || 'Unknown Offer',
        serviceName: offer?.service?.name || 'Unknown Service',
        storeName: offer?.service?.store?.name || 'Unknown Store',
        staffName: staff?.name || null,
        accessFeePaid: !!payment,
        paymentAmount: payment?.amount || bookingData.accessFee || 0,
        isUpcoming: new Date(bookingData.startTime) > new Date(),
        isPast: new Date(bookingData.startTime) < new Date(),
        canModify: ['pending', 'confirmed'].includes(bookingData.status) && 
                  new Date(bookingData.startTime) > new Date(),
        
        // Ensure frontend compatibility
        User: user,
        Offer: offer,
        Staff: staff,
        Payment: payment
      };
    });

    return res.json({
      success: true,
      bookings: formattedBookings,
      pagination: {
        total: bookings.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < bookings.count
      },
      summary: {
        total: bookings.count,
        pending: formattedBookings.filter(b => b.status === 'pending').length,
        confirmed: formattedBookings.filter(b => b.status === 'confirmed').length,
        in_progress: formattedBookings.filter(b => b.status === 'in_progress').length,
        completed: formattedBookings.filter(b => b.status === 'completed').length,
        cancelled: formattedBookings.filter(b => b.status === 'cancelled').length
      }
    });

  } catch (error) {
    console.error('Error fetching merchant offer bookings:', error);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Providing mock offer bookings for development');
      return res.json({
        success: true,
        bookings: generateMockOfferBookings(parseInt(req.query.limit) || 10),
        pagination: {
          total: 10,
          limit: parseInt(req.query.limit) || 10,
          offset: parseInt(req.query.offset) || 0,
          hasMore: false
        },
        message: 'Using mock data - database query failed',
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch offer bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get specific offer booking by ID
 * GET /api/v1/merchant/bookings/offers/:bookingId
 */
router.get('/offers/:bookingId', authenticateMerchant, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const merchantId = req.user.id;

    const booking = await Booking.findOne({
      where: {
        id: bookingId,
        offerId: { [Op.ne]: null },
        bookingType: 'offer'
      },
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Offer,
          as: 'Offer',
          required: true,
          attributes: ['id', 'title', 'description', 'discount', 'original_price', 'discounted_price'],
          include: [{
            model: Service,
            as: 'service',
            attributes: ['id', 'name', 'price', 'duration'],
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              attributes: ['id', 'name', 'location'],
              required: true
            }]
          }]
        },
        {
          model: Staff,
          as: 'Staff',
          required: false,
          attributes: ['id', 'name', 'email', 'phoneNumber', 'role', 'status']
        },
        {
          model: Payment,
          as: 'Payment',
          required: false,
          attributes: ['id', 'amount', 'status', 'method', 'transaction_id']
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Offer booking not found or not accessible'
      });
    }

    return res.json({
      success: true,
      booking: booking
    });

  } catch (error) {
    console.error('Error fetching offer booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch offer booking details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Update offer booking status
 * PUT /api/v1/merchant/bookings/offers/:bookingId/status
 */
router.put('/offers/:bookingId/status', authenticateMerchant, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, notes } = req.body;
    const merchantId = req.user.id;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided'
      });
    }

    // Find the booking and verify merchant ownership
    const booking = await Booking.findOne({
      where: {
        id: bookingId,
        offerId: { [Op.ne]: null },
        bookingType: 'offer'
      },
      include: [{
        model: Offer,
        as: 'Offer',
        required: true,
        include: [{
          model: Service,
          as: 'service',
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: true
          }]
        }]
      }]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Offer booking not found or not accessible'
      });
    }

    // Update the booking
    const updateData = { 
      status,
      updatedBy: merchantId
    };

    // Add timestamp fields based on status
    switch (status) {
      case 'confirmed':
        updateData.confirmedAt = new Date();
        updateData.confirmedBy = req.user.name || req.user.email;
        break;
      case 'in_progress':
        updateData.checked_in_at = new Date();
        updateData.service_started_at = new Date();
        updateData.checked_in_by = req.user.name || req.user.email;
        break;
      case 'completed':
        updateData.completedAt = new Date();
        updateData.completed_by = req.user.name || req.user.email;
        break;
      case 'cancelled':
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = notes || 'Cancelled by merchant';
        break;
    }

    // Add notes if provided
    if (notes) {
      updateData.merchantNotes = booking.merchantNotes 
        ? `${booking.merchantNotes}\n\n[${new Date().toISOString()}] ${notes}`
        : notes;
    }

    await booking.update(updateData);

    return res.json({
      success: true,
      message: `Offer booking ${status} successfully`,
      booking: booking
    });

  } catch (error) {
    console.error('Error updating offer booking status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update offer booking status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==========================================
// COMBINED MERCHANT BOOKING ROUTES
// ==========================================

/**
 * Get all bookings (both service and offer) for merchant
 * GET /api/v1/merchant/bookings/all
 */
router.get('/all', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user?.id;
    
    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: 'Merchant authentication required'
      });
    }

    const { 
      status, 
      limit = 50, 
      offset = 0, 
      startDate, 
      endDate,
      storeId,
      bookingType 
    } = req.query;

    console.log('Fetching all bookings for merchant:', merchantId);

    // Build where conditions
    const whereConditions = {};
    
    if (bookingType === 'service') {
      whereConditions.serviceId = { [Op.ne]: null };
      whereConditions.bookingType = 'service';
    } else if (bookingType === 'offer') {
      whereConditions.offerId = { [Op.ne]: null };
      whereConditions.bookingType = 'offer';
    } else {
      // Get both types
      whereConditions[Op.or] = [
        { serviceId: { [Op.ne]: null } },
        { offerId: { [Op.ne]: null } }
      ];
    }
    
    if (status) {
      whereConditions.status = status;
    }

    if (startDate) {
      whereConditions.startTime = { [Op.gte]: new Date(startDate) };
    }

    if (endDate) {
      whereConditions.startTime = {
        ...whereConditions.startTime,
        [Op.lte]: new Date(endDate)
      };
    }

    if (storeId) {
      whereConditions.storeId = storeId;
    }

    // Query bookings with merchant filtering
    const bookings = await Booking.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'],
          required: false
        },
        {
          model: Service,
          as: 'Service',
          required: false,
          attributes: ['id', 'name', 'price', 'duration'],
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            attributes: ['id', 'name', 'location'],
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          attributes: ['id', 'title', 'description', 'discount'],
          include: [{
            model: Service,
            as: 'service',
            attributes: ['id', 'name', 'price', 'duration'],
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              attributes: ['id', 'name', 'location'],
              required: false
            }]
          }]
        },
        {
          model: Staff,
          as: 'Staff',
          required: false,
          attributes: ['id', 'name', 'email', 'phoneNumber', 'role', 'status']
        },
        {
          model: Payment,
          as: 'Payment',
          required: false,
          attributes: ['id', 'amount', 'status', 'method']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Filter out bookings that don't belong to this merchant
    const merchantBookings = bookings.rows.filter(booking => {
      const serviceStore = booking.Service?.store;
      const offerStore = booking.Offer?.service?.store;
      return serviceStore || offerStore;
    });

    // Format response
    const formattedBookings = merchantBookings.map(booking => {
      const bookingData = booking.toJSON();
      
      const user = bookingData.User || bookingData.user;
      const service = bookingData.Service;
      const offer = bookingData.Offer;
      const staff = bookingData.Staff || bookingData.staff;
      const payment = bookingData.Payment || bookingData.payment;
      
      const isOfferBooking = !!bookingData.offerId;
      const actualService = isOfferBooking ? offer?.service : service;
      
      return {
        ...bookingData,
        customerName: user 
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
          : 'Unknown Customer',
        entityName: isOfferBooking ? offer?.title : service?.name,
        serviceName: actualService?.name || 'Unknown Service',
        storeName: actualService?.store?.name || 'Unknown Store',
        staffName: staff?.name || null,
        isOfferBooking,
        isServiceBooking: !isOfferBooking,
        accessFeePaid: !!payment,
        paymentAmount: payment?.amount || bookingData.accessFee || 0,
        isUpcoming: new Date(bookingData.startTime) > new Date(),
        isPast: new Date(bookingData.startTime) < new Date(),
        canModify: ['pending', 'confirmed'].includes(bookingData.status) && 
                  new Date(bookingData.startTime) > new Date(),
        
        // Ensure frontend compatibility
        User: user,
        Service: actualService,
        Offer: offer,
        Staff: staff,
        Payment: payment
      };
    });

    return res.json({
      success: true,
      bookings: formattedBookings,
      pagination: {
        total: formattedBookings.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < formattedBookings.length
      },
      summary: {
        total: formattedBookings.length,
        services: formattedBookings.filter(b => b.isServiceBooking).length,
        offers: formattedBookings.filter(b => b.isOfferBooking).length,
        pending: formattedBookings.filter(b => b.status === 'pending').length,
        confirmed: formattedBookings.filter(b => b.status === 'confirmed').length,
        in_progress: formattedBookings.filter(b => b.status === 'in_progress').length,
        completed: formattedBookings.filter(b => b.status === 'completed').length,
        cancelled: formattedBookings.filter(b => b.status === 'cancelled').length
      }
    });

  } catch (error) {
    console.error('Error fetching all merchant bookings:', error);
    
    if (process.env.NODE_ENV === 'development') {
      return res.json({
        success: true,
        bookings: generateMockCombinedBookings(parseInt(req.query.limit) || 10),
        pagination: {
          total: 10,
          limit: parseInt(req.query.limit) || 10,
          offset: parseInt(req.query.offset) || 0,
          hasMore: false
        },
        message: 'Using mock data - database query failed',
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch all bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get specific booking by ID (handles both service and offer)
 * GET /api/v1/merchant/bookings/view/:bookingId
 */
router.get('/view/:bookingId', authenticateMerchant, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const merchantId = req.user.id;

    const booking = await Booking.findOne({
      where: {
        id: bookingId
      },
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Service,
          as: 'Service',
          required: false,
          attributes: ['id', 'name', 'price', 'duration'],
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            attributes: ['id', 'name', 'location'],
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          attributes: ['id', 'title', 'description', 'discount', 'original_price', 'discounted_price'],
          include: [{
            model: Service,
            as: 'service',
            attributes: ['id', 'name', 'price', 'duration'],
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              attributes: ['id', 'name', 'location'],
              required: false
            }]
          }]
        },
        {
          model: Staff,
          as: 'Staff',
          required: false,
          attributes: ['id', 'name', 'email', 'phoneNumber', 'role', 'status']
        },
        {
          model: Payment,
          as: 'Payment',
          required: false,
          attributes: ['id', 'amount', 'status', 'method', 'transaction_id']
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not accessible'
      });
    }

    // Verify merchant has access to this booking
    const serviceStore = booking.Service?.store;
    const offerStore = booking.Offer?.service?.store;
    
    if (!serviceStore && !offerStore) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not accessible'
      });
    }

    return res.json({
      success: true,
      booking: booking
    });

  } catch (error) {
    console.error('Error fetching booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Update booking status (auto-detects service vs offer)
 * PUT /api/v1/merchant/bookings/:bookingId/status
 */
router.put('/:bookingId/status', authenticateMerchant, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, notes } = req.body;
    const merchantId = req.user.id;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided'
      });
    }

    // Find the booking and determine type
    const booking = await Booking.findOne({
      where: {
        id: bookingId
      },
      include: [
        {
          model: Service,
          as: 'Service',
          required: false,
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: false
            }]
          }]
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not accessible'
      });
    }

    // Verify merchant ownership
    const serviceStore = booking.Service?.store;
    const offerStore = booking.Offer?.service?.store;
    
    if (!serviceStore && !offerStore) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this booking'
      });
    }

    // Update the booking
    const updateData = { 
      status,
      updatedBy: merchantId
    };

    // Add timestamp fields based on status
    switch (status) {
      case 'confirmed':
        updateData.confirmedAt = new Date();
        updateData.confirmedBy = req.user.name || req.user.email;
        break;
      case 'in_progress':
        updateData.checked_in_at = new Date();
        updateData.service_started_at = new Date();
        updateData.checked_in_by = req.user.name || req.user.email;
        break;
      case 'completed':
        updateData.completedAt = new Date();
        updateData.completed_by = req.user.name || req.user.email;
        break;
      case 'cancelled':
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = notes || 'Cancelled by merchant';
        break;
    }

    // Add notes if provided
    if (notes) {
      updateData.merchantNotes = booking.merchantNotes 
        ? `${booking.merchantNotes}\n\n[${new Date().toISOString()}] ${notes}`
        : notes;
    }

    await booking.update(updateData);

    return res.json({
      success: true,
      message: `Booking ${status} successfully`,
      booking: booking
    });

  } catch (error) {
    console.error('Error updating booking status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Manual no-show endpoint
 * PUT /api/v1/merchant/bookings/:bookingId/no-show
 */
router.put('/:bookingId/no-show', authenticateMerchant, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const merchantId = req.user.id;

    const NoShowHandlerService = require('../services/noShowHandlerService');
    const noShowHandler = new NoShowHandlerService(require('../models'));

    const result = await noShowHandler.manualNoShow(bookingId, reason, merchantId);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Booking marked as no-show successfully',
        booking: result.booking
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.reason
      });
    }

  } catch (error) {
    console.error('Error marking booking as no-show:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark booking as no-show',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get no-show statistics
 * GET /api/v1/merchant/bookings/no-show/statistics
 */
router.get('/no-show/statistics', authenticateMerchant, async (req, res) => {
  try {
    const { period = '30d', storeId } = req.query;

    const NoShowHandlerService = require('../services/noShowHandlerService');
    const noShowHandler = new NoShowHandlerService(require('../models'));

    const result = await noShowHandler.getNoShowStatistics(storeId, period);

    return res.json(result);

  } catch (error) {
    console.error('Error getting no-show statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get no-show statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==========================================
// STORE-SPECIFIC BOOKING ROUTES
// ==========================================

/**
 * Get bookings for a specific store
 * GET /api/v1/merchant/bookings/store/:storeId
 */
router.get('/store/:storeId', authenticateMerchant, async (req, res) => {
  try {
    const { storeId } = req.params;
    const merchantId = req.user.id;
    const { 
      status, 
      limit = 50, 
      offset = 0, 
      startDate, 
      endDate,
      bookingType 
    } = req.query;

    // Verify store ownership
    const store = await Store.findOne({
      where: {
        id: storeId,
        merchant_id: merchantId
      }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or not accessible'
      });
    }

    const whereConditions = { 
      storeId: storeId
    };
    
    if (bookingType === 'service') {
      whereConditions.serviceId = { [Op.ne]: null };
    } else if (bookingType === 'offer') {
      whereConditions.offerId = { [Op.ne]: null };
    }
    
    if (status) {
      whereConditions.status = status;
    }

    if (startDate) {
      whereConditions.startTime = { [Op.gte]: new Date(startDate) };
    }

    if (endDate) {
      whereConditions.startTime = {
        ...whereConditions.startTime,
        [Op.lte]: new Date(endDate)
      };
    }

    const bookings = await Booking.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'],
          required: false
        },
        {
          model: Service,
          as: 'Service',
          required: false,
          attributes: ['id', 'name', 'price', 'duration']
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          attributes: ['id', 'title', 'description', 'discount']
        },
        {
          model: Staff,
          as: 'Staff',
          required: false,
          attributes: ['id', 'name', 'email', 'phoneNumber', 'role', 'status']
        },
        {
          model: Payment,
          as: 'Payment',
          required: false,
          attributes: ['id', 'amount', 'status', 'method']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.json({
      success: true,
      bookings: bookings.rows,
      store: store,
      pagination: {
        total: bookings.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < bookings.count
      }
    });

  } catch (error) {
    console.error('Error fetching store bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch store bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==========================================
// ANALYTICS AND SUMMARY ROUTES
// ==========================================

/**
 * Get booking analytics for merchant
 * GET /api/v1/merchant/bookings/analytics
 */
router.get('/analytics', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { timeRange = '7d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get all bookings for the merchant within the time range
    const bookings = await Booking.findAll({
      where: {
        createdAt: {
          [Op.gte]: startDate
        }
      },
      include: [
        {
          model: Service,
          as: 'Service',
          required: false,
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: false
            }]
          }]
        },
        {
          model: Payment,
          as: 'Payment',
          required: false
        }
      ]
    });

    // Filter bookings that belong to this merchant
    const merchantBookings = bookings.filter(booking => {
      const serviceStore = booking.Service?.store;
      const offerStore = booking.Offer?.service?.store;
      return serviceStore || offerStore;
    });

    // Calculate analytics
    const analytics = {
      timeRange,
      totalBookings: merchantBookings.length,
      serviceBookings: merchantBookings.filter(b => b.serviceId).length,
      offerBookings: merchantBookings.filter(b => b.offerId).length,
      confirmed: merchantBookings.filter(b => b.status === 'confirmed').length,
      completed: merchantBookings.filter(b => b.status === 'completed').length,
      pending: merchantBookings.filter(b => b.status === 'pending').length,
      cancelled: merchantBookings.filter(b => b.status === 'cancelled').length,
      revenue: merchantBookings
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => {
          const amount = parseFloat(b.Service?.price || b.Offer?.discounted_price || b.accessFee || 0);
          return sum + amount;
        }, 0),
      averageBookingValue: merchantBookings.length > 0 ? 
        merchantBookings.reduce((sum, b) => {
          const amount = parseFloat(b.Service?.price || b.Offer?.discounted_price || b.accessFee || 0);
          return sum + amount;
        }, 0) / merchantBookings.length : 0,
      completionRate: merchantBookings.length > 0 ? 
        (merchantBookings.filter(b => b.status === 'completed').length / merchantBookings.length) * 100 : 0
    };

    return res.json({
      success: true,
      analytics: analytics
    });

  } catch (error) {
    console.error('Error fetching booking analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch booking analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get today's booking summary
 * GET /api/v1/merchant/bookings/summary/today
 */
router.get('/summary/today', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const bookings = await Booking.findAll({
      where: {
        startTime: {
          [Op.gte]: startOfDay,
          [Op.lt]: endOfDay
        }
      },
      include: [
        {
          model: Service,
          as: 'Service',
          required: false,
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: false
            }]
          }]
        },
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    // Filter bookings that belong to this merchant
    const todayBookings = bookings.filter(booking => {
      const serviceStore = booking.Service?.store;
      const offerStore = booking.Offer?.service?.store;
      return serviceStore || offerStore;
    });

    const summary = {
      total: todayBookings.length,
      confirmed: todayBookings.filter(b => b.status === 'confirmed').length,
      in_progress: todayBookings.filter(b => b.status === 'in_progress').length,
      completed: todayBookings.filter(b => b.status === 'completed').length,
      cancelled: todayBookings.filter(b => b.status === 'cancelled').length,
      upcoming: todayBookings.filter(b => 
        new Date(b.startTime) > new Date() && ['confirmed', 'pending'].includes(b.status)
      ).length
    };

    return res.json({
      success: true,
      summary: summary,
      bookings: todayBookings
    });

  } catch (error) {
    console.error('Error fetching today booking summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch today booking summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==========================================
// SERVICE BOOKING ACTION ROUTES
// ==========================================

/**
 * Check in a service booking
 * PUT /api/v1/merchant/bookings/services/:bookingId/checkin
 */
router.put('/services/:bookingId/checkin', authenticateMerchant, serviceBookingController.checkInServiceBooking);

/**
 * Confirm a service booking
 * PUT /api/v1/merchant/bookings/services/:bookingId/confirm
 */
router.put('/services/:bookingId/confirm', authenticateMerchant, serviceBookingController.confirmServiceBooking);


/**
 * Complete a service booking
 * PUT /api/v1/merchant/bookings/services/:bookingId/complete
 */
router.put('/services/:bookingId/complete', authenticateMerchant, serviceBookingController.completeServiceBooking);

/**
 * Cancel a service booking
 * PUT /api/v1/merchant/bookings/services/:bookingId/cancel
 */
router.put('/services/:bookingId/cancel', authenticateMerchant, serviceBookingController.cancelServiceBooking);

/**
 * Update service booking status (generic)
 * PUT /api/v1/merchant/bookings/services/:bookingId/status
 */
router.put('/services/:bookingId/status', authenticateMerchant, serviceBookingController.updateServiceBookingStatus);

// ==========================================
// BULK OPERATIONS FOR SERVICE BOOKINGS
// ==========================================

/**
 * Bulk update service booking statuses
 * PUT /api/v1/merchant/bookings/services/bulk-status
 */
router.put('/services/bulk-status', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { bookingIds, status, notes } = req.body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Booking IDs array is required'
      });
    }

    if (bookingIds.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update more than 50 bookings at once'
      });
    }

    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided',
        validStatuses
      });
    }

    // Find all bookings and verify merchant ownership
    const bookings = await Booking.findAll({
      where: {
        id: { [Op.in]: bookingIds },
        serviceId: { [Op.ne]: null },
        bookingType: 'service'
      },
      include: [{
        model: Service,
        as: 'service',
        required: true,
        include: [{
          model: Store,
          as: 'store',
          where: {
            merchant_id: merchantId
          },
          required: true
        }]
      }]
    });

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No accessible service bookings found with the provided IDs'
      });
    }

    // Update all bookings
    const updateData = { 
      status,
      updatedBy: merchantId
    };

    // Add timestamp fields based on status
    switch (status) {
      case 'confirmed':
        updateData.confirmedAt = new Date();
        updateData.confirmed_at = new Date();
        updateData.confirmed_by = req.user.name || req.user.email || 'Merchant';
        updateData.manually_confirmed = true;
        break;
      case 'in_progress':
        updateData.checked_in_at = new Date();
        updateData.service_started_at = new Date();
        updateData.checked_in_by = req.user.name || req.user.email || 'Merchant';
        break;
      case 'completed':
        updateData.completedAt = new Date();
        updateData.completed_by = req.user.name || req.user.email || 'Merchant';
        break;
      case 'cancelled':
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = notes || 'Bulk cancelled by merchant';
        break;
      case 'no_show':
        updateData.no_show_reason = notes || 'Customer did not arrive';
        break;
    }

    // Add notes if provided
    if (notes) {
      updateData.merchantNotes = notes;
    }

    const updatePromises = bookings.map(booking => booking.update(updateData));
    await Promise.all(updatePromises);

    return res.json({
      success: true,
      message: `Successfully updated ${bookings.length} service bookings to ${status}`,
      results: {
        updated: bookings.length,
        requested: bookingIds.length,
        skipped: bookingIds.length - bookings.length
      }
    });

  } catch (error) {
    console.error('Error bulk updating service booking statuses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk update service booking statuses',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Bulk check-in service bookings
 * PUT /api/v1/merchant/bookings/services/bulk-checkin
 */
router.put('/services/bulk-checkin', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { bookingIds, notes } = req.body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Booking IDs array is required'
      });
    }

    // Find confirmed bookings only
    const bookings = await Booking.findAll({
      where: {
        id: { [Op.in]: bookingIds },
        serviceId: { [Op.ne]: null },
        status: 'confirmed',
        checked_in_at: null
      },
      include: [{
        model: Service,
        as: 'service',
        required: true,
        include: [{
          model: Store,
          as: 'store',
          where: {
            merchant_id: merchantId
          },
          required: true
        }]
      }]
    });

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No eligible service bookings found for check-in'
      });
    }

    const updateData = {
      status: 'in_progress',
      checked_in_at: new Date(),
      service_started_at: new Date(),
      checked_in_by: req.user.name || req.user.email || 'Merchant',
      checkin_notes: notes || 'Bulk check-in',
      updatedBy: merchantId
    };

    const updatePromises = bookings.map(booking => booking.update(updateData));
    await Promise.all(updatePromises);

    return res.json({
      success: true,
      message: `Successfully checked in ${bookings.length} service bookings`,
      results: {
        checked_in: bookings.length,
        requested: bookingIds.length,
        skipped: bookingIds.length - bookings.length
      }
    });

  } catch (error) {
    console.error('Error bulk checking in service bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk check-in service bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==========================================
// MERCHANT LISTING AND FILTERING ROUTES
// ==========================================

/**
 * Get merchant's service bookings for a specific store
 * GET /api/v1/merchant/bookings/stores/:storeId/services
 */
router.get('/stores/:storeId/services', authenticateMerchant, serviceBookingController.getMerchantStoreBookings);

/**
 * Get all merchant's service bookings across all stores
 * GET /api/v1/merchant/bookings/services
 */
router.get('/services', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { status, limit = 50, offset = 0, startDate, endDate, storeId, serviceId } = req.query;
    
    const whereConditions = { 
      serviceId: { [Op.ne]: null },
      bookingType: 'service'
    };
    
    if (status) {
      whereConditions.status = status;
    }

    if (startDate) {
      whereConditions.startTime = { [Op.gte]: new Date(startDate) };
    }

    if (endDate) {
      whereConditions.startTime = {
        ...whereConditions.startTime,
        [Op.lte]: new Date(endDate)
      };
    }

    if (storeId) {
      whereConditions.storeId = storeId;
    }

    if (serviceId) {
      whereConditions.serviceId = serviceId;
    }

    const bookings = await Booking.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Service,
          as: 'Service',
          required: true,
          attributes: ['id', 'name', 'price', 'duration'],
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: true,
            attributes: ['id', 'name', 'location']
          }]
        },
        {
          model: Staff,
          as: 'Staff',
          required: false,
          attributes: ['id', 'name', 'email', 'phoneNumber', 'role', 'status']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.json({
      success: true,
      bookings: bookings.rows,
      pagination: {
        total: bookings.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Error getting merchant service bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch merchant service bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get service booking analytics for merchant
 * GET /api/v1/merchant/bookings/services/analytics
 */
router.get('/services/analytics', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { period = '30', storeId } = req.query; // days
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    
    const baseWhere = {
      serviceId: { [Op.ne]: null },
      bookingType: 'service',
      createdAt: { [Op.gte]: startDate }
    };

    const includeCondition = {
      model: Service,
      as: 'service',
      required: true,
      include: [{
        model: Store,
        as: 'store',
        where: {
          merchant_id: merchantId,
          ...(storeId && { id: storeId })
        },
        required: true
      }]
    };

    // Get booking counts by status
    const statusCounts = await Booking.findAll({
      where: baseWhere,
      include: [includeCondition],
      attributes: [
        'status',
        [models.sequelize.fn('COUNT', models.sequelize.col('Booking.id')), 'count']
      ],
      group: ['status']
    });

    // Get revenue data (assuming you want to calculate potential revenue)
    const revenueData = await Booking.findAll({
      where: {
        ...baseWhere,
        status: { [Op.in]: ['completed', 'confirmed', 'in_progress'] }
      },
      include: [
        {
          ...includeCondition,
          attributes: ['price']
        }
      ],
      attributes: [
        [models.sequelize.fn('SUM', models.sequelize.col('service.price')), 'total_revenue'],
        [models.sequelize.fn('COUNT', models.sequelize.col('Booking.id')), 'completed_bookings']
      ]
    });

    // Get daily booking trends
    const dailyTrends = await Booking.findAll({
      where: baseWhere,
      include: [includeCondition],
      attributes: [
        [models.sequelize.fn('DATE', models.sequelize.col('Booking.createdAt')), 'date'],
        [models.sequelize.fn('COUNT', models.sequelize.col('Booking.id')), 'bookings'],
        'status'
      ],
      group: [
        models.sequelize.fn('DATE', models.sequelize.col('Booking.createdAt')),
        'status'
      ],
      order: [[models.sequelize.fn('DATE', models.sequelize.col('Booking.createdAt')), 'ASC']]
    });

    // Get popular services
    const popularServices = await Booking.findAll({
      where: baseWhere,
      include: [
        {
          ...includeCondition,
          attributes: ['id', 'name', 'price']
        }
      ],
      attributes: [
        'serviceId',
        [models.sequelize.fn('COUNT', models.sequelize.col('Booking.id')), 'booking_count']
      ],
      group: ['serviceId', 'service.id', 'service.name', 'service.price'],
      order: [[models.sequelize.fn('COUNT', models.sequelize.col('Booking.id')), 'DESC']],
      limit: 10
    });

    return res.json({
      success: true,
      analytics: {
        period_days: parseInt(period),
        status_breakdown: statusCounts.reduce((acc, item) => {
          acc[item.status] = parseInt(item.get('count'));
          return acc;
        }, {}),
        revenue: {
          total: parseFloat(revenueData[0]?.get('total_revenue') || 0),
          completed_bookings: parseInt(revenueData[0]?.get('completed_bookings') || 0)
        },
        daily_trends: dailyTrends,
        popular_services: popularServices.map(service => ({
          service_id: service.serviceId,
          service_name: service.service.name,
          service_price: service.service.price,
          booking_count: parseInt(service.get('booking_count'))
        }))
      }
    });

  } catch (error) {
    console.error('Error getting service booking analytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch service booking analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==========================================
// QUICK ACTION ENDPOINTS (Alternative shorter routes)
// ==========================================

/**
 * Quick check-in endpoint
 * POST /api/v1/merchant/bookings/:bookingId/checkin
 */
router.post('/:bookingId/checkin', authenticateMerchant, async (req, res) => {
  // Route to service-specific endpoint
  req.params.bookingId = req.params.bookingId;
  return serviceBookingController.checkInServiceBooking(req, res);
});

/**
 * Quick confirm endpoint
 * POST /api/v1/merchant/bookings/:bookingId/confirm
 */
router.post('/:bookingId/confirm', authenticateMerchant, async (req, res) => {
  // Route to service-specific endpoint
  req.params.bookingId = req.params.bookingId;
  return serviceBookingController.confirmServiceBooking(req, res);
});

/**
 * Quick complete endpoint
 * POST /api/v1/merchant/bookings/:bookingId/complete
 */
router.post('/:bookingId/complete', authenticateMerchant, async (req, res) => {
  // Route to service-specific endpoint
  req.params.bookingId = req.params.bookingId;
  return serviceBookingController.completeServiceBooking(req, res);
});

/**
 * Quick cancel endpoint
 * POST /api/v1/merchant/bookings/:bookingId/cancel
 */
router.post('/:bookingId/cancel', authenticateMerchant, async (req, res) => {
  // Route to service-specific endpoint
  req.params.bookingId = req.params.bookingId;
  return serviceBookingController.cancelServiceBooking(req, res);
});

// ==========================================
// BOOKING DETAILS AND MANAGEMENT
// ==========================================

/**
 * Get specific service booking details for merchant
 * GET /api/v1/merchant/bookings/services/:bookingId
 */
router.get('/services/:bookingId', authenticateMerchant, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const merchantId = req.user.id;
    
    const booking = await Booking.findOne({
      where: {
        id: bookingId,
        serviceId: { [Op.ne]: null },
        bookingType: 'service'
      },
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Service,
          as: 'Service',
          required: true,
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: true
          }]
        },
        {
          model: Staff,
          as: 'Staff',
          required: false,
          attributes: ['id', 'name', 'email', 'phoneNumber', 'role']
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Service booking not found or not accessible'
      });
    }

    return res.json({
      success: true,
      booking
    });

  } catch (error) {
    console.error('Error getting service booking details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch service booking details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Add notes to a service booking
 * PUT /api/v1/merchant/bookings/services/:bookingId/notes
 */
router.put('/services/:bookingId/notes', authenticateMerchant, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { notes } = req.body;
    const merchantId = req.user.id;

    if (!notes || notes.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Notes content is required'
      });
    }

    const booking = await Booking.findOne({
      where: {
        id: bookingId,
        serviceId: { [Op.ne]: null },
        bookingType: 'service'
      },
      include: [{
        model: Service,
        as: 'service',
        required: true,
        include: [{
          model: Store,
          as: 'store',
          where: {
            merchant_id: merchantId
          },
          required: true
        }]
      }]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Service booking not found or not accessible'
      });
    }

    const timestamp = new Date().toISOString();
    const merchantName = req.user.name || req.user.email || 'Merchant';
    const newNote = `[${timestamp}] ${merchantName}: ${notes}`;
    
    const updatedNotes = booking.merchantNotes 
      ? `${booking.merchantNotes}\n\n${newNote}`
      : newNote;

    await booking.update({
      merchantNotes: updatedNotes,
      updatedBy: merchantId
    });

    return res.json({
      success: true,
      message: 'Notes added successfully',
      booking: {
        id: booking.id,
        merchantNotes: updatedNotes
      }
    });

  } catch (error) {
    console.error('Error adding notes to service booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add notes to service booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get upcoming bookings
 * GET /api/v1/merchant/bookings/upcoming
 */
router.get('/upcoming', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { hours = 24 } = req.query;
    
    const now = new Date();
    const futureTime = new Date(now.getTime() + parseInt(hours) * 60 * 60 * 1000);

    const bookings = await Booking.findAll({
      where: {
        startTime: {
          [Op.gte]: now,
          [Op.lte]: futureTime
        },
        status: {
          [Op.in]: ['confirmed', 'pending']
        }
      },
      include: [
        {
          model: Service,
          as: 'Service',
          required: false,
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: false
            }]
          }]
        },
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Staff,
          as: 'Staff',
          attributes: ['id', 'name']
        }
      ],
      order: [['startTime', 'ASC']]
    });

    // Filter bookings that belong to this merchant
    const upcomingBookings = bookings.filter(booking => {
      const serviceStore = booking.Service?.store;
      const offerStore = booking.Offer?.service?.store;
      return serviceStore || offerStore;
    });

    return res.json({
      success: true,
      bookings: upcomingBookings,
      count: upcomingBookings.length,
      timeframe: `Next ${hours} hours`
    });

  } catch (error) {
    console.error('Error fetching upcoming bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==========================================
// SEARCH AND FILTER ROUTES
// ==========================================

/**
 * Search bookings
 * GET /api/v1/merchant/bookings/search
 */
router.get('/search', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { q, limit = 50, offset = 0 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchTerm = q.trim().toLowerCase();

    // Search in bookings
    const bookings = await Booking.findAndCountAll({
      include: [
        {
          model: User,
          as: 'User',
          where: {
            [Op.or]: [
              { firstName: { [Op.iLike]: `%${searchTerm}%` } },
              { lastName: { [Op.iLike]: `%${searchTerm}%` } },
              { email: { [Op.iLike]: `%${searchTerm}%` } }
            ]
          },
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'],
          required: false
        },
        {
          model: Service,
          as: 'Service',
          required: false,
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: false
            }]
          }]
        }
      ],
      where: {
        [Op.or]: [
          { id: { [Op.iLike]: `%${searchTerm}%` } },
          { notes: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Filter bookings that belong to this merchant
    const merchantBookings = bookings.rows.filter(booking => {
      const serviceStore = booking.Service?.store;
      const offerStore = booking.Offer?.service?.store;
      return serviceStore || offerStore;
    });

    return res.json({
      success: true,
      bookings: merchantBookings,
      totalResults: merchantBookings.length,
      query: q
    });

  } catch (error) {
    console.error('Error searching bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Filter bookings with advanced criteria
 * GET /api/v1/merchant/bookings/filter
 */
router.get('/filter', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { 
      status,
      bookingType,
      startDate,
      endDate,
      serviceId,
      staffId,
      storeId,
      limit = 50,
      offset = 0
    } = req.query;

    const whereConditions = {};
    
    if (status) {
      whereConditions.status = status;
    }
    
    if (bookingType === 'service') {
      whereConditions.serviceId = { [Op.ne]: null };
    } else if (bookingType === 'offer') {
      whereConditions.offerId = { [Op.ne]: null };
    }
    
    if (startDate) {
      whereConditions.startTime = { [Op.gte]: new Date(startDate) };
    }
    
    if (endDate) {
      whereConditions.startTime = {
        ...whereConditions.startTime,
        [Op.lte]: new Date(endDate)
      };
    }
    
    if (serviceId) {
      whereConditions.serviceId = serviceId;
    }
    
    if (staffId) {
      whereConditions.staffId = staffId;
    }
    
    if (storeId) {
      whereConditions.storeId = storeId;
    }

    const bookings = await Booking.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Service,
          as: 'Service',
          required: false,
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: false
            }]
          }]
        },
        {
          model: Staff,
          as: 'Staff',
          attributes: ['id', 'name']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    // Filter bookings that belong to this merchant
    const merchantBookings = bookings.rows.filter(booking => {
      const serviceStore = booking.Service?.store;
      const offerStore = booking.Offer?.service?.store;
      return serviceStore || offerStore;
    });

    return res.json({
      success: true,
      bookings: merchantBookings,
      totalResults: merchantBookings.length,
      filters: req.query
    });

  } catch (error) {
    console.error('Error filtering bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to filter bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==========================================
// BULK OPERATIONS
// ==========================================

/**
 * Bulk update booking statuses
 * PUT /api/v1/merchant/bookings/bulk-status
 */
router.put('/bulk-status', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { bookingIds, status, notes } = req.body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Booking IDs array is required'
      });
    }

    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided'
      });
    }

    // Find all bookings and verify merchant ownership
    const bookings = await Booking.findAll({
      where: {
        id: { [Op.in]: bookingIds }
      },
      include: [
        {
          model: Service,
          as: 'Service',
          required: false,
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: false
            }]
          }]
        }
      ]
    });

    // Filter bookings that belong to this merchant
    const merchantBookings = bookings.filter(booking => {
      const serviceStore = booking.Service?.store;
      const offerStore = booking.Offer?.service?.store;
      return serviceStore || offerStore;
    });

    if (merchantBookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No accessible bookings found with the provided IDs'
      });
    }

    // Update all bookings
    const updateData = { 
      status,
      updatedBy: merchantId
    };

    // Add timestamp fields based on status
    switch (status) {
      case 'confirmed':
        updateData.confirmedAt = new Date();
        updateData.confirmedBy = req.user.name || req.user.email;
        break;
      case 'in_progress':
        updateData.checked_in_at = new Date();
        updateData.service_started_at = new Date();
        updateData.checked_in_by = req.user.name || req.user.email;
        break;
      case 'completed':
        updateData.completedAt = new Date();
        updateData.completed_by = req.user.name || req.user.email;
        break;
      case 'cancelled':
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = notes || 'Bulk cancelled by merchant';
        break;
    }

    // Add notes if provided
    if (notes) {
      updateData.merchantNotes = notes;
    }

    const updatePromises = merchantBookings.map(booking => booking.update(updateData));
    await Promise.all(updatePromises);

    return res.json({
      success: true,
      message: `Successfully updated ${merchantBookings.length} bookings to ${status}`,
      results: {
        updated: merchantBookings.length,
        requested: bookingIds.length,
        skipped: bookingIds.length - merchantBookings.length
      }
    });

  } catch (error) {
    console.error('Error bulk updating booking statuses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk update booking statuses',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Export booking data
 * POST /api/v1/merchant/bookings/export
 */
router.post('/export', authenticateMerchant, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { filters = {}, format = 'csv' } = req.body;

    // Build where conditions from filters
    const whereConditions = {};
    
    if (filters.status) {
      whereConditions.status = filters.status;
    }
    
    if (filters.bookingType === 'service') {
      whereConditions.serviceId = { [Op.ne]: null };
    } else if (filters.bookingType === 'offer') {
      whereConditions.offerId = { [Op.ne]: null };
    }
    
    if (filters.startDate) {
      whereConditions.startTime = { [Op.gte]: new Date(filters.startDate) };
    }
    
    if (filters.endDate) {
      whereConditions.startTime = {
        ...whereConditions.startTime,
        [Op.lte]: new Date(filters.endDate)
      };
    }

    // Get all bookings for export
    const bookings = await Booking.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Service,
          as: 'Service',
          required: false,
          attributes: ['id', 'name', 'price', 'duration'],
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            attributes: ['id', 'name'],
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          attributes: ['id', 'title', 'discount', 'discounted_price'],
          include: [{
            model: Service,
            as: 'service',
            attributes: ['id', 'name'],
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              attributes: ['id', 'name'],
              required: false
            }]
          }]
        },
        {
          model: Staff,
          as: 'Staff',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Filter bookings that belong to this merchant
    const merchantBookings = bookings.filter(booking => {
      const serviceStore = booking.Service?.store;
      const offerStore = booking.Offer?.service?.store;
      return serviceStore || offerStore;
    });

    if (format === 'csv') {
      const headers = [
        'ID', 'Type', 'Customer Name', 'Customer Email', 'Customer Phone',
        'Service/Offer', 'Date', 'Time', 'Status', 'Duration', 'Price', 
        'Staff', 'Store', 'Notes', 'Created At'
      ];

      const rows = merchantBookings.map(booking => [
        booking.id,
        booking.serviceId ? 'Service' : 'Offer',
        `${booking.User?.firstName || ''} ${booking.User?.lastName || ''}`.trim(),
        booking.User?.email || '',
        booking.User?.phoneNumber || '',
        booking.Service?.name || booking.Offer?.title || '',
        new Date(booking.startTime).toLocaleDateString(),
        new Date(booking.startTime).toLocaleTimeString(),
        booking.status,
        booking.Service?.duration || '90',
        booking.Service?.price || booking.Offer?.discounted_price || '0',
        booking.Staff?.name || '',
        booking.Service?.store?.name || booking.Offer?.service?.store?.name || '',
        booking.notes || '',
        new Date(booking.createdAt).toLocaleDateString()
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(field => `"${field || ''}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="bookings-export-${new Date().toISOString().split('T')[0]}.csv"`);
      
      return res.send(csvContent);
    }

    return res.status(400).json({
      success: false,
      message: 'Only CSV format is currently supported'
    });

  } catch (error) {
    console.error('Error exporting booking data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export booking data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==========================================
// NOTIFICATION ROUTES
// ==========================================

/**
 * Send booking confirmation to customer
 * POST /api/v1/merchant/bookings/:bookingId/send-confirmation
 */
router.post('/:bookingId/send-confirmation', authenticateMerchant, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const merchantId = req.user.id;

    const booking = await Booking.findOne({
      where: {
        id: bookingId
      },
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Service,
          as: 'Service',
          required: false,
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: false
            }]
          }]
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not accessible'
      });
    }

    // Verify merchant ownership
    const serviceStore = booking.Service?.store;
    const offerStore = booking.Offer?.service?.store;
    
    if (!serviceStore && !offerStore) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send confirmation for this booking'
      });
    }

    // TODO: Implement actual email sending logic here
    // For now, just simulate sending
    console.log(`Sending confirmation email to ${booking.User?.email} for booking ${bookingId}`);

    return res.json({
      success: true,
      message: 'Booking confirmation sent successfully',
      recipientEmail: booking.User?.email
    });

  } catch (error) {
    console.error('Error sending booking confirmation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send booking confirmation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Send booking reminder to customer
 * POST /api/v1/merchant/bookings/:bookingId/send-reminder
 */
router.post('/:bookingId/send-reminder', authenticateMerchant, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reminderType = 'default' } = req.body;
    const merchantId = req.user.id;

    const booking = await Booking.findOne({
      where: {
        id: bookingId
      },
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Service,
          as: 'Service',
          required: false,
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: false
          }]
        },
        {
          model: Offer,
          as: 'Offer',
          required: false,
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: false
            }]
          }]
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not accessible'
      });
    }

    // Verify merchant ownership
    const serviceStore = booking.Service?.store;
    const offerStore = booking.Offer?.service?.store;
    
    if (!serviceStore && !offerStore) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send reminder for this booking'
      });
    }

    // TODO: Implement actual email/SMS reminder logic here
    console.log(`Sending ${reminderType} reminder to ${booking.User?.email} for booking ${bookingId}`);

    return res.json({
      success: true,
      message: 'Booking reminder sent successfully',
      reminderType: reminderType,
      recipientEmail: booking.User?.email
    });

  } catch (error) {
    console.error('Error sending booking reminder:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send booking reminder',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==========================================
// MOCK DATA GENERATORS FOR DEVELOPMENT
// ==========================================

function generateMockServiceBookings(limit = 10) {
  const mockBookings = [];
  const statuses = ['confirmed', 'pending', 'completed', 'in_progress', 'cancelled'];
  const services = [
    { id: 1, name: 'Hair Cut & Styling', duration: 60, price: 2500 },
    { id: 2, name: 'Massage Therapy', duration: 90, price: 4500 },
    { id: 3, name: 'Facial Treatment', duration: 75, price: 3500 }
  ];
  const customers = [
    { firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', phoneNumber: '+254712345678' },
    { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com', phoneNumber: '+254723456789' }
  ];

  for (let i = 0; i < limit; i++) {
    const service = services[i % services.length];
    const customer = customers[i % customers.length];
    const status = statuses[i % statuses.length];
    
    const now = new Date();
    const randomDays = (Math.random() - 0.5) * 60;
    const bookingDate = new Date(now.getTime() + randomDays * 24 * 60 * 60 * 1000);
    
    mockBookings.push({
      id: 1000 + i,
      serviceId: service.id,
      userId: 100 + i,
      startTime: bookingDate.toISOString(),
      endTime: new Date(bookingDate.getTime() + service.duration * 60 * 1000).toISOString(),
      status: status,
      bookingType: 'service',
      createdAt: new Date(bookingDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      User: {
        id: 100 + i,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phoneNumber: customer.phoneNumber
      },
      Service: {
        id: service.id,
        name: service.name,
        duration: service.duration,
        price: service.price
      },
      customerName: `${customer.firstName} ${customer.lastName}`,
      serviceName: service.name,
      isUpcoming: bookingDate > now,
      isPast: bookingDate < now,
      canModify: ['pending', 'confirmed'].includes(status) && bookingDate > now
    });
  }

  return mockBookings;
}

function generateMockOfferBookings(limit = 10) {
  const mockBookings = [];
  const statuses = ['confirmed', 'pending', 'completed', 'in_progress', 'cancelled'];
  const offers = [
    { id: 1, title: '50% Off Hair Styling', discount: 50, discounted_price: 1250 },
    { id: 2, title: '30% Off Massage Package', discount: 30, discounted_price: 3150 }
  ];
  const customers = [
    { firstName: 'Alice', lastName: 'Brown', email: 'alice.brown@example.com', phoneNumber: '+254756789012' },
    { firstName: 'Bob', lastName: 'Davis', email: 'bob.davis@example.com', phoneNumber: '+254767890123' }
  ];

  for (let i = 0; i < limit; i++) {
    const offer = offers[i % offers.length];
    const customer = customers[i % customers.length];
    const status = statuses[i % statuses.length];
    
    const now = new Date();
    const randomDays = (Math.random() - 0.5) * 60;
    const bookingDate = new Date(now.getTime() + randomDays * 24 * 60 * 60 * 1000);
    
    mockBookings.push({
      id: 2000 + i,
      offerId: offer.id,
      userId: 200 + i,
      startTime: bookingDate.toISOString(),
      endTime: new Date(bookingDate.getTime() + 90 * 60 * 1000).toISOString(),
      status: status,
      bookingType: 'offer',
      accessFee: Math.round(offer.discounted_price * 0.1),
      createdAt: new Date(bookingDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      User: {
        id: 200 + i,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phoneNumber: customer.phoneNumber
      },
      Offer: {
        id: offer.id,
        title: offer.title,
        discount: offer.discount,
        discounted_price: offer.discounted_price
      },
      customerName: `${customer.firstName} ${customer.lastName}`,
      offerTitle: offer.title,
      isUpcoming: bookingDate > now,
      isPast: bookingDate < now,
      canModify: ['pending', 'confirmed'].includes(status) && bookingDate > now,
      accessFeePaid: ['confirmed', 'in_progress', 'completed'].includes(status)
    });
  }

  return mockBookings;
}

function generateMockCombinedBookings(limit = 10) {
  const serviceLimit = Math.ceil(limit / 2);
  const offerLimit = Math.floor(limit / 2);
  
  const serviceBookings = generateMockServiceBookings(serviceLimit);
  const offerBookings = generateMockOfferBookings(offerLimit);
  
  return [
    ...serviceBookings,
    ...offerBookings
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = router;// routes/merchantBookingRoutes.js - Complete merchant booking management routes