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
      validate: {
        isEmail: true, // Ensure email format is valid
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

  // Hash password before saving the user
  User.beforeCreate(async (user) => {
    if (user.password) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      user.password = hashedPassword;
    }

    // Check if email already exists before creating
    const existingUser = await User.findOne({ where: { email: user.email } });
    if (existingUser) {
      throw new Error('Email is already in use');
    }
  });

  // Check password validity (for login)
  User.prototype.validPassword = async function (password) {
    return bcrypt.compare(password, this.password);
  };

  // Add indexes manually if necessary
  // User.addIndex(['email']); // Create a non-unique index on email
  // User.addIndex(['phoneNumber']); // Create a non-unique index on phoneNumber

  return User;
};
