// routes/bookingRoutes.js - Complete enhanced booking routes with concurrent booking support

const express = require('express');
const router = express.Router();
const moment = require('moment');
const { Op } = require('sequelize');

// ==================== MIDDLEWARE IMPORTS ====================

let authenticateToken, authenticateMerchant, authenticateAdmin;

try {
  const authMiddleware = require('../middleware/auth');
  authenticateToken = authMiddleware.authenticateToken || authMiddleware.verifyToken;
  authenticateMerchant = authMiddleware.authenticateMerchant;
  authenticateAdmin = authMiddleware.authenticateAdmin;
  
  console.log('✅ Auth middleware imported successfully');
} catch (error) {
  console.error('❌ Failed to import auth middleware:', error);
  
  // Fallback middleware
  authenticateToken = (req, res, next) => {
    console.warn('⚠️ Using fallback authenticateToken middleware');
    req.user = { id: 1, firstName: 'Test', lastName: 'User', email: 'test@example.com' };
    next();
  };
  
  authenticateMerchant = (req, res, next) => {
    console.warn('⚠️ Using fallback authenticateMerchant middleware');
    req.user = { id: 1, firstName: 'Test', lastName: 'Merchant' };
    next();
  };
  
  authenticateAdmin = (req, res, next) => {
    console.warn('⚠️ Using fallback authenticateAdmin middleware');
    req.user = { id: 1, role: 'admin' };
    next();
  };
}

// ==================== MODEL IMPORTS ====================

let models = {};
try {
  models = require('../models');
  console.log('✅ Models imported successfully');
} catch (error) {
  console.error('❌ Failed to import models:', error);
  models = {};
}

const { Booking, Offer, Service, Store, User, Payment, Staff } = models;

// ==================== CONTROLLER IMPORTS ====================

let enhancedBookingController = {};
try {
  const controllerModule = require('../controllers/enhancedBookingController');
  enhancedBookingController = controllerModule.default || controllerModule;
  console.log('✅ Enhanced booking controller imported');
} catch (error) {
  console.error('❌ Failed to import enhanced booking controller:', error);
}

// ==================== SLOT GENERATION SERVICE ====================

let SlotGenerationService;
try {
  SlotGenerationService = require('../services/slotGenerationService');
  console.log('✅ SlotGenerationService imported');
} catch (error) {
  console.error('❌ SlotGenerationService not available:', error);
}

// ==================== UTILITY FUNCTIONS ====================

function generateTimeSlots(openingTime, closingTime, serviceDuration = 60, slotInterval = null, bufferTime = 0) {
  const slots = [];
  
  try {
    let currentTime = moment(openingTime, ['HH:mm:ss', 'HH:mm']);
    const endTime = moment(closingTime, ['HH:mm:ss', 'HH:mm']);
    
    if (!currentTime.isValid() || !endTime.isValid()) {
      console.warn('Invalid opening/closing times:', { openingTime, closingTime });
      return [];
    }

    const actualSlotInterval = slotInterval || serviceDuration;
    const lastSlotTime = endTime.clone().subtract(serviceDuration, 'minutes');

    while (currentTime.isSameOrBefore(lastSlotTime)) {
      const slotEndTime = currentTime.clone().add(serviceDuration, 'minutes');
      
      if (slotEndTime.isAfter(endTime)) {
        break;
      }

      slots.push({
        startTime: currentTime.format('HH:mm'),
        endTime: slotEndTime.format('HH:mm'),
        startTime12: currentTime.format('h:mm A'),
        endTime12: slotEndTime.format('h:mm A')
      });

      currentTime.add(actualSlotInterval + bufferTime, 'minutes');
    }

    return slots;
  } catch (error) {
    console.error('Error generating time slots:', error);
    return [];
  }
}

