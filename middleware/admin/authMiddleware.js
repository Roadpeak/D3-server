const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/jwt');
const { unauthorized, forbidden } = require('../../utils/responses');

const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return unauthorized(res, 'No token provided');
  try {
    const decoded = await jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return unauthorized(res, 'Invalid token');
  }
};

const authorizeRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return forbidden(res, 'Insufficient permissions');
  }
  next();
};

const requireAuth = (req, res, next) => {
  if (!req.user) return unauthorized(res, 'Authentication required');
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return forbidden(res, 'Admin access required');
  next();
};

const extractUserFromToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) req.user = decoded;
      next();
    });
  } else {
    next();
  }
};

const validateTokenExpiry = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return unauthorized(res, 'No token provided');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) return unauthorized(res, 'Token expired');
    next();
  } catch (error) {
    return unauthorized(res, 'Invalid token');
  }
};

const refreshTokenMiddleware = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return unauthorized(res, 'No refresh token provided');
  try {
    const decoded = await jwt.verify(refreshToken, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return unauthorized(res, 'Invalid refresh token');
  }
};

module.exports = {
  authenticateToken,
  authorizeRole,
  requireAuth,
  requireAdmin,
  extractUserFromToken,
  validateTokenExpiry,
  refreshTokenMiddleware,
};
// Export authenticateToken as default for route compatibility
module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.authorizeRole = authorizeRole;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.extractUserFromToken = extractUserFromToken;
module.exports.validateTokenExpiry = validateTokenExpiry;
module.exports.refreshTokenMiddleware = refreshTokenMiddleware;
