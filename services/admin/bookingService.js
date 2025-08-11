const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const { validateBookingData } = require('../../utils/validators');

const createBooking = async (bookingData) => {
  return Booking.create(bookingData);
};

const getBookingById = async (id) => {
  return Booking.findById(id);
};

const updateBooking = async (id, bookingData) => {
  return Booking.findByIdAndUpdate(id, bookingData, { new: true });
};

const deleteBooking = async (id) => {
  return Booking.findByIdAndDelete(id);
};

const searchBookings = async (query) => {
  const { userId, status } = query;
  const filter = {};
  if (userId) filter.userId = userId;
  if (status) filter.status = status;
  return Booking.find(filter);
};

const confirmBooking = async (id) => {
  return Booking.findByIdAndUpdate(id, { status: 'confirmed' }, { new: true });
};

const cancelBooking = async (id) => {
  return Booking.findByIdAndUpdate(id, { status: 'canceled' }, { new: true });
};

// Removed duplicate validateBookingData definition; using imported version from utils/validators

module.exports = {
  createBooking,
  getBookingById,
  updateBooking,
  deleteBooking,
  searchBookings,
  confirmBooking,
  cancelBooking,
  validateBookingData,
};