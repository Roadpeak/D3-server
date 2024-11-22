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
      MerchantRequestID: paymentResponse.MerchantRequestID,
      unique_code: generateUniqueCode()  // Ensure you generate the unique code
    });

    return res.status(201).json({ payment: newPayment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Payment initiation failed' });
  }
};

// Get All Payments
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll();
    return res.status(200).json({ payments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching payments' });
  }
};

// Get Payments by Status
exports.getPaymentsByStatus = async (req, res) => {
  const { status } = req.params;
  
  try {
    const payments = await Payment.findAll({
      where: {
        status: status,
      }
    });
    return res.status(200).json({ payments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching payments by status' });
  }
};

// Get Payments by User
exports.getPaymentsByUser = async (req, res) => {
  const { user_id } = req.params;

  try {
    const payments = await Payment.findAll({
      where: {
        user_id: user_id,
      }
    });
    return res.status(200).json({ payments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching payments by user' });
  }
};

// Get Payments by Offer
exports.getPaymentsByOffer = async (req, res) => {
  const { offer_id } = req.params;

  try {
    const payments = await Payment.findAll({
      where: {
        offer_id: offer_id,
      }
    });
    return res.status(200).json({ payments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching payments by offer' });
  }
};

// Get Payments by Store (through Offer -> Service -> Store)
exports.getPaymentsByStore = async (req, res) => {
  const { store_id } = req.params;

  try {
    const payments = await Payment.findAll({
      include: {
        model: Offer,
        where: {
          '$Offer.service.store_id$': store_id, // This uses the relationship chain
        },
        include: {
          model: Service,
          include: {
            model: Store,
            where: { id: store_id }
          }
        }
      }
    });

    return res.status(200).json({ payments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching payments by store' });
  }
};
