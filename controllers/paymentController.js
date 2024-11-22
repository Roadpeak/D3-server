const { Payment } = require('../models');
const { initiatePayment, recordPaymentTransaction } = require('../services/darajaService');
const { generateUniqueCode } = require('../utils/paymentUtils');
const { getAccessToken } = require('../config/darajaConfig');

// Create Payment Controller
exports.createPayment = async (req, res) => {
  const { offer_id, user_id, phone_number, amount } = req.body;
  
  try {
    // Get the access token from Daraja
    const accessToken = await getAccessToken();
    
    // Initiate the payment
    const paymentResponse = await initiatePayment(amount, phone_number, accessToken);
    
    // Record the payment in the database
    const newPayment = await recordPaymentTransaction({
      offer_id,
      user_id,
      phone_number,
      status: 'pending',
      gateway: 'MPESA',
      MerchantRequestID: paymentResponse.MerchantRequestID
    });
    
    return res.status(201).json({ payment: newPayment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Payment initiation failed' });
  }
};
