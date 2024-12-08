'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Removing the 'created_by' and 'updated_by' columns
    await queryInterface.removeColumn('Socials', 'created_by');
    await queryInterface.removeColumn('Socials', 'updated_by');
  },

  down: async (queryInterface, Sequelize) => {
    // If you want to revert the migration (rollback), add the columns back
    await queryInterface.addColumn('Socials', 'created_by', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'Merchants',
        key: 'id',
      },
    });
    await queryInterface.addColumn('Socials', 'updated_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'Merchants',
        key: 'id',
      },
    });
  },
};
