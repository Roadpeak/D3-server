// services/userService.js - Updated with referral system support
const { User, ReferralEarning, Booking } = require('../models');
const { Op } = require('sequelize');

// ==========================================
// EXISTING USER METHODS (FROM YOUR CURRENT SERVICE)
// ==========================================

// Create a new user - UPDATED to support referral data
exports.createUser = async (firstName, lastName, email, phoneNumber, password, userType = 'customer', additionalData = {}) => {
  try {
    const userData = {
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      userType,
      ...additionalData // NEW: Support for referral fields
    };

    const user = await User.create(userData);
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

// Alias for password reset - same as findUserByEmail but more explicit
exports.findUserByEmailWithPassword = exports.findUserByEmail;

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

// ==========================================
// NEW REFERRAL SYSTEM METHODS
// ==========================================

/**
 * Find user by referral slug
 */
exports.findUserByReferralSlug = async (referralSlug) => {
  try {
    if (!referralSlug) {
      return null;
    }

    return await User.findOne({
      where: { referralSlug },
      attributes: ['id', 'firstName', 'lastName', 'email', 'referralSlug', 'referralLink']
    });
  } catch (error) {
    throw new Error('Error finding user by referral slug: ' + error.message);
  }
};

/**
 * Find user with referral data (for earnings calculation)
 */
exports.findUserByIdWithReferrals = async (userId) => {
  try {
    if (!userId) {
      return null;
    }

    return await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: ReferralEarning,
          as: 'referralEarnings',
          where: { status: 'confirmed' },
          required: false
        },
        {
          model: User,
          as: 'referrals',
          required: false,
          include: [
            {
              model: Booking,
              where: { 
                bookingType: 'offer',
                status: ['confirmed', 'completed'] 
              },
              required: false
            }
          ]
        }
      ]
    });
  } catch (error) {
    console.error('Error finding user with referrals:', error);
    // Fallback to basic user if models aren't set up yet
    return await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });
  }
};

/**
 * Get all referrals for a user
 */
exports.getUserReferrals = async (userId, options = {}) => {
  try {
    const { limit = 50, offset = 0, includeBookings = false } = options;

    const includeArray = [];
    if (includeBookings) {
      try {
        includeArray.push({
          model: Booking,
          where: { 
            bookingType: 'offer',
            status: ['confirmed', 'completed'] 
          },
          required: false
        });
      } catch (error) {
        // Booking model might not be available
        console.warn('Booking model not available for referrals query');
      }
    }

    return await User.findAll({
      where: { referredBy: userId },
      attributes: ['id', 'firstName', 'lastName', 'email', 'createdAt', 'referredAt'],
      include: includeArray,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });
  } catch (error) {
    throw new Error('Error getting user referrals: ' + error.message);
  }
};

/**
 * Get referral statistics for a user
 */
exports.getReferralStats = async (userId) => {
  try {
    // Total referrals
    const totalReferrals = await User.count({
      where: { referredBy: userId }
    });

    let totalEarnings = 0;
    let pendingEarnings = 0;
    let totalReferralBookings = 0;
    let referralsWithBookings = 0;

    // Try to get earnings data if ReferralEarning model exists
    try {
      totalEarnings = await ReferralEarning.sum('amount', {
        where: { 
          referrerId: userId, 
          status: 'confirmed' 
        }
      }) || 0;

      pendingEarnings = await ReferralEarning.sum('amount', {
        where: { 
          referrerId: userId, 
          status: 'pending' 
        }
      }) || 0;
    } catch (error) {
      console.warn('ReferralEarning model not available, using default values');
    }

    // Try to get booking data if Booking model exists
    try {
      totalReferralBookings = await Booking.count({
        include: [
          {
            model: User,
            where: { referredBy: userId },
            required: true
          }
        ],
        where: { 
          bookingType: 'offer',
          status: ['confirmed', 'completed']
        }
      });

      referralsWithBookings = await User.count({
        where: { referredBy: userId },
        include: [
          {
            model: Booking,
            where: { 
              bookingType: 'offer',
              status: ['confirmed', 'completed']
            },
            required: true
          }
        ]
      });
    } catch (error) {
      console.warn('Booking model not available for referral stats');
    }

    // Recent referrals (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentReferrals = await User.count({
      where: { 
        referredBy: userId,
        createdAt: {
          [Op.gte]: thirtyDaysAgo
        }
      }
    });

    // Conversion rate (referrals who made bookings)
    const conversionRate = totalReferrals > 0 ? (referralsWithBookings / totalReferrals) * 100 : 0;

    return {
      totalReferrals,
      totalEarnings: parseFloat(totalEarnings) || 0,
      pendingEarnings: parseFloat(pendingEarnings) || 0,
      totalReferralBookings,
      recentReferrals,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      averageEarningPerBooking: totalReferralBookings > 0 ? totalEarnings / totalReferralBookings : 0
    };

  } catch (error) {
    console.error('Error getting referral stats:', error);
    throw new Error('Error getting referral stats: ' + error.message);
  }
};

