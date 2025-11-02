// routes/bookingRoutes.js - UPDATED VERSION with correct controller assignments

const express = require('express');
const router = express.Router();

// Import the separated controllers
const offerBookingController = require('../controllers/offerBookingController');
const serviceBookingController = require('../controllers/serviceBookingController');
const enhancedBookingController = require('../controllers/enhancedBookingController');

// Import middleware
const { authenticateUser } = require('../middleware/auth');
const { authenticateMerchant } = require('../middleware/Merchantauth');

// Helper function to safely use controller methods
const safeControllerMethod = (controller, methodName) => {
  return (req, res, next) => {
    if (controller && typeof controller[methodName] === 'function') {
      return controller[methodName](req, res, next);
    } else {
      console.error(`Controller method ${methodName} not found or not a function`);
      return res.status(501).json({
        success: false,
        message: `Method ${methodName} not implemented`,
        controller: controller ? 'loaded' : 'not loaded',
        requestedMethod: methodName
      });
    }
  };
};

// ==========================================
// FRONTEND COMPATIBILITY ALIASES (PRIORITY)
// ==========================================

/**
 * Frontend expects /service-slots
 */
router.get('/service-slots', safeControllerMethod(serviceBookingController, 'getAvailableSlots'));

/**
 * Frontend expects /offer-slots  
 */
router.get('/offer-slots', safeControllerMethod(offerBookingController, 'getAvailableSlots'));

/**
 * Frontend expects /offers/:offerId/staff
 */
router.get('/offers/:offerId/staff', safeControllerMethod(offerBookingController, 'getStaff'));

/**
 * Frontend expects /services/:serviceId/staff
 */
router.get('/services/:serviceId/staff', safeControllerMethod(serviceBookingController, 'getStaff'));

/**
 * Frontend expects /offers/:offerId/branch
 */
router.get('/offers/:offerId/branch', safeControllerMethod(offerBookingController, 'getBranch'));

/**
 * Frontend expects /services/:serviceId/branch
 */
router.get('/services/:serviceId/branch', safeControllerMethod(serviceBookingController, 'getBranch'));

// ==========================================
// OFFER BOOKING ROUTES (Dedicated)
// ==========================================

/**
 * Get available slots for offers
 */
router.get('/slots/offer', safeControllerMethod(offerBookingController, 'getAvailableSlots'));

/**
 * Create offer booking
 */
router.post('/offer', authenticateUser, safeControllerMethod(offerBookingController, 'createBooking'));

/**
 * Alternative create offer booking
 */
router.post('/offers', authenticateUser, safeControllerMethod(offerBookingController, 'createBooking'));

/**
 * Get staff for offer
 */
router.get('/staff/offer/:offerId', safeControllerMethod(offerBookingController, 'getStaff'));

/**
 * Get branch for offer
 */
router.get('/branches/offer/:offerId', safeControllerMethod(offerBookingController, 'getBranch'));

/**
 * Get stores for offer (legacy)
 */
router.get('/stores/offer/:offerId', safeControllerMethod(offerBookingController, 'getStores'));

/**
 * Get platform fee for offer
 */
router.get('/offers/:offerId/platform-fee', safeControllerMethod(offerBookingController, 'getPlatformFee'));

// ==========================================
// SERVICE BOOKING ROUTES (Dedicated)
// ==========================================

/**
 * Get available slots for services
 */
router.get('/slots/service', safeControllerMethod(serviceBookingController, 'getAvailableSlots'));

/**
 * Create service booking
 */
router.post('/service', authenticateUser, safeControllerMethod(serviceBookingController, 'createBooking'));

/**
 * Alternative create service booking
 */
router.post('/services', authenticateUser, safeControllerMethod(serviceBookingController, 'createBooking'));

/**
 * Get staff for service
 */
router.get('/staff/service/:serviceId', safeControllerMethod(serviceBookingController, 'getStaff'));

/**
 * Get branch for service
 */
router.get('/branches/service/:serviceId', safeControllerMethod(serviceBookingController, 'getBranch'));

