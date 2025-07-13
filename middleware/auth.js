// middleware/auth.js - Complete unified authentication middleware
const jwt = require('jsonwebtoken');
const { User, Merchant } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Main token verification function
 */
const verifyToken = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware called for:', req.path);
    
    // Get token from header
    const authHeader = req.headers.authorization;
    console.log('📋 Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid auth header found');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        errors: {}
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('🎫 Token extracted, length:', token.length);

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token verified successfully');
      console.log('📄 Decoded token:', JSON.stringify(decoded, null, 2));
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please log in again.',
          code: 'TOKEN_EXPIRED'
        });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please log in again.',
          code: 'INVALID_TOKEN'
        });
      } else {
        return res.status(401).json({
          success: false,
          message: 'Token verification failed. Please log in again.',
          code: 'TOKEN_VERIFICATION_FAILED'
        });
      }
    }

    // FIXED: Correct user lookup logic with proper priority
    let user = null;
    let userType = null;

    console.log('🔍 Looking for user with token data...');

    // PRIORITY 1: Check if it's a user token (has userId AND type === 'user')
    if (decoded.userId && decoded.type === 'user') {
      console.log('👤 Detected user token with userId:', decoded.userId);
      try {
        user = await User.findByPk(decoded.userId, {
          attributes: { exclude: ['password'] }
        });
        userType = 'user';
        console.log('👤 User found:', user ? `${user.firstName} ${user.lastName}` : 'Not found');
      } catch (userError) {
        console.log('❌ Error finding user:', userError.message);
      }
    }
    // PRIORITY 2: Check if it's a merchant token (has type === 'merchant')
    else if (decoded.type === 'merchant' && decoded.id) {
      console.log('🏪 Detected merchant token with id:', decoded.id);
      try {
        user = await Merchant.findOne({
          where: { id: decoded.id },
          attributes: { exclude: ['password', 'passwordResetOtp', 'passwordResetExpires'] }
        });
        userType = 'merchant';
        console.log('🏪 Merchant found:', user ? `${user.firstName} ${user.lastName}` : 'Not found');
      } catch (merchantError) {
        console.log('❌ Error finding merchant:', merchantError.message);
      }
    }
    // FALLBACK: Old tokens without type field
    else if (decoded.userId) {
      console.log('🔄 Fallback: user token without type field');
      try {
        user = await User.findByPk(decoded.userId, {
          attributes: { exclude: ['password'] }
        });
        userType = 'user';
        console.log('👤 User found in fallback');
      } catch (userError) {
        console.log('❌ Error in user fallback:', userError.message);
      }
    }
    else if (decoded.id) {
      console.log('🔄 Fallback: merchant token without type field');
      try {
        user = await Merchant.findOne({
          where: { id: decoded.id },
          attributes: { exclude: ['password', 'passwordResetOtp', 'passwordResetExpires'] }
        });
        userType = 'merchant';
        console.log('🏪 Merchant found in fallback');
      } catch (merchantError) {
        console.log('❌ Error in merchant fallback:', merchantError.message);
      }
    }
    else {
      console.log('❌ No valid user identifier found in token');
    }

    if (!user) {
      console.log('❌ No user found for token');
      return res.status(404).json({
        success: false,
        message: 'User not found. Please log in again.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if account is active
    if (user.status && (user.status === 'suspended' || user.status === 'deactivated')) {
      console.log('❌ User account not active:', user.status);
      return res.status(403).json({
        success: false,
        message: 'Account is not active.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Add user info to request object
    req.user = {
      id: user.id,
      userId: user.id, // IMPORTANT: Always set userId for backward compatibility
      email: user.email || user.email_address,
      userType: userType,
      type: userType,
      firstName: user.firstName || user.first_name,
      lastName: user.lastName || user.last_name,
      phoneNumber: user.phoneNumber || user.phone_number,
      role: userType,
      status: user.status || 'active',
      userData: user,
      ...decoded // Include original token data
    };

    console.log('✅ req.user set successfully');
    console.log('📋 req.user summary:', {
      id: req.user.id,
      userId: req.user.userId,
      email: req.user.email,
      userType: req.user.userType
    });

    next();
  } catch (error) {
    console.error('💥 Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to server error.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      let user = null;
      let userType = null;

      // Same logic as verifyToken but don't fail on errors
      if (decoded.userId && decoded.type === 'user') {
        user = await User.findByPk(decoded.userId, {
          attributes: { exclude: ['password'] }
        });
        userType = 'user';
      } else if (decoded.type === 'merchant' && decoded.id) {
        user = await Merchant.findOne({
          where: { id: decoded.id },
          attributes: { exclude: ['password', 'passwordResetOtp', 'passwordResetExpires'] }
        });
        userType = 'merchant';
      } else if (decoded.userId) {
        user = await User.findByPk(decoded.userId, {
          attributes: { exclude: ['password'] }
        });
        userType = 'user';
      } else if (decoded.id) {
        user = await Merchant.findOne({
          where: { id: decoded.id },
          attributes: { exclude: ['password', 'passwordResetOtp', 'passwordResetExpires'] }
        });
        userType = 'merchant';
      }

      if (user && (!user.status || user.status === 'active')) {
        req.user = {
          id: user.id,
          userId: user.id,
          email: user.email || user.email_address,
          userType: userType,
          type: userType,
          firstName: user.firstName || user.first_name,
          lastName: user.lastName || user.last_name,
          role: userType,
          userData: user,
          ...decoded
        };
      } else {
        req.user = null;
      }
    } catch (error) {
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};

/**
 * User-specific authentication
 */
const authenticateUser = (req, res, next) => {
  verifyToken(req, res, (err) => {
    if (err) return next(err);
    
    if (req.user && (req.user.userType === 'user' || req.user.type === 'user')) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. User role required.',
        errors: {}
      });
    }
  });
};

/**
 * Merchant-specific authentication
 */
const authenticateMerchant = (req, res, next) => {
  verifyToken(req, res, (err) => {
    if (err) return next(err);
    
    if (req.user && (req.user.userType === 'merchant' || req.user.type === 'merchant')) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Merchant role required.',
        errors: {}
      });
    }
  });
};

