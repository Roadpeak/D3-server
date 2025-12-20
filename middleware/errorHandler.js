/**
 * Centralized Error Handling Middleware
 * Sanitizes error messages to prevent information disclosure
 *
 * Security principles:
 * - Never expose stack traces to clients in production
 * - Hide database internals (table names, column names, SQL queries)
 * - Remove file system paths
 * - Log detailed errors server-side only
 * - Return generic messages to clients
 */

/**
 * Sanitize error message to remove sensitive information
 */
const sanitizeErrorMessage = (error) => {
  const message = error.message || 'An error occurred';

  // Remove SQL-related information
  if (message.includes('SequelizeValidationError') ||
      message.includes('SequelizeDatabaseError') ||
      message.includes('SequelizeUniqueConstraintError') ||
      message.includes('SequelizeForeignKeyConstraintError')) {
    return 'Database validation error';
  }

  // Remove file paths
  const pathRegex = /\/[\w\/.-]+\.(js|ts|json|sql)/gi;
  let sanitized = message.replace(pathRegex, '[file]');

  // Remove SQL queries
  const sqlRegex = /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+.*/gi;
  sanitized = sanitized.replace(sqlRegex, '[SQL query]');

  // Remove table/column names patterns
  const tableRegex = /table\s+["']?\w+["']?/gi;
  sanitized = sanitized.replace(tableRegex, 'table [name]');

  const columnRegex = /column\s+["']?\w+["']?/gi;
  sanitized = sanitized.replace(columnRegex, 'column [name]');

  return sanitized;
};

/**
 * Map error types to user-friendly messages
 */
const getGenericErrorMessage = (error) => {
  // Sequelize errors
  if (error.name === 'SequelizeValidationError') {
    return 'Validation failed. Please check your input.';
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    return 'This value already exists. Please use a different value.';
  }

  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return 'Invalid reference. The referenced item does not exist.';
  }

  if (error.name === 'SequelizeDatabaseError') {
    return 'Database error occurred. Please try again.';
  }

  if (error.name === 'SequelizeConnectionError') {
    return 'Database connection error. Please try again later.';
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return 'Invalid authentication token.';
  }

  if (error.name === 'TokenExpiredError') {
    return 'Authentication token has expired.';
  }

  // Multer errors (file upload)
  if (error.name === 'MulterError') {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return 'File is too large.';
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return 'Unexpected file upload.';
    }
    return 'File upload error.';
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return 'Validation failed. Please check your input.';
  }

  // Generic errors
  return 'An error occurred. Please try again.';
};

/**
 * Extract validation errors in a safe format
 */
const extractValidationErrors = (error) => {
  const errors = {};

  if (error.name === 'SequelizeValidationError' && error.errors) {
    error.errors.forEach(err => {
      // Only include field name and a generic message
      // Don't expose actual validation logic or database details
      const field = err.path || err.field || 'field';
      errors[field] = 'Invalid value';
    });
  }

  return errors;
};

/**
 * Main error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log full error details server-side (with stack trace)
  console.error('='.repeat(80));
  console.error('❌ ERROR OCCURRED');
  console.error('Time:', new Date().toISOString());
  console.error('Method:', req.method);
  console.error('Path:', req.path);
  console.error('IP:', req.ip);
  console.error('Error Name:', err.name);
  console.error('Error Message:', err.message);

  // Only log stack trace in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack Trace:', err.stack);
  }

  console.error('='.repeat(80));

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Build response based on environment
  const response = {
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? getGenericErrorMessage(err)
      : sanitizeErrorMessage(err),
  };

  // Add validation errors if present
  const validationErrors = extractValidationErrors(err);
  if (Object.keys(validationErrors).length > 0) {
    response.errors = validationErrors;
  }

  // In development, include more details (but still sanitized)
  if (process.env.NODE_ENV === 'development') {
    response.errorType = err.name;
    // Never include stack traces even in development for API responses
    // They're only logged server-side
  }

  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found',
    code: 'NOT_FOUND'
  });
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  sanitizeErrorMessage,
  getGenericErrorMessage
};
