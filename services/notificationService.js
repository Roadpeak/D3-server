// services/notificationService.js
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const sgMail = require('@sendgrid/mail'); // SendGrid package
const moment = require('moment');

class NotificationService {
    constructor(config = {}) {
        this.config = {
            email: {
                enabled: true,
                from: process.env.EMAIL_FROM || 'bookings@example.com',
                sendgridApiKey: process.env.SENDGRID_API_KEY,
                ...config.email
            },
            sms: {
                enabled: false,
                ...config.sms
            },
            templatesPath: path.join(__dirname, '..', 'templates'),
            ...config
        };

        // Initialize SendGrid if enabled
        if (this.config.email.enabled && this.config.email.sendgridApiKey) {
            sgMail.setApiKey(this.config.email.sendgridApiKey);
        } else if (this.config.email.enabled) {
            console.warn('SendGrid API key not found. Email notifications may not work.');
        }
    }

    async renderTemplate(templateName, data) {
        const templatePath = path.join(this.config.templatesPath, `${templateName}.ejs`);

        try {
            // Check if template exists
            await fs.promises.access(templatePath, fs.constants.R_OK);

            // Render the template
            return await ejs.renderFile(templatePath, data);
        } catch (error) {
            console.error(`Error rendering template ${templateName}:`, error);
            throw new Error(`Failed to render template ${templateName}`);
        }
    }

    async sendEmail(to, subject, htmlContent) {
        if (!this.config.email.enabled) {
            console.log('Email notifications are disabled');
            return false;
        }

        if (!this.config.email.sendgridApiKey) {
            console.error('SendGrid API key not configured');
            return false;
        }

        try {
            const msg = {
                to,
                from: this.config.email.from,
                subject,
                html: htmlContent,
            };

            const result = await sgMail.send(msg);
            console.log(`Email sent with SendGrid. Status code: ${result[0]?.statusCode}`);
            return result;
        } catch (error) {
            console.error('Error sending email with SendGrid:', error);

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

        // Implement SMS sending logic here
        console.log(`SMS would be sent to ${to}: ${message}`);
        return true;
    }

    formatDateTime(dateTime) {
        return moment(dateTime).format('dddd, MMMM D, YYYY [at] h:mm A');
    }

    async sendBookingNotificationToMerchant(booking, service, store, staff) {
        try {
            // Prepare data for the template
            const templateData = {
                serviceName: service.name,
                bookingStartTime: this.formatDateTime(booking.startTime),
                bookingEndTime: this.formatDateTime(booking.endTime),
                customerId: booking.userId,
                staffName: staff ? staff.name : (store ? store.name : 'Merchant'),
                bookingLink: `${process.env.MERCHANT_DASHBOARD_URL || 'https://dashboard.example.com'}/merchant/bookings/details/${booking.id}`,
                bookingId: booking.id,
                status: booking.status,
                price: service.price
            };

            // Render the notification template
            const htmlContent = await this.renderTemplate('bookingNotification', templateData);

            // Send the email notification
            const merchantEmail = staff ? staff.email : (store ? store.email : process.env.MERCHANT_EMAIL);
            if (merchantEmail) {
                await this.sendEmail(
                    merchantEmail,
                    `New Booking: ${service.name}`,
                    htmlContent
                );
            }

            // Send SMS notification if enabled and phone number available
            const merchantPhone = staff ? staff.phoneNumber : (store ? store.phone_number : null);
            if (merchantPhone && this.config.sms.enabled) {
                const smsMessage = `New booking #${booking.id} for ${service.name} on ${this.formatDateTime(booking.startTime)}`;
                await this.sendSMS(merchantPhone, smsMessage);
            }

            return true;
        } catch (error) {
            console.error('Failed to send merchant booking notification:', error);
            return false;
        }
    }

    async sendBookingConfirmationToCustomer(booking, service, user, store, qrCode) {
        try {
            // Prepare data for the template
            const templateData = {
                userName: user.firstName || user.name || 'Valued Customer',
                serviceName: service.name,
                bookingStartTime: this.formatDateTime(booking.startTime),
                bookingEndTime: this.formatDateTime(booking.endTime),
                status: booking.status === 'confirmed' ? 'Confirmed' : 'Pending Confirmation',
                qrCode: qrCode || '',
                bookingLink: `${process.env.CUSTOMER_PORTAL_URL || 'https://portal.example.com'}/booking-details/${booking.id}`,
                storeInfo: {
                    name: store ? store.name : '',
                    address: store ? store.location : '',
                    phone: store ? store.phone_number : ''
                }
            };

            // Render the confirmation template
            const htmlContent = await this.renderTemplate('customerBookingConfirmation', templateData);

            // Send the email confirmation
            if (user.email) {
                await this.sendEmail(
                    user.email,
                    `Your Booking Confirmation: ${service.name}`,
                    htmlContent
                );
            }

            // Send SMS confirmation if enabled and phone number available
            if (user.phoneNumber && this.config.sms.enabled) {
                const smsMessage = `Your booking for ${service.name} on ${this.formatDateTime(booking.startTime)} is ${booking.status}. Booking ID: ${booking.id}`;
                await this.sendSMS(user.phoneNumber, smsMessage);
            }

            return true;
        } catch (error) {
            console.error('Failed to send customer booking confirmation:', error);
            return false;
        }
    }

    // Additional methods for various notification types can be added here
    // For example: sendCancellationNotification, sendReminderNotification, etc.
}

module.exports = NotificationService;