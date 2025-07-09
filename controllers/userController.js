const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const fs = require('fs');
const { sendEmail } = require('../utils/emailUtil');
const userService = require('../services/userService');

const JWT_SECRET = process.env.JWT_SECRET;

// REGISTER
exports.register = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phoneNumber, password,
      first_name, last_name, phone, password_confirmation
    } = req.body;

    const userData = {
      firstName: firstName || first_name,
      lastName: lastName || last_name,
      email,
      phoneNumber: phoneNumber || phone,
      password,
      passwordConfirmation: password_confirmation,
    };

    const errors = {};

    // Basic validations
    if (!userData.firstName?.trim()) errors.first_name = ['First name is required'];
    if (!userData.lastName?.trim()) errors.last_name = ['Last name is required'];
    if (!userData.email?.trim()) {
      errors.email = ['Email is required'];
    } else if (!/\S+@\S+\.\S+/.test(userData.email)) {
      errors.email = ['Please enter a valid email address'];
    }
    if (!userData.phoneNumber?.trim()) errors.phone = ['Phone number is required'];
    if (!userData.password) {
      errors.password = ['Password is required'];
    } else if (userData.password.length < 8) {
      errors.password = ['Password must be at least 8 characters long'];
    }
    if (userData.passwordConfirmation && userData.password !== userData.passwordConfirmation) {
      errors.password_confirmation = ['Passwords do not match'];
    }

    // Duplicate check
    const [existingEmail, existingPhone] = await Promise.all([
      userService.findUserByEmail(userData.email),
      userService.findUserByPhone(userData.phoneNumber),
    ]);

    if (existingEmail) errors.email = ['User with this email already exists'];
    if (existingPhone) errors.phone = ['User with this phone number already exists'];

    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
    }

    // Create user
    const newUser = await userService.createUser(
      userData.firstName,
      userData.lastName,
      userData.email,
      userData.phoneNumber,
      userData.password
    );

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '3650000d' }
    );

    // Send welcome email (non-blocking)
    try {
      const template = fs.readFileSync('./templates/welcomeUser.ejs', 'utf8');
      const emailContent = ejs.render(template, {
        userName: newUser.firstName,
        marketplaceLink: 'https://discoun3ree.com/marketplace',
      });

      await sendEmail(
        newUser.email,
        `Welcome to D3, ${newUser.firstName}!`,
        '',
        emailContent
      );
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }

    return res.status(201).json({
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        joined: newUser.createdAt,
        updated: newUser.updatedAt,
      },
      access_token: token,
    });
  } catch (err) {
    console.error('Registration error:', err);

    if (err.name === 'SequelizeValidationError') {
      const errors = {};
      const mapField = { firstName: 'first_name', lastName: 'last_name', phoneNumber: 'phone' };

      err.errors.forEach(error => {
        const field = mapField[error.path] || error.path;
        if (!errors[field]) errors[field] = [];
        errors[field].push(error.message);
      });

      return res.status(400).json(errors);
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
      const errors = {};
      err.errors.forEach(error => {
        if (error.path === 'email') errors.email = ['User with this email already exists'];
        if (error.path === 'phoneNumber') errors.phone = ['User with this phone number already exists'];
      });
      return res.status(400).json(errors);
    }

    return res.status(500).json({
      general: ['An error occurred during registration. Please try again.'],
    });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const errors = {};

    if (!email) errors.email = ['Email is required'];
    if (!password) errors.password = ['Password is required'];
    if (Object.keys(errors).length > 0) return res.status(400).json(errors);

    const user = await userService.findUserByEmail(email);
    if (!user) return res.status(404).json({ email: ['User not found'] });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ password: ['Invalid password'] });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '3650000d' }
    );

    return res.status(200).json({
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      email_address: user.email,
      phone_number: user.phoneNumber,
      joined: user.createdAt,
      updated: user.updatedAt,
      access_token: token,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      general: ['An error occurred during login. Please try again.'],
    });
  }
};
