'use strict';
module.exports = (sequelize, DataTypes) => {
  const FormResponse = sequelize.define('FormResponse', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    service_form_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ServiceForms',
        key: 'id',
      },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    response_data: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  }, {
    tableName: 'FormResponses',
    timestamps: true,
  });

  FormResponse.associate = (models) => {
    FormResponse.belongsTo(models.ServiceForm, { foreignKey: 'service_form_id', as: 'form' });
  };

  return FormResponse;
};
