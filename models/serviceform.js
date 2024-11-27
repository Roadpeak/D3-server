'use strict';
module.exports = (sequelize, DataTypes) => {
  const ServiceForm = sequelize.define('ServiceForm', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    service_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Services',
        key: 'id',
      },
    },
    field_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    field_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'ServiceForms',
    timestamps: true,
  });

  ServiceForm.associate = (models) => {
    ServiceForm.belongsTo(models.Service, { foreignKey: 'service_id', as: 'service' });
  };

  return ServiceForm;
};
