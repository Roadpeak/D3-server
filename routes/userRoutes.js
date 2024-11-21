const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

// Register a new user
router.post('/register', userController.register);

// Login user
router.post('/login', userController.login);

module.exports = router;
