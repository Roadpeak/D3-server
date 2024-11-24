const { StoreGallery, Store } = require('../models');
const { Op } = require('sequelize');

const StoreGalleryController = {
  // Upload gallery images
  async uploadImage(req, res) {
    const { storeId } = req.params;
    const { imageUrl } = req.body; // Assuming the image URL is being sent from the client side

    try {
      // Find the store to ensure it exists
      const store = await Store.findByPk(storeId);
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      // Check the number of existing images
      const existingImages = await StoreGallery.count({
        where: { store_id: storeId },
      });

      if (existingImages >= 15) {
        return res.status(400).json({ error: 'Store can have a maximum of 15 gallery images' });
      }

      // Save the new image URL to the gallery
      const newImage = await StoreGallery.create({
        store_id: storeId,
        image_url: imageUrl,
      });

      res.status(201).json({ message: 'Image uploaded successfully', newImage });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  },

  // Get all images for a store
  async getGallery(req, res) {
    const { storeId } = req.params;

    try {
      // Find the store to ensure it exists
      const store = await Store.findByPk(storeId);
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      // Get all images for the store
      const galleryImages = await StoreGallery.findAll({
        where: { store_id: storeId },
      });

      res.status(200).json(galleryImages);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch gallery images' });
    }
  },
};

module.exports = StoreGalleryController;
