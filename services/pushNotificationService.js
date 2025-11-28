// services/pushNotificationService.js
const webPush = require('web-push');
const { PushSubscription } = require('../models');

class PushNotificationService {
    constructor() {
        // Configure web-push with VAPID keys from environment
        const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
        const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@discoun3ree.com';

        if (vapidPublicKey && vapidPrivateKey) {
            webPush.setVapidDetails(
                vapidSubject,
                vapidPublicKey,
                vapidPrivateKey
            );
            console.log('✅ Push notification service initialized');
        } else {
            console.warn('⚠️ VAPID keys not configured. Push notifications will not work.');
            console.warn('   Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env');
        }
    }

    /**
     * Send push notification to a specific user or merchant
     */
    async sendToUser(userId, userType, payload) {
        try {
            console.log(`📱 Sending push notification to ${userType}: ${userId}`);

            // Get all active subscriptions for this user
            const subscriptions = await PushSubscription.findAll({
                where: {
                    userId: userId,
                    userType: userType
                }
            });

            if (subscriptions.length === 0) {
                console.log(`ℹ️ No push subscriptions found for ${userType}: ${userId}`);
                return { sent: 0, failed: 0 };
            }

            const results = await Promise.allSettled(
                subscriptions.map(sub => this.sendToSubscription(sub, payload))
            );

            const sent = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            console.log(`✅ Push notifications sent: ${sent} successful, ${failed} failed`);
            return { sent, failed };
        } catch (error) {
            console.error('❌ Error sending push notification:', error);
            return { sent: 0, failed: 1 };
        }
    }

