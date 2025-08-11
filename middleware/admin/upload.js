const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { handleFileUploadError } = require('./errorHandler');

const configureMulter = () => {
  return multer({
    storage: configureStorage(),
    limits: setUploadLimits(),
    fileFilter: validateFileType,
  });
};

const configureStorage = () => {
  return multer.diskStorage({
    destination: configureDestination(),
    filename: configureFilename(),
  });
};

const setUploadLimits = () => ({
  fileSize: process.env.MAX_FILE_SIZE || 5 * 1024 * 1024, // 5MB default
});

const configureDestination = () => (req, file, cb) => {
  const path = process.env.UPLOAD_DIR || './uploads';
  cb(null, path);
};

const configureFilename = () => (req, file, cb) => {
  cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
};

const setupS3Config = () => {
  // Placeholder for AWS S3 configuration
  return null;
};

const setupCloudinary = () => {
  // Placeholder for Cloudinary configuration
  return null;
};

const getStorageEngine = () => {
  return configureStorage();
};

const validateUploadConfig = () => {
  return !!process.env.UPLOAD_DIR;
};

const uploadSingle = () => configureMulter().single('file');

const uploadMultiple = () => configureMulter().array('files', 5);

const uploadAvatar = () => configureMulter().single('avatar');

const uploadDocuments = () => configureMulter().array('documents', 10);

const validateFileType = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|pdf/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('Invalid file type'));
};

const validateFileSize = (req, file, cb) => {
  const maxSize = process.env.MAX_FILE_SIZE || 5 * 1024 * 1024;
  if (file.size > maxSize) return cb(new Error('File size exceeds limit'));
  cb(null, true);
};

const resizeImage = async (filePath) => {
  // Placeholder for image resizing (e.g., using sharp)
  return filePath;
};

const generateFileName = () => {
  return `${uuidv4()}.jpg`;
};

const createUploadPath = async () => {
  const path = process.env.UPLOAD_DIR || './uploads';
  await fs.mkdir(path, { recursive: true });
  return path;
};

const handleUploadError = (err, req, res, next) => {
  return handleFileUploadError(err, res);
};

const deleteFile = async (filePath) => {
  await fs.unlink(filePath);
};

const moveFile = async (src, dest) => {
  await fs.rename(src, dest);
};

module.exports = {
  configureMulter,
  uploadSingle,
  uploadMultiple,
  uploadAvatar,
  uploadDocuments,
  validateFileType,
  validateFileSize,
  resizeImage,
  generateFileName,
  createUploadPath,
  handleUploadError,
  deleteFile,
  moveFile,
  configureStorage,
  setUploadLimits,
  configureDestination,
  configureFilename,
  setupS3Config,
  setupCloudinary,
  getStorageEngine,
  validateUploadConfig,
};