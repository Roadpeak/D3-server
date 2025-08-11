const User = require('../../models/index').sequelize.models.User;
const userService = require('../../services/admin/userService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    return sendSuccessResponse(res, 200, users);
  } catch (error) {
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