/**
 * Get stores for service (legacy)
 */
router.get('/stores/service/:serviceId', safeControllerMethod(serviceBookingController, 'getStores'));

// ==========================================
// UNIFIED/LEGACY BOOKING ROUTES
// ==========================================

/**
 * Unified slot endpoint (uses enhanced controller)
 */
router.get('/slots/unified', safeControllerMethod(enhancedBookingController, 'getUnifiedSlots'));

/**
 * Legacy slots endpoint (uses enhanced controller for backward compatibility)
 */
router.get('/slots', safeControllerMethod(enhancedBookingController, 'getAvailableSlots'));

/**
 * Main booking creation endpoint - routes to appropriate controller based on request
 */
router.post('/', authenticateUser, (req, res, next) => {
  const { offerId, serviceId, bookingType } = req.body;
  
  console.log('Main booking endpoint called:', { offerId, serviceId, bookingType });
  
  // Determine which controller to use based on request
  if (offerId || bookingType === 'offer') {
    console.log('Routing to offer booking controller');
    // Ensure offerId is set for offer bookings
    if (!req.body.offerId && bookingType === 'offer') {
      req.body.offerId = serviceId; // Handle cases where offerId might be passed as serviceId
    }
    return safeControllerMethod(offerBookingController, 'createBooking')(req, res, next);
  } else if (serviceId || bookingType === 'service') {
    console.log('Routing to service booking controller');
    return safeControllerMethod(serviceBookingController, 'createBooking')(req, res, next);
  } else {
    // Fallback to enhanced controller for backward compatibility
    console.log('Routing to enhanced booking controller (fallback)');
    return safeControllerMethod(enhancedBookingController, 'create')(req, res, next);
  }
});

/**
 * Alternative booking creation endpoint (for backward compatibility)
 */
router.post('/create', authenticateUser, (req, res, next) => {
  const { offerId, serviceId, bookingType } = req.body;
  
  if (offerId || bookingType === 'offer') {
    return safeControllerMethod(offerBookingController, 'createBooking')(req, res, next);
  } else if (serviceId || bookingType === 'service') {
    return safeControllerMethod(serviceBookingController, 'createBooking')(req, res, next);
  } else {
    return safeControllerMethod(enhancedBookingController, 'create')(req, res, next);
  }
});

// ==========================================
// USER BOOKING MANAGEMENT ROUTES
// ==========================================

/**
 * Get user's bookings (all types)
 */
router.get('/user', authenticateUser, async (req, res, next) => {
  try {
    const { bookingType } = req.query;
    
    // If specific type requested, route accordingly
    if (bookingType === 'offer') {
      return safeControllerMethod(offerBookingController, 'getUserBookings')(req, res, next);
    } else if (bookingType === 'service') {
      return safeControllerMethod(serviceBookingController, 'getUserBookings')(req, res, next);
    }
    
    // Otherwise, get both types (you'll need to implement this or use enhanced controller)
    return safeControllerMethod(offerBookingController, 'getUserBookings')(req, res, next);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching user bookings'
    });
  }
});

/**
 * Get specific booking by ID
 */
router.get('/:bookingId', authenticateUser, async (req, res, next) => {
  try {
    // Try to determine booking type from database first
    const { Booking } = require('../models');
    const booking = await Booking.findByPk(req.params.bookingId, {
      attributes: ['id', 'bookingType', 'offerId', 'serviceId']
    });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Route to appropriate controller
    if (booking.bookingType === 'offer' || booking.offerId) {
      return safeControllerMethod(offerBookingController, 'getBookingById')(req, res, next);
    } else {
      return safeControllerMethod(serviceBookingController, 'getBookingById')(req, res, next);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching booking'
    });
  }
});

/**
 * Update booking status
 */
router.put('/:bookingId/status', authenticateUser, async (req, res, next) => {
  try {
    const { Booking } = require('../models');
    const booking = await Booking.findByPk(req.params.bookingId);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Route to appropriate controller
    if (booking.bookingType === 'offer' || booking.offerId) {
      return safeControllerMethod(offerBookingController, 'updateBookingStatus')(req, res, next);
    } else {
      return safeControllerMethod(serviceBookingController, 'updateBookingStatus')(req, res, next);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error updating booking status'
    });
  }
});

