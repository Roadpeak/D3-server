const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const nodemailer = require('nodemailer');
const config = require('../../config/config');

const sendWelcomeEmail = async (user) => {
  const transporter = nodemailer.createTransport(config.email);
  const mailOptions = {
    from: config.email.auth.user,
    to: user.email,
    subject: 'Welcome to D3 Admin',
    text: `Hello ${user.name}, welcome to D3 Admin! Please verify your email.`,
  };
  await transporter.sendMail(mailOptions);
};

const sendResetPasswordEmail = async (user, token) => {
  const transporter = nodemailer.createTransport(config.email);
  const mailOptions = {
    from: config.email.auth.user,
    to: user.email,
    subject: 'Reset Your Password',
    text: `Click to reset your password: ${process.env.APP_URL}/api/auth/reset-password?token=${token}`,
  };
  await transporter.sendMail(mailOptions);
};

const sendNotificationEmail = async (user, message) => {
  const transporter = nodemailer.createTransport(config.email);
  const mailOptions = {
    from: config.email.auth.user,
    to: user.email,
    subject: 'D3 Admin Notification',
    text: message,
  };
  await transporter.sendMail(mailOptions);
};

const sendReceiptEmail = async (user, receipt) => {
  const transporter = nodemailer.createTransport(config.email);
  const mailOptions = {
    from: config.email.auth.user,
    to: user.email,
    subject: 'Payment Receipt',
    text: `Payment ID: ${receipt.id}\nAmount: ${receipt.amount}\nStatus: ${receipt.status}\nDate: ${receipt.date}`,
  };
  await transporter.sendMail(mailOptions);
};

const validateEmailTemplate = async (template) => {
  return template && template.subject && template.text;
};

const trackEmailDelivery = async () => {
  // Placeholder for email tracking (e.g., via third-party service)
  return { status: 'sent' };
};

module.exports = {
  sendWelcomeEmail,
  sendResetPasswordEmail,
  sendNotificationEmail,
  sendReceiptEmail,
  validateEmailTemplate,
  trackEmailDelivery,
};