/**
 * Update user's referral link
 */
exports.updateReferralLink = async (userId, referralSlug, referralLink) => {
  try {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return await user.update({
      referralSlug,
      referralLink
    });
  } catch (error) {
    throw new Error('Error updating referral link: ' + error.message);
  }
};

/**
 * Check if a user was referred by another user
 */
exports.checkReferralRelationship = async (referrerId, refereeId) => {
  try {
    const referee = await User.findOne({
      where: { 
        id: refereeId,
        referredBy: referrerId 
      },
      attributes: ['id', 'referredBy', 'referredAt']
    });

    return !!referee;
  } catch (error) {
    throw new Error('Error checking referral relationship: ' + error.message);
  }
};

/**
 * Get top referrers (leaderboard)
 */
exports.getTopReferrers = async (limit = 10) => {
  try {
    const topReferrers = await User.findAll({
      attributes: [
        'id',
        'firstName', 
        'lastName',
        'email',
        [User.sequelize.fn('COUNT', User.sequelize.col('referrals.id')), 'referralCount']
      ],
      include: [
        {
          model: User,
          as: 'referrals',
          attributes: [],
          required: false
        }
      ],
      group: ['User.id'],
      having: User.sequelize.where(
        User.sequelize.fn('COUNT', User.sequelize.col('referrals.id')), 
        '>', 
        0
      ),
      order: [[User.sequelize.fn('COUNT', User.sequelize.col('referrals.id')), 'DESC']],
      limit
    });

    return topReferrers;
  } catch (error) {
    console.error('Error getting top referrers:', error);
    throw new Error('Error getting top referrers: ' + error.message);
  }
};


/**
 * Get user with their favorite offers
 */
