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
 * Get paginated list of payments (users with payment data)
 *
 * @param {Object} filters - Filter options
 * @param {string} [filters.payment_status] - 'pending' or 'paid'
 * @param {number} [filters.page] - Page number, default 1
 * @param {number} [filters.limit] - Results per page, default 50, max 100
 * @returns {Promise<Object>} Object containing payments array and pagination info
 */
const getPayments = async (filters = {}) => {
  try {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const offset = (page - 1) * limit;

    // Build base query
    let query = supabase
      .from('users')
      .select('id, email, full_name, payment_status, payment_id, activated, activated_at, signup_date, created_at');

    // Apply payment_status filter
    if (filters.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }

    // Apply ordering and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: users, error } = await query;

    if (error) {
      logger.error('Error fetching payments', { error: error.message });
      throw error;
    }

    // Build count query with same filter
    let countQuery = supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (filters.payment_status) {
      countQuery = countQuery.eq('payment_status', filters.payment_status);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      logger.error('Error counting payments', { error: countError.message });
      throw countError;
    }

    // Map results to response format
    const mappedPayments = (users || []).map(user => ({
      user_id: user.id,
      name: user.full_name,
      email: user.email,
      payment_status: user.payment_status,
      payment_id: user.payment_id || null,
      activated: user.activated,
      activated_at: user.activated_at || null,
      signup_date: user.signup_date,
      created_at: user.created_at
    }));

    return {
      payments: mappedPayments,
      pagination: {
        current_page: page,
        total_pages: Math.ceil((totalCount || 0) / limit),
        total_payments: totalCount || 0,
        per_page: limit
      }
    };
  } catch (err) {
    logger.error('getPayments error', { error: err.message });
    throw err;
  }
};

/**
 * Get payment detail for a specific user
 *
 * @param {string} userId - users.id (UUID)
 * @returns {Promise<Object>} Object containing payment detail
 * @throws {Object} Error with code 'USER_NOT_FOUND' if user doesn't exist
 */
