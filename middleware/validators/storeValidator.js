const { body, param, validationResult } = require('express-validator');

// Validation middleware to check results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('🚨 Store validation failed:', errors.array());
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

// Store Creation Validation
const validateStoreCreation = [
  body('storeName')
    .trim()
    .notEmpty().withMessage('Store name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Store name must be 2-100 characters')
    .matches(/^[a-zA-Z0-9\s&'.,\-()]+$/).withMessage('Store name contains invalid characters'),

  body('category')
    .trim()
    .notEmpty().withMessage('Category is required')
    .isLength({ min: 2, max: 50 }).withMessage('Category must be 2-50 characters'),

  body('subcategory')
    .trim()
    .optional()
    .isLength({ max: 50 }).withMessage('Subcategory too long'),

  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),

  body('phoneNumber')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[\d\s\-()]{7,20}$/).withMessage('Invalid phone number format'),

  body('email')
    .trim()
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('county')
    .trim()
    .notEmpty().withMessage('County is required')
    .isLength({ min: 2, max: 50 }).withMessage('County must be 2-50 characters'),

  body('town')
    .trim()
    .notEmpty().withMessage('Town is required')
    .isLength({ min: 2, max: 50 }).withMessage('Town must be 2-50 characters'),

  body('location')
    .trim()
    .notEmpty().withMessage('Location is required')
    .isLength({ min: 2, max: 200 }).withMessage('Location must be 2-200 characters'),

  body('latitude')
    .optional({ checkFalsy: true })
    .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude')
    .toFloat(),

  body('longitude')
    .optional({ checkFalsy: true })
    .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude')
    .toFloat(),

  body('openingHours')
    .optional()
    .isJSON().withMessage('Opening hours must be valid JSON'),

  validate
];

// Store Update Validation
const validateStoreUpdate = [
  param('id')
    .trim()
    .notEmpty().withMessage('Store ID is required')
    .isUUID().withMessage('Invalid store ID format'),

  body('storeName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Store name must be 2-100 characters')
    .matches(/^[a-zA-Z0-9\s&'.,\-()]+$/).withMessage('Store name contains invalid characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),

  body('phoneNumber')
    .optional()
    .trim()
    .matches(/^\+?[\d\s\-()]{7,20}$/).withMessage('Invalid phone number format'),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  validate
];

// Store ID Parameter Validation
const validateStoreId = [
  param('id')
    .trim()
    .notEmpty().withMessage('Store ID is required')
    .isUUID().withMessage('Invalid store ID format'),

  validate
];

console.log('✅ Store validators initialized');
console.log('   - Store creation validation');
console.log('   - Store update validation');
console.log('   - Store ID validation');

module.exports = {
  validateStoreCreation,
  validateStoreUpdate,
  validateStoreId,
  validate
};
