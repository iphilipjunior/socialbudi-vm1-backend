const { verifyToken } = require('../services/jwtService');
const logger = require('../utils/logger');

/**
 * Authentication middleware for protecting routes
 * Verifies JWT token from Authorization header and attaches user to request
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 *
 * @example
 * // Usage in routes:
 * router.get('/protected', authMiddleware, (req, res) => {
 *   // req.user contains { user_id, email, role, iat, exp }
 *   res.json({ user: req.user });
 * });
 *
 * @description
 * Expected Authorization header format: "Bearer <token>"
 *
 * Response codes:
 * - 401: No token provided, invalid token, or expired token
 * - Continues to next middleware if token is valid
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists and has correct format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Auth attempt without valid Authorization header', {
        ip: req.ip,
        path: req.path,
        hasHeader: !!authHeader
      });
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Extract token from header
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      logger.warn('Auth attempt with empty token', { ip: req.ip, path: req.path });
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Verify token and get decoded payload
    const decoded = verifyToken(token);

    // Attach user info to request object for use in route handlers
    req.user = decoded;

    logger.debug('User authenticated successfully', {
      user_id: decoded.user_id,
      path: req.path
    });

    next();
  } catch (err) {
    // Handle specific JWT errors
    if (err.message === 'Token expired') {
      logger.warn('Auth attempt with expired token', { ip: req.ip, path: req.path });
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }

    if (err.message === 'Invalid token') {
      logger.warn('Auth attempt with invalid token', { ip: req.ip, path: req.path });
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }

    // Handle unexpected errors
    logger.error(`Authentication middleware error: ${err.message}`, {
      ip: req.ip,
      path: req.path,
      stack: err.stack
    });

    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

module.exports = authMiddleware;
