'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('services', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      price: {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: 'Null for dynamic services'
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Duration in minutes, null for dynamic services'
      },
      // Support for multiple images
      images: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Array of image URLs (max 3 images)'
      },
      // Keep for backward compatibility
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
      // Dynamic service fields
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
      // NEW: Booking confirmation settings
      auto_confirm_bookings: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
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
        allowNull: false,
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
        allowNull: false,
        comment: 'Minimum hours before appointment that cancellation is allowed'
      },
      // Check-in and service completion settings
      allow_early_checkin: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether clients can check in before their scheduled time'
      },
      early_checkin_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 15,
        allowNull: false,
        comment: 'How many minutes early a client can check in'
      },
      auto_complete_on_duration: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether to automatically mark booking as complete after service duration'
      },
      grace_period_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 10,
        allowNull: false,
        comment: 'Grace period after scheduled time before marking as no-show'
      },
      // Booking capacity fields
      max_concurrent_bookings: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Maximum number of bookings at the same time slot'
      },
      allow_overbooking: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether to allow bookings beyond max_concurrent_bookings'
      },
      slot_interval: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Time between slots in minutes'
      },
      buffer_time: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Buffer time in minutes between consecutive bookings'
      },
      // Advance booking settings
      min_advance_booking: {
        type: Sequelize.INTEGER,
        defaultValue: 30,
        allowNull: false,
        comment: 'Minimum minutes in advance that booking can be made'
      },
      max_advance_booking: {
        type: Sequelize.INTEGER,
        defaultValue: 10080, // 7 days in minutes
        allowNull: false,
        comment: 'Maximum minutes in advance that booking can be made'
      },
      // Service status
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'suspended', 'pending'),
        defaultValue: 'active',
        allowNull: false
      },
      booking_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether booking is enabled for this service'
      },
      // SEO and marketing fields
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Tags for better searchability'
      },
      featured: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether service should be featured'
      },
      // Admin fields (for future use)
      suspension_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for suspension (admin use)'
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When service was verified by admin'
      },
      verified_by: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Admin who verified the service'
      },
      // Timestamps
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Soft delete timestamp'
      }
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('services', ['store_id'], {
      name: 'services_store_id_index'
    });

    await queryInterface.addIndex('services', ['branch_id'], {
      name: 'services_branch_id_index'
    });

    await queryInterface.addIndex('services', ['auto_confirm_bookings'], {
      name: 'services_auto_confirm_index'
    });

    await queryInterface.addIndex('services', ['category'], {
      name: 'services_category_index'
    });

    await queryInterface.addIndex('services', ['type'], {
      name: 'services_type_index'
    });

    await queryInterface.addIndex('services', ['status'], {
      name: 'services_status_index'
    });

    await queryInterface.addIndex('services', ['booking_enabled'], {
      name: 'services_booking_enabled_index'
    });

    await queryInterface.addIndex('services', ['featured'], {
      name: 'services_featured_index'
    });

    await queryInterface.addIndex('services', ['createdAt'], {
      name: 'services_created_at_index'
    });

    await queryInterface.addIndex('services', ['deletedAt'], {
      name: 'services_deleted_at_index'
    });

    // Composite indexes for common queries
    await queryInterface.addIndex('services', ['store_id', 'status'], {
      name: 'services_store_status_index'
    });

    await queryInterface.addIndex('services', ['store_id', 'type'], {
      name: 'services_store_type_index'
    });

    await queryInterface.addIndex('services', ['store_id', 'featured', 'status'], {
      name: 'services_store_featured_status_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop indexes first
    await queryInterface.removeIndex('services', 'services_store_id_index');
    await queryInterface.removeIndex('services', 'services_branch_id_index');
    await queryInterface.removeIndex('services', 'services_auto_confirm_index');
    await queryInterface.removeIndex('services', 'services_category_index');
    await queryInterface.removeIndex('services', 'services_type_index');
    await queryInterface.removeIndex('services', 'services_status_index');
    await queryInterface.removeIndex('services', 'services_booking_enabled_index');
    await queryInterface.removeIndex('services', 'services_featured_index');
    await queryInterface.removeIndex('services', 'services_created_at_index');
    await queryInterface.removeIndex('services', 'services_deleted_at_index');
    await queryInterface.removeIndex('services', 'services_store_status_index');
    await queryInterface.removeIndex('services', 'services_store_type_index');
    await queryInterface.removeIndex('services', 'services_store_featured_status_index');

    // Drop the table
    await queryInterface.dropTable('services');
  }
};