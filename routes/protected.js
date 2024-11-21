const express = require('express');
const { verifyToken } = require('../middleware/auth'); // Import the middleware
const router = express.Router();

// Example protected route that requires authentication
router.get('/protected', verifyToken, (req, res) => {
  // The req.user object will contain the decoded user data (e.g., from JWT)
  res.status(200).json({ message: 'You have access to this protected route', user: req.user });
});

module.exports = router;
