const { User, Store, Merchant, Service, Booking, Offer } = require("../../models/index").sequelize.models;
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  },
});

const uploadFile = async (file) => {
  return new Promise((resolve, reject) => {
    upload.single('file')(file, {}, (err) => {
      if (err) return reject(err);
      resolve(`/uploads/${file.filename}`);
    });
  });
};

const deleteFile = async (filePath) => {
  const fs = require('fs').promises;
  await fs.unlink(filePath);
};

const validateFileType = async (file) => {
  const filetypes = /jpeg|jpg|png/;
  return filetypes.test(path.extname(file.originalname).toLowerCase());
};

const resizeImage = async (filePath) => {
  // Placeholder for image resizing (e.g., using sharp)
  return filePath;
};

const generateFileName = () => {
  return `${uuidv4()}.jpg`;
};

const getFileUrl = async (filePath) => {
  return `${process.env.APP_URL}${filePath}`;
};

module.exports = {
  uploadFile,
  deleteFile,
  validateFileType,
  resizeImage,
  generateFileName,
  getFileUrl,
};