// services/slotGenerationService.js - Enhanced with store-level conflict prevention

const moment = require('moment');
const { Op } = require('sequelize');

class SlotGenerationService {
  constructor(models) {
    this.models = models;
  }

  /**
   * Enhanced working days validation with cleaner logic
   */
  validateDateAndStore(date, store) {
    const targetDate = new Date(date + 'T00:00:00');
    
    if (isNaN(targetDate.getTime())) {
      return { isValid: false, message: 'Invalid date format' };
    }
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (targetDate < today) {
      return { isValid: false, message: 'Cannot book slots for past dates' };
    }
  
    const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
    let workingDays = this.parseWorkingDays(store.working_days);
    
    if (!workingDays || workingDays.length === 0) {
      return { 
        isValid: false, 
        message: 'Store working days not configured'
      };
    }
  
    const dayMatches = workingDays.some(workingDay => 
      workingDay.toLowerCase().trim() === dayOfWeek.toLowerCase().trim()
    );
  
    if (!dayMatches) {
      const formattedWorkingDays = workingDays.map(day => 
        day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()
      ).join(', ');
      
      return { 
        isValid: false, 
        message: `Store is closed on ${dayOfWeek}. Open days: ${formattedWorkingDays}`
      };
    }
  
    return { isValid: true, workingDays, targetDay: dayOfWeek };
  }

  /**
   * Clean working days parser
   */
  parseWorkingDays(workingDays) {
    if (!workingDays) return [];
    
    if (Array.isArray(workingDays)) {
      return workingDays.filter(day => day && typeof day === 'string');
    }
    
    if (typeof workingDays === 'string') {
      try {
        const parsed = JSON.parse(workingDays);
        if (Array.isArray(parsed)) {
          return parsed.filter(day => day && typeof day === 'string');
        }
      } catch (e) {
        return workingDays.split(',').map(day => day.trim()).filter(day => day);
      }
    }
    
    return [];
  }

