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
        model: 'FormResponses',
        key: 'id',
      },
    },
    quote_amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    quote_details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending',
    },
  }, {
    tableName: 'Quotes',
    timestamps: true,
  });

  Quote.associate = (models) => {
    Quote.belongsTo(models.FormResponse, { foreignKey: 'form_response_id', as: 'response' });
  };

  return Quote;
};
