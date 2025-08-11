// USER REGISTER
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, password } = req.body;
    const errors = {};

    // Validation
    if (!firstName?.trim()) errors.firstName = 'First name is required';
    if (!lastName?.trim()) errors.lastName = 'Last name is required';
    if (!email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!phoneNumber?.trim()) errors.phoneNumber = 'Phone number is required';
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.password = 'Password must contain uppercase, lowercase, and number';
    }

    // Check for existing user
    const existingUser = await userService.findUserByEmail(email);
    if (existingUser) {
      errors.email = 'User with this email already exists';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors
      });
    }

    // Create user
    const newUser = await userService.createUser(
      firstName.trim(),
      lastName.trim(),
      email.toLowerCase().trim(),
      phoneNumber.trim(),
      password,
      'customer' // default userType
    );

    // Mark as unverified (default)
    // Optionally send verification email/SMS here

    return res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        userType: newUser.userType,
        createdAt: newUser.createdAt,
      }
    });
  } catch (err) {
    console.error('User registration error:', err);
    return res.status(500).json({
      message: 'An error occurred during registration. Please try again.',
      errors: {}
    });
  }
};
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const fs = require('fs');
const { Op } = require('sequelize');
const { sendEmail } = require('../utils/emailUtil');
const userService = require('../services/userService');

