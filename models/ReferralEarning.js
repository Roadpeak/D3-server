// models/ReferralEarning.js - New model for tracking referral earnings
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ReferralEarning extends Model {
    static associate(models) {
      // Referrer - the user who gets the earning
      ReferralEarning.belongsTo(models.User, {
        foreignKey: 'referrerId',
        as: 'referrer'
      });

      // Referee - the user who made the booking
      ReferralEarning.belongsTo(models.User, {
        foreignKey: 'refereeId',
        as: 'referee'
      });

      // The booking that generated this earning
      ReferralEarning.belongsTo(models.Booking, {
        foreignKey: 'bookingId',
        as: 'booking'
      });
    }
  }

  ReferralEarning.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      referrerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        comment: 'User who gets the earning'
      },
      refereeId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        comment: 'User who made the booking'
      },
      bookingId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'bookings',
          key: 'id',
        },
        comment: 'Booking that generated this earning'
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Amount earned in KES'
      },
      accessFee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Original access fee paid by referee'
      },
      commissionRate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        defaultValue: 0.30,
        comment: 'Commission rate (30% = 0.30)'
      },
      status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'paid', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Status of the earning'
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the earning was paid out'
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes about the earning'
      }
    },
    {
      sequelize,
      modelName: 'ReferralEarning',
      tableName: 'referral_earnings',
      timestamps: true,
      indexes: [
        {
          fields: ['referrerId'],
          name: 'referral_earnings_referrer_id_index'
        },
        {
          fields: ['refereeId'],
          name: 'referral_earnings_referee_id_index'
        },
        {
          fields: ['bookingId'],
          name: 'referral_earnings_booking_id_index'
        },
        {
          fields: ['status'],
          name: 'referral_earnings_status_index'
        },
        {
          fields: ['createdAt'],
          name: 'referral_earnings_created_at_index'
        }
      ],
      hooks: {
        afterCreate: async (earning) => {
          console.log(`💰 New referral earning created: KES ${earning.amount} for user ${earning.referrerId}`);
        }
      }
    }
  );

  return ReferralEarning;
};

// Update User model to include referral fields
// Add these fields to your existing User model:

/*
// Add to User model attributes:
referralSlug: {
  type: DataTypes.STRING(50),
  allowNull: true,
  unique: true,
  comment: 'Unique referral slug for this user (user-friendly)'
},
referralLink: {
  type: DataTypes.STRING(255),
  allowNull: true,
  comment: 'Full referral link for this user'
},
referredBy: {
  type: DataTypes.UUID,
  allowNull: true,
  references: {
    model: 'users',
    key: 'id',
  },
  comment: 'ID of user who referred this user'
},
referredAt: {
  type: DataTypes.DATE,
  allowNull: true,
  comment: 'When this user was referred'
},

// Add to User associations:
// User has many referral earnings as referrer
User.hasMany(models.ReferralEarning, {
  foreignKey: 'referrerId',
  as: 'referralEarnings'
});

// User has many referrals (users they referred)
User.hasMany(models.User, {
  foreignKey: 'referredBy',
  as: 'referrals'
});

// User belongs to referrer
User.belongsTo(models.User, {
  foreignKey: 'referredBy',
  as: 'referrer'
});
*/