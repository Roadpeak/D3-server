// routes/bookingRoutes.js - COMPLETE FIXED VERSION preserving ALL original routes

const express = require('express');
const router = express.Router();
const enhancedBookingController = require('../controllers/enhancedBookingController');
const { authenticateUser } = require('../middleware/auth');
const { authenticateMerchant } = require('../middleware/Merchantauth');

// Helper function to safely use controller methods
const safeControllerMethod = (methodName) => {
  return (req, res, next) => {
    if (typeof enhancedBookingController[methodName] === 'function') {
      return enhancedBookingController[methodName](req, res, next);
    } else {
      console.error(`❌ Controller method ${methodName} not found or not a function`);
      return res.status(501).json({
        success: false,
        message: `Method ${methodName} not implemented`,
        availableMethods: Object.keys(enhancedBookingController).filter(key => 
          typeof enhancedBookingController[key] === 'function'
        ),
        requestedMethod: methodName
      });
    }
  };
};

// ==========================================
// UNIFIED SLOT GENERATION ROUTES
// ==========================================

/**
 * Get available slots (unified endpoint for both services and offers)
 */
router.get('/slots/unified', safeControllerMethod('getUnifiedSlots'));

// Legacy endpoints for backward compatibility
router.get('/slots/offer', safeControllerMethod('getAvailableSlotsForOffer'));
router.get('/slots/service', safeControllerMethod('getAvailableSlotsForService'));
router.get('/slots', safeControllerMethod('getAvailableSlots'));

// ==========================================
// BOOKING CREATION ROUTES
// ==========================================

/**
 * CRITICAL FIX: Add the missing root POST route that your frontend is calling
 * This handles POST /api/v1/bookings (the route causing 404 error)
 */
router.post('/', authenticateUser, safeControllerMethod('create'));

/**
 * Alternative booking creation routes (keep these for backwards compatibility)
 */
router.post('/create', authenticateUser, safeControllerMethod('create'));
router.post('/offer', authenticateUser, safeControllerMethod('createOfferBooking'));
router.post('/service', authenticateUser, safeControllerMethod('createServiceBooking'));

// ==========================================
// NEW BRANCH AND STAFF ROUTES
// ==========================================

/**
 * NEW: Get staff for offer (branch-based staff assignment)
 */
router.get('/staff/offer/:offerId', safeControllerMethod('getStaffForOffer'));

/**
 * NEW: Get staff for service (branch-based staff assignment)
 */
router.get('/staff/service/:serviceId', safeControllerMethod('getStaffForService'));

/**
 * NEW: Get branch for offer booking
 */
router.get('/branches/offer/:offerId', safeControllerMethod('getBranchesForOffer'));

/**
 * NEW: Get branch for service booking
 */
router.get('/branches/service/:serviceId', safeControllerMethod('getBranchesForService'));

// ==========================================
// LEGACY COMPATIBILITY ROUTES 
// ==========================================

/**
 * Legacy: Get stores for offer bookings (now redirects to branches)
 */
router.get('/stores/offer/:offerId', safeControllerMethod('getStoresForOffer'));

/**
 * Legacy: Get stores for service bookings (now redirects to branches)
 */
router.get('/stores/service/:serviceId', safeControllerMethod('getStoresForService'));

/**
 * Legacy: Get staff for store (enhanced with branch awareness)
 */
router.get('/staff/store/:storeId', safeControllerMethod('getStaffForStore'));

router.get('/store/:storeId', authenticateMerchant, safeControllerMethod('getMerchantStoreBookings'));

// ==========================================
// BOOKING MANAGEMENT ROUTES
// ==========================================


router.get('/merchant/:bookingId/view', authenticateMerchant, safeControllerMethod('getMerchantBookingById'));

/**
 * Get user's bookings
 */
router.get('/user', authenticateUser, safeControllerMethod('getUserBookings'));

/**
 * Get specific booking by ID
 */
router.get('/:bookingId', authenticateUser, safeControllerMethod('getBookingById'));

/**
 * Update booking status
 */
router.put('/:bookingId/status', authenticateUser, safeControllerMethod('updateBookingStatus'));

/**
 * Cancel booking
 */
router.put('/:bookingId/cancel', authenticateUser, safeControllerMethod('cancelBooking'));

// ==========================================
// MERCHANT BOOKING MANAGEMENT (ORIGINAL CONDITIONAL LOGIC PRESERVED)
// ==========================================

/**
 * Get bookings for merchant's store (only if method exists)
 */
if (enhancedBookingController.getMerchantBookings) {
  router.get('/merchant/store/:storeId', authenticateMerchant, safeControllerMethod('getMerchantBookings'));
}

/**
 * Get all bookings for merchant (only if method exists)
 */