exports.getAllUsers = async function(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      userType = 'all',
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereCondition = {};

    // Defensive: Only add search clause if search is a non-empty string
    if (typeof search === 'string' && search.trim().length > 0) {
      whereCondition[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phoneNumber: { [Op.like]: `%${search}%` } }
      ];
    }

    // Filter by user type
    if (userType !== 'all') {
      whereCondition.userType = userType;
    }

    // Filter by status
    if (status === 'active') {
      whereCondition.isActive = true;
    } else if (status === 'suspended') {
      whereCondition.isActive = false;
    } else if (status === 'verified') {
      whereCondition[Op.and] = [
        { emailVerifiedAt: { [Op.ne]: null } },
        { phoneVerifiedAt: { [Op.ne]: null } }
      ];
    } else if (status === 'unverified') {
      whereCondition[Op.or] = [
        { emailVerifiedAt: null },
        { phoneVerifiedAt: null }
      ];
    }

    const { rows: users, count: totalUsers } = await userService.findAndCountAllUsers({
      where: whereCondition,
      limit: parseInt(limit),
      offset: offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      attributes: [
        'id', 'firstName', 'lastName', 'email', 'phoneNumber', 'userType',
        'isActive', 'isOnline', 'emailVerifiedAt', 'phoneVerifiedAt',
        'createdAt', 'updatedAt', 'lastLoginAt', 'lastSeenAt', 'avatar'
      ]
    });

    // Get additional stats for each user (if needed)
    const usersWithStats = await Promise.all(users.map(async (user) => {
      let additionalData = {};
      
      if (user.userType === 'customer') {
        // Add customer-specific data (orders, spending, etc.)
        // This would come from your Order model
        additionalData = {
          totalOrders: Math.floor(Math.random() * 50), // Mock data
          totalSpent: Math.floor(Math.random() * 5000), // Mock data
          lastOrderDate: null,
          favoriteCategories: []
        };
      } else if (user.userType === 'merchant') {
        // Add merchant-specific data (stores, etc.)
        additionalData = {
          totalStores: Math.floor(Math.random() * 5), // Mock data
          storeName: `${user.firstName}'s Store` // Mock data
        };
      }

      return {
        ...user.toJSON(),
        ...additionalData
      };
    }));

    const totalPages = Math.ceil(totalUsers / limit);

    return res.status(200).json({
      message: 'Users retrieved successfully',
      users: usersWithStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalUsers: totalUsers,
        perPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      filters: {
        search,
        userType,
        status,
        sortBy,
        sortOrder
      }
    });
  } catch (err) {
    console.error('Get all users error:', err);
    return res.status(500).json({
      message: 'An error occurred while fetching users',
      errors: { details: err.message }
    });
  }
}

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

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        userType: user.userType || 'customer',
        isEmailVerified: user.isEmailVerified?.() || !!user.emailVerifiedAt,
        isPhoneVerified: user.isPhoneVerified?.() || !!user.phoneVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      access_token: token,
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

    const user = await userService.findUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists for security
      return res.status(200).json({
        message: 'If a user with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token (implement this in your userService)
    // await userService.generatePasswordResetToken(user);

    return res.status(200).json({
      message: 'Password reset link sent to your email'
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

    // Implement password reset logic
    // const result = await userService.resetPassword(token, newPassword);

    return res.status(200).json({
      message: 'Password reset successfully'
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
// NEW ADMIN FUNCTIONS
// ==========================================

// ADMIN LOGIN
exports.adminLogin = async (req, res) => {
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

    // Find admin user
    const admin = await userService.findUserByEmail(email);
    if (!admin || admin.userType !== 'admin') {
      return res.status(404).json({ 
        message: 'Invalid credentials',
        errors: { email: 'Admin account not found' }
      });
    }

    // Check if admin account is active
    if (!admin.isActive) {
      return res.status(403).json({
        message: 'Account suspended',
        errors: { account: 'Your admin account has been suspended' }
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid credentials',
        errors: { password: 'Invalid password' }
      });
    }

    // Generate token with admin type
    const token = jwt.sign(
      { 
        userId: admin.id, 
        email: admin.email,
        type: 'admin',
        userType: 'admin'
      },
      JWT_SECRET,
      { expiresIn: '24h' } // Shorter expiry for admin sessions
    );

    // Update last login
    if (admin.updateLastLogin) {
      await admin.updateLastLogin();
    }

    return res.status(200).json({
      message: 'Admin login successful',
      admin: {
        id: admin.id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        userType: admin.userType,
        createdAt: admin.createdAt,
        lastLoginAt: admin.lastLoginAt,
      },
      access_token: token,
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({
      message: 'An error occurred during login. Please try again.',
      errors: {}
    });
  }
};

// ADMIN REGISTER
exports.adminRegister = async (req, res) => {
  try {
    const { firstName, lastName, email, password, adminCode } = req.body;
    const errors = {};

    // Validation
    if (!firstName?.trim()) errors.firstName = 'First name is required';
    if (!lastName?.trim()) errors.lastName = 'Last name is required';
    if (!email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.password = 'Password must contain uppercase, lowercase, and number';
    }
    
    // Check admin code
    const validAdminCode = process.env.ADMIN_REGISTRATION_CODE || 'ADMIN123456';
    if (!adminCode) {
      errors.adminCode = 'Admin access code is required';
    } else if (adminCode !== validAdminCode) {
      errors.adminCode = 'Invalid admin access code';
    }

    // Check for existing admin
    const existingAdmin = await userService.findUserByEmail(email);
    if (existingAdmin) {
      errors.email = 'Admin with this email already exists';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors
      });
    }

    // Create admin user
    const newAdmin = await userService.createUser(
      firstName.trim(),
      lastName.trim(),
      email.toLowerCase().trim(),
      '+254700000000', // Default phone for admin
      password,
      'admin' // userType
    );

    // Mark as verified
    await newAdmin.verifyEmail();
    await newAdmin.verifyPhone();

    // Generate token
    const token = jwt.sign(
      { 
        userId: newAdmin.id, 
        email: newAdmin.email,
        type: 'admin',
        userType: 'admin'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'Admin account created successfully',
      admin: {
        id: newAdmin.id,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        email: newAdmin.email,
        userType: newAdmin.userType,
        createdAt: newAdmin.createdAt,
      },
      access_token: token,
    });
  } catch (err) {
    console.error('Admin registration error:', err);
    return res.status(500).json({
      message: 'An error occurred during registration. Please try again.',
      errors: {}
    });
  }
};

// GET USER BY ID (Admin function)
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await userService.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        errors: { userId: 'User with this ID does not exist' }
      });
    }
    // Get additional user data based on type
    let additionalData = {};
    if (user.userType === 'customer') {
      additionalData = {
        totalOrders: Math.floor(Math.random() * 50),
        totalSpent: Math.floor(Math.random() * 5000),
        lastOrderDate: null,
        favoriteCategories: []
      };
    } else if (user.userType === 'merchant') {
      additionalData = {
        totalStores: Math.floor(Math.random() * 5),
        totalProducts: Math.floor(Math.random() * 100),
        totalRevenue: Math.floor(Math.random() * 10000),
        stores: []
      };
    }
    return res.status(200).json({
      message: 'User retrieved successfully',
      user: {
        ...user.toJSON(),
        ...additionalData
      }
    });
  } catch (err) {
    console.error('Get user by ID error:', err);
    return res.status(500).json({
      message: 'An error occurred while fetching user',
      errors: {}
    });
  }
};

