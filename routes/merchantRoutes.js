const express = require('express');
const { register, login, requestPasswordReset, resetPassword } = require('../controllers/merchantController');

const router = express.Router();

// Register new merchant
router.post('/register', register);

// Login merchant
router.post('/login', login);

// Request password reset (Send OTP)
router.post('/request-password-reset', requestPasswordReset);

// Reset password with OTP
router.post('/reset-password', resetPassword);

module.exports = router;
