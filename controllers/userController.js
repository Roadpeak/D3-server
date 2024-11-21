const { check, validationResult } = require('express-validator');

// Register a new user with validation
exports.register = [
  // Validate input fields
  check('firstName').notEmpty().withMessage('First name is required'),
  check('lastName').notEmpty().withMessage('Last name is required'),
  check('email').notEmpty().isEmail().withMessage('Valid email is required'),
  check('phoneNumber').notEmpty().withMessage('Phone number is required'),
  check('password').notEmpty().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

  // Process request
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, phoneNumber, password } = req.body;
    
    try {
      // Check if the user already exists
      const existingUser = await userService.findUserByEmailOrPhone(email, phoneNumber);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email or phone number' });
      }

      // Create the user
      const user = await userService.createUser(firstName, lastName, email, phoneNumber, password);
      res.status(201).json({ message: 'User registered successfully', user });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
];