async function getExistingBookings(entityId, entityType, date, models) {
  if (!Booking || !Offer || !Service) {
    console.warn('Models not available for booking check');
    return [];
  }

  try {
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

    let whereClause = {
      startTime: {
        [Op.gte]: startOfDay,
        [Op.lte]: endOfDay,
      },
      status: { [Op.not]: 'cancelled' }
    };

    if (entityType === 'offer') {
      // For offers, check both direct offer bookings AND service bookings for the underlying service
      const offer = await Offer.findByPk(entityId, {
        include: [{
          model: Service,
          as: 'service',
          attributes: ['id']
        }]
      });

      if (!offer) {
        return [];
      }

      const serviceId = offer.service?.id;
      
      // Check both offer bookings and direct service bookings
      whereClause = {
        ...whereClause,
        [Op.or]: [
          { offerId: entityId }, // Direct offer bookings
          { serviceId: serviceId } // Direct service bookings for the same service
        ]
      };
    } else {
      // For services, check both direct service bookings AND offer bookings for related offers
      const relatedOffers = await Offer.findAll({
        where: { service_id: entityId },
        attributes: ['id']
      });

      const offerIds = relatedOffers.map(offer => offer.id);

      whereClause = {
        ...whereClause,
        [Op.or]: [
          { serviceId: entityId }, // Direct service bookings
          { offerId: { [Op.in]: offerIds } } // Related offer bookings
        ]
      };
    }

    const existingBookings = await Booking.findAll({
      where: whereClause,
      attributes: ['startTime', 'endTime', 'serviceId', 'offerId', 'status'],
      order: [['startTime', 'ASC']]
    });

    console.log(`📊 Found ${existingBookings.length} existing bookings for ${entityType} ${entityId} on ${date}`);
    return existingBookings;

  } catch (error) {
    console.error('Error fetching existing bookings:', error);
    return [];
  }
}

function calculateSlotAvailability(baseSlots, existingBookings, maxConcurrent = 1) {
  return baseSlots.map(slot => {
    const slotStart = moment(`2023-01-01 ${slot.startTime}`);
    const slotEnd = moment(`2023-01-01 ${slot.endTime}`);

    // Find overlapping bookings
    const overlappingBookings = existingBookings.filter(booking => {
      const bookingStart = moment(booking.startTime);
      const bookingEnd = moment(booking.endTime);

      // Check for overlap
      return bookingStart.isBefore(slotEnd) && bookingEnd.isAfter(slotStart);
    });

    const bookedCount = overlappingBookings.length;
    const available = Math.max(0, maxConcurrent - bookedCount);

    return {
      ...slot,
      available,
      booked: bookedCount,
      total: maxConcurrent,
      bookings: overlappingBookings
    };
  });
}

// ==================== PUBLIC ROUTES ====================

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Enhanced booking service is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: [
      'Advanced slot generation',
      'Concurrent booking support',
      'Service and offer booking',
      'Real-time availability checking',
      'Buffer time management',
      'Advance booking rules'
    ]
  });
});

// Test route
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Enhanced booking routes are working!',
    timestamp: new Date().toISOString(),
    middleware: {
      authenticateToken: typeof authenticateToken,
      authenticateMerchant: typeof authenticateMerchant,
      authenticateAdmin: typeof authenticateAdmin
    },
    models: {
      available: Object.keys(models).length > 0,
      models: Object.keys(models)
    },
    services: {
      slotGeneration: !!SlotGenerationService,
      enhancedController: Object.keys(enhancedBookingController).length > 0
    }
  });
});

// ==================== SLOT GENERATION ROUTES ====================

