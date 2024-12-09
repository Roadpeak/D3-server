const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Merchant = sequelize.define('Merchant', {
    id: {
      type: DataTypes.UUID,
      defaultValue: uuidv4,
      primaryKey: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  Merchant.beforeCreate(async (merchant) => {
    const existingMerchant = await Merchant.findOne({ where: { email: merchant.email } });
    if (existingMerchant) {
      throw new Error('Merchant with this email already exists');
    }

    const existingPhone = await Merchant.findOne({ where: { phoneNumber: merchant.phoneNumber } });
    if (existingPhone) {
      throw new Error('Merchant with this phone number already exists');
    }

    if (merchant.password) {
      const hashedPassword = await bcrypt.hash(merchant.password, 10);
      merchant.password = hashedPassword;
    }
  });


  Merchant.associate = (models) => {
    Merchant.hasMany(models.Store, {
      foreignKey: 'merchant_id',
      onDelete: 'CASCADE',
    });
  };

  Merchant.prototype.validPassword = async function (password) {
    return bcrypt.compare(password, this.password);
  };

  return Merchant;
};
