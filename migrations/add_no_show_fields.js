'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('Starting no-show fields migration...');

      // Check existing columns in bookings table first
      console.log('Checking existing columns in bookings table...');
      const bookingsTableInfo = await queryInterface.describeTable('bookings');

      // Add no_show_marked_at column if it doesn't exist
      if (!bookingsTableInfo.no_show_marked_at) {
        console.log('Adding no_show_marked_at column to bookings table...');
        await queryInterface.addColumn('bookings', 'no_show_marked_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the booking was marked as no-show'
        });
      } else {
        console.log('no_show_marked_at column already exists, skipping...');
      }

      // Add no_show_reason column if it doesn't exist
      if (!bookingsTableInfo.no_show_reason) {
        console.log('Adding no_show_reason column to bookings table...');
        await queryInterface.addColumn('bookings', 'no_show_reason', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Reason for no-show status'
        });
      } else {
        console.log('no_show_reason column already exists, skipping...');
      }

      // Add no_show_details column if it doesn't exist
      if (!bookingsTableInfo.no_show_details) {
        console.log('Adding no_show_details column to bookings table...');
        await queryInterface.addColumn('bookings', 'no_show_details', {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Additional details about no-show processing'
        });
      } else {
        console.log('no_show_details column already exists, skipping...');
      }

      // Check existing columns in services table
      console.log('Checking existing columns in services table...');
      const servicesTableInfo = await queryInterface.describeTable('services');

      // Add grace_period_minutes column if it doesn't exist
      if (!servicesTableInfo.grace_period_minutes) {
        console.log('Adding grace_period_minutes column to services table...');
        await queryInterface.addColumn('services', 'grace_period_minutes', {
          type: Sequelize.INTEGER,
          defaultValue: 10,
          allowNull: false,
          comment: 'Grace period in minutes after scheduled time before marking as no-show'
        });
      } else {
        console.log('grace_period_minutes column already exists, skipping...');
      }

      // Add indexes for better performance
      console.log('Adding indexes for no-show functionality...');
      
      try {
        await queryInterface.addIndex('bookings', {
          fields: ['status', 'no_show_marked_at'],
          name: 'idx_bookings_no_show_status'
        });
        console.log('Added no-show status index');
      } catch (error) {
        console.log('No-show status index might already exist, skipping...');
      }

      try {
        await queryInterface.addIndex('bookings', {
          fields: ['status', 'startTime', 'checked_in_at'],
          name: 'idx_bookings_no_show_eligible'
        });
        console.log('Added no-show eligibility index');
      } catch (error) {
        console.log('No-show eligibility index might already exist, skipping...');
      }

      try {
        await queryInterface.addIndex('services', {
          fields: ['grace_period_minutes'],
          name: 'idx_services_grace_period'
        });
        console.log('Added grace period index');
      } catch (error) {
        console.log('Grace period index might already exist, skipping...');
      }

      console.log('No-show fields migration completed successfully!');

    } catch (error) {
      console.error('No-show fields migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('Reverting no-show fields migration...');

      // Remove indexes first
      console.log('Removing indexes...');
      
      const indexes = [
        'idx_bookings_no_show_status',
        'idx_bookings_no_show_eligible',
        'idx_services_grace_period'
      ];

      for (const indexName of indexes) {
        try {
          await queryInterface.removeIndex('bookings', indexName);
          console.log(`Removed index: ${indexName}`);
        } catch (error) {
          console.log(`Index ${indexName} might not exist, skipping...`);
        }
      }

      // Remove columns from bookings table
      console.log('Removing columns from bookings table...');
      const bookingColumns = [
        'no_show_marked_at',
        'no_show_reason', 
        'no_show_details'
      ];

      for (const column of bookingColumns) {
        try {
          await queryInterface.removeColumn('bookings', column);
          console.log(`Removed column: bookings.${column}`);
        } catch (error) {
          console.log(`Column bookings.${column} might not exist, skipping...`);
        }
      }

      // Remove columns from services table
      console.log('Removing columns from services table...');
      try {
        await queryInterface.removeColumn('services', 'grace_period_minutes');
        console.log('Removed column: services.grace_period_minutes');
      } catch (error) {
        console.log('Column services.grace_period_minutes might not exist, skipping...');
      }

      console.log('No-show fields migration rollback completed successfully!');

    } catch (error) {
      console.error('No-show fields migration rollback failed:', error);
      throw error;
    }
  }
};