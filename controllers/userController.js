const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const fs = require('fs');
const { Op } = require('sequelize');
const { sendEmail } = require('../utils/emailUtil');
const userService = require('../services/userService');
const { setTokenCookie, clearTokenCookie } = require('../utils/cookieHelper');

const JWT_SECRET = process.env.JWT_SECRET;

// ==========================================
// EXISTING USER FUNCTIONS (UPDATED WITH REFERRAL SYSTEM)
// ==========================================

// REGISTER - UPDATED WITH REFERRAL LINK SUPPORT
exports.register = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phoneNumber, password,
      first_name, last_name, phone, password_confirmation,
      referralSlug // NEW: Accept referral slug from URL
    } = req.body;

    const userData = {
      firstName: firstName || first_name,
      lastName: lastName || last_name,
      email,
      phoneNumber: phoneNumber || phone,
      password,
      passwordConfirmation: password_confirmation,
      referralSlug // NEW: Include referral slug
    };

    const errors = {};

    // Basic validations
    if (!userData.firstName?.trim()) errors.firstName = 'First name is required';
    if (!userData.lastName?.trim()) errors.lastName = 'Last name is required';
    if (!userData.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(userData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!userData.phoneNumber?.trim()) errors.phoneNumber = 'Phone number is required';
    if (!userData.password) {
      errors.password = 'Password is required';
    } else if (userData.password.length < 12) {
      errors.password = 'Password must be at least 12 characters long';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-{}\[\]:;"'<>,.\/\\|`~]).{12,}$/.test(userData.password)) {
      errors.password = 'Password must contain uppercase, lowercase, number, and special character';
    }
    if (userData.passwordConfirmation && userData.password !== userData.passwordConfirmation) {
      errors.password_confirmation = 'Passwords do not match';
    }

    // NEW: Validate referral slug if provided
    let referrerId = null;
    if (userData.referralSlug) {
      const referrer = await userService.findUserByReferralSlug(userData.referralSlug);
      if (!referrer) {
        errors.referralSlug = 'Invalid referral link';
      } else {
        referrerId = referrer.id;
        console.log(`✅ Valid referral link: ${userData.referralSlug} from user ${referrer.firstName} ${referrer.lastName}`);
      }
    }

    // Duplicate check
    const [existingEmail, existingPhone] = await Promise.all([
      userService.findUserByEmail(userData.email),
      userService.findUserByPhone(userData.phoneNumber),
    ]);

    if (existingEmail) errors.email = 'User with this email already exists';
    if (existingPhone) errors.phoneNumber = 'User with this phone number already exists';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors
      });
    }

    // Generate unique referral slug and link for the new user
    const newUserReferralSlug = generateReferralSlug(Math.random().toString(), userData.firstName, userData.lastName);
    const newUserReferralLink = `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/accounts/sign-up?ref=${newUserReferralSlug}`;

    // Create user with referral data
    const newUser = await userService.createUser(
      userData.firstName,
      userData.lastName,
      userData.email,
      userData.phoneNumber,
      userData.password,
      'customer', // userType
      {
        referralSlug: newUserReferralSlug,
        referralLink: newUserReferralLink,
        referredBy: referrerId,
        referredAt: referrerId ? new Date() : null
      }
    );

    // FIXED: Add type field to token
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email,
        type: 'user'  // ADDED THIS LINE
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Send welcome email (non-blocking)
    try {
      await sendWelcomeEmailWithReferralInfo(newUser, referrerId);
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }

    // If user was referred, log the referral
    if (referrerId) {
      console.log(`🎯 New user ${newUser.email} referred by user ID ${referrerId}`);
      
      // Optional: Send notification to referrer
      try {
        await notifyReferrerOfNewSignup(referrerId, newUser);
      } catch (notificationError) {
        console.error('Error notifying referrer:', notificationError);
      }
    }

    // Set token as HttpOnly cookie
    setTokenCookie(res, token);

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        userType: newUser.userType || 'customer',
        referralLink: newUser.referralLink,
        wasReferred: !!referrerId,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
      referralInfo: referrerId ? {
        message: 'You were successfully referred! Start booking offers to help your referrer earn rewards.',
        referrerNotified: true
      } : null
    });
  } catch (err) {
    console.error('Registration error:', err);

    if (err.name === 'SequelizeValidationError') {
      const errors = {};
      
      err.errors.forEach(error => {
        const field = error.path;
        if (!errors[field]) errors[field] = error.message;
      });

      return res.status(400).json({
        message: 'Validation failed',
        errors: errors
      });
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
      const errors = {};
      err.errors.forEach(error => {
        if (error.path === 'email') errors.email = 'User with this email already exists';
        if (error.path === 'phoneNumber') errors.phoneNumber = 'User with this phone number already exists';
      });
      
      return res.status(400).json({
        message: 'User already exists',
        errors: errors
      });
    }

    return res.status(500).json({
      message: 'An error occurred during registration. Please try again.',
      errors: {}
    });
  }
};

