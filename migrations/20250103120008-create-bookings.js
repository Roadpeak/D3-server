'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bookings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      offerId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'offers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      serviceId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'services',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'For direct service bookings (not through offers)'
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      storeId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'stores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      branchId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'branches',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Branch where the service will be provided'
      },
      staffId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'staff',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      paymentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'payments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      paymentUniqueCode: {
        type: Sequelize.INTEGER,
        allowNull: true,
        unique: true
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'confirmed',
          'in_progress',
          'completed',
          'cancelled',
          'no_show',
          'fulfilled'
        ),
        allowNull: false,
        defaultValue: 'pending'
      },
      bookingType: {
        type: Sequelize.ENUM('offer', 'service'),
        allowNull: false,
        defaultValue: 'offer'
      },
      startTime: {
        type: Sequelize.DATE,
        allowNull: false
      },
      endTime: {
        type: Sequelize.DATE,
        allowNull: false
      },
      accessFee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
        comment: 'Platform access fee paid by user'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User notes for the booking'
      },
      merchantNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Merchant notes for the booking'
      },
      cancellationReason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      qrCode: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'URL to QR code image for verification'
      },
      verificationCode: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Additional verification code'
      },
      confirmedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelledAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'ID of user who created the booking'
      },
      updatedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'ID of user who last updated the booking'
      },
      fulfilledBy: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'ID of merchant/staff who fulfilled the booking'
      },
      clientInfo: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional client information if different from user'
      },
      reminderSent: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether reminder email/SMS was sent'
      },
      reminderSentAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isWalkIn: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this was a walk-in booking'
      },
      sourceChannel: {
        type: Sequelize.ENUM('web', 'mobile', 'walk-in', 'phone', 'admin'),
        defaultValue: 'web',
        comment: 'Channel through which booking was made'
      },
      hasReview: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      rating: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      reviewText: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      reviewDate: {
        type: Sequelize.DATE,
        allowNull: true
      },
      auto_confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether booking was auto-confirmed by system'
      },
      confirmation_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Notes about confirmation decision'
      },
      audit_trail: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Audit trail of auto-confirmation decisions'
      },
      manually_confirmed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether booking was manually confirmed by merchant'
      },
      confirmed_by: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Who confirmed the booking (system/merchant name)'
      },
      confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the booking was confirmed'
      },
      no_show_marked_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the booking was marked as no-show'
      },
      no_show_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for no-show status'
      },
      no_show_details: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional details about no-show processing'
      },
      auto_completed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Whether booking was auto-completed by system'
      },
      completion_method: {
        type: Sequelize.ENUM('manual', 'automatic'),
        allowNull: true,
        comment: 'How the booking was completed'
      },
      completion_details: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Details about the completion process'
      },
      actual_duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Actual service duration in minutes'
      },
      service_started_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the service actually started'
      },
      service_end_time: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Calculated end time based on start time + duration'
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
      }
    });

    // Add indexes
    await queryInterface.addIndex('bookings', ['userId'], {
      name: 'idx_bookings_user_id'
    });

    await queryInterface.addIndex('bookings', ['storeId'], {
      name: 'idx_bookings_store_id'
    });

    await queryInterface.addIndex('bookings', ['offerId'], {
      name: 'idx_bookings_offer_id'
    });

    await queryInterface.addIndex('bookings', ['serviceId'], {
      name: 'idx_bookings_service_id'
    });

    await queryInterface.addIndex('bookings', ['storeId', 'status', 'startTime'], {
      name: 'idx_bookings_store_status_time'
    });

    await queryInterface.addIndex('bookings', ['userId', 'status'], {
      name: 'idx_bookings_user_status'
    });

    await queryInterface.addIndex('bookings', ['staffId', 'startTime', 'endTime', 'status'], {
      name: 'idx_bookings_staff_schedule'
    });

    await queryInterface.addIndex('bookings', ['startTime'], {
      name: 'idx_bookings_start_time'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('bookings');
  }
};