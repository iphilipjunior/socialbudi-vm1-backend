/**
 * Admin Authentication Middleware
 *
 * Verifies admin JWT tokens from the Authorization header.
 * Rejects user tokens (those containing user_id in payload).
 * Attaches decoded admin payload to req.admin.
 *
 * @module middleware/adminAuth
 */

const { verifyAdminToken } = require('../services/adminJwtService');
const logger = require('../utils/logger');

/**
 * Admin authentication middleware for protecting admin routes
 *
 * Verifies the admin JWT token from the Authorization header and
 * attaches the decoded admin payload to req.admin.
 *
 * Rejects tokens that contain a user_id field (user tokens) or
 * lack an admin_id field (not a valid admin token).
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 *
 * Error responses:
 * - 401: No token provided
 * - 403: User token presented, invalid/expired admin token, or missing admin_id
 */
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists and has correct format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Admin auth attempt without valid Authorization header', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Extract token from header
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      logger.warn('Admin auth attempt with empty token', { ip: req.ip, path: req.path });
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify admin token
    const decoded = verifyAdminToken(token);

    // Reject user tokens (user tokens contain user_id field)
    if (decoded.user_id) {
      logger.warn('User token presented to admin endpoint', {
        ip: req.ip,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Verify admin_id exists in payload
    if (!decoded.admin_id) {
      logger.warn('Token missing admin_id field', {
        ip: req.ip,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Attach admin info to request object
    req.admin = decoded;

    logger.debug('Admin authenticated successfully', {
      admin_id: decoded.admin_id,
      path: req.path
    });

    next();
  } catch (err) {
    if (err.message === 'Token expired' || err.message === 'Invalid token') {
      logger.warn('Admin auth failed', {
        reason: err.message,
        ip: req.ip,
        path: req.path
      });
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired admin token'
      });
    }

    logger.error(`Admin authentication middleware error: ${err.message}`, {
      ip: req.ip,
      path: req.path,
      stack: err.stack
    });

    return res.status(403).json({
      success: false,
      message: 'Invalid or expired admin token'
    });
  }
};

module.exports = adminAuth;
