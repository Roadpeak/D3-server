const Store = require('../../models/index').sequelize.models.Store;
const storeService = require('../../services/admin/storeService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getAllStores = async (req, res) => {
  try {
    const stores = await storeService.getAllStores();
    return sendSuccessResponse(res, 200, stores);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getStoreById = async (req, res) => {
  try {
    const store = await storeService.getStoreById(req.params.id);
    if (!store) return sendErrorResponse(res, 404, 'Store not found');
    return sendSuccessResponse(res, 200, store);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const createStore = async (req, res) => {
  try {
    const isValid = await storeService.validateStoreData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid store data');

    const store = await storeService.createStore(req.body);
    return sendSuccessResponse(res, 201, store);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateStore = async (req, res) => {
  try {
    const isValid = await storeService.validateStoreData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid store data');

    const store = await storeService.updateStore(req.params.id, req.body);
    if (!store) return sendErrorResponse(res, 404, 'Store not found');
    return sendSuccessResponse(res, 200, store);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const deleteStore = async (req, res) => {
  try {
    const store = await storeService.deleteStore(req.params.id);
    if (!store) return sendErrorResponse(res, 404, 'Store not found');
    return sendSuccessResponse(res, 200, { message: 'Store deleted successfully' });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const searchStores = async (req, res) => {
  try {
    const stores = await storeService.searchStores(req.query);
    return sendSuccessResponse(res, 200, stores);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getStoresByMerchant = async (req, res) => {
  try {
    const stores = await storeService.getStoresByMerchant(req.params.id);
    return sendSuccessResponse(res, 200, stores);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getAllStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
  searchStores,
  getStoresByMerchant,
};