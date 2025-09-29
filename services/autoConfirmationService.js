// services/autoConfirmationService.js
const moment = require('moment');
const { Op } = require('sequelize');

class AutoConfirmationService {
  constructor(models) {
    this.models = models;
    this.Service = models.Service;
    this.Store = models.Store;
    this.Staff = models.Staff;
    this.Booking = models.Booking;
    this.sequelize = models.sequelize;
  }

  /**
   * Main method to evaluate if a booking should be auto-confirmed
   */
  async evaluateAutoConfirmationRules(serviceId, bookingDateTime, staffId = null, storeId = null, paymentReceived = false) {
    try {
      const service = await this.Service.findByPk(serviceId, {
        include: [{
          model: this.Store,
          as: 'store'
        }]
      });

      if (!service) {
        return { canAutoConfirm: false, reason: 'Service not found' };
      }

      const now = moment();
      const bookingMoment = moment(bookingDateTime);

      // Rule 1: Check if auto-confirmation is enabled for this service
      if (!service.auto_confirm_bookings) {
        return { canAutoConfirm: false, reason: 'Auto-confirmation disabled for this service' };
      }

      // Rule 2: Check advance booking window
      const hoursInAdvance = bookingMoment.diff(now, 'hours', true);
      const minAdvanceHours = (service.min_advance_booking || 30) / 60; // Convert minutes to hours
      const maxAdvanceHours = (service.max_advance_booking || 7 * 24 * 60) / 60; // Convert minutes to hours

      if (hoursInAdvance < minAdvanceHours) {
        return { 
          canAutoConfirm: false, 
          reason: `Booking too soon - requires ${minAdvanceHours.toFixed(1)}h advance notice` 
        };
      }

      if (hoursInAdvance > maxAdvanceHours) {
        return { 
          canAutoConfirm: false, 
          reason: `Booking too far in advance - max ${maxAdvanceHours}h` 
        };
      }

      // Rule 3: Check business hours
      const dayOfWeek = bookingMoment.format('dddd').toLowerCase();
      const bookingTime = bookingMoment.format('HH:mm');
      
      const store = service.store || (storeId ? await this.Store.findByPk(storeId) : null);
      if (store) {
        const businessHoursCheck = await this.isWithinBusinessHours(bookingTime, dayOfWeek, store);
        if (!businessHoursCheck.isOpen) {
          return { canAutoConfirm: false, reason: businessHoursCheck.reason };
        }
      }

      // Rule 4: Check staff availability
      if (staffId) {
        const staffAvailable = await this.checkStaffAvailability(staffId, bookingDateTime, service.duration || 60);
        if (!staffAvailable.available) {
          return { canAutoConfirm: false, reason: staffAvailable.reason };
        }
      }

      // Rule 5: Check capacity limits
      const capacityCheck = await this.checkCapacityLimits(serviceId, bookingDateTime, service.duration || 60);
      if (!capacityCheck.available) {
        return { canAutoConfirm: false, reason: capacityCheck.reason };
      }

      // Rule 6: Check payment requirements
      if (service.require_prepayment && !paymentReceived) {
        return { canAutoConfirm: false, reason: 'Prepayment required for auto-confirmation' };
      }

      // Rule 7: Check time-based restrictions
      const timeRestrictions = this.getTimeBasedRestrictions(bookingMoment);
      if (timeRestrictions.requiresManualApproval) {
        return { canAutoConfirm: false, reason: timeRestrictions.reason };
      }

      // Rule 8: Check merchant override settings
      const merchantOverride = await this.checkMerchantOverrides(service.store_id, serviceId, bookingDateTime);
      if (!merchantOverride.allowed) {
        return { canAutoConfirm: false, reason: merchantOverride.reason };
      }

      // Rule 9: Check service-specific blackout dates
      const blackoutCheck = this.checkBlackoutDates(service, bookingMoment);
      if (!blackoutCheck.allowed) {
        return { canAutoConfirm: false, reason: blackoutCheck.reason };
      }

      return { 
        canAutoConfirm: true, 
        reason: 'All auto-confirmation criteria met',
        checks: {
          serviceEnabled: true,
          advanceBooking: true,
          businessHours: true,
          staffAvailable: staffId ? true : 'not_required',
          capacityAvailable: true,
          paymentSatisfied: service.require_prepayment ? paymentReceived : 'not_required',
          timeRestrictions: true,
          merchantSettings: true,
          blackoutDates: true
        }
      };

    } catch (error) {
      console.error('Error evaluating auto-confirmation rules:', error);
      return { 
        canAutoConfirm: false, 
        reason: 'Error evaluating booking rules - defaulting to manual confirmation' 
      };
    }
  }

