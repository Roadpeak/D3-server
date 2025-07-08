const { User } = require('../models/user');
const { Op } = require('sequelize'); // Import Sequelize operators

// Create a new user
exports.createUser = async (firstName, lastName, email, phoneNumber, password) => {
  try {
    const user = await User.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      password
    });
    return user;
  } catch (error) {
    // Re-throw the original error to preserve Sequelize error details
    throw error;
  }
};

// Find a user by email or phone number
exports.findUserByEmailOrPhone = async (email, phoneNumber) => {
  try {
    const whereClause = [];

    if (email) {
      whereClause.push({ email });
    }

    if (phoneNumber) {
      whereClause.push({ phoneNumber });
    }

    if (whereClause.length === 0) {
      return null;
    }

    return await User.findOne({
      where: {
        [Op.or]: whereClause
      }
    });
  } catch (error) {
    throw new Error('Error finding user: ' + error.message);
  }
};

// Find a user by email (for login)
exports.findUserByEmail = async (email) => {
  try {
    if (!email) {
      return null;
    }

    return await User.findOne({
      where: { email }
    });
  } catch (error) {
    throw new Error('Error finding user: ' + error.message);
  }
};

// Find a user by phone number
exports.findUserByPhone = async (phoneNumber) => {
  try {
    if (!phoneNumber) {
      return null;
    }

    return await User.findOne({
      where: { phoneNumber }
    });
  } catch (error) {
    throw new Error('Error finding user: ' + error.message);
  }
};

// Find a user by ID
exports.findUserById = async (id) => {
  try {
    if (!id) {
      return null;
    }

    return await User.findByPk(id);
  } catch (error) {
    throw new Error('Error finding user: ' + error.message);
  }
};

// Update user information
exports.updateUser = async (id, updateData) => {
  try {
    const [affectedRows] = await User.update(updateData, {
      where: { id },
      returning: true
    });

    if (affectedRows === 0) {
      return null;
    }

    return await User.findByPk(id);
  } catch (error) {
    throw error;
  }
};

// Check if user exists by email
exports.userExistsByEmail = async (email) => {
  try {
    if (!email) {
      return false;
    }

    const user = await User.findOne({
      where: { email },
      attributes: ['id'] // Only select id to minimize data transfer
    });

    return !!user;
  } catch (error) {
    throw new Error('Error checking user existence: ' + error.message);
  }
};

// Check if user exists by phone number
exports.userExistsByPhone = async (phoneNumber) => {
  try {
    if (!phoneNumber) {
      return false;
    }

    const user = await User.findOne({
      where: { phoneNumber },
      attributes: ['id'] // Only select id to minimize data transfer
    });

    return !!user;
  } catch (error) {
    throw new Error('Error checking user existence: ' + error.message);
  }
};