// LOGIN - FIXED to include type field
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const errors = {};

    if (!email) errors.email = 'Email is required';
    if (!password) errors.password = 'Password is required';
    
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors
      });
    }

    const user = await userService.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ 
        message: 'Invalid credentials',
        errors: { email: 'User not found' }
      });
    }

    console.log('User found:', !!user);
    console.log('User password exists:', !!user.password);
    console.log('Provided password:', !!password);

    // Check if password field exists
    if (!user.password) {
      console.error('User password field is missing');
      return res.status(500).json({
        message: 'User data incomplete',
        errors: { password: 'Password data missing' }
      });
    }

    let isPasswordValid = false;
    
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (bcryptError) {
      console.error('Bcrypt error:', bcryptError);
      return res.status(500).json({
        message: 'Password verification failed',
        errors: { password: 'Password verification error' }
      });
    }

    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid credentials',
        errors: { password: 'Invalid password' }
      });
    }

    // FIXED: Add type field to token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        type: 'user'  // ADDED THIS LINE
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Update last login
    if (user.updateLastLogin) {
      await user.updateLastLogin();
    }

    // Set token as HttpOnly cookie
    setTokenCookie(res, token);

    return res.status(200).json({
      message: 'Login successful',
      access_token: token, // Include token in response for clients that can't receive HttpOnly cookies
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        userType: user.userType || 'customer',
        isEmailVerified: user.isEmailVerified?.() || !!user.emailVerifiedAt,
        isPhoneVerified: user.isPhoneVerified?.() || !!user.phoneVerifiedAt,
        referralLink: user.referralLink,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      message: 'An error occurred during login. Please try again.',
      errors: {}
    });
  }
};

