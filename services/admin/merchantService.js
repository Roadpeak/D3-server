const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const { validateName } = require('../../utils/validators');

const createMerchant = async (merchantData) => {
  return Merchant.create(merchantData);
};

const getMerchantById = async (id) => {
  return Merchant.findById(id);
};

const updateMerchant = async (id, merchantData) => {
  return Merchant.findByIdAndUpdate(id, merchantData, { new: true });
};

const deleteMerchant = async (id) => {
  return Merchant.findByIdAndDelete(id);
};

const searchMerchants = async (query) => {
  const { name, status } = query;
  const filter = {};
  if (name) filter.name = { $regex: name, $options: 'i' };
  if (status) filter.status = status;
  return Merchant.find(filter);
};

const validateMerchantData = async (merchantData) => {
  const { name } = merchantData;
  return validateName(name);
};

const approveMerchant = async (id) => {
  return Merchant.findByIdAndUpdate(id, { status: 'approved' }, { new: true });
};

const getMerchantStats = async (id) => {
  const stores = await Store.countDocuments({ merchantId: id });
  const bookings = await Booking.countDocuments({ merchantId: id });
  return { stores, bookings };
};

module.exports = {
  createMerchant,
  getMerchantById,
  updateMerchant,
  deleteMerchant,
  searchMerchants,
  validateMerchantData,
  approveMerchant,
  getMerchantStats,
};