/**
 * Cancel booking - route to appropriate controller
 */
router.put('/:bookingId/cancel', authenticateUser, async (req, res, next) => {
  try {
    const { Booking } = require('../models');
    const booking = await Booking.findByPk(req.params.bookingId);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Route to appropriate controller
    if (booking.bookingType === 'offer' || booking.offerId) {
      return safeControllerMethod(offerBookingController, 'cancelBooking')(req, res, next);
    } else {
      return safeControllerMethod(serviceBookingController, 'cancelBooking')(req, res, next);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error processing cancellation'
    });
  }
});

/**
 * Reschedule booking
 */
router.put('/:bookingId/reschedule', authenticateUser, async (req, res, next) => {
  try {
    const { Booking } = require('../models');
    const booking = await Booking.findByPk(req.params.bookingId);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    if (booking.bookingType === 'offer' || booking.offerId) {
      return safeControllerMethod(offerBookingController, 'rescheduleBooking')(req, res, next);
    } else {
      return safeControllerMethod(serviceBookingController, 'rescheduleBooking')(req, res, next);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error processing reschedule'
    });
  }
});

// ==========================================
// MERCHANT BOOKING MANAGEMENT
// ==========================================

/**
 * ✅ FIXED: Get merchant offer bookings specifically
 */
router.get('/merchant/offers', authenticateMerchant, safeControllerMethod(offerBookingController, 'getAllMerchantBookings'));

/**
 * ✅ Get merchant service bookings specifically
 */
router.get('/merchant/services', authenticateMerchant, safeControllerMethod(serviceBookingController, 'getAllMerchantBookings'));

/**
 * Get all bookings for merchant (both offer and service)
 */
