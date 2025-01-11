'use strict';

module.exports = (sequelize, DataTypes) => {
  const StaffService = sequelize.define('StaffService', {
    staffId: {
      type: DataTypes.UUID,
      references: {
        model: 'Staff',  // Make sure this matches the name of the Staff model
        key: 'id',
      },
    },
    serviceId: {
      type: DataTypes.UUID,
      references: {
        model: 'Services',  // Make sure this matches the name of the Service model
        key: 'id',
      },
    },
  }, {
    tableName: 'StaffServices',
    timestamps: false,  // Disable timestamps for this model
  });

  return StaffService;
};
