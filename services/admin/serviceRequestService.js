const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const { validateRequestData } = require('../../utils/validators');

const createServiceRequest = async (requestData) => {
  return ServiceRequest.create(requestData);
};

const getServiceRequestById = async (id) => {
  return ServiceRequest.findById(id);
};

const updateServiceRequest = async (id, requestData) => {
  return ServiceRequest.findByIdAndUpdate(id, requestData, { new: true });
};

const deleteServiceRequest = async (id) => {
  return ServiceRequest.findByIdAndDelete(id);
};

const searchServiceRequests = async (query) => {
  const { userId, status } = query;
  const filter = {};
  if (userId) filter.userId = userId;
  if (status) filter.status = status;
  return ServiceRequest.find(filter);
};

const assignServiceRequest = async (id, staffId) => {
  return ServiceRequest.findByIdAndUpdate(id, { staffId, status: 'assigned' }, { new: true });
};

const updateStatus = async (id, status) => {
  return ServiceRequest.findByIdAndUpdate(id, { status }, { new: true });
};

// Removed duplicate validateRequestData definition; using imported version from utils/validators

module.exports = {
  createServiceRequest,
  getServiceRequestById,
  updateServiceRequest,
  deleteServiceRequest,
  searchServiceRequests,
  assignServiceRequest,
  updateStatus,
  validateRequestData,
};