const express = require('express');
const router = express.Router();
const StoreGalleryController = require('../controllers/StoreGalleryController');

// Upload image to store gallery
router.post('/:storeId/gallery', StoreGalleryController.uploadImage);

// Get store gallery images
router.get('/:storeId/gallery', StoreGalleryController.getGallery);

module.exports = router;
