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

// Find and count all users (for admin pagination/search)
exports.findAndCountAllUsers = async ({ where, limit, offset, order, attributes }) => {
  try {
    return await User.findAndCountAll({
      where,
      limit,
      offset,
      order,
      attributes
    });
  } catch (error) {
    throw new Error('Error finding users: ' + error.message);
  }
};

// Get user statistics (for /admin/users/{id}/stats)
exports.getUserStats = async (userId) => {
  try {
    // Example stats: total bookings, total offers, total spent (for customers), total stores (for merchants)
    const { User, Booking, Store, sequelize } = require('../models');
    const user = await User.findByPk(userId);
    if (!user) return null;

    let stats = {};
    if (user.userType === 'customer') {
      // Total bookings and total spent
      const totalBookings = await Booking.count({ where: { user_id: userId } });
      const totalSpentResult = await Booking.findAll({
        where: { user_id: userId },
        attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'totalSpent']]
      });
      const totalSpent = totalSpentResult[0]?.dataValues?.totalSpent || 0;
      stats = { totalBookings, totalSpent };
    } else if (user.userType === 'merchant') {
      // Total stores and total revenue
      const totalStores = await Store.count({ where: { merchant_id: userId } });
      // Get all bookings for stores owned by this merchant
      const merchantStoreIds = await Store.findAll({
        where: { merchant_id: userId },
        attributes: ['id']
      });
      const storeIds = merchantStoreIds.map(store => store.id);
      let totalRevenue = 0;
      if (storeIds.length > 0) {
        const totalRevenueResult = await Booking.findAll({
          where: { store_id: { [sequelize.Op.in]: storeIds } },
          attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue']]
        });
        totalRevenue = totalRevenueResult[0]?.dataValues?.totalRevenue || 0;
      }
      stats = { totalStores, totalRevenue };
    } else if (user.userType === 'admin') {
      // Gracefully handle admin users
      stats = { message: 'No stats available for admin users.' };
    } else {
      stats = { message: 'No stats available for this user type.' };
    }
    return stats;
  } catch (error) {
    // Always return a message instead of throwing for unknown types
    return { message: 'No stats available due to error.' };
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