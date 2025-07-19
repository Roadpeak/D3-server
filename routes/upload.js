const express = require('express');
const { uploadImage, uploadDocument } = require('../config/multer');
const router = express.Router();

// Upload Image Routes - handle both paths
router.post('/files/upload-image', uploadImage.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.status(200).json({
      message: 'Image uploaded successfully',
      url: req.file.path,
      fileUrl: req.file.path, // Add this for frontend compatibility
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Alternative route for the correct path structure
router.post('/upload-image', uploadImage.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.status(200).json({
      message: 'Image uploaded successfully',
      url: req.file.path,
      fileUrl: req.file.path,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload Document Routes
router.post('/files/upload-document', uploadDocument.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.status(200).json({
      message: 'Document uploaded successfully',
      url: req.file.path,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;