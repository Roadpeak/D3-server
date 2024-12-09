const { Merchant, Store } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ejs = require('ejs');
const fs = require('fs');
const { sendEmail } = require('../utils/emailUtil');

const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, password } = req.body;

    // Check for existing email
    const existingMerchant = await Merchant.findOne({ where: { email } });
    if (existingMerchant) {
      return res.status(400).json({ message: 'Merchant with this email already exists' });
    }

    // Check for existing phone number
    const existingPhone = await Merchant.findOne({ where: { phoneNumber } });
    if (existingPhone) {
      return res.status(400).json({ message: 'Merchant with this phone number already exists' });
    }

    // Create new merchant
    const newMerchant = await Merchant.create({ firstName, lastName, email, phoneNumber, password });

    const merchant = {
      id: newMerchant.id,
      first_name: newMerchant.firstName,
      last_name: newMerchant.lastName,
      email_address: newMerchant.email,
      phone_number: newMerchant.phoneNumber,
      joined: newMerchant.createdAt,
      updated: newMerchant.updatedAt,
    };

    // Generate JWT token
    const token = jwt.sign({ id: newMerchant.id, email: newMerchant.email }, JWT_SECRET, { expiresIn: '2378d' });

    // Render the welcome email template using EJS
    const template = fs.readFileSync('./templates/welcomeMerchant.ejs', 'utf8');
    const emailContent = ejs.render(template, {
      merchantName: newMerchant.firstName,
      dashboardLink: `https://discoun3ree.com/dashboard/${newMerchant.id}`,
    });

    // Send the welcome email
    await sendEmail(
      newMerchant.email,
      `Welcome to Discoun3, ${newMerchant.firstName}!`,
      '',
      emailContent
    );

    return res.status(201).json({ 
      merchant,
      access_token: token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error registering merchant' });
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const merchant = await Merchant.findOne({ where: { email } });
    if (!merchant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, merchant.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: merchant.id, email: merchant.email }, JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({
      id: merchant.id,
      first_name: merchant.firstName,
      last_name: merchant.lastName,
      email_address: merchant.email,
      phone_number: merchant.phoneNumber,
      joined: merchant.createdAt,
      updated: merchant.updatedAt,
      access_token: token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error logging in' });
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const merchant = await Merchant.findOne({ where: { email } });
    if (!merchant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    merchant.passwordResetOtp = otp;
    merchant.passwordResetExpires = Date.now() + 3600000;
    await merchant.save();

    const template = fs.readFileSync('./templates/passwordResetOtp.ejs', 'utf8');
    const emailContent = ejs.render(template, {
      otp: otp,
      merchantName: merchant.firstName, 
    });

    await sendEmail(
      merchant.email,
      'Password Reset OTP',
      '',
      emailContent
    );

    return res.status(200).json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error requesting password reset' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const merchant = await Merchant.findOne({ where: { email } });
    if (!merchant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    if (merchant.passwordResetOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (merchant.passwordResetExpires < Date.now()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    merchant.password = hashedPassword;
    merchant.passwordResetOtp = null;
    merchant.passwordResetExpires = null;
    await merchant.save();

    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error resetting password' });
  }
};

exports.getMerchantProfile = async (req, res) => {
  try {
    const { merchantId } = req.params;

    // Fetch merchant's basic information
    const merchant = await Merchant.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    const store = await Store.findOne({
      where: { merchant_id: merchantId },
      attributes: ['id', 'name', 'location', 'primary_email'],
    });

    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const creator = store.created_by
      ? await Merchant.findOne({
        where: { id: store.created_by },
        attributes: ['id', 'firstName', 'lastName'],
      })
      : null;

    const updater = store.updated_by
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
      store: store, // Include store info
      creator: creator, // Add creator info (if exists)
      updater: updater, // Add updater info (if exists)
    };

    return res.status(200).json({ merchantProfile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error retrieving merchant profile' });
  }
};