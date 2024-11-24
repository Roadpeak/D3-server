const { User } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const fs = require('fs');
const { sendEmail } = require('../utils/emailUtil');

const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create new user
    const newUser = await User.create({ firstName, lastName, email, phoneNumber, password });

    // Prepare user data for the response
    const user = {
      id: newUser.id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      phoneNumber: newUser.phoneNumber,
      joined: newUser.createdAt,
      updated: newUser.updatedAt,
    };

    // Render the welcome email template using EJS
    const template = fs.readFileSync('./templates/welcomeUser.ejs', 'utf8');
    const emailContent = ejs.render(template, {
      userName: newUser.firstName,
      marketplaceLink: 'https://discoun3ree.com/marketplace',
    });

    // Send the welcome email
    await sendEmail(
      newUser.email, // recipient email
      `Welcome to D3, ${newUser.firstName}!`, // email subject
      '', // plain text content (optional)
      emailContent // html content
    );

    // Respond with user data
    return res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error registering user' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '365d' });

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
    console.error(err);
    return res.status(500).json({ message: 'Error logging in' });
  }
};

