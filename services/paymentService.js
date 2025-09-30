// services/paymentService.js
const axios = require('axios');
const { Payment } = require('../models');

class PaymentService {
  constructor() {
    // M-Pesa configuration
    this.mpesaConfig = {
      consumerKey: process.env.MPESA_CONSUMER_KEY,
      consumerSecret: process.env.MPESA_CONSUMER_SECRET,
      baseURL: process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke',
      shortCode: process.env.MPESA_SHORTCODE,
      passKey: process.env.MPESA_PASSKEY,
      callbackURL: process.env.MPESA_CALLBACK_URL
    };
  }

  // Get M-Pesa access token
  async getMpesaAccessToken() {
    try {
      const auth = Buffer.from(`${this.mpesaConfig.consumerKey}:${this.mpesaConfig.consumerSecret}`).toString('base64');

      const response = await axios.get(
        `${this.mpesaConfig.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Error getting M-Pesa access token:', error);
      throw new Error('Failed to authenticate with M-Pesa');
    }
  }

  // Generate M-Pesa password
  generateMpesaPassword(timestamp) {
    const password = Buffer.from(`${this.mpesaConfig.shortCode}${this.mpesaConfig.passKey}${timestamp}`).toString('base64');
    return password;
  }

  // Initiate STK Push
  async initiateSTKPush(phoneNumber, amount, bookingId, description = 'Booking Payment') {
    try {
      console.log('🔄 Initiating M-Pesa STK Push:', { phoneNumber, amount, bookingId });

      const accessToken = await this.getMpesaAccessToken();
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, '') // remove separators
        .slice(0, 14); // ensure 14 digits

      const password = this.generateMpesaPassword(timestamp);

      // Format phone number (ensure it starts with 254)
      let formattedPhone = phoneNumber.replace(/^\+/, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('254')) {
        formattedPhone = '254' + formattedPhone;
      }

      const stkPushData = {
        BusinessShortCode: this.mpesaConfig.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: this.mpesaConfig.shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: this.mpesaConfig.callbackURL,
        AccountReference: `BOOKING_${bookingId}`,
        TransactionDesc: description
      };

      console.log('📤 STK Push data:', stkPushData);

      const response = await axios.post(
        `${this.mpesaConfig.baseURL}/mpesa/stkpush/v1/processrequest`,
        stkPushData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ STK Push response:', response.data);

      // Create payment record
      const payment = await Payment.create({
        amount: amount,
        currency: 'KES',
        method: 'mpesa',
        status: 'pending',
        unique_code: this.generateUniqueCode(),
        transaction_id: response.data.CheckoutRequestID,
        phone_number: formattedPhone,
        metadata: {
          bookingId,
          merchantRequestID: response.data.MerchantRequestID,
          checkoutRequestID: response.data.CheckoutRequestID
        }
      });

      return {
        success: true,
        payment,
        checkoutRequestId: response.data.CheckoutRequestID,
        merchantRequestId: response.data.MerchantRequestID,
        message: 'STK Push initiated successfully'
      };

    } catch (error) {
      console.error('❌ STK Push error:', error.response?.data || error.message);
      throw new Error('Failed to initiate M-Pesa payment');
    }
  }

  // Process M-Pesa callback
  async processMpesaCallback(callbackData) {
    try {
      console.log('📨 Processing M-Pesa callback:', JSON.stringify(callbackData, null, 2));

      const { Body } = callbackData;
      const { stkCallback } = Body;

      const checkoutRequestID = stkCallback.CheckoutRequestID;
      const merchantRequestID = stkCallback.MerchantRequestID;
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;

      // Find the payment record
      const payment = await Payment.findOne({
        where: {
          transaction_id: checkoutRequestID
        }
      });

      if (!payment) {
        console.error('❌ Payment record not found for CheckoutRequestID:', checkoutRequestID);
        return { success: false, message: 'Payment record not found' };
      }

      if (resultCode === 0) {
        // Payment successful
        const callbackMetadata = stkCallback.CallbackMetadata;
        const items = callbackMetadata.Item;

        let mpesaReceiptNumber = '';
        let phoneNumber = '';
        let amount = 0;
        let transactionDate = '';

        items.forEach(item => {
          switch (item.Name) {
            case 'MpesaReceiptNumber':
              mpesaReceiptNumber = item.Value;
              break;
            case 'PhoneNumber':
              phoneNumber = item.Value;
              break;
            case 'Amount':
              amount = item.Value;
              break;
            case 'TransactionDate':
              transactionDate = item.Value;
              break;
          }
        });

        // Update payment record
        await payment.update({
          status: 'completed',
          mpesa_receipt_number: mpesaReceiptNumber,
          transaction_date: transactionDate,
          metadata: {
            ...payment.metadata,
            mpesaReceiptNumber,
            transactionDate,
            resultDesc
          }
        });

        console.log('✅ Payment completed successfully:', mpesaReceiptNumber);

        return {
          success: true,
          payment,
          mpesaReceiptNumber,
          message: 'Payment completed successfully'
        };

      } else {
        // Payment failed
        await payment.update({
          status: 'failed',
          metadata: {
            ...payment.metadata,
            resultCode,
            resultDesc
          }
        });

        console.log('❌ Payment failed:', resultDesc);

        return {
          success: false,
          payment,
          resultCode,
          resultDesc,
          message: 'Payment failed'
        };
      }

    } catch (error) {
      console.error('❌ Error processing M-Pesa callback:', error);
      return { success: false, message: 'Error processing callback' };
    }
  }

  // Check payment status
  async checkPaymentStatus(paymentId) {
    try {
      const payment = await Payment.findByPk(paymentId);

      if (!payment) {
        return { success: false, message: 'Payment not found' };
      }

      return {
        success: true,
        payment: {
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          mpesa_receipt_number: payment.mpesa_receipt_number,
          transaction_date: payment.transaction_date,
          created_at: payment.createdAt
        }
      };

    } catch (error) {
      console.error('Error checking payment status:', error);
      return { success: false, message: 'Error checking payment status' };
    }
  }

  // Query STK Push status (for manual verification)
  async querySTKPushStatus(checkoutRequestId) {
    try {
      const accessToken = await this.getMpesaAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = this.generateMpesaPassword(timestamp);

      const queryData = {
        BusinessShortCode: this.mpesaConfig.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };

      const response = await axios.post(
        `${this.mpesaConfig.baseURL}/mpesa/stkpushquery/v1/query`,
        queryData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      console.error('Error querying STK Push status:', error);
      return { success: false, message: 'Error querying payment status' };
    }
  }

  // Create payment record for booking
  async createBookingPayment(bookingData) {
    try {
      const payment = await Payment.create({
        amount: bookingData.amount,
        currency: bookingData.currency || 'KES',
        method: bookingData.method || 'mpesa',
        status: 'pending',
        unique_code: this.generateUniqueCode(),
        phone_number: bookingData.phoneNumber,
        metadata: {
          bookingId: bookingData.bookingId,
          offerId: bookingData.offerId,
          userId: bookingData.userId,
          description: bookingData.description
        }
      });

      return {
        success: true,
        payment
      };

    } catch (error) {
      console.error('Error creating payment record:', error);
      return { success: false, message: 'Error creating payment record' };
    }
  }

  // Utility functions
  generateUniqueCode() {
    return 'PAY_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  formatAmount(amount) {
    return Math.round(parseFloat(amount));
  }

  validatePhoneNumber(phoneNumber) {
    const kenyanPhoneRegex = /^(\+254|254|0)?[17]\d{8}$/;
    return kenyanPhoneRegex.test(phoneNumber.replace(/\s+/g, ''));
  }

  // Get payment summary for admin
  async getPaymentSummary(filters = {}) {
    try {
      const { startDate, endDate, status, method } = filters;

      const whereClause = {};
      if (startDate && endDate) {
        whereClause.createdAt = {
          [require('sequelize').Op.between]: [startDate, endDate]
        };
      }
      if (status) whereClause.status = status;
      if (method) whereClause.method = method;

      const payments = await Payment.findAll({
        where: whereClause,
        attributes: [
          'status',
          'method',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
          [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'total_amount']
        ],
        group: ['status', 'method']
      });

      return {
        success: true,
        summary: payments
      };

    } catch (error) {
      console.error('Error getting payment summary:', error);
      return { success: false, message: 'Error fetching payment summary' };
    }
  }
}

module.exports = new PaymentService();