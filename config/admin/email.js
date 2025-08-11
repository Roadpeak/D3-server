const nodemailer = require('nodemailer');

const configureNodemailer = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const setupSMTPConfig = () => {
  return {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  };
};

const setupEmailTemplates = () => {
  return {
    welcome: {
      subject: 'Welcome to D3 Admin',
      text: 'Hello {name}, welcome to D3 Admin! Please verify your email.',
    },
    resetPassword: {
      subject: 'Reset Your Password',
      text: 'Click to reset your password: {url}',
    },
    receipt: {
      subject: 'Payment Receipt',
      text: 'Payment ID: {id}\nAmount: {amount}\nStatus: {status}\nDate: {date}',
    },
  };
};

const validateEmailConfig = () => {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS);
};

const testEmailConnection = async () => {
  const transporter = configureNodemailer();
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email connection error:', error);
    return false;
  }
};

const getEmailTemplate = (type) => {
  return setupEmailTemplates()[type] || null;
};

const setupEmailQueue = () => {
  // Placeholder for email queue (e.g., using Bull or Redis)
  return null;
};

const configureEmailRetry = () => {
  // Placeholder for email retry logic
  return { maxRetries: 3, retryDelay: 5000 };
};

module.exports = {
  configureNodemailer,
  setupSMTPConfig,
  setupEmailTemplates,
  validateEmailConfig,
  testEmailConnection,
  getEmailTemplate,
  setupEmailQueue,
  configureEmailRetry,
};