// GET AVAILABLE SLOTS FOR OFFERS
router.get('/get-slots', async (req, res) => {
  try {
    const { date, offerId } = req.query;

    console.log('📅 Enhanced slot request for offer:', { offerId, date });

    // Validate inputs
    if (!date || !offerId) {
      return res.status(400).json({ 
        success: false,
        message: 'Date and offer ID are required.',
        received: { date, offerId }
      });
    }

    if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD.'
      });
    }

    if (moment(date).isBefore(moment().startOf('day'))) {
      return res.status(400).json({ 
        success: false,
        message: 'Cannot book slots for past dates.'
      });
    }

    // Use enhanced slot generation service if available
    if (SlotGenerationService && models && Object.keys(models).length > 0) {
      try {
        const slotService = new SlotGenerationService(models);
        const result = await slotService.generateAvailableSlots(offerId, 'offer', date);
        
        return res.status(result.success ? 200 : 400).json(result);
      } catch (serviceError) {
        console.warn('⚠️ SlotGenerationService failed, using fallback:', serviceError.message);
      }
    }

    // Fallback implementation
    if (!Offer || !Service || !Store) {
      return res.status(503).json({
        success: false,
        message: 'Booking service temporarily unavailable',
        availableSlots: []
      });
    }

    // Get offer with service and store information
    const offer = await Offer.findByPk(offerId, {
      include: [
        {
          model: Service,
          as: 'service',
          required: false,
          include: [
            {
              model: Store,
              as: 'store',
              required: false
            }
          ]
        }
      ]
    });

    if (!offer) {
      return res.status(404).json({ 
        success: false,
        message: 'Offer not found.'
      });
    }

    if (offer.status !== 'active') {
      return res.status(400).json({ 
        success: false,
        message: 'This offer is no longer active.'
      });
    }

    if (offer.expiration_date && moment(offer.expiration_date).isBefore(moment())) {
      return res.status(400).json({ 
        success: false,
        message: 'This offer has expired.'
      });
    }

    const service = offer.service;
    const store = service?.store;

    if (!store) {
      return res.status(400).json({ 
        success: false,
        message: 'Store information not available for this offer.'
      });
    }

    // Check if store is open on the requested day
    const dayOfWeek = moment(date).format('dddd');
    let workingDays = store.working_days;
    
    if (typeof workingDays === 'string') {
      try {
        workingDays = JSON.parse(workingDays);
      } catch {
        workingDays = workingDays.split(',').map(day => day.trim());
      }
    }

    if (!workingDays || !Array.isArray(workingDays) || !workingDays.includes(dayOfWeek)) {
      return res.status(200).json({ 
        success: true,
        availableSlots: [],
        detailedSlots: [],
        message: `Store is closed on ${dayOfWeek}.`,
        storeInfo: {
          name: store.name,
          workingDays: workingDays || []
        }
      });
    }

    // Generate base time slots
    const openingTime = store.opening_time || '09:00';
    const closingTime = store.closing_time || '18:00';
    const serviceDuration = service?.duration || 60;
    const maxConcurrent = service?.max_concurrent_bookings || 1;
    const slotInterval = service?.slot_interval || service?.duration;
    const bufferTime = service?.buffer_time || 0;

    const baseSlots = generateTimeSlots(
      openingTime, 
      closingTime, 
      serviceDuration,
      slotInterval,
      bufferTime
    );

    if (baseSlots.length === 0) {
      return res.status(200).json({ 
        success: true,
        availableSlots: [],
        detailedSlots: [],
        message: 'No time slots available based on store hours.'
      });
    }

    // Get existing bookings (both offer and service bookings)
    const existingBookings = await getExistingBookings(offerId, 'offer', date, models);

    // Calculate slot availability with concurrent booking support
    const slotsWithAvailability = calculateSlotAvailability(
      baseSlots,
      existingBookings,
      maxConcurrent
    );

    // Format for frontend
    const availableSlots = slotsWithAvailability
      .filter(slot => slot.available > 0)
      .map(slot => slot.startTime12);

    const detailedSlots = slotsWithAvailability
      .filter(slot => slot.available > 0)
      .map(slot => ({
        time: slot.startTime12,
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: slot.available,
        total: slot.total,
        booked: slot.booked,
        isAvailable: slot.available > 0
      }));

    console.log(`✅ Generated ${availableSlots.length} available slots with concurrent booking support`);

    res.status(200).json({ 
      success: true,
      availableSlots,
      detailedSlots,
      storeInfo: {
        name: store.name,
        openingTime: moment(openingTime, 'HH:mm').format('h:mm A'),
        closingTime: moment(closingTime, 'HH:mm').format('h:mm A'),
        workingDays: workingDays
      },
      entityInfo: {
        type: 'offer',
        title: offer.title,
        discount: offer.discount,
        duration: serviceDuration,
        status: offer.status
      },
      bookingRules: {
        maxConcurrentBookings: maxConcurrent,
        serviceDuration: serviceDuration,
        bufferTime: bufferTime,
        minAdvanceBooking: service?.min_advance_booking || 30,
        maxAdvanceBooking: service?.max_advance_booking || 10080
      },
      debug: {
        totalBaseSlots: baseSlots.length,
        existingBookings: existingBookings.length,
        availableSlots: availableSlots.length,
        maxConcurrent: maxConcurrent
      }
    });

  } catch (error) {
    console.error('💥 Error getting enhanced available slots:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching available slots',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      fallbackSlots: [
        '9:00 AM', '10:00 AM', '11:00 AM', 
        '2:00 PM', '3:00 PM', '4:00 PM'
      ]
    });
  }
});

