const bcrypt = require('bcryptjs');
const logger = require('./logger');

/**
 * Number of salt rounds for bcrypt hashing
 * Higher values increase security but also increase computation time
 * @type {number}
 * @constant
 */
const SALT_ROUNDS = 10;

/**
 * Hashes a plain text password using bcrypt
 * @param {string} plainTextPassword - The plain text password to hash
 * @returns {Promise<string>} The bcrypt hashed password
 * @throws {Error} If hashing fails
 * @example
 * const hash = await hashPassword('SecurePassword123!');
 * // Returns: '$2b$10$N9qo8uLOickgx2ZMRZoMye...'
 *
 * @security NEVER log the password parameter
 */
const hashPassword = async (plainTextPassword) => {
  try {
    if (!plainTextPassword) {
      throw new Error('Password is required');
    }

    const hash = await bcrypt.hash(plainTextPassword, SALT_ROUNDS);
    logger.debug('Password hashed successfully');
    return hash;
  } catch (err) {
    logger.error(`Password hashing failed: ${err.message}`, { stack: err.stack });
    throw new Error('Failed to hash password');
  }
};

/**
 * Compares a plain text password with a bcrypt hash
 * @param {string} plainTextPassword - The plain text password to check
 * @param {string} hashedPassword - The bcrypt hash to compare against
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 * @throws {Error} If comparison fails due to invalid inputs
 * @example
 * const isValid = await comparePassword('SecurePassword123!', '$2b$10$N9qo8uLOickgx2ZMRZoMye...');
 * // Returns: true or false
 *
 * @security NEVER log the password parameters
 */
const comparePassword = async (plainTextPassword, hashedPassword) => {
  try {
    if (!plainTextPassword || !hashedPassword) {
      logger.warn('Password comparison called with missing parameters');
      return false;
    }

    const isMatch = await bcrypt.compare(plainTextPassword, hashedPassword);
    return isMatch;
  } catch (err) {
    logger.error(`Password comparison failed: ${err.message}`, { stack: err.stack });
    return false;
  }
};

module.exports = {
  hashPassword,
  comparePassword,
  SALT_ROUNDS
};
