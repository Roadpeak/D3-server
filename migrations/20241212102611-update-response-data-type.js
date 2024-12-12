'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('FormResponses', 'response_data', {
      type: Sequelize.JSON, // Change from JSONB to JSON
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('FormResponses', 'response_data', {
      type: Sequelize.JSONB, // Revert back to JSONB if rolling back
      allowNull: false,
    });
  },
};
