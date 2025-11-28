// controllers/offerBookingController.js - FIXED VERSION with proper email notifications

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
const NotificationService = require('../services/notificationService');
const slotService = new SlotGenerationService(models);

class OfferBookingController {

  constructor() {
    this.slotService = new SlotGenerationService(models);
    this.notificationService = new NotificationService();
    this.models = models; // Store models reference
  }

  calculatePlatformFee(offer) {
    try {
      console.log('=== PLATFORM FEE DEBUG ===');
      console.log('Full offer object keys:', Object.keys(offer || {}));
      console.log('Offer ID:', offer?.id);
      console.log('Offer discount:', offer?.discount);
      console.log('Offer service:', offer?.service ? 'EXISTS' : 'MISSING');
      console.log('Service price:', offer?.service?.price);

      if (!offer) {
        console.warn('No offer provided for fee calculation, using default');
        return 5.99;
      }

      const servicePrice = parseFloat(offer.service?.price || offer.price || 0);
      const discountPercentage = parseFloat(offer.discount || 0);

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

      const discountAmount = (servicePrice * discountPercentage) / 100;
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

  async getPlatformFee(req, res) {
    try {
      const { offerId } = req.params;

      if (!offerId) {
        return res.status(400).json({
          success: false,
          message: 'Offer ID is required'
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

    if (moment.isMoment(dateTimeStr)) {
      return dateTimeStr;
    }

    if (dateTimeStr instanceof Date) {
      return moment(dateTimeStr);
    }

    if (typeof dateTimeStr === 'string') {
      let fixedDateTime = dateTimeStr.trim();

      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(fixedDateTime)) {
        const parsed = moment(fixedDateTime, 'YYYY-MM-DDTHH:mm:ss', true);
        if (parsed.isValid()) {
          return parsed;
        }
      }

      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fixedDateTime)) {
        fixedDateTime += ':00';
        const parsed = moment(fixedDateTime, 'YYYY-MM-DDTHH:mm:ss', true);
        if (parsed.isValid()) {
          return parsed;
        }
      }

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

      const fallbackParsed = moment(fixedDateTime);
      if (fallbackParsed.isValid()) {
        return fallbackParsed;
      }
    }

    throw new Error(`Invalid datetime format: ${dateTimeStr}. Expected format: YYYY-MM-DDTHH:mm:ss`);
  }

  async getAvailableSlots(req, res) {
    try {
      const { date, offerId } = req.query;

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

      const result = await slotService.generateAvailableSlots(offerId, 'offer', date);

      if (result.success) {
        result.bookingType = 'offer';
        result.requiresPayment = true;
        result.needsFeeCalculation = true;

        try {
          const offer = await Offer.findByPk(offerId, {
            include: [{
              model: Service,
              as: 'service'
            }]
          });

          if (offer) {
            result.accessFee = this.calculatePlatformFee(offer);
          } else {
            result.accessFee = 5.99;
          }
        } catch (feeError) {
          console.error('Fee calculation error:', feeError);
          result.accessFee = 5.99;
        }
      }

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

      const serviceDuration = service.duration || 60;
      const endTime = bookingDateTime.clone().add(serviceDuration, 'minutes').toDate();

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
      }

      const booking = await Booking.create(bookingData, {
        ...(transaction && { transaction })
      });

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

      // Commit transaction BEFORE sending emails
      if (transaction && !transactionCommitted) {
        await transaction.commit();
        transactionCommitted = true;
      }

      // ✅ FIXED: Send notifications AFTER transaction commit
      console.log('📧 Sending offer booking notifications...');
      try {
        // Send to MERCHANT
        console.log('📧 Sending notification to MERCHANT...');
        await this.notificationService.sendOfferBookingNotificationToMerchant(
          booking,
          offer,
          service,
          bookingStore,
          bookingStaff,
          user
        );
        console.log('✅ Merchant notification sent successfully');

        // Send to CUSTOMER
        console.log('📧 Sending confirmation to CUSTOMER...');
        await this.notificationService.sendOfferBookingConfirmationToCustomer(
          booking,
          offer,
          service,
          user,
          bookingStore,
          booking.qrCode
        );
        console.log('✅ Customer confirmation sent successfully');

      } catch (notificationError) {
        console.error('❌ Offer booking notification failed:', notificationError);
        console.error('Error details:', notificationError.message);
        console.error('Stack trace:', notificationError.stack);
      }

      // Send push notifications
      try {
        const PushNotificationService = require('../services/pushNotificationService');
        const pushService = new PushNotificationService();
        const moment = require('moment');

        const bookingTime = moment(booking.startTime).format('MMM D, YYYY [at] h:mm A');
        const customerName = `${user.firstName} ${user.lastName}`.trim();
        const offerTitle = offer?.title || service?.name || 'Special Offer';

        // Send push to merchant
        await pushService.sendNewBookingNotificationToMerchant(
          bookingStore.merchant_id,
          customerName,
          offerTitle,
          bookingTime
        );

        // Send push to user
        await pushService.sendBookingConfirmationToUser(
          user.id,
          offerTitle,
          bookingTime,
          bookingStore.name
        );

        console.log('📱 Push notifications sent for new offer booking');
      } catch (pushError) {
        console.error('❌ Push notification failed:', pushError);
      }

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
          }
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

  async getAllMerchantBookings(req, res) {
    try {
      const merchantId = req.user?.id || req.merchant?.id;

      if (!merchantId) {
        return res.status(401).json({
          success: false,
          message: 'Merchant authentication required'
        });
      }

      const { limit = 100, offset = 0, status } = req.query;

      const merchantStores = await this.models.Store.findAll({
        where: { merchant_id: merchantId },
        attributes: ['id'],
        raw: true
      });

      if (!merchantStores || merchantStores.length === 0) {
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

      const whereClause = {
        bookingType: 'offer',
        storeId: storeIds
      };

      if (status && status !== 'all' && status !== '') {
        whereClause.status = status;
      }

      const bookings = await this.models.Booking.findAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        raw: false
      });

      const count = await this.models.Booking.count({
        where: whereClause
      });

      const processedBookings = await Promise.all(bookings.map(async (booking) => {
        const bookingData = booking.toJSON();

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

        if (bookingData.offerId) {
          try {
            const offer = await this.models.Offer.findByPk(bookingData.offerId, {
              raw: false
            });

            if (offer) {
              const offerData = offer.toJSON();

              if (offerData.service_id) {
                try {
                  const service = await this.models.Service.findByPk(offerData.service_id, {
                    raw: false
                  });
                  if (service) {
                    const serviceData = service.toJSON();

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

        bookingData.isOfferBooking = true;
        bookingData.accessFeePaid = !!bookingData.paymentId;
        bookingData.customerName = `${bookingData.User?.firstName || ''} ${bookingData.User?.lastName || ''}`.trim();
        bookingData.offerTitle = bookingData.Offer?.Service?.name || bookingData.Offer?.service?.name || bookingData.Offer?.title || 'Special Offer';

        return bookingData;
      }));

      const summary = {
        total: count,
        pending: bookings.filter(b => b.status === 'pending').length,
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        completed: bookings.filter(b => b.status === 'completed').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length,
        in_progress: bookings.filter(b => b.status === 'in_progress').length
      };

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

      const processedBookings = bookings.map(booking => {
        const bookingData = booking.toJSON();
        bookingData.isOfferBooking = !!booking.offerId;
        bookingData.accessFeePaid = !!booking.paymentId;
        return bookingData;
      });

      const totalPages = Math.ceil(count / limit);

      return res.status(200).json({
        success: true,
        bookings: processedBookings,
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

  async cancelBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { reason, refundRequested } = req.body;

      if (!bookingId) {
        return res.status(400).json({
          success: false,
          message: 'Booking ID is required'
        });
      }

      const booking = await Booking.findOne({
        where: {
          id: bookingId,
          offerId: { [Op.ne]: null }
        },
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
            model: Staff,
            as: 'staff',
            required: false
          }
        ]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Offer booking not found'
        });
      }

      if (booking.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Booking is already cancelled'
        });
      }

      if (booking.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel a completed booking'
        });
      }

      // Check cancellation policy
      const service = booking.offer?.service;
      if (service && service.min_cancellation_hours) {
        const bookingTime = new Date(booking.startTime);
        const now = new Date();
        const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

        if (hoursUntilBooking < service.min_cancellation_hours) {
          return res.status(400).json({
            success: false,
            message: `Cannot cancel booking less than ${service.min_cancellation_hours} hours in advance`
          });
        }
      }

      // Calculate refund info if applicable
      let refundInfo = null;
      if (refundRequested && booking.paymentId) {
        refundInfo = {
          applicable: true,
          amount: booking.accessFee || 0,
          currency: 'KES',
          processingTime: '5-7 business days'
        };
      }

      // Update booking status
      await booking.update({
        status: 'cancelled',
        notes: booking.notes ? `${booking.notes}\n\nCancellation reason: ${reason}` : `Cancellation reason: ${reason}`,
        cancelledAt: new Date(),
        cancellationReason: reason || 'No reason provided'
      });

      // ✅ Send email notifications
      try {
        // Send to CUSTOMER
        console.log('📧 Sending cancellation email to CUSTOMER...');
        await this.notificationService.sendCancellationNotificationToCustomer(
          booking,
          service,
          booking.bookingUser,
          service?.store || booking.offer?.service?.store,
          reason,
          refundInfo
        );
        console.log('✅ Customer cancellation email sent');

        // Send to MERCHANT
        console.log('📧 Sending cancellation notification to MERCHANT...');
        await this.notificationService.sendCancellationNotificationToMerchant(
          booking,
          service,
          booking.bookingUser,
          service?.store || booking.offer?.service?.store,
          booking.staff,
          reason
        );
        console.log('✅ Merchant cancellation notification sent');
      } catch (emailError) {
        console.error('❌ Email notification failed:', emailError);
        // Don't fail the cancellation if emails fail
      }

      // Send push notifications
      try {
        const PushNotificationService = require('../services/pushNotificationService');
        const pushService = new PushNotificationService();
        const moment = require('moment');

        const bookingTime = moment(booking.startTime).format('MMM D, YYYY [at] h:mm A');
        const customerName = booking.bookingUser ? `${booking.bookingUser.firstName} ${booking.bookingUser.lastName}`.trim() : 'Customer';
        const storeName = service?.store?.name || booking.offer?.service?.store?.name || 'the store';
        const serviceName = booking.offer?.title || service?.name || 'Service';

        // Send push to user
        await pushService.sendBookingCancellationToUser(
          booking.userId,
          serviceName,
          bookingTime,
          storeName,
          reason || 'No reason provided'
        );

        // Send push to merchant
        const merchantId = service?.store?.merchant_id || booking.offer?.service?.store?.merchant_id;
        if (merchantId) {
          await pushService.sendBookingCancellationToMerchant(
            merchantId,
            customerName,
            serviceName,
            bookingTime,
            reason || 'No reason provided'
          );
        }

        console.log('📱 Push notifications sent for offer booking cancellation');
      } catch (pushError) {
        console.error('❌ Push notification failed:', pushError);
      }

      return res.status(200).json({
        success: true,
        message: 'Offer booking cancelled successfully',
        booking,
        refundInfo
      });

    } catch (error) {
      console.error('Error cancelling offer booking:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel offer booking',
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

      // Find existing booking with all associations
      const existingBooking = await Booking.findOne({
        where: {
          id: bookingId,
          offerId: { [Op.ne]: null }
        },
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
            model: Staff,
            as: 'staff',
            required: false
          }
        ],
        ...(transaction && { transaction })
      });

      if (!existingBooking) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Offer booking not found'
        });
      }

      // Store old date/time for email
      const oldStartTime = new Date(existingBooking.startTime);

      // Validate new time slot
      const newDateTime = this.normalizeDateTime(newStartTime);
      const date = newDateTime.format('YYYY-MM-DD');
      const time = newDateTime.format('h:mm A');

      const availabilityCheck = await slotService.isSlotAvailable(
        existingBooking.offerId,
        'offer',
        date,
        time
      );

      if (!availabilityCheck.available) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Selected new time slot is not available'
        });
      }

      // Get new staff if provided
      let newStaff = null;
      if (newStaffId && newStaffId !== existingBooking.staffId) {
        newStaff = await Staff.findByPk(newStaffId, {
          ...(transaction && { transaction })
        });
      }

      // Calculate new end time
      const service = existingBooking.offer?.service;
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

      // ✅ Send email notifications
      try {
        // Send to CUSTOMER
        console.log('📧 Sending reschedule email to CUSTOMER...');
        await this.notificationService.sendRescheduleNotificationToCustomer(
          existingBooking,
          service,
          existingBooking.bookingUser,
          service?.store || existingBooking.offer?.service?.store,
          existingBooking.staff,
          oldStartTime,
          newDateTime.toDate(),
          reason
        );
        console.log('✅ Customer reschedule email sent');

        // Send to MERCHANT
        console.log('📧 Sending reschedule notification to MERCHANT...');
        await this.notificationService.sendRescheduleNotificationToMerchant(
          existingBooking,
          service,
          existingBooking.bookingUser,
          service?.store || existingBooking.offer?.service?.store,
          existingBooking.staff,
          oldStartTime,
          newDateTime.toDate(),
          reason,
          newStaff
        );
        console.log('✅ Merchant reschedule notification sent');
      } catch (emailError) {
        console.error('❌ Email notification failed:', emailError);
        // Don't fail the reschedule if emails fail
      }

      // Send push notifications
      try {
        const PushNotificationService = require('../services/pushNotificationService');
        const pushService = new PushNotificationService();
        const moment = require('moment');

        const oldTime = moment(oldStartTime).format('MMM D, YYYY [at] h:mm A');
        const newTime = moment(newDateTime).format('MMM D, YYYY [at] h:mm A');
        const customerName = existingBooking.bookingUser ? `${existingBooking.bookingUser.firstName} ${existingBooking.bookingUser.lastName}`.trim() : 'Customer';
        const storeName = service?.store?.name || existingBooking.offer?.service?.store?.name || 'the store';
        const serviceName = existingBooking.offer?.title || service?.name || 'Service';

        // Send push to user
        await pushService.sendBookingRescheduleNotificationToUser(
          existingBooking.userId,
          serviceName,
          oldTime,
          newTime,
          storeName
        );

        // Send push to merchant
        const merchantId = service?.store?.merchant_id || existingBooking.offer?.service?.store?.merchant_id;
        if (merchantId) {
          await pushService.sendBookingRescheduleNotificationToMerchant(
            merchantId,
            customerName,
            serviceName,
            oldTime,
            newTime
          );
        }

        console.log('📱 Push notifications sent for offer booking reschedule');
      } catch (pushError) {
        console.error('❌ Push notification failed:', pushError);
      }

      return res.status(200).json({
        success: true,
        message: 'Offer booking rescheduled successfully',
        booking: existingBooking,
        oldDateTime: oldStartTime,
        newDateTime: newDateTime.toDate()
      });

    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Error rescheduling offer booking:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reschedule offer booking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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

      const bookingData = booking.toJSON();
      bookingData.isOfferBooking = !!booking.offerId;
      bookingData.accessFeePaid = !!booking.paymentId;

      return res.status(200).json({
        success: true,
        booking: bookingData
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

  // ==========================================
  // NOTIFICATION METHODS - ✅ FIXED
  // ==========================================

  async sendCheckInNotification(booking, checkInData) {
    try {
      const offer = await this.models.Offer.findByPk(booking.offerId, {
        include: [{
          model: this.models.Service,
          as: 'service',
          include: [{
            model: this.models.Store,
            as: 'store'
          }]
        }]
      });

      const user = await this.models.User.findByPk(booking.userId);

      const templateData = {
        userName: user.firstName || user.name || 'Valued Customer',
        offerTitle: offer.title,
        serviceName: offer.service?.name || 'Service',
        bookingStartTime: this.notificationService.formatDateTime(booking.startTime),
        status: 'Checked In',
        checkInTime: this.notificationService.formatDateTime(checkInData.checked_in_at),
        estimatedCompletionTime: checkInData.service_end_time
          ? this.notificationService.formatDateTime(checkInData.service_end_time)
          : 'TBD'
      };

      const htmlContent = await this.notificationService.renderTemplate(
        'customerBookingConfirmation',
        templateData
      );

      if (user.email) {
        await this.notificationService.sendEmail(
          user.email,
          `Check-in Confirmed: ${offer.title}`,
          htmlContent
        );
      }

      return true;
    } catch (error) {
      console.error('Error sending check-in notification:', error);
      throw error;
    }
  }

  async sendCompletionNotification(booking, completionData) {
    try {
      const offer = await this.models.Offer.findByPk(booking.offerId, {
        include: [{
          model: this.models.Service,
          as: 'service',
          include: [{
            model: this.models.Store,
            as: 'store'
          }]
        }]
      });

      const user = await this.models.User.findByPk(booking.userId);

      const templateData = {
        userName: user.firstName || user.name || 'Valued Customer',
        offerTitle: offer.title,
        serviceName: offer.service?.name || 'Service',
        bookingStartTime: this.notificationService.formatDateTime(booking.startTime),
        completionTime: this.notificationService.formatDateTime(completionData.completedAt),
        status: 'Completed',
        discount: offer.discount,
        actualDuration: completionData.actual_duration || 'N/A'
      };

      const htmlContent = await this.notificationService.renderTemplate(
        'customerBookingConfirmation',
        templateData
      );

      if (user.email) {
        await this.notificationService.sendEmail(
          user.email,
          `Service Completed: ${offer.title} - Thank you!`,
          htmlContent
        );
      }

      return true;
    } catch (error) {
      console.error('Error sending completion notification:', error);
      throw error;
    }
  }

  async sendCancellationNotification(booking, reason, refundRequested) {
    try {
      const offer = await this.models.Offer.findByPk(booking.offerId, {
        include: [{
          model: this.models.Service,
          as: 'service',
          include: [{
            model: this.models.Store,
            as: 'store'
          }]
        }]
      });

      const user = await this.models.User.findByPk(booking.userId);

      const templateData = {
        userName: user.firstName || user.name || 'Valued Customer',
        offerTitle: offer.title,
        serviceName: offer.service?.name || 'Service',
        bookingStartTime: this.notificationService.formatDateTime(booking.startTime),
        status: 'Cancelled',
        reason: reason || 'No reason provided',
        refundRequested: refundRequested,
        accessFee: booking.accessFee || 0
      };

      const htmlContent = await this.notificationService.renderTemplate(
        'customerBookingConfirmation',
        templateData
      );

      if (user.email) {
        await this.notificationService.sendEmail(
          user.email,
          `Booking Cancelled: ${offer.title}`,
          htmlContent
        );
      }

      return true;
    } catch (error) {
      console.error('Error sending cancellation notification:', error);
      throw error;
    }
  }

  async sendBookingConfirmationEmail(booking, offer, user, store, staff) {
    try {
      const emailSubject = `Offer Booking Confirmation - ${offer.title || offer.service?.name}`;
      const paymentInfo = booking.paymentId
        ? 'Access fee has been paid. Pay the discounted service price at the venue.'
        : 'Please complete payment to confirm your booking.';

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

const offerBookingController = new OfferBookingController();

module.exports = {
  createBooking: offerBookingController.createBooking.bind(offerBookingController),
  getAvailableSlots: offerBookingController.getAvailableSlots.bind(offerBookingController),
  getPlatformFee: offerBookingController.getPlatformFee.bind(offerBookingController),
  getUserBookings: offerBookingController.getUserBookings.bind(offerBookingController),
  getBookingById: offerBookingController.getBookingById.bind(offerBookingController),
  cancelBooking: offerBookingController.cancelBooking.bind(offerBookingController),
  rescheduleBooking: offerBookingController.rescheduleBooking.bind(offerBookingController),
  getStaff: offerBookingController.getStaff.bind(offerBookingController),
  getBranch: offerBookingController.getBranch.bind(offerBookingController),
  getStores: offerBookingController.getStores.bind(offerBookingController),
  getAllMerchantBookings: offerBookingController.getAllMerchantBookings.bind(offerBookingController),
  OfferBookingController,
  default: offerBookingController
};