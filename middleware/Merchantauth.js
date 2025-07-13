const jwt = require('jsonwebtoken');
const { Merchant } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to authenticate merchants
const authenticateMerchant = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
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

    // Check if token is for a merchant
    if (decoded.type !== 'merchant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Merchant access required.'
      });
    }

    // Get merchant from database
    const merchant = await Merchant.findOne({
      where: { id: decoded.id },
      attributes: { exclude: ['password', 'passwordResetOtp', 'passwordResetExpires'] }
    });

    if (!merchant) {
      return res.status(401).json({
        success: false,
        message: 'Merchant not found. Please log in again.',
        code: 'MERCHANT_NOT_FOUND'
      });
    }

    // Check if password was changed after token was issued
    if (merchant.passwordChangedAt && 
        new Date(decoded.iat * 1000) < merchant.passwordChangedAt) {
      return res.status(401).json({
        success: false,
        message: 'Password was changed. Please log in again.',
        code: 'PASSWORD_CHANGED'
      });
    }

    // Add merchant info to request object
    req.user = {
      id: merchant.id,
      email: merchant.email,
      type: 'merchant',
      merchantData: merchant
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to server error.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Middleware to authenticate admins
const authenticateAdmin = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.substring(7);

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.'
      });
    }

    // Check if token is for an admin
    if (decoded.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin access required.'
      });
    }

    // Add admin info to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      type: 'admin'
    };

    next();
  } catch (error) {
    console.error('Admin authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to server error.'
    });
  }
};

// Middleware for optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.type === 'merchant') {
        const merchant = await Merchant.findOne({
          where: { id: decoded.id },
          attributes: { exclude: ['password', 'passwordResetOtp', 'passwordResetExpires'] }
        });

        if (merchant) {
          req.user = {
            id: merchant.id,
            email: merchant.email,
            type: 'merchant',
            merchantData: merchant
          };
        } else {
          req.user = null;
        }
      } else {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          type: decoded.type
        };
      }
    } catch (error) {
      // Token is invalid, but we don't fail - just continue without auth
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};

// Middleware to check if merchant owns the resource
const checkMerchantOwnership = (resourceIdParam = 'merchantId') => {
  return (req, res, next) => {
    const resourceId = req.params[resourceIdParam];
    
    if (!req.user || req.user.type !== 'merchant') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (req.user.id !== resourceId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own resources.'
      });
    }

    next();
  };
};

// Middleware to check if merchant owns a store
const checkStoreOwnership = async (req, res, next) => {
  try {
    const storeId = req.params.storeId || req.body.storeId;
    
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required.'
      });
    }

    if (!req.user || req.user.type !== 'merchant') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Check if the store belongs to the authenticated merchant
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

    // Add store to request for further use
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

// Rate limiting middleware for auth endpoints
const authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.ip + req.path;
    const now = Date.now();
    
    // Clean old entries
    for (const [k, v] of attempts.entries()) {
      if (now - v.firstAttempt > windowMs) {
        attempts.delete(k);
      }
    }

    const userAttempts = attempts.get(key);
    
    if (!userAttempts) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    if (userAttempts.count >= maxAttempts) {
      const timeLeft = Math.ceil((userAttempts.firstAttempt + windowMs - now) / 1000 / 60);
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Please try again in ${timeLeft} minutes.`,
        retryAfter: timeLeft
      });
    }

    userAttempts.count++;
    next();
  };
};

// Middleware to validate request body
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    next();
  };
};

module.exports = {
  authenticateMerchant,
  authenticateAdmin,
  optionalAuth,
  checkMerchantOwnership,
  checkStoreOwnership,
  authRateLimit,
  validateRequest
};