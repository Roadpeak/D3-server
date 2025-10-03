'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('services', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      price: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Duration in minutes'
      },
      images: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of image URLs (max 3 images)'
      },
      image_url: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Primary image URL (for backward compatibility)'
      },
      store_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'stores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      branch_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'branches',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Specific branch where service is offered'
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('fixed', 'dynamic'),
        allowNull: false,
        defaultValue: 'fixed'
      },
      pricing_factors: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Factors that determine pricing for dynamic services'
      },
      price_range: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Estimated price range for dynamic services'
      },
      consultation_required: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether consultation is required before service delivery'
      },
      auto_confirm_bookings: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether to automatically confirm bookings or require manual confirmation'
      },
      confirmation_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Custom message sent to clients when booking is confirmed'
      },
      require_prepayment: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether prepayment is required before confirmation'
      },
      cancellation_policy: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Cancellation policy for this service'
      },
      min_cancellation_hours: {
        type: Sequelize.INTEGER,
        defaultValue: 2,
        comment: 'Minimum hours before appointment that cancellation is allowed'
      },
      allow_early_checkin: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether clients can check in before their scheduled time'
      },
      early_checkin_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 15,
        comment: 'How many minutes early a client can check in'
      },
      auto_complete_on_duration: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether to automatically mark booking as complete after service duration'
      },
      grace_period_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 10,
        comment: 'Grace period after scheduled time before marking as no-show'
      },
      max_concurrent_bookings: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Maximum number of bookings at the same time slot'
      },
      allow_overbooking: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether to allow bookings beyond max_concurrent_bookings'
      },
      slot_interval: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Time between slots in minutes'
      },
      blackout_dates: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of blackout dates/periods for this service'
      },
      min_advance_booking: {
        type: Sequelize.INTEGER,
        defaultValue: 30,
        comment: 'Minimum minutes in advance that booking can be made'
      },
      max_advance_booking: {
        type: Sequelize.INTEGER,
        defaultValue: 10080,
        comment: 'Maximum minutes in advance that booking can be made'
      },
      buffer_time: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Buffer time in minutes between consecutive bookings'
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'suspended'),
        defaultValue: 'active'
      },
      booking_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Whether booking is enabled for this service'
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Tags for better searchability'
      },
      featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether service should be featured'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Soft delete timestamp'
      }
    });

    // Add indexes
    await queryInterface.addIndex('services', ['store_id'], {
      name: 'idx_services_store_id'
    });

    await queryInterface.addIndex('services', ['branch_id'], {
      name: 'idx_services_branch_id'
    });

    await queryInterface.addIndex('services', ['status', 'booking_enabled'], {
      name: 'idx_services_status_booking'
    });

    await queryInterface.addIndex('services', ['store_id', 'category', 'status'], {
      name: 'idx_services_store_category_status'
    });

    await queryInterface.addIndex('services', ['featured', 'status'], {
      name: 'idx_services_featured_status'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('services');
  }
};