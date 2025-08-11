const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const generateId = () => {
  return uuidv4();
};

const formatDate = (date) => {
  return new Date(date).toISOString();
};

const parseDate = (dateStr) => {
  return new Date(dateStr);
};

const calculateAge = (birthdate) => {
  const today = new Date();
  const birthDate = new Date(birthdate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const generateSlug = (str) => {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

const generateRandomString = (length) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const hashString = async (str) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(str, salt);
};

const compareHash = async (str, hash) => {
  return bcrypt.compare(str, hash);
};

const paginate = (query, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  return query.skip(skip).limit(limit);
};

const sortResults = (query, sortBy, order = 'asc') => {
  return query.sort({ [sortBy]: order === 'asc' ? 1 : -1 });
};

const filterResults = (query, filters) => {
  for (let key in filters) {
    if (filters[key]) query = query.where(key).equals(filters[key]);
  }
  return query;
};

module.exports = {
  generateId,
  formatDate,
  parseDate,
  calculateAge,
  generateSlug,
  formatCurrency,
  generateRandomString,
  hashString,
  compareHash,
  paginate,
  sortResults,
  filterResults,
};