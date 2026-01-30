// services/autoCompletionService.js
const moment = require('moment');
const { Op } = require('sequelize');
const cron = require('node-cron');

class AutoCompletionService {
  constructor(models) {
    this.models = models;
    this.Booking = models.Booking;
    this.Service = models.Service;
    this.Store = models.Store;
    this.User = models.User;
    this.Staff = models.Staff;
    this.isRunning = false;
    this.isProcessing = false; // Prevent overlapping executions
    this.cronJob = null;
  }

  /**
   * Start the auto-completion monitoring service
   */
  start() {
    if (this.isRunning) {
      console.log('Auto-completion service is already running');
      return;
    }

    console.log('Starting auto-completion service...');
    
    // Run every 2 minutes to check for completed services
    this.cronJob = cron.schedule('*/2 * * * *', () => {
      this.processAutoCompletions();
    }, {
      scheduled: true,
      timezone: "Africa/Nairobi" // Adjust to your timezone
    });

    this.isRunning = true;
    console.log('Auto-completion service started - checking every 2 minutes');

    // Run immediately on start
    this.processAutoCompletions();
  }

  /**
   * Stop the auto-completion monitoring service
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('Auto-completion service stopped');
  }

  /**
   * Main method to process auto-completions
   */
  async processAutoCompletions() {
    // Prevent overlapping executions
    if (this.isProcessing) {
      console.log('Auto-completion already in progress, skipping...');
      return { skipped: true, reason: 'Already processing' };
    }

    this.isProcessing = true;
    try {
      console.log('Processing auto-completions...');

      const eligibleBookings = await this.findEligibleBookings();
      
      if (eligibleBookings.length === 0) {
        console.log('No eligible bookings found for auto-completion');
        return;
      }

      console.log(`Found ${eligibleBookings.length} bookings to auto-complete`);

      const results = await this.processBookings(eligibleBookings);
      
      console.log(`Auto-completion processing completed:`, {
        total: eligibleBookings.length,
        completed: results.completed,
        failed: results.failed,
        skipped: results.skipped
      });

      return results;

    } catch (error) {
      console.error('Error processing auto-completions:', error);
      return {
        success: false,
        error: error.message,
        completed: 0,
        failed: 0,
        skipped: 0
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Find bookings eligible for auto-completion
   */
  async findEligibleBookings() {
    const now = new Date();
    
    // Find in_progress bookings that:
    // 1. Are in 'in_progress' status (checked in)
    // 2. Have been checked in (service_started_at is not null)
    // 3. Service duration has elapsed since check-in
    // 4. Service has auto_complete_on_duration enabled
    const bookings = await this.Booking.findAll({
      where: {
        status: 'in_progress',
        checked_in_at: { [Op.ne]: null }, // Must be checked in
        service_started_at: { [Op.ne]: null }, // Service must have started
        completedAt: null // Not already completed
      },
      include: [
        {
          model: this.Service,
          as: 'service', // FIXED: lowercase to match your model association
          required: false,
          attributes: [
            'id', 
            'name', 
            'duration',
            'auto_complete_on_duration',
            'buffer_time'
          ]
        },
        {
          model: this.User,
          as: 'bookingUser', // Check your Booking model - might need lowercase 'user'
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: this.Staff,
          as: 'staff', // Check your Booking model - might need lowercase 'staff'
          attributes: ['id', 'name']
        },
        {
          model: this.Store,
          as: 'store', // Check your Booking model - might need lowercase 'store'
          attributes: ['id', 'name', 'location']
        }
      ]
    });

    // Filter bookings that have exceeded service duration
    const eligibleBookings = bookings.filter(booking => {
      return this.isBookingEligibleForCompletion(booking, now);
    });

    return eligibleBookings;
  }

  /**
   * Check if a booking is eligible for auto-completion
   */
  isBookingEligibleForCompletion(booking, currentTime = new Date()) {
    // Check if service has auto-completion enabled
    if (booking.Service && booking.Service.auto_complete_on_duration === false) {
      return false;
    }

    // If no service linked, use default behavior (auto-complete enabled)
    const autoCompleteEnabled = booking.Service?.auto_complete_on_duration !== false;
    
    if (!autoCompleteEnabled) {
      return false;
    }

    const serviceStartTime = moment(booking.service_started_at || booking.checked_in_at);
    const now = moment(currentTime);
    
    // Get service duration or use default
    const serviceDuration = booking.Service?.duration || 60; // Default 60 minutes
    
    // Get buffer time (extra time before auto-completion)
    const bufferTime = booking.Service?.buffer_time || 0; // Default no buffer
    
    // Calculate when the service should be completed
    // Service start time + duration + buffer time
    const completionTime = serviceStartTime
      .clone()
      .add(serviceDuration, 'minutes')
      .add(bufferTime, 'minutes');
    
    const isEligible = now.isAfter(completionTime);
    
    if (isEligible) {
      console.log(`Booking ${booking.id} eligible for auto-completion:`, {
        serviceStartTime: serviceStartTime.format('YYYY-MM-DD HH:mm'),
        serviceDuration: serviceDuration,
        bufferTime: bufferTime,
        completionTime: completionTime.format('YYYY-MM-DD HH:mm'),
        currentTime: now.format('YYYY-MM-DD HH:mm'),
        minutesOverdue: now.diff(completionTime, 'minutes')
      });
    }
    
    return isEligible;
  }

  /**
   * Process multiple bookings for auto-completion
   */
  async processBookings(bookings) {
    const results = {
      completed: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    for (const booking of bookings) {
      try {
        const result = await this.completeBooking(booking);
        
        if (result.success) {
          results.completed++;
          results.details.push({
            bookingId: booking.id,
            status: 'completed',
            reason: result.reason
          });
        } else {
          results.skipped++;
          results.details.push({
            bookingId: booking.id,
            status: 'skipped',
            reason: result.reason
          });
        }
      } catch (error) {
        console.error(`Failed to complete booking ${booking.id}:`, error);
        results.failed++;
        results.details.push({
          bookingId: booking.id,
          status: 'failed',
          reason: error.message
        });
      }
    }

    return results;
  }

  /**
   * Complete a specific booking
   */
  async completeBooking(booking) {
    try {
      // Double-check eligibility before processing
      if (!this.isBookingEligibleForCompletion(booking)) {
        return {
          success: false,
          reason: 'Booking not eligible for auto-completion'
        };
      }

      // Check if booking is still in in_progress status
      const currentBooking = await this.Booking.findByPk(booking.id);
      if (!currentBooking || currentBooking.status !== 'in_progress') {
        return {
          success: false,
          reason: `Booking status changed to ${currentBooking?.status || 'deleted'}`
        };
      }

      const serviceDuration = booking.Service?.duration || 60;
      const bufferTime = booking.Service?.buffer_time || 0;
      const serviceStartTime = moment(booking.service_started_at || booking.checked_in_at);
      const now = moment();
      const actualDuration = now.diff(serviceStartTime, 'minutes');

      // Calculate completion details
      const completionDetails = {
        scheduled_duration: serviceDuration,
        actual_duration: actualDuration,
        buffer_time: bufferTime,
        service_started_at: booking.service_started_at,
        auto_completed_at: new Date(),
        auto_processed: true,
        completed_by: 'system'
      };

      // Update booking to completed status
      const updateData = {
        status: 'completed',
        completedAt: new Date(),
        completed_by: 'Auto-completion System',
        actual_duration: actualDuration,
        auto_completed: true,
        completion_method: 'automatic',
        completion_details: JSON.stringify(completionDetails),
        merchantNotes: booking.merchantNotes 
          ? `${booking.merchantNotes}\n\n[AUTO] Service auto-completed after ${actualDuration} minutes.`
          : `[AUTO] Service auto-completed after ${actualDuration} minutes.`
      };

      await currentBooking.update(updateData);

      // Send completion notification (optional)
      try {
        await this.sendCompletionNotification(currentBooking, booking.User, booking.Service, booking.Store, booking.Staff);
      } catch (notificationError) {
        console.warn(`Failed to send completion notification for booking ${booking.id}:`, notificationError.message);
      }

      console.log(`Booking ${booking.id} auto-completed:`, {
        customer: `${booking.User?.firstName} ${booking.User?.lastName}`,
        service: booking.Service?.name,
        staff: booking.Staff?.name,
        serviceStartTime: serviceStartTime.format('YYYY-MM-DD HH:mm'),
        actualDuration: actualDuration,
        scheduledDuration: serviceDuration
      });

      return {
        success: true,
        reason: `Auto-completed after ${actualDuration} minutes`,
        data: updateData
      };

    } catch (error) {
      console.error(`Error completing booking ${booking.id}:`, error);
      throw error;
    }
  }

  /**
   * Send completion notification to relevant parties
   */
  async sendCompletionNotification(booking, user, service, store, staff) {
    try {
      // This would integrate with your email/SMS service
      console.log(`Auto-completion notification for booking ${booking.id}:`, {
        customer: user?.email,
        service: service?.name,
        staff: staff?.name,
        store: store?.name,
        completedAt: booking.completedAt
      });

      // Example notification logic:
      // - Email to customer asking for review/feedback
      // - Notification to merchant about completed service
      // - Update service statistics
      // - Trigger follow-up actions (loyalty points, etc.)

      // You can implement actual email/SMS sending here
      return { success: true };

    } catch (error) {
      console.error('Error sending completion notification:', error);
      throw error;
    }
  }

  /**
   * Get auto-completion statistics
   */
  async getAutoCompletionStatistics(storeId = null, period = '30d') {
    try {
      const startDate = this.getDateByPeriod(period);
      
      const whereClause = {
        status: 'completed',
        auto_completed: true,
        completedAt: {
          [Op.gte]: startDate
        }
      };

      if (storeId) {
        whereClause.storeId = storeId;
      }

      const autoCompletedBookings = await this.Booking.findAll({
        where: whereClause,
        include: [
          {
            model: this.Service,
            as: 'Service',
            attributes: ['id', 'name', 'duration']
          },
          {
            model: this.User,
            as: 'User',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      });

      // Calculate statistics
      const stats = {
        total_auto_completed: autoCompletedBookings.length,
        average_actual_duration: 0,
        average_scheduled_duration: 0,
        duration_variance: [],
        by_service: {},
        efficiency_metrics: {}
      };

      if (autoCompletedBookings.length > 0) {
        // Calculate duration statistics
        const actualDurations = autoCompletedBookings.map(b => b.actual_duration || 0);
        const scheduledDurations = autoCompletedBookings.map(b => b.Service?.duration || 60);

        stats.average_actual_duration = actualDurations.reduce((sum, dur) => sum + dur, 0) / actualDurations.length;
        stats.average_scheduled_duration = scheduledDurations.reduce((sum, dur) => sum + dur, 0) / scheduledDurations.length;

        // Calculate efficiency (actual vs scheduled duration)
        stats.efficiency_metrics = {
          on_time_completion_rate: autoCompletedBookings.filter(b => 
            (b.actual_duration || 0) <= (b.Service?.duration || 60)
          ).length / autoCompletedBookings.length * 100,
          average_overtime_minutes: Math.max(0, stats.average_actual_duration - stats.average_scheduled_duration)
        };

        // Group by service
        autoCompletedBookings.forEach(booking => {
          const serviceName = booking.Service?.name || 'Unknown Service';
          if (!stats.by_service[serviceName]) {
            stats.by_service[serviceName] = {
              count: 0,
              total_actual_duration: 0,
              total_scheduled_duration: 0
            };
          }
          stats.by_service[serviceName].count++;
          stats.by_service[serviceName].total_actual_duration += booking.actual_duration || 0;
          stats.by_service[serviceName].total_scheduled_duration += booking.Service?.duration || 60;
        });

        // Calculate averages per service
        Object.keys(stats.by_service).forEach(serviceName => {
          const serviceStats = stats.by_service[serviceName];
          serviceStats.average_actual_duration = serviceStats.total_actual_duration / serviceStats.count;
          serviceStats.average_scheduled_duration = serviceStats.total_scheduled_duration / serviceStats.count;
          serviceStats.efficiency_rate = (serviceStats.average_scheduled_duration / serviceStats.average_actual_duration) * 100;
        });
      }

      return {
        success: true,
        period,
        statistics: stats
      };

    } catch (error) {
      console.error('Error getting auto-completion statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manual completion override
   */
  async manualComplete(bookingId, notes = '', actualDuration = null, merchantId = null) {
    try {
      const booking = await this.Booking.findByPk(bookingId, {
        include: [
          {
            model: this.Service,
            as: 'Service'
          },
          {
            model: this.User,
            as: 'User'
          },
          {
            model: this.Store,
            as: 'Store'
          },
          {
            model: this.Staff,
            as: 'Staff'
          }
        ]
      });

      if (!booking) {
        return {
          success: false,
          reason: 'Booking not found'
        };
      }

      if (booking.status !== 'in_progress') {
        return {
          success: false,
          reason: `Cannot complete booking with status '${booking.status}'`
        };
      }

      const serviceStartTime = moment(booking.service_started_at || booking.checked_in_at);
      const now = moment();
      const calculatedDuration = actualDuration || now.diff(serviceStartTime, 'minutes');

      const updateData = {
        status: 'completed',
        completedAt: new Date(),
        completed_by: 'Manual Completion',
        actual_duration: calculatedDuration,
        auto_completed: false,
        completion_method: 'manual',
        completion_details: JSON.stringify({
          scheduled_duration: booking.Service?.duration || 60,
          actual_duration: calculatedDuration,
          service_started_at: booking.service_started_at,
          manually_completed_at: new Date(),
          completed_by: merchantId || 'merchant',
          notes: notes
        }),
        merchantNotes: booking.merchantNotes 
          ? `${booking.merchantNotes}\n\n[MANUAL] Service manually completed: ${notes}`
          : `[MANUAL] Service manually completed: ${notes}`
      };

      await booking.update(updateData);

      // Send notification
      try {
        await this.sendCompletionNotification(booking, booking.User, booking.Service, booking.Store, booking.Staff);
      } catch (notificationError) {
        console.warn('Failed to send completion notification:', notificationError.message);
      }

      return {
        success: true,
        reason: 'Manually completed',
        booking: booking
      };

    } catch (error) {
      console.error('Error in manual completion:', error);
      return {
        success: false,
        reason: error.message
      };
    }
  }

  /**
   * Utility method to get date by period
   */
  getDateByPeriod(period) {
    const now = new Date();
    switch (period) {
      case '1d':
        return new Date(now.setDate(now.getDate() - 1));
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      case '90d':
        return new Date(now.setDate(now.getDate() - 90));
      default:
        return new Date(now.setDate(now.getDate() - 30));
    }
  }

  /**
   * Health check for the service
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      cronJob: !!this.cronJob,
      lastCheck: new Date().toISOString(),
      checkInterval: '2 minutes'
    };
  }
}

module.exports = AutoCompletionService;