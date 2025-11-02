// services/notificationService.js
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');
const moment = require('moment');

class NotificationService {
    constructor(config = {}) {
        this.config = {
            email: {
                enabled: true,
                from: process.env.EMAIL_FROM || 'noreply@discoun3ree.com',
                sendgridApiKey: process.env.SENDGRID_API_KEY,
                ...config.email
            },
            sms: {
                enabled: false,
                ...config.sms
            },
            templatesPath: path.join(__dirname, '..', 'views', 'emails'), // ✅ Updated path
            ...config
        };

        console.log('📧 NotificationService initialized');
        console.log('📧 Templates path:', this.config.templatesPath);
        console.log('📧 SendGrid API key:', this.config.email.sendgridApiKey ? '✅ Set' : '❌ Not set');

        // Initialize SendGrid if enabled
        if (this.config.email.enabled && this.config.email.sendgridApiKey) {
            sgMail.setApiKey(this.config.email.sendgridApiKey);
            console.log('✅ SendGrid initialized successfully');
        } else if (this.config.email.enabled) {
            console.warn('⚠️ SendGrid API key not found. Email notifications may not work.');
        }
    }

    async renderTemplate(templateName, data) {
        // Try multiple possible paths
        const possiblePaths = [
            path.join(this.config.templatesPath, `${templateName}.ejs`),
            path.join(__dirname, '..', 'templates', `${templateName}.ejs`),
            path.join(__dirname, '..', 'views', 'emails', `${templateName}.ejs`),
            path.join(process.cwd(), 'views', 'emails', `${templateName}.ejs`),
            path.join(process.cwd(), 'templates', `${templateName}.ejs`)
        ];

        console.log('📧 Looking for template:', templateName);

        for (const templatePath of possiblePaths) {
            try {
                await fs.promises.access(templatePath, fs.constants.R_OK);
                console.log('✅ Found template at:', templatePath);
                
                const rendered = await ejs.renderFile(templatePath, data);
                console.log('✅ Template rendered successfully');
                return rendered;
            } catch (error) {
                // Continue to next path
                continue;
            }
        }

        console.error('❌ Template not found in any of these paths:', possiblePaths);
        throw new Error(`Failed to find template ${templateName}`);
    }

    async sendEmail(to, subject, htmlContent) {
        if (!this.config.email.enabled) {
            console.log('⚠️ Email notifications are disabled');
            return false;
        }

        if (!this.config.email.sendgridApiKey) {
            console.error('❌ SendGrid API key not configured');
            return false;
        }

        if (!to) {
            console.error('❌ Recipient email is required');
            return false;
        }

        try {
            console.log('📧 Sending email to:', to);
            console.log('📧 Subject:', subject);

            const msg = {
                to,
                from: this.config.email.from,
                subject,
                html: htmlContent,
            };

            const result = await sgMail.send(msg);
            console.log('✅ Email sent with SendGrid. Status code:', result[0]?.statusCode);
            return result;
        } catch (error) {
            console.error('❌ Error sending email with SendGrid:', error);

            if (error.response) {
                console.error('SendGrid API error:', error.response.body);
            }

            throw new Error('Failed to send email notification');
        }
    }

    async sendSMS(to, message) {
        if (!this.config.sms.enabled) {
            console.log('SMS notifications are disabled');
            return false;
        }

        console.log(`SMS would be sent to ${to}: ${message}`);
        return true;
    }

    formatDateTime(dateTime) {
        if (!dateTime) return 'N/A';
        return moment(dateTime).format('dddd, MMMM D, YYYY [at] h:mm A');
    }

    // ==========================================
    // SERVICE BOOKING NOTIFICATIONS
    // ==========================================

