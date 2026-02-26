/**
 * Admin Service
 *
 * Business logic for admin operations including authentication,
 * user management, payment management, alerts, and system logs.
 *
 * @module services/adminService
 */

const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const { generateAdminToken } = require('./adminJwtService');

/**
 * Authenticates an admin user and returns a JWT token
 *
 * @param {string} email - Admin email address
 * @param {string} password - Admin password (plain text for comparison)
 * @param {string} [ipAddress] - IP address of the request (for logging)
 * @returns {Promise<Object>} Object containing token and admin info
 * @returns {string} return.token - JWT token for the admin
 * @returns {Object} return.admin - Admin user data (admin_id, name, email, role)
 * @throws {Object} Error with code property: 'INVALID_CREDENTIALS' or 'ACCOUNT_INACTIVE'
 */
const loginAdmin = async (email, password, ipAddress) => {
  try {
    // Query admin_users table (case-insensitive email match)
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .ilike('email', email)
      .single();

    if (error || !admin) {
      logger.warn('Admin login failed: admin not found', { email });
      const err = new Error('Invalid email or password');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Check if account is active
    if (admin.is_active === false) {
      logger.warn('Admin login failed: account inactive', { email, admin_id: admin.admin_id });
      const err = new Error('Account is inactive');
      err.code = 'ACCOUNT_INACTIVE';
      throw err;
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatch) {
      logger.warn('Admin login failed: invalid password', { email });
      const err = new Error('Invalid email or password');
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Generate admin JWT token
    const token = generateAdminToken({
      admin_id: admin.admin_id,
      email: admin.email,
      role: admin.role
    });

    // Update last_login timestamp
    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('admin_id', admin.admin_id);

    // Log to system_logs
    await supabase.from('system_logs').insert({
      log_level: 'info',
      service: 'admin',
      action: 'admin_login',
      message: `Admin login: ${email}`,
      admin_id: admin.admin_id,
      ip_address: ipAddress || null
    });

    logger.info('Admin login successful', { admin_id: admin.admin_id, email });

    return {
      token,
      admin: {
        admin_id: admin.admin_id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    };
  } catch (err) {
    if (err.code === 'INVALID_CREDENTIALS' || err.code === 'ACCOUNT_INACTIVE') {
      throw err;
    }
    logger.error('Admin login error', { email, error: err.message });
    throw err;
  }
};

/**
 * Get paginated list of users with optional search and filters
 * @throws {Error} Not implemented yet
 */
const getUsers = async () => {
  throw new Error('Not implemented yet');
};

/**
 * Get a single user by ID with full profile and API keys
 * @throws {Error} Not implemented yet
 */
const getUser = async () => {
  throw new Error('Not implemented yet');
};

/**
 * Manually activate a user account
 * @throws {Error} Not implemented yet
 */
const activateUser = async () => {
  throw new Error('Not implemented yet');
};

/**
 * Get paginated list of payments
 * @throws {Error} Not implemented yet
 */
const getPayments = async () => {
  throw new Error('Not implemented yet');
};

/**
 * Get payment detail for a specific user
 * @throws {Error} Not implemented yet
 */
const getPaymentDetail = async () => {
  throw new Error('Not implemented yet');
};

/**
 * Get orphaned payments with suggested matches
 * @throws {Error} Not implemented yet
 */
const getOrphanedPayments = async () => {
  throw new Error('Not implemented yet');
};

/**
 * Link a payment to a user and activate their account
 * @throws {Error} Not implemented yet
 */
const linkPayment = async () => {
  throw new Error('Not implemented yet');
};

/**
 * Get paginated list of alerts with filters
 * @throws {Error} Not implemented yet
 */
const getAlerts = async () => {
  throw new Error('Not implemented yet');
};

/**
 * Resolve an admin alert
 * @throws {Error} Not implemented yet
 */
const resolveAlert = async () => {
  throw new Error('Not implemented yet');
};

/**
 * Get paginated system logs with filters
 * @throws {Error} Not implemented yet
 */
const getLogs = async () => {
  throw new Error('Not implemented yet');
};

module.exports = {
  loginAdmin,
  getUsers,
  getUser,
  activateUser,
  getPayments,
  getPaymentDetail,
  getOrphanedPayments,
  linkPayment,
  getAlerts,
  resolveAlert,
  getLogs
};
