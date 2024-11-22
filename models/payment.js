module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
    offer_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    phone_number: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'successful', 'failed'),
      defaultValue: 'pending',
      allowNull: false
    },
    gateway: {
      type: DataTypes.STRING,
      allowNull: false
    },
    MerchantRequestID: {
      type: DataTypes.STRING,
      allowNull: false
    },
    payment_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    unique_code: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: true
    }
  });

  return Payment;
};
