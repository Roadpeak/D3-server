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

  // Generate and set CSRF token for all requests
  // This ensures the frontend always has a fresh token
  const csrfToken = generateCsrfToken();

  const isProduction = process.env.NODE_ENV === 'production';

  // Set CSRF token as a readable cookie (not HttpOnly, so JavaScript can access it)
  res.cookie('XSRF-TOKEN', csrfToken, {
    httpOnly: false,        // Must be readable by JavaScript
    secure: isProduction,   // Only send over HTTPS in production
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });

  // For GET, HEAD, OPTIONS - no validation needed (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  // For state-changing methods (POST, PUT, DELETE, PATCH), validate CSRF token
  const tokenFromCookie = req.cookies['XSRF-TOKEN'];
  const tokenFromHeader = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];

  // Allow requests without CSRF check for specific endpoints
  const csrfExemptPaths = [
    '/api/v1/payments/mpesa/callback',  // M-Pesa callbacks
    '/api/v1/webhooks/',                // Webhook endpoints
    '/api/v1/users/login',              // User login
    '/api/v1/users/register',           // User registration
    '/api/v1/users/google-signin',      // Google OAuth
    '/api/v1/merchants/login',          // Merchant login
    '/api/v1/merchants/register',       // Merchant registration
    '/api/v1/merchants/google-signin',  // Merchant Google OAuth
    '/api/v1/bookings',                 // Booking endpoints (API key authenticated)
  ];

  const isExempt = csrfExemptPaths.some(path => req.path.startsWith(path));

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
