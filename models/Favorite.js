// models/Favorite.js - Optimized with reduced indexes
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Favorite extends Model {
    static associate(models) {
      Favorite.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });

      Favorite.belongsTo(models.Offer, {
        foreignKey: 'offer_id',
        as: 'offer',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }

    toJSON() {
      const values = { ...this.get() };
      
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
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'User ID is required'
        },
        isUUID: {
          args: 4,
          msg: 'User ID must be a valid UUID'
        }
      },
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    offer_id: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Offer ID is required'
        },
        isUUID: {
          args: 4,
          msg: 'Offer ID must be a valid UUID'
        }
      },
      references: {
        model: 'Offers',
        key: 'id'
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
      // Unique constraint for one favorite per user-offer pair
      {
        unique: true,
        fields: ['user_id', 'offer_id'],
        name: 'idx_favorites_user_offer_unique'
      },
      // Foreign key indexes
      {
        fields: ['user_id'],
        name: 'idx_favorites_user_id'
      },
      {
        fields: ['offer_id'],
        name: 'idx_favorites_offer_id'
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