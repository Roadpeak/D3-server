'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('referral_earnings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      referrerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'User who gets the earning'
      },
      refereeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'User who made the booking'
      },
      bookingId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'bookings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Booking that generated this earning'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Amount earned in KES'
      },
      accessFee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Original access fee paid by referee'
      },
      commissionRate: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false,
        defaultValue: 0.30,
        comment: 'Commission rate (30% = 0.30)'
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'paid', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Status of the earning'
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the earning was paid out'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Additional notes about the earning'
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
    await queryInterface.addIndex('referral_earnings', ['referrerId'], {
      name: 'referral_earnings_referrer_id_index'
    });

    await queryInterface.addIndex('referral_earnings', ['refereeId'], {
      name: 'referral_earnings_referee_id_index'
    });

    await queryInterface.addIndex('referral_earnings', ['bookingId'], {
      name: 'referral_earnings_booking_id_unique',
      unique: true
    });

    await queryInterface.addIndex('referral_earnings', ['status'], {
      name: 'referral_earnings_status_index'
    });

    await queryInterface.addIndex('referral_earnings', ['createdAt'], {
      name: 'referral_earnings_created_at_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('referral_earnings');
  }
};