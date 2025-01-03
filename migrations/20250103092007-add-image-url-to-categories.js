// migrations/[timestamp]-add-image-url-to-categories.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Categories', 'image_url', {
      type: Sequelize.STRING,
      allowNull: true, // image_url is optional
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Categories', 'image_url');
  },
};
