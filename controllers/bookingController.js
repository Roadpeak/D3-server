// controllers/enhancedBookingController.js - Updated to handle both offers and services

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
   * Get available slots for an offer (with access fee)
   */
  async getAvailableSlotsForOffer(req, res) {
    try {
      const { date, offerId } = req.query;

      console.log('📅 Getting available slots for OFFER:', { offerId, date });

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
          message: 'Invalid date format. Use YYYY-MM-DD.',
          received: date
        });
      }

      if (moment(date).isBefore(moment().startOf('day'))) {
        return res.status(400).json({ 
          success: false,
          message: 'Cannot book slots for past dates.',
          received: date
        });
      }

      // Use the slot generation service for offers
      const result = await slotService.generateAvailableSlots(offerId, 'offer', date);
      
      // Add booking type information
      if (result.success) {
        result.bookingType = 'offer';
        result.requiresPayment = true;
        result.accessFee = 5.99; // KES access fee for offers
      }
      
      const statusCode = result.success ? 200 : (result.message.includes('not found') ? 404 : 400);
      return res.status(statusCode).json(result);

    } catch (error) {
      console.error('💥 Error getting offer slots:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error fetching available offer slots',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get available slots for a service (no access fee)
   */
  async getAvailableSlotsForService(req, res) {
    try {
      const { date, serviceId } = req.query;

      console.log('📅 Getting available slots for SERVICE:', { serviceId, date });

      if (!date || !serviceId) {
        return res.status(400).json({ 
          success: false,
          message: 'Date and service ID are required.',
          received: { date, serviceId }
        });
      }

      if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD.',
          received: date
        });
      }

      if (moment(date).isBefore(moment().startOf('day'))) {
        return res.status(400).json({ 
          success: false,
          message: 'Cannot book slots for past dates.',
          received: date
        });
      }

      // Use the slot generation service for direct service booking
      const result = await slotService.generateAvailableSlots(serviceId, 'service', date);
      
      // Add booking type information
      if (result.success) {
        result.bookingType = 'service';
        result.requiresPayment = false;
        result.accessFee = 0; // No access fee for direct service bookings
      }
      
      const statusCode = result.success ? 200 : (result.message.includes('not found') ? 404 : 400);
      return res.status(statusCode).json(result);

    } catch (error) {
      console.error('💥 Error getting service slots:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error fetching available service slots',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==================== BOOKING CREATION WITH ENHANCED TYPE HANDLING ====================

  /**
   * Create booking with enhanced type handling (offer vs service)
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
        serviceId,
        userId, 
        startTime, 
        storeId,
        staffId,
        notes,
        paymentData,
        clientInfo,
        bookingType // 'offer' or 'service'
      } = req.body;

      console.log('🎯 Creating enhanced booking:', {
        offerId,
        serviceId,
        userId,
        startTime,
        storeId,
        staffId,
        bookingType
      });

      // Validate booking type
      if (!bookingType || !['offer', 'service'].includes(bookingType)) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          message: 'Valid booking type (offer or service) is required' 
        });
      }

      // Validate required fields based on booking type
      if (bookingType === 'offer' && !offerId) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          message: 'Offer ID is required for offer bookings' 
        });
      }

      if (bookingType === 'service' && !serviceId) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          message: 'Service ID is required for service bookings' 
        });
      }

      if (!userId || !startTime) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          message: 'User ID and start time are required' 
        });
      }

      // Get entity details and determine service
      let bookingEntity, service;
      
      if (bookingType === 'offer') {
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
        
        // Validate offer is active and not expired
        if (bookingEntity.status !== 'active') {
          if (transaction) await transaction.rollback();
          return res.status(400).json({ 
            success: false,
            message: 'This offer is no longer active' 
          });
        }

        if (bookingEntity.expiration_date && new Date(bookingEntity.expiration_date) < new Date()) {
          if (transaction) await transaction.rollback();
          return res.status(400).json({ 
            success: false,
            message: 'This offer has expired' 
          });
        }
        
      } else {
        // Direct service booking
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

      // Check service booking enabled
      if (!service.booking_enabled) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({ 
          success: false,
          message: 'Online booking is not enabled for this service' 
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
      
      const entityIdForSlot = bookingType === 'offer' ? offerId : serviceId;
      const availabilityCheck = await slotService.isSlotAvailable(entityIdForSlot, bookingType, date, time);
      
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

      // Process payment ONLY for offers
      let paymentRecord = null;
      if (bookingType === 'offer' && paymentData && paymentData.amount > 0) {
        paymentRecord = await this.processPayment(paymentData, transaction);
        if (!paymentRecord && paymentData.amount > 0) {
          if (transaction) await transaction.rollback();
          return res.status(400).json({ 
            success: false,
            message: 'Payment processing failed' 
          });
        }
      } else if (bookingType === 'service') {
        console.log('🔄 Service booking - no payment required');
      }

      // Create the booking
      const bookingData = {
        offerId: bookingType === 'offer' ? offerId : null,
        serviceId: serviceId || service.id, // Always store service ID for reference
        userId,
        startTime: moment(startTime).toDate(),
        endTime,
        status: bookingType === 'offer' ? (paymentRecord ? 'confirmed' : 'pending') : 'confirmed', // Service bookings are auto-confirmed
        storeId: bookingStore?.id,
        staffId: bookingStaff?.id,
        notes: notes || '',
        paymentId: paymentRecord?.id,
        paymentUniqueCode: paymentRecord?.unique_code,
        accessFee: bookingType === 'offer' ? (paymentData?.amount || 5.99) : 0,
        bookingType: bookingType
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
        await this.sendBookingConfirmationEmail(booking, bookingEntity, user, bookingStore, bookingStaff, bookingType);
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

      console.log(`✅ Enhanced ${bookingType} booking created successfully:`, booking.id);

      // Prepare response message
      let responseMessage;
      if (bookingType === 'offer') {
        responseMessage = paymentRecord 
          ? `Offer booking created successfully with payment. ${availabilityCheck.remainingSlots - 1} slots remaining for this time.`
          : `Offer booking created successfully. Payment required to confirm. ${availabilityCheck.remainingSlots - 1} slots remaining.`;
      } else {
        responseMessage = `Service booking confirmed successfully. ${availabilityCheck.remainingSlots - 1} slots remaining for this time.`;
      }

      res.status(201).json({ 
        success: true,
        booking: completeBooking || booking,
        payment: paymentRecord,
        availability: {
          remainingSlots: availabilityCheck.remainingSlots - 1,
          totalSlots: availabilityCheck.totalSlots
        },
        bookingType: bookingType,
        requiresPayment: bookingType === 'offer',
        accessFee: bookingType === 'offer' ? 5.99 : 0,
        message: responseMessage
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

  // ==================== LEGACY SUPPORT METHOD ====================

  /**
   * Get available slots (legacy endpoint - determines type from parameters)
   */
  async getAvailableSlots(req, res) {
    try {
      const { date, offerId, serviceId } = req.query;

      console.log('📅 Legacy getAvailableSlots called:', { offerId, serviceId, date });

      // Determine booking type and route to appropriate method
      if (offerId) {
        req.query = { date, offerId };
        return this.getAvailableSlotsForOffer(req, res);
      } else if (serviceId) {
        req.query = { date, serviceId };
        return this.getAvailableSlotsForService(req, res);
      } else {
        return res.status(400).json({ 
          success: false,
          message: 'Either offer ID or service ID is required'
        });
      }

    } catch (error) {
      console.error('💥 Error in legacy getAvailableSlots:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error fetching available slots',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==================== STORES AND STAFF METHODS ====================

  /**
   * Get stores for offer booking
   */
  async getStoresForOffer(req, res) {
    try {
      const { offerId } = req.params;

      console.log('🏪 Getting stores for offer:', offerId);

      const offer = await Offer.findByPk(offerId, {
        include: [{
          model: Service,
          as: 'service',
          include: [{
            model: Store,
            as: 'store'
          }]
        }]
      });

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: 'Offer not found'
        });
      }

      const stores = offer.service?.store ? [offer.service.store] : [];

      res.status(200).json({
        success: true,
        stores: stores,
        message: stores.length === 0 ? 'No stores available for this offer' : undefined
      });

    } catch (error) {
      console.error('❌ Error getting stores for offer:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching stores for offer',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get stores for service booking
   */
  async getStoresForService(req, res) {
    try {
      const { serviceId } = req.params;

      console.log('🏪 Getting stores for service:', serviceId);

      const service = await Service.findByPk(serviceId, {
        include: [{
          model: Store,
          as: 'store'
        }]
      });

      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }

      const stores = service.store ? [service.store] : [];

      res.status(200).json({
        success: true,
        stores: stores,
        message: stores.length === 0 ? 'No stores available for this service' : undefined
      });

    } catch (error) {
      console.error('❌ Error getting stores for service:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching stores for service',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get staff for store (works for both booking types)
   */
  async getStaffForStore(req, res) {
    try {
      const { storeId } = req.params;

      console.log('👥 Getting staff for store:', storeId);

      if (!Staff) {
        return res.status(503).json({
          success: false,
          message: 'Staff management not available'
        });
      }

      const staff = await Staff.findAll({
        where: {
          storeId: storeId,
          status: 'active'
        },
        attributes: { exclude: ['password'] },
        order: [['name', 'ASC']]
      });

      res.status(200).json({
        success: true,
        staff: staff || [],
        message: staff.length === 0 ? 'No staff available for selection' : undefined
      });

    } catch (error) {
      console.error('❌ Error getting staff for store:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching staff',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==================== BOOKING MANAGEMENT METHODS ====================

  /**
   * Get user's bookings with enhanced filtering for booking types
   */
  async getUserBookings(req, res) {
    try {
      const { userId } = req.query;
      const { status, type, bookingType, page = 1, limit = 10, upcoming = false } = req.query;

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
      if (bookingType) whereClause.bookingType = bookingType; // Filter by 'offer' or 'service'

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

      // Enhance bookings with booking type information
      const enhancedBookings = bookings.map(booking => {
        const bookingJson = booking.toJSON();
        
        // Add booking type metadata
        bookingJson.isOfferBooking = booking.bookingType === 'offer' || !!booking.offerId;
        bookingJson.isServiceBooking = booking.bookingType === 'service' || (!booking.offerId && !!booking.serviceId);
        bookingJson.requiresPayment = bookingJson.isOfferBooking;
        bookingJson.accessFeePaid = bookingJson.isOfferBooking && !!booking.paymentId;
        
        return bookingJson;
      });

      res.status(200).json({
        success: true,
        bookings: enhancedBookings,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        summary: {
          total: count,
          offerBookings: enhancedBookings.filter(b => b.isOfferBooking).length,
          serviceBookings: enhancedBookings.filter(b => b.isServiceBooking).length,
          upcomingBookings: enhancedBookings.filter(b => new Date(b.startTime) > new Date()).length
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

  // ==================== UTILITY METHODS ====================

  /**
   * Process payment (only for offers)
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
        metadata: {
          ...paymentData.metadata,
          bookingType: 'offer',
          accessFee: true
        }
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
        bookingType: booking.bookingType,
        paymentCode: booking.paymentUniqueCode || (booking.bookingType === 'service' ? 'SERVICE_BOOKING' : 'FREE'),
        verificationCode: this.generateVerificationCode(),
        accessFeePaid: booking.bookingType === 'offer' && !!booking.paymentId,
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
   * Send booking confirmation email with type-specific content
   */
  async sendBookingConfirmationEmail(booking, entity, user, store, staff, bookingType) {
    console.log(`📧 Sending confirmation email for ${bookingType} booking:`, booking.id);
    
    try {
      // Email content would differ based on booking type
      const emailSubject = bookingType === 'offer' 
        ? `Offer Booking Confirmation - ${entity.title || entity.service?.name}`
        : `Service Booking Confirmation - ${entity.name}`;

      const paymentInfo = bookingType === 'offer' && booking.paymentId
        ? 'Access fee has been paid. Pay the discounted service price at the venue.'
        : bookingType === 'offer'
        ? 'Please complete payment to confirm your booking.'
        : 'Pay the full service price at the venue.';

      console.log(`✅ Email would be sent with subject: ${emailSubject}`);
      console.log(`💰 Payment info: ${paymentInfo}`);
      
      // Implement actual email sending here
      // await emailService.send(user.email, emailSubject, emailContent);
      
    } catch (error) {
      console.error('Email sending failed:', error);
    }
  }

  /**
   * Get booking analytics with type breakdown
   */
  async getBookingAnalytics(req, res) {
    try {
      const { startDate, endDate, storeId, bookingType } = req.query;

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Analytics service temporarily unavailable'
        });
      }

      let whereClause = {};
      
      if (storeId) whereClause.storeId = storeId;
      if (bookingType) whereClause.bookingType = bookingType;
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      // Get booking statistics by type
      const [
        totalBookings,
        offerBookings,
        serviceBookings,
        confirmedBookings,
        cancelledBookings,
        pendingBookings,
        completedBookings,
        paidOfferBookings
      ] = await Promise.all([
        Booking.count({ where: whereClause }),
        Booking.count({ where: { ...whereClause, bookingType: 'offer' } }),
        Booking.count({ where: { ...whereClause, bookingType: 'service' } }),
        Booking.count({ where: { ...whereClause, status: 'confirmed' } }),
        Booking.count({ where: { ...whereClause, status: 'cancelled' } }),
        Booking.count({ where: { ...whereClause, status: 'pending' } }),
        Booking.count({ where: { ...whereClause, status: 'completed' } }),
        Booking.count({ 
          where: { 
            ...whereClause, 
            bookingType: 'offer',
            paymentId: { [Op.not]: null }
          } 
        })
      ]);

      // Calculate revenue from access fees
      const accessFeeRevenue = await Booking.sum('accessFee', {
        where: {
          ...whereClause,
          bookingType: 'offer',
          paymentId: { [Op.not]: null }
        }
      }) || 0;

      const analytics = {
        overview: {
          totalBookings,
          offerBookings,
          serviceBookings,
          confirmedBookings,
          cancelledBookings,
          pendingBookings,
          completedBookings,
          conversionRate: totalBookings > 0 ? 
            ((confirmedBookings + completedBookings) / totalBookings * 100).toFixed(2) : 0,
          cancellationRate: totalBookings > 0 ? 
            (cancelledBookings / totalBookings * 100).toFixed(2) : 0
        },
        offerBookings: {
          total: offerBookings,
          paidBookings: paidOfferBookings,
          pendingPayment: offerBookings - paidOfferBookings,
          accessFeeRevenue: accessFeeRevenue.toFixed(2),
          averageAccessFee: offerBookings > 0 ? (accessFeeRevenue / offerBookings).toFixed(2) : 0
        },
        serviceBookings: {
          total: serviceBookings,
          // Service bookings don't have payment requirements
          directBookings: serviceBookings
        },
        statusDistribution: {
          confirmed: confirmedBookings,
          cancelled: cancelledBookings,
          pending: pendingBookings,
          completed: completedBookings
        },
        typeDistribution: {
          offers: offerBookings,
          services: serviceBookings
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
}

// Create and export instance
const enhancedBookingController = new EnhancedBookingController();

// Export both the class and individual methods
module.exports = {
  // Main booking methods
  create: enhancedBookingController.create.bind(enhancedBookingController),
  
  // Slot methods
  getAvailableSlots: enhancedBookingController.getAvailableSlots.bind(enhancedBookingController),
  getAvailableSlotsForOffer: enhancedBookingController.getAvailableSlotsForOffer.bind(enhancedBookingController),
  getAvailableSlotsForService: enhancedBookingController.getAvailableSlotsForService.bind(enhancedBookingController),
  
  // Store and staff methods
  getStoresForOffer: enhancedBookingController.getStoresForOffer.bind(enhancedBookingController),
  getStoresForService: enhancedBookingController.getStoresForService.bind(enhancedBookingController),
  getStaffForStore: enhancedBookingController.getStaffForStore.bind(enhancedBookingController),
  
  // User booking methods
  getUserBookings: enhancedBookingController.getUserBookings.bind(enhancedBookingController),
  
  // Analytics methods
  getBookingAnalytics: enhancedBookingController.getBookingAnalytics.bind(enhancedBookingController),
  
  // Export the class itself
  EnhancedBookingController,
  
  // Export instance for direct use
  default: enhancedBookingController
};