  /**
   * Check if booking time is within business hours
   */
  async isWithinBusinessHours(bookingTime, dayOfWeek, store) {
    try {
      if (!store.working_days || !Array.isArray(store.working_days)) {
        return { isOpen: true, reason: 'No working days restriction' };
      }

      // Check if day is in working days
      if (!store.working_days.includes(dayOfWeek) && !store.working_days.includes(dayOfWeek.substring(0, 3))) {
        return { isOpen: false, reason: `Store closed on ${dayOfWeek}s` };
      }

      // Check time bounds
      const openTime = moment(store.opening_time, 'HH:mm');
      const closeTime = moment(store.closing_time, 'HH:mm');
      const requestTime = moment(bookingTime, 'HH:mm');

      if (requestTime.isBefore(openTime) || requestTime.isAfter(closeTime)) {
        return { 
          isOpen: false, 
          reason: `Booking outside business hours (${store.opening_time} - ${store.closing_time})` 
        };
      }

      return { isOpen: true, reason: 'Within business hours' };

    } catch (error) {
      console.error('Error checking business hours:', error);
      return { isOpen: true, reason: 'Business hours check failed - allowing booking' };
    }
  }

  /**
   * Check staff availability for the booking time
   */
  async checkStaffAvailability(staffId, bookingDateTime, duration) {
    try {
      const staff = await this.Staff.findByPk(staffId);
      if (!staff) {
        return { available: false, reason: 'Staff member not found' };
      }

      if (staff.status !== 'active') {
        return { available: false, reason: 'Staff member not active' };
      }

      // Check for overlapping bookings
      const startTime = moment(bookingDateTime);
      const endTime = startTime.clone().add(duration, 'minutes');

      const overlappingBookings = await this.Booking.count({
        where: {
          staffId: staffId,
          status: {
            [Op.in]: ['confirmed', 'in_progress', 'pending']
          },
          [Op.or]: [
            {
              startTime: {
                [Op.between]: [startTime.toDate(), endTime.toDate()]
              }
            },
            {
              endTime: {
                [Op.between]: [startTime.toDate(), endTime.toDate()]
              }
            },
            {
              [Op.and]: [
                { startTime: { [Op.lte]: startTime.toDate() } },
                { endTime: { [Op.gte]: endTime.toDate() } }
              ]
            }
          ]
        }
      });

      if (overlappingBookings > 0) {
        return { available: false, reason: 'Staff member has conflicting booking' };
      }

      return { available: true, reason: 'Staff member available' };

    } catch (error) {
      console.error('Error checking staff availability:', error);
      return { available: false, reason: 'Error checking staff availability' };
    }
  }

  /**
   * Check capacity limits for the service at the given time
   */
  async checkCapacityLimits(serviceId, bookingDateTime, duration) {
    try {
      const service = await this.Service.findByPk(serviceId);
      if (!service) {
        return { available: false, reason: 'Service not found' };
      }

      const maxCapacity = service.max_concurrent_bookings || 1;
      const startTime = moment(bookingDateTime);
      const endTime = startTime.clone().add(duration, 'minutes');

      // Count existing bookings that overlap with this time slot
      const existingBookings = await this.Booking.count({
        where: {
          serviceId: serviceId,
          status: {
            [Op.in]: ['confirmed', 'in_progress', 'pending']
          },
          [Op.or]: [
            {
              startTime: {
                [Op.between]: [startTime.toDate(), endTime.toDate()]
              }
            },
            {
              endTime: {
                [Op.between]: [startTime.toDate(), endTime.toDate()]
              }
            },
            {
              [Op.and]: [
                { startTime: { [Op.lte]: startTime.toDate() } },
                { endTime: { [Op.gte]: endTime.toDate() } }
              ]
            }
          ]
        }
      });

      if (existingBookings >= maxCapacity && !service.allow_overbooking) {
        return { 
          available: false, 
          reason: `Time slot at capacity (${existingBookings}/${maxCapacity})` 
        };
      }

      if (existingBookings >= maxCapacity && service.allow_overbooking) {
        // Allow overbooking but flag for manual review
        return { 
          available: false, 
          reason: 'Capacity exceeded - manual approval required for overbooking' 
        };
      }

      return { 
        available: true, 
        reason: `Capacity available (${existingBookings}/${maxCapacity})` 
      };

    } catch (error) {
      console.error('Error checking capacity limits:', error);
      return { available: false, reason: 'Error checking capacity' };
    }
  }

  /**
   * Get time-based restrictions
   */
  getTimeBasedRestrictions(bookingMoment) {
    const hour = bookingMoment.hour();
    const isWeekend = bookingMoment.day() === 0 || bookingMoment.day() === 6;
    const isEarlyMorning = hour < 8;
    const isLateEvening = hour > 20;

    // Stricter rules for early morning, late evening, or weekends
    if (isEarlyMorning || isLateEvening) {
      return {
        requiresManualApproval: true,
        reason: 'Booking outside standard hours - manual approval required'
      };
    }

    if (isWeekend) {
      return {
        requiresManualApproval: true,
        reason: 'Weekend booking - manual approval required'
      };
    }

    return { requiresManualApproval: false };
  }

