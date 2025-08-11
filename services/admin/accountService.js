const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const bcrypt = require('bcryptjs');
const { validateAccountData } = require('../../utils/validators');

const updateProfile = async (userId, profileData) => {
  return User.findByIdAndUpdate(userId, profileData, { new: true }).select('-password');
};

const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user) return false;
  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) return false;
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  return true;
};

const uploadAvatar = async (userId, avatarUrl) => {
  return User.findByIdAndUpdate(userId, { avatar: avatarUrl }, { new: true }).select('-password');
};

const updateSettings = async (userId, settingsData) => {
  return Account.findOneAndUpdate({ userId }, settingsData, { new: true, upsert: true });
};

// Removed duplicate validateAccountData definition; using imported version from utils/validators

const deactivateAccount = async (userId) => {
  return User.findByIdAndUpdate(userId, { isActive: false }, { new: true });
};

const generateAccountReport = async (userId) => {
  const bookings = await Booking.find({ userId });
  return { userId, totalBookings: bookings.length };
};

module.exports = {
  updateProfile,
  changePassword,
  uploadAvatar,
  updateSettings,
  validateAccountData,
  deactivateAccount,
  generateAccountReport,
};