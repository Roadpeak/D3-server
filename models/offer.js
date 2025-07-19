// models/Offer.js - Updated and Fixed
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Offer extends Model { 
    static associate(models) {
      // Define associations here
      Offer.belongsTo(models.Service, {
        foreignKey: 'service_id',
        as: 'service', // Changed to match controller expectations
        onDelete: 'CASCADE'
      });
      
      // Remove the Store association since offers are linked through services
      // The store relationship is: Offer -> Service -> Store
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
        type: DataTypes.DECIMAL(5, 2), // Changed to allow up to 999.99%
        allowNull: false,
        validate: {
          min: 0,
          max: 100
        }
      },
      expiration_date: {
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
          isDate: true,
          isAfter: new Date().toISOString().split('T')[0] // Must be future date
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
        comment: 'Platform fee for this offer'
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
    },
    {
      sequelize,
      modelName: 'Offer',
      tableName: 'offers',
      timestamps: true,
      paranoid: false, // Set to true if you want soft deletes
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
        },
        beforeUpdate: (offer) => {
          // Recalculate fee if discount changed
          if (offer.changed('discount') && offer.discount) {
            offer.fee = (offer.discount * 0.05).toFixed(2);
          }
          
          // Auto-expire offers past expiration date
          if (offer.expiration_date && new Date(offer.expiration_date) < new Date()) {
            offer.status = 'expired';
          }
        }
      }
    }
  );

  return Offer;
};