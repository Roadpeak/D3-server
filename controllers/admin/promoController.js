const Promo = require('../../models/index').sequelize.models.Promo;
const promoService = require('../../services/admin/promoService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getAllPromos = async (req, res) => {
  try {
    const promos = await promoService.getAllPromos();
    return sendSuccessResponse(res, 200, promos);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getPromoById = async (req, res) => {
  try {
    const promo = await promoService.getPromoById(req.params.id);
    if (!promo) return sendErrorResponse(res, 404, 'Promo not found');
    return sendSuccessResponse(res, 200, promo);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const createPromo = async (req, res) => {
  try {
    const isValid = await promoService.validatePromoData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid promo data');

    const promo = await promoService.createPromo(req.body);
    return sendSuccessResponse(res, 201, promo);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updatePromo = async (req, res) => {
  try {
    const isValid = await promoService.validatePromoData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid promo data');

    const promo = await promoService.updatePromo(req.params.id, req.body);
    if (!promo) return sendErrorResponse(res, 404, 'Promo not found');
    return sendSuccessResponse(res, 200, promo);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const deletePromo = async (req, res) => {
  try {
    const promo = await promoService.deletePromo(req.params.id);
    if (!promo) return sendErrorResponse(res, 404, 'Promo not found');
    return sendSuccessResponse(res, 200, { message: 'Promo deleted successfully' });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const searchPromos = async (req, res) => {
  try {
    const promos = await promoService.searchPromos(req.query);
    return sendSuccessResponse(res, 200, promos);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const activatePromo = async (req, res) => {
  try {
    const promo = await promoService.activatePromo(req.params.id);
    if (!promo) return sendErrorResponse(res, 404, 'Promo not found');
    return sendSuccessResponse(res, 200, { message: 'Promo activated successfully', promo });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const deactivatePromo = async (req, res) => {
  try {
    const promo = await promoService.deactivatePromo(req.params.id);
    if (!promo) return sendErrorResponse(res, 404, 'Promo not found');
    return sendSuccessResponse(res, 200, { message: 'Promo deactivated successfully', promo });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getAllPromos,
  getPromoById,
  createPromo,
  updatePromo,
  deletePromo,
  searchPromos,
  activatePromo,
  deactivatePromo,
};