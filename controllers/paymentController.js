const { Payment } = require('../models');
const { initiatePayment, recordPaymentTransaction } = require('../services/darajaService');
const { generateUniqueCode } = require('../utils/paymentUtils');
const { getAccessToken } = require('../config/darajaConfig');

// Create Payment Controller
exports.createPayment = async (req, res) => {
  const { offer_id, user_id, phone_number, amount } = req.body;

  try {
    const accessToken = await getAccessToken();

    const paymentResponse = await initiatePayment(amount, phone_number, accessToken);

    const newPayment = await recordPaymentTransaction({
      offer_id,
      user_id,
      phone_number,
      status: 'pending',
      gateway: 'MPESA',
      MerchantRequestID: paymentResponse.MerchantRequestID,
      unique_code: generateUniqueCode(),
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

exports.paymentCallback = async (req, res) => {
  const { MerchantRequestID, ResultCode, ResultDesc } = req.body;

  try {
    // Find the payment record by MerchantRequestID
    const payment = await Payment.findOne({ where: { MerchantRequestID } });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Update the payment status based on the ResultCode
    payment.status = ResultCode === 0 ? 'successful' : 'failed';
    payment.result_description = ResultDesc;
    await payment.save();

    return res.status(200).json({ message: 'Payment status updated successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating payment status' });
  }
};
