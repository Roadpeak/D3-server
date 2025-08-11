const Merchant = require('../../models/index').sequelize.models.Merchant;
const merchantService = require('../../services/admin/merchantService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getAllMerchants = async (req, res) => {
  try {
    const merchants = await merchantService.getAllMerchants();
    return sendSuccessResponse(res, 200, merchants);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getMerchantById = async (req, res) => {
  try {
    const merchant = await merchantService.getMerchantById(req.params.id);
    if (!merchant) return sendErrorResponse(res, 404, 'Merchant not found');
    return sendSuccessResponse(res, 200, merchant);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const createMerchant = async (req, res) => {
  try {
    const isValid = await merchantService.validateMerchantData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid merchant data');

    const merchant = await merchantService.createMerchant(req.body);
    return sendSuccessResponse(res, 201, merchant);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateMerchant = async (req, res) => {
  try {
    const isValid = await merchantService.validateMerchantData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid merchant data');

    const merchant = await merchantService.updateMerchant(req.params.id, req.body);
    if (!merchant) return sendErrorResponse(res, 404, 'Merchant not found');
    return sendSuccessResponse(res, 200, merchant);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const deleteMerchant = async (req, res) => {
  try {
    const merchant = await merchantService.deleteMerchant(req.params.id);
    if (!merchant) return sendErrorResponse(res, 404, 'Merchant not found');
    return sendSuccessResponse(res, 200, { message: 'Merchant deleted successfully' });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const searchMerchants = async (req, res) => {
  try {
    const merchants = await merchantService.searchMerchants(req.query);
    return sendSuccessResponse(res, 200, merchants);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getMerchantStats = async (req, res) => {
  try {
    const stats = await merchantService.getMerchantStats(req.params.id);
    if (!stats) return sendErrorResponse(res, 404, 'Merchant not found');
    return sendSuccessResponse(res, 200, stats);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const approveMerchant = async (req, res) => {
  try {
    const merchant = await merchantService.approveMerchant(req.params.id);
    if (!merchant) return sendErrorResponse(res, 404, 'Merchant not found');
    return sendSuccessResponse(res, 200, { message: 'Merchant approved successfully', merchant });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getAllMerchants,
  getMerchantById,
  createMerchant,
  updateMerchant,
  deleteMerchant,
  searchMerchants,
  getMerchantStats,
  approveMerchant,
};