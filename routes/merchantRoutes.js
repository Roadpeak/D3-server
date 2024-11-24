const express = require('express');
const { register, login, requestPasswordReset, resetPassword } = require('../controllers/merchantController');

const router = express.Router();

// Register new merchant
router.post('/merchants/register', register);

// Login merchant
router.post('/merchants/login', login);

// Request password reset (Send OTP)
router.post('/merchants/request-password-reset', requestPasswordReset);

// Reset password with OTP
router.post('/merchants/reset-password', resetPassword);

module.exports = router;
