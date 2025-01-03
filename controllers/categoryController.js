// controllers/categoryController.js
const { Category } = require('../models'); // Import the Category model

// Create a new category
const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const newCategory = await Category.create({ name, description });
        res.status(201).json({ message: 'Category created successfully!', category: newCategory });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating category' });
    }
};

// Get all categories
const getCategories = async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.status(200).json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

// Get category by ID
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.status(200).json(category);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching category' });
    }
};

// Update category by ID
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        category.name = name || category.name;
        category.description = description || category.description;
        await category.save();

        res.status(200).json({ message: 'Category updated successfully!', category });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating category' });
    }
};

// Delete category by ID
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        await category.destroy();
        res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting category' });
    }
};

module.exports = {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
};