    /**
     * Send push notification to a specific subscription
     */
    async sendToSubscription(subscription, payload) {
        try {
            const pushSubscription = {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.p256dhKey,
                    auth: subscription.authKey
                }
            };

            const payloadString = JSON.stringify(payload);

            await webPush.sendNotification(pushSubscription, payloadString);

            // Update last used timestamp
            await subscription.update({
                lastUsedAt: new Date()
            });

            return true;
        } catch (error) {
            // Handle subscription errors (410 Gone means subscription expired)
            if (error.statusCode === 410 || error.statusCode === 404) {
                console.log(`🗑️ Removing expired push subscription: ${subscription.id}`);
                await subscription.destroy();
            }
            throw error;
        }
    }

    /**
     * Send push notification for new store follower
     */
    async sendNewFollowerNotification(merchantId, followerName, storeName) {
        const payload = {
            title: '🎉 New Follower!',
            body: `${followerName} started following ${storeName}`,
            icon: '/icons/follow-icon.png',
            badge: '/icons/badge-icon.png',
            tag: 'new-follower',
            data: {
                type: 'new_follower',
                followerName: followerName,
                storeName: storeName,
                timestamp: new Date().toISOString(),
                url: '/dashboard/followers'
            },
            actions: [
                {
                    action: 'view',
                    title: 'View Followers'
                }
            ]
        };

        return await this.sendToUser(merchantId, 'merchant', payload);
    }

    /**
     * Send push notification for new store review
     */
    async sendNewReviewNotification(merchantId, reviewerName, storeName, rating) {
        const stars = '⭐'.repeat(rating);
        const payload = {
            title: '📝 New Review!',
            body: `${reviewerName} rated ${storeName} ${stars} (${rating}/5)`,
            icon: '/icons/review-icon.png',
            badge: '/icons/badge-icon.png',
            tag: 'new-review',
            data: {
                type: 'new_review',
                reviewerName: reviewerName,
                storeName: storeName,
                rating: rating,
                timestamp: new Date().toISOString(),
                url: '/dashboard/reviews'
            },
            actions: [
                {
                    action: 'view',
                    title: 'View Review'
                },
                {
                    action: 'reply',
                    title: 'Reply'
                }
            ]
        };

        return await this.sendToUser(merchantId, 'merchant', payload);
    }

    /**
     * Send push notification for new booking (to merchant)
     */
    async sendNewBookingNotificationToMerchant(merchantId, customerName, serviceName, bookingTime) {
        const payload = {
            title: '📅 New Booking!',
            body: `${customerName} booked ${serviceName} for ${bookingTime}`,
            icon: '/icons/booking-icon.png',
            badge: '/icons/badge-icon.png',
            tag: 'new-booking',
            requireInteraction: true, // Keep notification visible
            data: {
                type: 'new_booking',
                customerName: customerName,
                serviceName: serviceName,
                bookingTime: bookingTime,
                timestamp: new Date().toISOString(),
                url: '/dashboard/bookings'
            },
            actions: [
                {
                    action: 'view',
                    title: 'View Booking'
                },
                {
                    action: 'confirm',
                    title: 'Confirm'
                }
            ]
        };

        return await this.sendToUser(merchantId, 'merchant', payload);
    }

    /**
     * Send push notification for booking confirmation (to user)
     */
    async sendBookingConfirmationToUser(userId, serviceName, bookingTime, storeName) {
        const payload = {
            title: '✅ Booking Confirmed!',
            body: `Your booking for ${serviceName} at ${storeName} is confirmed for ${bookingTime}`,
            icon: '/icons/confirmed-icon.png',
            badge: '/icons/badge-icon.png',
            tag: 'booking-confirmed',
            data: {
                type: 'booking_confirmed',
                serviceName: serviceName,
                storeName: storeName,
                bookingTime: bookingTime,
                timestamp: new Date().toISOString(),
                url: '/bookings'
            },
            actions: [
                {
                    action: 'view',
                    title: 'View Details'
                },
                {
                    action: 'add-to-calendar',
                    title: 'Add to Calendar'
                }
            ]
        };

        return await this.sendToUser(userId, 'user', payload);
    }

    /**
     * Send push notification for booking reschedule (to user)
     */
    async sendBookingRescheduleNotificationToUser(userId, serviceName, oldTime, newTime, storeName) {
        const payload = {
            title: '🔄 Booking Rescheduled',
            body: `Your ${serviceName} booking at ${storeName} has been moved from ${oldTime} to ${newTime}`,
            icon: '/icons/reschedule-icon.png',
            badge: '/icons/badge-icon.png',
            tag: 'booking-rescheduled',
            requireInteraction: true,
            data: {
                type: 'booking_rescheduled',
                serviceName: serviceName,
                storeName: storeName,
                oldTime: oldTime,
                newTime: newTime,
                timestamp: new Date().toISOString(),
                url: '/bookings'
            },
            actions: [
                {
                    action: 'view',
                    title: 'View Details'
                },
                {
                    action: 'confirm',
                    title: 'Confirm Change'
                }
            ]
        };

        return await this.sendToUser(userId, 'user', payload);
    }

    /**
     * Send push notification for booking reschedule (to merchant)
     */
    async sendBookingRescheduleNotificationToMerchant(merchantId, customerName, serviceName, oldTime, newTime) {
        const payload = {
            title: '🔄 Booking Rescheduled',
            body: `${customerName}'s ${serviceName} booking moved from ${oldTime} to ${newTime}`,
            icon: '/icons/reschedule-icon.png',
            badge: '/icons/badge-icon.png',
            tag: 'booking-rescheduled',
            data: {
                type: 'booking_rescheduled_merchant',
                customerName: customerName,
                serviceName: serviceName,
                oldTime: oldTime,
                newTime: newTime,
                timestamp: new Date().toISOString(),
                url: '/dashboard/bookings'
            },
            actions: [
                {
                    action: 'view',
                    title: 'View Details'
                }
            ]
        };

        return await this.sendToUser(merchantId, 'merchant', payload);
    }

    /**
     * Send push notification for booking cancellation (to user)
     */
    async sendBookingCancellationToUser(userId, serviceName, bookingTime, storeName, reason) {
        const payload = {
            title: '❌ Booking Cancelled',
            body: `Your ${serviceName} booking at ${storeName} for ${bookingTime} has been cancelled`,
            icon: '/icons/cancelled-icon.png',
            badge: '/icons/badge-icon.png',
            tag: 'booking-cancelled',
            requireInteraction: true,
            data: {
                type: 'booking_cancelled',
                serviceName: serviceName,
                storeName: storeName,
                bookingTime: bookingTime,
                reason: reason,
                timestamp: new Date().toISOString(),
                url: '/bookings'
            },
            actions: [
                {
                    action: 'view',
                    title: 'View Details'
                },
                {
                    action: 'rebook',
                    title: 'Book Again'
                }
            ]
        };

        return await this.sendToUser(userId, 'user', payload);
    }

    /**
     * Send push notification for booking cancellation (to merchant)
     */
    async sendBookingCancellationToMerchant(merchantId, customerName, serviceName, bookingTime, reason) {
        const payload = {
            title: '❌ Booking Cancelled',
            body: `${customerName} cancelled their ${serviceName} booking for ${bookingTime}`,
            icon: '/icons/cancelled-icon.png',
            badge: '/icons/badge-icon.png',
            tag: 'booking-cancelled',
            data: {
                type: 'booking_cancelled_merchant',
                customerName: customerName,
                serviceName: serviceName,
                bookingTime: bookingTime,
                reason: reason,
                timestamp: new Date().toISOString(),
                url: '/dashboard/bookings'
            },
            actions: [
                {
                    action: 'view',
                    title: 'View Details'
                }
            ]
        };

        return await this.sendToUser(merchantId, 'merchant', payload);
    }

    /**
     * Send custom push notification
     */
    async sendCustomNotification(userId, userType, title, body, data = {}) {
        const payload = {
            title: title,
            body: body,
            icon: '/icons/default-icon.png',
            badge: '/icons/badge-icon.png',
            data: {
                ...data,
                timestamp: new Date().toISOString()
            }
        };

        return await this.sendToUser(userId, userType, payload);
    }
}

module.exports = PushNotificationService;