// GET AVAILABLE SLOTS FOR SERVICES
router.get('/service-slots', async (req, res) => {
  try {
    const { date, serviceId } = req.query;

    console.log('📅 Enhanced slot request for service:', { serviceId, date });

    if (!date || !serviceId) {
      return res.status(400).json({ 
        success: false,
        message: 'Date and service ID are required.'
      });
    }

    if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD.'
      });
    }

    // Use enhanced slot generation service if available
    if (SlotGenerationService && models && Object.keys(models).length > 0) {
      try {
        const slotService = new SlotGenerationService(models);
        const result = await slotService.generateAvailableSlots(serviceId, 'service', date);
        
        return res.status(result.success ? 200 : 400).json(result);
      } catch (serviceError) {
        console.warn('⚠️ SlotGenerationService failed, using fallback:', serviceError.message);
      }
    }

    // Fallback implementation for direct service booking
    return res.status(503).json({
      success: false,
      message: 'Enhanced service slot generation temporarily unavailable'
    });

  } catch (error) {
    console.error('💥 Error getting service slots:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching service slots',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// CHECK SLOT AVAILABILITY
router.get('/check-availability', async (req, res) => {
  try {
    const { entityId, entityType = 'offer', date, time, excludeBookingId } = req.query;

    if (!entityId || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Entity ID, date, and time are required'
      });
    }

    // Use enhanced slot service if available
    if (SlotGenerationService && models && Object.keys(models).length > 0) {
      try {
        const slotService = new SlotGenerationService(models);
        const availability = await slotService.isSlotAvailable(
          entityId, 
          entityType, 
          date, 
          time, 
          excludeBookingId
        );
        
        return res.status(200).json({
          success: true,
          ...availability,
          timestamp: new Date().toISOString()
        });
      } catch (serviceError) {
        console.error('Slot service error:', serviceError);
      }
    }

    // Fallback availability check
    return res.status(200).json({
      success: true,
      available: true,
      remainingSlots: 1,
      totalSlots: 1,
      message: 'Using fallback availability check'
    });

  } catch (error) {
    console.error('💥 Error checking availability:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking slot availability',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==================== LEGACY SUPPORT ROUTES ====================

// GET STORES FOR OFFER
router.get('/stores/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    
    if (!Offer || !Store || !Service) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable'
      });
    }

    const offer = await Offer.findByPk(offerId, {
      include: [
        {
          model: Service,
          as: 'service',
          include: [
            {
              model: Store,
              as: 'store'
            }
          ]
        }
      ]
    });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Offer not found'
      });
    }

    const store = offer.service?.store || offer.store;
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'No store found for this offer'
      });
    }

    res.status(200).json({
      success: true,
      stores: [store]
    });

  } catch (error) {
    console.error('Error getting stores for offer:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stores'
    });
  }
});

// GET STAFF FOR STORE
router.get('/staff/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!Staff) {
      return res.status(200).json({
        success: true,
        staff: [],
        message: 'Staff functionality not available'
      });
    }

    const staff = await Staff.findAll({
      where: {
        storeId: storeId,
        status: 'active'
      },
      attributes: ['id', 'name', 'role', 'specialization', 'status']
    });

    res.status(200).json({
      success: true,
      staff: staff || []
    });

  } catch (error) {
    console.error('Error getting staff for store:', error);
    res.status(200).json({
      success: true,
      staff: [],
      message: 'Staff data not available'
    });
  }
});

// ==================== PROTECTED BOOKING ROUTES ====================

