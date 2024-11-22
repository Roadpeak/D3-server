const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'images',
    resource_type: 'image',
  },
});

const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'documents',
    resource_type: 'raw',
  },
});

const uploadImage = multer({ storage: imageStorage });
const uploadDocument = multer({ storage: documentStorage });

module.exports = { uploadImage, uploadDocument };
