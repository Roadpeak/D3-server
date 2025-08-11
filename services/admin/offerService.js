const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const { validateOfferData } = require('../../utils/validators');

const createOffer = async (offerData) => {
  return Offer.create(offerData);
};

const getOfferById = async (id) => {
  return Offer.findById(id);
};

const updateOffer = async (id, offerData) => {
  return Offer.findByIdAndUpdate(id, offerData, { new: true });
};

const deleteOffer = async (id) => {
  return Offer.findByIdAndDelete(id);
};

const searchOffers = async (query) => {
  const { name, status } = query;
  const filter = {};
  if (name) filter.name = { $regex: name, $options: 'i' };
  if (status) filter.status = status;
  return Offer.find(filter);
};

const activateOffer = async (id) => {
  return Offer.findByIdAndUpdate(id, { status: 'active' }, { new: true });
};

const deactivateOffer = async (id) => {
  return Offer.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
};

// Removed duplicate validateOfferData definition; using imported version from utils/validators

module.exports = {
  createOffer,
  getOfferById,
  updateOffer,
  deleteOffer,
  searchOffers,
  activateOffer,
  deactivateOffer,
  validateOfferData,
};