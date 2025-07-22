// controllers/enhancedBookingController.js - Updated with advanced slot management

const moment = require('moment');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

// Import models with fallbacks
let models = {};
try {
  models = require('../models');
  console.log('✅ Models imported in enhanced booking controller');
} catch (error) {
  console.error('❌ Failed to import models in booking controller:', error);
}

const { 
  Booking, 
  Offer, 
  Service, 
  Store, 
  User, 
  Payment, 
  Staff, 
  Merchant,
  sequelize 
} = models;

// Import the slot generation service
const SlotGenerationService = require('../services/slotGenerationService');
const slotService = new SlotGenerationService(models);

class EnhancedBookingController {
  
  // ==================== SLOT GENERATION METHODS ====================

  /**
   * Get available slots for an offer (primary booking method)
   */
  async getAvailableSlots(req, res) {
    try {
      const { date, offerId } = req.query;

      console.log('📅 Getting available slots for offer:', { offerId, date });

      // Validate inputs
      if (!date || !offerId) {
        return res.status(400).json({ 
          success: false,
          message: 'Date and offer ID are required.',
          received: { date, offerId }
        });
      }

      // Validate date format
      if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD.',
          received: date
        });
      }

      // Check if date is in the past
      if (moment(date).isBefore(moment().startOf('day'))) {
        return res.status(400).json({ 
          success: false,
          message: 'Cannot book slots for past dates.',
          received: date
        });
      }

      // Use the slot generation service
      const result = await slotService.generateAvailableSlots(offerId, 'offer', date);
      
      // Return the result with proper status code
      const statusCode = result.success ? 200 : (result.message.includes('not found') ? 404 : 400);
      return res.status(statusCode).json(result);

    } catch (error) {
      console.error('💥 Error getting available slots:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error fetching available slots',
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : 'Internal server error',
        fallbackSlots: [
          '9:00 AM', '10:00 AM', '11:00 AM', 
          '2:00 PM', '3:00 PM', '4:00 PM'
        ]
      });
    }
  }

  /**
   * Get available slots for a service (direct service booking)
   */
  async getServiceSlots(req, res) {
    try {
      const { date, serviceId } = req.query;

      console.log('📅 Getting available slots for service:', { serviceId, date });

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

      // Use the slot generation service for direct service booking
      const result = await slotService.generateAvailableSlots(serviceId, 'service', date);
      
      const statusCode = result.success ? 200 : (result.message.includes('not found') ? 404 : 400);
      return res.status(statusCode).json(result);

    } catch (error) {
      console.error('💥 Error getting service slots:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error fetching service slots',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==================== BOOKING CREATION WITH AVAILABILITY CHECK ====================

  /**
   * Create booking with enhanced availability checking
   */
  async create(req, res) {
    let transaction;
    
    try {
      // Start transaction if sequelize is available
      if (sequelize) {
        transaction = await sequelize.transaction();
      }

      const { 
        offerId, 
        serviceId, // For direct service bookings
        userId, 
        startTime, 
        storeId,
        staffId,
        notes,
        paymentData,
        clientInfo
      } = req.body;

      console.log('🎯 Creating enhanced booking:', {
        offerId,
        serviceId,
        userId,
        startTime,
        storeId,
        staffId
      });

      // Validate required fields
      if ((!offerId && !serviceId) || !userId || !startTime) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          message: 'Offer ID or Service ID, User ID, and start time are required' 
        });
      }

      // Determine booking type and get entity details
      let bookingEntity, entityType, service;
      
      if (offerId) {
        entityType = 'offer';
        bookingEntity = await Offer.findByPk(offerId, {
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store'
            }]
          }],
          ...(transaction && { transaction })
        });
        
        if (!bookingEntity) {
          if (transaction) await transaction.rollback();
          return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        
        service = bookingEntity.service;
      } else {
        entityType = 'service';
        service = await Service.findByPk(serviceId, {
          include: [{
            model: Store,
            as: 'store'
          }],
          ...(transaction && { transaction })
        });
        
        if (!service) {
          if (transaction) await transaction.rollback();
          return res.status(404).json({ success: false, message: 'Service not found' });
        }
        
        bookingEntity = service;
      }

      // Validate entity is active
      if (entityType === 'offer' && bookingEntity.status !== 'active') {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          message: 'This offer is no longer active' 
        });
      }

      if (entityType === 'offer' && bookingEntity.expiration_date && new Date(bookingEntity.expiration_date) < new Date()) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          message: 'This offer has expired' 
        });
      }

      // Check service booking enabled
      if (!service.booking_enabled) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          message: 'Booking is not enabled for this service' 
        });
      }

      // Get user details
      const user = await User.findByPk(userId, { 
        ...(transaction && { transaction }) 
      });
      
      if (!user) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({ 
          success: false,
          message: 'User not found' 
        });
      }

      // Validate advance booking rules
      const bookingDateTime = moment(startTime);
      const now = moment();
      const advanceMinutes = bookingDateTime.diff(now, 'minutes');

      if (!service.canAcceptBooking(advanceMinutes)) {
        if (transaction) await transaction.rollback();
        const minAdvance = Math.ceil(service.min_advance_booking / 60);
        const maxAdvance = Math.ceil(service.max_advance_booking / (60 * 24));
        return res.status(400).json({ 
          success: false,
          message: `Booking must be made between ${minAdvance} hours and ${maxAdvance} days in advance` 
        });
      }

      // CRITICAL: Check slot availability
      const date = moment(startTime).format('YYYY-MM-DD');
      const time = moment(startTime).format('h:mm A');
      
      const entityId = entityType === 'offer' ? offerId : serviceId;
      const availabilityCheck = await slotService.isSlotAvailable(entityId, entityType, date, time);
      
      if (!availabilityCheck.available) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          message: availabilityCheck.reason || 'Selected time slot is no longer available'
        });
      }

      console.log(`✅ Slot availability confirmed: ${availabilityCheck.remainingSlots} remaining`);

      // Validate store and staff if provided
      let bookingStore = null;
      if (storeId && Store) {
        bookingStore = await Store.findByPk(storeId, { 
          ...(transaction && { transaction }) 
        });
        if (!bookingStore) {
          if (transaction) await transaction.rollback();
          return res.status(404).json({ 
            success: false,
            message: 'Store not found' 
          });
        }
      } else {
        bookingStore = service.store;
      }

      let bookingStaff = null;
      if (staffId && Staff) {
        bookingStaff = await Staff.findOne({
          where: { 
            id: staffId,
            storeId: bookingStore?.id,
            status: 'active'
          },
          ...(transaction && { transaction })
        });
        
        if (!bookingStaff) {
          if (transaction) await transaction.rollback();
          return res.status(404).json({ 
            success: false,
            message: 'Staff member not found or not available' 
          });
        }
      }

      // Calculate end time based on service duration
      const serviceDuration = service.duration || 60;
      const endTime = moment(startTime).add(serviceDuration, 'minutes').toDate();

      // Process payment if required
      let paymentRecord = null;
      if (paymentData && paymentData.amount > 0) {
        paymentRecord = await this.processPayment(paymentData, transaction);
        if (!paymentRecord && paymentData.amount > 0) {
          if (transaction) await transaction.rollback();
          return res.status(400).json({ 
            success: false,
            message: 'Payment processing failed' 
          });
        }
      }

      // Create the booking
      const bookingData = {
        offerId: entityType === 'offer' ? offerId : null,
        serviceId: entityType === 'service' ? serviceId : service.id, // Always store service ID for reference
        userId,
        startTime: moment(startTime).toDate(),
        endTime,
        status: paymentRecord ? 'confirmed' : 'pending',
        storeId: bookingStore?.id,
        staffId: bookingStaff?.id,
        notes: notes || '',
        paymentId: paymentRecord?.id,
        paymentUniqueCode: paymentRecord?.unique_code,
        accessFee: paymentData?.amount || 0,
        bookingType: entityType
      };

      const booking = await Booking.create(bookingData, { 
        ...(transaction && { transaction }) 
      });

      // Generate QR code for booking verification
      try {
        const qrCodeUrl = await this.generateQRCode(booking, req);
        await booking.update({ qrCode: qrCodeUrl }, { 
          ...(transaction && { transaction }) 
        });
      } catch (qrError) {
        console.warn('QR code generation failed:', qrError.message);
      }

      // Send confirmation email
      try {
        await this.sendBookingConfirmationEmail(booking, bookingEntity, user, bookingStore, bookingStaff, entityType);
      } catch (emailError) {
        console.warn('Email sending failed:', emailError.message);
      }

      // Commit transaction
      if (transaction) await transaction.commit();

      // Fetch complete booking data for response
      const completeBooking = await Booking.findByPk(booking.id, {
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
            required: false 
          },
          { 
            model: Payment,
            required: false 
          }
        ]
      });

      console.log('✅ Enhanced booking created successfully:', booking.id);

      res.status(201).json({ 
        success: true,
        booking: completeBooking || booking,
        payment: paymentRecord,
        availability: {
          remainingSlots: availabilityCheck.remainingSlots - 1,
          totalSlots: availabilityCheck.totalSlots
        },
        message: `Booking created successfully. ${availabilityCheck.remainingSlots - 1} slots remaining for this time.`
      });

    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('💥 Enhanced booking creation error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to create booking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==================== BOOKING MANAGEMENT METHODS ====================

  /**
   * Get user's bookings with enhanced filtering
   */
  async getUserBookings(req, res) {
    try {
      const { userId } = req.query;
      const { status, type, page = 1, limit = 10, upcoming = false } = req.query;

      const targetUserId = userId || req.user?.id;

      if (!targetUserId) {
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

      const whereClause = { userId: targetUserId };
      if (status) whereClause.status = status;
      if (type) whereClause.bookingType = type;

      // Filter upcoming bookings
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
          },
          {
            model: Staff,
            required: false,
            attributes: ['id', 'name', 'role']
          }
        ],
        order: [['startTime', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      // Enhance bookings with slot availability info
      const enhancedBookings = await Promise.all(bookings.map(async (booking) => {
        const bookingJson = booking.toJSON();
        
        // Add slot availability for future bookings
        if (moment(booking.startTime).isAfter(moment())) {
          try {
            const date = moment(booking.startTime).format('YYYY-MM-DD');
            const time = moment(booking.startTime).format('h:mm A');
            const entityId = booking.offerId || booking.serviceId;
            const entityType = booking.offerId ? 'offer' : 'service';
            
            const availability = await slotService.isSlotAvailable(entityId, entityType, date, time, booking.id);
            bookingJson.slotAvailability = availability;
          } catch (err) {
            console.warn('Failed to check slot availability for booking:', booking.id);
          }
        }

        return bookingJson;
      }));

      res.status(200).json({
        success: true,
        bookings: enhancedBookings,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Error fetching user bookings:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch bookings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Cancel booking with slot availability update
   */
  async cancelBooking(req, res) {
    try {
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
        where: { id, userId },
        include: [
          {
            model: Service,
            required: false
          },
          {
            model: Offer,
            required: false,
            include: [{
              model: Service,
              as: 'service',
              required: false
            }]
          }
        ]
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

      // Check if booking can be cancelled (not too close to start time)
      const service = booking.Service || booking.Offer?.service;
      if (service) {
        const minCancellationTime = service.min_advance_booking || 30;
        const timeUntilBooking = moment(booking.startTime).diff(moment(), 'minutes');
        
        if (timeUntilBooking < minCancellationTime) {
          return res.status(400).json({
            success: false,
            message: `Booking cannot be cancelled less than ${Math.ceil(minCancellationTime / 60)} hours in advance`
          });
        }
      }

      await booking.update({
        status: 'cancelled',
        cancellationReason: reason || 'Cancelled by user',
        cancelledAt: new Date()
      });

      // Get updated slot availability after cancellation
      let updatedAvailability = null;
      try {
        const date = moment(booking.startTime).format('YYYY-MM-DD');
        const time = moment(booking.startTime).format('h:mm A');
        const entityId = booking.offerId || booking.serviceId;
        const entityType = booking.offerId ? 'offer' : 'service';
        
        updatedAvailability = await slotService.isSlotAvailable(entityId, entityType, date, time);
      } catch (err) {
        console.warn('Failed to check updated slot availability:', err);
      }

      res.status(200).json({
        success: true,
        booking: booking,
        slotAvailability: updatedAvailability,
        message: 'Booking cancelled successfully. Slot is now available for other customers.'
      });

    } catch (error) {
      console.error('Error cancelling booking:', error);
      res.status(500).json({
        success: false,
        message: 'Error cancelling booking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Process payment (existing method with some enhancements)
   */
  async processPayment(paymentData, transaction) {
    if (!Payment) {
      console.warn('Payment model not available, skipping payment processing');
      return null;
    }

    try {
      const payment = await Payment.create({
        amount: paymentData.amount,
        currency: paymentData.currency || 'KES',
        method: paymentData.method || 'mpesa',
        status: 'completed',
        unique_code: this.generateUniqueCode(),
        transaction_id: paymentData.transactionId || this.generateTransactionId(),
        phone_number: paymentData.phoneNumber,
        metadata: paymentData.metadata || {}
      }, { ...(transaction && { transaction }) });

      return payment;
    } catch (error) {
      console.error('Payment processing error:', error);
      return null;
    }
  }

  /**
   * Generate QR code for booking verification
   */
  async generateQRCode(booking, req) {
    try {
      const qrData = JSON.stringify({ 
        bookingId: booking.id,
        paymentCode: booking.paymentUniqueCode || 'FREE',
        verificationCode: this.generateVerificationCode(),
        timestamp: new Date().getTime()
      });

      const qrCodePath = path.join(__dirname, '..', 'public', 'qrcodes', `${booking.id}.png`);
      
      const qrDir = path.dirname(qrCodePath);
      if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
      }

      await QRCode.toFile(qrCodePath, qrData);
      const qrCodeUrl = `${req.protocol}://${req.get('host')}/qrcodes/${booking.id}.png`;
      
      return qrCodeUrl;
    } catch (error) {
      console.error('QR code generation error:', error);
      return null;
    }
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmationEmail(booking, entity, user, store, staff, entityType) {
    // Email sending logic would go here
    console.log(`📧 Sending confirmation email for ${entityType} booking:`, booking.id);
    
    // This is a placeholder - implement with your email service
    try {
      // const emailContent = this.generateEmailTemplate(booking, entity, user, store, staff, entityType);
      // await emailService.send(user.email, 'Booking Confirmation', emailContent);
      console.log('✅ Confirmation email sent successfully');
    } catch (error) {
      console.error('Email sending failed:', error);
    }
  }

  /**
   * Helper methods
   */
  generateUniqueCode() {
    return 'PAY_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  generateTransactionId() {
    return 'TXN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  generateVerificationCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // ==================== ADMIN/MERCHANT METHODS ====================

  /**
   * Get booking analytics with slot utilization
   */
  async getBookingAnalytics(req, res) {
    try {
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

      // Get booking statistics
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

      // Calculate slot utilization rates
      const bookingsWithSlotInfo = await Booking.findAll({
        where: {
          ...whereClause,
          status: { [Op.ne]: 'cancelled' }
        },
        include: [
          {
            model: Service,
            required: false,
            attributes: ['max_concurrent_bookings', 'duration']
          },
          {
            model: Offer,
            required: false,
            include: [{
              model: Service,
              as: 'service',
              required: false,
              attributes: ['max_concurrent_bookings', 'duration']
            }]
          }
        ],
        attributes: ['startTime', 'endTime']
      });

      // Calculate utilization (simplified)
      const slotUtilization = this.calculateSlotUtilization(bookingsWithSlotInfo);

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
        slotUtilization,
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
      console.error('Error fetching booking analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Calculate slot utilization rates
   */
  calculateSlotUtilization(bookings) {
    // This is a simplified calculation
    // In a real implementation, you'd want more sophisticated slot utilization tracking
    const totalSlots = bookings.length;
    const utilizationByHour = {};

    bookings.forEach(booking => {
      const hour = moment(booking.startTime).format('HH');
      if (!utilizationByHour[hour]) {
        utilizationByHour[hour] = 0;
      }
      utilizationByHour[hour]++;
    });

    return {
      totalSlotsBooked: totalSlots,
      peakHours: Object.entries(utilizationByHour)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour, count]) => ({ hour: `${hour}:00`, bookings: count })),
      averageUtilizationRate: totalSlots > 0 ? 
        (Object.values(utilizationByHour).reduce((a, b) => a + b, 0) / Object.keys(utilizationByHour).length).toFixed(2) : 0
    };
  }
}

// Create and export instance
const enhancedBookingController = new EnhancedBookingController();

// Export both the class and individual methods for backwards compatibility
module.exports = {
  // Main booking methods
  create: enhancedBookingController.create.bind(enhancedBookingController),
  getAvailableSlots: enhancedBookingController.getAvailableSlots.bind(enhancedBookingController),
  getServiceSlots: enhancedBookingController.getServiceSlots.bind(enhancedBookingController),
  getUserBookings: enhancedBookingController.getUserBookings.bind(enhancedBookingController),
  cancelBooking: enhancedBookingController.cancelBooking.bind(enhancedBookingController),
  
  // Analytics methods
  getBookingAnalytics: enhancedBookingController.getBookingAnalytics.bind(enhancedBookingController),
  
  // Export the class itself
  EnhancedBookingController,
  
  // Export instance for direct use
  default: enhancedBookingController
};