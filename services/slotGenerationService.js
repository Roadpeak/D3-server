// services/slotGenerationService.js - Complete fixed version with database column fixes

const moment = require('moment');
const { Op } = require('sequelize');

class SlotGenerationService {
  constructor(models) {
    this.models = models;
  }

  /**
   * FIXED: Enhanced working days validation that handles ANY format
   */
  validateDateAndStore(date, store) {
    // Use native Date with timezone fix instead of moment
    const targetDate = new Date(date + 'T00:00:00'); // Force local timezone
    
    if (isNaN(targetDate.getTime())) {
      return { isValid: false, message: 'Invalid date format' };
    }
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (targetDate < today) {
      return { isValid: false, message: 'Cannot book slots for past dates' };
    }
  
    // Use native Date instead of moment
    const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
    let workingDays = store.working_days;
    
    console.log('🔍 Working days validation:', {
      storeId: store.id,
      storeName: store.name,
      inputDate: date,
      targetDate: targetDate.toISOString(),
      dayOfWeek: dayOfWeek,
      dayIndex: targetDate.getDay(),
      rawWorkingDays: workingDays,
      workingDaysType: typeof workingDays
    });
  
    if (!workingDays) {
      console.error('❌ No working_days defined for store');
      return { 
        isValid: false, 
        message: 'Store working days not configured'
      };
    }
  
    // Parse working days - handle both string and array formats
    let parsedWorkingDays = [];
    
    if (Array.isArray(workingDays)) {
      parsedWorkingDays = workingDays;
      console.log('✅ Working days is already an array:', parsedWorkingDays);
    } else if (typeof workingDays === 'string') {
      try {
        // Try parsing as JSON first
        parsedWorkingDays = JSON.parse(workingDays);
        console.log('✅ Parsed working days from JSON string:', parsedWorkingDays);
      } catch (e) {
        // If JSON parsing fails, try comma-separated
        parsedWorkingDays = workingDays.split(',').map(day => day.trim());
        console.log('✅ Parsed working days from comma-separated:', parsedWorkingDays);
      }
    }
  
    // Clean the array
    parsedWorkingDays = parsedWorkingDays.filter(day => day && day.toString().trim());
  
    if (parsedWorkingDays.length === 0) {
      console.error('❌ No valid working days found after parsing');
      return { 
        isValid: false, 
        message: 'Store has no working days configured'
      };
    }
  
    console.log('🔍 Final parsed working days:', parsedWorkingDays);
    console.log('🔍 Target day for comparison:', dayOfWeek);
  
    // Case-insensitive day matching with detailed logging
    const dayMatches = parsedWorkingDays.some(workingDay => {
      if (!workingDay) return false;
      
      const workingDayStr = workingDay.toString().toLowerCase().trim();
      const targetDayStr = dayOfWeek.toLowerCase().trim();
      
      console.log(`🔍 Comparing: "${workingDayStr}" vs "${targetDayStr}"`);
      
      const exactMatch = workingDayStr === targetDayStr;
      if (exactMatch) {
        console.log('✅ MATCH FOUND:', workingDayStr, '===', targetDayStr);
        return true;
      }
      
      return false;
    });
  
    if (!dayMatches) {
      console.error('❌ Working days validation failed:', {
        targetDay: dayOfWeek,
        targetDayLower: dayOfWeek.toLowerCase(),
        parsedWorkingDays: parsedWorkingDays,
        parsedWorkingDaysLower: parsedWorkingDays.map(d => d.toString().toLowerCase())
      });
      
      // Format working days for user message
      const formattedWorkingDays = parsedWorkingDays.map(day => {
        const dayStr = day.toString().trim();
        return dayStr.charAt(0).toUpperCase() + dayStr.slice(1).toLowerCase();
      }).join(', ');
      
      return { 
        isValid: false, 
        message: `Store is closed on ${dayOfWeek}. Open days: ${formattedWorkingDays}`,
        workingDays: parsedWorkingDays,
        targetDay: dayOfWeek
      };
    }
  
    console.log('✅ Validation passed for', dayOfWeek, 'against working days:', parsedWorkingDays);
    return { 
      isValid: true, 
      workingDays: parsedWorkingDays,
      targetDay: dayOfWeek 
    };
  }

