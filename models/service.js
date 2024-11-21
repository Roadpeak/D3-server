'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Service = sequelize.define('Service', {
    id: {
      type: DataTypes.UUID,
      defaultValue: uuidv4,  // Automatically generate a UUID
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    duration: {
      type: DataTypes.INTEGER, // in minutes
      allowNull: false,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    store_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Stores', // assuming you have a Stores table
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
  }, {
    tableName: 'Services',
    timestamps: true,
    paranoid: true, // If you want soft deletes (optional)
    indexes: [], // This will prevent automatic indexing on columns
  });

  Service.associate = function (models) {
    // A service belongs to a store
    Service.belongsTo(models.Store, {
      foreignKey: 'store_id',
      onDelete: 'CASCADE',
    });
  };

  return Service;
};
