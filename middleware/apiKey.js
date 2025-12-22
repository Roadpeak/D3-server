// middleware/apiKey.js - TEMPORARY BYPASS VERSION
const apiKeyMiddleware = (req, res, next) => {
  const validApiKey = process.env.API_KEY;
  const apiKey = req.header('api-key') || req.header('x-api-key') || req.header('X-API-Key');

  const isDevelopment = process.env.NODE_ENV === 'development';

  // TEMPORARY: Bypass API key validation completely in development
  if (isDevelopment) {
    console.log(`🔓 DEVELOPMENT: Bypassing API key validation for: ${req.method} ${req.path}`);
    return next();
  }

  // Routes that completely skip API key validation
  const skipApiKeyRoutes = [
    '/health',
    '/api/v1/api-docs',
    '/api/v1/payments/mpesa/callback',
    '/api/v1/locations',  // Public location data
    '/api/v1/services',  // Public services data
  ];

  // Routes that skip API key validation (auth endpoints)
  const authRoutes = [
    '/api/v1/merchants/login',
    '/api/v1/merchants/register',
    '/api/v1/users/login',
    '/api/v1/users/register',
    '/api/v1/users/verify-otp',
    '/api/v1/users/resend-otp',
    '/api/v1/users/google-signin',  // Google OAuth
    '/api/v1/merchants/google-signin',  // Merchant Google OAuth
  ];

  // Skip API key validation entirely for these routes
  if (skipApiKeyRoutes.some(route => req.path === route || req.path.startsWith(route))) {
    console.log(`⏭️  Skipping API key validation for: ${req.path}`);
    return next();
  }

  // Skip API key validation for auth routes
  if (authRoutes.some(route => req.path === route)) {
    console.log(`🔐 Skipping API key for auth route: ${req.path}`);
    return next();
  }

  // In development, make API key optional if not configured
  if (isDevelopment && !validApiKey) {
    console.warn('⚠️  API_KEY not set in environment variables - skipping validation');
    return next();
  }

  if (!apiKey) {
    console.log(`❌ API key missing for: ${req.method} ${req.path}`);
    return res.status(400).json({
      success: false,
      message: 'API key is missing',
      errors: {}
    });
  }

  // Handle whitespace and comparison issues
  const trimmedApiKey = apiKey.trim();
  const trimmedValidKey = validApiKey.trim();

  if (validApiKey && trimmedApiKey !== trimmedValidKey) {
    console.log(`❌ Invalid API key for: ${req.method} ${req.path}`);
    console.log(`🔍 Received: "${trimmedApiKey.substring(0, 15)}..."`);
    console.log(`🔍 Expected: "${trimmedValidKey.substring(0, 15)}..."`);

    return res.status(403).json({
      success: false,
      message: 'Forbidden: Invalid API key',
      errors: {}
    });
  }

  console.log(`✅ API key validated for: ${req.method} ${req.path}`);
  next();
};

module.exports = { apiKeyMiddleware };