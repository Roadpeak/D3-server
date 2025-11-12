// controllers/serviceBookingController.js - FIXED VERSION with proper email notifications

const moment = require('moment');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

let models = {};
try {
  models = require('../models');
} catch (error) {
  console.error('Failed to import models in service booking controller:', error);
}

const {
  Booking,
  Service,
  Store,
  User,
  Staff,
  Branch,
  StaffService,
  sequelize
} = models;

const SlotGenerationService = require('../services/slotGenerationService');
const slotService = new SlotGenerationService(models);
const AutoConfirmationService = require('../services/autoConfirmationService');
const NotificationService = require('../services/notificationService');

class ServiceBookingController {

  constructor() {
    this.slotService = new SlotGenerationService(models);
    this.autoConfirmationService = new AutoConfirmationService(models);
    this.notificationService = new NotificationService();
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

      // Fix single-digit hours: '2025-08-25T9:00' -> '2025-08-25T09:00'
      const singleHourPattern = /T(\d):(\d{2})(?::(\d{2}))?$/;
      if (singleHourPattern.test(fixedDateTime)) {
        fixedDateTime = fixedDateTime.replace(singleHourPattern, (match, hour, minute, second) => {
          const paddedHour = hour.padStart(2, '0');
          const paddedSecond = second || '00';
          return `T${paddedHour}:${minute}:${paddedSecond}`;
        });
      }

      // Add seconds if missing
      if (/T\d{2}:\d{2}$/.test(fixedDateTime)) {
        fixedDateTime += ':00';
      }

      const formats = [
        'YYYY-MM-DDTHH:mm:ss',
        'YYYY-MM-DDTHH:mm',
        'YYYY-MM-DD HH:mm:ss',
        'YYYY-MM-DD HH:mm',
        moment.ISO_8601
      ];

      let normalizedDateTime = null;
      for (const format of formats) {
        const parsed = moment(fixedDateTime, format, true);
        if (parsed.isValid()) {
          normalizedDateTime = parsed;
          break;
        }
      }

      if (!normalizedDateTime) {
        const fallbackParsed = moment(fixedDateTime);
        if (fallbackParsed.isValid()) {
          normalizedDateTime = fallbackParsed;
        }
      }

      if (!normalizedDateTime || !normalizedDateTime.isValid()) {
        throw new Error(`Invalid datetime format: ${dateTimeStr}. Expected format: YYYY-MM-DDTHH:mm:ss (e.g., 2025-08-25T09:00:00)`);
      }

      return normalizedDateTime;
    }

