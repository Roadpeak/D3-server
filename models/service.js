'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Service = sequelize.define('Service', {
    id: {
      type: DataTypes.UUID,
      defaultValue: uuidv4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: true, // For dynamic services, price can be null
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true, // Optional for dynamic services
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    store_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Stores',
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
    tableName: 'Services',
    timestamps: true,
    paranoid: true,
    indexes: [],
  });

  // Add the associate method to define associations
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
      onDelete: 'CASCADE',
      as: 'store',
    });
  };

  return Service;
};
