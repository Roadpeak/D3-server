
const { User, Store, Merchant, Service, Booking, Offer, sequelize } = require("../../models/index");
const { Op } = require('sequelize');
const { validateEmail, validateName } = require('../../utils/validators');

// Find and count all users (for admin list endpoint)
const findAndCountAllUsers = async ({ where, limit, offset, order, attributes }) => {
  return await User.findAndCountAll({
    where,
    limit,
    offset,
    order,
    attributes
  });
};


const createUser = async (userData) => {
  return await User.create(userData);
};


const getUserById = async (id) => {
  return await User.findByPk(id, {
    attributes: { exclude: ['password'] }
  });
};


const updateUser = async (id, userData) => {
  await User.update(userData, { where: { id } });
  return await User.findByPk(id, { attributes: { exclude: ['password'] } });
};


const deleteUser = async (id) => {
  const user = await User.findByPk(id);
  if (!user) return null;
  await user.destroy();
  return user;
};


const searchUsers = async (query) => {
  const { name, email } = query;
  let where = {};
  if (name) {
    where[Op.or] = [
      { firstName: { [Op.like]: `%${name}%` } },
      { lastName: { [Op.like]: `%${name}%` } }
    ];
  }
  if (email) {
    where.email = { [Op.like]: `%${email}%` };
  }
  return await User.findAll({ where, attributes: { exclude: ['password'] } });
};


const validateUserData = async (userData) => {
  const { email, firstName, lastName } = userData;
  if (!validateEmail(email) || !validateName(firstName) || !validateName(lastName)) return false;
  return true;
};


const getUserStats = async (id) => {
  // Example: total bookings, total spent, total offers
  let totalBookings = 0;
  let totalSpent = 0;
  try {
    totalBookings = await Booking.count({ where: { userId: id } });
    const totalSpentResult = await Booking.findAll({
      where: { userId: id },
      attributes: [[sequelize.fn('SUM', sequelize.col('accessFee')), 'totalSpent']]
    });
    if (totalSpentResult && totalSpentResult.length > 0 && totalSpentResult[0].dataValues) {
      totalSpent = parseFloat(totalSpentResult[0].dataValues.totalSpent) || 0;
    }
  } catch (err) {
    console.error('getUserStats Booking error:', err);
  }
  return { totalBookings, totalSpent };
};

module.exports = {
  findAndCountAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  searchUsers,
  validateUserData,
  getUserStats,
};