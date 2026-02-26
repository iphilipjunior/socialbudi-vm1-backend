/**
 * Admin JWT Service
 *
 * Handles JWT token generation and verification for admin users.
 * Uses ADMIN_JWT_SECRET (separate from user JWT_SECRET).
 *
 * @module services/adminJwtService
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Admin JWT secret key from environment variables
 * @type {string}
 */
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;

/**
 * Admin token expiration time
 * @type {string}
 * @default '24h'
 */
const ADMIN_JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '24h';

/**
 * Generates a JWT token for an admin user
 *
 * @param {Object} admin - Admin user data
 * @param {string} admin.admin_id - Admin's unique identifier
 * @param {string} admin.email - Admin's email address
 * @param {string} admin.role - Admin's role ('admin' or 'superadmin')
 * @returns {string} The generated JWT token
 * @throws {Error} If ADMIN_JWT_SECRET is not configured or token generation fails
 */
const generateAdminToken = (admin) => {
  try {
    if (!ADMIN_JWT_SECRET) {
      logger.error('ADMIN_JWT_SECRET is not configured in environment variables');
      throw new Error('Admin JWT configuration error');
    }

    const payload = {
      admin_id: admin.admin_id,
      email: admin.email,
      role: admin.role
    };

    const token = jwt.sign(payload, ADMIN_JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: ADMIN_JWT_EXPIRES_IN
    });

    logger.debug('Admin JWT token generated successfully', { admin_id: admin.admin_id });
    return token;
  } catch (err) {
    logger.error(`Failed to generate admin JWT token: ${err.message}`, {
      admin_id: admin?.admin_id,
      stack: err.stack
    });
    throw err;
  }
};

/**
 * Verifies an admin JWT token and returns the decoded payload
 *
 * @param {string} token - The JWT token to verify
 * @returns {Object} The decoded token payload containing admin_id, email, role, iat, exp
 * @throws {Error} If token is invalid, expired, or ADMIN_JWT_SECRET is not configured
 */
const verifyAdminToken = (token) => {
  try {
    if (!ADMIN_JWT_SECRET) {
      logger.error('ADMIN_JWT_SECRET is not configured in environment variables');
      throw new Error('Admin JWT configuration error');
    }

    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('Admin JWT token has expired');
      throw new Error('Token expired');
    }
    if (err.name === 'JsonWebTokenError') {
      logger.warn(`Invalid admin JWT token: ${err.message}`);
      throw new Error('Invalid token');
    }
    logger.error(`Admin JWT verification error: ${err.message}`, { stack: err.stack });
    throw err;
  }
};

module.exports = {
  generateAdminToken,
  verifyAdminToken
};
