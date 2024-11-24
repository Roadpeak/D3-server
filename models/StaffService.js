'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const StaffService = sequelize.define('StaffService', {
    id: {
      type: DataTypes.UUID,
      defaultValue: uuidv4,
      primaryKey: true,
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Staff',
        key: 'id',
      },
    },
    serviceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Services',
        key: 'id',
      },
    },
  }, {
    sequelize,
    modelName: 'StaffService',
    tableName: 'StaffServices',
    timestamps: false, // No timestamps for the join table
  });

  return StaffService;
};
