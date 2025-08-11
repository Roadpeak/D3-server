const User = require('../../models/index').sequelize.models.User;
const userService = require('../../services/admin/userService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');
const { Op } = require('sequelize');

const getAllUsers = async (req, res) => {
  try {
    // Support pagination, search, filters
    const { page = 1, limit = 10, search = '', userType = 'all', status = 'all', sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;
    const offset = (page - 1) * limit;
    let whereCondition = {};
    if (typeof search === 'string' && search.trim().length > 0) {
      whereCondition[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phoneNumber: { [Op.like]: `%${search}%` } }
      ];
    }
    if (userType !== 'all') {
      whereCondition.userType = userType;
    }
    if (status === 'active') {
      whereCondition.isActive = true;
    } else if (status === 'suspended') {
      whereCondition.isActive = false;
    }
    const { rows: users, count: totalUsers } = await userService.findAndCountAllUsers({
      where: whereCondition,
      limit: parseInt(limit),
      offset: offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      attributes: [
        'id', 'firstName', 'lastName', 'email', 'phoneNumber', 'userType',
        'isActive', 'isOnline', 'emailVerifiedAt', 'phoneVerifiedAt',
        'createdAt', 'updatedAt', 'lastLoginAt', 'lastSeenAt', 'avatar'
      ]
    });
    return sendSuccessResponse(res, 200, {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        perPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('getAllUsers error:', error);
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) return sendErrorResponse(res, 404, 'User not found');
    return sendSuccessResponse(res, 200, user);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const createUser = async (req, res) => {
  try {
    const isValid = await userService.validateUserData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid user data');

    const user = await userService.createUser(req.body);
    return sendSuccessResponse(res, 201, user);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateUser = async (req, res) => {
  try {
    const isValid = await userService.validateUserData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid user data');

    const user = await userService.updateUser(req.params.id, req.body);
    if (!user) return sendErrorResponse(res, 404, 'User not found');
    return sendSuccessResponse(res, 200, user);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await userService.deleteUser(req.params.id);
    if (!user) return sendErrorResponse(res, 404, 'User not found');
    return sendSuccessResponse(res, 200, { message: 'User deleted successfully' });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const searchUsers = async (req, res) => {
  try {
    const users = await userService.searchUsers(req.query);
    return sendSuccessResponse(res, 200, users);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getUserStats = async (req, res) => {
  try {
    const stats = await userService.getUserStats(req.params.id);
    if (!stats) return sendErrorResponse(res, 404, 'User not found');
    return sendSuccessResponse(res, 200, stats);
  } catch (error) {
    console.error('getUserStats error:', error);
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  searchUsers,
  getUserStats,
};
