const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'; // Secret key, make sure it's stored securely

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  // Get token from Authorization header (Bearer <token>)
  const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

  if (!token) {
    return res.status(403).json({ message: 'No token provided' });
  }

  // Verify the token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Attach decoded user data to the request object for future use
    req.user = decoded;
    next();
  });
}

module.exports = { verifyToken };
