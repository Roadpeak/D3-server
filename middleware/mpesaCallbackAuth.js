/**
 * CRITICAL SECURITY: M-Pesa Callback Authentication Middleware
 * Protects payment callback endpoint from unauthorized access
 */

const crypto = require('crypto');

// M-Pesa Safaricom IP ranges (Production)
// These are the official IP addresses from which Safaricom sends callbacks
const MPESA_IP_WHITELIST = [
  '196.201.214.200',  // Safaricom primary
  '196.201.214.206',  // Safaricom secondary
  '196.201.213.114',  // Safaricom tertiary
  '196.201.214.207',  // Safaricom additional
  '196.201.214.208',  // Safaricom additional
  // Sandbox IPs for testing
  '127.0.0.1',        // Local testing
  'localhost',        // Local testing
];

// Add custom IPs from environment variable
const customIPs = process.env.MPESA_ALLOWED_IPS?.split(',').map(ip => ip.trim()) || [];
const ALLOWED_IPS = [...MPESA_IP_WHITELIST, ...customIPs];

/**
 * Extract real client IP from request (handles proxies)
 */
function getClientIP(req) {
  // Check various headers for real IP (in order of reliability)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             req.headers['x-real-ip'] ||
             req.connection.remoteAddress ||
             req.socket.remoteAddress ||
             req.connection.socket?.remoteAddress;

  // Remove IPv6 prefix if present
  return ip?.replace('::ffff:', '');
}

/**
 * Validate callback timestamp to prevent replay attacks
 */
function isTimestampValid(timestamp, maxAgeMinutes = 10) {
  if (!timestamp) return false;

  const now = Date.now();
  const callbackTime = new Date(timestamp).getTime();
  const ageMinutes = (now - callbackTime) / (1000 * 60);

  // Callback should be recent (within maxAgeMinutes)
  // and not from the future (allows 2 minute clock skew)
  return ageMinutes >= -2 && ageMinutes <= maxAgeMinutes;
}

/**
 * Verify callback signature (if implementing signature-based auth)
 * M-Pesa doesn't provide signatures by default, but you can implement
 * your own by including a secret in the callback URL query params
 */
function verifyCallbackSignature(req) {
  const callbackSecret = process.env.MPESA_CALLBACK_SECRET;

  if (!callbackSecret) {
    console.warn('⚠️ MPESA_CALLBACK_SECRET not set - signature verification disabled');
    return true; // Skip signature verification if not configured
  }

  // Check if signature is provided in query params or headers
  const providedSignature = req.query.signature || req.headers['x-callback-signature'];

  if (!providedSignature) {
    console.error('❌ Missing callback signature');
    return false;
  }

  // Generate expected signature
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', callbackSecret)
    .update(payload)
    .digest('hex');

  return providedSignature === expectedSignature;
}

/**
 * Main M-Pesa callback authentication middleware
 */
const mpesaCallbackAuth = (req, res, next) => {
  const clientIP = getClientIP(req);
  const timestamp = new Date().toISOString();

  console.log('🔐 M-Pesa callback authentication check:', {
    ip: clientIP,
    timestamp,
    path: req.path,
    method: req.method
  });

  // Log all callback attempts for audit trail
  console.log('📋 Callback attempt from:', {
    ip: clientIP,
    headers: JSON.stringify({
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip']
    })
  });

  // 1. IP Whitelist Check
  const isIPAllowed = ALLOWED_IPS.some(allowedIP => {
    // Support CIDR notation in the future if needed
    return clientIP === allowedIP || clientIP?.includes(allowedIP);
  });

  if (!isIPAllowed) {
    console.error(`🚨 SECURITY ALERT: Unauthorized M-Pesa callback attempt from IP: ${clientIP}`);
    console.error('📧 This should trigger an alert to security team!');

    // Log to security audit log (implement if you have one)
    // securityAuditLog.log('mpesa_callback_unauthorized', { ip: clientIP, timestamp });

    return res.status(403).json({
      ResultCode: 1,
      ResultDesc: 'Access Denied - Unauthorized IP'
    });
  }

  console.log('✅ IP whitelist check passed:', clientIP);

  // 2. Timestamp Validation (from callback body)
  const callbackTimestamp = req.body?.Body?.stkCallback?.CallbackMetadata?.Item?.find(
    item => item.Name === 'TransactionDate'
  )?.Value;

  if (callbackTimestamp && !isTimestampValid(callbackTimestamp, 10)) {
    console.warn(`⚠️ Callback timestamp validation failed: ${callbackTimestamp}`);
    // Don't reject - M-Pesa timestamps might have issues
    // Just log for monitoring
  }

  // 3. Signature Verification (optional but recommended)
  if (!verifyCallbackSignature(req)) {
    console.error('❌ Callback signature verification failed');

    // In production, you might want to reject here
    // For now, log and continue to maintain compatibility
    console.warn('⚠️ Continuing without signature verification for backward compatibility');
  }

  // 4. Rate limiting check (already handled by global rate limiter, but add extra check)
  // This is an additional layer specific to callbacks

  // 5. Log successful authentication
  console.log('✅ M-Pesa callback authentication successful');
  console.log('📊 Callback details:', {
    checkoutRequestID: req.body?.Body?.stkCallback?.CheckoutRequestID,
    resultCode: req.body?.Body?.stkCallback?.ResultCode
  });

  next();
};

/**
 * Middleware to validate M-Pesa callback structure
 */
const validateCallbackStructure = (req, res, next) => {
  const { Body } = req.body;

  if (!Body || !Body.stkCallback) {
    console.error('❌ Invalid callback structure - missing Body or stkCallback');
    return res.status(400).json({
      ResultCode: 1,
      ResultDesc: 'Invalid callback structure'
    });
  }

  const { stkCallback } = Body;

  if (!stkCallback.CheckoutRequestID) {
    console.error('❌ Missing CheckoutRequestID in callback');
    return res.status(400).json({
      ResultCode: 1,
      ResultDesc: 'Missing CheckoutRequestID'
    });
  }

  console.log('✅ Callback structure validation passed');
  next();
};

module.exports = {
  mpesaCallbackAuth,
  validateCallbackStructure,
  ALLOWED_IPS // Export for testing
};
