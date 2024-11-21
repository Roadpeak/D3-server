module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,  // Cannot be null
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,  // Cannot be null
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,  // Cannot be null
      unique: true,      // Email must be unique
      validate: {
        isEmail: true,   // Ensure email format is valid
      },
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,  // Cannot be null
      unique: true,      // Phone number must be unique
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,  // Cannot be null
    },
  });

  // Hash password before saving the user (optional for security)
  const bcrypt = require('bcryptjs');
  User.beforeCreate(async (user) => {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    user.password = hashedPassword;
  });

  return User;
};
