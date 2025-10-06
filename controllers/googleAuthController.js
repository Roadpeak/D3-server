// controllers/googleAuthController.js - Google Authentication Handler
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const userService = require('../services/userService');

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Initialize Google OAuth2 client
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Google Sign-In for Users
 */
exports.googleSignInUser = async (req, res) => {
  try {
    const { credential, referralSlug } = req.body;

    if (!credential) {
      return res.status(400).json({
        message: 'Google credential is required',
        errors: { credential: 'Google credential is missing' }
      });
    }

    if (!GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID is not configured');
      return res.status(500).json({
        message: 'Google authentication is not configured on this server',
        errors: {}
      });
    }

    // Verify the Google token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (verificationError) {
      console.error('Google token verification failed:', verificationError);
      return res.status(422).json({
        message: 'Invalid Google token',
        errors: { credential: 'Google token verification failed' }
      });
    }

    const payload = ticket.getPayload();
    const {
      sub: googleId,
      email,
      given_name: firstName,
      family_name: lastName,
      picture: avatarUrl,
      email_verified: isEmailVerified
    } = payload;

    console.log('Google user data:', {
      googleId,
      email,
      firstName,
      lastName,
      isEmailVerified
    });

    // Check if user already exists by email
    let user = await userService.findUserByEmail(email);
    let isNewUser = false;

    if (user) {
      console.log('Existing user found, updating Google info');
      
      // Update existing user with Google info if not already set
      const updateData = {};
      if (!user.googleId) updateData.googleId = googleId;
      if (!user.avatar && avatarUrl) updateData.avatar = avatarUrl;
      if (!user.emailVerifiedAt && isEmailVerified) updateData.emailVerifiedAt = new Date();

      if (Object.keys(updateData).length > 0) {
        await user.update(updateData);
      }

      // Update last login
      if (user.updateLastLogin) {
        await user.updateLastLogin();
      }
    } else {
      console.log('Creating new user from Google data');
      isNewUser = true;

      // Handle referral if provided
      let referrerId = null;
      if (referralSlug) {
        const referrer = await userService.findUserByReferralSlug(referralSlug);
        if (referrer) {
          referrerId = referrer.id;
          console.log(`User referred by: ${referrer.firstName} ${referrer.lastName}`);
        }
      }

      // Generate unique referral data for new user
      const newUserReferralSlug = generateReferralSlug(Math.random().toString(), firstName, lastName);
      const newUserReferralLink = `${process.env.FRONTEND_URL || 'https://discoun3ree.com'}/accounts/sign-up?ref=${newUserReferralSlug}`;

      // Create new user
      try {
        user = await userService.createUser(
          firstName || 'User',
          lastName || '',
          email,
          null, // No phone number from Google
          null, // No password needed for Google users
          'customer',
          {
            googleId,
            avatar: avatarUrl,
            emailVerifiedAt: isEmailVerified ? new Date() : null,
            referralSlug: newUserReferralSlug,
            referralLink: newUserReferralLink,
            referredBy: referrerId,
            referredAt: referrerId ? new Date() : null,
            authProvider: 'google'
          }
        );

        console.log('New user created successfully:', user.email);

        // Send welcome email (non-blocking)
        try {
          await sendWelcomeEmailWithReferralInfo(user, referrerId);
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
        }

        // Notify referrer if applicable
        if (referrerId) {
          try {
            await notifyReferrerOfNewSignup(referrerId, user);
          } catch (notificationError) {
            console.error('Error notifying referrer:', notificationError);
          }
        }
      } catch (createError) {
        console.error('Error creating user:', createError);
        
        if (createError.name === 'SequelizeUniqueConstraintError') {
          return res.status(409).json({
            message: 'User already exists with this email',
            errors: { email: 'An account with this email already exists' }
          });
        }

        return res.status(500).json({
          message: 'Failed to create user account',
          errors: {}
        });
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        type: 'user'
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      message: isNewUser ? 'Account created with Google successfully' : 'Google sign-in successful',
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
        authProvider: 'google',
        googleId: user.googleId,
        referralLink: user.referralLink,
        wasReferred: !!user.referredBy,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      access_token: token,
      isNewUser,
      referralInfo: user.referredBy ? {
        message: 'You were successfully referred! Start booking offers to help your referrer earn rewards.',
        referrerNotified: true
      } : null
    });
  } catch (error) {
    console.error('Google Sign-In error:', error);
    return res.status(500).json({
      message: 'An error occurred during Google authentication',
      errors: {}
    });
  }
};

/**
 * Link Google account to existing user
 */
