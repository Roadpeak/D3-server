// routes/paymentRoutes.js - FIXED VERSION
// Resolves "Wrong credentials" error by properly handling environments

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateUser } = require('../middleware/auth');

// ========================================
// CRITICAL FIX: PROPER M-PESA CONFIGURATION
// ========================================

// IMPORTANT: Determine if we're in sandbox or production mode
const IS_PRODUCTION = process.env.MPESA_ENVIRONMENT === 'production';

const MPESA_CONFIG = {
  // Credentials
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  
  // CRITICAL: Use correct URL based on environment
  baseURL: IS_PRODUCTION 
    ? 'https://api.safaricom.co.ke' 
    : 'https://sandbox.safaricom.co.ke',
  
  // CRITICAL: Use correct shortcode based on environment
  shortCode: IS_PRODUCTION 
    ? (process.env.MPESA_SHORTCODE || '4137125')  // Your production shortcode
    : '174379',  // MUST use this for sandbox
  
  // CRITICAL: Use correct passkey based on environment  
  passKey: IS_PRODUCTION
    ? (process.env.MPESA_PASSKEY || 'your_production_passkey_here')  // Your production passkey
    : 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',  // Standard sandbox passkey
    
  callbackURL: process.env.MPESA_CALLBACK_URL || 'https://api.discoun3ree.com/api/v1/payments'
};

// Log configuration on startup (helps debugging)
console.log('🔧 M-PESA CONFIGURATION LOADED:');
console.log('  Mode:', IS_PRODUCTION ? 'PRODUCTION' : 'SANDBOX');
console.log('  Base URL:', MPESA_CONFIG.baseURL);
console.log('  ShortCode:', MPESA_CONFIG.shortCode);
console.log('  Callback URL:', MPESA_CONFIG.callbackURL);
console.log('  Has Credentials:', !!(MPESA_CONFIG.consumerKey && MPESA_CONFIG.consumerSecret));

// ========================================
// HELPER FUNCTIONS WITH BETTER ERROR HANDLING
// ========================================

