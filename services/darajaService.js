const axios = require('axios');
const { generateUniqueCode } = require('../utils/paymentUtils');
const { Payment } = require('../models');

/**
 * Initiate an M-Pesa payment using STK Push
 * @param {number} amount - Payment amount
 * @param {string} phoneNumber - Customer phone number
 * @param {string} accessToken - M-Pesa access token
 * @param {string} [bookingId] - Optional booking ID for reference
 * @returns {Promise<object>} M-Pesa API response
 */
async function initiatePayment(amount, phoneNumber, accessToken, bookingId = null) {
  console.log('Initiating payment:', { amount, phoneNumber, bookingId });
  
  // Format phone number (ensure it starts with 254)
  let formattedPhone = phoneNumber.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('254')) {
    formattedPhone = '254' + formattedPhone;
  }
  
  // Generate timestamp for the request
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  
  // Generate password
  const password = Buffer.from(
    `${process.env.BUSINESS_SHORTCODE}${process.env.LIPA_SHORTCODE_KEY}${timestamp}`
  ).toString('base64');
  
  // Prepare the payment data
  const paymentData = {
    "BusinessShortCode": process.env.BUSINESS_SHORTCODE,
    "Password": password,
    "Timestamp": timestamp,
    "TransactionType": "CustomerPayBillOnline",
    "Amount": Math.round(parseFloat(amount)),
    "PartyA": formattedPhone,
    "PartyB": process.env.BUSINESS_SHORTCODE,
    "PhoneNumber": formattedPhone,
    "CallBackURL": process.env.MPESA_CALLBACK_URL,
    "AccountReference": bookingId ? `BOOKING_${bookingId}` : "Payment for service",
    "TransactionDesc": "Payment for service"
  };

  console.log('Payment request data:', paymentData);

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.post(
      'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      paymentData,
      { headers }
    );

    console.log('Payment request successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error making payment request:', error.response?.data || error.message);
    
    // If in development, provide mock response
    if (process.env.NODE_ENV === 'development') {
      console.log('DEVELOPMENT MODE: Returning mock response');
      return {
        ResponseCode: "0",
        ResponseDescription: "Success",
        CheckoutRequestID: `mock_${Date.now()}`,
        CustomerMessage: "Success. Processing payment",
        MerchantRequestID: `mock_merchant_${Date.now()}`,
        _mock: true
      };
    }
    
    throw new Error(error.response?.data?.errorMessage || 'Failed to make payment request');
  }
}

/**
 * Record a payment transaction in the database
 * @param {object} paymentDetails - Payment details
 * @returns {Promise<object>} Created payment record
 */
async function recordPaymentTransaction(paymentDetails) {
  const { 
    offer_id, 
    user_id, 
    phone_number, 
    amount = 0,
    status = 'pending', 
    gateway = 'mpesa', 
    MerchantRequestID,
    CheckoutRequestID 
  } = paymentDetails;

  const unique_code = generateUniqueCode();
  
  try {
    const newPayment = await Payment.create({
      offer_id,
      user_id,
      phone_number,
      amount,
      currency: 'KES',
      status,
      method: gateway,
      transaction_id: CheckoutRequestID || null,
      unique_code,
      metadata: {
        MerchantRequestID,
        CheckoutRequestID,
        offerId: offer_id
      },
      payment_date: new Date()
    });

    console.log('Payment record created:', newPayment.id);
    return newPayment;
  } catch (error) {
    console.error('Error recording payment:', error);
    throw new Error('Failed to record payment transaction');
  }
}

/**
 * Check the status of an M-Pesa payment
 * @param {string} checkoutRequestId - M-Pesa checkout request ID
 * @param {string} accessToken - M-Pesa access token
 * @returns {Promise<object>} Payment status response
 */
async function checkPaymentStatus(checkoutRequestId, accessToken) {
  // Skip actual API call in development mode
  if (process.env.NODE_ENV === 'development' && checkoutRequestId.startsWith('mock_')) {
    const mockResponse = {
      ResponseCode: "0",
      ResponseDescription: "The service request has been accepted successfully",
      MerchantRequestID: checkoutRequestId.replace('mock_', 'merchant_'),
      CheckoutRequestID: checkoutRequestId,
      ResultCode: "0",
      ResultDesc: "The service request is processed successfully.",
      _mock: true
    };
    return mockResponse;
  }

  try {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(
      `${process.env.BUSINESS_SHORTCODE}${process.env.LIPA_SHORTCODE_KEY}${timestamp}`
    ).toString('base64');
    
    const requestData = {
      BusinessShortCode: process.env.BUSINESS_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    };
    
    const response = await axios.post(
      'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query',
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error checking payment status:', error.response?.data || error.message);
    throw new Error('Failed to check payment status');
  }
}

module.exports = {
  initiatePayment,
  recordPaymentTransaction,
  checkPaymentStatus
};