/**
 * Admin-specific authentication
 */
const authenticateAdmin = (req, res, next) => {
  verifyToken(req, res, (err) => {
    if (err) return next(err);
    
    if (req.user && (req.user.userType === 'admin' || req.user.role === 'admin')) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.',
        errors: {}
      });
    }
  });
};

/**
 * Role-based authorization middleware
 */
const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        errors: {}
      });
    }

    const userRoles = [req.user.role, req.user.userType, req.user.type].filter(Boolean);
    const hasRole = allowedRoles.some(role => 
      userRoles.some(userRole => 
        userRole.toLowerCase() === role.toLowerCase()
      )
    );

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        errors: {}
      });
    }

    next();
  };
};

/**
 * Alias for backward compatibility
 */
const authorizeRole = requireRole;

/**
 * Check store ownership
 */
const checkStoreOwnership = async (req, res, next) => {
  try {
    const storeId = req.params.id || req.params.storeId;
    
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required.'
      });
    }

    if (!req.user || req.user.userType !== 'merchant') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const { Store } = require('../models');
    const store = await Store.findOne({
      where: { 
        id: storeId,
        merchant_id: req.user.id 
      }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or access denied.'
      });
    }

    req.store = store;
    next();
  } catch (error) {
    console.error('Store ownership check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking store ownership.'
    });
  }
};

/**
 * Token generation utilities
 */
const generateMerchantToken = (merchantId, expiresIn = '30d') => {
  return jwt.sign(
    { 
      id: merchantId,
      type: 'merchant'
    },
    JWT_SECRET,
    { expiresIn }
  );
};

const generateUserToken = (userId, expiresIn = '30d') => {
  return jwt.sign(
    { 
      userId: userId,
      type: 'user'
    },
    JWT_SECRET,
    { expiresIn }
  );
};

module.exports = {
  // Main functions
  verifyToken,
  optionalAuth,
  
  // Role-specific authentication
  authenticateUser,
  authenticateMerchant,
  authenticateAdmin,
  
  // Role-based authorization
  requireRole,
  authorizeRole, // Alias for backward compatibility
  
  // Utility functions
  checkStoreOwnership,
  generateMerchantToken,
  generateUserToken,
  
  // Backward compatibility
  authenticate: authenticateMerchant
};