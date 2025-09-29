// services/noShowHandlerService.js
const moment = require('moment');
const { Op } = require('sequelize');
const cron = require('node-cron');

class NoShowHandlerService {
  constructor(models) {
    this.models = models;
    this.Booking = models.Booking;
    this.Service = models.Service;
    this.Store = models.Store;
    this.User = models.User;
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Start the no-show monitoring service
   */
  start() {
    if (this.isRunning) {
      console.log('No-show handler service is already running');
      return;
    }

    console.log('Starting no-show handler service...');
    
    // Run every 5 minutes
    this.cronJob = cron.schedule('*/5 * * * *', () => {
      this.processNoShowBookings();
    }, {
      scheduled: true,
      timezone: "Africa/Nairobi" // Adjust to your timezone
    });

    this.isRunning = true;
    console.log('No-show handler service started - checking every 5 minutes');

    // Run immediately on start
    this.processNoShowBookings();
  }

  /**
   * Stop the no-show monitoring service
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('No-show handler service stopped');
  }

  /**
   * Main method to process no-show bookings
   */
  async processNoShowBookings() {
    try {
      console.log('Processing no-show bookings...');

      const eligibleBookings = await this.findEligibleBookings();
      
      if (eligibleBookings.length === 0) {
        console.log('No eligible bookings found for no-show processing');
        return;
      }

      console.log(`Found ${eligibleBookings.length} bookings to process for no-show`);

      const results = await this.processBookings(eligibleBookings);
      
      console.log(`No-show processing completed:`, {
        total: eligibleBookings.length,
        processed: results.processed,
        failed: results.failed,
        skipped: results.skipped
      });

      return results;

    } catch (error) {
      console.error('Error processing no-show bookings:', error);
      return {
        success: false,
        error: error.message,
        processed: 0,
        failed: 0,
        skipped: 0
      };
    }
  }

  /**
   * Find bookings eligible for no-show processing
   */
  async findEligibleBookings() {
    const now = new Date();
    
    // Find confirmed bookings that:
    // 1. Are in 'confirmed' status (not checked in)
    // 2. Start time + grace period + service duration has passed
    // 3. Haven't been marked as no-show yet
    const bookings = await this.Booking.findAll({
      where: {
        status: 'confirmed',
        checked_in_at: null, // Not checked in
        startTime: {
          [Op.lt]: now // Start time has passed
        }
      },
      include: [
        {
          model: this.Service,
          as: 'service', // FIXED: lowercase to match your model association
          required: false, // Include both service and offer bookings
          attributes: [
            'id', 
            'name', 
            'duration', 
            'grace_period_minutes',
            'auto_complete_on_duration'
          ]
        },
        {
          model: this.User,
          as: 'bookingUser', // Check your Booking model - might need lowercase 'user'
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: this.Store,
          as: 'store', // Check your Booking model - might need lowercase 'store'
          attributes: ['id', 'name', 'location']
        }
      ]
    });

    // Filter bookings that have exceeded grace period + service duration
    const eligibleBookings = bookings.filter(booking => {
      return this.isBookingEligibleForNoShow(booking, now);
    });

    return eligibleBookings;
  }

  /**
   * Check if a booking is eligible for no-show status
   */
  isBookingEligibleForNoShow(booking, currentTime = new Date()) {
    const startTime = moment(booking.startTime);
    const now = moment(currentTime);
    
    // Get grace period from service or use default
    const gracePeriod = booking.Service?.grace_period_minutes || 10; // Default 10 minutes
    
    // Get service duration or use default
    const serviceDuration = booking.Service?.duration || 60; // Default 60 minutes
    
    // Calculate when the booking should be considered no-show
    // Start time + grace period + service duration
    const noShowTime = startTime
      .clone()
      .add(gracePeriod, 'minutes')
      .add(serviceDuration, 'minutes');
    
    const isEligible = now.isAfter(noShowTime);
    
    if (isEligible) {
      console.log(`Booking ${booking.id} eligible for no-show:`, {
        startTime: startTime.format('YYYY-MM-DD HH:mm'),
        gracePeriod: gracePeriod,
        serviceDuration: serviceDuration,
        noShowTime: noShowTime.format('YYYY-MM-DD HH:mm'),
        currentTime: now.format('YYYY-MM-DD HH:mm'),
        minutesOverdue: now.diff(noShowTime, 'minutes')
      });
    }
    
    return isEligible;
  }

  /**
   * Process multiple bookings for no-show
   */
  async processBookings(bookings) {
    const results = {
      processed: 0,
      failed: 0,
      skipped: 0,
      details: []
    };

    for (const booking of bookings) {
      try {
        const result = await this.markBookingAsNoShow(booking);
        
        if (result.success) {
          results.processed++;
          results.details.push({
            bookingId: booking.id,
            status: 'processed',
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
        console.error(`Failed to process booking ${booking.id}:`, error);
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
   * Mark a specific booking as no-show
   */
  async markBookingAsNoShow(booking) {
    try {
      // Double-check eligibility before processing
      if (!this.isBookingEligibleForNoShow(booking)) {
        return {
          success: false,
          reason: 'Booking not eligible for no-show status'
        };
      }

      // Check if booking is still in confirmed status
      const currentBooking = await this.Booking.findByPk(booking.id);
      if (!currentBooking || currentBooking.status !== 'confirmed') {
        return {
          success: false,
          reason: `Booking status changed to ${currentBooking?.status || 'deleted'}`
        };
      }

      const gracePeriod = booking.Service?.grace_period_minutes || 10;
      const serviceDuration = booking.Service?.duration || 60;
      const startTime = moment(booking.startTime);
      const now = moment();
      const minutesOverdue = now.diff(startTime.clone().add(gracePeriod, 'minutes'), 'minutes');

      // Update booking to no-show status
      const updateData = {
        status: 'no_show',
        no_show_marked_at: new Date(),
        no_show_reason: `Customer did not check in within ${gracePeriod} minutes of scheduled time. Service duration (${serviceDuration} minutes) elapsed.`,
        no_show_details: JSON.stringify({
          scheduled_time: booking.startTime,
          grace_period_minutes: gracePeriod,
          service_duration_minutes: serviceDuration,
          marked_at: new Date(),
          minutes_overdue: minutesOverdue,
          auto_processed: true
        }),
        merchantNotes: booking.merchantNotes 
          ? `${booking.merchantNotes}\n\n[AUTO] No-show: Customer did not arrive within grace period.`
          : '[AUTO] No-show: Customer did not arrive within grace period.'
      };

      await currentBooking.update(updateData);

      // Send no-show notification (optional)
      try {
        await this.sendNoShowNotification(currentBooking, booking.User, booking.Service, booking.Store);
      } catch (notificationError) {
        console.warn(`Failed to send no-show notification for booking ${booking.id}:`, notificationError.message);
      }

      console.log(`Booking ${booking.id} marked as no-show:`, {
        customer: `${booking.User?.firstName} ${booking.User?.lastName}`,
        service: booking.Service?.name,
        scheduledTime: startTime.format('YYYY-MM-DD HH:mm'),
        minutesOverdue: minutesOverdue
      });

      return {
        success: true,
        reason: `Marked as no-show after ${minutesOverdue} minutes overdue`,
        data: updateData
      };

    } catch (error) {
      console.error(`Error marking booking ${booking.id} as no-show:`, error);
      throw error;
    }
  }

  /**
   * Send no-show notification to relevant parties
   */
  async sendNoShowNotification(booking, user, service, store) {
    try {
      // This would integrate with your email/SMS service
      console.log(`No-show notification for booking ${booking.id}:`, {
        customer: user?.email,
        service: service?.name,
        store: store?.name,
        scheduledTime: booking.startTime
      });

      // Example notification logic:
      // - Email to customer about missed appointment
      // - Notification to merchant about no-show
      // - Update customer's no-show count
      // - Apply any no-show penalties if configured

      // You can implement actual email/SMS sending here
      return { success: true };

    } catch (error) {
      console.error('Error sending no-show notification:', error);
      throw error;
    }
  }

  /**
   * Get no-show statistics
   */
  async getNoShowStatistics(storeId = null, period = '30d') {
    try {
      const startDate = this.getDateByPeriod(period);
      
      const whereClause = {
        status: 'no_show',
        no_show_marked_at: {
          [Op.gte]: startDate
        }
      };

      if (storeId) {
        whereClause.storeId = storeId;
      }

      const noShowBookings = await this.Booking.findAll({
        where: whereClause,
        include: [
          {
            model: this.Service,
            as: 'Service',
            attributes: ['id', 'name']
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
        total_no_shows: noShowBookings.length,
        auto_processed: noShowBookings.filter(b => 
          b.no_show_details && JSON.parse(b.no_show_details).auto_processed
        ).length,
        manual_marked: noShowBookings.filter(b => 
          !b.no_show_details || !JSON.parse(b.no_show_details).auto_processed
        ).length,
        by_service: {},
        repeat_customers: {}
      };

      // Group by service
      noShowBookings.forEach(booking => {
        const serviceName = booking.Service?.name || 'Unknown Service';
        stats.by_service[serviceName] = (stats.by_service[serviceName] || 0) + 1;
      });

      // Find repeat no-show customers
      const customerCounts = {};
      noShowBookings.forEach(booking => {
        const customerEmail = booking.User?.email;
        if (customerEmail) {
          customerCounts[customerEmail] = (customerCounts[customerEmail] || 0) + 1;
        }
      });

      stats.repeat_customers = Object.entries(customerCounts)
        .filter(([email, count]) => count > 1)
        .reduce((acc, [email, count]) => {
          acc[email] = count;
          return acc;
        }, {});

      return {
        success: true,
        period,
        statistics: stats
      };

    } catch (error) {
      console.error('Error getting no-show statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manual no-show processing for specific booking
   */
  async manualNoShow(bookingId, reason = '', merchantId = null) {
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
          }
        ]
      });

      if (!booking) {
        return {
          success: false,
          reason: 'Booking not found'
        };
      }

      if (!['confirmed', 'pending'].includes(booking.status)) {
        return {
          success: false,
          reason: `Cannot mark booking with status '${booking.status}' as no-show`
        };
      }

      const updateData = {
        status: 'no_show',
        no_show_marked_at: new Date(),
        no_show_reason: reason || 'Manually marked as no-show by merchant',
        no_show_details: JSON.stringify({
          scheduled_time: booking.startTime,
          marked_at: new Date(),
          manual_process: true,
          marked_by: merchantId || 'merchant'
        }),
        merchantNotes: booking.merchantNotes 
          ? `${booking.merchantNotes}\n\n[MANUAL] No-show: ${reason}`
          : `[MANUAL] No-show: ${reason}`
      };

      await booking.update(updateData);

      // Send notification
      try {
        await this.sendNoShowNotification(booking, booking.User, booking.Service, booking.Store);
      } catch (notificationError) {
        console.warn('Failed to send no-show notification:', notificationError.message);
      }

      return {
        success: true,
        reason: 'Manually marked as no-show',
        booking: booking
      };

    } catch (error) {
      console.error('Error in manual no-show processing:', error);
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
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = NoShowHandlerService;