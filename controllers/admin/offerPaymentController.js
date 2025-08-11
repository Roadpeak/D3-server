const Payment = require('../../models/index').sequelize.models.Payment;
const paymentService = require('../../services/admin/paymentService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getAllOfferPayments = async (req, res) => {
  try {
    const payments = await paymentService.getAllPayments({ type: 'offer' });
    return sendSuccessResponse(res, 200, payments);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getOfferPaymentById = async (req, res) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    if (!payment || payment.type !== 'offer') return sendErrorResponse(res, 404, 'Offer payment not found');
    return sendSuccessResponse(res, 200, payment);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const createOfferPayment = async (req, res) => {
  try {
    const isValid = await paymentService.validatePaymentData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid payment data');

    const payment = await paymentService.createPayment({ ...req.body, type: 'offer' });
    return sendSuccessResponse(res, 201, payment);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateOfferPayment = async (req, res) => {
  try {
    const isValid = await paymentService.validatePaymentData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid payment data');

    const payment = await paymentService.updatePayment(req.params.id, req.body);
    if (!payment || payment.type !== 'offer') return sendErrorResponse(res, 404, 'Offer payment not found');
    return sendSuccessResponse(res, 200, payment);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const searchOfferPayments = async (req, res) => {
  try {
    const payments = await paymentService.searchPayments({ ...req.query, type: 'offer' });
    return sendSuccessResponse(res, 200, payments);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const processOfferPayment = async (req, res) => {
  try {
    const payment = await paymentService.processPayment(req.params.id);
    if (!payment || payment.type !== 'offer') return sendErrorResponse(res, 404, 'Offer payment not found');
    return sendSuccessResponse(res, 200, { message: 'Offer payment processed successfully', payment });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const refundOfferPayment = async (req, res) => {
  try {
    const payment = await paymentService.refundPayment(req.params.id);
    if (!payment || payment.type !== 'offer') return sendErrorResponse(res, 404, 'Offer payment not found');
    return sendSuccessResponse(res, 200, { message: 'Offer payment refunded successfully', payment });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getAllOfferPayments,
  getOfferPaymentById,
  createOfferPayment,
  updateOfferPayment,
  searchOfferPayments,
  processOfferPayment,
  refundOfferPayment,
};