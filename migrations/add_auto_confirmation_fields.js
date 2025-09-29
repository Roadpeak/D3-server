'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('Starting auto-confirmation fields migration...');

      // Check existing columns in bookings table
      console.log('Checking existing columns in bookings table...');
      const bookingsTableInfo = await queryInterface.describeTable('bookings');

      // Add fields to bookings table only if they don't exist
      if (!bookingsTableInfo.auto_confirmed) {
        console.log('Adding auto_confirmed column to bookings table...');
        await queryInterface.addColumn('bookings', 'auto_confirmed', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
          comment: 'Whether booking was auto-confirmed by system'
        });
      } else {
        console.log('auto_confirmed column already exists, skipping...');
      }

      if (!bookingsTableInfo.confirmation_notes) {
        console.log('Adding confirmation_notes column to bookings table...');
        await queryInterface.addColumn('bookings', 'confirmation_notes', {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Notes about confirmation decision'
        });
      } else {
        console.log('confirmation_notes column already exists, skipping...');
      }

      if (!bookingsTableInfo.audit_trail) {
        console.log('Adding audit_trail column to bookings table...');
        await queryInterface.addColumn('bookings', 'audit_trail', {
          type: Sequelize.JSON,
          allowNull: true,
          comment: 'Audit trail of auto-confirmation decisions'
        });
      } else {
        console.log('audit_trail column already exists, skipping...');
      }

      if (!bookingsTableInfo.manually_confirmed) {
        console.log('Adding manually_confirmed column to bookings table...');
        await queryInterface.addColumn('bookings', 'manually_confirmed', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
          comment: 'Whether booking was manually confirmed by merchant'
        });
      } else {
        console.log('manually_confirmed column already exists, skipping...');
      }

      if (!bookingsTableInfo.confirmed_by) {
        console.log('Adding confirmed_by column to bookings table...');
        await queryInterface.addColumn('bookings', 'confirmed_by', {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'Who confirmed the booking (system/merchant name)'
        });
      } else {
        console.log('confirmed_by column already exists, skipping...');
      }

      if (!bookingsTableInfo.confirmed_at) {
        console.log('Adding confirmed_at column to bookings table...');
        await queryInterface.addColumn('bookings', 'confirmed_at', {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'When the booking was confirmed'
        });
      } else {
        console.log('confirmed_at column already exists, skipping...');
      }

      // Check existing columns in services table
      console.log('Checking existing columns in services table...');
      const servicesTableInfo = await queryInterface.describeTable('services');

      // Add fields to services table only if they don't exist
      if (!servicesTableInfo.require_prepayment) {
        console.log('Adding require_prepayment column to services table...');
        await queryInterface.addColumn('services', 'require_prepayment', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
          comment: 'Whether prepayment is required before confirmation'
        });
      } else {
        console.log('require_prepayment column already exists, skipping...');
      }

      if (!servicesTableInfo.blackout_dates) {
        console.log('Adding blackout_dates column to services table...');
        await queryInterface.addColumn('services', 'blackout_dates', {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: null,
          comment: 'Array of blackout dates/periods for this service'
        });
      } else {
        console.log('blackout_dates column already exists, skipping...');
      }

      if (!servicesTableInfo.allow_overbooking) {
        console.log('Adding allow_overbooking column to services table...');
        await queryInterface.addColumn('services', 'allow_overbooking', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
          comment: 'Whether to allow bookings beyond max_concurrent_bookings'
        });
      } else {
        console.log('allow_overbooking column already exists, skipping...');
      }

      // Add min_advance_booking and max_advance_booking if they don't exist
      console.log('Checking and adding advance booking columns to services table...');
      
      if (!servicesTableInfo.min_advance_booking) {
        console.log('Adding min_advance_booking column to services table...');
        await queryInterface.addColumn('services', 'min_advance_booking', {
          type: Sequelize.INTEGER,
          defaultValue: 30,
          allowNull: false,
          comment: 'Minimum minutes in advance that booking can be made'
        });
      } else {
        console.log('min_advance_booking column already exists, skipping...');
      }

      if (!servicesTableInfo.max_advance_booking) {
        console.log('Adding max_advance_booking column to services table...');
        await queryInterface.addColumn('services', 'max_advance_booking', {
          type: Sequelize.INTEGER,
          defaultValue: 10080, // 7 days in minutes
          allowNull: false,
          comment: 'Maximum minutes in advance that booking can be made'
        });
      } else {
        console.log('max_advance_booking column already exists, skipping...');
      }

      // Add indexes for better performance
      console.log('Adding indexes for auto-confirmation fields...');
      
      try {
        await queryInterface.addIndex('bookings', {
          fields: ['auto_confirmed'],
          name: 'idx_bookings_auto_confirmed'
        });
        console.log('Added auto_confirmed index');
      } catch (error) {
        console.log('Index auto_confirmed might already exist, skipping...');
      }

      try {
        await queryInterface.addIndex('bookings', {
          fields: ['manually_confirmed'],
          name: 'idx_bookings_manually_confirmed'
        });
        console.log('Added manually_confirmed index');
      } catch (error) {
        console.log('Index manually_confirmed might already exist, skipping...');
      }

      try {
        await queryInterface.addIndex('services', {
          fields: ['require_prepayment'],
          name: 'idx_services_require_prepayment'
        });
        console.log('Added require_prepayment index');
      } catch (error) {
        console.log('Index require_prepayment might already exist, skipping...');
      }

      try {
        await queryInterface.addIndex('services', {
          fields: ['allow_overbooking'],
          name: 'idx_services_allow_overbooking'
        });
        console.log('Added allow_overbooking index');
      } catch (error) {
        console.log('Index allow_overbooking might already exist, skipping...');
      }

      // Add composite index for staff scheduling queries
      try {
        await queryInterface.addIndex('bookings', {
          fields: ['staffId', 'startTime', 'endTime', 'status'],
          name: 'idx_bookings_staff_schedule'
        });
        console.log('Added staff schedule composite index');
      } catch (error) {
        console.log('Staff schedule index might already exist, skipping...');
      }

      console.log('Auto-confirmation fields migration completed successfully!');

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('Reverting auto-confirmation fields migration...');

      // Remove indexes first
      console.log('Removing indexes...');
      
      const indexes = [
        'idx_bookings_auto_confirmed',
        'idx_bookings_manually_confirmed', 
        'idx_services_require_prepayment',
        'idx_services_allow_overbooking',
        'idx_bookings_staff_schedule'
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
        'auto_confirmed',
        'confirmation_notes', 
        'audit_trail',
        'manually_confirmed',
        'confirmed_by',
        'confirmed_at'
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
      const serviceColumns = [
        'require_prepayment',
        'blackout_dates',
        'allow_overbooking'
      ];

      for (const column of serviceColumns) {
        try {
          await queryInterface.removeColumn('services', column);
          console.log(`Removed column: services.${column}`);
        } catch (error) {
          console.log(`Column services.${column} might not exist, skipping...`);
        }
      }

      console.log('Auto-confirmation fields migration rollback completed successfully!');

    } catch (error) {
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }
};