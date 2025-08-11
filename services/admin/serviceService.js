const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const { validateName } = require('../../utils/validators');

const createService = async (serviceData) => {
  return Service.create(serviceData);
};

const getServiceById = async (id) => {
  return Service.findById(id);
};

const updateService = async (id, serviceData) => {
  return Service.findByIdAndUpdate(id, serviceData, { new: true });
};

const deleteService = async (id) => {
  return Service.findByIdAndDelete(id);
};

const searchServices = async (query) => {
  const { name, storeId } = query;
  const filter = {};
  if (name) filter.name = { $regex: name, $options: 'i' };
  if (storeId) filter.storeId = storeId;
  return Service.find(filter);
};

const getServicesByStore = async (storeId) => {
  return Service.find({ storeId });
};

const validateServiceData = async (serviceData) => {
  const { name } = serviceData;
  return validateName(name);
};

module.exports = {
  createService,
  getServiceById,
  updateService,
  deleteService,
  searchServices,
  getServicesByStore,
  validateServiceData,
};