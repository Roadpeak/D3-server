const express = require('express');
const { uploadImage, uploadDocument } = require('../config/multer');
const path = require('path');
const router = express.Router();

// FIXED: Helper function to format file URL properly handles Cloudinary URLs
const formatFileUrl = (filePath) => {
  // Check if it's a full URL (Cloudinary, S3, etc.)
  if (filePath.includes('http://') || filePath.includes('https://')) {
    return filePath; // Return as-is for external URLs
  }
  
  // Check if it's already a Cloudinary URL without protocol
  if (filePath.includes('cloudinary.com')) {
    return filePath.startsWith('https://') ? filePath : `https://${filePath}`;
  }
  
  // For local files, ensure proper /uploads/ prefix
  if (filePath.startsWith('uploads/')) {
    return `/${filePath}`;
  }
  if (!filePath.startsWith('/uploads/')) {
    return `/uploads/${filePath}`;
  }
  return filePath;
};

// Upload Image Routes - handle both paths for backward compatibility
router.post('/files/upload-image', uploadImage.single('file'), (req, res) => {
  try {
    console.log('📤 Image upload request received at /files/upload-image');
    console.log('File details:', req.file ? {
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    } : 'No file');

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded',
        message: 'Please select a file to upload'
      });
    }

    // FIXED: Format the URL properly
    const fileUrl = formatFileUrl(req.file.path);
    
    console.log('✅ Image uploaded successfully:', fileUrl);
    
    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      url: fileUrl,
      fileUrl: fileUrl,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to upload image'
    });
  }
});

// Alternative route for different path structure
router.post('/upload-image', uploadImage.single('file'), (req, res) => {
  try {
    console.log('📤 Image upload request received at /upload-image');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded',
        message: 'Please select a file to upload'
      });
    }

    // FIXED: Format the URL properly
    const fileUrl = formatFileUrl(req.file.path);
    
    console.log('✅ Image uploaded successfully:', fileUrl);
    
    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      url: fileUrl,
      fileUrl: fileUrl,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to upload image'
    });
  }
});

// FIXED: Store logo specific upload route
router.post('/store-logo', uploadImage.single('logo'), (req, res) => {
  try {
    console.log('🏪 Store logo upload request received');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No logo file uploaded',
        message: 'Please select a logo image to upload'
      });
    }

    // Validate that it's an image
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid file type',
        message: 'Please upload an image file (JPG, PNG, GIF, etc.)'
      });
    }

    // FIXED: Format the URL properly - no more malformed URLs!
    const fileUrl = formatFileUrl(req.file.path);
    
    console.log('✅ Store logo uploaded successfully:', fileUrl);
    
    res.status(200).json({
      success: true,
      message: 'Store logo uploaded successfully',
      url: fileUrl,
      fileUrl: fileUrl,
      logoUrl: fileUrl, // Specific for logo updates
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ Store logo upload error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to upload store logo'
    });
  }
});

// Upload Document Routes
router.post('/files/upload-document', uploadDocument.single('file'), (req, res) => {
  try {
    console.log('📄 Document upload request received');
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No document uploaded',
        message: 'Please select a document to upload'
      });
    }
    
    // FIXED: Format the URL properly
    const fileUrl = formatFileUrl(req.file.path);
    
    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      url: fileUrl,
      fileUrl: fileUrl,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ Document upload error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to upload document'
    });
  }
});

// Get upload status/test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Upload routes are working',
    endpoints: [
      'POST /api/v1/upload/files/upload-image',
      'POST /api/v1/upload/upload-image', 
      'POST /api/v1/upload/store-logo',
      'POST /api/v1/upload/files/upload-document'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;