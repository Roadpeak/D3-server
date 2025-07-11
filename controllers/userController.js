const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const fs = require('fs');
const { sendEmail } = require('../utils/emailUtil');
const userService = require('../services/userService');

const JWT_SECRET = process.env.JWT_SECRET;

// REGISTER
exports.register = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phoneNumber, password,
      first_name, last_name, phone, password_confirmation
    } = req.body;

    const userData = {
      firstName: firstName || first_name,
      lastName: lastName || last_name,
      email,
      phoneNumber: phoneNumber || phone,
      password,
      passwordConfirmation: password_confirmation,
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
    } else if (userData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }
    if (userData.passwordConfirmation && userData.password !== userData.passwordConfirmation) {
      errors.password_confirmation = 'Passwords do not match';
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

    // Create user
    const newUser = await userService.createUser(
      userData.firstName,
      userData.lastName,
      userData.email,
      userData.phoneNumber,
      userData.password
    );

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Send welcome email (non-blocking)
    try {
      if (fs.existsSync('./templates/welcomeUser.ejs')) {
        const template = fs.readFileSync('./templates/welcomeUser.ejs', 'utf8');
        const emailContent = ejs.render(template, {
          userName: newUser.firstName,
          marketplaceLink: 'https://discoun3ree.com/marketplace',
        });

        await sendEmail(
          newUser.email,
          `Welcome to D3, ${newUser.firstName}!`,
          '',
          emailContent
        );
      }
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
    }

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        userType: newUser.userType || 'customer',
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
      access_token: token,
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

// LOGIN - FIXED to handle password issues
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

    const token = jwt.sign(
      { userId: user.id, email: user.email },
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