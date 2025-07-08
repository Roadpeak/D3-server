const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.decode(token);
    req.user = decoded;
  } catch (err) {
    console.error('Token decode error:', err);
  }

  next();
}

function authorizeRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  authorizeRole,
};
