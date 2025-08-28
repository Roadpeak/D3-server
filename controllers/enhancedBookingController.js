// controllers/enhancedBookingController.js - Complete with branch support and date fix

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
  Branch,
  StaffService,
  sequelize
} = models;

// Import the slot generation service
const SlotGenerationService = require('../services/slotGenerationService');
const slotService = new SlotGenerationService(models);

class EnhancedBookingController {

  // ==================== DATE NORMALIZATION HELPER ====================

  /**
   * Normalize and validate datetime string
   */
  normalizeDateTime(dateTimeStr) {
    if (!dateTimeStr) {
      throw new Error('DateTime string is required');
    }

    // Handle various formats
    let normalizedDateTime;

    // If it's already a valid moment object
    if (moment.isMoment(dateTimeStr)) {
      return dateTimeStr;
    }

    // If it's a Date object
    if (dateTimeStr instanceof Date) {
      return moment(dateTimeStr);
    }

    // Handle string formats
    if (typeof dateTimeStr === 'string') {
      // Fix common format issues
      let fixedDateTime = dateTimeStr.trim();

      // Fix single-digit hours: '2025-08-25T9:00' -> '2025-08-25T09:00'
      const singleHourPattern = /T(\d):(\d{2})(?::(\d{2}))?$/;
      if (singleHourPattern.test(fixedDateTime)) {
        fixedDateTime = fixedDateTime.replace(singleHourPattern, (match, hour, minute, second) => {
          const paddedHour = hour.padStart(2, '0');
          const paddedSecond = second || '00';
          return `T${paddedHour}:${minute}:${paddedSecond}`;
        });
      }

      // Add seconds if missing: '2025-08-25T09:00' -> '2025-08-25T09:00:00'
      if (/T\d{2}:\d{2}$/.test(fixedDateTime)) {
        fixedDateTime += ':00';
      }

      // Try to parse with various formats
      const formats = [
        'YYYY-MM-DDTHH:mm:ss',
        'YYYY-MM-DDTHH:mm',
        'YYYY-MM-DD HH:mm:ss',
        'YYYY-MM-DD HH:mm',
        moment.ISO_8601
      ];

      for (const format of formats) {
        const parsed = moment(fixedDateTime, format, true);
        if (parsed.isValid()) {
          normalizedDateTime = parsed;
          break;
        }
      }

      // Fallback to loose parsing
      if (!normalizedDateTime) {
        normalizedDateTime = moment(fixedDateTime);
      }
    }

    // Final validation
    if (!normalizedDateTime || !normalizedDateTime.isValid()) {
      throw new Error(`Invalid datetime format: ${dateTimeStr}. Expected format: YYYY-MM-DDTHH:mm:ss`);
    }

    return normalizedDateTime;
  }

  // ==================== UNIFIED SLOT GENERATION ====================

