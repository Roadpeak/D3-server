'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('bookings', 'checked_in_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when customer checked in for the booking'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('bookings', 'checked_in_at');
  }
};
