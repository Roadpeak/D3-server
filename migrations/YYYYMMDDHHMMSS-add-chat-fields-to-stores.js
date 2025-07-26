// migrations/YYYYMMDDHHMMSS-add-chat-fields-to-stores.js
// Run this migration to add chat system fields to your existing stores table

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns for chat system functionality
    await queryInterface.addColumn('stores', 'isOnline', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Real-time online status for chat system'
    });

    await queryInterface.addColumn('stores', 'lastSeen', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Last time the merchant was active for this store'
    });

    await queryInterface.addColumn('stores', 'latitude', {
      type: Sequelize.DECIMAL(10, 8),
      allowNull: true,
      comment: 'Geographic latitude for mapping'
    });

    await queryInterface.addColumn('stores', 'longitude', {
      type: Sequelize.DECIMAL(11, 8),
      allowNull: true,
      comment: 'Geographic longitude for mapping'
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('stores', ['isOnline'], {
      name: 'idx_stores_isOnline'
    });

    await queryInterface.addIndex('stores', ['merchant_id'], {
      name: 'idx_stores_merchant_id',
      unique: false
    });

    console.log('✅ Added chat system fields to stores table');
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('stores', 'idx_stores_isOnline');
    await queryInterface.removeIndex('stores', 'idx_stores_merchant_id');

    // Remove columns
    await queryInterface.removeColumn('stores', 'isOnline');
    await queryInterface.removeColumn('stores', 'lastSeen');
    await queryInterface.removeColumn('stores', 'latitude');
    await queryInterface.removeColumn('stores', 'longitude');

    console.log('✅ Removed chat system fields from stores table');
  }
};