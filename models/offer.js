// models/Offer.js - Optimized with reduced indexes
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Offer extends Model {
    static associate(models) {
      Offer.belongsTo(models.Service, {
        foreignKey: 'service_id',
        as: 'service',
        onDelete: 'CASCADE'
      });

      Offer.hasMany(models.Booking, {
        foreignKey: 'offerId',
        as: 'bookings',
        onDelete: 'CASCADE'
      });

      Offer.hasMany(models.Favorite, {
        foreignKey: 'offer_id',
        as: 'favorites',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });

      Offer.belongsToMany(models.User, {
        through: models.Favorite,
        foreignKey: 'offer_id',
        otherKey: 'user_id',
        as: 'favoriteUsers',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }

    isDynamic() {
      return this.offer_type === 'dynamic';
    }

    isFixed() {
      return this.offer_type === 'fixed';
    }

    isExpired() {
      return new Date(this.expiration_date) < new Date();
    }

    isActive() {
      return this.status === 'active' && !this.isExpired();
    }

    canBeBooked() {
      return this.isActive() &&
        (!this.max_redemptions || this.current_redemptions < this.max_redemptions);
    }

    getDiscountText() {
      if (this.isDynamic()) {
        return this.discount_explanation ||
          `${this.discount}% off the final quoted price`;
      } else {
        return `${this.discount}% OFF`;
      }
    }

    getAccessFee() {
      return (this.discount * 0.15).toFixed(2);
    }

    incrementView() {
      return this.increment('view_count');
    }

    incrementClick() {
      return this.increment('click_count');
    }

    incrementBooking() {
      return this.increment(['booking_count', 'current_redemptions']);
    }

    static getActiveOffers(options = {}) {
      return this.findAll({
        where: {
          status: 'active',
          expiration_date: {
            [sequelize.Op.gt]: new Date()
          },
          ...options.where
        },
        ...options
      });
    }

    static getDynamicOffers(options = {}) {
      return this.findAll({
        where: {
          offer_type: 'dynamic',
          status: 'active',
          expiration_date: {
            [sequelize.Op.gt]: new Date()
          },
          ...options.where
        },
        ...options
      });
    }

    static getFixedOffers(options = {}) {
      return this.findAll({
        where: {
          offer_type: 'fixed',
          status: 'active',
          expiration_date: {
            [sequelize.Op.gt]: new Date()
          },
          ...options.where
        },
        ...options
      });
    }
  }

  Offer.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      service_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'services',
          key: 'id',
        },
      },
      title: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Custom title for the offer'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      discount: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        validate: {
          min: 0,
          max: 100
        },
        comment: 'Discount percentage (0-100)'
      },
      offer_type: {
        type: DataTypes.ENUM('fixed', 'dynamic'),
        allowNull: false,
        defaultValue: 'fixed',
        comment: 'Whether this is a fixed service offer or dynamic service offer'
      },
      discount_explanation: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Explanation of how discount applies for dynamic services'
      },
      expiration_date: {
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
          isDate: true,
          isAfter: new Date().toISOString().split('T')[0]
        }
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'expired', 'paused'),
        defaultValue: 'active',
      },
      featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this offer should be featured'
      },
      fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Platform access fee for this offer'
      },
      terms_conditions: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Terms and conditions for this offer'
      },
      max_redemptions: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment: 'Maximum number of times this offer can be redeemed'
      },
      current_redemptions: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Current number of redemptions'
      },
      requires_consultation: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this offer requires consultation before booking'
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID of the user who created this offer'
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID of the user who last updated this offer'
      },
      view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of times this offer has been viewed'
      },
      click_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of times this offer has been clicked'
      },
      booking_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of bookings made for this offer'
      }
    },
    {
      sequelize,
      modelName: 'Offer',
      tableName: 'offers',
      timestamps: true,
      paranoid: false,
      indexes: [
        // Foreign key index
        {
          fields: ['service_id'],
          name: 'idx_offers_service_id'
        },
        // Composite index for active offers filtering
        {
          fields: ['status', 'expiration_date'],
          name: 'idx_offers_status_expiration'
        },
        // Composite index for featured active offers
        {
          fields: ['featured', 'status'],
          name: 'idx_offers_featured_status'
        },
        // Composite index for offer type filtering
        {
          fields: ['offer_type', 'status'],
          name: 'idx_offers_type_status'
        }
      ],
      hooks: {
        beforeCreate: (offer) => {
          if (!offer.fee && offer.discount) {
            offer.fee = (offer.discount * 0.05).toFixed(2);
          }

          if (offer.offer_type === 'dynamic' && !offer.discount_explanation) {
            offer.discount_explanation = `${offer.discount}% off the final quoted price that will be agreed upon after consultation`;
          }
        },

        beforeUpdate: (offer) => {
          if (offer.changed('discount') && offer.discount) {
            offer.fee = (offer.discount * 0.05).toFixed(2);
          }

          if (offer.changed('discount') && offer.offer_type === 'dynamic') {
            if (!offer.discount_explanation || offer.discount_explanation.includes('% off')) {
              offer.discount_explanation = `${offer.discount}% off the final quoted price that will be agreed upon after consultation`;
            }
          }

          if (offer.expiration_date && new Date(offer.expiration_date) < new Date()) {
            offer.status = 'expired';
          }
        },

        afterCreate: async (offer) => {
          console.log(`🎯 New ${offer.offer_type} offer created:`, offer.id);
        },

        afterUpdate: async (offer) => {
          if (offer.changed('status')) {
            console.log(`🎯 Offer ${offer.id} status changed to: ${offer.status}`);
          }
        }
      }
    }
  );

  return Offer;
};