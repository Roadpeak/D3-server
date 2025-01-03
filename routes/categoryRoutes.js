// routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Create a new category
router.post('/', categoryController.createCategory);

// Get all categories
router.get('/', categoryController.getCategories);

// Get a specific category by ID
router.get('/:id', categoryController.getCategoryById);

// Update an existing category
router.put('/:id', categoryController.updateCategory);

// Delete a category
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
