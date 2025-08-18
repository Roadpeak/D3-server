// routes/bookingRoutes.js - UPDATED VERSION with missing POST / route

const express = require('express');
const router = express.Router();
const enhancedBookingController = require('../controllers/enhancedBookingController');
const { authenticateUser, authenticateMerchant } = require('../middleware/auth');

// ==========================================
// UNIFIED SLOT GENERATION ROUTES
// ==========================================

/**
 * Get available slots (unified endpoint for both services and offers)
 */
router.get('/slots/unified', enhancedBookingController.getUnifiedSlots);

// Legacy endpoints for backward compatibility
router.get('/slots/offer', enhancedBookingController.getAvailableSlotsForOffer);
router.get('/slots/service', enhancedBookingController.getAvailableSlotsForService);
router.get('/slots', enhancedBookingController.getAvailableSlots);

// ==========================================
// BOOKING CREATION ROUTES
// ==========================================

/**
 * CRITICAL FIX: Add the missing root POST route that your frontend is calling
 * This handles POST /api/v1/bookings (the route causing 404 error)
 */
router.post('/', authenticateUser, enhancedBookingController.create);

/**
 * Alternative booking creation routes (keep these for backwards compatibility)
 */
router.post('/create', authenticateUser, enhancedBookingController.create);
router.post('/offer', authenticateUser, enhancedBookingController.createOfferBooking);
router.post('/service', authenticateUser, enhancedBookingController.createServiceBooking);

// ==========================================
// NEW BRANCH AND STAFF ROUTES
// ==========================================

/**
 * NEW: Get staff for offer (branch-based staff assignment)
 */
router.get('/staff/offer/:offerId', enhancedBookingController.getStaffForOffer);

/**
 * NEW: Get staff for service (branch-based staff assignment)
 */
router.get('/staff/service/:serviceId', enhancedBookingController.getStaffForService);

/**
 * NEW: Get branch for offer booking
 */
router.get('/branches/offer/:offerId', enhancedBookingController.getBranchesForOffer);

/**
 * NEW: Get branch for service booking
 */
router.get('/branches/service/:serviceId', enhancedBookingController.getBranchesForService);

// ==========================================
// LEGACY COMPATIBILITY ROUTES 
// ==========================================

/**
 * Legacy: Get stores for offer bookings (now redirects to branches)
 */
router.get('/stores/offer/:offerId', enhancedBookingController.getStoresForOffer);

/**
 * Legacy: Get stores for service bookings (now redirects to branches)
 */
router.get('/stores/service/:serviceId', enhancedBookingController.getStoresForService);

/**
 * Legacy: Get staff for store (enhanced with branch awareness)
 */
router.get('/staff/store/:storeId', enhancedBookingController.getStaffForStore);

// ==========================================
// BOOKING MANAGEMENT ROUTES
// ==========================================

/**
 * Get user's bookings
 */
router.get('/user', authenticateUser, enhancedBookingController.getUserBookings);

/**
 * Get specific booking by ID
 */
router.get('/:bookingId', authenticateUser, enhancedBookingController.getBookingById);

/**
 * Update booking status
 */
router.put('/:bookingId/status', authenticateUser, enhancedBookingController.updateBookingStatus);

/**
 * Cancel booking
 */
router.put('/:bookingId/cancel', authenticateUser, enhancedBookingController.cancelBooking);

// ==========================================
// MERCHANT BOOKING MANAGEMENT (OPTIONAL - ONLY IF METHODS EXIST)
// ==========================================

/**
 * Get bookings for merchant's store (only if method exists)
 */
if (enhancedBookingController.getMerchantBookings) {
  router.get('/merchant/store/:storeId', authenticateMerchant, enhancedBookingController.getMerchantBookings);
}

/**
 * Get all bookings for merchant (only if method exists)
 */
if (enhancedBookingController.getAllMerchantBookings) {
  router.get('/merchant/all', authenticateMerchant, enhancedBookingController.getAllMerchantBookings);
}

/**
 * Merchant update booking status (only if method exists)
 */
if (enhancedBookingController.merchantUpdateBookingStatus) {
  router.put('/merchant/:bookingId/status', authenticateMerchant, enhancedBookingController.merchantUpdateBookingStatus);
}

// ==========================================
// ANALYTICS ROUTES (OPTIONAL - ONLY IF METHODS EXIST)
// ==========================================

/**
 * Get booking analytics (only if method exists)
 */
if (enhancedBookingController.getBookingAnalytics) {
  router.get('/analytics', authenticateMerchant, enhancedBookingController.getBookingAnalytics);
}

/**
 * Get service booking statistics (only if method exists)
 */
if (enhancedBookingController.getServiceBookingStats) {
  router.get('/analytics/service/:serviceId', authenticateMerchant, enhancedBookingController.getServiceBookingStats);
}

// ==========================================
// SLOT MANAGEMENT ROUTES (OPTIONAL - ONLY IF METHODS EXIST)
// ==========================================

/**
 * Check specific slot availability (only if method exists)
 */
if (enhancedBookingController.checkSlotAvailability) {
  router.get('/check-slot', enhancedBookingController.checkSlotAvailability);
}

/**
 * Get slot utilization report (only if method exists)
 */
if (enhancedBookingController.getSlotUtilization) {
  router.get('/slot-utilization/:serviceId', authenticateMerchant, enhancedBookingController.getSlotUtilization);
}

// ==========================================
// DEBUG ROUTES
// ==========================================

/**
 * Debug working days endpoint
 */
router.get('/debug/working-days', enhancedBookingController.debugWorkingDays);

// TEST ROUTE - Enhanced working days test
router.get('/test-working-days/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;
    const testDate = req.query.date || '2025-08-18'; // Monday
    
    console.log('🧪 TESTING WORKING DAYS FIX');
    console.log('Offer ID:', offerId);
    console.log('Test Date:', testDate);
    
    // Get your SlotGenerationService instance
    const SlotGenerationService = require('../services/slotGenerationService');
    const models = require('../models');
    const slotService = new SlotGenerationService(models);
    
    // Test the debug method
    const debugResult = await slotService.debugOfferWorkingDays?.(offerId);
    
    // Test slot generation
    const slotsResult = await slotService.generateAvailableSlots(offerId, 'offer', testDate);
    
    res.json({
      success: true,
      testDate,
      offerId,
      debugResult,
      slotsResult,
      message: 'Working days test completed'
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Working days test failed'
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
  res.status(200).json({ 
    success: true, 
    message: 'Booking routes working!',
    availableRoutes: [
      'POST /',
      'POST /create', 
      'POST /offer',
      'POST /service',
      'GET /user',
      'GET /:bookingId',
      'PUT /:bookingId/status',
      'PUT /:bookingId/cancel',
      'GET /slots',
      'GET /slots/unified'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;