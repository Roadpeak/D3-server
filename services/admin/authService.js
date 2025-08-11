const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = process.env.JWT_SECRET;
const nodemailer = require('nodemailer');



const authenticateUser = async (email, password) => {
  const user = await User.findByEmail(email);
  if (!user) return null;
  const isMatch = await bcrypt.compare(password, user.password);
  return isMatch ? user : null;
};

const generateJWT = (user) => {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
};

const validateToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) reject(err);
      resolve(decoded);
    });
  });
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

const generateResetToken = () => {
  return require('crypto').randomBytes(32).toString('hex');
};

const sendVerificationEmail = async (user) => {
  // Email verification implementation
  console.log('Email verification for:', user.email);
};

const sendResetPasswordEmail = async (user, resetToken) => {
  // Password reset email implementation  
  console.log('Password reset email for:', user.email);
};

module.exports = {
  authenticateUser,
  generateJWT,
  validateToken,
  hashPassword,
  comparePassword,
  generateResetToken,
  sendVerificationEmail,
  sendResetPasswordEmail
};
