const { body, param, validationResult } = require('express-validator');

// Validation middleware to check results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('🚨 Payment validation failed:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().reduce((acc, error) => {
        acc[error.path] = error.msg;
        return acc;
      }, {})
    });
  }
  next();
};

// M-Pesa STK Push Validation
const validateStkPush = [
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^254\d{9}$/).withMessage('Phone number must be in format 254XXXXXXXXX'),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 1, max: 300000 }).withMessage('Amount must be between 1 and 300,000 KES')
    .toFloat(),

  body('accountReference')
    .trim()
    .notEmpty().withMessage('Account reference is required')
    .isLength({ min: 1, max: 50 }).withMessage('Account reference must be 1-50 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('Account reference contains invalid characters'),

  body('transactionDesc')
    .trim()
    .optional()
    .isLength({ max: 100 }).withMessage('Transaction description too long')
    .matches(/^[a-zA-Z0-9\s\-_.,]+$/).withMessage('Transaction description contains invalid characters'),

  validate
];

// Payment Status Check Validation
const validatePaymentStatusCheck = [
  param('transactionId')
    .trim()
    .notEmpty().withMessage('Transaction ID is required')
    .isLength({ min: 5, max: 50 }).withMessage('Invalid transaction ID')
    .matches(/^[a-zA-Z0-9\-_]+$/).withMessage('Transaction ID contains invalid characters'),

  validate
];

// M-Pesa Query Validation
const validateMpesaQuery = [
  body('CheckoutRequestID')
    .trim()
    .notEmpty().withMessage('Checkout Request ID is required')
    .isLength({ min: 10, max: 100 }).withMessage('Invalid Checkout Request ID'),

  validate
];

console.log('✅ Payment validators initialized');
console.log('   - STK Push validation');
console.log('   - Payment status check validation');
console.log('   - M-Pesa query validation');

module.exports = {
  validateStkPush,
  validatePaymentStatusCheck,
  validateMpesaQuery,
  validate
};
