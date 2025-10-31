// routes/paymentRoutes.js - FIXED: Properly completes booking after payment

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateUser } = require('../middleware/auth');

// ========================================
// REAL M-PESA CONFIGURATION
// ========================================

const MPESA_CONFIG = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  baseURL: process.env.MPESA_BASE_URL || 'https://api.safaricom.co.ke',
  shortCode: process.env.MPESA_SHORTCODE || '4137125',
  passKey: process.env.MPESA_PASSKEY || 'd51c992e104a03143dae7295b30ef658e2a6cdba52d41d05c46206eae75ba801',
  callbackURL: 'https://api.discoun3ree.com/api/v1/payments'
};

// ========================================
// REAL M-PESA HELPER FUNCTIONS
// ========================================

async function getMpesaAccessToken() {
  try {
    console.log('🔑 Getting M-Pesa access token...');

    if (!MPESA_CONFIG.consumerKey || !MPESA_CONFIG.consumerSecret) {
      throw new Error('M-Pesa credentials not configured. Check your .env file.');
    }

    const auth = Buffer.from(`${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`).toString('base64');

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

    console.log('✅ M-Pesa access token obtained');
    return response.data.access_token;

  } catch (error) {
    console.error('❌ Error getting M-Pesa access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with M-Pesa. Check your credentials.');
  }
}

function formatPhoneNumber(phoneNumber) {
  let formattedPhone = phoneNumber.replace(/\D/g, '');

  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('254')) {
    formattedPhone = '254' + formattedPhone;
  }

  return formattedPhone;
}

function generateMpesaPassword(timestamp) {
  return Buffer.from(`${MPESA_CONFIG.shortCode}${MPESA_CONFIG.passKey}${timestamp}`).toString('base64');
}

// ========================================
// REAL M-PESA STK PUSH ROUTE
// ========================================

router.post('/mpesa', authenticateUser, async (req, res) => {
  try {
    const { phoneNumber, amount, bookingId, type = 'booking_access_fee' } = req.body;

    console.log('💳 REAL M-Pesa STK Push request:', { phoneNumber, amount, bookingId, type });

    // Validate required fields
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
    if (isNaN(paymentAmount) || paymentAmount <= 0 || paymentAmount > 70000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be between 1 and 70,000 KES'
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
        phoneNumber
      }
    });

    console.log('✅ Payment record created:', payment.id);

    try {
      // Get M-Pesa access token
      const accessToken = await getMpesaAccessToken();

      // Generate timestamp and password
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
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
        Amount: Math.round(paymentAmount),
        PartyA: formattedPhone,
        PartyB: MPESA_CONFIG.shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: `${MPESA_CONFIG.callbackURL}/mpesa/callback`,
        AccountReference: `BOOKING_${bookingId || payment.id}`,
        TransactionDesc: type === 'booking_access_fee' ? 'Booking Access Fee' : 'Service Payment'
      };

      console.log('📤 Sending STK Push request...');

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
        // STK Push successful
        await payment.update({
          transaction_id: response.data.CheckoutRequestID,
          metadata: {
            ...payment.metadata,
            checkoutRequestId: response.data.CheckoutRequestID,
            merchantRequestId: response.data.MerchantRequestID,
            customerMessage: response.data.CustomerMessage
          }
        });

        // Link payment to booking if provided
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
          message: 'STK Push sent successfully! Check your phone for the M-Pesa prompt.',
          payment: {
            id: payment.id,
            unique_code: payment.unique_code,
            amount: payment.amount,
            status: payment.status
          },
          checkoutRequestId: response.data.CheckoutRequestID,
          customerMessage: response.data.CustomerMessage,
          instructions: 'Please check your phone for the M-Pesa payment prompt and enter your PIN to complete the payment.'
        });

      } else {
        throw new Error(response.data.ResponseDescription || 'STK Push failed');
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

      // Check if it's a credentials error
      if (mpesaError.message.includes('credentials') || mpesaError.message.includes('authenticate')) {
        return res.status(400).json({
          success: false,
          message: 'M-Pesa configuration error. Please check your credentials.',
          payment: { id: payment.id, status: 'failed' },
          error: 'MPESA_CONFIG_ERROR'
        });
      }

      return res.status(400).json({
        success: false,
        message: mpesaError.response?.data?.errorMessage || mpesaError.message || 'Failed to initiate M-Pesa payment',
        payment: { id: payment.id, status: 'failed' },
        error: mpesaError.response?.data || mpesaError.message
      });
    }

  } catch (error) {
    console.error('❌ General M-Pesa payment error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to process M-Pesa payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Payment service temporarily unavailable'
    });
  }
});

