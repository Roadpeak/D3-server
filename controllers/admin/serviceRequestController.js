const ServiceRequest = require('../../models/index').sequelize.models.ServiceRequest;
const serviceRequestService = require('../../services/admin/serviceRequestService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getAllServiceRequests = async (req, res) => {
  try {
    const serviceRequests = await serviceRequestService.getAllServiceRequests();
    return sendSuccessResponse(res, 200, serviceRequests);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getServiceRequestById = async (req, res) => {
  try {
    const serviceRequest = await serviceRequestService.getServiceRequestById(req.params.id);
    if (!serviceRequest) return sendErrorResponse(res, 404, 'Service request not found');
    return sendSuccessResponse(res, 200, serviceRequest);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const createServiceRequest = async (req, res) => {
  try {
    const isValid = await serviceRequestService.validateRequestData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid service request data');

    const serviceRequest = await serviceRequestService.createServiceRequest(req.body);
    return sendSuccessResponse(res, 201, serviceRequest);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateServiceRequest = async (req, res) => {
  try {
    const isValid = await serviceRequestService.validateRequestData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid service request data');

    const serviceRequest = await serviceRequestService.updateServiceRequest(req.params.id, req.body);
    if (!serviceRequest) return sendErrorResponse(res, 404, 'Service request not found');
    return sendSuccessResponse(res, 200, serviceRequest);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const deleteServiceRequest = async (req, res) => {
  try {
    const serviceRequest = await serviceRequestService.deleteServiceRequest(req.params.id);
    if (!serviceRequest) return sendErrorResponse(res, 404, 'Service request not found');
    return sendSuccessResponse(res, 200, { message: 'Service request deleted successfully' });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const searchServiceRequests = async (req, res) => {
  try {
    const serviceRequests = await serviceRequestService.searchServiceRequests(req.query);
    return sendSuccessResponse(res, 200, serviceRequests);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const assignServiceRequest = async (req, res) => {
  try {
    const { staffId } = req.body;
    const serviceRequest = await serviceRequestService.assignServiceRequest(req.params.id, staffId);
    if (!serviceRequest) return sendErrorResponse(res, 404, 'Service request not found');
    return sendSuccessResponse(res, 200, { message: 'Service request assigned successfully', serviceRequest });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const serviceRequest = await serviceRequestService.updateStatus(req.params.id, status);
    if (!serviceRequest) return sendErrorResponse(res, 404, 'Service request not found');
    return sendSuccessResponse(res, 200, { message: 'Service request status updated successfully', serviceRequest });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getAllServiceRequests,
  getServiceRequestById,
  createServiceRequest,
  updateServiceRequest,
  deleteServiceRequest,
  searchServiceRequests,
  assignServiceRequest,
  updateStatus,
};