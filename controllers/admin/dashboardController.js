const dashboardService = require('../../services/admin/dashboardService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const getStats = async (req, res) => {
  try {
    const stats = await dashboardService.calculateStats();
    return sendSuccessResponse(res, 200, stats);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getTopStats = async (req, res) => {
  try {
    const topStats = await dashboardService.getTopStats();
    return sendSuccessResponse(res, 200, topStats);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getAllStats = async (req, res) => {
  try {
    const allStats = await dashboardService.getAllStats();
    return sendSuccessResponse(res, 200, allStats);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getRecentActivities = async (req, res) => {
  try {
    const activities = await dashboardService.getRecentActivities();
    return sendSuccessResponse(res, 200, activities);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

const getAnalytics = async (req, res) => {
  try {
    const analytics = await dashboardService.generateAnalytics();
    return sendSuccessResponse(res, 200, analytics);
  } catch (error) {
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

module.exports = {
  getStats,
  getTopStats,
  getAllStats,
  getRecentActivities,
  getAnalytics,
};