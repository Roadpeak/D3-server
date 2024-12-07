const { Model, DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  class Offer extends Model { }

  Offer.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: uuidv4,
        primaryKey: true,
      },
      discount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      expiration_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        get() {
          const discount = this.getDataValue('discount');
          return discount ? discount * 0.05 : 0;
        },
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('active', 'expired', 'paused'),
        defaultValue: 'active',
      },
      service_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Services',
          key: 'id',
        },
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Offer',
    }
  );

  Offer.belongsTo(sequelize.models.Service, { foreignKey: 'service_id' });

  return Offer;
};
