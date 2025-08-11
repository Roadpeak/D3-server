const { formatResponse } = require('../../utils/responses');

const handleError = (err, req, res, next) => {
  if (err.name === 'ValidationError') return handleValidationError(err, res);
  if (err.name === 'CastError') return handleCastError(err, res);
  if (err.code === 11000) return handleDuplicateError(err, res);
  if (err.name === 'JsonWebTokenError') return handleJWTError(err, res);
  if (err.message.includes('Invalid file type')) return handleFileUploadError(err, res);
  return handle500(err, res);
};

const handleValidationError = (err, res) => {
  const errors = Object.values(err.errors).map(e => e.message);
  return formatResponse(res, 400, 'Validation Error', { errors });
};

const handleCastError = (err, res) => {
  return formatResponse(res, 400, 'Invalid ID format', { path: err.path });
};

const handleDuplicateError = (err, res) => {
  const field = Object.keys(err.keyValue)[0];
  return formatResponse(res, 409, `Duplicate value for ${field}`, { field });
};

const handleJWTError = (err, res) => {
  return formatResponse(res, 401, 'Invalid or expired token', { error: err.message });
};

const handleFileUploadError = (err, res) => {
  return formatResponse(res, 400, 'File upload error', { error: err.message });
};

const handle404 = (req, res) => {
  return formatResponse(res, 404, 'Resource not found');
};

const handle500 = (err, res) => {
  if (isDevelopment()) return sendErrorDev(err, res);
  return sendErrorProd(err, res);
};

const logError = (err) => {
  console.error('ERROR:', err.message, err.stack);
};

const formatErrorResponse = (res, status, message, data = {}) => {
  return formatResponse(res, status, message, data);
};

const isDevelopment = () => process.env.NODE_ENV === 'development';

const sendErrorDev = (err, res) => {
  return formatResponse(res, 500, 'Internal Server Error', { error: err.message, stack: err.stack });
};

const sendErrorProd = (err, res) => {
  return formatResponse(res, 500, 'Internal Server Error', {});
};

module.exports = {
  handleError,
  handleValidationError,
  handleCastError,
  handleDuplicateError,
  handleJWTError,
  handleFileUploadError,
  handle404,
  handle500,
  logError,
  formatErrorResponse,
  isDevelopment,
  sendErrorDev,
  sendErrorProd,
};