router.get('/merchant/all', authenticateMerchant, async (req, res) => {
  try {
    // Get both offer and service bookings
    const offerBookingsPromise = offerBookingController.getAllMerchantBookings ? 
      new Promise((resolve) => {
        offerBookingController.getAllMerchantBookings(req, {
          json: (data) => resolve(data),
          status: () => ({ json: (data) => resolve(data) })
        });
      }) : Promise.resolve({ bookings: [] });

    const serviceBookingsPromise = serviceBookingController.getAllMerchantBookings ?
      new Promise((resolve) => {
        serviceBookingController.getAllMerchantBookings(req, {
          json: (data) => resolve(data),
          status: () => ({ json: (data) => resolve(data) })
        });
      }) : Promise.resolve({ bookings: [] });

    const [offerResult, serviceResult] = await Promise.all([
      offerBookingsPromise,
      serviceBookingsPromise
    ]);

    const allBookings = [
      ...(offerResult.bookings || []),
      ...(serviceResult.bookings || [])
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const summary = {
      total: allBookings.length,
      offers: offerResult.bookings?.length || 0,
      services: serviceResult.bookings?.length || 0,
      pending: allBookings.filter(b => b.status === 'pending').length,
      confirmed: allBookings.filter(b => b.status === 'confirmed').length,
      completed: allBookings.filter(b => b.status === 'completed').length,
      cancelled: allBookings.filter(b => b.status === 'cancelled').length,
      in_progress: allBookings.filter(b => b.status === 'in_progress').length
    };

    return res.status(200).json({
      success: true,
      bookings: allBookings,
      summary,
      pagination: {
        total: allBookings.length,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      }
    });
  } catch (error) {
    console.error('Error getting all merchant bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch merchant bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get bookings for specific merchant store
 */
router.get('/merchant/store/:storeId', authenticateMerchant, safeControllerMethod(serviceBookingController, 'getMerchantStoreBookings'));

/**
 * Get specific booking by ID (merchant view)
 */
router.get('/merchant/:bookingId/view', authenticateMerchant, async (req, res, next) => {
  try {
    const { Booking } = require('../models');
    const booking = await Booking.findByPk(req.params.bookingId, {
      attributes: ['id', 'bookingType', 'offerId', 'serviceId']
    });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Route to appropriate controller
    if (booking.bookingType === 'offer' || booking.offerId) {
      return safeControllerMethod(offerBookingController, 'getBookingById')(req, res, next);
    } else {
      return safeControllerMethod(serviceBookingController, 'getMerchantBookingById')(req, res, next);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching booking'
    });
  }
});

/**
 * Update booking status (merchant action)
 */
router.put('/merchant/:bookingId/status', authenticateMerchant, async (req, res, next) => {
  try {
    const { Booking } = require('../models');
    const booking = await Booking.findByPk(req.params.bookingId);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Route to appropriate controller
    if (booking.bookingType === 'offer' || booking.offerId) {
      return safeControllerMethod(offerBookingController, 'merchantUpdateBookingStatus')(req, res, next);
    } else {
      return safeControllerMethod(serviceBookingController, 'merchantUpdateBookingStatus')(req, res, next);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error updating booking status'
    });
  }
});

// ==========================================
// LEGACY STAFF ROUTES (Enhanced Controller)
// ==========================================

/**
 * Legacy: Get staff for store (enhanced with branch awareness)
 */
router.get('/staff/store/:storeId', safeControllerMethod(enhancedBookingController, 'getStaffForStore'));

// ==========================================
// ANALYTICS ROUTES (CONDITIONAL)
// ==========================================

/**
 * Get booking analytics (only if method exists)
 */
if (enhancedBookingController && enhancedBookingController.getBookingAnalytics) {
  router.get('/analytics', authenticateMerchant, safeControllerMethod(enhancedBookingController, 'getBookingAnalytics'));
}

/**
 * Get service booking statistics (only if method exists)
 */
if (enhancedBookingController && enhancedBookingController.getServiceBookingStats) {
  router.get('/analytics/service/:serviceId', authenticateMerchant, safeControllerMethod(enhancedBookingController, 'getServiceBookingStats'));
}

// ==========================================
// SLOT MANAGEMENT ROUTES (CONDITIONAL)
// ==========================================

/**
 * Check specific slot availability (only if method exists)
 */
if (enhancedBookingController && enhancedBookingController.checkSlotAvailability) {
  router.get('/check-slot', safeControllerMethod(enhancedBookingController, 'checkSlotAvailability'));
}

/**
 * Get slot utilization report (only if method exists)
 */
if (enhancedBookingController && enhancedBookingController.getSlotUtilization) {
  router.get('/slot-utilization/:serviceId', authenticateMerchant, safeControllerMethod(enhancedBookingController, 'getSlotUtilization'));
}

// ==========================================
// DEBUG ROUTES
// ==========================================

/**
 * Debug working days endpoint
 */
if (enhancedBookingController && enhancedBookingController.debugWorkingDays) {
  router.get('/debug/working-days', safeControllerMethod(enhancedBookingController, 'debugWorkingDays'));
}

/**
 * Test working days for offers
 */
router.get('/test-working-days/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    const testDate = req.query.date || '2025-08-18';
    
    console.log('Testing working days with separated controllers');
    console.log('Offer ID:', offerId);
    console.log('Test Date:', testDate);
    
    let debugResult = null, slotsResult = null;
    
    try {
      const SlotGenerationService = require('../services/slotGenerationService');
      const models = require('../models');
      const slotService = new SlotGenerationService(models);
      
      if (slotService && typeof slotService.debugOfferWorkingDays === 'function') {
        debugResult = await slotService.debugOfferWorkingDays(offerId);
      }
      
      if (slotService && typeof slotService.generateAvailableSlots === 'function') {
        slotsResult = await slotService.generateAvailableSlots(offerId, 'offer', testDate);
      }
      
    } catch (serviceError) {
      debugResult = { error: 'SlotGenerationService not available', details: serviceError.message };
      slotsResult = { error: 'Cannot test slot generation', details: serviceError.message };
    }
    
    res.json({
      success: true,
      testDate,
      offerId,
      debugResult,
      slotsResult,
      controllerStatus: {
        offerController: !!offerBookingController,
        serviceController: !!serviceBookingController,
        enhancedController: !!enhancedBookingController
      },
      message: 'Working days test completed with separated controllers'
    });
    
  } catch (error) {
    console.error('Test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Working days test failed'
    });
  }
});

