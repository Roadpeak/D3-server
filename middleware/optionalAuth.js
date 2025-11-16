// middleware/optionalAuth.js - Optional Authentication Middleware
const jwt = require('jsonwebtoken');

/**
 * Optional authentication middleware
 * Adds user info to req.user if token is present, but doesn't require it
 * Used for endpoints that work with or without authentication
 */
exports.optionalAuth = async (req, res, next) => {
    try {
        // Check for token in Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No token present - continue without authentication
            return next();
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        if (!token) {
            return next();
        }

        // Try to verify the token
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Add user info to request
            req.user = {
                id: decoded.id || decoded.userId || decoded.user_id,
                email: decoded.email,
                type: decoded.type || decoded.userType || 'customer',
                // Add any other fields from your JWT payload
            };

            // Continue with authenticated user
            next();
        } catch (tokenError) {
            // Token is invalid or expired - continue without authentication
            // Don't throw error, just proceed without user
            next();
        }

    } catch (error) {
        // Any other error - continue without authentication
        next();
    }
};