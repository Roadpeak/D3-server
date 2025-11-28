'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add resetToken and resetTokenExpiry to users table
    await queryInterface.addColumn('users', 'resetToken', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Password reset token'
    });

    await queryInterface.addColumn('users', 'resetTokenExpiry', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Password reset token expiry time'
    });

    // Add resetToken and resetTokenExpiry to merchants table
    await queryInterface.addColumn('merchants', 'reset_token', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Password reset token'
    });

    await queryInterface.addColumn('merchants', 'reset_token_expiry', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Password reset token expiry time'
    });

    console.log('✅ Password reset fields added to users and merchants tables');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove resetToken and resetTokenExpiry from users table
    await queryInterface.removeColumn('users', 'resetToken');
    await queryInterface.removeColumn('users', 'resetTokenExpiry');

    // Remove resetToken and resetTokenExpiry from merchants table
    await queryInterface.removeColumn('merchants', 'reset_token');
    await queryInterface.removeColumn('merchants', 'reset_token_expiry');

    console.log('✅ Password reset fields removed from users and merchants tables');
  }
};
