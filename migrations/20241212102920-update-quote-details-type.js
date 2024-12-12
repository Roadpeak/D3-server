'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Quotes', 'quote_details', {
      type: Sequelize.JSON, // Change to JSON
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Quotes', 'quote_details', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
};