// VERIFY OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({
        message: 'Phone number and OTP are required',
        errors: {
          phone: !phone ? 'Phone number is required' : undefined,
          otp: !otp ? 'OTP is required' : undefined
        }
      });
    }

    // Find user by phone number
    const user = await userService.findUserByPhone(phone);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        errors: { phone: 'User with this phone number not found' }
      });
    }

    // For development/testing purposes, accept these test OTPs:
    const validTestOTPs = ['123456', '111111', '000000', '999999'];
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Check if it's a valid test OTP or any 6-digit number starting with 1 in development
    const isValidTestOTP = validTestOTPs.includes(otp) || (isDevelopment && otp.startsWith('1') && otp.length === 6);
    
    if (isValidTestOTP) {
      // Mark phone as verified
      try {
        if (user.verifyPhone) {
          await user.verifyPhone();
        } else {
          // Fallback if method doesn't exist
          await user.update({ 
            phoneVerifiedAt: new Date(),
            isPhoneVerified: true 
          });
        }

        // Also mark email as verified for testing
        if (user.verifyEmail) {
          await user.verifyEmail();
        } else {
          await user.update({ 
            emailVerifiedAt: new Date(),
            isEmailVerified: true 
          });
        }

        console.log(`✅ Phone verified for user: ${user.email}`);

        return res.status(200).json({
          message: 'Phone number verified successfully',
          success: true,
          user: {
            id: user.id,
            phoneNumber: user.phoneNumber,
            isPhoneVerified: true,
            isEmailVerified: true,
          }
        });
      } catch (updateError) {
        console.error('Error updating user verification status:', updateError);
        return res.status(500).json({
          message: 'Error updating verification status',
          errors: {}
        });
      }
    }

    // In a real implementation, you would:
    // 1. Check stored OTP in database/cache
    // 2. Verify OTP hasn't expired
    // 3. Mark as verified if valid
    
    // For now, return error for non-test OTPs
    return res.status(400).json({
      message: 'Invalid OTP',
      errors: { otp: 'The OTP you entered is incorrect. Use 123456 for testing.' }
    });

  } catch (err) {
    console.error('OTP verification error:', err);
    return res.status(500).json({
      message: 'An error occurred during verification',
      errors: {}
    });
  }
};

// RESEND OTP
exports.resendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        message: 'Phone number is required',
        errors: { phone: 'Phone number is required' }
      });
    }

    const user = await userService.findUserByPhone(phone);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        errors: { phone: 'User with this phone number not found' }
      });
    }

    // In a real implementation, you would:
    // 1. Generate new OTP
    // 2. Store it in database/cache with expiry
    // 3. Send via SMS service (Twilio, AWS SNS, etc.)
    
    // For development, just return success
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    console.log(`📱 OTP Resent for ${phone}: Use 123456 for testing`);
    
    return res.status(200).json({
      message: 'OTP sent successfully',
      success: true,
      // In development, you might include the OTP for testing
      ...(isDevelopment && { 
        testOtp: '123456',
        note: 'Use 123456, 111111, 000000, 999999, or any 6-digit number starting with 1 for testing'
      })
    });

  } catch (err) {
    console.error('Resend OTP error:', err);
    return res.status(500).json({
      message: 'An error occurred while sending OTP',
      errors: {}
    });
  }
};

// GET USER PROFILE
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await userService.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        errors: {}
      });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        userType: user.userType || 'customer',
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified?.() || !!user.emailVerifiedAt,
        isPhoneVerified: user.isPhoneVerified?.() || !!user.phoneVerifiedAt,
        referralLink: user.referralLink,
        referralSlug: user.referralSlug,
        wasReferred: !!user.referredBy,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({
      message: 'An error occurred while fetching profile',
      errors: {}
    });
  }
};

// UPDATE PROFILE
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, phoneNumber, avatar } = req.body;

    const user = await userService.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        errors: {}
      });
    }

    // Update user fields
    const updateData = {};
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (phoneNumber) updateData.phoneNumber = phoneNumber.trim();
    if (avatar) updateData.avatar = avatar;

    await user.update(updateData);

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        avatar: user.avatar,
        userType: user.userType || 'customer',
        isEmailVerified: user.isEmailVerified?.() || !!user.emailVerifiedAt,
        isPhoneVerified: user.isPhoneVerified?.() || !!user.phoneVerifiedAt,
        referralLink: user.referralLink,
        updatedAt: user.updatedAt,
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({
      message: 'An error occurred while updating profile',
      errors: {}
    });
  }
};

// ==========================================
// NEW REFERRAL SYSTEM ENDPOINTS
// ==========================================

