const { Merchant } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ejs = require('ejs');
const fs = require('fs');
const { sendEmail } = require('../utils/emailUtil');

const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, password } = req.body;

    const existingMerchant = await Merchant.findOne({ where: { email } });
    if (existingMerchant) {
      return res.status(400).json({ message: 'Merchant with this email already exists' });
    }

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

    const template = fs.readFileSync('./templates/welcomeMerchant.ejs', 'utf8');
    const emailContent = ejs.render(template, {
      merchantName: newMerchant.firstName,
      dashboardLink: `https://discoun3ree.com/dashboard/${newMerchant.id}`,
    });

    await sendEmail(
      newMerchant.email,
      `Welcome to Discoun3, ${newMerchant.firstName}!`,
      '',
      emailContent
    );

    return res.status(201).json({ merchant });
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