  /**
   * Unified slot generation endpoint (handles both services and offers)
   */
  async getUnifiedSlots(req, res) {
    try {
      const { entityId, entityType, date } = req.query;

      console.log('📅 Getting unified slots:', { entityId, entityType, date });

      if (!date || !entityId || !entityType) {
        return res.status(400).json({
          success: false,
          message: 'Date, entity ID, and entity type are required.',
          received: { date, entityId, entityType }
        });
      }

      if (!['offer', 'service'].includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: 'Entity type must be either "offer" or "service"',
          received: { entityType }
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

      // Use the slot generation service
      const result = await slotService.generateAvailableSlots(entityId, entityType, date);

      // Add booking type information based on entity type
      if (result.success) {
        result.entityType = entityType;
        result.bookingType = entityType;
        result.requiresPayment = entityType === 'offer';

        if (entityType === 'offer') {
          // Calculate access fee for offers
          try {
            const offer = await Offer.findByPk(entityId);
            if (offer) {
              const discount = parseFloat(offer.discount) || 20;
              result.accessFee = (discount * 0.15).toFixed(2);
            } else {
              result.accessFee = 5.99; // Default access fee
            }
          } catch {
            result.accessFee = 5.99; // Fallback
          }
        } else {
          result.accessFee = 0; // No access fee for direct service bookings
        }
      }

      const statusCode = result.success ? 200 : (result.message.includes('not found') ? 404 : 400);
      return res.status(statusCode).json(result);

    } catch (error) {
      console.error('💥 Error getting unified slots:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching available slots',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

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

        // Calculate access fee based on offer discount
        try {
          const offer = await Offer.findByPk(offerId);
          if (offer) {
            const discount = parseFloat(offer.discount) || 20;
            result.accessFee = (discount * 0.15).toFixed(2);
          } else {
            result.accessFee = 5.99;
          }
        } catch {
          result.accessFee = 5.99;
        }
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
   * Create booking with enhanced type handling (offer vs service) and fixed date handling
   */
 /**
   * Create booking with enhanced type handling (offer vs service) and fixed date handling
   */
 async create(req, res) {
  let transaction;
  let transactionCommitted = false;

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
      branchId,
      staffId,
      notes,
      paymentData,
      clientInfo,
      bookingType
    } = req.body;

    console.log('🎯 Creating enhanced booking:', {
      offerId,
      serviceId,
      userId,
      startTime,
      storeId,
      branchId,
      staffId,
      bookingType
    });

    // FIXED: Normalize and validate datetime
    let bookingDateTime;
    try {
      bookingDateTime = this.normalizeDateTime(startTime);
      console.log('✅ Normalized datetime:', bookingDateTime.format('YYYY-MM-DDTHH:mm:ss'));
    } catch (dateError) {
      if (transaction && !transactionCommitted) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Invalid start time format: ${dateError.message}`,
        received: { startTime },
        expected: 'YYYY-MM-DDTHH:mm:ss (e.g., 2025-08-25T09:00:00)'
      });
    }

    // Validate booking type
    const determinedBookingType = bookingType || (offerId ? 'offer' : 'service');

    if (!['offer', 'service'].includes(determinedBookingType)) {
      if (transaction && !transactionCommitted) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Valid booking type (offer or service) is required'
      });
    }

    // Validate required fields based on booking type
    if (determinedBookingType === 'offer' && !offerId) {
      if (transaction && !transactionCommitted) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Offer ID is required for offer bookings'
      });
    }

    if (determinedBookingType === 'service' && !serviceId) {
      if (transaction && !transactionCommitted) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Service ID is required for service bookings'
      });
    }

    if (!userId) {
      if (transaction && !transactionCommitted) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Get entity details and determine service
    let bookingEntity, service;

    if (determinedBookingType === 'offer') {
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
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Offer not found' });
      }

      service = bookingEntity.service;

      // Validate offer is active and not expired
      if (bookingEntity.status !== 'active') {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'This offer is no longer active'
        });
      }

      if (bookingEntity.expiration_date && new Date(bookingEntity.expiration_date) < new Date()) {
        if (transaction && !transactionCommitted) await transaction.rollback();
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
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Service not found' });
      }

      bookingEntity = service;
    }

    // Check service booking enabled
    if (!service.booking_enabled) {
      if (transaction && !transactionCommitted) await transaction.rollback();
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
      if (transaction && !transactionCommitted) await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate advance booking rules using normalized datetime
    const now = moment();
    const advanceMinutes = bookingDateTime.diff(now, 'minutes');

    if (service.canAcceptBooking && !service.canAcceptBooking(advanceMinutes)) {
      if (transaction && !transactionCommitted) await transaction.rollback();
      const minAdvance = Math.ceil((service.min_advance_booking || 60) / 60);
      const maxAdvance = Math.ceil((service.max_advance_booking || 7 * 24 * 60) / (60 * 24));
      return res.status(400).json({
        success: false,
        message: `Booking must be made between ${minAdvance} hours and ${maxAdvance} days in advance`
      });
    }

    // CRITICAL: Check slot availability using normalized datetime
    const date = bookingDateTime.format('YYYY-MM-DD');
    const time = bookingDateTime.format('h:mm A');

    console.log('🔍 Checking slot availability:', {
      entityType: determinedBookingType,
      entityId: determinedBookingType === 'offer' ? offerId : serviceId,
      date,
      time,
      normalizedDateTime: bookingDateTime.format('YYYY-MM-DDTHH:mm:ss')
    });

    const entityIdForSlot = determinedBookingType === 'offer' ? offerId : serviceId;
    const availabilityCheck = await slotService.isSlotAvailable(entityIdForSlot, determinedBookingType, date, time);

    if (!availabilityCheck.available) {
      if (transaction && !transactionCommitted) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: availabilityCheck.reason || 'Selected time slot is no longer available'
      });
    }

    console.log(`✅ Slot availability confirmed: ${availabilityCheck.remainingSlots} remaining`);

    // Validate branch and staff if provided
    let bookingBranch = null;
    let bookingStore = null;

    // Handle branch validation
    if (branchId && Branch) {
      bookingBranch = await Branch.findByPk(branchId, {
        ...(transaction && { transaction })
      });
      if (!bookingBranch) {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Branch not found'
        });
      }
      bookingStore = await Store.findByPk(bookingBranch.storeId, {
        ...(transaction && { transaction })
      });
    } else if (storeId && Store) {
      bookingStore = await Store.findByPk(storeId, {
        ...(transaction && { transaction })
      });
      if (!bookingStore) {
        if (transaction && !transactionCommitted) await transaction.rollback();
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
      const staffQuery = {
        id: staffId,
        status: 'active'
      };

      // Add branch or store filter for staff
      if (bookingBranch) {
        staffQuery.branchId = bookingBranch.id;
      } else if (bookingStore) {
        staffQuery.storeId = bookingStore.id;
      }

      bookingStaff = await Staff.findOne({
        where: staffQuery,
        ...(transaction && { transaction })
      });

      if (!bookingStaff) {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Staff member not found or not available at this location'
        });
      }
    }

    // Calculate end time based on service duration using normalized datetime
    const serviceDuration = service.duration || 60;
    const endTime = bookingDateTime.clone().add(serviceDuration, 'minutes').toDate();

    // Process payment ONLY for offers
    let paymentRecord = null;
    let accessFee = 0;

    if (determinedBookingType === 'offer') {
      // Calculate access fee
      const discount = parseFloat(bookingEntity.discount) || 20;
      accessFee = parseFloat((discount * 0.15).toFixed(2));

      if (paymentData && paymentData.amount > 0) {
        paymentRecord = await this.processPayment(paymentData, transaction);
        if (!paymentRecord && paymentData.amount > 0) {
          if (transaction && !transactionCommitted) await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: 'Payment processing failed'
          });
        }
      }
    } else {
      console.log('🔄 Service booking - no payment required');
      accessFee = 0;
    }

    // Create the booking with properly formatted datetime
    const bookingData = {
      userId,
      startTime: bookingDateTime.toDate(),
      endTime,
      status: determinedBookingType === 'offer' ? (paymentRecord ? 'confirmed' : 'pending') : 'confirmed',
      storeId: bookingStore?.id,
      branchId: bookingBranch?.id,
      staffId: bookingStaff?.id,
      notes: notes || '',
      accessFee: accessFee,
      bookingType: determinedBookingType
    };
    
    // CRITICAL FIX: Set either offerId OR serviceId based on booking type
    if (determinedBookingType === 'offer') {
      bookingData.offerId = offerId;
      // serviceId stays undefined/null for offer bookings
    } else {
      bookingData.serviceId = serviceId || service.id;
      // offerId stays undefined/null for service bookings
    }

    // Add payment fields only for offer bookings
    if (determinedBookingType === 'offer' && paymentRecord) {
      bookingData.paymentId = paymentRecord.id;
      bookingData.paymentUniqueCode = paymentRecord.unique_code;
    }

    console.log('📋 Final booking data before creation:', {
      ...bookingData,
      bookingType: determinedBookingType,
      hasOfferId: !!bookingData.offerId,
      hasServiceId: !!bookingData.serviceId
    });

    // Validation before creation
    if (determinedBookingType === 'offer' && !bookingData.offerId) {
      if (transaction && !transactionCommitted) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Offer ID is required for offer bookings'
      });
    }

    if (determinedBookingType === 'service' && !bookingData.serviceId) {
      if (transaction && !transactionCommitted) await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Service ID is required for service bookings'
      });
    }

    // FIXED: Single booking creation
    let booking;
    try {
      booking = await Booking.create(bookingData, {
        ...(transaction && { transaction })
      });

      console.log(`✅ ${determinedBookingType} booking created successfully:`, {
        id: booking.id,
        bookingType: booking.bookingType,
        offerId: booking.offerId,
        serviceId: booking.serviceId,
        startTime: booking.startTime
      });

    } catch (bookingCreationError) {
      console.error('💥 Booking creation failed:', bookingCreationError);

      if (transaction && !transactionCommitted) await transaction.rollback();

      // Handle specific validation errors
      if (bookingCreationError.name === 'SequelizeValidationError') {
        const validationErrors = bookingCreationError.errors.map(err => err.message).join(', ');
        return res.status(400).json({
          success: false,
          message: `Booking validation failed: ${validationErrors}`,
          details: bookingCreationError.errors
        });
      }

      // Handle database constraint errors
      if (bookingCreationError.name === 'SequelizeDatabaseError') {
        return res.status(400).json({
          success: false,
          message: 'Database constraint violation. Please check your booking details.',
          error: process.env.NODE_ENV === 'development' ? bookingCreationError.message : 'Database error'
        });
      }

      // Generic error
      return res.status(500).json({
        success: false,
        message: 'Failed to create booking',
        error: process.env.NODE_ENV === 'development' ? bookingCreationError.message : 'Internal server error'
      });
    }

    // Generate QR code for booking verification
    try {
      const qrCodeUrl = await this.generateQRCode(booking, req);
      if (qrCodeUrl) {
        await booking.update({ qrCode: qrCodeUrl }, {
          ...(transaction && { transaction })
        });
      }
    } catch (qrError) {
      console.warn('QR code generation failed:', qrError.message);
    }

    // FIXED: Commit transaction before any async operations that might fail
    if (transaction && !transactionCommitted) {
      await transaction.commit();
      transactionCommitted = true;
      console.log('✅ Transaction committed successfully');
    }

    // Send confirmation email (after transaction commit)
    try {
      await this.sendBookingConfirmationEmail(booking, bookingEntity, user, bookingStore, bookingStaff, determinedBookingType);
    } catch (emailError) {
      console.warn('Email sending failed:', emailError.message);
      // Don't fail the entire request if email fails
    }

    // Fetch complete booking data for response
    let completeBooking;
    try {
      completeBooking = await Booking.findByPk(booking.id, {
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
          },
          ...(Branch ? [{
            model: Branch,
            required: false
          }] : [])
        ]
      });
    } catch (fetchError) {
      console.warn('Failed to fetch complete booking data:', fetchError.message);
      completeBooking = booking;
    }

    console.log(`✅ Enhanced ${determinedBookingType} booking created successfully:`, booking.id);

    // Prepare response message
    let responseMessage;
    if (determinedBookingType === 'offer') {
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
      bookingType: determinedBookingType,
      requiresPayment: determinedBookingType === 'offer',
      accessFee: accessFee,
      message: responseMessage
    });

  } catch (error) {
    // Only rollback if transaction hasn't been committed
    if (transaction && !transactionCommitted) {
      try {
        await transaction.rollback();
        console.log('✅ Transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('💥 Failed to rollback transaction:', rollbackError.message);
      }
    }
    
    console.error('💥 Enhanced booking creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

  /**
   * Create offer booking specifically
   */
  async createOfferBooking(req, res) {
    req.body.bookingType = 'offer';
    return this.create(req, res);
  }

  /**
   * Create service booking specifically
   */
  async createServiceBooking(req, res) {
    req.body.bookingType = 'service';
    return this.create(req, res);
  }

  // ==================== BRANCH AND STAFF ROUTES ====================

  /**
   * Get staff specifically for an offer
   */
  async getStaffForOffer(req, res) {
    try {
      const { offerId } = req.params;

      console.log('👥 Getting staff for offer:', offerId);

      if (!Offer) {
        return res.status(200).json({
          success: true,
          staff: [],
          message: 'Staff service not available'
        });
      }

      const offer = await Offer.findByPk(offerId, {
        include: [{
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'branch_id', 'store_id'],
          include: [{
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'location']
          }]
        }]
      });

      if (!offer || !offer.service) {
        return res.status(404).json({
          success: false,
          message: 'Offer or associated service not found'
        });
      }

      const service = offer.service;
      console.log('📋 Service details:', {
        serviceId: service.id,
        serviceName: service.name,
        branchId: service.branch_id,
        storeId: service.store_id
      });

      let staff = [];

      if (Staff && service.branch_id) {
        if (StaffService) {
          staff = await Staff.findAll({
            where: {
              branchId: service.branch_id,
              status: 'active'
            },
            include: [{
              model: Service,
              as: 'services',
              where: { id: service.id },
              through: {
                attributes: ['isActive', 'assignedAt'],
                where: { isActive: true }
              },
              attributes: ['id', 'name'],
              required: true
            }],
            attributes: ['id', 'name', 'role', 'branchId'],
            order: [['name', 'ASC']]
          });
        } else {
          staff = await Staff.findAll({
            where: {
              branchId: service.branch_id,
              status: 'active'
            },
            attributes: ['id', 'name', 'role', 'branchId'],
            order: [['name', 'ASC']]
          });
        }
      } else if (Staff && service.store_id) {
        staff = await Staff.findAll({
          where: {
            storeId: service.store_id,
            status: 'active'
          },
          attributes: ['id', 'name', 'role'],
          order: [['name', 'ASC']]
        });
      }

      console.log(`👥 Found ${staff.length} staff for offer ${offerId}`);

      const cleanStaff = staff.map(member => ({
        id: member.id,
        name: member.name,
        role: member.role,
        branchId: member.branchId,
        assignedToService: !!member.services?.length
      }));

      res.status(200).json({
        success: true,
        staff: cleanStaff,
        serviceInfo: {
          id: service.id,
          name: service.name,
          branchId: service.branch_id,
          store: service.store
        },
        message: cleanStaff.length === 0 ? 'No staff assigned to this service' : undefined
      });

    } catch (error) {
      console.error('❌ Error getting staff for offer:', error);

      res.status(200).json({
        success: true,
        staff: [],
        message: 'Staff information temporarily unavailable',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get staff specifically for a service
   */
  async getStaffForService(req, res) {
    try {
      const { serviceId } = req.params;

      console.log('👥 Getting staff for service:', serviceId);

      if (!Service || !Staff) {
        return res.status(200).json({
          success: true,
          staff: [],
          message: 'Staff service not available'
        });
      }

      const service = await Service.findByPk(serviceId, {
        attributes: ['id', 'name', 'branch_id', 'store_id'],
        include: [{
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'location']
        }]
      });

      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }

      console.log('📋 Service details:', {
        serviceId: service.id,
        serviceName: service.name,
        branchId: service.branch_id,
        storeId: service.store_id
      });

      let staff = [];

      if (service.branch_id) {
        if (StaffService) {
          staff = await Staff.findAll({
            where: {
              branchId: service.branch_id,
              status: 'active'
            },
            include: [{
              model: Service,
              as: 'services',
              where: { id: service.id },
              through: {
                attributes: ['isActive', 'assignedAt'],
                where: { isActive: true }
              },
              attributes: ['id', 'name'],
              required: true
            }],
            attributes: ['id', 'name', 'role', 'branchId'],
            order: [['name', 'ASC']]
          });
        } else {
          staff = await Staff.findAll({
            where: {
              branchId: service.branch_id,
              status: 'active'
            },
            attributes: ['id', 'name', 'role', 'branchId'],
            order: [['name', 'ASC']]
          });
        }
      } else {
        staff = await Staff.findAll({
          where: {
            storeId: service.store_id,
            status: 'active'
          },
          attributes: ['id', 'name', 'role'],
          order: [['name', 'ASC']]
        });
      }

      console.log(`👥 Found ${staff.length} staff for service ${serviceId}`);

      const cleanStaff = staff.map(member => ({
        id: member.id,
        name: member.name,
        role: member.role,
        branchId: member.branchId,
        assignedToService: !!member.services?.length
      }));

      res.status(200).json({
        success: true,
        staff: cleanStaff,
        serviceInfo: {
          id: service.id,
          name: service.name,
          branchId: service.branch_id,
          store: service.store
        },
        message: cleanStaff.length === 0 ? 'No staff assigned to this service' : undefined
      });

    } catch (error) {
      console.error('❌ Error getting staff for service:', error);

      res.status(200).json({
        success: true,
        staff: [],
        message: 'Staff information temporarily unavailable',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get branches for offer
   */
  async getBranchesForOffer(req, res) {
    try {
      const { offerId } = req.params;

      console.log('🏢 Getting branch for offer:', offerId);

      const offer = await Offer.findByPk(offerId, {
        include: [{
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'branch_id', 'store_id'],
          include: [{
            model: Store,
            as: 'store',
            attributes: [
              'id',
              'name',
              'location',
              'phone_number',
              'opening_time',
              'closing_time',
              'working_days'
            ]
          }]
        }]
      });

      if (!offer || !offer.service) {
        return res.status(404).json({
          success: false,
          message: 'Offer or associated service not found'
        });
      }

      const service = offer.service;

      console.log('📋 Service details:', {
        serviceId: service.id,
        serviceName: service.name,
        branchId: service.branch_id,
        storeId: service.store_id
      });

      let branch = null;
      if (service.branch_id && Branch) {
        try {
          branch = await Branch.findByPk(service.branch_id, {
            attributes: ['id', 'name', 'address', 'phone', 'openingTime', 'closingTime', 'workingDays']
          });

          if (branch) {
            console.log('✅ Branch found:', branch.name);
          }
        } catch (branchError) {
          console.warn('⚠️ Error fetching branch:', branchError.message);
        }
      }

      if (!branch && service.store) {
        console.log('🏪 Using store as fallback branch');
        branch = {
          id: `store-${service.store.id}`,
          name: service.store.name + ' (Main Branch)',
          address: service.store.location,
          phone: service.store.phone_number,
          openingTime: service.store.opening_time,
          closingTime: service.store.closing_time,
          workingDays: service.store.working_days,
          isMainBranch: true
        };
      }

      res.status(200).json({
        success: true,
        branch: branch,
        service: {
          id: service.id,
          name: service.name,
          branchId: service.branch_id
        },
        message: !branch ? 'No branch information available' : undefined
      });

    } catch (error) {
      console.error('❌ Error getting branch for offer:', error);

      if (error.name === 'SequelizeDatabaseError') {
        console.error('💥 Database error details:', {
          message: error.message,
          sql: error.sql,
          original: error.original?.message
        });

        return res.status(500).json({
          success: false,
          message: 'Database error occurred while fetching branch information',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error fetching branch for offer',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get branches for service
   */
  async getBranchesForService(req, res) {
    try {
      const { serviceId } = req.params;

      console.log('🏢 Getting branch for service:', serviceId);

      const service = await Service.findByPk(serviceId, {
        attributes: ['id', 'name', 'branch_id', 'store_id'],
        include: [{
          model: Store,
          as: 'store',
          attributes: [
            'id',
            'name',
            'location',
            'phone_number',
            'opening_time',
            'closing_time',
            'working_days'
          ]
        }]
      });

      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }

      console.log('📋 Service details:', {
        serviceId: service.id,
        serviceName: service.name,
        branchId: service.branch_id,
        storeId: service.store_id
      });

      let branch = null;
      if (service.branch_id && Branch) {
        try {
          branch = await Branch.findByPk(service.branch_id, {
            attributes: ['id', 'name', 'address', 'phone', 'openingTime', 'closingTime', 'workingDays']
          });
        } catch (branchError) {
          console.warn('⚠️ Error fetching branch:', branchError.message);
        }
      }

      if (!branch && service.store) {
        branch = {
          id: `store-${service.store.id}`,
          name: service.store.name + ' (Main Branch)',
          address: service.store.location,
          phone: service.store.phone_number,
          openingTime: service.store.opening_time,
          closingTime: service.store.closing_time,
          workingDays: service.store.working_days,
          isMainBranch: true
        };
      }

      res.status(200).json({
        success: true,
        branch: branch,
        service: {
          id: service.id,
          name: service.name,
          branchId: service.branch_id
        },
        message: !branch ? 'No branch information available' : undefined
      });

    } catch (error) {
      console.error('❌ Error getting branch for service:', error);

      if (error.name === 'SequelizeDatabaseError') {
        console.error('💥 Database error details:', {
          message: error.message,
          sql: error.sql,
          original: error.original?.message
        });

        return res.status(500).json({
          success: false,
          message: 'Database error occurred while fetching branch information',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error fetching branch for service',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==================== LEGACY COMPATIBILITY ====================

  /**
   * Legacy: Get available slots
   */
  async getAvailableSlots(req, res) {
    try {
      const { date, offerId, serviceId } = req.query;

      console.log('📅 Legacy getAvailableSlots called:', { offerId, serviceId, date });

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

  /**
   * Legacy: Get stores for offer bookings
   */
  async getStoresForOffer(req, res) {
    try {
      const { offerId } = req.params;

      console.log('🏪 Getting stores for offer (legacy):', offerId);

      const branchResponse = await this.getBranchesForOffer(req, {
        json: (data) => data
      });

      if (branchResponse.success && branchResponse.branch) {
        const stores = [{
          id: branchResponse.branch.id,
          name: branchResponse.branch.name,
          location: branchResponse.branch.address,
          address: branchResponse.branch.address,
          phone: branchResponse.branch.phone,
          opening_time: branchResponse.branch.openingTime,
          closing_time: branchResponse.branch.closingTime,
          working_days: branchResponse.branch.workingDays
        }];

        return res.status(200).json({
          success: true,
          stores: stores,
          message: stores.length === 0 ? 'No stores available for this offer' : undefined
        });
      }

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
   * Legacy: Get stores for service bookings
   */
  async getStoresForService(req, res) {
    try {
      const { serviceId } = req.params;

      console.log('🏪 Getting stores for service (legacy):', serviceId);

      const branchResponse = await this.getBranchesForService(req, {
        json: (data) => data
      });

      if (branchResponse.success && branchResponse.branch) {
        const stores = [{
          id: branchResponse.branch.id,
          name: branchResponse.branch.name,
          location: branchResponse.branch.address,
          address: branchResponse.branch.address,
          phone: branchResponse.branch.phone,
          opening_time: branchResponse.branch.openingTime,
          closing_time: branchResponse.branch.closingTime,
          working_days: branchResponse.branch.workingDays
        }];

        return res.status(200).json({
          success: true,
          stores: stores,
          message: stores.length === 0 ? 'No stores available for this service' : undefined
        });
      }

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
   * Get staff for store (enhanced with branch awareness)
   */
  async getStaffForStore(req, res) {
    try {
      const { storeId } = req.params;
      const { serviceId, offerId, entityType, entityId } = req.query;

      console.log('👥 Getting staff for store with filters:', {
        storeId,
        serviceId,
        offerId,
        entityType,
        entityId
      });

      if (!Staff) {
        console.warn('⚠️ Staff model not available');
        return res.status(200).json({
          success: true,
          staff: [],
          message: 'Staff selection not available - model not loaded'
        });
      }

      if (!storeId || storeId === 'undefined' || storeId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid store ID is required'
        });
      }

      let targetServiceId = serviceId;

      if (offerId || entityType === 'offer') {
        const offerIdToUse = offerId || entityId;
        console.log('🎯 Getting service from offer:', offerIdToUse);

        if (Offer) {
          try {
            const offer = await Offer.findByPk(offerIdToUse, {
              attributes: ['id', 'service_id'],
              include: [{
                model: Service,
                as: 'service',
                attributes: ['id', 'name']
              }]
            });

            if (offer) {
              targetServiceId = offer.service_id;
              console.log('✅ Found service from offer:', {
                offerId: offerIdToUse,
                serviceId: targetServiceId,
                serviceName: offer.service?.name
              });
            } else {
              console.warn('⚠️ Offer not found:', offerIdToUse);
            }
          } catch (offerError) {
            console.error('❌ Error fetching offer:', offerError);
          }
        }
      } else if (entityType === 'service') {
        targetServiceId = entityId;
      }

      let staff = [];

      if (targetServiceId) {
        console.log('🔍 Getting staff assigned to service:', targetServiceId);

        if (StaffService) {
          staff = await Staff.findAll({
            where: {
              storeId: storeId,
              status: 'active'
            },
            include: [{
              model: Service,
              as: 'services',
              where: { id: targetServiceId },
              through: {
                attributes: ['isActive', 'assignedAt'],
                where: { isActive: true }
              },
              attributes: ['id', 'name'],
              required: true
            }],
            attributes: ['id', 'name', 'role'],
            order: [['name', 'ASC']]
          });

          console.log(`👥 Found ${staff.length} staff assigned to service ${targetServiceId}`);
        } else {
          console.warn('⚠️ StaffService model not available, falling back to all store staff');
          staff = await Staff.findAll({
            where: {
              storeId: storeId,
              status: 'active'
            },
            attributes: ['id', 'name', 'role'],
            order: [['name', 'ASC']]
          });
        }
      } else {
        console.log('🔄 No specific service found, getting all store staff');

        staff = await Staff.findAll({
          where: {
            storeId: storeId,
            status: 'active'
          },
          attributes: ['id', 'name', 'role'],
          order: [['name', 'ASC']]
        });
      }

      const cleanStaff = staff.map(member => ({
        id: member.id,
        name: member.name,
        role: member.role,
        ...(member.services && member.services.length > 0 && {
          assignmentInfo: {
            assignedAt: member.services[0].StaffService?.assignedAt,
            isActive: member.services[0].StaffService?.isActive
          }
        })
      }));

      console.log(`👥 Returning ${cleanStaff.length} staff members`);

      res.status(200).json({
        success: true,
        staff: cleanStaff,
        count: cleanStaff.length,
        filters: {
          storeId,
          serviceId: targetServiceId,
          offerId,
          entityType
        },
        message: cleanStaff.length === 0 ?
          (targetServiceId ?
            'No staff assigned to this service' :
            'No staff available for selection'
          ) : undefined
      });

    } catch (error) {
      console.error('❌ Error getting staff for store:', error);

      res.status(200).json({
        success: true,
        staff: [],
        message: 'Staff information temporarily unavailable',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ==================== BOOKING MANAGEMENT METHODS ====================

/**
   * Get user's bookings with enhanced filtering - FIXED with proper aliases
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
    if (bookingType) whereClause.bookingType = bookingType;

    if (upcoming === 'true') {
      whereClause.startTime = {
        [Op.gte]: new Date()
      };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // FIXED: Use exact associations from your models/index.js
    const { count, rows: bookings } = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Offer,
          as: 'offer', // matches your index.js
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
          model: User,
          as: 'bookingUser', // FIXED: your index.js uses 'bookingUser', not 'user'
          required: false,
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
        },
        {
          model: Store,
          as: 'store', // matches your index.js
          required: false,
          attributes: ['id', 'name', 'location', 'phone_number']
        }
        // Removed Staff, Payment, Service, Branch - these associations don't exist in your index.js
      ],
      order: [['startTime', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    // Enhanced booking processing - map actual associations to frontend format
    const enhancedBookings = bookings.map(booking => {
      const bookingJson = booking.toJSON();

      // Add computed fields
      bookingJson.isOfferBooking = booking.bookingType === 'offer' || !!booking.offerId;
      bookingJson.isServiceBooking = booking.bookingType === 'service' || (!booking.offerId && !!booking.serviceId);
      bookingJson.requiresPayment = bookingJson.isOfferBooking;
      bookingJson.accessFeePaid = bookingJson.isOfferBooking && !!booking.paymentId;

      // Map actual associations to frontend-expected format
      if (booking.offer) {
        bookingJson.Offer = booking.offer;
      }
      
      // FIXED: Map 'bookingUser' to 'User' for frontend compatibility
      if (booking.bookingUser) {
        bookingJson.User = booking.bookingUser;
      }
      
      if (booking.store) {
        bookingJson.Store = booking.store;
      }
      
      // For service bookings, get service info from offer->service if available
      // This is a limitation until we add direct Service association
      if (bookingJson.isServiceBooking && !bookingJson.Service && booking.offer?.service) {
        bookingJson.Service = booking.offer.service;
      }

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
    
    // Enhanced error handling for association issues
    if (error.name === 'SequelizeEagerLoadingError') {
      console.error('Association error details:', {
        message: error.message,
        original: error.original?.message
      });
      
      return res.status(500).json({
        success: false,
        message: 'Database association error. Please contact support.',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Association error'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
  /**
   * Get booking by ID
   */
  async getBookingById(req, res) {
    try {
      const { bookingId } = req.params;

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Booking service temporarily unavailable'
        });
      }

      const booking = await Booking.findByPk(bookingId, {
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
          },
          {
            model: Staff,
            required: false,
            attributes: ['id', 'name', 'role']
          },
          ...(Branch ? [{
            model: Branch,
            required: false,
            attributes: ['id', 'name', 'address', 'phone']
          }] : [])
        ]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      const bookingJson = booking.toJSON();
      bookingJson.isOfferBooking = booking.bookingType === 'offer' || !!booking.offerId;
      bookingJson.isServiceBooking = booking.bookingType === 'service' || (!booking.offerId && !!booking.serviceId);
      bookingJson.requiresPayment = bookingJson.isOfferBooking;
      bookingJson.accessFeePaid = bookingJson.isOfferBooking && !!booking.paymentId;

      res.status(200).json({
        success: true,
        booking: bookingJson
      });

    } catch (error) {
      console.error('Error fetching booking:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch booking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(req, res) {
    try {
      const { bookingId } = req.params;
      const { status } = req.body;

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Booking service temporarily unavailable'
        });
      }

      const booking = await Booking.findByPk(bookingId);

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      await booking.update({ status });

      res.status(200).json({
        success: true,
        booking: booking,
        message: 'Booking status updated successfully'
      });

    } catch (error) {
      console.error('Error updating booking status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update booking status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Cancel booking
   */
  async cancelBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { reason = '', refundRequested = false } = req.body;

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Booking service temporarily unavailable'
        });
      }

      const booking = await Booking.findByPk(bookingId, {
        include: [
          { model: Offer, required: false },
          { model: Service, required: false },
          { model: Payment, required: false }
        ]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (['cancelled', 'completed'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: 'Booking is already cancelled or completed'
        });
      }

      const now = new Date();
      const bookingStart = new Date(booking.startTime);
      const hoursUntilBooking = (bookingStart - now) / (1000 * 60 * 60);

      const minCancellationHours = booking.bookingType === 'offer' ? 2 : 0.5;

      if (hoursUntilBooking < minCancellationHours) {
        return res.status(400).json({
          success: false,
          message: `Must cancel at least ${minCancellationHours} hour${minCancellationHours > 1 ? 's' : ''} before appointment`
        });
      }

      await booking.update({
        status: 'cancelled',
        cancellationReason: reason,
        cancelledAt: now
      });

      let refund = null;
      if (booking.bookingType === 'offer' && booking.paymentId && refundRequested && hoursUntilBooking >= 24) {
        try {
          console.log('Processing refund for booking:', bookingId);
        } catch (refundError) {
          console.error('Refund processing failed:', refundError);
        }
      }

      res.status(200).json({
        success: true,
        booking: booking,
        refund: refund,
        message: 'Booking cancelled successfully'
      });

    } catch (error) {
      console.error('Error cancelling booking:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel booking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }


  // Add these methods to your enhancedBookingController.js file

  /**
   * Get all bookings for merchant's stores/services
   */
  async getMerchantBookings(req, res) {
    try {
      console.log('📋 Getting merchant bookings');

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Booking service temporarily unavailable'
        });
      }

      const { bookingType, status, storeId, page = 1, limit = 50 } = req.query;
      
      // Get merchant info from authenticated request
      const merchantId = req.user?.merchantId || req.merchant?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Merchant authentication required'
        });
      }

      // First, get all stores for this merchant
      let merchantStoreIds = [];
      if (Store) {
        const merchantStores = await Store.findAll({
          where: { merchant_id: merchantId },
          attributes: ['id']
        });
        merchantStoreIds = merchantStores.map(store => store.id);
        
        if (merchantStoreIds.length === 0) {
          return res.status(200).json({
            success: true,
            bookings: [],
            message: 'No stores found for this merchant'
          });
        }
      }

      // Build where clause for bookings
      const whereClause = {};
      
      // Filter by booking type if specified
      if (bookingType) {
        whereClause.bookingType = bookingType;
      }
      
      // Filter by status if specified
      if (status) {
        whereClause.status = status;
      }
      
      // Filter by specific store if specified
      if (storeId) {
        whereClause.storeId = storeId;
      } else if (merchantStoreIds.length > 0) {
        // Filter by merchant's stores
        whereClause.storeId = {
          [Op.in]: merchantStoreIds
        };
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Fetch bookings with associations
      const { count, rows: bookings } = await Booking.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'bookingUser',
            required: false,
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
          },
          {
            model: Offer,
            as: 'offer',
            required: false,
            include: [{
              model: Service,
              as: 'service',
              required: false,
              attributes: ['id', 'name', 'duration', 'price']
            }]
          },
          {
            model: Store,
            as: 'store',
            required: false,
            attributes: ['id', 'name', 'location']
          },
          ...(Staff ? [{
            model: Staff,
            as: 'staff',
            required: false,
            attributes: ['id', 'name', 'role']
          }] : [])
        ],
        order: [['startTime', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      // Process bookings for response
      const processedBookings = bookings.map(booking => {
        const bookingData = booking.toJSON();
        
        // Add computed fields
        bookingData.isOfferBooking = booking.bookingType === 'offer' || !!booking.offerId;
        bookingData.isServiceBooking = booking.bookingType === 'service' || (!booking.offerId && !!booking.serviceId);
        
        return bookingData;
      });

      // Calculate summary statistics
      const summary = {
        total: count,
        offerBookings: processedBookings.filter(b => b.isOfferBooking).length,
        serviceBookings: processedBookings.filter(b => b.isServiceBooking).length,
        confirmedBookings: processedBookings.filter(b => b.status === 'confirmed').length,
        pendingBookings: processedBookings.filter(b => b.status === 'pending').length,
        completedBookings: processedBookings.filter(b => b.status === 'completed').length,
        cancelledBookings: processedBookings.filter(b => b.status === 'cancelled').length,
        upcomingBookings: processedBookings.filter(b => new Date(b.startTime) > new Date()).length
      };

      console.log(`✅ Retrieved ${count} merchant bookings`);

      res.status(200).json({
        success: true,
        bookings: processedBookings,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        summary,
        message: count === 0 ? 'No bookings found' : undefined
      });

    } catch (error) {
      console.error('💥 Error getting merchant bookings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch merchant bookings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

   /**
   * Get bookings for a specific merchant store - FIXED: Add missing method
   */
   async getMerchantStoreBookings(req, res) {
    try {
      const { storeId } = req.params;
      const { bookingType, status, page = 1, limit = 50 } = req.query;
      
      console.log('🏪 Getting bookings for merchant store:', storeId);

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Booking service temporarily unavailable'
        });
      }

      // Verify the store belongs to the authenticated merchant
      const merchantId = req.user?.merchantId || req.merchant?.id || req.user?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Merchant authentication required'
        });
      }

      // Verify store ownership if Store model exists
      if (Store) {
        const store = await Store.findOne({
          where: { id: storeId, merchant_id: merchantId }
        });

        if (!store) {
          return res.status(404).json({
            success: false,
            message: 'Store not found or access denied'
          });
        }
      }

      // Build where clause
      const whereClause = { storeId };
      
      if (bookingType) whereClause.bookingType = bookingType;
      if (status) whereClause.status = status;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Fetch bookings with associations
      const { count, rows: bookings } = await Booking.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'bookingUser',
            required: false,
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
          },
          {
            model: Offer,
            as: 'offer',
            required: false,
            include: [{
              model: Service,
              as: 'service',
              required: false,
              attributes: ['id', 'name', 'duration', 'price']
            }]
          },
          {
            model: Store,
            as: 'store',
            required: false,
            attributes: ['id', 'name', 'location']
          },
          ...(Staff ? [{
            model: Staff,
            as: 'staff',
            required: false,
            attributes: ['id', 'name', 'role']
          }] : [])
        ],
        order: [['startTime', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      // Process bookings for response
      const processedBookings = bookings.map(booking => {
        const bookingData = booking.toJSON();
        
        // Add computed fields
        bookingData.isOfferBooking = booking.bookingType === 'offer' || !!booking.offerId;
        bookingData.isServiceBooking = booking.bookingType === 'service' || (!booking.offerId && !!booking.serviceId);
        bookingData.requiresPayment = bookingData.isOfferBooking;
        
        // Map associations for frontend compatibility
        if (booking.bookingUser) {
          bookingData.User = booking.bookingUser;
        }
        
        return bookingData;
      });

      // Calculate summary statistics
      const summary = {
        total: count,
        offerBookings: processedBookings.filter(b => b.isOfferBooking).length,
        serviceBookings: processedBookings.filter(b => b.isServiceBooking).length,
        confirmedBookings: processedBookings.filter(b => b.status === 'confirmed').length,
        pendingBookings: processedBookings.filter(b => b.status === 'pending').length,
        completedBookings: processedBookings.filter(b => b.status === 'completed').length,
        cancelledBookings: processedBookings.filter(b => b.status === 'cancelled').length,
        upcomingBookings: processedBookings.filter(b => new Date(b.startTime) > new Date()).length
      };

      console.log(`✅ Retrieved ${count} store bookings`);

      res.status(200).json({
        success: true,
        bookings: processedBookings,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        summary,
        message: count === 0 ? 'No bookings found for this store' : undefined
      });

    } catch (error) {
      console.error('💥 Error getting store bookings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch store bookings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Update booking status (merchant action) - FIXED: Add missing method
   */
  async merchantUpdateBookingStatus(req, res) {
    try {
      const { bookingId } = req.params;
      const { status, notes } = req.body;
      
      console.log(`🔄 Merchant updating booking ${bookingId} status to: ${status}`);

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Booking service temporarily unavailable'
        });
      }

      // Verify merchant authentication
      const merchantId = req.user?.merchantId || req.merchant?.id || req.user?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Merchant authentication required'
        });
      }

      // Find the booking and verify merchant ownership
      const booking = await Booking.findByPk(bookingId, {
        include: [{
          model: Store,
          as: 'store',
          required: false,
          where: Store ? { merchant_id: merchantId } : undefined
        }]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found or access denied'
        });
      }

      // Validate status
      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status',
          validStatuses
        });
      }

      // Update the booking
      const updateData = {
        status,
        updatedBy: 'merchant',
        updatedAt: new Date()
      };

      if (notes) {
        updateData.merchantNotes = notes;
      }

      await booking.update(updateData);

      // Fetch updated booking with associations
      const updatedBooking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: User,
            as: 'bookingUser',
            required: false,
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
          },
          {
            model: Offer,
            as: 'offer',
            required: false
          },
          {
            model: Store,
            as: 'store',
            required: false,
            attributes: ['id', 'name', 'location']
          }
        ]
      });

      console.log('✅ Merchant booking status updated successfully');

      res.status(200).json({
        success: true,
        booking: updatedBooking,
        message: 'Booking status updated successfully',
        updatedFields: {
          status,
          notes: notes || null,
          updatedAt: updateData.updatedAt
        }
      });

    } catch (error) {
      console.error('💥 Error updating merchant booking status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update booking status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==================== ENHANCED MERCHANT METHODS ====================

  /**
   * Get all bookings for merchant (enhanced version)
   */
  async getAllMerchantBookings(req, res) {
    try {
      console.log('📋 Getting all merchant bookings (enhanced)');

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Booking service temporarily unavailable'
        });
      }

      const { bookingType, status, page = 1, limit = 50, startDate, endDate, storeId } = req.query;
      
      // Get merchant info from authenticated request
      const merchantId = req.user?.merchantId || req.merchant?.id || req.user?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Merchant authentication required'
        });
      }

      // Get all stores for this merchant
      let merchantStoreIds = [];
      if (Store) {
        const merchantStores = await Store.findAll({
          where: { merchant_id: merchantId },
          attributes: ['id', 'name']
        });
        merchantStoreIds = merchantStores.map(store => store.id);
        
        if (merchantStoreIds.length === 0) {
          return res.status(200).json({
            success: true,
            bookings: [],
            pagination: {
              total: 0,
              page: parseInt(page),
              limit: parseInt(limit),
              totalPages: 0
            },
            summary: {
              total: 0,
              offerBookings: 0,
              serviceBookings: 0,
              confirmedBookings: 0,
              pendingBookings: 0,
              completedBookings: 0,
              cancelledBookings: 0,
              upcomingBookings: 0
            },
            message: 'No stores found for this merchant'
          });
        }
      }

      // Build where clause
      const whereClause = {};
      
      // Filter by merchant's stores
      if (storeId) {
        // Verify the store belongs to this merchant
        if (!merchantStoreIds.includes(storeId)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied for this store'
          });
        }
        whereClause.storeId = storeId;
      } else if (merchantStoreIds.length > 0) {
        whereClause.storeId = {
          [Op.in]: merchantStoreIds
        };
      }
      
      // Filter by booking type if specified
      if (bookingType) {
        whereClause.bookingType = bookingType;
      }
      
      // Filter by status if specified
      if (status) {
        whereClause.status = status;
      }

      // Filter by date range if specified
      if (startDate || endDate) {
        whereClause.startTime = {};
        if (startDate) {
          whereClause.startTime[Op.gte] = new Date(startDate);
        }
        if (endDate) {
          whereClause.startTime[Op.lte] = new Date(endDate);
        }
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Fetch bookings with associations
      const { count, rows: bookings } = await Booking.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'bookingUser',
            required: false,
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
          },
          {
            model: Offer,
            as: 'offer',
            required: false,
            include: [{
              model: Service,
              as: 'service',
              required: false,
              attributes: ['id', 'name', 'duration', 'price']
            }]
          },
          {
            model: Store,
            as: 'store',
            required: false,
            attributes: ['id', 'name', 'location']
          },
          ...(Staff ? [{
            model: Staff,
            as: 'staff',
            required: false,
            attributes: ['id', 'name', 'role']
          }] : [])
        ],
        order: [['startTime', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      // Process bookings for response
      const processedBookings = bookings.map(booking => {
        const bookingData = booking.toJSON();
        
        // Add computed fields
        bookingData.isOfferBooking = booking.bookingType === 'offer' || !!booking.offerId;
        bookingData.isServiceBooking = booking.bookingType === 'service' || (!booking.offerId && !!booking.serviceId);
        bookingData.requiresPayment = bookingData.isOfferBooking;
        
        // Map associations for frontend compatibility
        if (booking.bookingUser) {
          bookingData.User = booking.bookingUser;
        }
        
        return bookingData;
      });

      // Calculate summary statistics
      const summary = {
        total: count,
        offerBookings: processedBookings.filter(b => b.isOfferBooking).length,
        serviceBookings: processedBookings.filter(b => b.isServiceBooking).length,
        confirmedBookings: processedBookings.filter(b => b.status === 'confirmed').length,
        pendingBookings: processedBookings.filter(b => b.status === 'pending').length,
        completedBookings: processedBookings.filter(b => b.status === 'completed').length,
        cancelledBookings: processedBookings.filter(b => b.status === 'cancelled').length,
        upcomingBookings: processedBookings.filter(b => new Date(b.startTime) > new Date()).length
      };

      console.log(`✅ Retrieved ${count} merchant bookings`);

      res.status(200).json({
        success: true,
        bookings: processedBookings,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        summary,
        message: count === 0 ? 'No bookings found' : undefined
      });

    } catch (error) {
      console.error('💥 Error getting merchant bookings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch merchant bookings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Update booking status (merchant action) - FIXED: Add missing alias method
   */
  async merchantUpdateBookingStatus(req, res) {
    try {
      const { bookingId } = req.params;
      const { status, notes } = req.body;
      
      console.log(`🔄 Merchant updating booking ${bookingId} status to: ${status}`);

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Booking service temporarily unavailable'
        });
      }

      // Verify merchant authentication
      const merchantId = req.user?.merchantId || req.merchant?.id || req.user?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Merchant authentication required'
        });
      }

      // Find the booking and verify merchant ownership through store
      const booking = await Booking.findByPk(bookingId, {
        include: [{
          model: Store,
          as: 'store',
          required: false
        }]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Verify store ownership if Store model exists and store is associated
      if (Store && booking.store && booking.store.merchant_id !== merchantId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this booking'
        });
      }

      // Validate status
      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status',
          validStatuses
        });
      }

      // Update the booking
      const updateData = {
        status,
        updatedBy: 'merchant',
        updatedAt: new Date()
      };

      if (notes) {
        updateData.merchantNotes = notes;
      }

      await booking.update(updateData);

      // Fetch updated booking with associations
      const updatedBooking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: User,
            as: 'bookingUser',
            required: false,
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
          },
          {
            model: Offer,
            as: 'offer',
            required: false
          },
          {
            model: Store,
            as: 'store',
            required: false,
            attributes: ['id', 'name', 'location']
          }
        ]
      });

      console.log('✅ Merchant booking status updated successfully');

      res.status(200).json({
        success: true,
        booking: updatedBooking,
        message: 'Booking status updated successfully',
        updatedFields: {
          status,
          notes: notes || null,
          updatedAt: updateData.updatedAt
        }
      });

    } catch (error) {
      console.error('💥 Error updating merchant booking status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update booking status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }


/**
   * Get booking by ID (merchant version with ownership verification)
   */
async getMerchantBookingById(req, res) {
  try {
    const { bookingId } = req.params;

    console.log('🔍 Getting merchant booking by ID:', bookingId);

    if (!Booking) {
      return res.status(503).json({
        success: false,
        message: 'Booking service temporarily unavailable'
      });
    }

    // Verify merchant authentication
    const merchantId = req.user?.merchantId || req.merchant?.id || req.user?.id;
    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: 'Merchant authentication required'
      });
    }

    console.log('🏪 Merchant ID:', merchantId);

    // Find the booking with merchant ownership verification
    // FIXED: Only use associations that exist in your models (same as getUserBookings)
    const booking = await Booking.findOne({
      where: { id: bookingId },
      include: [
        {
          model: Offer,
          as: 'offer',
          required: false,
          include: [{
            model: Service,
            as: 'service',
            required: false,
            attributes: ['id', 'name', 'duration', 'price', 'description', 'category'],
            include: [{
              model: Store,
              as: 'store',
              required: false,
              attributes: ['id', 'name', 'location', 'phone_number']
            }]
          }]
        },
        {
          model: User,
          as: 'bookingUser', // This is the correct alias from your models
          required: false,
          attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'createdAt']
        },
        {
          model: Store,
          as: 'store',
          required: false,
          attributes: ['id', 'name', 'location', 'phone_number']
        }
        // NOTE: Removed Payment and Staff includes as these associations don't exist
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or access denied'
      });
    }

    // Verify merchant ownership through store
    if (Store && booking.store && booking.store.merchant_id !== merchantId) {
      console.log('Access denied: booking store merchant_id does not match authenticated merchant');
      return res.status(403).json({
        success: false,
        message: 'Access denied for this booking'
      });
    }

    // Process booking data for response
    const bookingJson = booking.toJSON();
    
    // Add computed fields for frontend compatibility
    bookingJson.isOfferBooking = booking.bookingType === 'offer' || !!booking.offerId;
    bookingJson.isServiceBooking = booking.bookingType === 'service' || (!booking.offerId && !!booking.serviceId);
    bookingJson.requiresPayment = bookingJson.isOfferBooking;
    bookingJson.accessFeePaid = bookingJson.isOfferBooking && !!booking.paymentId;

    // Map associations for frontend compatibility
    if (booking.bookingUser) {
      bookingJson.User = booking.bookingUser;
    }

    // Calculate pricing information for offers
    if (bookingJson.isOfferBooking && booking.offer?.service) {
      const originalPrice = parseFloat(booking.offer.service.price) || 0;
      const discount = parseFloat(booking.offer.discount) || 0;
      const accessFee = parseFloat(booking.accessFee) || 0;
      
      bookingJson.pricingInfo = {
        originalPrice,
        discount,
        discountedPrice: originalPrice * (1 - discount / 100),
        accessFee,
        remainingAtStore: (originalPrice * (1 - discount / 100)) - accessFee
      };
    }

    console.log('✅ Merchant booking retrieved successfully');

    res.status(200).json({
      success: true,
      booking: bookingJson,
      message: 'Booking retrieved successfully'
    });

  } catch (error) {
    console.error('💥 Error getting merchant booking by ID:', error);
    
    if (error.name === 'SequelizeEagerLoadingError') {
      return res.status(500).json({
        success: false,
        message: 'Database association error occurred',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Association error'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
/**
   * Get booking by ID (merchant version with ownership verification)
   */
  async getMerchantBookingById(req, res) {
    try {
      const { bookingId } = req.params;

      console.log('🔍 Getting merchant booking by ID:', bookingId);

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Booking service temporarily unavailable'
        });
      }

      // Verify merchant authentication
      const merchantId = req.user?.merchantId || req.merchant?.id || req.user?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Merchant authentication required'
        });
      }

      console.log('🏪 Merchant ID:', merchantId);

      // Find the booking with merchant ownership verification
      const booking = await Booking.findOne({
        where: { id: bookingId },
        include: [
          {
            model: Store,
            as: 'store',
            required: false,
            where: Store ? { merchant_id: merchantId } : undefined,
            attributes: ['id', 'name', 'location', 'phone_number']
          },
          {
            model: User,
            as: 'bookingUser',
            required: false,
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'createdAt']
          },
          {
            model: Offer,
            as: 'offer',
            required: false,
            include: [{
              model: Service,
              as: 'service',
              required: false,
              attributes: ['id', 'name', 'duration', 'price', 'description', 'category']
            }]
          },
          ...(Service ? [{
            model: Service,
            as: 'service',
            required: false,
            attributes: ['id', 'name', 'duration', 'price', 'description', 'category'],
            include: [{
              model: Store,
              as: 'store',
              required: false,
              attributes: ['id', 'name', 'location']
            }]
          }] : []),
          ...(Payment ? [{
            model: Payment,
            as: 'payment',
            required: false,
            attributes: ['id', 'status', 'amount', 'method', 'transaction_id', 'unique_code']
          }] : []),
          ...(Staff ? [{
            model: Staff,
            as: 'staff',
            required: false,
            attributes: ['id', 'name', 'role', 'email']
          }] : [])
        ]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found or access denied'
        });
      }

      // Additional ownership verification if Store model exists
      if (Store && booking.store && booking.store.merchant_id !== merchantId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this booking'
        });
      }

      // Process booking data for response
      const bookingJson = booking.toJSON();
      
      // Add computed fields for frontend compatibility
      bookingJson.isOfferBooking = booking.bookingType === 'offer' || !!booking.offerId;
      bookingJson.isServiceBooking = booking.bookingType === 'service' || (!booking.offerId && !!booking.serviceId);
      bookingJson.requiresPayment = bookingJson.isOfferBooking;
      bookingJson.accessFeePaid = bookingJson.isOfferBooking && !!booking.paymentId;

      // Map associations for frontend compatibility
      if (booking.bookingUser) {
        bookingJson.User = booking.bookingUser;
      }

      // Calculate pricing information for offers
      if (bookingJson.isOfferBooking && booking.offer?.service) {
        const originalPrice = parseFloat(booking.offer.service.price) || 0;
        const discount = parseFloat(booking.offer.discount) || 0;
        const accessFee = parseFloat(booking.accessFee) || 0;
        
        bookingJson.pricingInfo = {
          originalPrice,
          discount,
          discountedPrice: originalPrice * (1 - discount / 100),
          accessFee,
          remainingAtStore: (originalPrice * (1 - discount / 100)) - accessFee
        };
      }

      console.log('✅ Merchant booking retrieved successfully');

      res.status(200).json({
        success: true,
        booking: bookingJson,
        message: 'Booking retrieved successfully'
      });

    } catch (error) {
      console.error('💥 Error getting merchant booking by ID:', error);
      
      if (error.name === 'SequelizeEagerLoadingError') {
        return res.status(500).json({
          success: false,
          message: 'Database association error occurred',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Association error'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch booking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Get bookings for a specific merchant store
   */
  async getMerchantStoreBookings(req, res) {
    try {
      const { storeId } = req.params;
      console.log('🏪 Getting bookings for merchant store:', storeId);

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Booking service temporarily unavailable'
        });
      }

      // Verify the store belongs to the authenticated merchant
      const merchantId = req.user?.merchantId || req.merchant?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Merchant authentication required'
        });
      }

      if (Store) {
        const store = await Store.findOne({
          where: { id: storeId, merchant_id: merchantId }
        });

        if (!store) {
          return res.status(404).json({
            success: false,
            message: 'Store not found or access denied'
          });
        }
      }

      const { bookingType, status, page = 1, limit = 50 } = req.query;
      
      const whereClause = { storeId };
      
      if (bookingType) whereClause.bookingType = bookingType;
      if (status) whereClause.status = status;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows: bookings } = await Booking.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'bookingUser',
            required: false,
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
          },
          {
            model: Offer,
            as: 'offer',
            required: false,
            include: [{
              model: Service,
              as: 'service',
              required: false,
              attributes: ['id', 'name', 'duration', 'price']
            }]
          },
          {
            model: Store,
            as: 'store',
            required: false,
            attributes: ['id', 'name', 'location']
          },
          ...(Staff ? [{
            model: Staff,
            as: 'staff',
            required: false,
            attributes: ['id', 'name', 'role']
          }] : [])
        ],
        order: [['startTime', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      console.log(`✅ Retrieved ${count} store bookings`);

      res.status(200).json({
        success: true,
        bookings: bookings,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('💥 Error getting store bookings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch store bookings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Update booking status (merchant action)
   */
  async merchantUpdateBookingStatus(req, res) {
    try {
      const { bookingId } = req.params;
      const { status, notes } = req.body;
      
      console.log(`🔄 Merchant updating booking ${bookingId} status to: ${status}`);

      if (!Booking) {
        return res.status(503).json({
          success: false,
          message: 'Booking service temporarily unavailable'
        });
      }

      // Verify merchant ownership
      const merchantId = req.user?.merchantId || req.merchant?.id;
      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Merchant authentication required'
        });
      }

      // Find the booking and verify ownership
      const booking = await Booking.findByPk(bookingId, {
        include: [{
          model: Store,
          as: 'store',
          required: true,
          where: { merchant_id: merchantId }
        }]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found or access denied'
        });
      }

      // Validate status
      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status',
          validStatuses
        });
      }

      // Update the booking
      await booking.update({
        status,
        ...(notes && { merchantNotes: notes }),
        updatedBy: 'merchant',
        updatedAt: new Date()
      });

      console.log('✅ Booking status updated successfully');

      res.status(200).json({
        success: true,
        booking: booking,
        message: 'Booking status updated successfully'
      });

    } catch (error) {
      console.error('💥 Error updating booking status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update booking status',
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
   * Send booking confirmation email
   */
  async sendBookingConfirmationEmail(booking, entity, user, store, staff, bookingType) {
    console.log(`📧 Sending confirmation email for ${bookingType} booking:`, booking.id);

    try {
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

    } catch (error) {
      console.error('Email sending failed:', error);
    }
  }

  /**
   * Debug working days format
   */
  async debugWorkingDays(req, res) {
    try {
      const { entityId, entityType } = req.query;

      if (!entityId || !entityType) {
        return res.status(400).json({
          success: false,
          message: 'Entity ID and entity type are required'
        });
      }

      console.log(`🐛 Debug working days for ${entityType}: ${entityId}`);

      let entity, service, store;

      if (entityType === 'offer') {
        entity = await Offer.findByPk(entityId, {
          include: [{
            model: Service,
            as: 'service',
            include: [{
              model: Store,
              as: 'store'
            }]
          }]
        });
        service = entity?.service;
        store = service?.store;
      } else {
        service = await Service.findByPk(entityId, {
          include: [{
            model: Store,
            as: 'store'
          }]
        });
        store = service?.store;
      }

      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found for this entity'
        });
      }

      const debugResult = slotService.debugWorkingDays(store);

      const testDates = [];
      for (let i = 0; i < 7; i++) {
        const testDate = moment().add(i, 'days').format('YYYY-MM-DD');
        const validation = slotService.validateDateAndStore(testDate, store);
        testDates.push({
          date: testDate,
          dayName: moment(testDate).format('dddd'),
          isValid: validation.isValid,
          message: validation.message,
          debug: validation.debug
        });
      }

      return res.status(200).json({
        success: true,
        debug: {
          entityId,
          entityType,
          store: {
            id: store.id,
            name: store.name,
            working_days: store.working_days,
            opening_time: store.opening_time,
            closing_time: store.closing_time
          },
          workingDaysAnalysis: debugResult,
          weekValidation: testDates
        }
      });

    } catch (error) {
      console.error('💥 Debug working days error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error debugging working days',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==================== HELPER METHODS ====================

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
  createOfferBooking: enhancedBookingController.createOfferBooking.bind(enhancedBookingController),
  createServiceBooking: enhancedBookingController.createServiceBooking.bind(enhancedBookingController),

  // Unified slot methods
  getUnifiedSlots: enhancedBookingController.getUnifiedSlots.bind(enhancedBookingController),

  // Legacy slot methods
  getAvailableSlots: enhancedBookingController.getAvailableSlots.bind(enhancedBookingController),
  getAvailableSlotsForOffer: enhancedBookingController.getAvailableSlotsForOffer.bind(enhancedBookingController),
  getAvailableSlotsForService: enhancedBookingController.getAvailableSlotsForService.bind(enhancedBookingController),

  // Branch methods
  getBranchesForOffer: enhancedBookingController.getBranchesForOffer.bind(enhancedBookingController),
  getBranchesForService: enhancedBookingController.getBranchesForService.bind(enhancedBookingController),

  // Enhanced staff methods
  getStaffForOffer: enhancedBookingController.getStaffForOffer.bind(enhancedBookingController),
  getStaffForService: enhancedBookingController.getStaffForService.bind(enhancedBookingController),

  // Legacy store and staff methods
  getStoresForOffer: enhancedBookingController.getStoresForOffer.bind(enhancedBookingController),
  getStoresForService: enhancedBookingController.getStoresForService.bind(enhancedBookingController),
  getStaffForStore: enhancedBookingController.getStaffForStore.bind(enhancedBookingController),

  // User booking methods
  getUserBookings: enhancedBookingController.getUserBookings.bind(enhancedBookingController),
  getBookingById: enhancedBookingController.getBookingById.bind(enhancedBookingController),
  updateBookingStatus: enhancedBookingController.updateBookingStatus.bind(enhancedBookingController),
  cancelBooking: enhancedBookingController.cancelBooking.bind(enhancedBookingController),

  // FIXED: Add the missing merchant booking methods
  getMerchantBookings: enhancedBookingController.getMerchantBookings.bind(enhancedBookingController),
  getMerchantStoreBookings: enhancedBookingController.getMerchantStoreBookings.bind(enhancedBookingController),
  getAllMerchantBookings: enhancedBookingController.getAllMerchantBookings.bind(enhancedBookingController),
  getMerchantBookingById: enhancedBookingController.getMerchantBookingById.bind(enhancedBookingController),
  merchantUpdateBookingStatus: enhancedBookingController.merchantUpdateBookingStatus.bind(enhancedBookingController),

  // Debug methods
  debugWorkingDays: enhancedBookingController.debugWorkingDays.bind(enhancedBookingController),

  // Export the class itself
  EnhancedBookingController,

  // Export instance for direct use
  default: enhancedBookingController
};