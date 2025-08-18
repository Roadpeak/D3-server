// migrations/YYYYMMDD-add-referral-system.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add referral columns to users table
    await queryInterface.addColumn('users', 'referralSlug', {
      type: Sequelize.STRING(50),
      allowNull: true,
      unique: true,
      comment: 'Unique referral slug for this user (user-friendly)'
    });

    await queryInterface.addColumn('users', 'referralLink', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Full referral link for this user'
    });

    await queryInterface.addColumn('users', 'referredBy', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'ID of user who referred this user'
    });

    await queryInterface.addColumn('users', 'referredAt', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When this user was referred'
    });

    // Create referral_earnings table
    await queryInterface.createTable('referral_earnings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      referrerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
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
          key: 'id',
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
          key: 'id',
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
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('users', ['referralSlug'], {
      name: 'users_referral_slug_index',
      unique: true
    });

    await queryInterface.addIndex('users', ['referredBy'], {
      name: 'users_referred_by_index'
    });

    await queryInterface.addIndex('referral_earnings', ['referrerId'], {
      name: 'referral_earnings_referrer_id_index'
    });

    await queryInterface.addIndex('referral_earnings', ['refereeId'], {
      name: 'referral_earnings_referee_id_index'
    });

    await queryInterface.addIndex('referral_earnings', ['bookingId'], {
      name: 'referral_earnings_booking_id_index'
    });

    await queryInterface.addIndex('referral_earnings', ['status'], {
      name: 'referral_earnings_status_index'
    });

    await queryInterface.addIndex('referral_earnings', ['createdAt'], {
      name: 'referral_earnings_created_at_index'
    });

    // Add unique constraint to prevent duplicate earnings for same booking
    await queryInterface.addIndex('referral_earnings', ['bookingId'], {
      name: 'referral_earnings_booking_unique',
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('referral_earnings', 'referral_earnings_booking_unique');
    await queryInterface.removeIndex('referral_earnings', 'referral_earnings_created_at_index');
    await queryInterface.removeIndex('referral_earnings', 'referral_earnings_status_index');
    await queryInterface.removeIndex('referral_earnings', 'referral_earnings_booking_id_index');
    await queryInterface.removeIndex('referral_earnings', 'referral_earnings_referee_id_index');
    await queryInterface.removeIndex('referral_earnings', 'referral_earnings_referrer_id_index');
    await queryInterface.removeIndex('users', 'users_referred_by_index');
    await queryInterface.removeIndex('users', 'users_referral_slug_index');

    // Drop referral_earnings table
    await queryInterface.dropTable('referral_earnings');

    // Remove referral columns from users table
    await queryInterface.removeColumn('users', 'referredAt');
    await queryInterface.removeColumn('users', 'referredBy');
    await queryInterface.removeColumn('users', 'referralLink');
    await queryInterface.removeColumn('users', 'referralSlug');
  }
};

// To run this migration:
// npx sequelize-cli db:migrate

// Example seed data for testing (optional):
// migrations/seeds/YYYYMMDD-seed-referral-links.js
/*
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Generate referral slugs and links for existing users who don't have them
    const users = await queryInterface.sequelize.query(
      'SELECT id, "firstName", "lastName" FROM users WHERE "referralSlug" IS NULL',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const user of users) {
      const referralSlug = generateReferralSlug(user.id, user.firstName, user.lastName);
      const referralLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accounts/sign-up?ref=${referralSlug}`;
      
      await queryInterface.sequelize.query(
        'UPDATE users SET "referralSlug" = :slug, "referralLink" = :link WHERE id = :id',
        {
          replacements: { slug: referralSlug, link: referralLink, id: user.id },
          type: queryInterface.sequelize.QueryTypes.UPDATE
        }
      );
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove all referral slugs and links
    await queryInterface.sequelize.query(
      'UPDATE users SET "referralSlug" = NULL, "referralLink" = NULL'
    );
  }
};

function generateReferralSlug(id, firstName, lastName) {
  const nameSlug = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  const shortId = id.toString().substring(0, 8);
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  
  return `${nameSlug}-${shortId}-${randomSuffix}`;
}
*/