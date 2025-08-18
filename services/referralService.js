// services/referralService.js - Service to handle referral earnings
const { ReferralEarning, User, Booking, Offer, Payment } = require('../models');

class ReferralService {
  
  /**
   * Process referral earning when a booking is completed
   * This should be called when a booking status changes to 'confirmed' or 'completed'
   */
  static async processReferralEarning(bookingId) {
    try {
      console.log(`🎯 Processing referral earning for booking: ${bookingId}`);

      // Get booking with all necessary data
      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: User,
            required: true,
            include: [
              {
                model: User,
                as: 'referrer',
                required: false
              }
            ]
          },
          {
            model: Offer,
            required: false
          },
          {
            model: Payment,
            required: false
          }
        ]
      });

      if (!booking) {
        console.log(`❌ Booking ${bookingId} not found`);
        return { success: false, message: 'Booking not found' };
      }

      // Only process earnings for offer bookings
      if (booking.bookingType !== 'offer' || !booking.offerId) {
        console.log(`⏭️ Skipping non-offer booking: ${bookingId}`);
        return { success: true, message: 'Not an offer booking' };
      }

      // Check if user was referred
      if (!booking.User.referredBy) {
        console.log(`⏭️ User ${booking.userId} was not referred`);
        return { success: true, message: 'User was not referred' };
      }

      // Check if referral earning already exists
      const existingEarning = await ReferralEarning.findOne({
        where: { bookingId: booking.id }
      });

      if (existingEarning) {
        console.log(`⏭️ Referral earning already exists for booking ${bookingId}`);
        return { success: true, message: 'Referral earning already processed' };
      }

      // Get the access fee paid
      // Access fee = 15% of the discount amount (not 15% of original price)
      // Example: Service costs KES 1000, discount is 50%
      // Access fee = 15% of (50% of 1000) = 15% of 500 = KES 75
      const accessFee = parseFloat(booking.accessFee) || 0;
      
      if (accessFee <= 0) {
        console.log(`❌ No access fee found for booking ${bookingId}`);
        return { success: false, message: 'No access fee to calculate earning from' };
      }

      // Calculate referral earning (30% of access fee)
      const commissionRate = 0.30;
      const earningAmount = accessFee * commissionRate;

      // Create referral earning
      const referralEarning = await ReferralEarning.create({
        referrerId: booking.User.referredBy,
        refereeId: booking.userId,
        bookingId: booking.id,
        amount: earningAmount,
        accessFee: accessFee,
        commissionRate: commissionRate,
        status: 'confirmed', // Auto-confirm for now
        notes: `30% commission from offer booking #${booking.id}`
      });

      console.log(`✅ Referral earning created: KES ${earningAmount} for user ${booking.User.referredBy}`);

      // Optional: Send notification to referrer
      await this.notifyReferrer(booking.User.referredBy, earningAmount, booking.User);

      return {
        success: true,
        earning: referralEarning,
        message: `Referral earning of KES ${earningAmount} created`
      };

    } catch (error) {
      console.error(`💥 Error processing referral earning for booking ${bookingId}:`, error);
      return {
        success: false,
        message: 'Error processing referral earning',
        error: error.message
      };
    }
  }

  /**
   * Notify referrer about new earning (implement based on your notification system)
   */
  static async notifyReferrer(referrerId, amount, referee) {
    try {
      console.log(`📧 Notifying referrer ${referrerId} about KES ${amount} earning`);
      
      // TODO: Implement notification logic here
      // - Send email
      // - Send push notification
      // - Create in-app notification
      
      return { success: true };
    } catch (error) {
      console.error('Error notifying referrer:', error);
      return { success: false };
    }
  }

  /**
   * Get referrer statistics
   */
  static async getReferrerStats(userId) {
    try {
      const stats = await ReferralEarning.findAll({
        where: { referrerId: userId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalEarnings'],
          [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
          [sequelize.fn('AVG', sequelize.col('amount')), 'averageAmount']
        ],
        group: ['status'],
        raw: true
      });

      return stats;
    } catch (error) {
      console.error('Error getting referrer stats:', error);
      return [];
    }
  }
}

module.exports = ReferralService;

// Add this hook to your Booking model (models/Booking.js)
// Add this to the hooks section:

/*
afterUpdate: async (booking, options) => {
  // Check if status changed to confirmed or completed
  if (booking.changed('status') && 
      ['confirmed', 'completed'].includes(booking.status) &&
      booking.bookingType === 'offer') {
    
    // Process referral earning
    const ReferralService = require('../services/referralService');
    await ReferralService.processReferralEarning(booking.id);
  }
}
*/

// Or call it manually in your booking controller when payment is confirmed:
/*
// In your booking creation endpoint, after successful payment:
if (booking.bookingType === 'offer' && paymentRecord && paymentRecord.status === 'completed') {
  const ReferralService = require('../services/referralService');
  await ReferralService.processReferralEarning(booking.id);
}
*/