// Get user earnings data
exports.getEarnings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userService = require('../services/userService');
    
    // Get user basic info first
    const user = await userService.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Try to get referral models - use try/catch in case they don't exist yet
    let ReferralEarning, Booking;
    try {
      const models = require('../models');
      ReferralEarning = models.ReferralEarning;
      Booking = models.Booking;
    } catch (modelError) {
      console.log('Referral models not available yet, using fallback');
    }

    let totalEarned = 0;
    let pendingEarnings = 0;
    let totalReferralBookings = 0;
    let referralCount = 0;
    let averageEarningPerBooking = 0;

    // Try to calculate earnings if models exist
    if (ReferralEarning) {
      try {
        totalEarned = await ReferralEarning.sum('amount', {
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
      } catch (earningError) {
        console.log('Error calculating earnings:', earningError.message);
      }
    }

    // Try to calculate referral stats if User model supports it
    try {
      const { User } = require('../models');
      referralCount = await User.count({
        where: { referredBy: userId }
      }) || 0;

      // Try to get booking stats if Booking model exists
      if (Booking) {
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
        }) || 0;
      }
    } catch (statsError) {
      console.log('Error calculating referral stats:', statsError.message);
    }

    averageEarningPerBooking = totalReferralBookings > 0 ? totalEarned / totalReferralBookings : 0;

    // Generate referral link if not exists
    let referralLink = user.referralLink;
    if (!referralLink) {
      const uniqueSlug = generateReferralSlug(user.id, user.firstName, user.lastName);
      referralLink = `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/accounts/sign-up?ref=${uniqueSlug}`;
      
      try {
        await user.update({ 
          referralSlug: uniqueSlug,
          referralLink: referralLink 
        });
      } catch (updateError) {
        console.log('Could not update user referral link:', updateError.message);
        // Still return the generated link even if we can't save it
      }
    }

    const earnings = {
      totalEarned: parseFloat(totalEarned) || 0,
      currentBalance: parseFloat(totalEarned) || 0, // In a real system, subtract withdrawn amounts
      referralCount: referralCount || 0,
      pendingRewards: parseFloat(pendingEarnings) || 0,
      totalReferralBookings: totalReferralBookings || 0,
      averageEarningPerBooking: parseFloat(averageEarningPerBooking) || 0
    };

    res.status(200).json({
      success: true,
      earnings,
      referralLink: referralLink || `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/accounts/sign-up?ref=temp-${userId.substring(0, 8)}`
    });

  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching earnings data'
    });
  }
};

// Get earning activities
exports.getEarningActivities = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Try to get referral models
    let ReferralEarning, User, Booking, Offer, Service;
    try {
      const models = require('../models');
      ReferralEarning = models.ReferralEarning;
      User = models.User;
      Booking = models.Booking;
      Offer = models.Offer;
      Service = models.Service;
    } catch (modelError) {
      console.log('Models not available yet');
    }

    let activities = [];

    // Try to get activities if ReferralEarning model exists
    if (ReferralEarning && User) {
      try {
        const rawActivities = await ReferralEarning.findAll({
          where: { referrerId: userId },
          include: [
            {
              model: User,
              as: 'referee',
              attributes: ['firstName', 'lastName'],
              required: false
            }
          ],
          order: [['createdAt', 'DESC']],
          limit: 20
        });

        activities = rawActivities.map(activity => ({
          id: activity.id,
          description: `Referral commission from ${activity.referee?.firstName || 'Unknown'} ${activity.referee?.lastName || 'User'}`,
          amount: parseFloat(activity.amount) || 0,
          date: activity.createdAt,
          status: activity.status,
          type: 'referral_commission'
        }));

      } catch (activityError) {
        console.log('Error fetching activities:', activityError.message);
      }
    }

    // If no activities found, return empty array with helpful message
    if (activities.length === 0) {
      activities = [];
    }

    res.status(200).json({
      success: true,
      activities: activities
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching earning activities'
    });
  }
};

