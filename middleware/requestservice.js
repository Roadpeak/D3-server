const jwt = require('jsonwebtoken');
const { User } = require('../models'); // Adjust path based on your project structure

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';

/**
 * Authentication middleware to verify JWT tokens
 * Adds authenticated user to req.user
 * Works with your actual User model schema
 */
const authenticateToken = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware called for:', req.path);
    
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    console.log('📋 Auth header:', authHeader ? 'Present' : 'Missing');
    
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    console.log('🎫 Token extracted, length:', token.length);

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token verified successfully');
    console.log('📄 Decoded token:', {
      userId: decoded.userId,
      email: decoded.email,
      type: decoded.type,
      iat: decoded.iat,
      exp: decoded.exp
    });

    console.log('🔍 Looking for user with token data...');
    console.log('👤 Detected user token with userId:', decoded.userId);
    
    // Get user from database using the scope that includes password for comparison
    const user = await User.scope('withPassword').findByPk(decoded.userId, {
      attributes: [
        'id', 'firstName', 'lastName', 'email', 'phoneNumber', 
        'userType', 'isActive', 'avatar', 'emailVerifiedAt', 'phoneVerifiedAt',
        'lastLoginAt', 'isOnline', 'chatNotifications', 'emailNotifications',
        'pushNotifications', 'createdAt'
      ]
    });

    if (!user) {
      console.log('❌ User not found with ID:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
    }

    console.log('👤 User found:', `${user.firstName} ${user.lastName}`);

    // Check if user account is active
    if (!user.isActive) {
      console.log('⚠️ User account is not active');
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Update last active time and online status (optional - can be done in background)
    if (process.env.UPDATE_LAST_ACTIVE === 'true') {
      user.update({ 
        lastActiveAt: new Date(),
        isOnline: true 
      }).catch(err => {
        console.warn('Failed to update lastActiveAt:', err.message);
      });
    }

    // Add user to request object with complete user data
    req.user = {
      id: user.id,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phoneNumber: user.phoneNumber,
      userType: user.userType, // 'customer', 'merchant', 'admin'
      role: user.userType, // Alias for compatibility
      isActive: user.isActive,
      status: user.isActive ? 'active' : 'inactive', // Alias for compatibility
      avatar: user.avatar,
      verified: !!(user.emailVerifiedAt || user.phoneVerifiedAt), // True if either is verified
      emailVerified: !!user.emailVerifiedAt,
      phoneVerified: !!user.phoneVerifiedAt,
      isOnline: user.isOnline,
      chatNotifications: user.chatNotifications,
      emailNotifications: user.emailNotifications,
      pushNotifications: user.pushNotifications,
      createdAt: user.createdAt,
      userToken: decoded.type || 'user'
    };

    console.log('✅ req.user set successfully');
    console.log('📋 req.user summary:', {
      id: req.user.id,
      email: req.user.email,
      userType: req.user.userType,
      verified: req.user.verified,
      isActive: req.user.isActive
    });

    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }

    // Handle database errors specifically
    if (error.name === 'SequelizeDatabaseError') {
      console.error('Database error in auth middleware:', {
        message: error.message,
        sql: error.sql,
        original: error.original?.sqlMessage
      });
      
      return res.status(500).json({
        success: false,
        message: 'Database authentication error'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user to req.user if token is valid, but doesn't require authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findByPk(decoded.userId, {
      attributes: [
        'id', 'firstName', 'lastName', 'email', 'phoneNumber', 
        'userType', 'isActive', 'avatar', 'emailVerifiedAt', 'phoneVerifiedAt',
        'isOnline'
      ]
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phoneNumber: user.phoneNumber,
        userType: user.userType,
        role: user.userType, // Alias for compatibility
        isActive: user.isActive,
        status: 'active',
        avatar: user.avatar,
        verified: !!(user.emailVerifiedAt || user.phoneVerifiedAt),
        emailVerified: !!user.emailVerifiedAt,
        phoneVerified: !!user.phoneVerifiedAt,
        isOnline: user.isOnline,
        userToken: decoded.type || 'user'
      };
    } else {
      req.user = null;
    }

    next();

  } catch (error) {
    // If token is invalid, just continue without user
    console.warn('Optional auth failed:', error.message);
    req.user = null;
    next();
  }
};

/**
 * Role-based authorization middleware (using userType)
 * Use after authenticateToken to check user types
 */
const requireUserType = (types) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userTypes = Array.isArray(types) ? types : [types];
    const hasPermission = userTypes.includes(req.user.userType);

    if (!hasPermission) {
      console.log('🚫 Access denied - insufficient permissions:', {
        userType: req.user.userType,
        requiredTypes: userTypes,
        userId: req.user.id
      });
      return res.status(403).json({
        success: false,
        message: `Access denied. Required user type: ${userTypes.join(', ')}`
      });
    }

    console.log('✅ User type check passed:', { userType: req.user.userType, requiredTypes: userTypes });
    next();
  };
};

/**
 * Backward compatibility alias
 */
const requireRole = requireUserType;

/**
 * Middleware to check if user is verified (email OR phone)
 * Use after authenticateToken for endpoints that require verified users
 */
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.verified) {
    return res.status(403).json({
      success: false,
      message: 'Account verification required. Please verify your email or phone number.'
    });
  }

  next();
};

/**
 * Middleware to check if user has verified email specifically
 */
const requireEmailVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required.'
    });
  }

  next();
};

/**
 * Middleware to check if user has verified phone specifically
 */
const requirePhoneVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.phoneVerified) {
    return res.status(403).json({
      success: false,
      message: 'Phone verification required.'
    });
  }

  next();
};

/**
 * Utility function to generate JWT tokens
 * Use this in your login/register routes
 */
const generateToken = (userId, email, userType = 'customer', expiresIn = '7d') => {
  return jwt.sign(
    { 
      userId, 
      email, 
      type: userType,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Utility function to generate refresh tokens
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

/**
 * Middleware to verify refresh tokens
 */
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Verify user still exists and is active
    const user = await User.findByPk(decoded.userId, {
      attributes: [
        'id', 'firstName', 'lastName', 'email', 'phoneNumber', 
        'userType', 'isActive', 'emailVerifiedAt', 'phoneVerifiedAt'
      ]
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    req.userId = decoded.userId;
    req.user = {
      id: user.id,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      userType: user.userType,
      role: user.userType,
      isActive: user.isActive,
      verified: !!(user.emailVerifiedAt || user.phoneVerifiedAt),
      emailVerified: !!user.emailVerifiedAt,
      phoneVerified: !!user.phoneVerifiedAt
    };
    
    next();

  } catch (error) {
    console.error('Refresh token verification error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

/**
 * Debug middleware to log authentication state
 * Use in development only
 */
const debugAuth = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Auth Debug:', {
      path: req.path,
      method: req.method,
      hasAuthHeader: !!req.headers['authorization'],
      hasUser: !!req.user,
      userId: req.user?.id,
      userEmail: req.user?.email,
      userType: req.user?.userType,
      verified: req.user?.verified,
      isActive: req.user?.isActive
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireUserType,
  requireRole, // Alias for backward compatibility
  requireVerified,
  requireEmailVerified,
  requirePhoneVerified,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  debugAuth
};

// Default export for backwards compatibility
module.exports.default = authenticateToken;