    throw new Error(`Invalid datetime format: ${dateTimeStr}. Expected format: YYYY-MM-DDTHH:mm:ss`);
  }

  async getAvailableSlots(req, res) {
    try {
      const { date, serviceId } = req.query;

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

      const result = await slotService.generateAvailableSlots(serviceId, 'service', date);

      if (result.success) {
        result.bookingType = 'service';
        result.requiresPayment = false;
        result.accessFee = 0;
      }

      const statusCode = result.success ? 200 : (result.message.includes('not found') ? 404 : 400);
      return res.status(statusCode).json(result);

    } catch (error) {
      console.error('Error getting service slots:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching available service slots',
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
        serviceId,
        userId,
        startTime,
        storeId,
        branchId,
        staffId,
        notes,
        clientInfo
      } = req.body;

      if (!serviceId) {
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

      // Get service details
      const service = await Service.findByPk(serviceId, {
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

      const availabilityCheck = await slotService.isSlotAvailable(serviceId, 'service', date, time);

      if (!availabilityCheck.available) {
        if (transaction && !transactionCommitted) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: availabilityCheck.reason || 'Selected time slot is no longer available'
        });
      }

      // Validate branch and staff
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

      // Calculate end time
      const serviceDuration = service.duration || 60;
      const endTime = bookingDateTime.clone().add(serviceDuration, 'minutes').toDate();

      // Create the service booking
      const bookingData = {
        serviceId,
        userId,
        startTime: bookingDateTime.toDate(),
        endTime,
        status: service.auto_confirm_bookings ? 'confirmed' : 'pending',
        storeId: bookingStore?.id,
        branchId: bookingBranch?.id,
        staffId: bookingStaff?.id,
        notes: notes || '',
        accessFee: 0,
        bookingType: 'service'
      };

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

      // Commit transaction BEFORE sending emails
      if (transaction && !transactionCommitted) {
        await transaction.commit();
        transactionCommitted = true;
      }

      // ✅ FIXED: Send notifications AFTER transaction commit
      console.log('📧 Sending booking notifications...');
      try {
        // Send to MERCHANT
        console.log('📧 Sending notification to MERCHANT...');
        await this.notificationService.sendBookingNotificationToMerchant(
          booking,
          service,
          bookingStore,
          bookingStaff,
          user // Add user parameter for merchant notification
        );
        console.log('✅ Merchant notification sent successfully');

        // Send to CUSTOMER
        console.log('📧 Sending confirmation to CUSTOMER...');
        await this.notificationService.sendBookingConfirmationToCustomer(
          booking,
          service,
          user,
          bookingStore,
          booking.qrCode
        );
        console.log('✅ Customer confirmation sent successfully');

      } catch (notificationError) {
        console.error('❌ Booking notification failed:', notificationError);
        console.error('Error details:', notificationError.message);
        console.error('Stack trace:', notificationError.stack);
        // Don't fail the booking if notifications fail, just log the error
      }

      // Fetch complete booking data for response
      const completeBooking = await Booking.findByPk(booking.id, {
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
          },
          {
            model: User,
            as: 'bookingUser',
            required: false
          }
        ]
      });

      const responseMessage = `Service booking ${booking.status} successfully. ${availabilityCheck.remainingSlots - 1} slots remaining for this time.`;

      res.status(201).json({
        success: true,
        booking: completeBooking || booking,
        availability: {
          remainingSlots: availabilityCheck.remainingSlots - 1,
          totalSlots: availabilityCheck.totalSlots
        },
        bookingType: 'service',
        requiresPayment: false,
        accessFee: 0,
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

      console.error('Service booking creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create service booking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==========================================
  // USER METHODS
  // ==========================================

  async getUserBookings(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
      }

      const { status, limit = 50, offset = 0 } = req.query;
      const whereConditions = {
        userId,
        serviceId: { [Op.ne]: null }
      };

      if (status) {
        whereConditions.status = status;
      }

      const bookings = await Booking.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Service,
            as: 'service',
            required: false,
            include: [{
              model: Store,
              as: 'store',
              attributes: ['id', 'name', 'location']
            }]
          },
          {
            model: Staff,
            as: 'staff',
            required: false,
            attributes: ['id', 'name', 'role']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return res.json({
        success: true,
        bookings: bookings.rows,
        pagination: {
          total: bookings.count,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });

    } catch (error) {
      console.error('Error getting user service bookings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user service bookings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  async getBookingById(req, res) {
    try {
      const { bookingId } = req.params;

      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: User,
            as: 'bookingUser',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
          },
          {
            model: Service,
            as: 'service',
            required: false,
            include: [{
              model: Store,
              as: 'store',
              attributes: ['id', 'name', 'location']
            }]
          },
          {
            model: Staff,
            as: 'staff',
            required: false,
            attributes: ['id', 'name', 'role']
          }
        ]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (!booking.serviceId) {
        return res.status(404).json({
          success: false,
          message: 'Service booking not found'
        });
      }

      return res.json({
        success: true,
        booking
      });

    } catch (error) {
      console.error('Error getting service booking by ID:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch service booking details',
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
          serviceId: { [Op.ne]: null }
        },
        include: [
          {
            model: Service,
            as: 'service',
            required: false
          }
        ]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Service booking not found'
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

      if (booking.service && booking.service.min_cancellation_hours) {
        const bookingTime = new Date(booking.startTime);
        const now = new Date();
        const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

        if (hoursUntilBooking < booking.service.min_cancellation_hours) {
          return res.status(400).json({
            success: false,
            message: `Cannot cancel booking less than ${booking.service.min_cancellation_hours} hours in advance`
          });
        }
      }

      await booking.update({
        status: 'cancelled',
        notes: booking.notes ? `${booking.notes}\n\nCancellation reason: ${reason}` : `Cancellation reason: ${reason}`,
        cancelledAt: new Date()
      });

      return res.status(200).json({
        success: true,
        message: 'Service booking cancelled successfully',
        booking
      });

    } catch (error) {
      console.error('Error cancelling service booking:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel service booking'
      });
    }
  }

  async updateBookingStatus(req, res) {
    try {
      const { bookingId } = req.params;
      const { status } = req.body;

      if (!bookingId) {
        return res.status(400).json({
          success: false,
          message: 'Booking ID is required'
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      const validStatuses = ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }

      const booking = await Booking.findOne({
        where: {
          id: bookingId,
          serviceId: { [Op.ne]: null }
        }
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Service booking not found'
        });
      }

      await booking.update({ status });

      return res.status(200).json({
        success: true,
        message: 'Service booking status updated successfully',
        booking
      });

    } catch (error) {
      console.error('Error updating service booking status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update service booking status'
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

      const existingBooking = await Booking.findOne({
        where: {
          id: bookingId,
          serviceId: { [Op.ne]: null }
        },
        ...(transaction && { transaction })
      });

      if (!existingBooking) {
        if (transaction) await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: 'Service booking not found'
        });
      }

      const newDateTime = this.normalizeDateTime(newStartTime);
      const date = newDateTime.format('YYYY-MM-DD');
      const time = newDateTime.format('h:mm A');

      const availabilityCheck = await slotService.isSlotAvailable(existingBooking.serviceId, 'service', date, time);

      if (!availabilityCheck.available) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Selected new time slot is not available'
        });
      }

      const service = await Service.findByPk(existingBooking.serviceId);
      const duration = service?.duration || 60;
      const newEndTime = newDateTime.clone().add(duration, 'minutes').toDate();

      await existingBooking.update({
        startTime: newDateTime.toDate(),
        endTime: newEndTime,
        staffId: newStaffId || existingBooking.staffId,
        notes: existingBooking.notes + `\n\nRescheduled on ${new Date().toISOString()}. Reason: ${reason || 'No reason provided'}`
      }, { ...(transaction && { transaction }) });

      if (transaction) await transaction.commit();

      return res.status(200).json({
        success: true,
        message: 'Service booking rescheduled successfully',
        booking: existingBooking
      });

    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Error rescheduling service booking:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reschedule service booking'
      });
    }
  }

  // ==========================================
  // MERCHANT ACTION METHODS
  // ==========================================

  async checkInServiceBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { arrivalTime, notes } = req.body;
      const merchantId = req.user?.id;

      if (!bookingId) {
        return res.status(400).json({
          success: false,
          message: 'Booking ID is required'
        });
      }

      const booking = await Booking.findOne({
        where: {
          id: bookingId,
          serviceId: { [Op.ne]: null },
          bookingType: 'service'
        },
        include: [
          {
            model: User,
            as: 'bookingUser',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
          },
          {
            model: Service,
            as: 'service',
            required: true,
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: true
            }]
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
          message: 'Service booking not found or not accessible'
        });
      }

      if (booking.status !== 'confirmed') {
        return res.status(400).json({
          success: false,
          message: `Cannot check in booking with status: ${booking.status}. Only confirmed bookings can be checked in.`
        });
      }

      if (booking.checked_in_at) {
        return res.status(400).json({
          success: false,
          message: 'Customer has already been checked in'
        });
      }

      const bookingTime = new Date(booking.startTime);
      const now = new Date();
      const service = booking.service;

      if (service.allow_early_checkin) {
        const earlyMinutes = (bookingTime - now) / (1000 * 60);
        const maxEarlyMinutes = service.early_checkin_minutes || 15;

        if (earlyMinutes > maxEarlyMinutes) {
          return res.status(400).json({
            success: false,
            message: `Check-in is not allowed more than ${maxEarlyMinutes} minutes early. Please wait until ${new Date(bookingTime.getTime() - maxEarlyMinutes * 60 * 1000).toLocaleTimeString()}`
          });
        }
      } else {
        if (now < bookingTime) {
          return res.status(400).json({
            success: false,
            message: `Check-in is not allowed before scheduled time: ${bookingTime.toLocaleTimeString()}`
          });
        }
      }

      const serviceDuration = service.duration || 60;
      const serviceEndTime = new Date(now.getTime() + serviceDuration * 60 * 1000);

      const updateData = {
        status: 'in_progress',
        checked_in_at: now,
        service_started_at: now,
        service_end_time: serviceEndTime,
        checked_in_by: req.user.name || req.user.email || req.user.firstName || 'Merchant',
        checkin_notes: notes || 'Customer checked in',
        updatedBy: merchantId
      };

      await booking.update(updateData);

      try {
        await this.sendCheckInNotification(booking, updateData);
      } catch (notificationError) {
        console.warn('Check-in notification failed:', notificationError.message);
      }

      return res.json({
        success: true,
        message: 'Customer checked in successfully',
        booking: {
          ...booking.toJSON(),
          ...updateData,
          estimatedCompletionTime: serviceEndTime
        }
      });

    } catch (error) {
      console.error('Error checking in service booking:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check in customer',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  async confirmServiceBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { notes } = req.body;
      const merchantId = req.user?.id;

      const booking = await Booking.findOne({
        where: {
          id: bookingId,
          serviceId: { [Op.ne]: null },
          bookingType: 'service'
        },
        include: [
          {
            model: User,
            as: 'bookingUser',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
          },
          {
            model: Service,
            as: 'service',
            required: true,
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: true
            }]
          }
        ]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Service booking not found or not accessible'
        });
      }

      if (booking.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Cannot confirm booking with status: ${booking.status}. Only pending bookings can be confirmed.`
        });
      }

      const updateData = {
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmed_at: new Date(),
        confirmed_by: req.user.name || req.user.email || req.user.firstName || 'Merchant',
        manually_confirmed: true,
        confirmation_notes: notes || 'Manually confirmed by merchant',
        updatedBy: merchantId
      };

      await booking.update(updateData);

      try {
        await this.sendBookingConfirmationEmail(booking, booking.service, booking.bookingUser, booking.service.store);
      } catch (emailError) {
        console.warn('Confirmation email failed:', emailError.message);
      }

      return res.json({
        success: true,
        message: 'Service booking confirmed successfully',
        booking: {
          ...booking.toJSON(),
          ...updateData
        }
      });

    } catch (error) {
      console.error('Error confirming service booking:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to confirm booking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  async completeServiceBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { notes, actualDuration, rating } = req.body;
      const merchantId = req.user?.id;

      const booking = await Booking.findOne({
        where: {
          id: bookingId,
          serviceId: { [Op.ne]: null },
          bookingType: 'service'
        },
        include: [
          {
            model: User,
            as: 'bookingUser',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
          },
          {
            model: Service,
            as: 'service',
            required: true,
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: true
            }]
          }
        ]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Service booking not found or not accessible'
        });
      }

      if (!['in_progress', 'confirmed'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot complete booking with status: ${booking.status}. Only in-progress or confirmed bookings can be completed.`
        });
      }

      let calculatedDuration = actualDuration;
      if (!calculatedDuration && booking.service_started_at) {
        const startTime = new Date(booking.service_started_at);
        const endTime = new Date();
        calculatedDuration = Math.round((endTime - startTime) / (1000 * 60));
      }

      const updateData = {
        status: 'completed',
        completedAt: new Date(),
        completed_by: req.user.name || req.user.email || req.user.firstName || 'Merchant',
        actual_duration: calculatedDuration || booking.service?.duration || 60,
        merchantNotes: booking.merchantNotes
          ? `${booking.merchantNotes}\n\n[Completion Notes] ${notes || 'Service completed'}`
          : notes || 'Service completed',
        updatedBy: merchantId
      };

      if (rating && rating >= 1 && rating <= 5) {
        updateData.rating = rating;
        updateData.hasReview = true;
        updateData.reviewDate = new Date();
      }

      await booking.update(updateData);

      try {
        await this.sendCompletionNotification(booking, updateData);
      } catch (notificationError) {
        console.warn('Completion notification failed:', notificationError.message);
      }

      return res.json({
        success: true,
        message: 'Service booking completed successfully',
        booking: {
          ...booking.toJSON(),
          ...updateData
        }
      });

    } catch (error) {
      console.error('Error completing service booking:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to complete booking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  async cancelServiceBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { reason, refundRequested = false } = req.body;
      const merchantId = req.user?.id;

      const booking = await Booking.findOne({
        where: {
          id: bookingId,
          serviceId: { [Op.ne]: null },
          bookingType: 'service'
        },
        include: [
          {
            model: User,
            as: 'bookingUser',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
          },
          {
            model: Service,
            as: 'service',
            required: true,
            include: [{
              model: Store,
              as: 'store',
              where: {
                merchant_id: merchantId
              },
              required: true
            }]
          }
        ]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Service booking not found or not accessible'
        });
      }

      if (['cancelled', 'completed'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel booking with status: ${booking.status}`
        });
      }

      const updateData = {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: reason || 'Cancelled by merchant',
        merchantNotes: booking.merchantNotes
          ? `${booking.merchantNotes}\n\n[Cancellation] ${reason || 'Cancelled by merchant'}`
          : reason || 'Cancelled by merchant',
        updatedBy: merchantId
      };

      await booking.update(updateData);

      try {
        await this.sendCancellationNotification(booking, reason, refundRequested);
      } catch (notificationError) {
        console.warn('Cancellation notification failed:', notificationError.message);
      }

      return res.json({
        success: true,
        message: 'Service booking cancelled successfully',
        booking: {
          ...booking.toJSON(),
          ...updateData
        }
      });

    } catch (error) {
      console.error('Error cancelling service booking:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel booking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  async updateServiceBookingStatus(req, res) {
    try {
      const { bookingId } = req.params;
      const { status, notes } = req.body;
      const merchantId = req.user?.id;

      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status provided',
          validStatuses
        });
      }

      switch (status) {
        case 'confirmed':
          req.body = { notes };
          return this.confirmServiceBooking(req, res);
        case 'in_progress':
          req.body = { notes };
          return this.checkInServiceBooking(req, res);
        case 'completed':
          req.body = { notes };
          return this.completeServiceBooking(req, res);
        case 'cancelled':
          req.body = { reason: notes };
          return this.cancelServiceBooking(req, res);
      }

      const booking = await Booking.findOne({
        where: {
          id: bookingId,
          serviceId: { [Op.ne]: null },
          bookingType: 'service'
        },
        include: [{
          model: Service,
          as: 'service',
          required: true,
          include: [{
            model: Store,
            as: 'store',
            where: {
              merchant_id: merchantId
            },
            required: true
          }]
        }]
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Service booking not found or not accessible'
        });
      }

      const updateData = {
        status,
        updatedBy: merchantId
      };

      if (notes) {
        updateData.merchantNotes = booking.merchantNotes
          ? `${booking.merchantNotes}\n\n[${status.toUpperCase()}] ${notes}`
          : notes;
      }

      if (status === 'no_show') {
        updateData.no_show_reason = notes || 'Customer did not arrive';
      }

      await booking.update(updateData);

      return res.json({
        success: true,
        message: `Service booking ${status} successfully`,
        booking: {
          ...booking.toJSON(),
          ...updateData
        }
      });

    } catch (error) {
      console.error('Error updating service booking status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update booking status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==========================================
  // MERCHANT LISTING METHODS
  // ==========================================

  async getMerchantStoreBookings(req, res) {
    try {
      const { storeId } = req.params;
      const { status, limit = 50, offset = 0, startDate, endDate } = req.query;

      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID is required'
        });
      }

      const whereConditions = {
        storeId: storeId,
        serviceId: { [Op.ne]: null }
      };

      if (status) {
        whereConditions.status = status;
      }

      if (startDate) {
        whereConditions.startTime = { [Op.gte]: new Date(startDate) };
      }

      if (endDate) {
        whereConditions.startTime = {
          ...whereConditions.startTime,
          [Op.lte]: new Date(endDate)
        };
      }

      const bookings = await Booking.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: User,
            as: 'bookingUser',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
          },
          {
            model: Service,
            as: 'service',
            required: false,
            attributes: ['id', 'name', 'price', 'duration']
          },
          {
            model: Staff,
            as: 'staff',
            required: false,
            attributes: ['id', 'name', 'email', 'phoneNumber', 'role', 'status']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return res.json({
        success: true,
        bookings: bookings.rows,
        pagination: {
          total: bookings.count,
          limit: parseInt(limit),
          offset: parseInt(offset)
        },
        storeId: storeId
      });

    } catch (error) {
      console.error('Error getting merchant store service bookings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch store service bookings',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==========================================
  // STORE/STAFF/BRANCH METHODS
  // ==========================================

  async getStaff(req, res) {
    try {
      const { serviceId } = req.params;

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
      console.error('Error getting staff for service:', error);
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
      const { serviceId } = req.params;

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
      console.error('Error getting branch for service:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching branch for service',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  async getStores(req, res) {
    try {
      const { serviceId } = req.params;

      const branchResponse = await this.getBranch({ params: { serviceId } }, {
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
      console.error('Error getting stores for service:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching stores for service',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // ==========================================
  // NOTIFICATION METHODS
  // ==========================================

  async sendCheckInNotification(booking, checkInData) {
    const service = await Service.findByPk(booking.serviceId);
    const user = await User.findByPk(booking.userId);
    const store = booking.storeId ? await Store.findByPk(booking.storeId) : null;

    const templateData = {
      userName: user.firstName || user.name || 'Valued Customer',
      serviceName: service.name,
      bookingStartTime: this.notificationService.formatDateTime(booking.startTime),
      bookingEndTime: this.notificationService.formatDateTime(booking.endTime),
      status: 'Checked In'
    };

    const htmlContent = await this.notificationService.renderTemplate(
      'customerBookingConfirmation',
      templateData
    );

    if (user.email) {
      await this.notificationService.sendEmail(
        user.email,
        `Check-in Confirmed: ${service.name}`,
        htmlContent
      );
    }
  }

  async sendCompletionNotification(booking, completionData) {
    const service = await Service.findByPk(booking.serviceId);
    const user = await User.findByPk(booking.userId);
    const store = booking.storeId ? await Store.findByPk(booking.storeId) : null;

    const templateData = {
      userName: user.firstName || user.name || 'Valued Customer',
      serviceName: service.name,
      bookingStartTime: this.notificationService.formatDateTime(booking.startTime),
      bookingEndTime: this.notificationService.formatDateTime(booking.endTime),
      status: 'Completed'
    };

    const htmlContent = await this.notificationService.renderTemplate(
      'customerBookingConfirmation',
      templateData
    );

    if (user.email) {
      await this.notificationService.sendEmail(
        user.email,
        `Service Completed: ${service.name} - We hope you enjoyed it!`,
        htmlContent
      );
    }
  }

  async sendCancellationNotification(booking, reason, refundRequested) {
    const service = await Service.findByPk(booking.serviceId);
    const user = await User.findByPk(booking.userId);
    const store = booking.storeId ? await Store.findByPk(booking.storeId) : null;

    const templateData = {
      userName: user.firstName || user.name || 'Valued Customer',
      serviceName: service.name,
      bookingStartTime: this.notificationService.formatDateTime(booking.startTime),
      bookingEndTime: this.notificationService.formatDateTime(booking.endTime),
      status: 'Cancelled',
      reason: reason || 'No reason provided',
      refundRequested: refundRequested
    };

    const htmlContent = await this.notificationService.renderTemplate(
      'customerBookingConfirmation',
      templateData
    );

    if (user.email) {
      await this.notificationService.sendEmail(
        user.email,
        `Booking Cancelled: ${service.name}`,
        htmlContent
      );
    }
  }

  async sendBookingConfirmationEmail(booking, service, user, store, staff) {
    return this.notificationService.sendBookingConfirmationToCustomer(
      booking,
      service,
      user,
      store,
      booking.qrCode
    );
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  async generateQRCode(booking, req) {
    try {
      const qrData = JSON.stringify({
        bookingId: booking.id,
        bookingType: 'service',
        paymentCode: 'SERVICE_BOOKING',
        verificationCode: this.generateVerificationCode(),
        accessFeePaid: false,
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

  generateVerificationCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

const serviceBookingController = new ServiceBookingController();

module.exports = {
  createBooking: serviceBookingController.createBooking.bind(serviceBookingController),
  getAvailableSlots: serviceBookingController.getAvailableSlots.bind(serviceBookingController),
  getUserBookings: serviceBookingController.getUserBookings.bind(serviceBookingController),
  getBookingById: serviceBookingController.getBookingById.bind(serviceBookingController),
  cancelBooking: serviceBookingController.cancelBooking.bind(serviceBookingController),
  updateBookingStatus: serviceBookingController.updateBookingStatus.bind(serviceBookingController),
  rescheduleBooking: serviceBookingController.rescheduleBooking.bind(serviceBookingController),
  getStaff: serviceBookingController.getStaff.bind(serviceBookingController),
  getBranch: serviceBookingController.getBranch.bind(serviceBookingController),
  getStores: serviceBookingController.getStores.bind(serviceBookingController),
  getMerchantStoreBookings: serviceBookingController.getMerchantStoreBookings.bind(serviceBookingController),
  checkInServiceBooking: serviceBookingController.checkInServiceBooking.bind(serviceBookingController),
  confirmServiceBooking: serviceBookingController.confirmServiceBooking.bind(serviceBookingController),
  completeServiceBooking: serviceBookingController.completeServiceBooking.bind(serviceBookingController),
  cancelServiceBooking: serviceBookingController.cancelServiceBooking.bind(serviceBookingController),
  updateServiceBookingStatus: serviceBookingController.updateServiceBookingStatus.bind(serviceBookingController),
  ServiceBookingController,
  default: serviceBookingController
};