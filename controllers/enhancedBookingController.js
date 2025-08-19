// controllers/enhancedBookingController.js - Complete with branch support

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
        branchId, // NEW: Support for branchId
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
        branchId,
        staffId,
        bookingType
      });

      // Validate booking type
      const determinedBookingType = bookingType || (offerId ? 'offer' : 'service');
      
      if (!['offer', 'service'].includes(determinedBookingType)) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Valid booking type (offer or service) is required'
        });
      }

      // Validate required fields based on booking type
      if (determinedBookingType === 'offer' && !offerId) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Offer ID is required for offer bookings'
        });
      }

      if (determinedBookingType === 'service' && !serviceId) {
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

      if (service.canAcceptBooking && !service.canAcceptBooking(advanceMinutes)) {
        if (transaction) await transaction.rollback();
        const minAdvance = Math.ceil((service.min_advance_booking || 60) / 60);
        const maxAdvance = Math.ceil((service.max_advance_booking || 7 * 24 * 60) / (60 * 24));
        return res.status(400).json({
          success: false,
          message: `Booking must be made between ${minAdvance} hours and ${maxAdvance} days in advance`
        });
      }

      // CRITICAL: Check slot availability
      const date = moment(startTime).format('YYYY-MM-DD');
      const time = moment(startTime).format('h:mm A');

      const entityIdForSlot = determinedBookingType === 'offer' ? offerId : serviceId;
      const availabilityCheck = await slotService.isSlotAvailable(entityIdForSlot, determinedBookingType, date, time);

      if (!availabilityCheck.available) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: availabilityCheck.reason || 'Selected time slot is no longer available'
        });
      }

      console.log(`✅ Slot availability confirmed: ${availabilityCheck.remainingSlots} remaining`);

      // Validate branch and staff if provided
      let bookingBranch = null;
      let bookingStore = null;

      // NEW: Handle branch validation
      if (branchId && Branch) {
        bookingBranch = await Branch.findByPk(branchId, {
          ...(transaction && { transaction })
        });
        if (!bookingBranch) {
          if (transaction) await transaction.rollback();
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
          if (transaction) await transaction.rollback();
          return res.status(404).json({
            success: false,
            message: 'Staff member not found or not available at this location'
          });
        }
      }

      // Calculate end time based on service duration
      const serviceDuration = service.duration || 60;
      const endTime = moment(startTime).add(serviceDuration, 'minutes').toDate();

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
            if (transaction) await transaction.rollback();
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

      // Create the booking
      const bookingData = {
        offerId: determinedBookingType === 'offer' ? offerId : null,
        serviceId: serviceId || service.id, // Always store service ID for reference
        userId,
        startTime: moment(startTime).toDate(),
        endTime,
        status: determinedBookingType === 'offer' ? (paymentRecord ? 'confirmed' : 'pending') : 'confirmed',
        storeId: bookingStore?.id,
        branchId: bookingBranch?.id, // NEW: Store branchId
        staffId: bookingStaff?.id,
        notes: notes || '',
        paymentId: paymentRecord?.id,
        paymentUniqueCode: paymentRecord?.unique_code,
        accessFee: accessFee,
        bookingType: determinedBookingType
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
        await this.sendBookingConfirmationEmail(booking, bookingEntity, user, bookingStore, bookingStaff, determinedBookingType);
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
          },
          ...(Branch ? [{
            model: Branch,
            required: false
          }] : [])
        ]
      });

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
      if (transaction) await transaction.rollback();
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

  // ==================== BRANCH AND STAFF ROUTES - NEW ====================

  /**
   * NEW: Get staff specifically for an offer (gets service branch and assigned staff)
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
  
      // FIXED: Get offer with service and branch details using correct field names
      const offer = await Offer.findByPk(offerId, {
        include: [{
          model: Service,
          as: 'service',
          attributes: ['id', 'name', 'branch_id', 'store_id'],
          include: [{
            model: Store,
            as: 'store',
            attributes: ['id', 'name', 'location']  // FIXED: Only use guaranteed columns
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
      console.log('📋 FIXED: Service details:', {
        serviceId: service.id,
        serviceName: service.name,
        branchId: service.branch_id,
        storeId: service.store_id
      });
  
      // Get staff assigned to this service's branch and this specific service
      let staff = [];
  
      if (Staff && service.branch_id) {
        // Staff assigned to the service's branch AND this specific service
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
          // Fallback: All active staff from the service's branch
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
        // Fallback: If no branch_id, get staff from the store
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
  
      // Clean staff data
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
      console.error('❌ FIXED: Error getting staff for offer:', error);
      
      // Always return success to avoid breaking booking flow
      res.status(200).json({
        success: true,
        staff: [],
        message: 'Staff information temporarily unavailable',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  /**
   * NEW: Get staff specifically for a service (gets branch and assigned staff)
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
  
      // FIXED: Get service with branch details using correct field names
      const service = await Service.findByPk(serviceId, {
        attributes: ['id', 'name', 'branch_id', 'store_id'],
        include: [{
          model: Store,
          as: 'store',
          attributes: ['id', 'name', 'location']  // FIXED: Only use guaranteed columns
        }]
      });
  
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
  
      console.log('📋 FIXED: Service details:', {
        serviceId: service.id,
        serviceName: service.name,
        branchId: service.branch_id,
        storeId: service.store_id
      });
  
      // Get staff assigned to this service's branch and this specific service
      let staff = [];
  
      if (service.branch_id) {
        // Staff from service's branch assigned to this service
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
          // Fallback: All staff from the branch
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
        // Fallback: Staff from store if no branch
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
      console.error('❌ FIXED: Error getting staff for service:', error);
      
      res.status(200).json({
        success: true,
        staff: [],
        message: 'Staff information temporarily unavailable',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * NEW: Get branches for offer (instead of stores)
   */
  async getBranchesForOffer(req, res) {
    try {
      const { offerId } = req.params;
  
      console.log('🏢 Getting branch for offer:', offerId);
  
      // FIXED: Use correct Store column names from your model
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
              'phone_number',      // FIXED: Correct column name
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
      
      console.log('📋 FIXED: Service details:', {
        serviceId: service.id,
        serviceName: service.name,
        branchId: service.branch_id,
        storeId: service.store_id
      });
      
      // If service has a branch_id, get branch details
      let branch = null;
      if (service.branch_id && Branch) {
        try {
          branch = await Branch.findByPk(service.branch_id, {
            attributes: ['id', 'name', 'address', 'phone', 'openingTime', 'closingTime', 'workingDays']
          });
          
          if (branch) {
            console.log('✅ FIXED: Branch found:', branch.name);
          }
        } catch (branchError) {
          console.warn('⚠️ FIXED: Error fetching branch:', branchError.message);
        }
      }
  
      // If no branch found, use store as fallback (main branch)
      if (!branch && service.store) {
        console.log('🏪 FIXED: Using store as fallback branch');
        branch = {
          id: `store-${service.store.id}`,
          name: service.store.name + ' (Main Branch)',
          address: service.store.location,
          phone: service.store.phone_number,      // FIXED: Use correct field name
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
      console.error('❌ FIXED: Error getting branch for offer:', error);
      
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
   * NEW: Get branches for service (instead of stores)
   */
  async getBranchesForService(req, res) {
    try {
      const { serviceId } = req.params;
  
      console.log('🏢 Getting branch for service:', serviceId);
  
      // FIXED: Use correct Store column names
      const service = await Service.findByPk(serviceId, {
        attributes: ['id', 'name', 'branch_id', 'store_id'],
        include: [{
          model: Store,
          as: 'store',
          attributes: [
            'id', 
            'name', 
            'location', 
            'phone_number',      // FIXED: Correct column name
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
  
      console.log('📋 FIXED: Service details:', {
        serviceId: service.id,
        serviceName: service.name,
        branchId: service.branch_id,
        storeId: service.store_id
      });
  
      // Get branch if service has branch_id
      let branch = null;
      if (service.branch_id && Branch) {
        try {
          branch = await Branch.findByPk(service.branch_id, {
            attributes: ['id', 'name', 'address', 'phone', 'openingTime', 'closingTime', 'workingDays']
          });
        } catch (branchError) {
          console.warn('⚠️ FIXED: Error fetching branch:', branchError.message);
        }
      }
  
      // Fallback to store as main branch
      if (!branch && service.store) {
        branch = {
          id: `store-${service.store.id}`,
          name: service.store.name + ' (Main Branch)',
          address: service.store.location,
          phone: service.store.phone_number,      // FIXED: Use correct field name
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
      console.error('❌ FIXED: Error getting branch for service:', error);
      
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
   * Legacy: Get available slots (legacy endpoint - determines type from parameters)
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

  /**
   * Legacy: Get stores for offer bookings (now redirects to branches)
   */
  async getStoresForOffer(req, res) {
    try {
      const { offerId } = req.params;

      console.log('🏪 Getting stores for offer (legacy):', offerId);

      // Get branch data
      const branchResponse = await this.getBranchesForOffer(req, { 
        json: (data) => data // Mock response object
      });

      if (branchResponse.success && branchResponse.branch) {
        // Convert branch to store format for compatibility
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

      // Fallback to old method
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
   * Legacy: Get stores for service bookings (now redirects to branches)
   */
  async getStoresForService(req, res) {
    try {
      const { serviceId } = req.params;

      console.log('🏪 Getting stores for service (legacy):', serviceId);

      // Get branch data
      const branchResponse = await this.getBranchesForService(req, { 
        json: (data) => data // Mock response object
      });

      if (branchResponse.success && branchResponse.branch) {
        // Convert branch to store format for compatibility
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

      // Fallback to old method
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

      // Check if Staff model is available
      if (!Staff) {
        console.warn('⚠️ Staff model not available');
        return res.status(200).json({
          success: true,
          staff: [],
          message: 'Staff selection not available - model not loaded'
        });
      }

      // Validate storeId
      if (!storeId || storeId === 'undefined' || storeId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Valid store ID is required'
        });
      }

      let targetServiceId = serviceId;

      // If we have an offerId, get the service from the offer
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
        
        // Get staff assigned to the specific service through StaffService junction table
        if (StaffService) {
          staff = await Staff.findAll({
            where: {
              storeId: storeId,
              status: 'active'
            },
            include: [{
              model: Service,
              as: 'services', // Use the association alias from your Staff model
              where: { id: targetServiceId },
              through: { 
                attributes: ['isActive', 'assignedAt'],
                where: { isActive: true } // Only active assignments
              },
              attributes: ['id', 'name'],
              required: true // Inner join - only staff assigned to this service
            }],
            attributes: ['id', 'name', 'role'],
            order: [['name', 'ASC']]
          });
          
          console.log(`👥 Found ${staff.length} staff assigned to service ${targetServiceId}`);
        } else {
          console.warn('⚠️ StaffService model not available, falling back to all store staff');
          // Fallback to all store staff if junction table not available
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
        
        // No specific service - get all store staff
        staff = await Staff.findAll({
          where: {
            storeId: storeId,
            status: 'active'
          },
          attributes: ['id', 'name', 'role'],
          order: [['name', 'ASC']]
        });
      }

      // Clean up staff data for response
      const cleanStaff = staff.map(member => ({
        id: member.id,
        name: member.name,
        role: member.role,
        // Include service assignment info if available
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
      
      // CRITICAL: Never throw errors for staff fetch failures in booking context
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
          },
          ...(Branch ? [{
            model: Branch,
            required: false,
            attributes: ['id', 'name', 'address', 'phone']
          }] : [])
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

      // Add enhanced metadata
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

      // Check if booking can be cancelled
      if (['cancelled', 'completed'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: 'Booking is already cancelled or completed'
        });
      }

      // Check cancellation timing
      const now = new Date();
      const bookingStart = new Date(booking.startTime);
      const hoursUntilBooking = (bookingStart - now) / (1000 * 60 * 60);

      const minCancellationHours = booking.bookingType === 'offer' ? 2 : 0.5; // 2 hours for offers, 30 min for services

      if (hoursUntilBooking < minCancellationHours) {
        return res.status(400).json({
          success: false,
          message: `Must cancel at least ${minCancellationHours} hour${minCancellationHours > 1 ? 's' : ''} before appointment`
        });
      }

      // Update booking status
      await booking.update({ 
        status: 'cancelled',
        cancellationReason: reason,
        cancelledAt: now
      });

      // Handle refund for offer bookings
      let refund = null;
      if (booking.bookingType === 'offer' && booking.paymentId && refundRequested && hoursUntilBooking >= 24) {
        try {
          // Process refund logic here
          console.log('Processing refund for booking:', bookingId);
          // refund = await this.processRefund(booking.paymentId, reason);
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
   * Debug working days format for entities
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

      // Get entity and store
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

      // Run debug on working days
      const debugResult = slotService.debugWorkingDays(store);

      // Test validation for different days
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
  createOfferBooking: enhancedBookingController.createOfferBooking.bind(enhancedBookingController),
  createServiceBooking: enhancedBookingController.createServiceBooking.bind(enhancedBookingController),

  // Unified slot methods
  getUnifiedSlots: enhancedBookingController.getUnifiedSlots.bind(enhancedBookingController),

  // Legacy slot methods
  getAvailableSlots: enhancedBookingController.getAvailableSlots.bind(enhancedBookingController),
  getAvailableSlotsForOffer: enhancedBookingController.getAvailableSlotsForOffer.bind(enhancedBookingController),
  getAvailableSlotsForService: enhancedBookingController.getAvailableSlotsForService.bind(enhancedBookingController),

  // NEW: Branch methods - FIXED EXPORTS
  getBranchesForOffer: enhancedBookingController.getBranchesForOffer.bind(enhancedBookingController),
  getBranchesForService: enhancedBookingController.getBranchesForService.bind(enhancedBookingController),

  // NEW: Enhanced staff methods - FIXED EXPORTS
  getStaffForOffer: enhancedBookingController.getStaffForOffer.bind(enhancedBookingController),
  getStaffForService: enhancedBookingController.getStaffForService.bind(enhancedBookingController),
  
  // Legacy store and staff methods (for backward compatibility)
  getStoresForOffer: enhancedBookingController.getStoresForOffer.bind(enhancedBookingController),
  getStoresForService: enhancedBookingController.getStoresForService.bind(enhancedBookingController),
  getStaffForStore: enhancedBookingController.getStaffForStore.bind(enhancedBookingController),

  // User booking methods
  getUserBookings: enhancedBookingController.getUserBookings.bind(enhancedBookingController),
  getBookingById: enhancedBookingController.getBookingById.bind(enhancedBookingController),
  updateBookingStatus: enhancedBookingController.updateBookingStatus.bind(enhancedBookingController),
  cancelBooking: enhancedBookingController.cancelBooking.bind(enhancedBookingController),

  // Merchant booking methods (ADD THESE IF MISSING)
  getMerchantBookings: enhancedBookingController.getMerchantBookings?.bind(enhancedBookingController),
  getAllMerchantBookings: enhancedBookingController.getAllMerchantBookings?.bind(enhancedBookingController),
  merchantUpdateBookingStatus: enhancedBookingController.merchantUpdateBookingStatus?.bind(enhancedBookingController),

  // Analytics methods (ADD THESE IF MISSING)
  getBookingAnalytics: enhancedBookingController.getBookingAnalytics?.bind(enhancedBookingController),
  getServiceBookingStats: enhancedBookingController.getServiceBookingStats?.bind(enhancedBookingController),

  // Slot management methods (ADD THESE IF MISSING)
  checkSlotAvailability: enhancedBookingController.checkSlotAvailability?.bind(enhancedBookingController),
  getSlotUtilization: enhancedBookingController.getSlotUtilization?.bind(enhancedBookingController),

  // Debug methods
  debugWorkingDays: enhancedBookingController.debugWorkingDays.bind(enhancedBookingController),

  // Export the class itself
  EnhancedBookingController,

  // Export instance for direct use
  default: enhancedBookingController
};