    /**
     * Send booking confirmation to customer (SERVICE)
     */
    async sendBookingConfirmationToCustomer(booking, service, user, store, qrCodeUrl) {
        try {
            console.log('📧 Sending service booking confirmation to customer');
            console.log('User email:', user?.email);

            if (!user?.email) {
                console.error('❌ User email is required');
                return false;
            }

            const templateData = {
                userName: user.firstName || user.name || 'Valued Customer',
                userEmail: user.email,
                bookingType: 'service',
                serviceName: service?.name || 'Service',
                bookingDate: this.formatDateTime(booking.startTime).split(' at')[0],
                bookingStartTime: this.formatDateTime(booking.startTime),
                bookingEndTime: this.formatDateTime(booking.endTime),
                duration: service?.duration || 60,
                storeName: store?.name || 'Our Location',
                storeAddress: store?.location || store?.address || '',
                staffName: booking.Staff?.name || booking.staff?.name || null,
                bookingId: booking.id,
                status: booking.status,
                qrCodeUrl: qrCodeUrl || null,
                bookingLink: `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/bookings/${booking.id}`,
                rescheduleLink: `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/bookings/${booking.id}/reschedule`,
                cancellationPolicy: service?.cancellation_policy || 'Please cancel at least 24 hours in advance.',
                supportEmail: process.env.SUPPORT_EMAIL || 'support@discoun3ree.com',
                supportPhone: process.env.SUPPORT_PHONE || '+254712345678',
                chatLink: `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/chat`
            };

            console.log('📧 Template data prepared with keys:', Object.keys(templateData));

            const htmlContent = await this.renderTemplate('customerBookingConfirmation', templateData);
            
            await this.sendEmail(
                user.email,
                `Booking Confirmed: ${service?.name || 'Service'}`,
                htmlContent
            );

            console.log('✅ Service booking confirmation email sent successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to send customer booking confirmation:', error);
            return false;
        }
    }

    /**
     * Send booking notification to merchant (SERVICE)
     */
    async sendBookingNotificationToMerchant(booking, service, store, staff) {
        try {
            console.log('📧 Sending service booking notification to merchant');

            const merchantEmail = staff?.email || store?.email || store?.merchant_email || store?.contact_email;

            if (!merchantEmail) {
                console.warn('⚠️ No merchant email found for store:', store?.id);
                return false;
            }

            // Get user info
            const user = booking.User || booking.bookingUser;

            const templateData = {
                merchantName: store?.merchant_name || staff?.name || 'Merchant',
                merchantEmail: merchantEmail,
                bookingType: 'service',
                serviceName: service?.name || 'Service',
                bookingDate: this.formatDateTime(booking.startTime).split(' at')[0],
                bookingStartTime: this.formatDateTime(booking.startTime),
                bookingEndTime: this.formatDateTime(booking.endTime),
                duration: service?.duration || 60,
                storeName: store?.name || 'Store',
                staffName: staff?.name || 'Not assigned',
                bookingId: booking.id,
                status: booking.status,
                customerName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Customer',
                customerEmail: user?.email || 'N/A',
                customerPhone: user?.phoneNumber || user?.phone || 'N/A',
                customerId: user?.id || 'N/A',
                customerNotes: booking.notes || null,
                bookingLink: `${process.env.MERCHANT_FRONTEND_URL || 'https://merchants.discoun3ree.com'}/bookings/${booking.id}`,
                dashboardLink: `${process.env.MERCHANT_FRONTEND_URL || 'https://merchants.discoun3ree.com'}/dashboard`,
                confirmLink: `${process.env.MERCHANT_FRONTEND_URL || 'https://merchants.discoun3ree.com'}/bookings/${booking.id}/confirm`
            };

            console.log('📧 Merchant template data prepared');

            const htmlContent = await this.renderTemplate('merchantBookingNotification', templateData);

            await this.sendEmail(
                merchantEmail,
                `New Booking: ${service?.name || 'Service'}`,
                htmlContent
            );

            console.log('✅ Merchant notification email sent successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to send merchant booking notification:', error);
            return false;
        }
    }

    // ==========================================
    // OFFER BOOKING NOTIFICATIONS
    // ==========================================

