const { User } = require('../models');

// Create a new user
exports.createUser = async (firstName, lastName, email, phoneNumber, password) => {
  try {
    const user = await User.create({ firstName, lastName, email, phoneNumber, password });
    return user;
  } catch (error) {
    throw new Error('Error creating user: ' + error.message);
  }
};

// Find a user by email or phone number
exports.findUserByEmailOrPhone = async (email, phoneNumber) => {
  try {
    return await User.findOne({
      where: {
        [Sequelize.Op.or]: [{ email }, { phoneNumber }],
      },
    });
  } catch (error) {
    throw new Error('Error finding user: ' + error.message);
  }
};

// Find a user by email (for login)
exports.findUserByEmail = async (email) => {
  try {
    return await User.findOne({ where: { email } });
  } catch (error) {
    throw new Error('Error finding user: ' + error.message);
  }
};