if (enhancedBookingController.getAllMerchantBookings) {
  router.get('/merchant/all', authenticateMerchant, safeControllerMethod('getAllMerchantBookings'));
}

/**
 * Merchant update booking status (only if method exists)
 */
if (enhancedBookingController.merchantUpdateBookingStatus) {
  router.put('/merchant/:bookingId/status', authenticateMerchant, safeControllerMethod('merchantUpdateBookingStatus'));
}

// ==========================================
// ANALYTICS ROUTES (ORIGINAL CONDITIONAL LOGIC PRESERVED)
// ==========================================

/**
 * Get booking analytics (only if method exists)
 */
if (enhancedBookingController.getBookingAnalytics) {
  router.get('/analytics', authenticateMerchant, safeControllerMethod('getBookingAnalytics'));
}

/**
 * Get service booking statistics (only if method exists)
 */
if (enhancedBookingController.getServiceBookingStats) {
  router.get('/analytics/service/:serviceId', authenticateMerchant, safeControllerMethod('getServiceBookingStats'));
}

// ==========================================
// SLOT MANAGEMENT ROUTES (ORIGINAL CONDITIONAL LOGIC PRESERVED)
// ==========================================

/**
 * Check specific slot availability (only if method exists)
 */
if (enhancedBookingController.checkSlotAvailability) {
  router.get('/check-slot', safeControllerMethod('checkSlotAvailability'));
}

/**
 * Get slot utilization report (only if method exists)
 */
if (enhancedBookingController.getSlotUtilization) {
  router.get('/slot-utilization/:serviceId', authenticateMerchant, safeControllerMethod('getSlotUtilization'));
}

// ==========================================
// MERCHANT BOOKING MANAGEMENT ROUTES (EXPLICIT DUPLICATES - ORIGINAL PRESERVED)
// ==========================================

/**
 * Get all bookings for the current merchant's stores
 * GET /api/v1/bookings/merchant/all
 */
router.get('/merchant/all', authenticateMerchant, safeControllerMethod('getMerchantBookings'));

/**
 * Get bookings for a specific merchant store
 * GET /api/v1/bookings/merchant/store/:storeId
 */
router.get('/merchant/store/:storeId', authenticateMerchant, safeControllerMethod('getMerchantStoreBookings'));

/**
 * Update booking status (merchant action)
 * PUT /api/v1/bookings/merchant/:bookingId/status
 */
router.put('/merchant/:bookingId/status', authenticateMerchant, safeControllerMethod('merchantUpdateBookingStatus'));

/**
 * Get merchant service bookings specifically
 * GET /api/v1/bookings/merchant/services
 */
router.get('/merchant/services', authenticateMerchant, (req, res) => {
  // Add bookingType=service to query params
  req.query.bookingType = 'service';
  if (typeof enhancedBookingController.getMerchantBookings === 'function') {
    enhancedBookingController.getMerchantBookings(req, res);
  } else {
    res.status(501).json({
      success: false,
      message: 'getMerchantBookings method not implemented'
    });
  }
});

/**
 * Get merchant offer bookings specifically
 * GET /api/v1/bookings/merchant/offers
 */
router.get('/merchant/offers', authenticateMerchant, (req, res) => {
  // Add bookingType=offer to query params
  req.query.bookingType = 'offer';
  if (typeof enhancedBookingController.getMerchantBookings === 'function') {
    enhancedBookingController.getMerchantBookings(req, res);
  } else {
    res.status(501).json({
      success: false,
      message: 'getMerchantBookings method not implemented'
    });
  }
});

// ==========================================
// DEBUG ROUTES
// ==========================================

/**
 * Debug working days endpoint
 */
router.get('/debug/working-days', safeControllerMethod('debugWorkingDays'));

