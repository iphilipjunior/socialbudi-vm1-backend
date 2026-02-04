const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * JWT Secret key from environment variables
 * @type {string}
 */
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Token expiration time from environment variables
 * @type {string}
 * @default '24h'
 */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generates a JWT token for the given payload
 * @param {Object} payload - The payload to encode in the token
 * @param {string} payload.user_id - The user's unique identifier
 * @param {string} payload.email - The user's email address
 * @param {string} payload.role - The user's role (e.g., 'user', 'admin')
 * @returns {string} The generated JWT token
 * @throws {Error} If JWT_SECRET is not configured or token generation fails
 * @example
 * const token = generateToken({ user_id: '123', email: 'user@example.com', role: 'user' });
 */
const generateToken = (payload) => {
  try {
    if (!JWT_SECRET) {
      logger.error('JWT_SECRET is not configured in environment variables');
      throw new Error('JWT configuration error');
    }

    const token = jwt.sign(payload, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: JWT_EXPIRES_IN
    });

    logger.debug('JWT token generated successfully', { user_id: payload.user_id });
    return token;
  } catch (err) {
    logger.error(`Failed to generate JWT token: ${err.message}`, {
      user_id: payload?.user_id,
      stack: err.stack
    });
    throw err;
  }
};

/**
 * Verifies a JWT token and returns the decoded payload
 * @param {string} token - The JWT token to verify
 * @returns {Object} The decoded token payload containing user_id, email, role, iat, and exp
 * @throws {Error} If token is invalid, expired, or JWT_SECRET is not configured
 * @example
 * const decoded = verifyToken('eyJhbGciOiJIUzI1NiIs...');
 * // Returns: { user_id: '123', email: 'user@example.com', role: 'user', iat: ..., exp: ... }
 */
const verifyToken = (token) => {
  try {
    if (!JWT_SECRET) {
      logger.error('JWT_SECRET is not configured in environment variables');
      throw new Error('JWT configuration error');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('JWT token has expired');
      throw new Error('Token expired');
    }
    if (err.name === 'JsonWebTokenError') {
      logger.warn(`Invalid JWT token: ${err.message}`);
      throw new Error('Invalid token');
    }
    logger.error(`JWT verification error: ${err.message}`, { stack: err.stack });
    throw err;
  }
};

/**
 * Decodes a JWT token without verifying the signature
 * Useful for extracting payload from expired tokens (e.g., for refresh)
 * @param {string} token - The JWT token to decode
 * @returns {Object|null} The decoded token payload or null if decoding fails
 * @example
 * const payload = decodeToken('eyJhbGciOiJIUzI1NiIs...');
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (err) {
    logger.warn(`Failed to decode JWT token: ${err.message}`);
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken
};
