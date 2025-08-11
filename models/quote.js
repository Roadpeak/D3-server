'use strict';
module.exports = (sequelize, DataTypes) => {
  const Quote = sequelize.define('Quote', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    form_response_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'form_responses',
        key: 'id',
      },
    },
    quote_details: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
    },
  }, {
    tableName: 'quotes',
    timestamps: true,
  });

  Quote.associate = (models) => {
    // Define associations if necessary
    Quote.belongsTo(models.FormResponse, {
      foreignKey: 'form_response_id',
      as: 'formResponse',
    });
  };

  return Quote;
};
