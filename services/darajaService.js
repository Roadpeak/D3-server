const axios = require('axios');
const { generateUniqueCode } = require('../utils/paymentUtils');

async function initiatePayment(amount, phoneNumber, accessToken) {
  const paymentData = {
    "BusinessShortCode": process.env.BUSINESS_SHORTCODE,
    "LipaNaMpesaOnlineShortcode": process.env.LIPA_SHORTCODE,
    "LipaNaMpesaOnlineShortcodeKey": process.env.LIPA_SHORTCODE_KEY,
    "PhoneNumber": phoneNumber,
    "Amount": amount,
    "AccountReference": "Payment for service",
    "TransactionDesc": "Payment for service",
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`
  };

  try {
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', 
      paymentData, 
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error making payment request', error);
    throw new Error('Failed to make payment request');
  }
}

async function recordPaymentTransaction(paymentDetails) {
  const { offer_id, user_id, phone_number, status, gateway, MerchantRequestID } = paymentDetails;

  const unique_code = generateUniqueCode();
  const newPayment = await Payment.create({
    offer_id,
    user_id,
    phone_number,
    status,
    gateway,
    MerchantRequestID,
    unique_code,
    payment_date: new Date()
  });

  return newPayment;
}

module.exports = {
  initiatePayment,
  recordPaymentTransaction
};
