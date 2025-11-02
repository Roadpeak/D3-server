// controllers/offerBookingController.js - Updated with separated platform fee calculation

const moment = require('moment');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

let models = {};
try {
  models = require('../models');
} catch (error) {
  console.error('Failed to import models in offer booking controller:', error);
}

const {
  Booking,
  Offer,
  Service,
  Store,
  User,
  Payment,
  Staff,
  Branch,
  StaffService,
  sequelize
} = models;

const SlotGenerationService = require('../services/slotGenerationService');
const slotService = new SlotGenerationService(models);

class OfferBookingController {

  /**
   * Calculate platform access fee for an offer
   * Fee is 20% of the discount amount (original_price - discounted_price)
   */
  calculatePlatformFee(offer) {
    try {
      console.log('=== PLATFORM FEE DEBUG ===');
      console.log('Full offer object keys:', Object.keys(offer || {}));
      console.log('Offer ID:', offer?.id);
      console.log('Offer discount:', offer?.discount);
      console.log('Offer service:', offer?.service ? 'EXISTS' : 'MISSING');
      console.log('Service price:', offer?.service?.price);
      console.log('Raw offer object:', JSON.stringify(offer, null, 2));
      console.log('=== END DEBUG ===');

      if (!offer) {
        console.warn('No offer provided for fee calculation, using default');
        return 5.99;
      }

      // Try multiple ways to get the service price
      const servicePrice = parseFloat(
        offer.service?.price ||
        offer.price ||
        0
      );

      const discountPercentage = parseFloat(offer.discount || 0);

      console.log('Extracted values:', {
        servicePrice,
        discountPercentage,
        offerService: !!offer.service,
        servicePriceRaw: offer.service?.price,
        discountRaw: offer.discount
      });

      // Validate data
      if (servicePrice <= 0) {
        console.warn('Invalid service price:', servicePrice, 'for offer', offer.id);
        return 5.99;
      }

      if (discountPercentage <= 0) {
        console.warn('Invalid discount percentage:', discountPercentage, 'for offer', offer.id);
        return 5.99;
      }

      if (discountPercentage >= 100) {
        console.warn('Discount percentage >= 100%:', discountPercentage, 'for offer', offer.id);
        return 5.99;
      }

      // Calculate the actual discount amount in KSH
      const discountAmount = (servicePrice * discountPercentage) / 100;

      // Platform fee is 20% of the discount amount
      const platformFee = discountAmount * 0.20;

      const finalFee = Math.max(1.00, parseFloat(platformFee.toFixed(2)));

      console.log('Platform fee calculated:', {
        servicePrice,
        discountPercentage,
        discountAmount,
        platformFee,
        finalFee
      });

      return finalFee;

    } catch (error) {
      console.error('Error calculating platform fee:', error);
      return 5.99;
    }
  }

  /**
   * Get platform fee for a specific offer (separate endpoint)
   */
  async getPlatformFee(req, res) {
    try {
      const { offerId } = req.params;

      if (!offerId) {
        return res.status(400).json({
          success: false,
          message: 'Offer ID is required'
        });
      }

      // Get offer details
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

      const platformFee = this.calculatePlatformFee(offer);

      const originalPrice = parseFloat(offer.original_price || 0);
      const discountedPrice = parseFloat(offer.discounted_price || offer.offerPrice || 0);
      const discountAmount = originalPrice - discountedPrice;

      return res.status(200).json({
        success: true,
        offerId: offerId,
        platformFee: platformFee,
        currency: 'KES',
        calculation: {
          originalPrice: originalPrice,
          discountedPrice: discountedPrice,
          discountAmount: discountAmount,
          feePercentage: '20%',
          formula: '20% of (Original Price - Discounted Price)'
        },
        offer: {
          title: offer.title,
          description: offer.description
        }
      });

    } catch (error) {
      console.error('Error calculating platform fee:', error);
      return res.status(500).json({
        success: false,
        message: 'Error calculating platform fee',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  normalizeDateTime(dateTimeStr) {
    if (!dateTimeStr) {
      throw new Error('DateTime string is required');
    }

    // If it's already a moment object, return it
    if (moment.isMoment(dateTimeStr)) {
      return dateTimeStr;
    }

    // If it's a Date object, convert to moment
    if (dateTimeStr instanceof Date) {
      return moment(dateTimeStr);
    }

    if (typeof dateTimeStr === 'string') {
      let fixedDateTime = dateTimeStr.trim();

      // Handle the common format from frontend: YYYY-MM-DDTHH:mm:ss
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(fixedDateTime)) {
        const parsed = moment(fixedDateTime, 'YYYY-MM-DDTHH:mm:ss', true);
        if (parsed.isValid()) {
          return parsed;
        }
      }

      // Handle format without seconds: YYYY-MM-DDTHH:mm
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fixedDateTime)) {
        fixedDateTime += ':00';
        const parsed = moment(fixedDateTime, 'YYYY-MM-DDTHH:mm:ss', true);
        if (parsed.isValid()) {
          return parsed;
        }
      }

      // Try other common formats
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
          return parsed;
        }
      }

      // Final fallback - let moment try to parse it automatically
      const fallbackParsed = moment(fixedDateTime);
      if (fallbackParsed.isValid()) {
        return fallbackParsed;
      }
    }

