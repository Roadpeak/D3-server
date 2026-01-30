/**
 * Rate Limiting Configuration - DISABLED
 * Rate limiting has been disabled per production requirements
 * All rate limiters are pass-through middleware
 */

// Pass-through middleware that does nothing
const passThrough = (req, res, next) => next();

// ==========================================
// ALL RATE LIMITERS DISABLED - PASS THROUGH
// ==========================================

const generalLimiter = passThrough;
const authLimiter = passThrough;
const paymentLimiter = passThrough;
const uploadLimiter = passThrough;
const passwordResetLimiter = passThrough;
const creationLimiter = passThrough;

module.exports = {
  generalLimiter,
  authLimiter,
  paymentLimiter,
  uploadLimiter,
  passwordResetLimiter,
  creationLimiter
};
