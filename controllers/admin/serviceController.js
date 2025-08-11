const Service = require('../../models/index').sequelize.models.Service;
const serviceService = require('../../services/admin/serviceService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getAllServices = async (req, res) => {
  try {
    const services = await serviceService.getAllServices();
    return sendSuccessResponse(res, 200, services);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getServiceById = async (req, res) => {
  try {
    const service = await serviceService.getServiceById(req.params.id);
    if (!service) return sendErrorResponse(res, 404, 'Service not found');
    return sendSuccessResponse(res, 200, service);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const createService = async (req, res) => {
  try {
    const isValid = await serviceService.validateServiceData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid service data');

    const service = await serviceService.createService(req.body);
    return sendSuccessResponse(res, 201, service);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateService = async (req, res) => {
  try {
    const isValid = await serviceService.validateServiceData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid service data');

    const service = await serviceService.updateService(req.params.id, req.body);
    if (!service) return sendErrorResponse(res, 404, 'Service not found');
    return sendSuccessResponse(res, 200, service);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const deleteService = async (req, res) => {
  try {
    const service = await serviceService.deleteService(req.params.id);
    if (!service) return sendErrorResponse(res, 404, 'Service not found');
    return sendSuccessResponse(res, 200, { message: 'Service deleted successfully' });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const searchServices = async (req, res) => {
  try {
    const services = await serviceService.searchServices(req.query);
    return sendSuccessResponse(res, 200, services);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getServicesByStore = async (req, res) => {
  try {
    const services = await serviceService.getServicesByStore(req.params.id);
    return sendSuccessResponse(res, 200, services);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  searchServices,
  getServicesByStore,
};