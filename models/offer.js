// models/Offer.js - Enhanced for Dynamic Services
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Offer extends Model { 
    static associate(models) {
      // Define associations here
      Offer.belongsTo(models.Service, {
        foreignKey: 'service_id',
        as: 'service',
        onDelete: 'CASCADE'
      });
      
      // Offer has many bookings
      Offer.hasMany(models.Booking, {
        foreignKey: 'offerId',
        as: 'bookings',
        onDelete: 'CASCADE'
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
      // NEW: Support for dynamic offer types
      offer_type: {
        type: DataTypes.ENUM('fixed', 'dynamic'),
        allowNull: false,
        defaultValue: 'fixed',
        comment: 'Whether this is a fixed service offer or dynamic service offer'
      },
      // NEW: For dynamic offers - explain how discount works
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
      // NEW: Booking requirements
      requires_consultation: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this offer requires consultation before booking'
      },
      // Tracking fields
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
      // Analytics fields
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
        {
          fields: ['service_id'],
          name: 'offers_service_id_index'
        },
        {
          fields: ['status'],
          name: 'offers_status_index'
        },
        {
          fields: ['offer_type'],
          name: 'offers_type_index'
        },
        {
          fields: ['expiration_date'],
          name: 'offers_expiration_date_index'
        },
        {
          fields: ['featured'],
          name: 'offers_featured_index'
        }
      ],
      hooks: {
        beforeCreate: (offer) => {
          // Calculate fee if not provided (5% of discount)
          if (!offer.fee && offer.discount) {
            offer.fee = (offer.discount * 0.05).toFixed(2);
          }
          
          // Set default discount explanation for dynamic offers
          if (offer.offer_type === 'dynamic' && !offer.discount_explanation) {
            offer.discount_explanation = `${offer.discount}% off the final quoted price that will be agreed upon after consultation`;
          }
        },
        
        beforeUpdate: (offer) => {
          // Recalculate fee if discount changed
          if (offer.changed('discount') && offer.discount) {
            offer.fee = (offer.discount * 0.05).toFixed(2);
          }
          
          // Update discount explanation for dynamic offers
          if (offer.changed('discount') && offer.offer_type === 'dynamic') {
            if (!offer.discount_explanation || offer.discount_explanation.includes('% off')) {
              offer.discount_explanation = `${offer.discount}% off the final quoted price that will be agreed upon after consultation`;
            }
          }
          
          // Auto-expire offers past expiration date
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

  // Instance methods
  Offer.prototype.isDynamic = function() {
    return this.offer_type === 'dynamic';
  };

  Offer.prototype.isFixed = function() {
    return this.offer_type === 'fixed';
  };

  Offer.prototype.isExpired = function() {
    return new Date(this.expiration_date) < new Date();
  };

  Offer.prototype.isActive = function() {
    return this.status === 'active' && !this.isExpired();
  };

  Offer.prototype.canBeBooked = function() {
    return this.isActive() && 
           (!this.max_redemptions || this.current_redemptions < this.max_redemptions);
  };

  Offer.prototype.getDiscountText = function() {
    if (this.isDynamic()) {
      return this.discount_explanation || 
             `${this.discount}% off the final quoted price`;
    } else {
      return `${this.discount}% OFF`;
    }
  };

  Offer.prototype.getAccessFee = function() {
    // Access fee is 15% of the discount amount
    return (this.discount * 0.15).toFixed(2);
  };

  Offer.prototype.incrementView = function() {
    return this.increment('view_count');
  };

  Offer.prototype.incrementClick = function() {
    return this.increment('click_count');
  };

  Offer.prototype.incrementBooking = function() {
    return this.increment(['booking_count', 'current_redemptions']);
  };

  // Static methods
  Offer.getActiveOffers = function(options = {}) {
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
  };

  Offer.getDynamicOffers = function(options = {}) {
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
  };

  Offer.getFixedOffers = function(options = {}) {
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
  };

  return Offer;
};