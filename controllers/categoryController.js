const { Category, sequelize } = require('../models');

const createCategory = async (req, res) => {
    try {
        const { name, description, image_url } = req.body;
        const newCategory = await Category.create({ name, description, image_url });
        res.status(201).json({ message: 'Category created successfully!', category: newCategory });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating category' });
    }
};

const getCategories = async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.status(200).json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

const getRandomCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({
            order: sequelize.fn('RAND'),
            limit: 7
        });
        res.status(200).json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching random categories' });
    }
};

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

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, image_url } = req.body;

        const category = await Category.findByPk(id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        category.name = name || category.name;
        category.description = description || category.description;
        category.image_url = image_url || category.image_url;
        await category.save();

        res.status(200).json({ message: 'Category updated successfully!', category });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating category' });
    }
};

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
    getRandomCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
};