// ==========================================
// CONTROLLER STATUS TEST ROUTE
// ==========================================

/**
 * Test route to verify separated controllers are working
 */
router.get('/test', (req, res) => {
  // Check controller availability
  const controllerStatus = {
    offerController: {
      loaded: !!offerBookingController,
      methods: offerBookingController ? Object.keys(offerBookingController).filter(key => 
        typeof offerBookingController[key] === 'function'
      ) : []
    },
    serviceController: {
      loaded: !!serviceBookingController,
      methods: serviceBookingController ? Object.keys(serviceBookingController).filter(key => 
        typeof serviceBookingController[key] === 'function'
      ) : []
    },
    enhancedController: {
      loaded: !!enhancedBookingController,
      methods: enhancedBookingController ? Object.keys(enhancedBookingController).filter(key => 
        typeof enhancedBookingController[key] === 'function'
      ) : []
    }
  };

  res.status(200).json({ 
    success: true, 
    message: 'Separated booking controllers test!',
    controllers: controllerStatus,
    availableRoutes: {
      frontendAliases: [
        'GET /service-slots',
        'GET /offer-slots',
        'GET /offers/:offerId/staff',
        'GET /services/:serviceId/staff',
        'GET /offers/:offerId/branch',
        'GET /services/:serviceId/branch'
      ],
      offerRoutes: [
        'GET /slots/offer',
        'POST /offer', 
        'POST /offers',
        'GET /staff/offer/:offerId',
        'GET /branches/offer/:offerId',
        'GET /stores/offer/:offerId',
        'GET /offers/:offerId/platform-fee'
      ],
      serviceRoutes: [
        'GET /slots/service',
        'POST /service',
        'POST /services',
        'GET /staff/service/:serviceId', 
        'GET /branches/service/:serviceId',
        'GET /stores/service/:serviceId'
      ],
      unifiedRoutes: [
        'GET /slots/unified',
        'GET /slots',
        'POST /',
        'POST /create',
        'GET /user',
        'GET /:bookingId',
        'PUT /:bookingId/status',
        'PUT /:bookingId/cancel',
        'PUT /:bookingId/reschedule'
      ],
      merchantRoutes: [
        'GET /merchant/offers (✅ FIXED)',
        'GET /merchant/services',
        'GET /merchant/all',
        'GET /merchant/store/:storeId',
        'GET /merchant/:bookingId/view',
        'PUT /merchant/:bookingId/status'
      ],
      legacyRoutes: [
        'GET /staff/store/:storeId'
      ],
      debugRoutes: [
        'GET /debug/working-days',
        'GET /test-working-days/:offerId',
        'GET /test'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// ROUTE VALIDATION MIDDLEWARE
// ==========================================

/**
 * Middleware to validate booking type routing
 */
router.use('/validate-routing', (req, res, next) => {
  const { offerId, serviceId, bookingType } = req.query;
  
  let recommendedController = 'unknown';
  let recommendedRoute = 'unknown';
  
  if (offerId || bookingType === 'offer') {
    recommendedController = 'offerBookingController';
    recommendedRoute = 'POST /offers or GET /offer-slots';
  } else if (serviceId || bookingType === 'service') {
    recommendedController = 'serviceBookingController';  
    recommendedRoute = 'POST /services or GET /service-slots';
  }
  
  res.json({
    success: true,
    recommendation: {
      controller: recommendedController,
      route: recommendedRoute,
      reasoning: offerId ? 'offerId present' : 
                serviceId ? 'serviceId present' :
                bookingType === 'offer' ? 'bookingType=offer' :
                bookingType === 'service' ? 'bookingType=service' : 'unclear'
    },
    parameters: { offerId, serviceId, bookingType }
  });
});

module.exports = router;