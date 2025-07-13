const { Merchant, Store } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ejs = require('ejs');
const fs = require('fs');
const { sendEmail } = require('../utils/emailUtil');
const { Op } = require('sequelize');

const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, password } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phoneNumber || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid email format' 
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 8 characters long' 
      });
    }

    // Check for existing email
    const existingMerchant = await Merchant.findOne({ where: { email } });
    if (existingMerchant) {
      return res.status(400).json({ 
        success: false,
        message: 'Merchant with this email already exists' 
      });
    }

    // Check for existing phone number
    const existingPhone = await Merchant.findOne({ where: { phoneNumber } });
    if (existingPhone) {
      return res.status(400).json({ 
        success: false,
        message: 'Merchant with this phone number already exists' 
      });
    }

    // Create new merchant
    const newMerchant = await Merchant.create({ 
      firstName, 
      lastName, 
      email, 
      phoneNumber, 
      password 
    });

    const merchant = {
      id: newMerchant.id,
      first_name: newMerchant.firstName,
      last_name: newMerchant.lastName,
      email_address: newMerchant.email,
      phone_number: newMerchant.phoneNumber,
      joined: newMerchant.createdAt,
      updated: newMerchant.updatedAt,
    };

    // Generate JWT token with longer expiry for registration
    const token = jwt.sign({ 
      id: newMerchant.id, 
      email: newMerchant.email,
      type: 'merchant'
    }, JWT_SECRET, { 
      expiresIn: '7d' // 7 days for registration token
    });

    // Send welcome email (check if template exists)
    try {
      const templatePath = './templates/welcomeMerchant.ejs';
      if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, 'utf8');
        const emailContent = ejs.render(template, {
          merchantName: newMerchant.firstName,
          dashboardLink: `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/dashboard`,
        });

        await sendEmail(
          newMerchant.email,
          `Welcome to Discoun3, ${newMerchant.firstName}!`,
          '',
          emailContent
        );
      }
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail registration if email fails
    }

    return res.status(201).json({
      success: true,
      message: 'Merchant registered successfully',
      merchant,
      access_token: token,
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error registering merchant',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }

    const merchant = await Merchant.findOne({ where: { email } });
    if (!merchant) {
      return res.status(404).json({ 
        success: false,
        message: 'Invalid email or password' // Don't reveal which field is wrong
      });
    }

    const isPasswordValid = await bcrypt.compare(password, merchant.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Update last login time
    await merchant.update({ lastLoginAt: new Date() });

    // Generate JWT token
    const token = jwt.sign({ 
      id: merchant.id, 
      email: merchant.email,
      type: 'merchant'
    }, JWT_SECRET, { 
      expiresIn: '24h' // 24 hours for login token
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      id: merchant.id,
      first_name: merchant.firstName,
      last_name: merchant.lastName,
      email_address: merchant.email,
      phone_number: merchant.phoneNumber,
      joined: merchant.createdAt,
      updated: merchant.updatedAt,
      last_login: merchant.lastLoginAt,
      access_token: token,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error logging in',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }

    const merchant = await Merchant.findOne({ where: { email } });
    if (!merchant) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({ 
        success: true,
        message: 'If this email is registered, you will receive a password reset OTP' 
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 3600000); // 1 hour from now

    await merchant.update({
      passwordResetOtp: otp,
      passwordResetExpires: otpExpires
    });

    // Send OTP email (check if template exists)
    try {
      const templatePath = './templates/passwordResetOtp.ejs';
      if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, 'utf8');
        const emailContent = ejs.render(template, {
          otp: otp,
          merchantName: merchant.firstName,
          expiresIn: '1 hour'
        });

        await sendEmail(
          merchant.email,
          'Password Reset OTP - Discoun3',
          '',
          emailContent
        );
      } else {
        // Fallback plain text email
        await sendEmail(
          merchant.email,
          'Password Reset OTP - Discoun3',
          `Hi ${merchant.firstName},\n\nYour password reset OTP is: ${otp}\n\nThis OTP will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nDiscoun3 Team`
        );
      }
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to send OTP email' 
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'OTP sent to your email' 
    });
  } catch (err) {
    console.error('Password reset request error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error requesting password reset',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Email, OTP, and new password are required' 
      });
    }

    // Validate new password
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false,
        message: 'New password must be at least 8 characters long' 
      });
    }

    const merchant = await Merchant.findOne({ where: { email } });
    if (!merchant) {
      return res.status(404).json({ 
        success: false,
        message: 'Merchant not found' 
      });
    }

    if (merchant.passwordResetOtp !== otp) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid OTP' 
      });
    }

    if (!merchant.passwordResetExpires || merchant.passwordResetExpires < new Date()) {
      return res.status(400).json({ 
        success: false,
        message: 'OTP has expired. Please request a new one.' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update merchant
    await merchant.update({
      password: hashedPassword,
      passwordResetOtp: null,
      passwordResetExpires: null,
      passwordChangedAt: new Date()
    });

    return res.status(200).json({ 
      success: true,
      message: 'Password has been reset successfully' 
    });
  } catch (err) {
    console.error('Password reset error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error resetting password',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.getMerchantProfile = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // Validate merchantId
    if (!merchantId) {
      return res.status(400).json({ 
        success: false,
        message: 'Merchant ID is required' 
      });
    }

    // Verify that the requesting user is the same merchant or has admin privileges
    if (req.user.id !== merchantId && req.user.type !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Fetch merchant's basic information
    const merchant = await Merchant.findOne({
      where: { id: merchantId },
      attributes: { exclude: ['password', 'passwordResetOtp', 'passwordResetExpires'] }
    });

    if (!merchant) {
      return res.status(404).json({ 
        success: false,
        message: 'Merchant not found' 
      });
    }

    // Fetch associated store
    const store = await Store.findOne({
      where: { merchant_id: merchantId },
      attributes: [
        'id', 'name', 'location', 'primary_email', 'phone_number', 
        'description', 'website_url', 'logo_url', 'opening_time', 
        'closing_time', 'working_days', 'status', 'category', 'cashback'
      ],
    });

    // Get creator and updater info if available
    const creator = store?.created_by
      ? await Merchant.findOne({
          where: { id: store.created_by },
          attributes: ['id', 'firstName', 'lastName'],
        })
      : null;

    const updater = store?.updated_by
      ? await Merchant.findOne({
          where: { id: store.updated_by },
          attributes: ['id', 'firstName', 'lastName'],
        })
      : null;

    // Prepare the response data
    const merchantProfile = {
      id: merchant.id,
      first_name: merchant.firstName,
      last_name: merchant.lastName,
      email_address: merchant.email,
      phone_number: merchant.phoneNumber,
      joined: merchant.createdAt,
      updated: merchant.updatedAt,
      last_login: merchant.lastLoginAt,
      store: store ? {
        ...store.toJSON(),
        creator: creator ? {
          id: creator.id,
          name: `${creator.firstName} ${creator.lastName}`
        } : null,
        updater: updater ? {
          id: updater.id,
          name: `${updater.firstName} ${updater.lastName}`
        } : null
      } : null,
    };

    return res.status(200).json({ 
      success: true,
      merchantProfile 
    });
  } catch (err) {
    console.error('Get merchant profile error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error retrieving merchant profile',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.updateMerchantProfile = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { firstName, lastName, phoneNumber, businessType } = req.body;

    // Validate merchantId
    if (!merchantId) {
      return res.status(400).json({ 
        success: false,
        message: 'Merchant ID is required' 
      });
    }

    // Verify that the requesting user is the same merchant
    if (req.user.id !== merchantId) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    const merchant = await Merchant.findOne({ where: { id: merchantId } });
    if (!merchant) {
      return res.status(404).json({ 
        success: false,
        message: 'Merchant not found' 
      });
    }

    // Update merchant profile
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (businessType) updateData.businessType = businessType;

    await merchant.update(updateData);

    // Return updated profile (exclude sensitive fields)
    const updatedMerchant = await Merchant.findOne({
      where: { id: merchantId },
      attributes: { exclude: ['password', 'passwordResetOtp', 'passwordResetExpires'] }
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      merchant: {
        id: updatedMerchant.id,
        first_name: updatedMerchant.firstName,
        last_name: updatedMerchant.lastName,
        email_address: updatedMerchant.email,
        phone_number: updatedMerchant.phoneNumber,
        business_type: updatedMerchant.businessType,
        updated: updatedMerchant.updatedAt
      }
    });
  } catch (err) {
    console.error('Update merchant profile error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error updating merchant profile',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false,
        message: 'New password must be at least 8 characters long' 
      });
    }

    // Verify that the requesting user is the same merchant
    if (req.user.id !== merchantId) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    const merchant = await Merchant.findOne({ where: { id: merchantId } });
    if (!merchant) {
      return res.status(404).json({ 
        success: false,
        message: 'Merchant not found' 
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, merchant.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ 
        success: false,
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await merchant.update({
      password: hashedNewPassword,
      passwordChangedAt: new Date()
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error changing password',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.createMerchant = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber } = req.body;

    // Check if requesting user has admin privileges (implement your admin check logic)
    if (req.user.type !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required' 
      });
    }

    const existingMerchant = await Merchant.findOne({ where: { email } });
    if (existingMerchant) {
      return res.status(400).json({ 
        success: false,
        message: 'Merchant with this email already exists' 
      });
    }

    const autoGeneratedPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(autoGeneratedPassword, 12);

    const newMerchant = await Merchant.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashedPassword,
      createdBy: req.user.id
    });

    const setPasswordLink = `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/set-password?merchantId=${newMerchant.id}`;

    // Send setup email (check if template exists)
    try {
      const templatePath = './templates/setupPassword.ejs';
      if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, 'utf8');
        const emailContent = ejs.render(template, {
          merchantName: newMerchant.firstName,
          setPasswordLink,
          autoGeneratedPassword,
        });

        await sendEmail(
          newMerchant.email,
          'Set Up Your Password - Discoun3',
          '',
          emailContent
        );
      }
    } catch (emailError) {
      console.error('Failed to send setup email:', emailError);
    }

    return res.status(201).json({
      success: true,
      message: 'Merchant created successfully. An email has been sent to set up their password.',
      merchant: {
        id: newMerchant.id,
        firstName: newMerchant.firstName,
        lastName: newMerchant.lastName,
        email: newMerchant.email,
        phoneNumber: newMerchant.phoneNumber,
      },
    });
  } catch (err) {
    console.error('Create merchant error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error creating merchant',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.searchMerchants = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ 
        success: false,
        message: 'Search query is required' 
      });
    }

    // Check if requesting user has admin privileges
    if (req.user.type !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required' 
      });
    }

    const offset = (page - 1) * limit;

    const { count, rows: merchants } = await Merchant.findAndCountAll({
      where: {
        [Op.or]: [
          { firstName: { [Op.like]: `%${query}%` } },
          { lastName: { [Op.like]: `%${query}%` } },
          { email: { [Op.like]: `%${query}%` } },
        ],
      },
      attributes: { exclude: ['password', 'passwordResetOtp', 'passwordResetExpires'] },
      offset: parseInt(offset),
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({ 
      success: true,
      merchants,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        hasNextPage: offset + merchants.length < count,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error('Search merchants error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error searching merchants',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Refresh token endpoint
exports.refreshToken = async (req, res) => {
  try {
    const { merchantId } = req.user;

    const merchant = await Merchant.findOne({ where: { id: merchantId } });
    if (!merchant) {
      return res.status(404).json({ 
        success: false,
        message: 'Merchant not found' 
      });
    }

    // Generate new token
    const token = jwt.sign({ 
      id: merchant.id, 
      email: merchant.email,
      type: 'merchant'
    }, JWT_SECRET, { 
      expiresIn: '24h'
    });

    return res.status(200).json({
      success: true,
      access_token: token,
      expires_in: '24h'
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(500).json({ 
      success: false,
      message: 'Error refreshing token',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};