const Account = require('../../models/index').sequelize.models.Account;
const accountService = require('../../services/admin/accountService');
const uploadService = require('../../services/admin/uploadService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming auth middleware sets req.user
    const profile = await accountService.getProfile(userId);
    if (!profile) return sendErrorResponse(res, 404, 'Profile not found');
    return sendSuccessResponse(res, 200, profile);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const isValid = await accountService.validateAccountData(req.body);
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid profile data');

    const profile = await accountService.updateProfile(userId, req.body);
    if (!profile) return sendErrorResponse(res, 404, 'Profile not found');
    return sendSuccessResponse(res, 200, profile);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;
    const isValid = await accountService.validateAccountData({ password: newPassword });
    if (!isValid) return sendErrorResponse(res, 400, 'Invalid password data');

    const success = await accountService.changePassword(userId, oldPassword, newPassword);
    if (!success) return sendErrorResponse(res, 400, 'Invalid old password');
    return sendSuccessResponse(res, 200, { message: 'Password changed successfully' });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;
    if (!file) return sendErrorResponse(res, 400, 'No file uploaded');

    const avatarUrl = await uploadService.uploadFile(file);
    const profile = await accountService.updateProfile(userId, { avatar: avatarUrl });
    if (!profile) return sendErrorResponse(res, 404, 'Profile not found');
    return sendSuccessResponse(res, 200, { message: 'Avatar uploaded successfully', avatar: avatarUrl });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await accountService.getSettings(userId);
    if (!settings) return sendErrorResponse(res, 404, 'Settings not found');
    return sendSuccessResponse(res, 200, settings);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await accountService.updateSettings(userId, req.body);
    if (!settings) return sendErrorResponse(res, 404, 'Settings not found');
    return sendSuccessResponse(res, 200, settings);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const success = await accountService.deactivateAccount(userId);
    if (!success) return sendErrorResponse(res, 404, 'Account not found');
    return sendSuccessResponse(res, 200, { message: 'Account deleted successfully' });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  getSettings,
  updateSettings,
  deleteAccount,
};