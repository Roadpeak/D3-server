const { Model, DataTypes } = require('sequelize'); // Import DataTypes and Model
const { v4: uuidv4 } = require('uuid'); // Import uuidv4 to generate UUIDs

module.exports = (sequelize) => {
  class Booking extends Model {}

  Booking.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: uuidv4, // Use uuidv4 for the default value
        primaryKey: true,
      },
      offerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      paymentId: {
        type: DataTypes.INTEGER,
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
        allowNull: false, // Bookings require a start time
      },
      endTime: {
        type: DataTypes.DATE,
        allowNull: false, // Bookings require an end time
      },
      qrCode: {
        type: DataTypes.TEXT, // Use TEXT to store the base64 QR code
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Booking', // Set the model name for the sequelize instance
      tableName: 'Bookings', // Define the table name explicitly
      timestamps: true, // Automatically add createdAt and updatedAt
    }
  );

  return Booking;
};
