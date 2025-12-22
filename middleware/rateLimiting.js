const rateLimit = require('express-rate-limit');

/**
 * CRITICAL SECURITY: Rate Limiting Configuration
 * Protects against brute force attacks, DoS, and API abuse
 */

// ==========================================
// GENERAL API RATE LIMITER
// ==========================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs (reasonable for normal browsing)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
});

// ==========================================
// STRICT AUTH ENDPOINTS LIMITER
// ==========================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login/register attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all attempts, even successful ones
  handler: (req, res) => {
    console.error(`🚨 SECURITY ALERT: Multiple failed auth attempts from IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Your IP has been temporarily blocked for security reasons.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
      blockedUntil: new Date(req.rateLimit.resetTime).toISOString()
    });
  },
});

// ==========================================
// PAYMENT ENDPOINTS LIMITER
// ==========================================
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 payment requests per hour
  message: {
    success: false,
    message: 'Payment request limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Payment rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many payment requests. Please try again in 1 hour.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
});

// ==========================================
// FILE UPLOAD LIMITER
// ==========================================
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per 15 minutes
  message: {
    success: false,
    message: 'Upload limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Upload rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many file uploads. Please try again in 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
});

// ==========================================
// PASSWORD RESET LIMITER
// ==========================================
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Password reset limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many password reset attempts. Please try again in 1 hour.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
});

// ==========================================
// API CREATION LIMITER (Store, Offer, etc.)
// ==========================================
const creationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 creations per 15 minutes (allows for bulk operations)
  message: {
    success: false,
    message: 'Creation limit exceeded. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Creation rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many creation requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  paymentLimiter,
  uploadLimiter,
  passwordResetLimiter,
  creationLimiter
};
