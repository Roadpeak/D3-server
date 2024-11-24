'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop existing indexes on the 'users' table
    await queryInterface.removeIndex('Users', 'email');
    await queryInterface.removeIndex('Users', 'phoneNumber');
  },

  down: async (queryInterface, Sequelize) => {
    // In the 'down' method, you should recreate the indexes if you want to roll back the migration
    await queryInterface.addIndex('Users', ['email']);
    await queryInterface.addIndex('Users', ['phoneNumber']);
  }
};
