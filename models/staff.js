'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const Staff = sequelize.define('Staff', {
    id: {
      type: DataTypes.UUID,
      defaultValue: uuidv4,
      primaryKey: true,
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'Staff',
  });

  // Add the associate method to define associations
  Staff.associate = (models) => {
    // Many-to-Many relationship with Service through StaffService
    Staff.belongsToMany(models.Service, {
      through: models.StaffService,
      foreignKey: 'staffId',
      otherKey: 'serviceId',
      as: 'services',
    });

    Staff.hasMany(Service, {
      foreignKey: 'staffId', // Or whatever the key is in the Services table
      as: 'Services', // Ensure this alias matches the one in the query
    });

    // Staff belongs to a Store (one-to-many)
    Staff.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store',
    });
  };

  return Staff;
};
