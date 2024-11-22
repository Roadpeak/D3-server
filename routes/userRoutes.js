const express = require('express');
const { register, login } = require('../controllers/userController');
const { verifyToken } = require('../milddlewares/auth'); // Import the middleware to verify JWT
const router = express.Router();

// Register new user
router.post('/register', register);

// Login user
router.post('/login', login);

router.get('/protected', verifyToken, (req, res) => {
  res.status(200).json({
    message: 'This is a protected route.',
    user: req.user // The user data is added to the request object by the verifyToken middleware
  });
});

module.exports = router;