exports.linkGoogleAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        message: 'Google credential is required',
        errors: { credential: 'Google credential is missing' }
      });
    }

    // Verify the Google token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (verificationError) {
      console.error('Google token verification failed:', verificationError);
      return res.status(422).json({
        message: 'Invalid Google token',
        errors: { credential: 'Google token verification failed' }
      });
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email: googleEmail, picture: avatarUrl } = payload;

    // Get current user
    const user = await userService.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        errors: {}
      });
    }

    // Check if Google account is already linked to another user
    const existingGoogleUser = await userService.findUserByGoogleId(googleId);
    if (existingGoogleUser && existingGoogleUser.id !== userId) {
      return res.status(409).json({
        message: 'This Google account is already linked to another user',
        errors: { google: 'Google account already in use' }
      });
    }

    // Check if email matches
    if (user.email !== googleEmail) {
      return res.status(400).json({
        message: 'Google account email does not match your current email',
        errors: { email: 'Email mismatch' }
      });
    }

    // Update user with Google info
    const updateData = { googleId };
    if (!user.avatar && avatarUrl) {
      updateData.avatar = avatarUrl;
    }

    await user.update(updateData);

    return res.status(200).json({
      message: 'Google account linked successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar,
        googleLinked: true
      }
    });
  } catch (error) {
    console.error('Link Google account error:', error);
    return res.status(500).json({
      message: 'An error occurred while linking Google account',
      errors: {}
    });
  }
};

/**
 * Unlink Google account from user
 */
exports.unlinkGoogleAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await userService.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        errors: {}
      });
    }

    if (!user.googleId) {
      return res.status(400).json({
        message: 'No Google account is linked to this user',
        errors: {}
      });
    }

    // Check if user has a password - they need one if unlinking Google
    if (!user.password) {
      return res.status(400).json({
        message: 'Please set a password before unlinking your Google account',
        errors: { password: 'Password required before unlinking Google' }
      });
    }

    await user.update({ googleId: null });

    return res.status(200).json({
      message: 'Google account unlinked successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        googleLinked: false
      }
    });
  } catch (error) {
    console.error('Unlink Google account error:', error);
    return res.status(500).json({
      message: 'An error occurred while unlinking Google account',
      errors: {}
    });
  }
};

/**
 * Google Sign-In for Merchants
 */
exports.googleSignInMerchant = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        message: 'Google credential is required',
        errors: { credential: 'Google credential is missing' }
      });
    }

    // Verify the Google token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (verificationError) {
      console.error('Google token verification failed:', verificationError);
      return res.status(422).json({
        message: 'Invalid Google token',
        errors: { credential: 'Google token verification failed' }
      });
    }

    const payload = ticket.getPayload();
    const {
      sub: googleId,
      email,
      given_name: firstName,
      family_name: lastName,
      picture: avatarUrl,
      email_verified: isEmailVerified
    } = payload;

    // Check if merchant already exists by email
    let merchant = await userService.findMerchantByEmail(email);
    let isNewMerchant = false;

    if (merchant) {
      // Update existing merchant with Google info
      const updateData = {};
      if (!merchant.googleId) updateData.googleId = googleId;
      if (!merchant.avatar && avatarUrl) updateData.avatar = avatarUrl;
      if (!merchant.emailVerifiedAt && isEmailVerified) updateData.emailVerifiedAt = new Date();

      if (Object.keys(updateData).length > 0) {
        await merchant.update(updateData);
      }

      if (merchant.updateLastLogin) {
        await merchant.updateLastLogin();
      }
    } else {
      // Create new merchant
      isNewMerchant = true;
      merchant = await userService.createMerchant(
        firstName || 'Merchant',
        lastName || '',
        email,
        '', // No phone number from Google
        null, // No password needed for Google merchants
        {
          googleId,
          avatar: avatarUrl,
          emailVerifiedAt: isEmailVerified ? new Date() : null,
          authProvider: 'google'
        }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: merchant.id, 
        email: merchant.email,
        type: 'merchant'
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      message: isNewMerchant ? 'Merchant account created with Google successfully' : 'Google sign-in successful',
      merchant: {
        id: merchant.id,
        firstName: merchant.firstName,
        lastName: merchant.lastName,
        email: merchant.email,
        phoneNumber: merchant.phoneNumber,
        avatar: merchant.avatar,
        userType: 'merchant',
        isEmailVerified: merchant.isEmailVerified?.() || !!merchant.emailVerifiedAt,
        isPhoneVerified: merchant.isPhoneVerified?.() || !!merchant.phoneVerifiedAt,
        authProvider: 'google',
        googleId: merchant.googleId,
        createdAt: merchant.createdAt,
        updatedAt: merchant.updatedAt,
      },
      access_token: token,
      isNewMerchant
    });
  } catch (error) {
    console.error('Google Sign-In error for merchant:', error);
    return res.status(500).json({
      message: 'An error occurred during Google authentication',
      errors: {}
    });
  }
};

// Helper functions
function generateReferralSlug(id, firstName, lastName) {
  const nameSlug = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  const randomId = Math.random().toString(36).substring(2, 10);
  return `${nameSlug}-${randomId}`;
}

// Placeholder functions - implement based on your email service
async function sendWelcomeEmailWithReferralInfo(user, referrerId) {
  // Implement welcome email logic
  console.log(`Welcome email would be sent to ${user.email}`);
}

async function notifyReferrerOfNewSignup(referrerId, newUser) {
  // Implement referrer notification logic
  console.log(`Referrer ${referrerId} would be notified of new signup: ${newUser.email}`);
}