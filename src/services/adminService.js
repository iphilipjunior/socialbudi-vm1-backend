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
 *
 * @param {Object} filters - Filter options
 * @param {string} [filters.search] - Search term for full_name or email (ILIKE)
 * @param {string} [filters.payment_status] - 'pending' or 'paid'
 * @param {boolean} [filters.activated] - true or false
 * @param {number} [filters.page] - Page number, default 1
 * @param {number} [filters.limit] - Results per page, default 50, max 100
 * @returns {Promise<Object>} Object containing users array and pagination info
 */
const getUsers = async (filters = {}) => {
  try {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const offset = (page - 1) * limit;

    // Build base query
    let query = supabase
      .from('users')
      .select('id, email, full_name, payment_status, payment_id, activated, linkedin_cookie, activated_at, signup_date, created_at');

    // Apply search filter (full_name OR email ILIKE)
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      query = query.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
    }

    // Apply payment_status filter
    if (filters.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }

    // Apply activated filter (only if explicitly defined)
    if (filters.activated !== undefined) {
      query = query.eq('activated', filters.activated);
    }

    // Apply ordering and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: users, error } = await query;

    if (error) {
      logger.error('Error fetching users', { error: error.message });
      throw error;
    }

    // Build count query with same filters
    let countQuery = supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      countQuery = countQuery.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
    }

    if (filters.payment_status) {
      countQuery = countQuery.eq('payment_status', filters.payment_status);
    }

    if (filters.activated !== undefined) {
      countQuery = countQuery.eq('activated', filters.activated);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      logger.error('Error counting users', { error: countError.message });
      throw countError;
    }

    // Map results to response format
    const mappedUsers = (users || []).map(user => ({
      user_id: user.id,
      name: user.full_name,
      email: user.email,
      payment_status: user.payment_status,
      payment_id: user.payment_id,
      activated: user.activated,
      linkedin_cookie_set: !!user.linkedin_cookie,
      created_at: user.created_at,
      activated_at: user.activated_at
    }));

    return {
      users: mappedUsers,
      pagination: {
        current_page: page,
        total_pages: Math.ceil((totalCount || 0) / limit),
        total_users: totalCount || 0,
        per_page: limit
      }
    };
  } catch (err) {
    logger.error('getUsers error', { error: err.message });
    throw err;
  }
};

/**
 * Get a single user by ID with full profile and API keys
 *
 * @param {string} userId - users.id (UUID)
 * @returns {Promise<Object>} Object containing user profile and api_keys array
 * @throws {Object} Error with code 'USER_NOT_FOUND' if user doesn't exist
 */
const getUser = async (userId) => {
  try {
    // Query user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      const err = new Error('User not found');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    // Query API keys (do NOT include api_key value)
    const { data: apiKeys, error: apiKeysError } = await supabase
      .from('api_keys')
      .select('id, service, key_name, is_active, created_at, last_used_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (apiKeysError) {
      logger.warn('Error fetching API keys for user', { userId, error: apiKeysError.message });
    }

    // Map user response
    const mappedUser = {
      user_id: user.id,
      name: user.full_name,
      email: user.email,
      payment_status: user.payment_status,
      payment_id: user.payment_id,
      activated: user.activated,
      activated_at: user.activated_at,
      signup_date: user.signup_date,
      created_at: user.created_at,
      linkedin_cookie_set: !!user.linkedin_cookie,
      is_active: user.is_active,
      api_keys: apiKeys || []
    };

    return { user: mappedUser };
  } catch (err) {
    if (err.code === 'USER_NOT_FOUND') {
      throw err;
    }
    logger.error('getUser error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Manually activate a user account
 *
 * @param {string} userId - users.id (UUID)
 * @param {string} adminId - admin_users.admin_id (UUID) for logging
 * @returns {Promise<Object>} Object containing activated user info
 * @throws {Object} Error with code 'USER_NOT_FOUND' or 'ALREADY_ACTIVATED'
 */
const activateUser = async (userId, adminId) => {
  try {
    // Query user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, activated, payment_status')
      .eq('id', userId)
      .single();

    if (error || !user) {
      const err = new Error('User not found');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    // Check if already activated
    if (user.activated === true) {
      const err = new Error('User is already activated');
      err.code = 'ALREADY_ACTIVATED';
      throw err;
    }

    // Build update object
    const activatedAt = new Date().toISOString();
    const updateData = {
      activated: true,
      activated_at: activatedAt,
      updated_at: new Date().toISOString()
    };

    // Only update payment_status if not already 'paid'
    if (user.payment_status !== 'paid') {
      updateData.payment_status = 'paid';
    }

    // Update user
    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      logger.error('Error activating user', { userId, error: updateError.message });
      throw updateError;
    }

    // Log to system_logs
    await supabase.from('system_logs').insert({
      log_level: 'info',
      service: 'admin',
      action: 'manual_activation',
      message: `Admin manually activated user: ${user.email}`,
      admin_id: adminId,
      user_id: userId,
      request_data: { activated_by: adminId }
    });

    logger.info('User manually activated by admin', { userId, adminId, email: user.email });

    return {
      user: {
        user_id: userId,
        email: user.email,
        activated: true,
        activated_at: activatedAt
      }
    };
  } catch (err) {
    if (err.code === 'USER_NOT_FOUND' || err.code === 'ALREADY_ACTIVATED') {
      throw err;
    }
    logger.error('activateUser error', { userId, adminId, error: err.message });
    throw err;
  }
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
