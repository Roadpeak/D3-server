const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const { validatePromoData } = require('../../utils/validators');

const createPromo = async (promoData) => {
  return Promo.create(promoData);
};

const getPromoById = async (id) => {
  return Promo.findById(id);
};

const updatePromo = async (id, promoData) => {
  return Promo.findByIdAndUpdate(id, promoData, { new: true });
};

const deletePromo = async (id) => {
  return Promo.findByIdAndDelete(id);
};

const searchPromos = async (query) => {
  const { name, status } = query;
  const filter = {};
  if (name) filter.name = { $regex: name, $options: 'i' };
  if (status) filter.status = status;
  return Promo.find(filter);
};

const activatePromo = async (id) => {
  return Promo.findByIdAndUpdate(id, { status: 'active' }, { new: true });
};

const deactivatePromo = async (id) => {
  return Promo.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
};

// Removed duplicate validatePromoData definition; using imported version from utils/validators

module.exports = {
  createPromo,
  getPromoById,
  updatePromo,
  deletePromo,
  searchPromos,
  activatePromo,
  deactivatePromo,
  validatePromoData,
};