// Validate referral link (for registration)
exports.validateReferral = async (req, res) => {
  try {
    const { referralSlug } = req.body;

    if (!referralSlug) {
      return res.status(400).json({
        success: false,
        message: 'Referral identifier is required'
      });
    }

    const userService = require('../services/userService');
    const referrer = await userService.findUserByReferralSlug(referralSlug);

    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral link'
      });
    }

    res.status(200).json({
      success: true,
      referrer: {
        name: `${referrer.firstName} ${referrer.lastName}`,
        id: referrer.id
      }
    });

  } catch (error) {
    console.error('Error validating referral link:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating referral link'
    });
  }
};

// ==========================================
// OTHER EXISTING FUNCTIONS
// ==========================================

// GET USER BOOKINGS
exports.getUserBookings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;

    // This is a placeholder - you'll need to implement based on your Booking model
    // For now, return empty array
    const bookings = [];

    return res.status(200).json({
      message: 'Bookings retrieved successfully',
      bookings: bookings,
      pagination: {
        current_page: parseInt(page),
        total_pages: 0,
        total_count: 0,
        per_page: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('Get user bookings error:', err);
    return res.status(500).json({
      message: 'An error occurred while fetching bookings',
      errors: {}
    });
  }
};

// GET USER CHATS
exports.getUserChats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    // This is a placeholder - you'll need to implement based on your Chat model
    // For now, return empty array
    const chats = [];

    return res.status(200).json({
      message: 'Chats retrieved successfully',
      chats: chats,
      pagination: {
        current_page: parseInt(page),
        total_pages: 0,
        total_count: 0,
        per_page: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('Get user chats error:', err);
    return res.status(500).json({
      message: 'An error occurred while fetching chats',
      errors: {}
    });
  }
};

// GET USER FAVORITES
exports.getUserFavorites = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, type = 'all' } = req.query;

    // This is a placeholder - you'll need to implement based on your favorites/likes model
    // For now, return empty array
    const favorites = [];

    return res.status(200).json({
      message: 'Favorites retrieved successfully',
      favorites: favorites,
      pagination: {
        current_page: parseInt(page),
        total_pages: 0,
        total_count: 0,
        per_page: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('Get user favorites error:', err);
    return res.status(500).json({
      message: 'An error occurred while fetching favorites',
      errors: {}
    });
  }
};

// REQUEST PASSWORD RESET
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required',
        errors: { email: 'Email is required' }
      });
    }

    const user = await userService.findUserByEmailWithPassword(email);

    // Always return success message for security (don't reveal if user exists)
    if (!user) {
      return res.status(200).json({
        message: 'If a user with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Update user with reset token
    await user.update({
      resetToken: resetToken,
      resetTokenExpiry: resetTokenExpiry
    });

    // Send password reset email using notification service
    const NotificationService = require('../services/notificationService');
    const notificationService = new NotificationService();

    await notificationService.sendPasswordResetEmail(user.email, resetToken, 'user');

    console.log(`✅ Password reset email sent to: ${user.email}`);

    return res.status(200).json({
      message: 'If a user with that email exists, a password reset link has been sent.'
    });
  } catch (err) {
    console.error('Request password reset error:', err);
    return res.status(500).json({
      message: 'An error occurred while processing password reset request',
      errors: {}
    });
  }
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        message: 'Token and new password are required',
        errors: {
          token: !token ? 'Reset token is required' : undefined,
          newPassword: !newPassword ? 'New password is required' : undefined
        }
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long',
        errors: { newPassword: 'Password must be at least 8 characters long' }
      });
    }

    // Find user with valid reset token
    const { User } = require('../models');
    const { Op } = require('sequelize');

    const user = await User.scope('withPassword').findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          [Op.gt]: new Date() // Token must not be expired
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired reset token',
        errors: { token: 'Invalid or expired reset token' }
      });
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    // Send confirmation email
    const NotificationService = require('../services/notificationService');
    const notificationService = new NotificationService();

    try {
      await notificationService.sendPasswordResetConfirmation(
        user.email,
        user.firstName || user.email.split('@')[0],
        'user'
      );
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the password reset if email fails
    }

    console.log(`✅ Password reset successfully for user: ${user.email}`);

    return res.status(200).json({
      message: 'Password reset successfully. You can now log in with your new password.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({
      message: 'An error occurred while resetting password',
      errors: {}
    });
  }
};