// ========================================
// M-PESA CALLBACK HANDLER - FIXED
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

    console.log('🔍 Processing callback for CheckoutRequestID:', checkoutRequestID);
    console.log('📊 Result Code:', resultCode, '| Result Desc:', resultDesc);

    // Find payment by checkout request ID
    const payment = await Payment.findOne({
      where: { transaction_id: checkoutRequestID }
    });

    if (!payment) {
      console.error('❌ Payment not found for CheckoutRequestID:', checkoutRequestID);
      return res.status(200).json({ 
        ResultCode: 0, 
        ResultDesc: "Payment not found but callback acknowledged" 
      });
    }

    console.log('✅ Payment found:', payment.id);
    console.log('📦 Payment metadata:', payment.metadata);

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

      console.log('💰 M-Pesa Receipt:', mpesaReceiptNumber);
      console.log('📅 Transaction Date:', transactionDate);
      console.log('💵 Amount:', amount);

      // Parse transaction date
      let parsedDate = new Date();
      if (transactionDate) {
        try {
          parsedDate = new Date(
            transactionDate.slice(0, 4) + '-' +
            transactionDate.slice(4, 6) + '-' +
            transactionDate.slice(6, 8) + 'T' +
            transactionDate.slice(8, 10) + ':' +
            transactionDate.slice(10, 12) + ':' +
            transactionDate.slice(12, 14)
          );
        } catch (e) {
          console.warn('⚠️ Could not parse transaction date:', transactionDate);
        }
      }

      // Update payment status
      await payment.update({
        status: 'completed',
        mpesa_receipt_number: mpesaReceiptNumber,
        transaction_date: parsedDate,
        processed_at: new Date(),
        metadata: {
          ...payment.metadata,
          mpesaReceiptNumber,
          transactionDate,
          callbackAmount: amount,
          phoneNumber
        }
      });

      console.log('✅ Payment marked as completed');

      // CRITICAL FIX: Find and update booking using bookingId from metadata
      if (payment.metadata?.bookingId) {
        const bookingId = payment.metadata.bookingId;
        console.log('🔍 Looking for booking with ID:', bookingId);

        try {
          const booking = await Booking.findByPk(bookingId);
          
          if (booking) {
            console.log('📋 Booking found:', booking.id, '| Current status:', booking.status);
            
            // Update booking to confirmed
            await booking.update({ 
              status: 'confirmed',
              payment_status: 'paid',
              paymentId: payment.id,
              paymentUniqueCode: payment.unique_code,
              mpesa_receipt_number: mpesaReceiptNumber,
              confirmed_at: new Date()
            });
            
            console.log('✅ BOOKING CONFIRMED! Booking ID:', booking.id);
            console.log('📊 New booking status:', booking.status);
            console.log('💳 Payment status:', booking.payment_status);
            console.log('📝 M-Pesa Receipt:', mpesaReceiptNumber);
          } else {
            console.error('❌ Booking not found with ID:', bookingId);
            console.log('📦 Available payment metadata:', payment.metadata);
          }
        } catch (bookingError) {
          console.error('❌ Error updating booking:', bookingError.message);
          console.error('Stack:', bookingError.stack);
        }
      } else {
        console.warn('⚠️ No bookingId found in payment metadata');
        console.log('📦 Payment metadata:', JSON.stringify(payment.metadata, null, 2));
      }

      console.log('✅ Payment processing completed successfully');

    } else {
      // Payment failed
      console.log('❌ Payment failed with code:', resultCode);

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

      console.log('❌ Payment marked as failed:', failureReason);
    }

    // Always return success to M-Pesa
    return res.status(200).json({ 
      ResultCode: 0, 
      ResultDesc: "Callback processed successfully" 
    });

  } catch (error) {
    console.error('❌ Callback processing error:', error);
    console.error('Stack:', error.stack);
    
    // Still return success to avoid M-Pesa retries
    return res.status(200).json({ 
      ResultCode: 0, 
      ResultDesc: "Callback received with errors" 
    });
  }
});

// ========================================
// M-PESA STATUS CHECK
// ========================================

router.get('/:paymentId/status', authenticateUser, async (req, res) => {
  try {
    const { paymentId } = req.params;

    console.log('🔍 Checking payment status for:', paymentId);

    const { Payment } = require('../models');

    const payment = await Payment.findByPk(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

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
    console.error('❌ Error checking payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
});

// ========================================
// M-PESA CONFIGURATION TEST
// ========================================

router.get('/test/mpesa', async (req, res) => {
  try {
    console.log('🧪 Testing M-Pesa configuration...');

    const token = await getMpesaAccessToken();

    res.status(200).json({
      success: true,
      message: 'M-Pesa configuration is working!',
      config: {
        baseURL: MPESA_CONFIG.baseURL,
        shortCode: MPESA_CONFIG.shortCode,
        callbackURL: MPESA_CONFIG.callbackURL,
        hasCredentials: !!(MPESA_CONFIG.consumerKey && MPESA_CONFIG.consumerSecret),
        tokenReceived: !!token
      }
    });

  } catch (error) {
    console.error('❌ M-Pesa config test failed:', error);

    res.status(500).json({
      success: false,
      message: 'M-Pesa configuration test failed: ' + error.message,
      config: {
        baseURL: MPESA_CONFIG.baseURL,
        shortCode: MPESA_CONFIG.shortCode,
        callbackURL: MPESA_CONFIG.callbackURL,
        hasConsumerKey: !!MPESA_CONFIG.consumerKey,
        hasConsumerSecret: !!MPESA_CONFIG.consumerSecret
      }
    });
  }
});

// ========================================
// OTHER ROUTES
// ========================================

router.post('/payments', authenticateUser, async (req, res) => {
  try {
    const { Payment } = require('../models');
    const payment = await Payment.create(req.body);
    res.status(201).json({ success: true, payment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create payment' });
  }
});

router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payment routes working with REAL M-Pesa!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;