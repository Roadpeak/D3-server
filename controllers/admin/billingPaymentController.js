const Payment = require('../../models/index').sequelize.models.Payment;
const paymentService = require('../../services/admin/paymentService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getAllBillingPayments = async (req, res) => {
  try {
    const payments = await paymentService.getAllPayments({ type: 'billing' });
    return sendSuccessResponse(res, 200, payments);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getBillingPaymentById = async (req, res) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    if (!payment || payment.type !== 'billing') return sendErrorResponse(res, 404, 'Billing payment not found');
    return sendSuccessResponse(res, 200, payment);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const createBillingPayment = async (req, res) => {
  try {
    const isValid = await paymentService.validatePaymentData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid payment data');

    const payment = await paymentService.createPayment({ ...req.body, type: 'billing' });
    return sendSuccessResponse(res, 201, payment);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateBillingPayment = async (req, res) => {
  try {
    const isValid = await paymentService.validatePaymentData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid payment data');

    const payment = await paymentService.updatePayment(req.params.id, req.body);
    if (!payment || payment.type !== 'billing') return sendErrorResponse(res, 404, 'Billing payment not found');
    return sendSuccessResponse(res, 200, payment);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const searchBillingPayments = async (req, res) => {
  try {
    const payments = await paymentService.searchPayments({ ...req.query, type: 'billing' });
    return sendSuccessResponse(res, 200, payments);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const processBillingPayment = async (req, res) => {
  try {
    const payment = await paymentService.processPayment(req.params.id);
    if (!payment || payment.type !== 'billing') return sendErrorResponse(res, 404, 'Billing payment not found');
    return sendSuccessResponse(res, 200, { message: 'Billing payment processed successfully', payment });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const refundBillingPayment = async (req, res) => {
  try {
    const payment = await paymentService.refundPayment(req.params.id);
    if (!payment || payment.type !== 'billing') return sendErrorResponse(res, 404, 'Billing payment not found');
    return sendSuccessResponse(res, 200, { message: 'Billing payment refunded successfully', payment });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getAllBillingPayments,
  getBillingPaymentById,
  createBillingPayment,
  updateBillingPayment,
  searchBillingPayments,
  processBillingPayment,
  refundBillingPayment,
};