  /**
   * Check merchant override settings
   */
  async checkMerchantOverrides(storeId, serviceId, bookingDateTime) {
    try {
      // This would typically fetch from a merchant settings table
      // For now, implementing basic logic with hardcoded rules
      
      const store = await this.Store.findByPk(storeId);
      if (!store) {
        return { allowed: false, reason: 'Store not found' };
      }

      // Check if store is currently accepting auto-confirmations
      if (store.status !== 'open') {
        return { allowed: false, reason: 'Store not currently open for auto-confirmations' };
      }

      // Check for holiday periods (this would be configurable)
      const isHolidayPeriod = this.isHolidayPeriod(bookingDateTime);
      if (isHolidayPeriod) {
        return { allowed: false, reason: 'Holiday period - manual approval required' };
      }

      return { allowed: true, reason: 'Merchant settings allow auto-confirmation' };

    } catch (error) {
      console.error('Error checking merchant overrides:', error);
      return { allowed: true, reason: 'Merchant override check failed - allowing booking' };
    }
  }

  /**
   * Check service-specific blackout dates
   */
  checkBlackoutDates(service, bookingMoment) {
    try {
      // This would typically be stored as JSON in the service record
      const blackoutDates = service.blackout_dates || [];
      
      if (!Array.isArray(blackoutDates) || blackoutDates.length === 0) {
        return { allowed: true, reason: 'No blackout dates' };
      }

      const bookingDate = bookingMoment.format('YYYY-MM-DD');
      
      for (const blackoutPeriod of blackoutDates) {
        if (typeof blackoutPeriod === 'string') {
          // Single date
          if (blackoutPeriod === bookingDate) {
            return { allowed: false, reason: 'Date is blacked out for this service' };
          }
        } else if (blackoutPeriod.start && blackoutPeriod.end) {
          // Date range
          const startDate = moment(blackoutPeriod.start);
          const endDate = moment(blackoutPeriod.end);
          
          if (bookingMoment.isBetween(startDate, endDate, 'day', '[]')) {
            return { 
              allowed: false, 
              reason: `Booking falls within blackout period (${blackoutPeriod.start} to ${blackoutPeriod.end})` 
            };
          }
        }
      }

      return { allowed: true, reason: 'Date not in blackout periods' };

    } catch (error) {
      console.error('Error checking blackout dates:', error);
      return { allowed: true, reason: 'Blackout date check failed - allowing booking' };
    }
  }

  /**
   * Check if date falls within holiday period
   */
  isHolidayPeriod(bookingDateTime) {
    const bookingMoment = moment(bookingDateTime);
    const year = bookingMoment.year();

    // Define holiday periods (this could be configurable)
    const holidayPeriods = [
      // Christmas period
      {
        start: moment(`${year}-12-20`),
        end: moment(`${year}-12-26`)
      },
      // New Year period
      {
        start: moment(`${year}-12-30`),
        end: moment(`${year + 1}-01-02`)
      },
      // Add more holidays as needed
    ];

    return holidayPeriods.some(period => 
      bookingMoment.isBetween(period.start, period.end, 'day', '[]')
    );
  }

  /**
   * Generate audit trail for auto-confirmation decision
   */
  generateAuditTrail(serviceId, bookingDateTime, decision, checks = {}) {
    return {
      timestamp: new Date().toISOString(),
      serviceId,
      bookingDateTime,
      decision: decision.canAutoConfirm ? 'AUTO_CONFIRMED' : 'MANUAL_REVIEW_REQUIRED',
      reason: decision.reason,
      checks: checks,
      systemVersion: '1.0.0'
    };
  }

  /**
   * Apply auto-confirmation to booking creation
   */
  async applyAutoConfirmation(bookingData) {
    try {
      const { serviceId, startTime, staffId, storeId, paymentReceived = false } = bookingData;

      const autoConfirmResult = await this.evaluateAutoConfirmationRules(
        serviceId,
        startTime,
        staffId,
        storeId,
        paymentReceived
      );

      let initialStatus = 'pending';
      let confirmationNotes = '';
      let auditTrail = this.generateAuditTrail(serviceId, startTime, autoConfirmResult);

      if (autoConfirmResult.canAutoConfirm) {
        initialStatus = 'confirmed';
        confirmationNotes = `Auto-confirmed: ${autoConfirmResult.reason}`;
        auditTrail.autoConfirmed = true;
      } else {
        confirmationNotes = `Manual review required: ${autoConfirmResult.reason}`;
        auditTrail.autoConfirmed = false;
      }

      return {
        status: initialStatus,
        auto_confirmed: autoConfirmResult.canAutoConfirm,
        confirmation_notes: confirmationNotes,
        audit_trail: JSON.stringify(auditTrail),
        manually_confirmed: false,
        ...bookingData
      };

    } catch (error) {
      console.error('Error applying auto-confirmation:', error);
      
      // Default to manual confirmation on error
      return {
        status: 'pending',
        auto_confirmed: false,
        confirmation_notes: 'Auto-confirmation failed - defaulting to manual review',
        audit_trail: JSON.stringify({
          error: error.message,
          timestamp: new Date().toISOString(),
          decision: 'ERROR_FALLBACK'
        }),
        ...bookingData
      };
    }
  }
}

module.exports = AutoConfirmationService;