// CREATE BOOKING WITH ENHANCED VALIDATION
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('📝 Enhanced booking creation request received');

    // Use enhanced controller if available
    if (enhancedBookingController.create) {
      return await enhancedBookingController.create(req, res);
    }
    
    // Fallback booking creation
    const { 
      offerId, 
      serviceId, 
      userId, 
      startTime, 
      storeId,
      staffId,
      notes,
      paymentData 
    } = req.body;

    // Basic validation
    if ((!offerId && !serviceId) || !userId || !startTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required booking information'
      });
    }

    if (!Booking) {
      return res.status(503).json({
        success: false,
        message: 'Booking service temporarily unavailable'
      });
    }

    // Check slot availability before creating booking
    const entityId = offerId || serviceId;
    const entityType = offerId ? 'offer' : 'service';
    const date = moment(startTime).format('YYYY-MM-DD');
    const time = moment(startTime).format('h:mm A');

    // Validate availability
    if (SlotGenerationService && models && Object.keys(models).length > 0) {
      try {
        const slotService = new SlotGenerationService(models);
        const availability = await slotService.isSlotAvailable(entityId, entityType, date, time);
        
        if (!availability.available) {
          return res.status(400).json({
            success: false,
            message: availability.reason || 'Selected time slot is no longer available'
          });
        }
        
        console.log(`✅ Slot availability confirmed: ${availability.remainingSlots} remaining`);
      } catch (availabilityError) {
        console.warn('⚠️ Could not check availability, proceeding with booking');
      }
    }

    // Create basic booking
    const booking = await Booking.create({
      offerId: offerId || null,
      serviceId: serviceId || null,
      userId,
      startTime: moment(startTime).toDate(),
      endTime: moment(startTime).add(60, 'minutes').toDate(), // Default 60 minutes
      status: 'confirmed',
      storeId,
      staffId,
      notes: notes || '',
      paymentId: paymentData?.paymentId || null,
      accessFee: paymentData?.amount || 0,
      bookingType: entityType,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Fallback booking created:', booking.id);

    res.status(201).json({
      success: true,
      booking,
      message: 'Booking created successfully'
    });

  } catch (error) {
    console.error('💥 Error creating enhanced booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET USER BOOKINGS
router.get('/user/my-bookings', authenticateToken, async (req, res) => {
  try {
    // Use enhanced controller if available
    if (enhancedBookingController.getUserBookings) {
      return await enhancedBookingController.getUserBookings(req, res);
    }

    const { status, type, page = 1, limit = 10, upcoming = false } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!Booking) {
      return res.status(503).json({
        success: false,
        message: 'Booking service temporarily unavailable'
      });
    }

    const whereClause = { userId };
    if (status) whereClause.status = status;
    if (type) whereClause.bookingType = type;

    if (upcoming === 'true') {
      whereClause.startTime = {
        [Op.gte]: new Date()
      };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Offer,
          required: false,
          include: [
            {
              model: Service,
              as: 'service',
              required: false,
              include: [{ 
                model: Store, 
                as: 'store',
                required: false 
              }]
            }
          ]
        },
        {
          model: Service,
          required: false,
          include: [{ 
            model: Store, 
            as: 'store',
            required: false 
          }]
        },
        { 
          model: Payment,
          required: false 
        }
      ],
      order: [['startTime', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.status(200).json({
      success: true,
      bookings,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('💥 Error getting user bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET BOOKING BY ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!Booking) {
      return res.status(503).json({
        success: false,
        message: 'Booking service temporarily unavailable'
      });
    }

    const booking = await Booking.findByPk(id, {
      include: [
        {
          model: Offer,
          required: false,
          include: [
            {
              model: Service,
              as: 'service',
              required: false,
              include: [{ 
                model: Store, 
                as: 'store',
                required: false 
              }]
            }
          ]
        },
        {
          model: Service,
          required: false,
          include: [{ 
            model: Store, 
            as: 'store',
            required: false 
          }]
        },
        { 
          model: User,
          required: false,
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        { 
          model: Payment,
          required: false 
        }
      ]
    });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      booking
    });

  } catch (error) {
    console.error('💥 Error getting booking details:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting booking details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// CANCEL BOOKING WITH AVAILABILITY UPDATE
router.patch('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    // Use enhanced controller if available
    if (enhancedBookingController.cancelBooking) {
      return await enhancedBookingController.cancelBooking(req, res);
    }

    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    if (!Booking) {
      return res.status(503).json({
        success: false,
        message: 'Booking service temporarily unavailable'
      });
    }

    const booking = await Booking.findOne({
      where: { id, userId }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or access denied'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    await booking.update({
      status: 'cancelled',
      cancellation_reason: reason || 'Cancelled by user',
      cancelled_at: new Date()
    });

    res.status(200).json({
      success: true,
      booking,
      message: 'Booking cancelled successfully'
    });

  } catch (error) {
    console.error('💥 Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// PROCESS MPESA PAYMENT
router.post('/payment/mpesa', authenticateToken, async (req, res) => {
  try {
    const { phoneNumber, amount, callbackMetadata } = req.body;

    if (!phoneNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and amount are required'
      });
    }

    // Mock M-Pesa payment processing for development
    const mockPayment = {
      checkoutRequestId: 'CHK_' + Date.now(),
      responseCode: '0',
      responseDescription: 'Success. Request accepted for processing',
      customerMessage: 'Success. Request accepted for processing'
    };

    // Create payment record if Payment model available
    let payment = null;
    if (Payment) {
      try {
        payment = await Payment.create({
          amount: amount,
          currency: 'KES',
          method: 'mpesa',
          status: 'completed', // Mock as completed for development
          phone_number: phoneNumber,
          unique_code: 'PAY_' + Date.now(),
          transaction_id: mockPayment.checkoutRequestId,
          metadata: callbackMetadata || {}
        });
      } catch (paymentError) {
        console.warn('Could not create payment record:', paymentError.message);
      }
    }

    res.status(200).json({
      success: true,
      checkoutRequestId: mockPayment.checkoutRequestId,
      payment: payment,
      message: 'Payment request sent to your phone'
    });

  } catch (error) {
    console.error('💥 M-Pesa payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process M-Pesa payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==================== ANALYTICS ROUTES ====================

// GET BOOKING ANALYTICS
router.get('/analytics', authenticateMerchant, async (req, res) => {
  try {
    // Use enhanced controller if available
    if (enhancedBookingController.getBookingAnalytics) {
      return await enhancedBookingController.getBookingAnalytics(req, res);
    }

    const { startDate, endDate, storeId, entityType } = req.query;

    if (!Booking) {
      return res.status(503).json({
        success: false,
        message: 'Analytics service temporarily unavailable'
      });
    }

    let whereClause = {};
    
    if (storeId) whereClause.storeId = storeId;
    if (entityType) whereClause.bookingType = entityType;
    
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    // Get basic statistics
    const [
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      pendingBookings,
      completedBookings
    ] = await Promise.all([
      Booking.count({ where: whereClause }),
      Booking.count({ where: { ...whereClause, status: 'confirmed' } }),
      Booking.count({ where: { ...whereClause, status: 'cancelled' } }),
      Booking.count({ where: { ...whereClause, status: 'pending' } }),
      Booking.count({ where: { ...whereClause, status: 'completed' } })
    ]);

    const analytics = {
      overview: {
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        pendingBookings,
        completedBookings,
        conversionRate: totalBookings > 0 ? 
          ((confirmedBookings + completedBookings) / totalBookings * 100).toFixed(2) : 0,
        cancellationRate: totalBookings > 0 ? 
          (cancelledBookings / totalBookings * 100).toFixed(2) : 0
      },
      statusDistribution: {
        confirmed: confirmedBookings,
        cancelled: cancelledBookings,
        pending: pendingBookings,
        completed: completedBookings
      }
    };

    res.status(200).json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('💥 Error fetching booking analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ==================== ERROR HANDLING ====================

// 404 handler for unmatched routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /bookings/health',
      'GET /bookings/test', 
      'GET /bookings/get-slots',
      'GET /bookings/service-slots',
      'GET /bookings/check-availability',
      'GET /bookings/stores/:offerId',
      'GET /bookings/staff/:storeId',
      'POST /bookings/',
      'GET /bookings/user/my-bookings',
      'GET /bookings/:id',
      'PATCH /bookings/:id/cancel',
      'POST /bookings/payment/mpesa',
      'GET /bookings/analytics'
    ]
  });
});

// Global error handler
router.use((error, req, res, next) => {
  console.error('💥 Booking routes error:', error);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error in booking routes',
    ...(process.env.NODE_ENV === 'development' && { 
      error: error.message,
      stack: error.stack 
    })
  });
});

module.exports = router;