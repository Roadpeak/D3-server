// models/StaffService.js - Junction table model
'use strict';

module.exports = (sequelize, DataTypes) => {
  const StaffService = sequelize.define('StaffService', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'staff',
        key: 'id',
      },
    },
    serviceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'services',
        key: 'id',
      },
    },
    // Optional: Add additional fields for the relationship
    assignedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    assignedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID of the user who assigned this staff to the service',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'staff_services',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['staffId', 'serviceId'],
        name: 'staff_service_unique'
      },
      {
        fields: ['staffId'],
        name: 'staff_service_staff_index'
      },
      {
        fields: ['serviceId'],
        name: 'staff_service_service_index'
      }
    ],
  });

  // Define associations
  StaffService.associate = (models) => {
    StaffService.belongsTo(models.Staff, {
      foreignKey: 'staffId',
      as: 'staff',
    });

    StaffService.belongsTo(models.Service, {
      foreignKey: 'serviceId',
      as: 'service',
    });
  };

  return StaffService;
};