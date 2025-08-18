// migrations/YYYYMMDD-add-referral-fields-to-users.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add referral columns to users table
    await queryInterface.addColumn('users', 'referralSlug', {
      type: Sequelize.STRING(50),
      allowNull: true,
      unique: true,
      comment: 'Unique referral slug for this user (user-friendly)'
    });

    await queryInterface.addColumn('users', 'referralLink', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Full referral link for this user'
    });

    await queryInterface.addColumn('users', 'referredBy', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'ID of user who referred this user'
    });

    await queryInterface.addColumn('users', 'referredAt', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When this user was referred'
    });

    // Add indexes for better performance
    await queryInterface.addIndex('users', ['referralSlug'], {
      name: 'users_referral_slug_index',
      unique: true
    });

    await queryInterface.addIndex('users', ['referredBy'], {
      name: 'users_referred_by_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('users', 'users_referred_by_index');
    await queryInterface.removeIndex('users', 'users_referral_slug_index');

    // Remove referral columns from users table
    await queryInterface.removeColumn('users', 'referredAt');
    await queryInterface.removeColumn('users', 'referredBy');
    await queryInterface.removeColumn('users', 'referralLink');
    await queryInterface.removeColumn('users', 'referralSlug');
  }
};

// To run this migration:
// npx sequelize-cli db:migrate