const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

// ==========================================
// CRITICAL SECURITY: File Upload Configuration
// ==========================================

// Allowed MIME types for images (whitelist approach)
const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

// Allowed file extensions for images
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// Allowed MIME types for documents
const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
];

// Allowed extensions for documents
const ALLOWED_DOCUMENT_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'
];

// File size limits (in bytes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;      // 5MB for images
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;  // 10MB for documents
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;    // 100MB for videos

/**
 * Validate file type by checking both MIME type and extension
 */
function validateFileType(file, allowedMimes, allowedExtensions, fileType = 'file') {
  const mime = file.mimetype.toLowerCase();
  const ext = require('path').extname(file.originalname).toLowerCase();

  console.log(`🔍 Validating ${fileType}:`, {
    filename: file.originalname,
    mime: mime,
    extension: ext,
    size: file.size
  });

  // Check MIME type
  if (!allowedMimes.includes(mime)) {
    console.error(`❌ Invalid MIME type for ${fileType}: ${mime}`);
    return false;
  }

  // Check file extension
  if (!allowedExtensions.includes(ext)) {
    console.error(`❌ Invalid extension for ${fileType}: ${ext}`);
    return false;
  }

  // Additional security: Check for double extensions (e.g., file.php.jpg)
  const doubleExtMatch = file.originalname.match(/\.[^.]+\.[^.]+$/);
  if (doubleExtMatch) {
    const firstExt = require('path').extname(doubleExtMatch[0].slice(0, -ext.length));
    const dangerousExts = ['.php', '.js', '.exe', '.sh', '.bat', '.cmd', '.com'];
    if (dangerousExts.includes(firstExt.toLowerCase())) {
      console.error(`❌ Dangerous double extension detected: ${file.originalname}`);
      return false;
    }
  }

  console.log(`✅ ${fileType} validation passed`);
  return true;
}

/**
 * File filter for images - CRITICAL SECURITY
 */
const imageFileFilter = (req, file, cb) => {
  const isValid = validateFileType(file, ALLOWED_IMAGE_MIMES, ALLOWED_IMAGE_EXTENSIONS, 'image');

  if (!isValid) {
    cb(new Error(`Invalid image file. Only ${ALLOWED_IMAGE_EXTENSIONS.join(', ')} files are allowed.`), false);
    return;
  }

  // Check file size
  if (file.size > MAX_IMAGE_SIZE) {
    cb(new Error(`Image size exceeds limit. Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB.`), false);
    return;
  }

  cb(null, true);
};

/**
 * File filter for documents - CRITICAL SECURITY
 */
const documentFileFilter = (req, file, cb) => {
  const isValid = validateFileType(file, ALLOWED_DOCUMENT_MIMES, ALLOWED_DOCUMENT_EXTENSIONS, 'document');

  if (!isValid) {
    cb(new Error(`Invalid document file. Only ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')} files are allowed.`), false);
    return;
  }

  // Check file size
  if (file.size > MAX_DOCUMENT_SIZE) {
    cb(new Error(`Document size exceeds limit. Maximum size is ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB.`), false);
    return;
  }

  cb(null, true);
};

// ==========================================
// Cloudinary Storage Configurations
// ==========================================

const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'images',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'], // Cloudinary-level validation
  },
});

const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'documents',
    resource_type: 'raw',
  },
});

// ==========================================
// Multer Upload Configurations with Security
// ==========================================

const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 5, // Maximum 5 files per upload
    fields: 10, // Maximum 10 fields
    parts: 15 // Maximum 15 parts
  },
  fileFilter: imageFileFilter
});

const uploadDocument = multer({
  storage: documentStorage,
  limits: {
    fileSize: MAX_DOCUMENT_SIZE,
    files: 3, // Maximum 3 documents per upload
    fields: 10,
    parts: 15
  },
  fileFilter: documentFileFilter
});

// ==========================================
// Video Upload Configuration
// ==========================================

const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'webm'],
  },
});

const videoFileFilter = (req, file, cb) => {
  const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
  const allowedExts = ['.mp4', '.mov', '.avi', '.webm'];

  const isValid = validateFileType(file, allowedMimes, allowedExts, 'video');

  if (!isValid) {
    cb(new Error(`Invalid video file. Only ${allowedExts.join(', ')} files are allowed.`), false);
    return;
  }

  // Check file size
  if (file.size > MAX_VIDEO_SIZE) {
    cb(new Error(`Video size exceeds limit. Maximum size is ${MAX_VIDEO_SIZE / (1024 * 1024)}MB.`), false);
    return;
  }

  cb(null, true);
};

const uploadVideo = multer({
  storage: videoStorage,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
    files: 1, // Only 1 video at a time
    fields: 5,
    parts: 10
  },
  fileFilter: videoFileFilter
});

// ==========================================
// Security Logging
// ==========================================

console.log('🔒 File upload security initialized:');
console.log(`   - Image uploads: Max ${MAX_IMAGE_SIZE / (1024 * 1024)}MB, types: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}`);
console.log(`   - Document uploads: Max ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB, types: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}`);
console.log(`   - Video uploads: Max ${MAX_VIDEO_SIZE / (1024 * 1024)}MB, types: [.mp4, .mov, .avi, .webm]`);
console.log('✅ File type validation: ENABLED');
console.log('✅ File size limits: ENABLED');
console.log('✅ Double extension check: ENABLED');

module.exports = {
  uploadImage,
  uploadDocument,
  uploadVideo,
  // Export validation functions for testing
  validateFileType,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_DOCUMENT_MIMES
};
