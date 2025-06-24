const jwt = require('jsonwebtoken');
const { User } = require('../models/Requestservice'); // Adjust path based on your project structure

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';

/**
 * Authentication middleware to verify JWT tokens
 * Adds authenticated user to req.user
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'name', 'email', 'verified', 'role', 'status']
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
    }

    // Check if user account is active
    if (user.status === 'suspended' || user.status === 'deactivated') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Add user to request object
    req.user = user;
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
      attributes: ['id', 'name', 'email', 'verified', 'role', 'status']
    });

    req.user = user && user.status === 'active' ? user : null;
    next();

  } catch (error) {
    // If token is invalid, just continue without user
    req.user = null;
    next();
  }
};

/**
 * Role-based authorization middleware
 * Use after authenticateToken to check user roles
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    const hasRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Utility function to generate JWT tokens
 * Use this in your login/register routes
 */
const generateToken = (userId, expiresIn = '7d') => {
  return jwt.sign(
    { userId },
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
const verifyRefreshToken = (req, res, next) => {
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

    req.userId = decoded.userId;
    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};

// Default export for backwards compatibility
module.exports.default = authenticateToken;