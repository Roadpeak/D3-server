/**
 * Cookie Helper Utility
 * Provides secure HttpOnly cookie management for JWT tokens
 */

/**
 * Set JWT token as HttpOnly cookie
 *
 * @param {object} res - Express response object
 * @param {string} token - JWT token to store
 * @param {string} tokenName - Cookie name (default: 'access_token')
 * @param {number} maxAge - Cookie max age in milliseconds (default: 30 days)
 */
const setTokenCookie = (res, token, tokenName = 'access_token', maxAge = 30 * 24 * 60 * 60 * 1000) => {
  const isProduction = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,              // Cannot be accessed by JavaScript (XSS protection)
    secure: isProduction,        // Only send over HTTPS in production
    sameSite: isProduction ? 'none' : 'lax',  // CSRF protection
    maxAge: maxAge,              // 30 days by default
    path: '/',                   // Available across all paths
  };

  // Add domain only in production
  if (isProduction) {
    cookieOptions.domain = '.discoun3ree.com';
  }

  res.cookie(tokenName, token, cookieOptions);

  console.log(`✅ HttpOnly cookie set: ${tokenName} (secure: ${isProduction})`);
};

/**
 * Clear JWT token cookie
 *
 * @param {object} res - Express response object
 * @param {string} tokenName - Cookie name to clear (default: 'access_token')
 */
const clearTokenCookie = (res, tokenName = 'access_token') => {
  const isProduction = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    expires: new Date(0), // Expire immediately
  };

  if (isProduction) {
    cookieOptions.domain = '.discoun3ree.com';
  }

  res.clearCookie(tokenName, cookieOptions);

  console.log(`🗑️  HttpOnly cookie cleared: ${tokenName}`);
};

/**
 * Get token from request cookies
 *
 * @param {object} req - Express request object
 * @param {string} tokenName - Cookie name (default: 'access_token')
 * @returns {string|null} - Token value or null if not found
 */
const getTokenFromCookie = (req, tokenName = 'access_token') => {
  return req.cookies?.[tokenName] || null;
};

module.exports = {
  setTokenCookie,
  clearTokenCookie,
  getTokenFromCookie
};