  /**
   * CORE FIX: Generate available time slots with per-staff conflict prevention
   */
  async generateAvailableSlots(entityId, entityType = 'offer', date, options = {}) {
    try {
      const { staffId } = options;

      // Get entity details
      const entity = await this.getEntityDetails(entityId, entityType);
      if (!entity) {
        throw new Error(`${entityType} not found`);
      }

      // Get the underlying service
      const service = entityType === 'offer' ? entity.service : entity;
      if (!service) {
        throw new Error('Associated service not found');
      }

      // Get store details
      const store = service.store || await this.models.Store.findByPk(service.store_id);
      if (!store) {
        throw new Error('Store not found');
      }

      // Validate date and store working hours
      const validationResult = this.validateDateAndStore(date, store);
      if (!validationResult.isValid) {
        return {
          success: false,
          businessRuleViolation: true,
          message: validationResult.message,
          availableSlots: [],
          storeInfo: this.formatStoreInfo(store)
        };
      }

      // Generate base time slots
      const baseSlots = this.generateBaseSlots(service, store);

      // NEW: If staffId is provided, get staff-specific bookings
      // Otherwise, fall back to store-level bookings
      const existingBookings = staffId
        ? await this.getStaffBookings(staffId, date)
        : await this.getStoreBookings(store.id, date);

      // Calculate slot availability (now supports per-staff)
      const slotsWithAvailability = this.calculateSlotAvailability(
        baseSlots,
        existingBookings,
        service,
        staffId ? 'staff' : 'store'
      );

      // Format slots for frontend
      const formattedSlots = slotsWithAvailability
        .filter(slot => slot.available > 0)
        .map(slot => ({
          time: moment(slot.startTime, 'HH:mm').format('h:mm A'),
          startTime: slot.startTime,
          endTime: slot.endTime,
          available: slot.available,
          total: staffId ? 1 : (service.max_concurrent_bookings || 1),
          booked: staffId ? (slot.booked > 0 ? 1 : 0) : ((service.max_concurrent_bookings || 1) - slot.available),
          isAvailable: slot.available > 0,
          staffId: staffId || null
        }));

      return {
        success: true,
        availableSlots: formattedSlots.map(slot => slot.time),
        detailedSlots: formattedSlots,
        storeInfo: this.formatStoreInfo(store),
        bookingRules: {
          maxConcurrentBookings: service.max_concurrent_bookings || 1,
          serviceDuration: service.duration,
          bufferTime: service.buffer_time || 0,
          minAdvanceBooking: service.min_advance_booking || 30,
          maxAdvanceBooking: service.max_advance_booking || 10080
        },
        accessFee: entityType === 'offer' ? 5.99 : 0,
        isStaffSpecific: !!staffId
      };

    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to generate time slots',
        availableSlots: []
      };
    }
  }

  /**
   * CORE FIX: Get ALL bookings for a store on a specific date
   * This ensures no double-booking between offers and services
   */
  async getStoreBookings(storeId, date) {
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

    try {
      // Get all services for this store
      const services = await this.models.Service.findAll({
        where: { store_id: storeId },
        attributes: ['id']
      });
      const serviceIds = services.map(service => service.id);

      if (serviceIds.length === 0) {
        return [];
      }

      // Get all offers for these services
      const offers = await this.models.Offer.findAll({
        where: { service_id: { [Op.in]: serviceIds } },
        attributes: ['id']
      });
      const offerIds = offers.map(offer => offer.id);

      // Get all bookings for this store (both direct service and offer bookings)
      const whereConditions = {
        startTime: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay,
        },
        status: { [Op.not]: 'cancelled' },
        [Op.or]: [
          { serviceId: { [Op.in]: serviceIds } },  // Direct service bookings
          ...(offerIds.length > 0 ? [{ offerId: { [Op.in]: offerIds } }] : []) // Offer bookings
        ]
      };

      const bookings = await this.models.Booking.findAll({
        where: whereConditions,
        attributes: ['id', 'startTime', 'endTime', 'serviceId', 'offerId', 'status', 'staffId'],
        order: [['startTime', 'ASC']]
      });

      return bookings;

    } catch (error) {
      console.error('Error fetching store bookings:', error);
      return [];
    }
  }

  /**
   * NEW: Get bookings for a specific staff member on a specific date
   * This enables per-staff conflict detection
   */
  async getStaffBookings(staffId, date) {
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

    try {
      // Get all bookings for this specific staff member
      const bookings = await this.models.Booking.findAll({
        where: {
          staffId: staffId,
          startTime: {
            [Op.gte]: startOfDay,
            [Op.lte]: endOfDay,
          },
          status: { [Op.not]: 'cancelled' }
        },
        attributes: ['id', 'startTime', 'endTime', 'serviceId', 'offerId', 'status', 'staffId'],
        order: [['startTime', 'ASC']]
      });

      return bookings;

    } catch (error) {
      console.error('Error fetching staff bookings:', error);
      return [];
    }
  }

  /**
   * Check if a specific slot is available
   */
  async isSlotAvailable(entityId, entityType, date, time) {
    try {
      const entity = await this.getEntityDetails(entityId, entityType);
      if (!entity) {
        return { available: false, reason: `${entityType} not found` };
      }

      const service = entityType === 'offer' ? entity.service : entity;
      if (!service) {
        return { available: false, reason: 'Associated service not found' };
      }

      const store = service.store || await this.models.Store.findByPk(service.store_id);
      if (!store) {
        return { available: false, reason: 'Store not found' };
      }

      const validationResult = this.validateDateAndStore(date, store);
      if (!validationResult.isValid) {
        return { available: false, reason: validationResult.message };
      }

      const baseSlots = this.generateBaseSlots(service, store);

      const requestedSlot = baseSlots.find(slot => {
        const slotTime = moment(slot.startTime, 'HH:mm').format('h:mm A');
        return slotTime === time || slot.startTime === time;
      });

      if (!requestedSlot) {
        return { available: false, reason: 'Requested time slot is not available' };
      }

      // Check store-level conflicts
      const existingBookings = await this.getStoreBookings(store.id, date);
      const slotsWithAvailability = this.calculateSlotAvailability([requestedSlot], existingBookings, service);
      const checkedSlot = slotsWithAvailability[0];

      if (checkedSlot.available > 0) {
        return {
          available: true,
          remainingSlots: checkedSlot.available,
          totalSlots: service.max_concurrent_bookings || 1
        };
      } else {
        return { available: false, reason: 'Time slot is fully booked' };
      }

    } catch (error) {
      return {
        available: true,
        remainingSlots: 1,
        totalSlots: 1,
        warning: 'Availability check failed, allowing booking'
      };
    }
  }

  /**
   * Transaction-aware slot availability check with row locking
   * Use this within a transaction to prevent race conditions
   */
  async isSlotAvailableWithLock(entityId, entityType, date, time, transaction, staffId = null) {
    try {
      const entity = await this.getEntityDetails(entityId, entityType);
      if (!entity) {
        return { available: false, reason: `${entityType} not found` };
      }

      const service = entityType === 'offer' ? entity.service : entity;
      if (!service) {
        return { available: false, reason: 'Associated service not found' };
      }

      const store = service.store || await this.models.Store.findByPk(service.store_id);
      if (!store) {
        return { available: false, reason: 'Store not found' };
      }

      const validationResult = this.validateDateAndStore(date, store);
      if (!validationResult.isValid) {
        return { available: false, reason: validationResult.message };
      }

      const baseSlots = this.generateBaseSlots(service, store);

      const requestedSlot = baseSlots.find(slot => {
        const slotTime = moment(slot.startTime, 'HH:mm').format('h:mm A');
        return slotTime === time || slot.startTime === time;
      });

      if (!requestedSlot) {
        return { available: false, reason: 'Requested time slot is not available' };
      }

      // Get existing bookings with FOR UPDATE lock to prevent race conditions
      const startOfDay = moment(date).startOf('day').toDate();
      const endOfDay = moment(date).endOf('day').toDate();

      // Get all services for this store
      const services = await this.models.Service.findAll({
        where: { store_id: store.id },
        attributes: ['id'],
        ...(transaction && { transaction })
      });
      const serviceIds = services.map(svc => svc.id);

      // Build query conditions
      const whereConditions = {
        startTime: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay,
        },
        status: { [Op.notIn]: ['cancelled', 'no_show'] }
      };

      // Add staff filter if provided
      if (staffId) {
        whereConditions.staffId = staffId;
      } else {
        // Get all offers for these services
        const offers = await this.models.Offer.findAll({
          where: { service_id: { [Op.in]: serviceIds } },
          attributes: ['id'],
          ...(transaction && { transaction })
        });
        const offerIds = offers.map(offer => offer.id);

        whereConditions[Op.or] = [
          { serviceId: { [Op.in]: serviceIds } },
          ...(offerIds.length > 0 ? [{ offerId: { [Op.in]: offerIds } }] : [])
        ];
      }

      // Use FOR UPDATE lock when inside a transaction
      const existingBookings = await this.models.Booking.findAll({
        where: whereConditions,
        attributes: ['id', 'startTime', 'endTime', 'serviceId', 'offerId', 'status', 'staffId'],
        order: [['startTime', 'ASC']],
        ...(transaction && { transaction, lock: transaction.LOCK.UPDATE })
      });

      const slotsWithAvailability = this.calculateSlotAvailability([requestedSlot], existingBookings, service);
      const checkedSlot = slotsWithAvailability[0];

      if (checkedSlot.available > 0) {
        return {
          available: true,
          remainingSlots: checkedSlot.available,
          totalSlots: service.max_concurrent_bookings || 1
        };
      } else {
        return { available: false, reason: 'Time slot is fully booked' };
      }

    } catch (error) {
      console.error('Error in isSlotAvailableWithLock:', error);
      return {
        available: false,
        reason: 'Failed to verify slot availability',
        error: error.message
      };
    }
  }

  /**
   * NEW: Get all staff availability for a service on a specific date
   * Returns each staff member with their individual slot availability
   */
  async getStaffAvailability(serviceId, date) {
    try {
      // Get service with assigned staff
      const service = await this.models.Service.findByPk(serviceId, {
        include: [
          {
            model: this.models.Store,
            as: 'store'
          },
          {
            model: this.models.Staff,
            as: 'staff',
            through: {
              model: this.models.StaffService,
              where: { isActive: true }
            },
            where: { status: 'active' }
          }
        ]
      });

      if (!service) {
        throw new Error('Service not found');
      }

      if (!service.staff || service.staff.length === 0) {
        return {
          success: false,
          message: 'No staff assigned to this service',
          staff: []
        };
      }

      const store = service.store;
      if (!store) {
        throw new Error('Store not found');
      }

      // Validate date and store working hours
      const validationResult = this.validateDateAndStore(date, store);
      if (!validationResult.isValid) {
        return {
          success: false,
          message: validationResult.message,
          staff: []
        };
      }

      // Generate base slots
      const baseSlots = this.generateBaseSlots(service, store);

      // Get availability for each staff member
      const staffAvailability = await Promise.all(
        service.staff.map(async (staffMember) => {
          const staffBookings = await this.getStaffBookings(staffMember.id, date);
          const slotsWithAvailability = this.calculateSlotAvailability(
            baseSlots,
            staffBookings,
            service,
            'staff'
          );

          const availableSlots = slotsWithAvailability
            .filter(slot => slot.available > 0)
            .map(slot => ({
              time: moment(slot.startTime, 'HH:mm').format('h:mm A'),
              startTime: slot.startTime,
              endTime: slot.endTime,
              isAvailable: true
            }));

          return {
            id: staffMember.id,
            name: staffMember.name,
            email: staffMember.email,
            phone: staffMember.phone,
            specialization: staffMember.specialization || null,
            availableSlots: availableSlots,
            totalAvailableSlots: availableSlots.length,
            isAvailable: availableSlots.length > 0
          };
        })
      );

      return {
        success: true,
        date,
        serviceName: service.name,
        staff: staffAvailability,
        storeInfo: this.formatStoreInfo(store)
      };

    } catch (error) {
      console.error('Error getting staff availability:', error);
      return {
        success: false,
        message: error.message || 'Failed to get staff availability',
        staff: []
      };
    }
  }

  /**
   * NEW: Get slots with staff availability (slot-centric view)
   * Returns each time slot with a list of available staff members
   * This supports the hybrid UX where users select time first, then see which staff are available
   */
  async getSlotsWithStaffAvailability(serviceId, date) {
    try {
      // Get service with assigned staff
      const service = await this.models.Service.findByPk(serviceId, {
        include: [
          {
            model: this.models.Store,
            as: 'store'
          },
          {
            model: this.models.Staff,
            as: 'staff',
            through: {
              model: this.models.StaffService,
              where: { isActive: true }
            },
            where: { status: 'active' }
          }
        ]
      });

      if (!service) {
        throw new Error('Service not found');
      }

      if (!service.staff || service.staff.length === 0) {
        return {
          success: false,
          message: 'No staff assigned to this service',
          slots: []
        };
      }

      const store = service.store;
      if (!store) {
        throw new Error('Store not found');
      }

      // Validate date and store working hours
      const validationResult = this.validateDateAndStore(date, store);
      if (!validationResult.isValid) {
        return {
          success: false,
          message: validationResult.message,
          slots: []
        };
      }

      // Generate base slots
      const baseSlots = this.generateBaseSlots(service, store);

      // For each slot, determine which staff members are available
      const slotsWithStaffAvailability = await Promise.all(
        baseSlots.map(async (slot) => {
          const slotStart = moment(`2023-01-01 ${slot.startTime}`);
          const slotEnd = moment(`2023-01-01 ${slot.endTime}`);

          // Check each staff member's availability for this slot
          const availableStaff = await Promise.all(
            service.staff.map(async (staffMember) => {
              // Get all bookings for this staff on the given date
              const staffBookings = await this.getStaffBookings(staffMember.id, date);

              // Check if this staff has any overlapping bookings for this slot
              const hasConflict = staffBookings.some(booking => {
                const bookingStart = moment(booking.startTime);
                const bookingEnd = moment(booking.endTime);

                const bookingStartTime = moment(`2023-01-01 ${bookingStart.format('HH:mm')}`);
                const bookingEndTime = moment(`2023-01-01 ${bookingEnd.format('HH:mm')}`);

                return bookingStartTime.isBefore(slotEnd) && bookingEndTime.isAfter(slotStart);
              });

              // Return staff info if they're available (no conflict)
              if (!hasConflict) {
                return {
                  id: staffMember.id,
                  name: staffMember.name,
                  email: staffMember.email,
                  phone: staffMember.phone,
                  specialization: staffMember.specialization || null
                };
              }
              return null;
            })
          );

          // Filter out null values (staff who are not available)
          const availableStaffFiltered = availableStaff.filter(staff => staff !== null);

          return {
            time: moment(slot.startTime, 'HH:mm').format('h:mm A'),
            startTime: slot.startTime,
            endTime: slot.endTime,
            availableStaffCount: availableStaffFiltered.length,
            availableStaff: availableStaffFiltered,
            isAvailable: availableStaffFiltered.length > 0
          };
        })
      );

      // Filter to only include slots where at least one staff is available
      const availableSlots = slotsWithStaffAvailability.filter(slot => slot.isAvailable);

      return {
        success: true,
        date,
        serviceName: service.name,
        serviceDuration: service.duration,
        totalSlots: slotsWithStaffAvailability.length,
        availableSlots: availableSlots.length,
        slots: availableSlots,
        storeInfo: this.formatStoreInfo(store)
      };

    } catch (error) {
      console.error('Error getting slots with staff availability:', error);
      return {
        success: false,
        message: error.message || 'Failed to get slots with staff availability',
        slots: []
      };
    }
  }

  /**
   * Get entity details (service or offer)
   */
  async getEntityDetails(entityId, entityType) {
    const includeService = {
      model: this.models.Service,
      as: 'service',
      include: [{
        model: this.models.Store,
        as: 'store'
      }]
    };

    if (entityType === 'offer') {
      return await this.models.Offer.findByPk(entityId, {
        include: [includeService]
      });
    } else {
      return await this.models.Service.findByPk(entityId, {
        include: [{
          model: this.models.Store,
          as: 'store'
        }]
      });
    }
  }

  /**
   * Generate base time slots
   */
  generateBaseSlots(service, store) {
    const slots = [];
    const serviceDuration = service.duration || 60;
    const slotInterval = serviceDuration;
    const bufferTime = service.buffer_time || 0;
    
    const openingTime = moment(store.opening_time, ['HH:mm:ss', 'HH:mm']);
    const closingTime = moment(store.closing_time, ['HH:mm:ss', 'HH:mm']);

    if (!openingTime.isValid() || !closingTime.isValid()) {
      return [];
    }

    const lastSlotStartTime = closingTime.clone().subtract(serviceDuration, 'minutes');
    let currentSlotTime = openingTime.clone();

    while (currentSlotTime.isSameOrBefore(lastSlotStartTime)) {
      const slotEndTime = currentSlotTime.clone().add(serviceDuration, 'minutes');
      
      if (slotEndTime.isAfter(closingTime)) {
        break;
      }

      slots.push({
        startTime: currentSlotTime.format('HH:mm'),
        endTime: slotEndTime.format('HH:mm'),
        available: service.max_concurrent_bookings || 1,
        bookings: []
      });

      currentSlotTime.add(slotInterval + bufferTime, 'minutes');
    }

    return slots;
  }

  /**
   * Calculate slot availability with per-staff or store-level conflict prevention
   * @param {Array} baseSlots - Base time slots generated
   * @param {Array} existingBookings - Bookings to check against
   * @param {Object} service - Service configuration
   * @param {String} mode - 'staff' for per-staff checking, 'store' for store-wide checking
   */
  calculateSlotAvailability(baseSlots, existingBookings, service, mode = 'store') {
    return baseSlots.map(slot => {
      const slotStart = moment(`2023-01-01 ${slot.startTime}`);
      const slotEnd = moment(`2023-01-01 ${slot.endTime}`);

      // Find ALL overlapping bookings
      const overlappingBookings = existingBookings.filter(booking => {
        const bookingStart = moment(booking.startTime);
        const bookingEnd = moment(booking.endTime);

        // Convert to same day for comparison
        const bookingStartTime = moment(`2023-01-01 ${bookingStart.format('HH:mm')}`);
        const bookingEndTime = moment(`2023-01-01 ${bookingEnd.format('HH:mm')}`);

        return bookingStartTime.isBefore(slotEnd) && bookingEndTime.isAfter(slotStart);
      });

      const bookedCount = overlappingBookings.length;

      // Per-staff mode means only 1 booking allowed (staff can't be in 2 places at once)
      // Store mode uses max_concurrent_bookings setting
      const maxConcurrent = mode === 'staff' ? 1 : (service.max_concurrent_bookings || 1);
      const available = Math.max(0, maxConcurrent - bookedCount);

      return {
        ...slot,
        available,
        booked: bookedCount,
        bookings: overlappingBookings
      };
    });
  }

  /**
   * Format store information
   */
  formatStoreInfo(store) {
    const workingDays = this.parseWorkingDays(store.working_days)
      .map(day => day.charAt(0).toUpperCase() + day.slice(1).toLowerCase());

    return {
      name: store.name,
      location: store.location,
      openingTime: moment(store.opening_time, 'HH:mm').format('h:mm A'),
      closingTime: moment(store.closing_time, 'HH:mm').format('h:mm A'),
      workingDays: workingDays
    };
  }
}

module.exports = SlotGenerationService;