    /**
     * Send offer booking confirmation to customer (OFFER)
     */
    async sendOfferBookingConfirmationToCustomer(booking, offer, service, user, store, qrCodeUrl) {
        try {
            console.log('📧 Sending offer booking confirmation to customer');
            console.log('User email:', user?.email);

            if (!user?.email) {
                console.error('❌ User email is required');
                return false;
            }

            const templateData = {
                userName: user.firstName || user.name || 'Valued Customer',
                userEmail: user.email,
                bookingType: 'offer',
                offerTitle: offer?.title || 'Special Offer',
                serviceName: service?.name || 'Service',
                bookingDate: this.formatDateTime(booking.startTime).split(' at')[0],
                bookingStartTime: this.formatDateTime(booking.startTime),
                bookingEndTime: this.formatDateTime(booking.endTime),
                duration: service?.duration || 90,
                storeName: store?.name || 'Our Location',
                storeAddress: store?.location || store?.address || '',
                staffName: booking.Staff?.name || booking.staff?.name || null,
                bookingId: booking.id,
                status: booking.status,
                discount: offer?.discount || 0,
                accessFee: booking.accessFee || offer?.fee || 0,
                qrCodeUrl: qrCodeUrl || null,
                bookingLink: `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/bookings/${booking.id}`,
                rescheduleLink: `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/bookings/${booking.id}/reschedule`,
                cancellationPolicy: 'Offer bookings are subject to cancellation terms. Access fee may be non-refundable.',
                supportEmail: process.env.SUPPORT_EMAIL || 'support@discoun3ree.com',
                supportPhone: process.env.SUPPORT_PHONE || '+254712345678',
                chatLink: `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/chat`
            };

            console.log('📧 Offer template data prepared with keys:', Object.keys(templateData));

            const htmlContent = await this.renderTemplate('customerBookingConfirmation', templateData);

            await this.sendEmail(
                user.email,
                `Offer Booking Confirmed: ${offer?.title || 'Special Offer'}`,
                htmlContent
            );

            console.log('✅ Offer booking confirmation email sent successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to send offer booking confirmation:', error);
            return false;
        }
    }

    /**
     * Send offer booking notification to merchant (OFFER)
     */
    async sendOfferBookingNotificationToMerchant(booking, offer, service, store, staff, user) {
        try {
            console.log('📧 Sending offer booking notification to merchant');

            const merchantEmail = staff?.email || store?.email || store?.merchant_email || store?.contact_email;

            if (!merchantEmail) {
                console.warn('⚠️ No merchant email found for store:', store?.id);
                return false;
            }

            const templateData = {
                merchantName: store?.merchant_name || staff?.name || 'Merchant',
                merchantEmail: merchantEmail,
                bookingType: 'offer',
                offerTitle: offer?.title || 'Special Offer',
                serviceName: service?.name || 'Service',
                bookingDate: this.formatDateTime(booking.startTime).split(' at')[0],
                bookingStartTime: this.formatDateTime(booking.startTime),
                bookingEndTime: this.formatDateTime(booking.endTime),
                duration: service?.duration || 90,
                storeName: store?.name || 'Store',
                staffName: staff?.name || 'Not assigned',
                bookingId: booking.id,
                status: booking.status,
                discount: offer?.discount || 0,
                accessFee: booking.accessFee || offer?.fee || 0,
                customerName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Customer',
                customerEmail: user?.email || 'N/A',
                customerPhone: user?.phoneNumber || user?.phone || 'N/A',
                customerId: user?.id || 'N/A',
                customerNotes: booking.notes || null,
                bookingLink: `${process.env.MERCHANT_FRONTEND_URL || 'https://merchants.discoun3ree.com'}/bookings/${booking.id}`,
                dashboardLink: `${process.env.MERCHANT_FRONTEND_URL || 'https://merchants.discoun3ree.com'}/dashboard`,
                confirmLink: `${process.env.MERCHANT_FRONTEND_URL || 'https://merchants.discoun3ree.com'}/bookings/${booking.id}/confirm`
            };

            console.log('📧 Merchant offer template data prepared');

            const htmlContent = await this.renderTemplate('merchantBookingNotification', templateData);

            await this.sendEmail(
                merchantEmail,
                `New Offer Booking: ${offer?.title || 'Special Offer'}`,
                htmlContent
            );

            console.log('✅ Merchant offer notification email sent successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to send merchant offer booking notification:', error);
            return false;
        }
    }
}

module.exports = NotificationService;