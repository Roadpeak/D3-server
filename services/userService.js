const { User } = require('../models');
const { Op } = require('sequelize'); // Import Sequelize operators

// Create a new user
exports.createUser = async (firstName, lastName, email, phoneNumber, password) => {
  try {
    const user = await User.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      userType: 'customer' // Set default user type
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

// Find a user by email (for login) - FIXED to handle password properly
exports.findUserByEmail = async (email) => {
  try {
    if (!email) {
      return null;
    }

    // Try different approaches to get the user with password
    let user = null;

    // Method 1: Try with scope if it exists
    try {
      user = await User.scope('withPassword').findOne({
        where: { email }
      });
    } catch (scopeError) {
      // Scope doesn't exist, continue to method 2
    }

    // Method 2: Try without default scope (raw query)
    if (!user) {
      try {
        user = await User.unscoped().findOne({
          where: { email }
        });
      } catch (unscopedError) {
        // Continue to method 3
      }
    }

    // Method 3: Force include password
    if (!user) {
      user = await User.findOne({
        where: { email },
        attributes: {
          include: ['password']
        }
      });
    }

    // Method 4: Get all attributes (FIXED - removed the problematic attributes: '*')
    if (!user) {
      user = await User.findOne({
        where: { email }
        // No attributes specified = get all attributes by default
      });
    }

    console.log('Found user for login:', user ? 'Yes' : 'No');
    console.log('User has password field:', user && user.password ? 'Yes' : 'No');
    
    return user;
  } catch (error) {
    console.error('Error in findUserByEmail:', error);
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

// Additional helper methods for user verification
exports.markPhoneAsVerified = async (userId) => {
  try {
    return await User.update(
      { 
        phoneVerifiedAt: new Date(),
        isPhoneVerified: true 
      },
      { where: { id: userId } }
    );
  } catch (error) {
    throw new Error('Error marking phone as verified: ' + error.message);
  }
};

exports.markEmailAsVerified = async (userId) => {
  try {
    return await User.update(
      { 
        emailVerifiedAt: new Date(),
        isEmailVerified: true 
      },
      { where: { id: userId } }
    );
  } catch (error) {
    throw new Error('Error marking email as verified: ' + error.message);
  }
};

// Get user with verification status
exports.getUserWithVerificationStatus = async (id) => {
  try {
    const user = await User.findByPk(id);
    if (!user) return null;

    return {
      ...user.toJSON(),
      isEmailVerified: !!user.emailVerifiedAt,
      isPhoneVerified: !!user.phoneVerifiedAt
    };
  } catch (error) {
    throw new Error('Error getting user verification status: ' + error.message);
  }
};