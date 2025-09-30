'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add the missing booking confirmation fields
    await queryInterface.addColumn('services', 'require_prepayment', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether prepayment is required before confirmation'
    });

    await queryInterface.addColumn('services', 'cancellation_policy', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Cancellation policy for this service'
    });

    await queryInterface.addColumn('services', 'min_cancellation_hours', {
      type: Sequelize.INTEGER,
      defaultValue: 2,
      allowNull: false,
      comment: 'Minimum hours before appointment that cancellation is allowed'
    });

    // Update the status enum to include 'pending'
    await queryInterface.changeColumn('services', 'status', {
      type: Sequelize.ENUM('active', 'inactive', 'suspended', 'pending'),
      defaultValue: 'active',
      allowNull: false
    });

    // Add admin verification fields for future use
    await queryInterface.addColumn('services', 'suspension_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Reason for suspension (admin use)'
    });

    await queryInterface.addColumn('services', 'verified_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When service was verified by admin'
    });

    await queryInterface.addColumn('services', 'verified_by', {
      type: Sequelize.VARCHAR(100), // Using varchar(100) to match your preference
      allowNull: true,
      comment: 'Admin who verified the service'
    });

    console.log('✅ Successfully added missing booking confirmation fields to services table');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the added columns
    await queryInterface.removeColumn('services', 'require_prepayment');
    await queryInterface.removeColumn('services', 'cancellation_policy');
    await queryInterface.removeColumn('services', 'min_cancellation_hours');
    await queryInterface.removeColumn('services', 'suspension_reason');
    await queryInterface.removeColumn('services', 'verified_at');
    await queryInterface.removeColumn('services', 'verified_by');

    // Revert the status enum back to the original
    await queryInterface.changeColumn('services', 'status', {
      type: Sequelize.ENUM('active', 'inactive', 'suspended'),
      defaultValue: 'active',
      allowNull: false
    });

    console.log('✅ Successfully removed booking confirmation fields from services table');
  }
};