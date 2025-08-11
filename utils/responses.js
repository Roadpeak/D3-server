const { SUCCESS_MESSAGES, ERROR_CODES } = require('./constants');

const formatResponse = (res, status, message, data = {}) => {
  return res.status(status).json({ status, message, data });
};

const success = (res, message = 'Success', data = {}) => {
  return formatResponse(res, 200, message, data);
};

const error = (res, message = 'Error', data = {}) => {
  return formatResponse(res, ERROR_CODES.SERVER_ERROR, message, data);
};

const created = (res, message = SUCCESS_MESSAGES.CREATED, data = {}) => {
  return formatResponse(res, 201, message, data);
};

const badRequest = (res, message = 'Bad Request', data = {}) => {
  return formatResponse(res, ERROR_CODES.BAD_REQUEST, message, data);
};

const unauthorized = (res, message = 'Unauthorized', data = {}) => {
  return formatResponse(res, ERROR_CODES.UNAUTHORIZED, message, data);
};

const forbidden = (res, message = 'Forbidden', data = {}) => {
  return formatResponse(res, ERROR_CODES.FORBIDDEN, message, data);
};

const notFound = (res, message = 'Not Found', data = {}) => {
  return formatResponse(res, ERROR_CODES.NOT_FOUND, message, data);
};

const conflict = (res, message = 'Conflict', data = {}) => {
  return formatResponse(res, ERROR_CODES.CONFLICT, message, data);
};

const serverError = (res, message = 'Internal Server Error', data = {}) => {
  return formatResponse(res, ERROR_CODES.SERVER_ERROR, message, data);
};

const validationError = (res, message = 'Validation Error', data = {}) => {
  return formatResponse(res, ERROR_CODES.BAD_REQUEST, message, data);
};

const sendPaginatedResponse = (res, data, page, limit, total) => {
  return formatResponse(res, 200, 'Success', {
    results: data,
    pagination: { page, limit, total },
  });
};

module.exports = {
  success,
  error,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
  validationError,
  formatResponse,
  sendPaginatedResponse,
};
// Add aliases for controller compatibility
const sendSuccessResponse = success;
const sendErrorResponse = error;

module.exports = {
  success,
  error,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
  validationError,
  formatResponse,
  sendPaginatedResponse,
  sendSuccessResponse,  // Add alias
  sendErrorResponse     // Add alias
};