const getPaymentDetail = async (userId) => {
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

    // Map response
    return {
      user_id: user.id,
      name: user.full_name,
      email: user.email,
      payment_status: user.payment_status,
      payment_id: user.payment_id || null,
      payment_verified_at: user.payment_verified_at || null,
      activated: user.activated,
      activated_at: user.activated_at || null,
      signup_date: user.signup_date,
      created_at: user.created_at,
      is_active: user.is_active
    };
  } catch (err) {
    if (err.code === 'USER_NOT_FOUND') {
      throw err;
    }
    logger.error('getPaymentDetail error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Get orphaned payments with suggested matches
 *
 * Orphaned payments are users where:
 * - payment_id IS NOT NULL
 * - activated = false
 * - payment_status != 'paid'
 *
 * @returns {Promise<Object>} Object containing orphaned payments with suggested matches
 */
const getOrphanedPayments = async () => {
  try {
    // Query orphaned payments
    const { data: orphanedUsers, error } = await supabase
      .from('users')
      .select('id, email, full_name, payment_id, payment_status, created_at')
      .not('payment_id', 'is', null)
      .eq('activated', false)
      .neq('payment_status', 'paid')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching orphaned payments', { error: error.message });
      throw error;
    }

    // For each orphaned user, find suggested matches from same email domain
    const mappedResults = [];

    for (const user of (orphanedUsers || [])) {
      const suggestedMatches = [];

      // Extract domain from email
      const emailParts = user.email.split('@');
      if (emailParts.length === 2) {
        const domain = emailParts[1];

        // Find paid users with same email domain
        const { data: matches, error: matchError } = await supabase
          .from('users')
          .select('id, email, full_name, payment_status')
          .ilike('email', `%@${domain}`)
          .neq('id', user.id)
          .eq('payment_status', 'paid')
          .limit(3);

        if (!matchError && matches) {
          for (const match of matches) {
            suggestedMatches.push({
              user_id: match.id,
              name: match.full_name,
              email: match.email,
              payment_status: match.payment_status
            });
          }
        }
      }

      mappedResults.push({
        user_id: user.id,
        name: user.full_name,
        email: user.email,
        payment_id: user.payment_id,
        payment_status: user.payment_status,
        created_at: user.created_at,
        suggested_matches: suggestedMatches
      });
    }

    return {
      orphaned_payments: mappedResults,
      total: mappedResults.length
    };
  } catch (err) {
    logger.error('getOrphanedPayments error', { error: err.message });
    throw err;
  }
};

/**
 * Link a payment to a user and activate their account
 *
 * @param {Object} data - Payment link data
 * @param {string} data.user_id - Target users.id (UUID)
 * @param {string} data.payment_id - Payment ID to assign
 * @param {string} [data.admin_notes] - Optional notes for audit log
 * @param {string} adminId - admin_users.admin_id (UUID) for logging
 * @returns {Promise<Object>} Success message
 * @throws {Object} Error with code 'USER_NOT_FOUND' or 'PAYMENT_ID_IN_USE'
 */
const linkPayment = async (data, adminId) => {
  try {
    // Query target user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, payment_status, activated')
      .eq('id', data.user_id)
      .single();

    if (error || !user) {
      const err = new Error('User not found');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    // Check if payment_id is already in use by another user
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('payment_id', data.payment_id)
      .neq('id', data.user_id)
      .single();

    if (!checkError && existingUser) {
      const err = new Error(`Payment ID is already linked to user: ${existingUser.email}`);
      err.code = 'PAYMENT_ID_IN_USE';
      throw err;
    }

    // Update target user
    const activatedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('users')
      .update({
        payment_id: data.payment_id,
        payment_status: 'paid',
        activated: true,
        activated_at: activatedAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.user_id);

    if (updateError) {
      logger.error('Error linking payment', { userId: data.user_id, error: updateError.message });
      throw updateError;
    }

    // Resolve any open admin_alerts related to this payment_id
    // Note: Use correct Phase 5 column names: status, resolved_by, resolved_at, metadata
    try {
      await supabase
        .from('admin_alerts')
        .update({
          status: 'resolved',
          resolved_by: adminId,
          resolved_at: new Date().toISOString()
        })
        .eq('status', 'unresolved')
        .filter('metadata->>payment_id', 'eq', data.payment_id);
    } catch (alertError) {
      // Do NOT throw - log and continue
      logger.warn('Failed to resolve related alerts (non-critical)', {
        payment_id: data.payment_id,
        error: alertError.message
      });
    }

    // Log to system_logs
    await supabase.from('system_logs').insert({
      log_level: 'info',
      service: 'admin',
      action: 'link_payment',
      message: `Admin linked payment ${data.payment_id} to user ${user.email}`,
      admin_id: adminId,
      user_id: data.user_id,
      request_data: {
        payment_id: data.payment_id,
        linked_by: adminId,
        admin_notes: data.admin_notes || null
      }
    });

    logger.info('Payment linked successfully', {
      userId: data.user_id,
      paymentId: data.payment_id,
      adminId
    });

    return { message: 'Payment linked and user activated successfully' };
  } catch (err) {
    if (err.code === 'USER_NOT_FOUND' || err.code === 'PAYMENT_ID_IN_USE') {
      throw err;
    }
    logger.error('linkPayment error', { userId: data.user_id, adminId, error: err.message });
    throw err;
  }
};

/**
 * Get paginated list of alerts with filters
 *
 * @param {Object} filters - Filter options
 * @param {string} [filters.status] - 'unresolved' or 'resolved', default 'unresolved'
 * @param {string} [filters.alert_type] - 'orphaned_payment', 'duplicate_payment', 'new_signup', 'system_error'
 * @param {string} [filters.severity] - 'info', 'warning', 'error'
 * @param {number} [filters.page] - Page number, default 1
 * @param {number} [filters.limit] - Results per page, default 50, max 100
 * @returns {Promise<Object>} Object containing alerts array and pagination info
 */
const getAlerts = async (filters = {}) => {
  try {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const offset = (page - 1) * limit;
    const status = filters.status || 'unresolved';

    // Build base query
    let query = supabase
      .from('admin_alerts')
      .select('alert_id, alert_type, severity, title, description, metadata, status, resolved_by, resolved_at, created_at');

    // Apply status filter (default to 'unresolved')
    query = query.eq('status', status);

    // Apply alert_type filter
    if (filters.alert_type) {
      query = query.eq('alert_type', filters.alert_type);
    }

    // Apply severity filter
    if (filters.severity) {
      query = query.eq('severity', filters.severity);
    }

    // Apply ordering and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: alerts, error } = await query;

    if (error) {
      logger.error('Error fetching alerts', { error: error.message });
      throw error;
    }

    // Build count query with same filters
    let countQuery = supabase
      .from('admin_alerts')
      .select('alert_id', { count: 'exact', head: true })
      .eq('status', status);

    if (filters.alert_type) {
      countQuery = countQuery.eq('alert_type', filters.alert_type);
    }

    if (filters.severity) {
      countQuery = countQuery.eq('severity', filters.severity);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      logger.error('Error counting alerts', { error: countError.message });
      throw countError;
    }

    return {
      alerts: alerts || [],
      pagination: {
        current_page: page,
        total_pages: Math.ceil((totalCount || 0) / limit),
        total_alerts: totalCount || 0,
        per_page: limit
      }
    };
  } catch (err) {
    logger.error('getAlerts error', { error: err.message });
    throw err;
  }
};

/**
 * Resolve an admin alert
 *
 * @param {string} alertId - admin_alerts.alert_id (UUID)
 * @param {string} adminId - admin_users.admin_id (UUID) for logging
 * @param {Object} data - Resolution data
 * @param {string} data.action - Action taken to resolve
 * @param {string} [data.notes] - Optional resolution notes
 * @returns {Promise<Object>} Success message
 * @throws {Object} Error with code 'ALERT_NOT_FOUND' or 'ALREADY_RESOLVED'
 */
const resolveAlert = async (alertId, adminId, data) => {
  try {
    // Query alert
    const { data: alert, error } = await supabase
      .from('admin_alerts')
      .select('*')
      .eq('alert_id', alertId)
      .single();

    if (error || !alert) {
      const err = new Error('Alert not found');
      err.code = 'ALERT_NOT_FOUND';
      throw err;
    }

    // Check if already resolved
    if (alert.status === 'resolved') {
      const err = new Error('Alert is already resolved');
      err.code = 'ALREADY_RESOLVED';
      throw err;
    }

    // Update alert
    const resolvedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('admin_alerts')
      .update({
        status: 'resolved',
        resolved_by: adminId,
        resolved_at: resolvedAt
      })
      .eq('alert_id', alertId);

    if (updateError) {
      logger.error('Error resolving alert', { alertId, error: updateError.message });
      throw updateError;
    }

    // Log to system_logs
    await supabase.from('system_logs').insert({
      log_level: 'info',
      service: 'admin',
      action: 'resolve_alert',
      message: `Admin resolved alert: ${alertId}`,
      admin_id: adminId,
      request_data: {
        alert_id: alertId,
        action: data.action,
        notes: data.notes || null
      }
    });

    logger.info('Alert resolved successfully', { alertId, adminId });

    return { message: 'Alert resolved successfully' };
  } catch (err) {
    if (err.code === 'ALERT_NOT_FOUND' || err.code === 'ALREADY_RESOLVED') {
      throw err;
    }
    logger.error('resolveAlert error', { alertId, adminId, error: err.message });
    throw err;
  }
};

/**
 * Get paginated system logs with filters
 *
 * @param {Object} filters - Filter options
 * @param {string} [filters.log_level] - 'info', 'warn', 'error'
 * @param {string} [filters.action] - Action string to filter by
 * @param {string} [filters.user_id] - UUID of user to filter by
 * @param {string} [filters.date_from] - ISO date string, start of range
 * @param {string} [filters.date_to] - ISO date string, end of range
 * @param {number} [filters.page] - Page number, default 1
 * @param {number} [filters.limit] - Results per page, default 100, max 200
 * @returns {Promise<Object>} Object containing logs array and pagination info
 */
const getLogs = async (filters = {}) => {
  try {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 100, 200);
    const offset = (page - 1) * limit;

    // Build base query (exclude request_data, response_data, error_stack, user_agent for lean response)
    let query = supabase
      .from('system_logs')
      .select('id, log_level, service, action, message, user_id, admin_id, ip_address, created_at');

    // Apply log_level filter
    if (filters.log_level) {
      query = query.eq('log_level', filters.log_level);
    }

    // Apply action filter
    if (filters.action) {
      query = query.eq('action', filters.action);
    }

    // Apply user_id filter
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    // Apply date_from filter
    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }

    // Apply date_to filter
    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    // Apply ordering and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: logs, error } = await query;

    if (error) {
      logger.error('Error fetching logs', { error: error.message });
      throw error;
    }

    // Build count query with same filters
    let countQuery = supabase
      .from('system_logs')
      .select('id', { count: 'exact', head: true });

    if (filters.log_level) {
      countQuery = countQuery.eq('log_level', filters.log_level);
    }

    if (filters.action) {
      countQuery = countQuery.eq('action', filters.action);
    }

    if (filters.user_id) {
      countQuery = countQuery.eq('user_id', filters.user_id);
    }

    if (filters.date_from) {
      countQuery = countQuery.gte('created_at', filters.date_from);
    }

    if (filters.date_to) {
      countQuery = countQuery.lte('created_at', filters.date_to);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      logger.error('Error counting logs', { error: countError.message });
      throw countError;
    }

    return {
      logs: logs || [],
      pagination: {
        current_page: page,
        total_pages: Math.ceil((totalCount || 0) / limit),
        total_logs: totalCount || 0,
        per_page: limit
      }
    };
  } catch (err) {
    logger.error('getLogs error', { error: err.message });
    throw err;
  }
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
