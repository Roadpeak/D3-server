'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Services', 'type', {
      type: Sequelize.ENUM('fixed', 'dynamic'),
      allowNull: false,
      defaultValue: 'fixed',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Services', 'type');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Services_type";');
  },
};
