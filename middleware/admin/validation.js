const { isValidEmail, isValidPhone, isValidPassword, isValidObjectId } = require('../../utils/validators');
const { badRequest } = require('../../utils/responses');

const validateUser = (req, res, next) => {
  const { email, password, name } = req.body;
  if (!isValidEmail(email) || !isValidPassword(password) || !name) {
    return badRequest(res, 'Invalid user data');
  }
  next();
};

const validateMerchant = (req, res, next) => {
  const { name } = req.body;
  if (!name) return badRequest(res, 'Merchant name is required');
  next();
};

const validateStore = (req, res, next) => {
  const { name, merchantId, location } = req.body;
  if (!name || !isValidObjectId(merchantId) || !location) {
    return badRequest(res, 'Invalid store data');
  }
  next();
};

const validateService = (req, res, next) => {
  const { name, storeId, price } = req.body;
  if (!name || !isValidObjectId(storeId) || !price || price <= 0) {
    return badRequest(res, 'Invalid service data');
  }
  next();
};

const validateBooking = (req, res, next) => {
  const { userId, serviceId, date, amount } = req.body;
  if (!isValidObjectId(userId) || !isValidObjectId(serviceId) || !date || !amount || amount <= 0) {
    return badRequest(res, 'Invalid booking data');
  }
  next();
};

const validateOffer = (req, res, next) => {
  const { name, discount } = req.body;
  if (!name || !discount || discount <= 0) {
    return badRequest(res, 'Invalid offer data');
  }
  next();
};

const validatePromo = (req, res, next) => {
  const { name, code } = req.body;
  if (!name || !code) return badRequest(res, 'Invalid promo data');
  next();
};

const validateServiceRequest = (req, res, next) => {
  const { userId, description } = req.body;
  if (!isValidObjectId(userId) || !description) {
    return badRequest(res, 'Invalid service request data');
  }
  next();
};

const validatePayment = (req, res, next) => {
  const { userId, type, amount, method } = req.body;
  if (!isValidObjectId(userId) || !type || !amount || amount <= 0 || !method) {
    return badRequest(res, 'Invalid payment data');
  }
  next();
};

const validateAccount = (req, res, next) => {
  const { userId } = req.body;
  if (!isValidObjectId(userId)) return badRequest(res, 'Invalid account data');
  next();
};

const validateEmail = (req, res, next) => {
  const { email } = req.body;
  if (!isValidEmail(email)) return badRequest(res, 'Invalid email format');
  next();
};

const validatePhone = (req, res, next) => {
  const { phone } = req.body;
  if (!isValidPhone(phone)) return badRequest(res, 'Invalid phone format');
  next();
};

const validatePassword = (req, res, next) => {
  const { password } = req.body;
  if (!isValidPassword(password)) return badRequest(res, 'Invalid password format');
  next();
};

const sanitizeInput = (req, res, next) => {
  for (let key in req.body) {
    if (typeof req.body[key] === 'string') {
      req.body[key] = req.body[key].trim();
    }
  }
  next();
};

const checkRequiredFields = (fields) => (req, res, next) => {
  for (let field of fields) {
    if (!req.body[field]) return badRequest(res, `${field} is required`);
  }
  next();
};

const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return badRequest(res, 'Invalid ObjectId');
  next();
};

module.exports = {
  validateUser,
  validateMerchant,
  validateStore,
  validateService,
  validateBooking,
  validateOffer,
  validatePromo,
  validateServiceRequest,
  validatePayment,
  validateAccount,
  validateEmail,
  validatePhone,
  validatePassword,
  sanitizeInput,
  checkRequiredFields,
  validateObjectId,
};