// migrations/YYYYMMDDHHMMSS-enhance-services-with-concurrent-bookings.js

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🔄 Starting service table enhancement...');

      // Add new columns to services table
      await queryInterface.addColumn('services', 'max_concurrent_bookings', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: 1,
          max: 50
        },
        comment: 'Maximum number of bookings that can be scheduled at the same time slot'
      });

      await queryInterface.addColumn('services', 'allow_overbooking', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether to allow bookings beyond max_concurrent_bookings'
      });

      await queryInterface.addColumn('services', 'slot_interval', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Time between slots in minutes (defaults to duration if null)'
      });

      await queryInterface.addColumn('services', 'buffer_time', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Buffer time in minutes between consecutive bookings'
      });

      await queryInterface.addColumn('services', 'min_advance_booking', {
        type: Sequelize.INTEGER,
        defaultValue: 30,
        comment: 'Minimum minutes in advance that booking can be made'
      });

      await queryInterface.addColumn('services', 'max_advance_booking', {
        type: Sequelize.INTEGER,
        defaultValue: 10080, // 7 days in minutes
        comment: 'Maximum minutes in advance that booking can be made'
      });

      await queryInterface.addColumn('services', 'status', {
        type: Sequelize.ENUM('active', 'inactive', 'suspended'),
        defaultValue: 'active'
      });

      await queryInterface.addColumn('services', 'booking_enabled', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether booking is enabled for this service'
      });

      // Add indexes for better performance
      await queryInterface.addIndex('services', ['status'], {
        name: 'services_status_index'
      });

      await queryInterface.addIndex('services', ['booking_enabled'], {
        name: 'services_booking_enabled_index'
      });

      await queryInterface.addIndex('services', ['max_concurrent_bookings'], {
        name: 'services_max_concurrent_index'
      });

      console.log('✅ Service table enhancement completed successfully');

      // Update existing services to have reasonable defaults
      await queryInterface.sequelize.query(`
        UPDATE services 
        SET 
          max_concurrent_bookings = 1,
          allow_overbooking = false,
          buffer_time = 0,
          min_advance_booking = 30,
          max_advance_booking = 10080,
          status = 'active',
          booking_enabled = true
        WHERE max_concurrent_bookings IS NULL
      `);

      console.log('✅ Updated existing services with new defaults');

    } catch (error) {
      console.error('❌ Error enhancing services table:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('🔄 Reverting service table enhancements...');

      // Remove indexes
      await queryInterface.removeIndex('services', 'services_status_index');
      await queryInterface.removeIndex('services', 'services_booking_enabled_index');
      await queryInterface.removeIndex('services', 'services_max_concurrent_index');

      // Remove columns
      await queryInterface.removeColumn('services', 'max_concurrent_bookings');
      await queryInterface.removeColumn('services', 'allow_overbooking');
      await queryInterface.removeColumn('services', 'slot_interval');
      await queryInterface.removeColumn('services', 'buffer_time');
      await queryInterface.removeColumn('services', 'min_advance_booking');
      await queryInterface.removeColumn('services', 'max_advance_booking');
      await queryInterface.removeColumn('services', 'status');
      await queryInterface.removeColumn('services', 'booking_enabled');

      console.log('✅ Service table enhancements reverted successfully');

    } catch (error) {
      console.error('❌ Error reverting services table:', error);
      throw error;
    }
  }
};