    throw new Error(`Invalid datetime format: ${dateTimeStr}. Expected format: YYYY-MM-DDTHH:mm:ss`);
  }

  async getAvailableSlots(req, res) {
    try {
      console.log('=== GET AVAILABLE SLOTS DEBUG ===');
      console.log('Query params:', req.query);

      const { date, offerId } = req.query;

      // ... existing validation code ...

      const result = await slotService.generateAvailableSlots(offerId, 'offer', date);

      console.log('Slot service result:', result);

      if (result.success) {
        result.bookingType = 'offer';
        result.requiresPayment = true;
        result.needsFeeCalculation = true;

        // Add fee calculation here for now
        try {
          const offer = await Offer.findByPk(offerId, {
            include: [{
              model: Service,
              as: 'service'
            }]
          });

          console.log('Offer found for fee calc:', !!offer);
          console.log('Offer data:', offer ? {
            id: offer.id,
            discount: offer.discount,
            hasService: !!offer.service,
            servicePrice: offer.service?.price
          } : null);

          if (offer) {
            result.accessFee = this.calculatePlatformFee(offer);
            console.log('Calculated access fee:', result.accessFee);
          } else {
            result.accessFee = 5.99;
            console.log('No offer found, using default fee');
          }
        } catch (feeError) {
          console.error('Fee calculation error:', feeError);
          result.accessFee = 5.99;
        }
      }

      console.log('Final result access fee:', result.accessFee);
      console.log('=== END SLOTS DEBUG ===');

      const statusCode = result.success ? 200 : (result.message.includes('not found') ? 404 : 400);
      return res.status(statusCode).json(result);

    } catch (error) {
      console.error('Error getting offer slots:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching available offer slots',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  async createBooking(req, res) {
    let transaction;
    let transactionCommitted = false;

    try {
      if (sequelize) {
        transaction = await sequelize.transaction();
      }

      const {
        offerId,
        userId,
        startTime,
        storeId,
        branchId,
        staffId,
        notes,
        paymentData,
        clientInfo
      } = req.body;

      if (!offerId) {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Offer ID is required for offer bookings'
        });
      }

      if (!userId) {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Normalize datetime
      let bookingDateTime;
      try {
        bookingDateTime = this.normalizeDateTime(startTime);
      } catch (dateError) {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid start time format: ${dateError.message}`,
          received: { startTime },
          expected: 'YYYY-MM-DDTHH:mm:ss (e.g., 2025-08-25T09:00:00)'
        });
      }

      // Get offer details
      const offer = await Offer.findByPk(offerId, {
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

      if (!offer) {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Offer not found' });
      }

      if (offer.status !== 'active') {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'This offer is no longer active'
        });
      }

      if (offer.expiration_date && new Date(offer.expiration_date) < new Date()) {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'This offer has expired'
        });
      }

      const service = offer.service;
      if (!service.booking_enabled) {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Online booking is not enabled for this service'
        });
      }

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

      // Validate advance booking rules
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

      // Check slot availability
      const date = bookingDateTime.format('YYYY-MM-DD');
      const time = bookingDateTime.format('h:mm A');

      const availabilityCheck = await slotService.isSlotAvailable(offerId, 'offer', date, time);

      if (!availabilityCheck.available) {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: availabilityCheck.reason || 'Selected time slot is no longer available'
        });
      }

      // Handle branch and store
      let bookingBranch = null;
      let bookingStore = null;

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

      // Handle staff selection
      let bookingStaff = null;
      if (staffId && Staff) {
        const staffQuery = {
          id: staffId,
          status: 'active'
        };

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

      // Calculate access fee using the separated method
      const accessFee = this.calculatePlatformFee(offer);

      let paymentRecord = null;
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

      // Calculate end time
      const serviceDuration = service.duration || 60;
      const endTime = bookingDateTime.clone().add(serviceDuration, 'minutes').toDate();

      // Create the offer booking
      const bookingData = {
        offerId,
        userId,
        startTime: bookingDateTime.toDate(),
        endTime,
        status: 'pending', 
        payment_status: 'pending', 
        storeId: bookingStore?.id,
        branchId: bookingBranch?.id,
        staffId: bookingStaff?.id,
        notes: notes || '',
        accessFee: accessFee,
        bookingType: 'offer'
      };

      if (paymentRecord) {
        bookingData.paymentId = paymentRecord.id;
        bookingData.paymentUniqueCode = paymentRecord.unique_code;
        console.log('⚠️ Payment record exists before booking creation - using legacy flow');
      }
      console.log('Creating booking with data:', {
        offerId: bookingData.offerId,
        userId: bookingData.userId,
        status: bookingData.status,
        payment_status: bookingData.payment_status,
        accessFee: bookingData.accessFee
      });

      const booking = await Booking.create(bookingData, {
        ...(transaction && { transaction })
      });

      // Generate QR code
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

      // Commit transaction
      if (transaction && !transactionCommitted) {
        await transaction.commit();
        transactionCommitted = true;
      }

      // Send confirmation email
      try {
        await this.sendBookingConfirmationEmail(booking, offer, user, bookingStore, bookingStaff);
      } catch (emailError) {
        console.warn('Email sending failed:', emailError.message);
      }

      // Fetch complete booking data
      const completeBooking = await Booking.findByPk(booking.id, {
        include: [
          {
            model: Offer,
            as: 'offer',
            required: false,
            include: [{
              model: Service,
              as: 'service',
              required: false,
              include: [{
                model: Store,
                as: 'store',
                required: false
              }]
            }]
          },
          {
            model: User,
            as: 'bookingUser',
            required: false
          },
          {
            model: Payment,
            as: 'payment',
            required: false
          },
          // ...(Branch ? [{
          //   model: Branch,
          //   as: 'branch',
          //   required: false
          // }] : [])
        ]
      });

      const responseMessage = paymentRecord
        ? `Offer booking created successfully with payment. ${availabilityCheck.remainingSlots - 1} slots remaining for this time.`
        : `Offer booking created successfully. Payment required to confirm. ${availabilityCheck.remainingSlots - 1} slots remaining.`;

      res.status(201).json({
        success: true,
        booking: completeBooking || booking,
        payment: paymentRecord,
        availability: {
          remainingSlots: availabilityCheck.remainingSlots - 1,
          totalSlots: availabilityCheck.totalSlots
        },
        bookingType: 'offer',
        requiresPayment: true,
        accessFee: accessFee,
        message: responseMessage
      });

    } catch (error) {
      if (transaction && !transactionCommitted) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Failed to rollback transaction:', rollbackError.message);
        }
      }

      console.error('Offer booking creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create offer booking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  async getStaff(req, res) {
    try {
      const { offerId } = req.params;

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
      console.error('Error getting staff for offer:', error);
      res.status(200).json({
        success: true,
        staff: [],
        message: 'Staff information temporarily unavailable',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async getBranch(req, res) {
    try {
      const { offerId } = req.params;

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
      let branch = null;

      if (service.branch_id && Branch) {
        try {
          branch = await Branch.findByPk(service.branch_id, {
            attributes: ['id', 'name', 'address', 'phone', 'openingTime', 'closingTime', 'workingDays']
          });
        } catch (branchError) {
          console.warn('Error fetching branch:', branchError.message);
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
      console.error('Error getting branch for offer:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching branch for offer',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Legacy compatibility method
  async getStores(req, res) {
    try {
      const { offerId } = req.params;

      const branchResponse = await this.getBranch({ params: { offerId } }, {
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
      console.error('Error getting stores for offer:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching stores for offer',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Utility methods
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

  async generateQRCode(booking, req) {
    try {
      const qrData = JSON.stringify({
        bookingId: booking.id,
        bookingType: 'offer',
        paymentCode: booking.paymentUniqueCode || 'PENDING_PAYMENT',
        verificationCode: this.generateVerificationCode(),
        accessFeePaid: !!booking.paymentId,
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
 * Get all offer bookings for a merchant
 * @route GET /api/v1/bookings/merchant/offers
 */
async getAllMerchantBookings(req, res) {
  try {
    console.log('📊 Getting all merchant offer bookings');
    const merchantId = req.user?.id || req.merchant?.id;

    if (!merchantId) {
      return res.status(401).json({
        success: false,
        message: 'Merchant authentication required'
      });
    }

    const { limit = 100, offset = 0, status } = req.query;

    // Get merchant's stores
    const merchantStores = await this.models.Store.findAll({
      where: { merchant_id: merchantId },
      attributes: ['id'],
      raw: true
    });

    if (!merchantStores || merchantStores.length === 0) {
      console.log('⚠️ No stores found for merchant:', merchantId);
      return res.status(200).json({
        success: true,
        bookings: [],
        pagination: { total: 0, limit: parseInt(limit), offset: parseInt(offset) },
        summary: {
          total: 0,
          pending: 0,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          in_progress: 0
        },
        message: 'No stores found for this merchant'
      });
    }

    const storeIds = merchantStores.map(store => store.id);
    console.log('📍 Merchant store IDs:', storeIds);

    // Build where clause
    const whereClause = {
      bookingType: 'offer',
      storeId: storeIds
    };

    if (status && status !== 'all' && status !== '') {
      whereClause.status = status;
    }

    console.log('🔍 Query where clause:', JSON.stringify(whereClause, null, 2));

    // ✅ Fetch bookings with NO INCLUDES (raw query)
    const bookings = await this.models.Booking.findAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      raw: false // We need the Sequelize instance for toJSON()
    });

    const count = await this.models.Booking.count({
      where: whereClause
    });

    console.log(`✅ Found ${count} offer bookings (total)`);
    console.log(`📦 Returning ${bookings.length} bookings in this batch`);

    // Process each booking and manually fetch related data
    const processedBookings = await Promise.all(bookings.map(async (booking) => {
      const bookingData = booking.toJSON();
      
      // Manually fetch User
      if (bookingData.userId) {
        try {
          const user = await this.models.User.findByPk(bookingData.userId, {
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'],
            raw: true
          });
          if (user) {
            bookingData.User = user;
            bookingData.bookingUser = user;
          }
        } catch (userError) {
          console.error(`Error fetching user ${bookingData.userId}:`, userError.message);
        }
      }
      
      // Manually fetch Offer with Service
      if (bookingData.offerId) {
        try {
          const offer = await this.models.Offer.findByPk(bookingData.offerId, {
            raw: false
          });
          
          if (offer) {
            const offerData = offer.toJSON();
            
            // Fetch Service for this offer
            if (offerData.service_id) {
              try {
                const service = await this.models.Service.findByPk(offerData.service_id, {
                  raw: false
                });
                if (service) {
                  const serviceData = service.toJSON();
                  
                  // Fetch Store for this service
                  if (serviceData.store_id) {
                    try {
                      const store = await this.models.Store.findByPk(serviceData.store_id, {
                        raw: true
                      });
                      if (store) {
                        serviceData.store = store;
                      }
                    } catch (storeError) {
                      console.error('Error fetching store:', storeError.message);
                    }
                  }
                  
                  offerData.service = serviceData;
                  offerData.Service = serviceData;
                }
              } catch (serviceError) {
                console.error('Error fetching service:', serviceError.message);
              }
            }
            
            bookingData.Offer = offerData;
            bookingData.offer = offerData;
          }
        } catch (offerError) {
          console.error(`Error fetching offer ${bookingData.offerId}:`, offerError.message);
        }
      }
      
      // Manually fetch Payment
      if (bookingData.paymentId) {
        try {
          const payment = await this.models.Payment.findByPk(bookingData.paymentId, {
            raw: true
          });
          if (payment) {
            bookingData.Payment = payment;
            bookingData.payment = payment;
          }
        } catch (paymentError) {
          console.error(`Error fetching payment ${bookingData.paymentId}:`, paymentError.message);
        }
      }
      
      // Manually fetch Store
      if (bookingData.storeId) {
        try {
          const store = await this.models.Store.findByPk(bookingData.storeId, {
            raw: true
          });
          if (store) {
            bookingData.Store = store;
            bookingData.store = store;
          }
        } catch (storeError) {
          console.error(`Error fetching store ${bookingData.storeId}:`, storeError.message);
        }
      }
      
      // Manually fetch Staff if staffId exists
      if (bookingData.staffId) {
        try {
          const staff = await this.models.Staff.findByPk(bookingData.staffId, {
            raw: true
          });
          if (staff) {
            bookingData.Staff = staff;
            bookingData.staff = staff;
          }
        } catch (staffError) {
          console.error(`Error fetching staff ${bookingData.staffId}:`, staffError.message);
        }
      }
      
      // Add helper properties
      bookingData.isOfferBooking = true;
      bookingData.accessFeePaid = !!bookingData.paymentId;
      bookingData.customerName = `${bookingData.User?.firstName || ''} ${bookingData.User?.lastName || ''}`.trim();
      bookingData.offerTitle = bookingData.Offer?.Service?.name || bookingData.Offer?.service?.name || bookingData.Offer?.title || 'Special Offer';
      
      return bookingData;
    }));

    // Calculate summary
    const summary = {
      total: count,
      pending: bookings.filter(b => b.status === 'pending').length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      in_progress: bookings.filter(b => b.status === 'in_progress').length
    };

    console.log('📊 Summary:', summary);
    if (processedBookings.length > 0) {
      console.log('📋 Sample booking keys:', Object.keys(processedBookings[0]));
    }

    return res.status(200).json({
      success: true,
      bookings: processedBookings,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        totalPages: Math.ceil(count / limit)
      },
      summary
    });

  } catch (error) {
    console.error('❌ Error getting merchant offer bookings:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch merchant offer bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
  async getUserBookings(req, res) {
    try {
      const userId = req.user?.id;
      const { page = 1, limit = 10, status, bookingType } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Build where clause
      const whereClause = { userId };
      if (status && status !== 'all') {
        whereClause.status = status;
      }
      if (bookingType && bookingType !== 'all') {
        whereClause.bookingType = bookingType;
      }

      const { count, rows: bookings } = await Booking.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Offer,
            as: 'offer',
            required: false,
            include: [{
              model: Service,
              as: 'service',
              include: [{
                model: Store,
                as: 'store'
              }]
            }]
          },
          {
            model: Service,
            as: 'service',
            required: false,
            include: [{
              model: Store,
              as: 'store'
            }]
          },
          {
            model: User,
            as: 'bookingUser',
            required: false
          },
          {
            model: Payment,
            as: 'payment',
            required: false
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      // FIXED: Add the isOfferBooking property to each booking
      const processedBookings = bookings.map(booking => {
        const bookingData = booking.toJSON();
        bookingData.isOfferBooking = !!booking.offerId;
        bookingData.accessFeePaid = !!booking.paymentId;
        return bookingData;
      });

      const totalPages = Math.ceil(count / limit);

      return res.status(200).json({
        success: true,
        bookings: processedBookings, // Use processed bookings
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Error fetching user bookings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user bookings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  async rescheduleBooking(req, res) {
    let transaction;

    try {
      if (sequelize) {
        transaction = await sequelize.transaction();
      }

      const { bookingId } = req.params;
      const { newStartTime, newStaffId, reason } = req.body;

      // Find existing booking
      const existingBooking = await Booking.findByPk(bookingId, {
        ...(transaction && { transaction })
      });

      if (!existingBooking) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Validate new time slot availability
      const newDateTime = this.normalizeDateTime(newStartTime);
      const date = newDateTime.format('YYYY-MM-DD');
      const time = newDateTime.format('h:mm A');

      const entityId = existingBooking.offerId || existingBooking.serviceId;
      const entityType = existingBooking.offerId ? 'offer' : 'service';

      const availabilityCheck = await slotService.isSlotAvailable(entityId, entityType, date, time);

      if (!availabilityCheck.available) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Selected new time slot is not available'
        });
      }

      // Calculate new end time
      const service = existingBooking.offerId
        ? await Offer.findByPk(existingBooking.offerId, { include: [{ model: Service, as: 'service' }] }).then(o => o.service)
        : await Service.findByPk(existingBooking.serviceId);

      const duration = service?.duration || 60;
      const newEndTime = newDateTime.clone().add(duration, 'minutes').toDate();

      // Update booking
      await existingBooking.update({
        startTime: newDateTime.toDate(),
        endTime: newEndTime,
        staffId: newStaffId || existingBooking.staffId,
        notes: existingBooking.notes + `\n\nRescheduled on ${new Date().toISOString()}. Reason: ${reason || 'No reason provided'}`
      }, { ...(transaction && { transaction }) });

      if (transaction) await transaction.commit();

      return res.status(200).json({
        success: true,
        message: 'Booking rescheduled successfully',
        booking: existingBooking
      });

    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Error rescheduling booking:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reschedule booking'
      });
    }
  }

  async getBookingById(req, res) {
    try {
      const { bookingId } = req.params;

      if (!bookingId) {
        return res.status(400).json({
          success: false,
          message: 'Booking ID is required'
        });
      }

      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: Offer,
            as: 'offer',
            required: false,
            include: [{
              model: Service,
              as: 'service',
              required: false,
              include: [{
                model: Store,
                as: 'store',
                required: false
              }]
            }]
          },
          {
            model: Service,
            as: 'service',
            required: false,
            include: [{
              model: Store,
              as: 'store',
              required: false
            }]
          },
          {
            model: User,
            as: 'bookingUser',
            required: false
          },
          {
            model: Payment,
            as: 'payment',
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

      // FIXED: Add helper properties
      const bookingData = booking.toJSON();
      bookingData.isOfferBooking = !!booking.offerId;
      bookingData.accessFeePaid = !!booking.paymentId;

      return res.status(200).json({
        success: true,
        booking: bookingData // Use processed booking data
      });

    } catch (error) {
      console.error('Error fetching booking by ID:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch booking details',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }


  async sendBookingConfirmationEmail(booking, offer, user, store, staff) {
    try {
      const emailSubject = `Offer Booking Confirmation - ${offer.title || offer.service?.name}`;
      const paymentInfo = booking.paymentId
        ? 'Access fee has been paid. Pay the discounted service price at the venue.'
        : 'Please complete payment to confirm your booking.';

      // Email service implementation would go here
      console.log(`Email would be sent with subject: ${emailSubject}`);
      console.log(`Payment info: ${paymentInfo}`);

    } catch (error) {
      console.error('Email sending failed:', error);
    }
  }

  generateUniqueCode() {
    return 'OFFER_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  generateTransactionId() {
    return 'OTXN_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  generateVerificationCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}



// Create and export instance
const offerBookingController = new OfferBookingController();

module.exports = {
  createBooking: offerBookingController.createBooking.bind(offerBookingController),
  getAvailableSlots: offerBookingController.getAvailableSlots.bind(offerBookingController),
  getPlatformFee: offerBookingController.getPlatformFee.bind(offerBookingController),
  getUserBookings: offerBookingController.getUserBookings.bind(offerBookingController),
  getBookingById: offerBookingController.getBookingById.bind(offerBookingController), // Add this
  getStaff: offerBookingController.getStaff.bind(offerBookingController),
  getBranch: offerBookingController.getBranch.bind(offerBookingController),
  getStores: offerBookingController.getStores.bind(offerBookingController),
  getAllMerchantBookings: offerBookingController.getAllMerchantBookings.bind(offerBookingController),
  OfferBookingController,
  default: offerBookingController
};