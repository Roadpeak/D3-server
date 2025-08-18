// models/Favorite.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Favorite extends Model {
    static associate(models) {
      // Favorite belongs to User
      Favorite.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });

      // Favorite belongs to Offer
      Favorite.belongsTo(models.Offer, {
        foreignKey: 'offer_id',
        as: 'offer',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }

    // Instance methods
    toJSON() {
      const values = { ...this.get() };
      
      // Format dates
      if (values.created_at) {
        values.created_at = values.created_at.toISOString();
      }
      if (values.updated_at) {
        values.updated_at = values.updated_at.toISOString();
      }

      return values;
    }
  }

  Favorite.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'User ID is required'
        },
        isInt: {
          msg: 'User ID must be an integer'
        }
      }
    },
    offer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Offer ID is required'
        },
        isInt: {
          msg: 'Offer ID must be an integer'
        }
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'Favorite',
    tableName: 'Favorites',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'offer_id'],
        name: 'unique_user_offer_favorite'
      },
      {
        fields: ['user_id'],
        name: 'favorites_user_id_index'
      },
      {
        fields: ['offer_id'],
        name: 'favorites_offer_id_index'
      },
      {
        fields: ['created_at'],
        name: 'favorites_created_at_index'
      }
    ],
    hooks: {
      beforeCreate: (favorite, options) => {
        favorite.created_at = new Date();
        favorite.updated_at = new Date();
      },
      beforeUpdate: (favorite, options) => {
        favorite.updated_at = new Date();
      }
    }
  });

  return Favorite;
};