// services/realMpesaService.js - Real M-Pesa STK Push Implementation

const axios = require('axios');

class RealMpesaService {
  constructor() {
    // M-Pesa configuration from environment variables
    this.mpesaConfig = {
      consumerKey: process.env.MPESA_CONSUMER_KEY,
      consumerSecret: process.env.MPESA_CONSUMER_SECRET,
      baseURL: process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke',
      shortCode: process.env.MPESA_SHORTCODE || '4137125',
      passKey: process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
      callbackURL: process.env.MPESA_CALLBACK_URL || 'http://localhost:4000/api/v1/payments'
    };

    console.log('🔧 M-Pesa Service initialized:', {
      baseURL: this.mpesaConfig.baseURL,
      shortCode: this.mpesaConfig.shortCode,
      callbackURL: this.mpesaConfig.callbackURL,
      hasConsumerKey: !!this.mpesaConfig.consumerKey,
      hasConsumerSecret: !!this.mpesaConfig.consumerSecret
    });
  }

  // Get M-Pesa access token
  async getMpesaAccessToken() {
    try {
      console.log('🔑 Getting M-Pesa access token...');
      
      if (!this.mpesaConfig.consumerKey || !this.mpesaConfig.consumerSecret) {
        throw new Error('M-Pesa consumer key and secret are required');
      }

      const auth = Buffer.from(`${this.mpesaConfig.consumerKey}:${this.mpesaConfig.consumerSecret}`).toString('base64');
      
      const response = await axios.get(
        `${this.mpesaConfig.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('✅ M-Pesa access token obtained');
      return response.data.access_token;

    } catch (error) {
      console.error('❌ Error getting M-Pesa access token:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw new Error('Failed to authenticate with M-Pesa: ' + error.message);
    }
  }

  // Generate M-Pesa password
  generateMpesaPassword(timestamp) {
    const password = Buffer.from(`${this.mpesaConfig.shortCode}${this.mpesaConfig.passKey}${timestamp}`).toString('base64');
    return password;
  }

  // Format phone number for M-Pesa
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digits
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // Convert to Kenya format (254...)
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    return formattedPhone;
  }

  // Initiate real STK Push
  async initiateSTKPush(phoneNumber, amount, bookingId, description = 'Booking Payment') {
    try {
      console.log('📱 Initiating REAL M-Pesa STK Push:', { 
        phoneNumber, 
        amount, 
        bookingId, 
        description 
      });

      // Get access token
      const accessToken = await this.getMpesaAccessToken();
      
      // Generate timestamp and password
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
      const password = this.generateMpesaPassword(timestamp);

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      console.log('📞 Formatted phone number:', formattedPhone);

      // Prepare STK Push request
      const stkPushData = {
        BusinessShortCode: this.mpesaConfig.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(parseFloat(amount)),
        PartyA: formattedPhone,
        PartyB: this.mpesaConfig.shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: `${this.mpesaConfig.callbackURL}/mpesa/callback`,
        AccountReference: `BOOKING_${bookingId}`,
        TransactionDesc: description
      };

      console.log('📤 STK Push request data:', {
        ...stkPushData,
        Password: '[HIDDEN]'
      });

      // Send STK Push request
      const response = await axios.post(
        `${this.mpesaConfig.baseURL}/mpesa/stkpush/v1/processrequest`,
        stkPushData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('✅ STK Push response:', response.data);

      // Check if request was successful
      if (response.data.ResponseCode === '0') {
        return {
          success: true,
          checkoutRequestId: response.data.CheckoutRequestID,
          merchantRequestId: response.data.MerchantRequestID,
          customerMessage: response.data.CustomerMessage,
          responseDescription: response.data.ResponseDescription,
          message: 'STK Push sent successfully. Please check your phone.'
        };
      } else {
        throw new Error(response.data.ResponseDescription || 'STK Push failed');
      }

    } catch (error) {
      console.error('❌ STK Push error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config ? {
          url: error.config.url,
          method: error.config.method
        } : null
      });

      return {
        success: false,
        message: error.response?.data?.errorMessage || error.message || 'Failed to initiate M-Pesa payment',
        error: error.response?.data || error.message
      };
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

        console.log('✅ Payment successful:', {
          mpesaReceiptNumber,
          phoneNumber,
          amount,
          transactionDate
        });

        return {
          success: true,
          mpesaReceiptNumber,
          phoneNumber,
          amount,
          transactionDate,
          checkoutRequestID,
          resultDesc: 'Payment completed successfully'
        };

      } else {
        // Payment failed
        console.log('❌ Payment failed:', resultDesc);

        return {
          success: false,
          resultCode,
          resultDesc,
          checkoutRequestID,
          message: 'Payment failed: ' + resultDesc
        };
      }

    } catch (error) {
      console.error('❌ Error processing M-Pesa callback:', error);
      return { 
        success: false, 
        message: 'Error processing callback: ' + error.message 
      };
    }
  }

  // Query STK Push status
  async querySTKPushStatus(checkoutRequestId) {
    try {
      console.log('🔍 Querying STK Push status:', checkoutRequestId);

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
          },
          timeout: 15000
        }
      );

      console.log('✅ STK Push query response:', response.data);

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      console.error('❌ Error querying STK Push status:', error);
      return { 
        success: false, 
        message: 'Error querying payment status: ' + error.message 
      };
    }
  }

  // Validate phone number
  validatePhoneNumber(phoneNumber) {
    const kenyanPhoneRegex = /^(\+254|254|0)?[17]\d{8}$/;
    return kenyanPhoneRegex.test(phoneNumber.replace(/\s+/g, ''));
  }

  // Test M-Pesa configuration
  async testConfiguration() {
    try {
      console.log('🧪 Testing M-Pesa configuration...');

      // Test access token
      const token = await this.getMpesaAccessToken();
      
      return {
        success: true,
        message: 'M-Pesa configuration is working correctly',
        config: {
          baseURL: this.mpesaConfig.baseURL,
          shortCode: this.mpesaConfig.shortCode,
          callbackURL: this.mpesaConfig.callbackURL,
          hasCredentials: !!(this.mpesaConfig.consumerKey && this.mpesaConfig.consumerSecret),
          tokenReceived: !!token
        }
      };

    } catch (error) {
      console.error('❌ M-Pesa configuration test failed:', error);
      
      return {
        success: false,
        message: 'M-Pesa configuration test failed: ' + error.message,
        config: {
          baseURL: this.mpesaConfig.baseURL,
          shortCode: this.mpesaConfig.shortCode,
          callbackURL: this.mpesaConfig.callbackURL,
          hasConsumerKey: !!this.mpesaConfig.consumerKey,
          hasConsumerSecret: !!this.mpesaConfig.consumerSecret,
          hasPassKey: !!this.mpesaConfig.passKey
        },
        error: error.message
      };
    }
  }
}

module.exports = new RealMpesaService();