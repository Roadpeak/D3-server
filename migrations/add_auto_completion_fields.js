'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('Starting auto-completion fields migration...');

      // Check existing columns in bookings table
      console.log('Checking existing columns in bookings table...');
      const bookingsTableInfo = await queryInterface.describeTable('bookings');

      // Add auto_completed if it doesn't exist
      if (!bookingsTableInfo.auto_completed) {
        console.log('Adding auto_completed column to bookings table...');
        await queryInterface.addColumn('bookings', 'auto_completed', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
          comment: 'Whether booking was auto-completed by system'
        });
      } else {
        console.log('auto_completed column already exists, skipping...');
      }

      // Add completion_method if it doesn't exist
      if (!bookingsTableInfo.completion_method) {
        console.log('Adding completion_method column to bookings table...');
        await queryInterface.addColumn('bookings', 'completion_method', {
          type: Sequelize.ENUM('manual', 'automatic'),
          allowNull: true,
          comment: 'How the booking was completed'
        });
      } else {
        console.log('completion_method column already exists, skipping...');
      }

      // Add completion_details if it doesn't exist
      if (!bookingsTableInfo.completion_details) {
        console.log('Adding completion_details column to bookings table...');
        await queryInterface.addColumn('bookings', 'completion_details', {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Details about the completion process'
        });
      } else {
        console.log('completion_details column already exists, skipping...');
      }

      // Add actual_duration if it doesn't exist
      if (!bookingsTableInfo.actual_duration) {
        console.log('Adding actual_duration column to bookings table...');
        await queryInterface.addColumn('bookings', 'actual_duration', {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: 'Actual service duration in minutes'
        });
      } else {
        console.log('actual_duration column already exists, skipping...');
      }

      // Add service_started_at if it doesn't exist
      if (!bookingsTableInfo.service_started_at) {
        console.log('Adding service_started_at column to bookings table...');
        await queryInterface.addColumn('bookings', 'service_started_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the service actually started'
        });
      } else {
        console.log('service_started_at column already exists, skipping...');
      }

      // Add service_end_time if it doesn't exist
      if (!bookingsTableInfo.service_end_time) {
        console.log('Adding service_end_time column to bookings table...');
        await queryInterface.addColumn('bookings', 'service_end_time', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Calculated end time based on start time + duration'
        });
      } else {
        console.log('service_end_time column already exists, skipping...');
      }

      // Check existing columns in services table
      console.log('Checking existing columns in services table...');
      const servicesTableInfo = await queryInterface.describeTable('services');

      // Add buffer_time if it doesn't exist
      if (!servicesTableInfo.buffer_time) {
        console.log('Adding buffer_time column to services table...');
        await queryInterface.addColumn('services', 'buffer_time', {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: false,
          comment: 'Buffer time in minutes before auto-completion'
        });
      } else {
        console.log('buffer_time column already exists, skipping...');
      }

      // Add auto_complete_on_duration if it doesn't exist
      if (!servicesTableInfo.auto_complete_on_duration) {
        console.log('Adding auto_complete_on_duration column to services table...');
        await queryInterface.addColumn('services', 'auto_complete_on_duration', {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: false,
          comment: 'Whether to automatically complete after service duration'
        });
      } else {
        console.log('auto_complete_on_duration column already exists, skipping...');
      }

      // Add indexes for performance
      console.log('Adding indexes for auto-completion...');
      
      try {
        await queryInterface.addIndex('bookings', {
          fields: ['status', 'service_started_at', 'auto_completed'],
          name: 'idx_bookings_auto_completion'
        });
        console.log('Added auto-completion index');
      } catch (error) {
        console.log('Auto-completion index might already exist, skipping...');
      }

      try {
        await queryInterface.addIndex('services', {
          fields: ['auto_complete_on_duration'],
          name: 'idx_services_auto_complete'
        });
        console.log('Added auto-complete setting index');
      } catch (error) {
        console.log('Auto-complete setting index might already exist, skipping...');
      }

      try {
        await queryInterface.addIndex('bookings', {
          fields: ['completion_method'],
          name: 'idx_bookings_completion_method'
        });
        console.log('Added completion method index');
      } catch (error) {
        console.log('Completion method index might already exist, skipping...');
      }

      console.log('Auto-completion fields migration completed successfully!');

    } catch (error) {
      console.error('Auto-completion fields migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('Reverting auto-completion fields migration...');

      // Remove indexes first
      console.log('Removing indexes...');
      const indexes = [
        'idx_bookings_auto_completion',
        'idx_services_auto_complete',
        'idx_bookings_completion_method'
      ];

      for (const indexName of indexes) {
        try {
          await queryInterface.removeIndex('bookings', indexName);
          console.log(`Removed index: ${indexName}`);
        } catch (error) {
          console.log(`Index ${indexName} might not exist, skipping...`);
        }
      }

      // Remove booking columns
      console.log('Removing columns from bookings table...');
      const bookingColumns = [
        'auto_completed',
        'completion_method',
        'completion_details',
        'actual_duration',
        'service_started_at',
        'service_end_time'
      ];

      for (const column of bookingColumns) {
        try {
          await queryInterface.removeColumn('bookings', column);
          console.log(`Removed column: bookings.${column}`);
        } catch (error) {
          console.log(`Column bookings.${column} might not exist, skipping...`);
        }
      }

      // Remove service columns
      console.log('Removing columns from services table...');
      const serviceColumns = ['buffer_time', 'auto_complete_on_duration'];
      
      for (const column of serviceColumns) {
        try {
          await queryInterface.removeColumn('services', column);
          console.log(`Removed column: services.${column}`);
        } catch (error) {
          console.log(`Column services.${column} might not exist, skipping...`);
        }
      }

      console.log('Auto-completion fields migration rollback completed successfully!');

    } catch (error) {
      console.error('Auto-completion migration rollback failed:', error);
      throw error;
    }
  }
};