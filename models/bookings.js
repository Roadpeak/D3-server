const { Model, DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  class Booking extends Model { }

  Booking.init(
    {
      id: {
        type: DataTypes.UUID,  // Changed to UUID to match the DB type
        defaultValue: uuidv4,
        primaryKey: true,
      },
      offerId: {
        type: DataTypes.UUID,  // Changed to UUID to match 'Offer.id' type
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,  // Changed to UUID to match DB type
        allowNull: false,
      },
      paymentId: {
        type: DataTypes.UUID,  // Changed to UUID to match DB type
        allowNull: true,
      },
      paymentUniqueCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'cancelled', 'fulfilled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      startTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      endTime: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      qrCode: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Booking',
      tableName: 'Bookings',
      timestamps: true,
    }
  );

  // Define associations with other models
  Booking.associate = (models) => {
    // The association with Offer model
    Booking.belongsTo(models.Offer, { foreignKey: 'offerId' });

    // The association with Store model
    Booking.belongsTo(models.Store, { foreignKey: 'storeId' });
  };

  return Booking;
};