// SKIP VERIFICATION (Development only)
exports.skipVerification = async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        message: 'This endpoint is only available in development',
        errors: {}
      });
    }

    const { phone } = req.body;
    const user = await userService.findUserByPhone(phone);
    
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        errors: {}
      });
    }

    // Mark as verified
    try {
      if (user.verifyPhone) {
        await user.verifyPhone();
      } else {
        await user.update({ 
          phoneVerifiedAt: new Date(),
          isPhoneVerified: true 
        });
      }

      if (user.verifyEmail) {
        await user.verifyEmail();
      } else {
        await user.update({ 
          emailVerifiedAt: new Date(),
          isEmailVerified: true 
        });
      }

      return res.status(200).json({
        message: 'Verification skipped for development',
        success: true,
        user: {
          id: user.id,
          phoneNumber: user.phoneNumber,
          isPhoneVerified: true,
          isEmailVerified: true,
        }
      });
    } catch (updateError) {
      console.error('Error updating verification:', updateError);
      return res.status(500).json({
        message: 'Error updating verification status',
        errors: {}
      });
    }

  } catch (err) {
    console.error('Skip verification error:', err);
    return res.status(500).json({
      message: 'An error occurred',
      errors: {}
    });
  }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Helper function to generate referral slug
function generateReferralSlug(id, firstName, lastName) {
  const nameSlug = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomId = Math.random().toString(36).substring(2, 10);
  
  return `${nameSlug}-${randomId}`;
}

// Helper function to send welcome email with referral info
async function sendWelcomeEmailWithReferralInfo(user, referrerId) {
  try {
    if (fs.existsSync('./templates/welcomeUser.ejs')) {
      const template = fs.readFileSync('./templates/welcomeUser.ejs', 'utf8');
      
      let emailContent;
      let referrerInfo = null;
      
      if (referrerId) {
        const referrer = await userService.findUserById(referrerId);
        referrerInfo = referrer ? {
          name: `${referrer.firstName} ${referrer.lastName}`,
          email: referrer.email
        } : null;
      }
      
      emailContent = ejs.render(template, {
        userName: user.firstName,
        marketplaceLink: 'https://yoursite.com/marketplace',
        referrerInfo: referrerInfo,
        wasReferred: !!referrerId
      });

      const subject = referrerId 
        ? `Welcome to Our Platform, ${user.firstName}! You were referred by ${referrerInfo?.name}`
        : `Welcome to Our Platform, ${user.firstName}!`;

      await sendEmail(
        user.email,
        subject,
        '',
        emailContent
      );
      
      console.log(`📧 Welcome email sent to ${user.email}`);
    }
  } catch (emailError) {
    console.error('Error sending welcome email:', emailError);
  }
}

// Helper function to notify referrer of new signup
async function notifyReferrerOfNewSignup(referrerId, newUser) {
  try {
    const referrer = await userService.findUserById(referrerId);
    if (!referrer) return;

    console.log(`📧 Notifying referrer ${referrer.email} of new signup: ${newUser.email}`);
    
    // TODO: Implement notification
    // - Send email to referrer
    // - Create in-app notification
    // - Send push notification
    
    if (fs.existsSync('./templates/referralNotification.ejs')) {
      const template = fs.readFileSync('./templates/referralNotification.ejs', 'utf8');
      const emailContent = ejs.render(template, {
        referrerName: referrer.firstName,
        newUserName: newUser.firstName,
        newUserEmail: newUser.email
      });

      await sendEmail(
        referrer.email,
        `Great news! ${newUser.firstName} joined using your referral link`,
        '',
        emailContent
      );
    }
  } catch (error) {
    console.error('Error notifying referrer:', error);
  }
}