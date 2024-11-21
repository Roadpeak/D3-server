const express = require('express');
const { register, login } = require('../controllers/merchantController');

const router = express.Router();

// Register new merchant
router.post('/register', register);

// Login merchant
router.post('/login', login);

module.exports = router;
