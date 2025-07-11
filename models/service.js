// Service.js - Fixed version
'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Service = sequelize.define('Service', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4, // Fixed: use DataTypes.UUIDV4 instead of uuidv4()
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    store_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stores', // Changed to lowercase
        key: 'id',
      },
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('fixed', 'dynamic'),
      allowNull: false,
      defaultValue: 'fixed',
    },
  }, {
    tableName: 'services', // Changed to lowercase
    timestamps: true,
    paranoid: true,
    indexes: [],
  });

  // Fixed associations
  Service.associate = (models) => {
    // Many-to-Many relationship with Staff through StaffService
    Service.belongsToMany(models.Staff, {
      through: models.StaffService,
      foreignKey: 'serviceId',
      otherKey: 'staffId',
      as: 'staff',
    });

    // Service belongs to a Store (one-to-many)
    Service.belongsTo(models.Store, {
      foreignKey: 'store_id',
      as: 'store', // Use consistent alias
      onDelete: 'CASCADE',
    });
  

    Service.hasMany(models.Offer, {
    foreignKey: 'service_id',
    as: 'offers'
    });

  };  

  return Service;
};