exports.getUserWithFavorites = async (userId, options = {}) => {
  try {
    const { limit = 20, offset = 0, includeExpired = false } = options;

    const offerWhere = {};
    if (!includeExpired) {
      offerWhere.expiration_date = {
        [Op.gt]: new Date()
      };
      offerWhere.status = 'active';
    }

    return await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Favorite,
          as: 'favorites',
          limit,
          offset,
          order: [['created_at', 'DESC']],
          include: [
            {
              model: Offer,
              as: 'offer',
              where: Object.keys(offerWhere).length > 0 ? offerWhere : undefined,
              include: [
                {
                  model: Service,
                  as: 'service',
                  include: [
                    {
                      model: Store,
                      as: 'store'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });
  } catch (error) {
    throw new Error('Error getting user with favorites: ' + error.message);
  }
};

/**
 * Get user's favorites count
 */
exports.getUserFavoritesCount = async (userId) => {
  try {
    return await Favorite.count({
      where: { user_id: userId },
      include: [
        {
          model: Offer,
          as: 'offer',
          where: { 
            status: 'active',
            expiration_date: {
              [Op.gt]: new Date()
            }
          }
        }
      ]
    });
  } catch (error) {
    throw new Error('Error getting user favorites count: ' + error.message);
  }
};

/**
 * Check if user has favorited an offer
 */
exports.hasUserFavoritedOffer = async (userId, offerId) => {
  try {
    const favorite = await Favorite.findOne({
      where: {
        user_id: userId,
        offer_id: offerId
      }
    });

    return !!favorite;
  } catch (error) {
    throw new Error('Error checking if user favorited offer: ' + error.message);
  }
};



// ==========================================
// USER MANAGEMENT METHODS (FOR ADMIN/ANALYTICS)
// ==========================================

exports.findAndCountAllUsers = async (options = {}) => {
  try {
    return await User.findAndCountAll(options);
  } catch (error) {
    throw new Error('Error finding and counting users: ' + error.message);
  }
};

exports.getUserCount = async () => {
  try {
    return await User.count();
  } catch (error) {
    throw new Error('Error getting user count: ' + error.message);
  }
};

exports.getUserCountByType = async (userType) => {
  try {
    return await User.count({
      where: { userType }
    });
  } catch (error) {
    throw new Error('Error getting user count by type: ' + error.message);
  }
};

exports.getActiveUserCount = async () => {
  try {
    return await User.count({
      where: { isActive: true }
    });
  } catch (error) {
    throw new Error('Error getting active user count: ' + error.message);
  }
};

exports.getOnlineUserCount = async () => {
  try {
    return await User.count({
      where: { isOnline: true }
    });
  } catch (error) {
    // isOnline field might not exist yet
    console.warn('isOnline field not available');
    return 0;
  }
};

exports.getVerifiedUserCount = async () => {
  try {
    return await User.count({
      where: {
        [Op.and]: [
          { emailVerifiedAt: { [Op.ne]: null } },
          { phoneVerifiedAt: { [Op.ne]: null } }
        ]
      }
    });
  } catch (error) {
    throw new Error('Error getting verified user count: ' + error.message);
  }
};

exports.getUserCountSince = async (date) => {
  try {
    return await User.count({
      where: {
        createdAt: {
          [Op.gte]: date
        }
      }
    });
  } catch (error) {
    throw new Error('Error getting user count since date: ' + error.message);
  }
};

exports.getUserCountBefore = async (date) => {
  try {
    return await User.count({
      where: {
        createdAt: {
          [Op.lt]: date
        }
      }
    });
  } catch (error) {
    throw new Error('Error getting user count before date: ' + error.message);
  }
};

/**
 * Search users with various filters
 */
exports.searchUsers = async (searchQuery, options = {}) => {
  try {
    const {
      userType = null,
      isActive = null,
      limit = 50,
      offset = 0
    } = options;

    let whereCondition = {};

    // Search condition
    if (searchQuery) {
      whereCondition[Op.or] = [
        { firstName: { [Op.iLike]: `%${searchQuery}%` } },
        { lastName: { [Op.iLike]: `%${searchQuery}%` } },
        { email: { [Op.iLike]: `%${searchQuery}%` } },
        { phoneNumber: { [Op.like]: `%${searchQuery}%` } }
      ];
    }

    // Filter conditions
    if (userType) {
      whereCondition.userType = userType;
    }

    if (isActive !== null) {
      whereCondition.isActive = isActive;
    }

    return await User.findAndCountAll({
      where: whereCondition,
      attributes: { exclude: ['password'] },
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });
  } catch (error) {
    throw new Error('Error searching users: ' + error.message);
  }
};

/**
 * Bulk update users
 */
exports.bulkUpdateUsers = async (userIds, updateData) => {
  try {
    return await User.update(updateData, {
      where: {
        id: {
          [Op.in]: userIds
        }
      }
    });
  } catch (error) {
    throw new Error('Error bulk updating users: ' + error.message);
  }
};

/**
 * Get user activity summary
 */
exports.getUserActivitySummary = async (userId) => {
  try {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get basic stats
    const referralStats = await this.getReferralStats(userId);
    
    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let recentBookings = 0;
    try {
      recentBookings = await Booking.count({
        where: {
          userId,
          createdAt: {
            [Op.gte]: thirtyDaysAgo
          }
        }
      });
    } catch (error) {
      console.warn('Booking model not available for activity summary');
    }

    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        userType: user.userType,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      },
      referralStats,
      recentActivity: {
        recentBookings,
        periodDays: 30
      }
    };

  } catch (error) {
    console.error('Error getting user activity summary:', error);
    throw new Error('Error getting user activity summary: ' + error.message);
  }
};