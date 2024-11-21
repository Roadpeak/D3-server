const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid'); // Import uuidv4 for UUID generation

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: Sequelize.UUIDV4,
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
      unique: true,      // Email must be unique
      validate: {
        isEmail: true,   // Ensure email format is valid
      },
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,      // Phone number must be unique
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  // Hash password before saving the user
  User.beforeCreate(async (user) => {
    if (user.password) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      user.password = hashedPassword;
    }
  });

  // Check password validity (for login)
  User.prototype.validPassword = async function (password) {
    return bcrypt.compare(password, this.password);
  };

  return User;
};
