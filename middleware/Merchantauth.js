// middleware/Merchantauth.js - Updated with better error handling
const jwt = require('jsonwebtoken');
const { Merchant } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to authenticate merchants
const authenticateMerchant = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    console.log('🔐 Authenticating merchant...', {
      hasAuthHeader: !!authHeader,
      headerFormat: authHeader ? authHeader.substring(0, 10) + '...' : 'None'
    });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No valid authorization header found');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.',
        code: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token verified for merchant ID:', decoded.id);
    } catch (error) {
      console.error('❌ Token verification failed:', error.message);
      
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
      console.error('❌ Token type mismatch. Expected: merchant, Got:', decoded.type);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Merchant access required.',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    // Get merchant from database
    const merchant = await Merchant.findOne({
      where: { id: decoded.id },
      attributes: { exclude: ['password', 'passwordResetOtp', 'passwordResetExpires'] }
    });

    if (!merchant) {
      console.error('❌ Merchant not found in database for ID:', decoded.id);
      return res.status(401).json({
        success: false,
        message: 'Merchant not found. Please log in again.',
        code: 'MERCHANT_NOT_FOUND'
      });
    }

    // Check if password was changed after token was issued
    if (merchant.passwordChangedAt && 
        new Date(decoded.iat * 1000) < merchant.passwordChangedAt) {
      console.error('❌ Password changed after token issued');
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

    console.log('✅ Merchant authenticated successfully:', merchant.email);
    next();
  } catch (error) {
    console.error('💥 Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to server error.',
      code: 'AUTH_SERVER_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Middleware to authenticate admins
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.',
        code: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.substring(7);

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.',
        code: 'INVALID_TOKEN'
      });
    }

    if (decoded.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin access required.',
        code: 'ADMIN_ACCESS_REQUIRED'
      });
    }

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
      message: 'Authentication failed due to server error.',
      code: 'AUTH_SERVER_ERROR'
    });
  }
};

// Rate limiting middleware
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
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: timeLeft
      });
    }

    userAttempts.count++;
    next();
  };
};

module.exports = {
  authenticateMerchant,
  authenticateAdmin,
  authRateLimit
};