// TEST ROUTE - Enhanced working days test
router.get('/test-working-days/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    const testDate = req.query.date || '2025-08-18'; // Monday
    
    console.log('🧪 TESTING WORKING DAYS FIX');
    console.log('Offer ID:', offerId);
    console.log('Test Date:', testDate);
    
    // Get your SlotGenerationService instance with safe error handling
    let SlotGenerationService, slotService, models;
    let debugResult = null, slotsResult = null;
    
    try {
      SlotGenerationService = require('../services/slotGenerationService');
      models = require('../models');
      slotService = new SlotGenerationService(models);
      
      // Test the debug method if it exists
      if (slotService && typeof slotService.debugOfferWorkingDays === 'function') {
        debugResult = await slotService.debugOfferWorkingDays(offerId);
      } else {
        debugResult = { 
          error: 'debugOfferWorkingDays method not available',
          slotServiceExists: !!slotService,
          slotServiceMethods: slotService ? Object.getOwnPropertyNames(Object.getPrototypeOf(slotService)) : []
        };
      }
      
      // Test slot generation
      if (slotService && typeof slotService.generateAvailableSlots === 'function') {
        slotsResult = await slotService.generateAvailableSlots(offerId, 'offer', testDate);
      } else {
        slotsResult = { 
          error: 'generateAvailableSlots method not available',
          slotServiceExists: !!slotService
        };
      }
      
    } catch (serviceError) {
      console.error('❌ SlotGenerationService initialization error:', serviceError);
      debugResult = { 
        error: 'SlotGenerationService not available', 
        details: serviceError.message,
        stack: process.env.NODE_ENV === 'development' ? serviceError.stack : undefined
      };
      slotsResult = { 
        error: 'Cannot test slot generation', 
        details: serviceError.message 
      };
    }
    
    res.json({
      success: true,
      testDate,
      offerId,
      debugResult,
      slotsResult,
      message: 'Working days test completed',
      serviceStatus: {
        modelsAvailable: !!models,
        slotServiceCreated: !!slotService,
        debugMethodExists: slotService && typeof slotService.debugOfferWorkingDays === 'function',
        slotsMethodExists: slotService && typeof slotService.generateAvailableSlots === 'function'
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Working days test failed',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==========================================
// TEST ROUTE FOR DEBUGGING
// ==========================================

/**
 * Test route to verify booking routes are working
 */
router.get('/test', (req, res) => {
  // Check what's actually available in the controller
  const controllerKeys = enhancedBookingController ? Object.keys(enhancedBookingController) : [];
  const availableMethods = controllerKeys.filter(key => 
    typeof enhancedBookingController[key] === 'function'
  );
  
  // Check specific critical methods
  const criticalMethods = [
    'create',
    'createOfferBooking', 
    'createServiceBooking',
    'getUnifiedSlots',
    'getAvailableSlots',
    'getAvailableSlotsForOffer',
    'getAvailableSlotsForService',
    'getUserBookings',
    'getBookingById',
    'updateBookingStatus',
    'cancelBooking',
    'getMerchantBookings',
    'getMerchantStoreBookings',
    'merchantUpdateBookingStatus',
    'getStaffForOffer',
    'getStaffForService',
    'getStaffForStore',
    'getBranchesForOffer',
    'getBranchesForService',
    'getStoresForOffer',
    'getStoresForService',
    'debugWorkingDays'
  ];
  
  const methodStatus = {};
  criticalMethods.forEach(method => {
    methodStatus[method] = {
      exists: typeof enhancedBookingController[method] === 'function',
      type: typeof enhancedBookingController[method]
    };
  });

  res.status(200).json({ 
    success: true, 
    message: 'Booking routes working!',
    controllerStatus: {
      loaded: !!enhancedBookingController,
      totalKeys: controllerKeys.length,
      availableMethods: availableMethods,
      methodCount: availableMethods.length,
      criticalMethodsStatus: methodStatus,
      allKeys: controllerKeys
    },
    availableRoutes: [
      // Slot routes
      'GET /slots/unified',
      'GET /slots/offer', 
      'GET /slots/service',
      'GET /slots',
      
      // Creation routes
      'POST /',
      'POST /create', 
      'POST /offer',
      'POST /service',
      
      // User booking routes
      'GET /user',
      'GET /:bookingId',
      'PUT /:bookingId/status',
      'PUT /:bookingId/cancel',
      
      // Staff and branch routes
      'GET /staff/offer/:offerId',
      'GET /staff/service/:serviceId',
      'GET /staff/store/:storeId',
      'GET /branches/offer/:offerId',
      'GET /branches/service/:serviceId',
      
      // Legacy store routes
      'GET /stores/offer/:offerId',
      'GET /stores/service/:serviceId',
      'GET /store/:storeId',
      
      // Merchant routes
      'GET /merchant/all',
      'GET /merchant/services',
      'GET /merchant/offers',
      'GET /merchant/store/:storeId',
      'PUT /merchant/:bookingId/status',
      
      // Analytics routes (conditional)
      'GET /analytics',
      'GET /analytics/service/:serviceId',
      
      // Slot management routes (conditional)  
      'GET /check-slot',
      'GET /slot-utilization/:serviceId',
      
      // Debug routes
      'GET /debug/working-days',
      'GET /test-working-days/:offerId',
      'GET /test'
    ],
    routeRegistrationOrder: [
      '1. Unified slot generation routes',
      '2. Booking creation routes',
      '3. Branch and staff routes', 
      '4. Legacy compatibility routes',
      '5. Booking management routes',
      '6. Conditional merchant routes',
      '7. Conditional analytics routes',
      '8. Conditional slot management routes',
      '9. Explicit merchant routes (duplicates)',
      '10. Debug routes',
      '11. Test routes'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;