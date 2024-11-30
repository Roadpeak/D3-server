const express = require('express');
const { uploadImage, uploadDocument } = require('../config/multer');
const router = express.Router();

// Upload Image Route
router.post('/files/upload-image', uploadImage.single('file'), (req, res) => {
  try {
    res.status(200).json({
      message: 'Image uploaded successfully',
      url: req.file.path,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload Document Route
router.post('/files/upload-document', uploadDocument.single('file'), (req, res) => {
  try {
    res.status(200).json({
      message: 'Document uploaded successfully',
      url: req.file.path,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
