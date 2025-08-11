const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const { validatePaymentData } = require('../../utils/validators');

const processPayment = async (id) => {
  const payment = await Payment.findByIdAndUpdate(id, { status: 'processed' }, { new: true });
  if (payment) {
    // Simulate payment gateway integration
    return payment;
  }
  return null;
};

// Removed duplicate validatePaymentData definition; using imported version from utils/validators

const refundPayment = async (id) => {
  return Payment.findByIdAndUpdate(id, { status: 'refunded' }, { new: true });
};

const getPaymentStatus = async (id) => {
  const payment = await Payment.findById(id);
  return payment ? payment.status : null;
};

const calculateFees = async (amount) => {
  return amount * 0.03; // Example: 3% transaction fee
};

const generateReceipt = async (id) => {
  const payment = await Payment.findById(id);
  if (!payment) return null;
  return {
    id: payment._id,
    amount: payment.amount,
    status: payment.status,
    date: payment.createdAt,
  };
};

const validatePaymentMethod = async (method) => {
  return ['credit_card', 'paypal', 'bank_transfer'].includes(method);
};

module.exports = {
  processPayment,
  validatePaymentData,
  refundPayment,
  getPaymentStatus,
  calculateFees,
  generateReceipt,
  validatePaymentMethod,
};