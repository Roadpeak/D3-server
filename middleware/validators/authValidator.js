const { body, validationResult } = require('express-validator');

// ==========================================
// CRITICAL SECURITY: Input Validation Rules
// ==========================================

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-{}\[\]:;"'<>,.\/\\|`~]).{12,}$/;

// Validation middleware to check results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('🚨 Validation failed:', errors.array());
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

// User Registration Validation
const validateUserRegistration = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('First name contains invalid characters'),

  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name contains invalid characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email is too long'),

  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[\d\s\-()]{7,20}$/).withMessage('Please enter a valid phone number'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
    .matches(PASSWORD_REGEX).withMessage('Password must contain uppercase, lowercase, number, and special character'),

  body('password_confirmation')
    .optional()
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),

  validate
];

// User Login Validation
const validateUserLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 12 }).withMessage('Invalid credentials'),

  validate
];

// Merchant Registration Validation
const validateMerchantRegistration = [
  body('firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('First name contains invalid characters'),

  body('lastName')
    .trim()
    .notEmpty().withMessage('Last name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name contains invalid characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email is too long'),

  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[\d\s\-()]{7,20}$/).withMessage('Please enter a valid phone number'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
    .matches(PASSWORD_REGEX).withMessage('Password must contain uppercase, lowercase, number, and special character'),

  validate
];

// Merchant Login Validation
const validateMerchantLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 12 }).withMessage('Invalid credentials'),

  validate
];

// Password Reset Request Validation
const validatePasswordResetRequest = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail(),

  validate
];

// Password Reset Validation
const validatePasswordReset = [
  body('token')
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 20 }).withMessage('Invalid reset token'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 12 }).withMessage('Password must be at least 12 characters long')
    .matches(PASSWORD_REGEX).withMessage('Password must contain uppercase, lowercase, number, and special character'),

  body('password_confirmation')
    .notEmpty().withMessage('Password confirmation is required')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),

  validate
];

// Email Update Validation
const validateEmailUpdate = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email is too long'),

  validate
];

// Phone Update Validation
const validatePhoneUpdate = [
  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[\d\s\-()]{7,20}$/).withMessage('Please enter a valid phone number'),

  validate
];

console.log('✅ Auth validators initialized with express-validator');
console.log('   - User registration/login validation');
console.log('   - Merchant registration/login validation');
console.log('   - Password reset validation');
console.log('   - Email/phone update validation');

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateMerchantRegistration,
  validateMerchantLogin,
  validatePasswordResetRequest,
  validatePasswordReset,
  validateEmailUpdate,
  validatePhoneUpdate,
  validate
};