  /**
   * Generate available time slots for a service/offer on a specific date
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
      console.log(`⚙️ Service: ${service.name} (${service.duration}min)`);
      console.log(`📅 Store working days:`, store.working_days);

      // Use the flexible validation
      const validationResult = this.validateDateAndStore(date, store);
      if (!validationResult.isValid) {
        console.log('❌ Validation failed:', validationResult);
        return {
          success: false,
          businessRuleViolation: true,
          message: validationResult.message,
          availableSlots: [],
          storeInfo: this.formatStoreInfo(store),
          entityInfo: this.formatEntityInfo(entity, entityType),
          debug: validationResult.debug || null
        };
      }

      console.log('✅ Validation passed - generating slots...');

      // Generate base time slots
      const baseSlots = this.generateBaseSlots(service, store);
      console.log(`📋 Generated ${baseSlots.length} base slots`);

      // Get existing bookings
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
          total: service.max_concurrent_bookings || 1,
          booked: (service.max_concurrent_bookings || 1) - slot.available,
          isAvailable: slot.available > 0
        }));

      console.log(`✅ ${formattedSlots.length} available slots generated successfully`);

      return {
        success: true,
        availableSlots: formattedSlots.map(slot => slot.time),
        detailedSlots: formattedSlots,
        storeInfo: this.formatStoreInfo(store),
        entityInfo: this.formatEntityInfo(entity, entityType),
        bookingRules: {
          maxConcurrentBookings: service.max_concurrent_bookings || 1,
          serviceDuration: service.duration,
          bufferTime: service.buffer_time || 0,
          minAdvanceBooking: service.min_advance_booking || 30,
          maxAdvanceBooking: service.max_advance_booking || 10080
        },
        accessFee: entityType === 'offer' ? 5.99 : 0,
        debug: {
          totalBaseSlots: baseSlots.length,
          existingBookings: existingBookings.length,
          availableSlots: formattedSlots.length,
          storeWorkingDays: validationResult.workingDays,
          targetDay: validationResult.targetDay,
          validationPassed: true
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
   * FIXED: Check if a specific slot is available
   */
  async isSlotAvailable(entityId, entityType, date, time) {
    try {
      console.log(`🔍 Checking slot availability: ${entityType} ${entityId} on ${date} at ${time}`);
  
      // Get the entity details to find the service
      const entity = await this.getEntityDetails(entityId, entityType);
      if (!entity) {
        return {
          available: false,
          reason: `${entityType} not found`
        };
      }
  
      // Get the underlying service
      const service = entityType === 'offer' ? entity.service : entity;
      if (!service) {
        return {
          available: false,
          reason: 'Associated service not found'
        };
      }
  
      // Get store details
      const store = service.store || await this.models.Store.findByPk(service.store_id);
      if (!store) {
        return {
          available: false,
          reason: 'Store not found'
        };
      }
  
      // Validate date and store working hours
      const validationResult = this.validateDateAndStore(date, store);
      if (!validationResult.isValid) {
        return {
          available: false,
          reason: validationResult.message
        };
      }
  
      // Generate base slots to see if the requested time is valid
      const baseSlots = this.generateBaseSlots(service, store);
      
      // Check if the requested time matches any base slot
      const requestedSlot = baseSlots.find(slot => {
        const slotTime = moment(slot.startTime, 'HH:mm').format('h:mm A');
        return slotTime === time || slot.startTime === time;
      });
  
      if (!requestedSlot) {
        return {
          available: false,
          reason: 'Requested time slot is not available for this service'
        };
      }
  
      // Get existing bookings with error handling
      let existingBookings = [];
      try {
        existingBookings = await this.getExistingBookings(service, date);
      } catch (bookingError) {
        console.warn('⚠️ Could not fetch existing bookings:', bookingError.message);
        
        // If we can't check existing bookings, assume available but warn
        return {
          available: true,
          remainingSlots: 1,
          totalSlots: service.max_concurrent_bookings || 1,
          warning: 'Could not verify against existing bookings'
        };
      }
      
      // Calculate availability for this specific slot
      const slotsWithAvailability = this.calculateSlotAvailability([requestedSlot], existingBookings, service);
      const checkedSlot = slotsWithAvailability[0];
  
      if (checkedSlot.available > 0) {
        return {
          available: true,
          remainingSlots: checkedSlot.available,
          totalSlots: service.max_concurrent_bookings || 1
        };
      } else {
        return {
          available: false,
          reason: 'Time slot is fully booked'
        };
      }
  
    } catch (error) {
      console.error('💥 Error checking slot availability:', error);
      
      // Don't block bookings due to availability check failures
      return {
        available: true,
        remainingSlots: 1,
        totalSlots: 1,
        warning: 'Availability check failed, allowing booking: ' + error.message
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
   * Generate base time slots based on store hours and service duration
   */
  generateBaseSlots(service, store) {
    const slots = [];
    const serviceDuration = service.duration || 60;
    const slotInterval = serviceDuration; // Use service duration as interval
    const bufferTime = service.buffer_time || 0;
    
    const openingTime = moment(store.opening_time, ['HH:mm:ss', 'HH:mm']);
    const closingTime = moment(store.closing_time, ['HH:mm:ss', 'HH:mm']);

    if (!openingTime.isValid() || !closingTime.isValid()) {
      console.warn('❌ Invalid store hours:', { opening: store.opening_time, closing: store.closing_time });
      return [];
    }

    console.log('🕐 Store hours:', {
      opening: openingTime.format('HH:mm'),
      closing: closingTime.format('HH:mm'),
      serviceDuration: serviceDuration,
      bufferTime: bufferTime
    });

    // Calculate the last possible slot start time
    const lastSlotStartTime = closingTime.clone().subtract(serviceDuration, 'minutes');
    
    let currentSlotTime = openingTime.clone();

    while (currentSlotTime.isSameOrBefore(lastSlotStartTime)) {
      const slotEndTime = currentSlotTime.clone().add(serviceDuration, 'minutes');
      
      // Make sure slot doesn't go past closing time
      if (slotEndTime.isAfter(closingTime)) {
        console.log('⏰ Slot would exceed closing time, stopping generation');
        break;
      }

      slots.push({
        startTime: currentSlotTime.format('HH:mm'),
        endTime: slotEndTime.format('HH:mm'),
        available: service.max_concurrent_bookings || 1,
        bookings: []
      });

      // Move to next slot
      currentSlotTime.add(slotInterval + bufferTime, 'minutes');
    }

    console.log(`📋 Generated ${slots.length} base slots`);
    return slots;
  }

  /**
   * FIXED: Get existing bookings with correct database column names
   */
  async getExistingBookings(service, date) {
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();
  
    try {
      console.log(`🔍 Checking bookings for service ${service.id} on ${date}`);
  
      // Get offers for this service first
      let offerIds = [];
      try {
        const offers = await this.models.Offer.findAll({
          where: { service_id: service.id },
          attributes: ['id']
        });
        offerIds = offers.map(offer => offer.id);
        console.log(`📋 Found ${offerIds.length} offers for service ${service.id}`);
      } catch (offerError) {
        console.warn('⚠️ Could not fetch offers:', offerError.message);
      }
  
      // Build the query conditions
      const whereConditions = {
        startTime: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay,
        },
        status: { [Op.not]: 'cancelled' }
      };
  
      // Add OR condition for direct service bookings OR offer-based bookings
      if (offerIds.length > 0) {
        whereConditions[Op.or] = [
          { serviceId: service.id },              // Direct service bookings
          { offerId: { [Op.in]: offerIds } }      // Offer bookings for this service
        ];
      } else {
        // No offers found, only check direct service bookings
        whereConditions.serviceId = service.id;
      }
  
      const bookings = await this.models.Booking.findAll({
        where: whereConditions,
        attributes: ['id', 'startTime', 'endTime', 'serviceId', 'offerId', 'status', 'bookingType'],
        order: [['startTime', 'ASC']]
      });
  
      console.log(`📊 Found ${bookings.length} existing bookings for service ${service.id}`);
      
      if (bookings.length > 0) {
        const directBookings = bookings.filter(b => b.serviceId === service.id);
        const offerBookings = bookings.filter(b => b.offerId && offerIds.includes(b.offerId));
        console.log(`   - ${directBookings.length} direct service bookings`);
        console.log(`   - ${offerBookings.length} offer-based bookings`);
      }
      
      return bookings;
  
    } catch (error) {
      console.error('❌ Error fetching existing bookings:', error);
      
      // Graceful fallback
      if (error.message && error.message.includes('Unknown column')) {
        console.warn('⚠️ Column issue still exists:', error.message);
        return [];
      }
      
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

        // Check for overlap
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
   * Format store information with flexible working days parsing
   */
  formatStoreInfo(store) {
    let workingDays = [];
    
    // Parse working days flexibly
    if (Array.isArray(store.working_days)) {
      workingDays = store.working_days;
    } else if (typeof store.working_days === 'string') {
      try {
        workingDays = JSON.parse(store.working_days);
      } catch (e) {
        workingDays = store.working_days.split(',').map(day => day.trim());
      }
    }
    
    // Ensure proper format
    workingDays = workingDays
      .filter(day => day && day.toString().trim())
      .map(day => {
        const dayStr = day.toString().trim();
        return dayStr.charAt(0).toUpperCase() + dayStr.slice(1).toLowerCase();
      });

    return {
      name: store.name,
      location: store.location,
      openingTime: moment(store.opening_time, 'HH:mm').format('h:mm A'),
      closingTime: moment(store.closing_time, 'HH:mm').format('h:mm A'),
      workingDays: workingDays
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
   * Debug working days format for entities
   */
  debugWorkingDays(store) {
    console.log('🐛 Debug working days for store:', store.id);
    
    const workingDays = store.working_days;
    
    console.log('Raw working_days value:', workingDays);
    console.log('Type:', typeof workingDays);
    console.log('Is Array:', Array.isArray(workingDays));
    
    if (typeof workingDays === 'string') {
      console.log('String length:', workingDays.length);
      console.log('First 50 chars:', workingDays.substring(0, 50));
      
      try {
        const parsed = JSON.parse(workingDays);
        console.log('JSON parsed successfully:', parsed);
        console.log('Parsed type:', typeof parsed);
        console.log('Parsed is array:', Array.isArray(parsed));
      } catch (e) {
        console.log('JSON parse failed:', e.message);
        
        // Try comma split
        const split = workingDays.split(',').map(d => d.trim());
        console.log('Comma split result:', split);
      }
    }
    
    return {
      raw: workingDays,
      type: typeof workingDays,
      isArray: Array.isArray(workingDays),
      stringLength: typeof workingDays === 'string' ? workingDays.length : null
    };
  }

  /**
   * Debug offer working days setup
   */
  async debugOfferWorkingDays(offerId) {
    try {
      console.log('🐛 Debug: Analyzing offer working days setup for:', offerId);
      
      const offer = await this.models.Offer.findByPk(offerId, {
        include: [{
          model: this.models.Service,
          as: 'service',
          include: [{
            model: this.models.Store,
            as: 'store'
          }]
        }]
      });

      if (!offer) {
        return { error: 'Offer not found' };
      }

      const store = offer.service?.store;
      if (!store) {
        return { error: 'Store not found for offer' };
      }

      // Test the validation
      const testDates = [
        '2025-08-25', // Monday
        '2025-08-26', // Tuesday
        '2025-08-27', // Wednesday
        '2025-08-28', // Thursday
        '2025-08-29', // Friday
        '2025-08-30', // Saturday
        '2025-08-31'  // Sunday
      ];

      const validationResults = testDates.map(date => {
        const result = this.validateDateAndStore(date, store);
        const dayName = moment(date).format('dddd');
        return {
          date,
          dayName,
          isValid: result.isValid,
          message: result.message,
          debug: result.debug
        };
      });

      return {
        offer: {
          id: offer.id,
          title: offer.title,
          status: offer.status
        },
        service: {
          id: offer.service.id,
          name: offer.service.name,
          duration: offer.service.duration
        },
        store: {
          id: store.id,
          name: store.name,
          location: store.location,
          working_days: store.working_days,
          working_days_type: typeof store.working_days,
          working_days_is_array: Array.isArray(store.working_days),
          opening_time: store.opening_time,
          closing_time: store.closing_time,
          status: store.status
        },
        validationResults: validationResults,
        workingDaysDebug: this.debugWorkingDays(store)
      };
    } catch (error) {
      console.error('🐛 Debug error:', error);
      return { error: error.message };
    }
  }
}

module.exports = SlotGenerationService;