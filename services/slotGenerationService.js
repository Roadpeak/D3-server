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
   * CORE FIX: Generate available time slots with store-level conflict prevention
   */
  async generateAvailableSlots(entityId, entityType = 'offer', date, options = {}) {
    try {
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

      // KEY FIX: Get ALL bookings for the store on this date (both offers and services)
      const existingBookings = await this.getStoreBookings(store.id, date);

      // Calculate slot availability considering store-level conflicts
      const slotsWithAvailability = this.calculateSlotAvailability(
        baseSlots, 
        existingBookings, 
        service
      );

      // Format slots for frontend
      const formattedSlots = slotsWithAvailability
        .filter(slot => slot.available > 0)
        .map(slot => ({
          time: moment(slot.startTime, 'HH:mm').format('h:mm A'),
          startTime: slot.startTime,
          endTime: slot.endTime,
          available: slot.available,
          total: service.max_concurrent_bookings || 1,
          booked: (service.max_concurrent_bookings || 1) - slot.available,
          isAvailable: slot.available > 0
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
        accessFee: entityType === 'offer' ? 5.99 : 0
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
  
    console.log('=== STORE BOOKINGS DEBUG ===');
    console.log('Store ID:', storeId);
    console.log('Date:', date);
    console.log('Start of day:', startOfDay);
    console.log('End of day:', endOfDay);
  
  
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
        attributes: ['id', 'startTime', 'endTime', 'serviceId', 'offerId', 'status'],
        order: [['startTime', 'ASC']]
      });
    
      console.log('Found bookings:', bookings.map(b => ({
        id: b.id,
        startTime: b.startTime,
        status: b.status,
        offerId: b.offerId,
        serviceId: b.serviceId
      })));
      console.log('=== END STORE BOOKINGS DEBUG ===');
    
      return bookings;

    } catch (error) {
      console.error('Error fetching store bookings:', error);
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
   * Calculate slot availability with store-level conflict prevention
   */
  calculateSlotAvailability(baseSlots, existingBookings, service) {
    console.log('=== SLOT AVAILABILITY DEBUG ===');
    console.log('Existing bookings for this date:', existingBookings.length);
    console.log('Bookings:', existingBookings.map(b => ({
      id: b.id,
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status
    })));
    
    return baseSlots.map(slot => {
      const slotStart = moment(`2023-01-01 ${slot.startTime}`);
      const slotEnd = moment(`2023-01-01 ${slot.endTime}`);
  
      console.log(`Checking slot ${slot.startTime} - ${slot.endTime}`);
  
      // Find ALL overlapping bookings from the entire store
      const overlappingBookings = existingBookings.filter(booking => {
        const bookingStart = moment(booking.startTime);
        const bookingEnd = moment(booking.endTime);
        
        // Convert to same day for comparison
        const bookingStartTime = moment(`2023-01-01 ${bookingStart.format('HH:mm')}`);
        const bookingEndTime = moment(`2023-01-01 ${bookingEnd.format('HH:mm')}`);
        
        const overlaps = bookingStartTime.isBefore(slotEnd) && bookingEndTime.isAfter(slotStart);
        
        if (overlaps) {
          console.log(`Found overlap: Booking ${booking.id} (${bookingStart.format('HH:mm')} - ${bookingEnd.format('HH:mm')}) overlaps with slot ${slot.startTime} - ${slot.endTime}`);
        }
        
        return overlaps;
      });
  
      const bookedCount = overlappingBookings.length;
      const maxConcurrent = service.max_concurrent_bookings || 1;
      const available = Math.max(0, maxConcurrent - bookedCount);
  
      console.log(`Slot ${slot.startTime}: ${available}/${maxConcurrent} available (${bookedCount} booked)`);
  
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