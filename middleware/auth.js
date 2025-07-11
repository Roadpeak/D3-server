// middleware/auth.js - Unified authentication middleware
const jwt = require('jsonwebtoken');
const { User, Merchant } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Main authentication middleware - supports both Bearer tokens and cookies
 * This replaces your multiple verifyToken functions
 */
const verifyToken = async (req, res, next) => {
  try {
    let token = null;

    // Check for token in Authorization header (Bearer token)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // If no Authorization header, check for token in cookies (for browser requests)
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';');
      const tokenCookie = cookies.find(cookie => 
        cookie.trim().startsWith('access_token=')
      );
      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        message: 'Access token is required',
        errors: {}
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Try to find user first, then merchant
    let user = null;
    
    // Check if it's a user token
    if (decoded.userId) {
      user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password'] }
      });
    }
    
    // If not found as user, try as merchant
    if (!user && (decoded.id || decoded.userId)) {
      user = await Merchant.findByPk(decoded.id || decoded.userId, {
        attributes: { exclude: ['password'] }
      });
      if (user) {
        user.userType = 'merchant'; // Ensure merchant type is set
      }
    }

    if (!user) {
      return res.status(401).json({
        message: 'User not found',
        errors: {}
      });
    }

    // Check if user account is active (if you have status fields)
    if (user.status && (user.status === 'suspended' || user.status === 'deactivated')) {
      return res.status(403).json({
        message: 'Account is not active',
        errors: {}
      });
    }

    // Add user info to request object
    req.user = {
      userId: user.id,
      email: user.email,
      userType: user.userType || 'customer',
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      isEmailVerified: user.isEmailVerified?.() || !!user.emailVerifiedAt,
      isPhoneVerified: user.isPhoneVerified?.() || !!user.phoneVerifiedAt,
      role: user.role || user.userType || 'customer',
      status: user.status || 'active',
      ...decoded // Include original token data
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid token',
        errors: {}
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expired',
        errors: {}
      });
    }

    return res.status(500).json({
      message: 'Authentication error',
      errors: {}
    });
  }
};

/**
 * Optional authentication - doesn't require token but adds user if valid
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    // Check for token in Authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // Check cookies
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';');
      const tokenCookie = cookies.find(cookie => 
        cookie.trim().startsWith('access_token=')
      );
      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
      }
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    let user = null;
    if (decoded.userId) {
      user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password'] }
      });
    }
    
    if (!user && (decoded.id || decoded.userId)) {
      user = await Merchant.findByPk(decoded.id || decoded.userId, {
        attributes: { exclude: ['password'] }
      });
      if (user) {
        user.userType = 'merchant';
      }
    }

    if (user && (!user.status || user.status === 'active')) {
      req.user = {
        userId: user.id,
        email: user.email,
        userType: user.userType || 'customer',
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role || user.userType || 'customer',
        ...decoded
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
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
    
    const allowedTypes = ['customer', 'user'];
    if (!req.user.userType || allowedTypes.includes(req.user.userType)) {
      next();
    } else {
      return res.status(403).json({
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
    
    if (req.user.userType === 'merchant') {
      next();
    } else {
      return res.status(403).json({
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
    
    if (req.user.userType === 'admin' || req.user.role === 'admin') {
      next();
    } else {
      return res.status(403).json({
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
        message: 'Authentication required',
        errors: {}
      });
    }

    const userRoles = [req.user.role, req.user.userType].filter(Boolean);
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        errors: {}
      });
    }

    next();
  };
};

/**
 * API Key middleware (keeping your existing functionality)
 */
const apiKeyMiddleware = (req, res, next) => {
  const validApiKey = process.env.API_KEY;
  const apiKey = req.header('api-key');

  if (!apiKey) {
    return res.status(400).json({ 
      message: 'API key is missing',
      errors: {}
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(403).json({ 
      message: 'Forbidden: Invalid API key',
      errors: {}
    });
  }

  next();
};

/**
 * Utility functions for token generation
 */
const generateToken = (userId, expiresIn = '30d') => {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn }
  );
};

const generateMerchantToken = (merchantId, expiresIn = '30d') => {
  return jwt.sign(
    { id: merchantId, userId: merchantId }, // Include both for compatibility
    JWT_SECRET,
    { expiresIn }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

/**
 * Refresh token verification
 */
const verifyRefreshToken = (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        message: 'Refresh token is required',
        errors: {}
      });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        message: 'Invalid refresh token',
        errors: {}
      });
    }

    req.userId = decoded.userId;
    next();

  } catch (error) {
    return res.status(401).json({
      message: 'Invalid refresh token',
      errors: {}
    });
  }
};

module.exports = {
  // Main authentication functions
  verifyToken,
  optionalAuth,
  
  // Role-specific functions
  authenticateUser,
  authenticateMerchant,
  authenticateAdmin,
  requireRole,
  
  // Utility functions
  apiKeyMiddleware,
  generateToken,
  generateMerchantToken,
  generateRefreshToken,
  verifyRefreshToken,
  
  // Backwards compatibility aliases
  authenticateToken: verifyToken,
  authenticate: authenticateMerchant,
  authorizeRole: requireRole
};