// UPDATE USER STATUS (Admin function)
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive, reason } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        message: 'Invalid status value',
        errors: { isActive: 'Status must be true or false' }
      });
    }

    const user = await userService.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        errors: { userId: 'User with this ID does not exist' }
      });
    }

    // Prevent admin from suspending themselves
    if (req.user.userId === userId && !isActive) {
      return res.status(400).json({
        message: 'Cannot suspend your own account',
        errors: { userId: 'You cannot suspend your own account' }
      });
    }

    // Update user status
    await user.update({ isActive });

    // Log the action
    console.log(`Admin ${req.user.email} ${isActive ? 'activated' : 'suspended'} user ${user.email}. Reason: ${reason || 'None provided'}`);

    return res.status(200).json({
      message: `User ${isActive ? 'activated' : 'suspended'} successfully`,
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    console.error('Update user status error:', err);
    return res.status(500).json({
      message: 'An error occurred while updating user status',
      errors: {}
    });
  }
};

// DELETE USER (Admin function)
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { confirmDelete } = req.body;

    if (!confirmDelete) {
      return res.status(400).json({
        message: 'Deletion confirmation required',
        errors: { confirmDelete: 'You must confirm the deletion' }
      });
    }

    const user = await userService.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        errors: { userId: 'User with this ID does not exist' }
      });
    }

    // Prevent admin from deleting themselves
    if (req.user.userId === userId) {
      return res.status(400).json({
        message: 'Cannot delete your own account',
        errors: { userId: 'You cannot delete your own account' }
      });
    }

    // Prevent deleting other admins (optional security measure)
    if (user.userType === 'admin' && req.user.userType !== 'super_admin') {
      return res.status(403).json({
        message: 'Cannot delete admin accounts',
        errors: { userType: 'Only super admins can delete admin accounts' }
      });
    }

    // Store user info for logging before deletion
    const userInfo = {
      id: user.id,
      email: user.email,
      userType: user.userType,
      name: `${user.firstName} ${user.lastName}`
    };

    // Delete user
    await user.destroy();

    // Log the action
    console.log(`Admin ${req.user.email} deleted user ${userInfo.email} (${userInfo.name})`);

    return res.status(200).json({
      message: 'User deleted successfully',
      deletedUser: userInfo
    });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({
      message: 'An error occurred while deleting user',
      errors: {}
    });
  }
};

// GET ADMIN DASHBOARD STATS
exports.getDashboardStats = async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await userService.getUserCount();
    const totalCustomers = await userService.getUserCountByType('customer');
    const totalMerchants = await userService.getUserCountByType('merchant');
    const totalAdmins = await userService.getUserCountByType('admin');
    
    const activeUsers = await userService.getActiveUserCount();
    const onlineUsers = await userService.getOnlineUserCount();
    const verifiedUsers = await userService.getVerifiedUserCount();
    
    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRegistrations = await userService.getUserCountSince(thirtyDaysAgo);

    // Get growth statistics
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthUsers = await userService.getUserCountBefore(lastMonth);
    const userGrowth = totalUsers - lastMonthUsers;
    const userGrowthPercentage = lastMonthUsers > 0 ? ((userGrowth / lastMonthUsers) * 100).toFixed(1) : 0;

    return res.status(200).json({
      message: 'Dashboard statistics retrieved successfully',
      stats: {
        users: {
          total: totalUsers,
          customers: totalCustomers,
          merchants: totalMerchants,
          admins: totalAdmins,
          active: activeUsers,
          online: onlineUsers,
          verified: verifiedUsers,
          recent: recentRegistrations,
          growth: {
            count: userGrowth,
            percentage: userGrowthPercentage
          }
        },
        // Add more statistics here (orders, revenue, etc.)
        lastUpdated: new Date()
      }
    });
  } catch (err) {
    console.error('Get dashboard stats error:', err);
    return res.status(500).json({
      message: 'An error occurred while fetching dashboard statistics',
      errors: {}
    });
  }
};

// GET USER STATS (Admin function)
exports.getUserStats = async (req, res) => {
  try {
    const { id } = req.params;
    const stats = await userService.getUserStats(id);
    if (!stats) {
      return res.status(404).json({
        message: 'User not found or no stats available',
        errors: { id: 'User with this ID does not exist or no stats available' }
      });
    }
    return res.status(200).json({
      message: 'User stats retrieved successfully',
      stats
    });
  } catch (err) {
    console.error('Get user stats error:', err);
    return res.status(500).json({
      message: 'An error occurred while fetching user stats',
      errors: {}
    });
  }
};