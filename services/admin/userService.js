const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const { validateEmail, validateName } = require('../../utils/validators');

const createUser = async (userData) => {
  return User.create(userData);
};

const getUserById = async (id) => {
  return User.findById(id).select('-password');
};

const updateUser = async (id, userData) => {
  return User.findByIdAndUpdate(id, userData, { new: true }).select('-password');
};

const deleteUser = async (id) => {
  return User.findByIdAndDelete(id);
};

const searchUsers = async (query) => {
  const { name, email } = query;
  const filter = {};
  if (name) filter.name = { $regex: name, $options: 'i' };
  if (email) filter.email = { $regex: email, $options: 'i' };
  return User.find(filter).select('-password');
};

const validateUserData = async (userData) => {
  const { email, name } = userData;
  if (!validateEmail(email) || !validateName(name)) return false;
  return true;
};

const getUserStats = async (id) => {
  const bookings = await Booking.countDocuments({ userId: id });
  return { bookings };
};

module.exports = {
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  searchUsers,
  validateUserData,
  getUserStats,
};