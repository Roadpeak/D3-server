// services/slotGenerationService.js - Comprehensive slot generation logic

const moment = require('moment');
const { Op } = require('sequelize');

class SlotGenerationService {
  constructor(models) {
    this.models = models;
  }

  /**
   * Generate available time slots for a service/offer on a specific date
   * @param {string} entityId - Service ID or Offer ID
   * @param {string} entityType - 'service' or 'offer'
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {Object} options - Additional options
   * @returns {Object} Available slots with booking information
   */
  async generateAvailableSlots(entityId, entityType = 'offer', date, options = {}) {
    try {
      console.log(`🕒 Generating slots for ${entityType} ${entityId} on ${date}`);

      // Get entity details (service or offer)
      const entity = await this.getEntityDetails(entityId, entityType);
      if (!entity) {
        throw new Error(`${entityType} not found`);
      }

      // Get the underlying service (for offers, get the linked service)
      const service = entityType === 'offer' ? entity.service : entity;
      if (!service) {
        throw new Error('Associated service not found');
      }

      // Get store details
      const store = service.store || await this.models.Store.findByPk(service.store_id);
      if (!store) {
        throw new Error('Store not found');
      }

      console.log(`🏪 Store: ${store.name}`);
      console.log(`⚙️ Service: ${service.name} (${service.duration}min, max ${service.max_concurrent_bookings} concurrent)`);

      // Validate date and check if store is open
      const validationResult = this.validateDateAndStore(date, store);
      if (!validationResult.isValid) {
        return {
          success: false,
          message: validationResult.message,
          availableSlots: [],
          storeInfo: this.formatStoreInfo(store),
          entityInfo: this.formatEntityInfo(entity, entityType)
        };
      }

      // Generate base time slots
      const baseSlots = this.generateBaseSlots(service, store);
      console.log(`📋 Generated ${baseSlots.length} base slots`);

      // Get existing bookings for both service and offers
      const existingBookings = await this.getExistingBookings(service, date);
      console.log(`📅 Found ${existingBookings.length} existing bookings`);

      // Calculate slot availability
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
          total: service.max_concurrent_bookings,
          booked: service.max_concurrent_bookings - slot.available,
          isAvailable: slot.available > 0
        }));

      console.log(`✅ ${formattedSlots.length} available slots generated`);

      return {
        success: true,
        availableSlots: formattedSlots.map(slot => slot.time), // For backward compatibility
        detailedSlots: formattedSlots,
        storeInfo: this.formatStoreInfo(store),
        entityInfo: this.formatEntityInfo(entity, entityType),
        bookingRules: {
          maxConcurrentBookings: service.max_concurrent_bookings,
          serviceDuration: service.duration,
          bufferTime: service.buffer_time || 0,
          minAdvanceBooking: service.min_advance_booking || 30,
          maxAdvanceBooking: service.max_advance_booking || 10080
        },
        debug: {
          totalBaseSlots: baseSlots.length,
          existingBookings: existingBookings.length,
          availableSlots: formattedSlots.length
        }
      };

    } catch (error) {
      console.error('💥 Slot generation error:', error);
      return {
        success: false,
        message: error.message || 'Failed to generate time slots',
        availableSlots: [],
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
   * Validate date and check if store is open on that day
   */
  validateDateAndStore(date, store) {
    const targetDate = moment(date, 'YYYY-MM-DD');
    
    if (!targetDate.isValid()) {
      return { isValid: false, message: 'Invalid date format' };
    }

    if (targetDate.isBefore(moment().startOf('day'))) {
      return { isValid: false, message: 'Cannot book slots for past dates' };
    }

    const dayOfWeek = targetDate.format('dddd');
    let workingDays = store.working_days;
    
    // Parse working days if it's a string
    if (typeof workingDays === 'string') {
      try {
        workingDays = JSON.parse(workingDays);
      } catch {
        workingDays = workingDays.split(',').map(day => day.trim());
      }
    }

    if (!workingDays || !Array.isArray(workingDays) || !workingDays.includes(dayOfWeek)) {
      return { 
        isValid: false, 
        message: `Store is closed on ${dayOfWeek}`,
        workingDays: workingDays
      };
    }

    return { isValid: true };
  }

  /**
   * Generate base time slots based on store hours and service duration
   */
  generateBaseSlots(service, store) {
    const slots = [];
    const serviceDuration = service.duration || 60;
    const slotInterval = service.getSlotInterval();
    const bufferTime = service.buffer_time || 0;
    
    const openingTime = moment(store.opening_time, ['HH:mm:ss', 'HH:mm']);
    const closingTime = moment(store.closing_time, ['HH:mm:ss', 'HH:mm']);

    if (!openingTime.isValid() || !closingTime.isValid()) {
      console.warn('Invalid store hours:', { opening: store.opening_time, closing: store.closing_time });
      return [];
    }

    // Calculate the last possible slot start time
    const lastSlotStartTime = closingTime.clone().subtract(serviceDuration, 'minutes');
    
    let currentSlotTime = openingTime.clone();

    while (currentSlotTime.isSameOrBefore(lastSlotStartTime)) {
      const slotEndTime = currentSlotTime.clone().add(serviceDuration, 'minutes');
      
      // Make sure slot doesn't go past closing time
      if (slotEndTime.isAfter(closingTime)) {
        break;
      }

      slots.push({
        startTime: currentSlotTime.format('HH:mm'),
        endTime: slotEndTime.format('HH:mm'),
        available: service.max_concurrent_bookings || 1,
        bookings: []
      });

      // Move to next slot with interval + buffer time
      currentSlotTime.add(slotInterval + bufferTime, 'minutes');
    }

    return slots;
  }

  /**
   * Get existing bookings for a service and all its offers on a specific date
   */
  async getExistingBookings(service, date) {
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

    try {
      // Get service IDs (main service + all offers linked to it)
      const serviceIds = [service.id];
      
      // Get all offers for this service
      const offers = await this.models.Offer.findAll({
        where: { service_id: service.id },
        attributes: ['id']
      });
      
      const offerIds = offers.map(offer => offer.id);

      console.log(`🔍 Checking bookings for service ${service.id} and ${offerIds.length} offers`);

      // Get bookings for both direct service bookings AND offer bookings
      const bookings = await this.models.Booking.findAll({
        where: {
          startTime: {
            [Op.gte]: startOfDay,
            [Op.lte]: endOfDay,
          },
          status: { [Op.not]: 'cancelled' },
          [Op.or]: [
            { serviceId: service.id }, // Direct service bookings
            { offerId: { [Op.in]: offerIds } } // Offer bookings
          ]
        },
        attributes: ['startTime', 'endTime', 'serviceId', 'offerId', 'status'],
        order: [['startTime', 'ASC']]
      });

      console.log(`📊 Found ${bookings.length} existing bookings (${bookings.filter(b => b.serviceId).length} service, ${bookings.filter(b => b.offerId).length} offer)`);

      return bookings;
    } catch (error) {
      console.error('Error fetching existing bookings:', error);
      return [];
    }
  }

  /**
   * Calculate slot availability considering existing bookings and concurrent limits
   */
  calculateSlotAvailability(baseSlots, existingBookings, service) {
    return baseSlots.map(slot => {
      const slotStart = moment(`2023-01-01 ${slot.startTime}`);
      const slotEnd = moment(`2023-01-01 ${slot.endTime}`);

      // Find overlapping bookings
      const overlappingBookings = existingBookings.filter(booking => {
        const bookingStart = moment(booking.startTime);
        const bookingEnd = moment(booking.endTime);

        // Check for overlap (booking starts before slot ends AND booking ends after slot starts)
        return bookingStart.isBefore(slotEnd) && bookingEnd.isAfter(slotStart);
      });

      const bookedCount = overlappingBookings.length;
      const maxConcurrent = service.max_concurrent_bookings || 1;
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
   * Format store information for response
   */
  formatStoreInfo(store) {
    return {
      name: store.name,
      location: store.location,
      openingTime: moment(store.opening_time, 'HH:mm').format('h:mm A'),
      closingTime: moment(store.closing_time, 'HH:mm').format('h:mm A'),
      workingDays: Array.isArray(store.working_days) ? store.working_days : []
    };
  }

  /**
   * Format entity information for response
   */
  formatEntityInfo(entity, entityType) {
    if (entityType === 'offer') {
      return {
        type: 'offer',
        title: entity.title || entity.service?.name,
        description: entity.description,
        discount: entity.discount,
        originalPrice: entity.service?.price,
        discountedPrice: entity.service?.price ? 
          (entity.service.price * (1 - entity.discount / 100)).toFixed(2) : null,
        duration: entity.service?.duration,
        status: entity.status
      };
    } else {
      return {
        type: 'service',
        name: entity.name,
        price: entity.price,
        duration: entity.duration,
        status: entity.status
      };
    }
  }

  /**
   * Check if a specific slot time is available
   */
  async isSlotAvailable(entityId, entityType, date, time, excludeBookingId = null) {
    try {
      const result = await this.generateAvailableSlots(entityId, entityType, date);
      
      if (!result.success) {
        return { available: false, reason: result.message };
      }

      const requestedSlot = result.detailedSlots?.find(slot => 
        slot.time === time || slot.startTime === time
      );

      if (!requestedSlot) {
        return { available: false, reason: 'Slot not found or outside business hours' };
      }

      // If excluding a booking (for updates), add 1 to available count
      const adjustedAvailable = excludeBookingId ? requestedSlot.available + 1 : requestedSlot.available;

      return {
        available: adjustedAvailable > 0,
        remainingSlots: adjustedAvailable,
        totalSlots: requestedSlot.total
      };
    } catch (error) {
      console.error('Error checking slot availability:', error);
      return { available: false, reason: 'Error checking availability' };
    }
  }
}

module.exports = SlotGenerationService;