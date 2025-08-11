const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const { validateName, validateAddress } = require('../../utils/validators');

const createStore = async (storeData) => {
  return Store.create(storeData);
};

const getStoreById = async (id) => {
  return Store.findById(id);
};

const updateStore = async (id, storeData) => {
  return Store.findByIdAndUpdate(id, storeData, { new: true });
};

const deleteStore = async (id) => {
  return Store.findByIdAndDelete(id);
};

const searchStores = async (query) => {
  const { name, location } = query;
  const filter = {};
  if (name) filter.name = { $regex: name, $options: 'i' };
  if (location) filter.location = { $regex: location, $options: 'i' };
  return Store.find(filter);
};

const getStoresByMerchant = async (merchantId) => {
  return Store.find({ merchantId });
};

const validateStoreData = async (storeData) => {
  const { name, address } = storeData;
  return validateName(name) && validateAddress(address);
};

module.exports = {
  createStore,
  getStoreById,
  updateStore,
  deleteStore,
  searchStores,
  getStoresByMerchant,
  validateStoreData,
};