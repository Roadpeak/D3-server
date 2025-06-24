'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Stores', 'cashback', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Cashback percentage or amount (e.g., "20%", "$0.02", "Up to 70%")',
    });

    await queryInterface.addColumn('Stores', 'category', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Store category (e.g., "Fashion & Clothing", "Electronics", "Beauty")',
    });

    await queryInterface.addColumn('Stores', 'rating', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: 0.0,
      comment: 'Store rating from 0.0 to 5.0',
    });

    await queryInterface.addColumn('Stores', 'was_rate', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Previous cashback rate for comparison (e.g., "Was 1%")',
    });

    // Add indexes for better performance
    await queryInterface.addIndex('Stores', ['category'], {
      name: 'idx_stores_category'
    });

    await queryInterface.addIndex('Stores', ['location'], {
      name: 'idx_stores_location'
    });

    await queryInterface.addIndex('Stores', ['rating'], {
      name: 'idx_stores_rating'
    });

    await queryInterface.addIndex('Stores', ['category', 'location'], {
      name: 'idx_stores_category_location'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    await queryInterface.removeIndex('Stores', 'idx_stores_category');
    await queryInterface.removeIndex('Stores', 'idx_stores_location');
    await queryInterface.removeIndex('Stores', 'idx_stores_rating');
    await queryInterface.removeIndex('Stores', 'idx_stores_category_location');

    // Remove columns
    await queryInterface.removeColumn('Stores', 'cashback');
    await queryInterface.removeColumn('Stores', 'category');
    await queryInterface.removeColumn('Stores', 'rating');
    await queryInterface.removeColumn('Stores', 'was_rate');
  }
};