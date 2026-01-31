/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern for CSRF protection
 *
 * This is more secure and modern than the deprecated csurf package
 */

const crypto = require('crypto');

/**
 * Generate a random CSRF token
 */
const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * CSRF Protection Middleware
 * Sets a CSRF token cookie and validates it on state-changing requests
 */
const csrfProtection = (req, res, next) => {
  const method = req.method.toUpperCase();
  const isProduction = process.env.NODE_ENV === 'production';

  // Only generate a new CSRF token if one doesn't exist in the request cookies
  // This is critical for the double-submit cookie pattern to work correctly
  let csrfToken = req.cookies['XSRF-TOKEN'];

  if (!csrfToken) {
    // Generate new token only if client doesn't have one
    csrfToken = generateCsrfToken();

    // Set CSRF token as a readable cookie (not HttpOnly, so JavaScript can access it)
    res.cookie('XSRF-TOKEN', csrfToken, {
      httpOnly: false,        // Must be readable by JavaScript
      secure: isProduction,   // Only send over HTTPS in production
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
  }

  // For GET, HEAD, OPTIONS - no validation needed (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  // For state-changing methods (POST, PUT, DELETE, PATCH), validate CSRF token
  const tokenFromCookie = req.cookies['XSRF-TOKEN'];
  const tokenFromHeader = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];

  // Allow requests without CSRF check for specific endpoints
  // These are either:
  // 1. External callbacks (M-Pesa, webhooks)
  // 2. Authentication endpoints (login, register, OAuth)
  // 3. API-key authenticated endpoints (bookings)
  // 4. Endpoints that are already auth-protected via JWT/cookie
  const csrfExemptPaths = [
    '/api/v1/payments/mpesa/callback',  // M-Pesa callbacks
    '/api/v1/webhooks/',                // Webhook endpoints
    '/api/v1/users/login',              // User login
    '/api/v1/users/register',           // User registration
    '/api/v1/users/google-signin',      // Google OAuth
    '/api/v1/users/request-password-reset',  // User password reset request (rate-limited)
    '/api/v1/users/reset-password',     // User password reset (token-validated)
    '/api/v1/users/',                   // User profile updates (JWT authenticated)
    '/api/v1/merchants/login',          // Merchant login
    '/api/v1/merchants/register',       // Merchant registration
    '/api/v1/merchants/google-signin',  // Merchant Google OAuth
    '/api/v1/merchants/request-password-reset',  // Merchant password reset request (rate-limited)
    '/api/v1/merchants/reset-password', // Merchant password reset (token-validated)
    '/api/v1/merchants/',               // Merchant profile updates (JWT authenticated)
    '/api/v1/bookings',                 // Booking endpoints (API key authenticated)
    '/api/v1/notifications/',           // Push notification subscriptions
    '/api/v1/chat/',                    // Chat endpoints (JWT authenticated)
    '/api/v1/stores',                   // Store endpoints including follow (JWT authenticated)
    '/api/v1/offers',                   // Offer endpoints including favorites (JWT authenticated)
    '/api/v1/reels',                    // Reels endpoints (JWT authenticated)
    '/api/v1/upload/',                  // File upload endpoints (JWT authenticated)
    '/api/v1/services',                 // Service endpoints (JWT authenticated)
  ];

  // Check if path matches any exempt path (exact match or starts with)
  const isExempt = csrfExemptPaths.some(exemptPath => {
    // Exact match
    if (req.path === exemptPath) return true;
    // Starts with (for paths with trailing slash or subpaths)
    if (req.path.startsWith(exemptPath + '/')) return true;
    if (exemptPath.endsWith('/') && req.path.startsWith(exemptPath)) return true;
    return false;
  });

  if (isExempt) {
    console.log(`⚠️  CSRF check skipped for exempt path: ${req.path}`);
    return next();
  }

  // Validate CSRF token
  if (!tokenFromHeader) {
    console.log('❌ CSRF validation failed: No token in header');
    return res.status(403).json({
      success: false,
      message: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING'
    });
  }

  if (!tokenFromCookie) {
    console.log('❌ CSRF validation failed: No token in cookie');
    return res.status(403).json({
      success: false,
      message: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING'
    });
  }

  // Timing-safe comparison to prevent timing attacks
  const cookieBuffer = Buffer.from(tokenFromCookie);
  const headerBuffer = Buffer.from(tokenFromHeader);

  if (cookieBuffer.length !== headerBuffer.length) {
    console.log('❌ CSRF validation failed: Token length mismatch');
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID'
    });
  }

  if (!crypto.timingSafeEqual(cookieBuffer, headerBuffer)) {
    console.log('❌ CSRF validation failed: Token mismatch');
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID'
    });
  }

  console.log(`✅ CSRF validation passed for ${method} ${req.path}`);
  next();
};

/**
 * Endpoint to get CSRF token
 * Useful for applications that need to fetch the token explicitly
 */
const getCsrfToken = (req, res) => {
  const token = req.cookies['XSRF-TOKEN'];

  if (!token) {
    const newToken = generateCsrfToken();
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('XSRF-TOKEN', newToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.json({
      success: true,
      csrfToken: newToken
    });
  }

  res.json({
    success: true,
    csrfToken: token
  });
};

module.exports = {
  csrfProtection,
  getCsrfToken,
  generateCsrfToken
};
