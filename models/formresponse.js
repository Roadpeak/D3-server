'use strict';
module.exports = (sequelize, DataTypes) => {
  const FormResponse = sequelize.define('FormResponse', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    form_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Forms',
        key: 'id',
      },
    },
    response_data: {
      type: DataTypes.JSON, // Change JSONB to JSON
      allowNull: false,
    },
  }, {
    tableName: 'FormResponses',
    timestamps: true,
  });

  FormResponse.associate = (models) => {
    FormResponse.belongsTo(models.Form, {
      foreignKey: 'form_id',
      as: 'form',
    });
  };

  return FormResponse;
};
