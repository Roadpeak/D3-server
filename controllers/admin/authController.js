const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/index').sequelize.models.User;
const authService = require('../../services/admin/authService');
const { sendErrorResponse, sendSuccessResponse } = require('../../utils/responses');

const login = async (req, res) => {
  try {
    console.log('🔍 Login attempt for:', req.body.email);
    
    const { email, password } = req.body;
    
    console.log('🔍 Finding user...');
    const user = await User.findByEmail(email);
    
    if (!user) {
      console.log('❌ User not found');
      return sendErrorResponse(res, 401, 'Invalid credentials');
    }
    
    console.log('✅ User found:', user.id);
    
    console.log('🔍 Comparing password...');
    const isMatch = await authService.comparePassword(password, user.password);
    
    if (!isMatch) {
      console.log('❌ Password mismatch');
      return sendErrorResponse(res, 401, 'Invalid credentials');
    }
    
    console.log('✅ Password matches');
    console.log('🔍 Generating JWT...');
    
    const token = authService.generateJWT(user);
    
    console.log('✅ JWT generated successfully');
    
    return sendSuccessResponse(res, 200, { token, user: user.toJSON() });
  } catch (error) {
    console.log('💥 Error in login:', error.message);
    console.log('💥 Stack:', error.stack);
    return sendErrorResponse(res, 500, 'Server error', error.message);
  }
};

// ... rest of your methods (register, logout, etc.)
const register = async (req, res) => {
  // Keep your existing register function
  return sendErrorResponse(res, 501, 'Not implemented');
};

const logout = async (req, res) => {
  return sendSuccessResponse(res, 200, { message: 'Logged out successfully' });
};

const refreshToken = async (req, res) => {
  return sendErrorResponse(res, 501, 'Not implemented');
};

const forgotPassword = async (req, res) => {
  return sendErrorResponse(res, 501, 'Not implemented');
};

const resetPassword = async (req, res) => {
  return sendErrorResponse(res, 501, 'Not implemented');
};

const verifyEmail = async (req, res) => {
  return sendErrorResponse(res, 501, 'Not implemented');
};

module.exports = {
  login,
  register,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
};