async function getMpesaAccessToken() {
  try {
    console.log('🔑 Getting M-Pesa access token...');
    console.log('  Environment:', IS_PRODUCTION ? 'Production' : 'Sandbox');

    if (!MPESA_CONFIG.consumerKey || !MPESA_CONFIG.consumerSecret) {
      throw new Error('M-Pesa credentials not configured. Check your .env file.');
    }

    // Clean credentials (remove any accidental spaces or newlines)
    const cleanKey = MPESA_CONFIG.consumerKey.trim();
    const cleanSecret = MPESA_CONFIG.consumerSecret.trim();
    
    const auth = Buffer.from(`${cleanKey}:${cleanSecret}`).toString('base64');

    const response = await axios.get(
      `${MPESA_CONFIG.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.data.access_token) {
      console.log('✅ M-Pesa access token obtained');
      return response.data.access_token;
    } else {
      throw new Error('No access token received');
    }

  } catch (error) {
    console.error('❌ Error getting M-Pesa access token:', error.response?.data || error.message);
    
    // Provide helpful error messages
    if (error.response?.status === 400) {
      throw new Error('Invalid M-Pesa credentials. Please check your Consumer Key and Secret.');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Cannot reach M-Pesa servers. Check your internet connection.');
    } else {
      throw new Error('Failed to authenticate with M-Pesa: ' + (error.response?.data?.errorMessage || error.message));
    }
  }
}

function formatPhoneNumber(phoneNumber) {
  // Remove all non-numeric characters
  let formattedPhone = phoneNumber.replace(/\D/g, '');

  // Convert to 254 format
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1);
  } else if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) {
    formattedPhone = '254' + formattedPhone;
  } else if (!formattedPhone.startsWith('254')) {
    formattedPhone = '254' + formattedPhone;
  }

  return formattedPhone;
}

function generateMpesaPassword(timestamp) {
  return Buffer.from(`${MPESA_CONFIG.shortCode}${MPESA_CONFIG.passKey}${timestamp}`).toString('base64');
}

// ========================================
// MAIN STK PUSH ROUTE WITH FIXES
// ========================================

router.post('/mpesa', authenticateUser, async (req, res) => {
  try {
    const { phoneNumber, amount, bookingId, type = 'booking_access_fee' } = req.body;

    console.log('💳 M-Pesa STK Push request:', { phoneNumber, amount, bookingId, type });
    console.log('🔧 Using environment:', IS_PRODUCTION ? 'PRODUCTION' : 'SANDBOX');

    // Validate inputs
    if (!phoneNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and amount are required'
      });
    }

    // Validate phone number format
    const phoneRegex = /^(\+254|254|0)?[17]\d{8}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s+/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use: 0712345678 or 254712345678'
      });
    }

    // Validate amount
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0 || paymentAmount > 150000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be between 1 and 150,000 KES'
      });
    }

    // Import models
    const { Payment, Booking } = require('../models');

    // Create payment record
    const payment = await Payment.create({
      amount: paymentAmount,
      currency: 'KES',
      method: 'mpesa',
      status: 'pending',
      unique_code: 'PAY_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      phone_number: phoneNumber,
      metadata: {
        bookingId,
        type,
        phoneNumber,
        environment: IS_PRODUCTION ? 'production' : 'sandbox'
      }
    });

    console.log('✅ Payment record created:', payment.id);

    try {
      // Get M-Pesa access token
      const accessToken = await getMpesaAccessToken();

      // Generate timestamp and password
      const timestamp = new Date().toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, -3); // Format: YYYYMMDDHHmmss

      const password = generateMpesaPassword(timestamp);

      // Format phone number
      const formattedPhone = formatPhoneNumber(phoneNumber);
      console.log('📞 Formatted phone number:', formattedPhone);

      // Prepare STK Push request
      const stkPushData = {
        BusinessShortCode: MPESA_CONFIG.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(paymentAmount), // Must be an integer
        PartyA: formattedPhone,
        PartyB: MPESA_CONFIG.shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: `${MPESA_CONFIG.callbackURL}/mpesa/callback`,
        AccountReference: `BOOK${bookingId || payment.id}`.substring(0, 12), // Max 12 chars
        TransactionDesc: type === 'booking_access_fee' ? 'Booking Fee' : 'Payment' // Max 13 chars
      };

      console.log('📤 Sending STK Push to:', `${MPESA_CONFIG.baseURL}/mpesa/stkpush/v1/processrequest`);
      console.log('📦 STK Push data:', {
        ...stkPushData,
        Password: '[HIDDEN]' // Hide password in logs
      });

      // Send STK Push request
      const response = await axios.post(
        `${MPESA_CONFIG.baseURL}/mpesa/stkpush/v1/processrequest`,
        stkPushData,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('📱 STK Push response:', response.data);

      if (response.data.ResponseCode === '0') {
        // Success - STK Push sent
        await payment.update({
          transaction_id: response.data.CheckoutRequestID,
          metadata: {
            ...payment.metadata,
            checkoutRequestId: response.data.CheckoutRequestID,
            merchantRequestId: response.data.MerchantRequestID,
            customerMessage: response.data.CustomerMessage
          }
        });

        // Link to booking if provided
        if (bookingId && Booking) {
          try {
            const booking = await Booking.findByPk(bookingId);
            if (booking) {
              await booking.update({
                paymentId: payment.id,
                paymentUniqueCode: payment.unique_code
              });
              console.log('✅ Booking linked to payment:', bookingId);
            }
          } catch (bookingError) {
            console.warn('⚠️ Could not link booking:', bookingError.message);
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Payment initiated! Check your phone for the M-Pesa prompt.',
          payment: {
            id: payment.id,
            unique_code: payment.unique_code,
            amount: payment.amount,
            status: payment.status
          },
          checkoutRequestId: response.data.CheckoutRequestID,
          customerMessage: response.data.CustomerMessage || 'Please check your phone and enter your M-Pesa PIN.'
        });

      } else {
        // STK Push rejected
        throw new Error(response.data.ResponseDescription || 'STK Push was not successful');
      }

    } catch (mpesaError) {
      console.error('❌ M-Pesa STK Push error:', mpesaError.response?.data || mpesaError.message);

      // Update payment as failed
      await payment.update({
        status: 'failed',
        failed_at: new Date(),
        metadata: {
          ...payment.metadata,
          error: mpesaError.message,
          mpesaResponse: mpesaError.response?.data
        }
      });

      // Specific error handling
      if (mpesaError.response?.data?.errorCode === '500.001.1001') {
        // Wrong credentials error
        return res.status(400).json({
          success: false,
          message: 'M-Pesa configuration error. The app is not properly configured for ' + 
                   (IS_PRODUCTION ? 'production' : 'sandbox') + ' mode.',
          payment: { id: payment.id, status: 'failed' },
          error: 'CREDENTIAL_MISMATCH',
          details: IS_PRODUCTION 
            ? 'Using production mode. Ensure you have production credentials and shortcode.'
            : 'Using sandbox mode. Ensure you have sandbox test credentials.',
          troubleshooting: [
            'Check that MPESA_ENVIRONMENT in .env matches your credentials',
            'For sandbox: Use test credentials from sandbox.safaricom.co.ke',
            'For production: Use live credentials from developer.safaricom.co.ke',
            'Sandbox must use shortcode 174379',
            'Production must use your registered business shortcode'
          ]
        });
      }

      if (mpesaError.response?.data?.errorCode === '404.001.03') {
        return res.status(400).json({
          success: false,
          message: 'Invalid M-Pesa configuration. Check your shortcode and passkey.',
          payment: { id: payment.id, status: 'failed' },
          error: 'INVALID_CONFIG'
        });
      }

      // Generic error response
      return res.status(400).json({
        success: false,
        message: mpesaError.response?.data?.errorMessage || mpesaError.message || 'Failed to initiate M-Pesa payment',
        payment: { id: payment.id, status: 'failed' },
        error: mpesaError.response?.data || mpesaError.message
      });
    }

  } catch (error) {
    console.error('❌ General payment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to process payment request',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Payment service temporarily unavailable'
    });
  }
});

// ========================================
// M-PESA CALLBACK HANDLER
// ========================================

router.post('/mpesa/callback', async (req, res) => {
  try {
    console.log('📨 M-Pesa callback received:', JSON.stringify(req.body, null, 2));

    const { Body } = req.body;
    
    if (!Body || !Body.stkCallback) {
      console.log('⚠️ Invalid callback structure');
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { stkCallback } = Body;
    const { Payment, Booking } = require('../models');

    const checkoutRequestID = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    // Find payment
    const payment = await Payment.findOne({
      where: { transaction_id: checkoutRequestID }
    });

    if (!payment) {
      console.error('❌ Payment not found for CheckoutRequestID:', checkoutRequestID);
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (resultCode === 0) {
      // Payment successful
      const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
      let mpesaReceiptNumber = '';
      let transactionDate = '';
      let amount = 0;
      let phoneNumber = '';

      callbackMetadata.forEach(item => {
        switch (item.Name) {
          case 'MpesaReceiptNumber':
            mpesaReceiptNumber = item.Value;
            break;
          case 'TransactionDate':
            transactionDate = String(item.Value);
            break;
          case 'Amount':
            amount = item.Value;
            break;
          case 'PhoneNumber':
            phoneNumber = item.Value;
            break;
        }
      });

      // Update payment
      await payment.update({
        status: 'completed',
        mpesa_receipt_number: mpesaReceiptNumber,
        transaction_date: transactionDate ? new Date(
          transactionDate.slice(0, 4) + '-' +
          transactionDate.slice(4, 6) + '-' +
          transactionDate.slice(6, 8) + 'T' +
          transactionDate.slice(8, 10) + ':' +
          transactionDate.slice(10, 12) + ':' +
          transactionDate.slice(12, 14)
        ) : new Date(),
        processed_at: new Date(),
        metadata: {
          ...payment.metadata,
          mpesaReceiptNumber,
          transactionDate,
          callbackAmount: amount,
          phoneNumber
        }
      });

      // Update linked booking
      if (payment.metadata?.bookingId) {
        const booking = await Booking.findByPk(payment.metadata.bookingId);
        if (booking) {
          await booking.update({ 
            status: 'confirmed',
            payment_status: 'paid'
          });
          console.log('✅ Booking confirmed:', booking.id);
        }
      }

      console.log('✅ Payment completed:', mpesaReceiptNumber);

    } else {
      // Payment failed
      let failureReason = 'Payment failed';
      
      // Decode result codes
      switch (resultCode) {
        case 1:
          failureReason = 'Insufficient balance';
          break;
        case 1001:
          failureReason = 'Unable to lock subscriber account';
          break;
        case 1032:
          failureReason = 'Transaction cancelled by user';
          break;
        case 1037:
          failureReason = 'Timeout - User did not enter PIN';
          break;
        default:
          failureReason = resultDesc || 'Payment failed';
      }

      await payment.update({
        status: 'failed',
        failed_at: new Date(),
        metadata: {
          ...payment.metadata,
          resultCode,
          resultDesc,
          failureReason
        }
      });

      console.log('❌ Payment failed:', failureReason);
    }

    // Always return success to M-Pesa
    return res.status(200).json({ 
      ResultCode: 0, 
      ResultDesc: "Callback processed successfully" 
    });

  } catch (error) {
    console.error('❌ Callback processing error:', error);
    // Still return success to avoid M-Pesa retries
    return res.status(200).json({ 
      ResultCode: 0, 
      ResultDesc: "Accepted" 
    });
  }
});

// ========================================
// CHECK PAYMENT STATUS
// ========================================

router.get('/:paymentId/status', authenticateUser, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { Payment } = require('../models');

    const payment = await Payment.findByPk(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Return payment status
    return res.status(200).json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        mpesa_receipt_number: payment.mpesa_receipt_number,
        transaction_date: payment.transaction_date,
        created_at: payment.createdAt,
        updated_at: payment.updatedAt,
        failure_reason: payment.metadata?.failureReason
      }
    });

  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
});

// ========================================
// CONFIGURATION TEST ENDPOINT
// ========================================

router.get('/test/config', async (req, res) => {
  try {
    console.log('🧪 Testing M-Pesa configuration...');

    // Test getting access token
    let tokenSuccess = false;
    let tokenError = null;
    
    try {
      const token = await getMpesaAccessToken();
      tokenSuccess = !!token;
    } catch (error) {
      tokenError = error.message;
    }

    res.status(200).json({
      success: tokenSuccess,
      message: tokenSuccess ? 'Configuration is valid!' : 'Configuration has issues',
      config: {
        environment: IS_PRODUCTION ? 'production' : 'sandbox',
        baseURL: MPESA_CONFIG.baseURL,
        shortCode: MPESA_CONFIG.shortCode,
        callbackURL: MPESA_CONFIG.callbackURL,
        hasConsumerKey: !!MPESA_CONFIG.consumerKey,
        hasConsumerSecret: !!MPESA_CONFIG.consumerSecret,
        hasPassKey: !!MPESA_CONFIG.passKey,
        tokenTest: {
          success: tokenSuccess,
          error: tokenError
        }
      },
      instructions: !tokenSuccess ? {
        sandbox: [
          '1. Set MPESA_ENVIRONMENT=sandbox in .env',
          '2. Get test credentials from https://sandbox.safaricom.co.ke',
          '3. Create a test app and get Consumer Key & Secret',
          '4. Use shortcode 174379 for sandbox',
          '5. Restart your server'
        ],
        production: [
          '1. Set MPESA_ENVIRONMENT=production in .env',
          '2. Get live credentials from https://developer.safaricom.co.ke',
          '3. Use your registered business shortcode',
          '4. Add your production passkey',
          '5. Ensure callback URL is publicly accessible'
        ]
      } : null
    });

  } catch (error) {
    console.error('Config test error:', error);
    res.status(500).json({
      success: false,
      message: 'Configuration test failed',
      error: error.message
    });
  }
});

// ========================================
// SIMPLE TEST ENDPOINT
// ========================================

router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payment routes are working!',
    environment: IS_PRODUCTION ? 'production' : 'sandbox',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;