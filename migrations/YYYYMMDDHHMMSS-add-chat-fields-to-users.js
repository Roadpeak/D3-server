// migrations/YYYYMMDDHHMMSS-add-chat-fields-to-users.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add chat system related fields
    await queryInterface.addColumn('users', 'isOnline', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Real-time online status for chat system'
    });

    await queryInterface.addColumn('users', 'lastSeenAt', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Last seen timestamp for chat system'
    });

    // Add notification preference fields
    await queryInterface.addColumn('users', 'chatNotifications', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether to receive chat notifications'
    });

    await queryInterface.addColumn('users', 'emailNotifications', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether to receive email notifications'
    });

    await queryInterface.addColumn('users', 'smsNotifications', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether to receive SMS notifications'
    });

    await queryInterface.addColumn('users', 'pushNotifications', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'Whether to receive push notifications'
    });

    await queryInterface.addColumn('users', 'marketingEmails', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether to receive marketing emails'
    });

    // Add customer information fields
    await queryInterface.addColumn('users', 'dateOfBirth', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Customer date of birth'
    });

    await queryInterface.addColumn('users', 'gender', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Customer gender (male, female, other, prefer_not_to_say)'
    });

    await queryInterface.addColumn('users', 'address', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Customer address'
    });

    await queryInterface.addColumn('users', 'city', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Customer city'
    });

    await queryInterface.addColumn('users', 'country', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'Kenya',
      comment: 'Customer country'
    });

    await queryInterface.addColumn('users', 'postalCode', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Customer postal code'
    });

    // Add privacy settings
    await queryInterface.addColumn('users', 'profileVisibility', {
      type: Sequelize.STRING,
      defaultValue: 'public',
      allowNull: false,
      comment: 'Profile visibility setting (public, private, friends_only)'
    });

    // Add new indexes for chat system and enhanced functionality
    await queryInterface.addIndex('users', {
      fields: ['isOnline'],
      name: 'idx_is_online'
    });

    await queryInterface.addIndex('users', {
      fields: ['userType', 'isOnline'],
      name: 'idx_user_type_online'
    });

    await queryInterface.addIndex('users', {
      fields: ['city'],
      name: 'idx_city'
    });

    await queryInterface.addIndex('users', {
      fields: ['country'],
      name: 'idx_country'
    });

    await queryInterface.addIndex('users', {
      fields: ['lastSeenAt'],
      name: 'idx_last_seen_at'
    });

    await queryInterface.addIndex('users', {
      fields: ['userType', 'isActive', 'isOnline'],
      name: 'idx_user_type_active_online'
    });

    console.log('✅ Successfully added chat system fields to users table');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes first
    await queryInterface.removeIndex('users', 'idx_is_online');
    await queryInterface.removeIndex('users', 'idx_user_type_online');
    await queryInterface.removeIndex('users', 'idx_city');
    await queryInterface.removeIndex('users', 'idx_country');
    await queryInterface.removeIndex('users', 'idx_last_seen_at');
    await queryInterface.removeIndex('users', 'idx_user_type_active_online');

    // Remove columns
    await queryInterface.removeColumn('users', 'profileVisibility');
    await queryInterface.removeColumn('users', 'gender');
    await queryInterface.removeColumn('users', 'isOnline');
    await queryInterface.removeColumn('users', 'lastSeenAt');
    await queryInterface.removeColumn('users', 'chatNotifications');
    await queryInterface.removeColumn('users', 'emailNotifications');
    await queryInterface.removeColumn('users', 'smsNotifications');
    await queryInterface.removeColumn('users', 'pushNotifications');
    await queryInterface.removeColumn('users', 'marketingEmails');
    await queryInterface.removeColumn('users', 'dateOfBirth');
    await queryInterface.removeColumn('users', 'address');
    await queryInterface.removeColumn('users', 'city');
    await queryInterface.removeColumn('users', 'country');
    await queryInterface.removeColumn('users', 'postalCode');

    console.log('✅ Successfully removed chat system fields from users table');
  }
};