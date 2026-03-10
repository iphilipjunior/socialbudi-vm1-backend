/**
 * User Service
 *
 * Phase 4: Business logic for user profile management, password changes,
 * and LinkedIn cookie storage.
 *
 * @module services/userService
 */

const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

/**
 * Number of salt rounds for bcrypt hashing
 * @constant {number}
 */
const BCRYPT_ROUNDS = 10;

/**
 * Get user by ID
 *
 * Fetches user profile data excluding sensitive fields.
 * Adds computed field: linkedin_cookie_set (boolean).
 *
 * @param {string} userId - User's UUID
 * @returns {Promise<Object>} User profile data
 * @throws {Error} If user not found or database error
 *
 * @example
 * const user = await getUserById('uuid-here');
 * // Returns: { id, full_name, email, payment_status, activated, ... }
 */
const getUserById = async (userId) => {
  try {
    logger.info('Fetching user profile', { userId });

    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, payment_status, activated, activated_at, linkedin_cookie, cookie_updated_at, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Database error fetching user', { userId, error: error.message });
      throw new Error('Failed to fetch user profile');
    }

    if (!data) {
      logger.warn('User not found', { userId });
      throw new Error('User not found');
    }

    // Compute linkedin_cookie_set without exposing raw cookie
    const profile = {
      id: data.id,
      full_name: data.full_name,
      email: data.email,
      payment_status: data.payment_status,
      activated: data.activated,
      activated_at: data.activated_at,
      linkedin_cookie_set: !!data.linkedin_cookie,
      cookie_updated_at: data.cookie_updated_at,
      created_at: data.created_at
    };

    logger.debug('User profile fetched successfully', { userId });
    return profile;
  } catch (err) {
    logger.error('Get user error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Update user profile
 *
 * Updates user's full_name and/or email with uniqueness validation.
 *
 * @param {string} userId - User's UUID
 * @param {Object} updates - Profile update data
 * @param {string} [updates.full_name] - Updated full name
 * @param {string} [updates.email] - Updated email
 * @returns {Promise<Object>} Updated user profile
 * @throws {Error} If validation fails, email conflict, or database error
 *
 * @example
 * const updated = await updateUserProfile('uuid', { full_name: 'Jane Doe' });
 */
const updateUserProfile = async (userId, updates) => {
  try {
    const { full_name, email } = updates;

    // Double-check at least one field provided (should be caught by validator)
    if (!full_name && !email) {
      throw new Error('At least one field (full_name or email) must be provided');
    }

    logger.info('Updating user profile', {
      userId,
      fieldsUpdated: {
        full_name: !!full_name,
        email: !!email
      }
    });

    // If email provided, check uniqueness
    if (email) {
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (expected when email is unique)
        logger.error('Database error checking email uniqueness', { userId, error: checkError.message });
        throw new Error('Failed to verify email uniqueness');
      }

      if (existingUser) {
        logger.warn('Email already in use', { userId, attemptedEmail: email });
        throw new Error('Email already in use by another account');
      }
    }

    // Build update object dynamically
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (full_name) {
      updateData.full_name = full_name;
    }

    if (email) {
      updateData.email = email;
    }

    // Update user record
    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      logger.error('Database error updating user', { userId, error: updateError.message });
      throw new Error('Failed to update user profile');
    }

    // Fetch and return updated user
    const updatedUser = await getUserById(userId);

    logger.info('User profile updated successfully', {
      userId,
      fieldsChanged: Object.keys(updateData).filter(k => k !== 'updated_at')
    });

    return updatedUser;
  } catch (err) {
    logger.error('Update user profile error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Change user password
 *
 * Securely changes user's password after verifying current password.
 *
 * @param {string} userId - User's UUID
 * @param {string} currentPassword - Current password (plain text)
 * @param {string} newPassword - New password (plain text)
 * @returns {Promise<Object>} Success message
 * @throws {Error} If current password incorrect, same password, or database error
 *
 * SECURITY: Never logs passwords (plain or hashed)
 *
 * @example
 * const result = await changeUserPassword('uuid', 'oldpass', 'newpass');
 * // Returns: { success: true, message: 'Password changed successfully' }
 */
const changeUserPassword = async (userId, currentPassword, newPassword) => {
  try {
    logger.info('Password change requested', { userId });

    // Step 1: Fetch user's current password_hash
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (fetchError) {
      logger.error('Database error fetching password hash', { userId, error: fetchError.message });
      throw new Error('Failed to verify current password');
    }

    if (!user) {
      logger.warn('User not found for password change', { userId });
      throw new Error('User not found');
    }

    // Step 2: Verify currentPassword matches using bcrypt.compare()
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isCurrentPasswordValid) {
      logger.warn('Password change failed - incorrect current password', { userId });
      throw new Error('Current password is incorrect');
    }

    // Step 3: Verify newPassword differs from currentPassword
    const isNewSameAsCurrent = await bcrypt.compare(newPassword, user.password_hash);

    if (isNewSameAsCurrent) {
      logger.warn('Password change failed - new password same as current', { userId });
      throw new Error('New password must be different from current password');
    }

    // Step 4: Hash newPassword with bcrypt
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Step 5: Update database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      logger.error('Database error updating password', { userId, error: updateError.message });
      throw new Error('Failed to update password');
    }

    // Step 6: Log password change (DO NOT log passwords)
    logger.info('Password changed successfully', { userId });

    return {
      success: true,
      message: 'Password changed successfully'
    };
  } catch (err) {
    logger.error('Password change error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Store LinkedIn cookie
 *
 * Stores LinkedIn authentication cookies and user agent for scraping.
 *
 * @param {string} userId - User's UUID
 * @param {string} linkedinCookie - LinkedIn li_at cookie value
 * @param {string} userAgent - Browser user agent string
 * @param {string|null} jsessionid - LinkedIn JSESSIONID cookie (optional)
 * @param {string|null} bcookie - LinkedIn bcookie value (optional)
 * @returns {Promise<Object>} Success with cookie_updated_at timestamp
 * @throws {Error} If database error
 *
 * SECURITY: Cookies stored in plain text (required for scraping).
 * DO NOT log cookie values.
 *
 * @example
 * const result = await storeLinkedInCookie('uuid', 'AQEDARabc...', 'Mozilla/5.0...', 'ajax:123...', 'v=2&abc...');
 * // Returns: { success: true, cookie_updated_at: '2026-02-16T10:30:00Z' }
 */
const storeLinkedInCookie = async (userId, linkedinCookie, userAgent, jsessionid = null, bcookie = null) => {
  try {
    // DO NOT log cookie values
    logger.info('LinkedIn cookie storage requested', { userId });

    const cookieUpdatedAt = new Date().toISOString();

    // Build update object with required fields
    const updateData = {
      linkedin_cookie: linkedinCookie,
      linkedin_user_agent: userAgent,
      cookie_updated_at: cookieUpdatedAt,
      updated_at: cookieUpdatedAt
    };

    // Add optional cookies if provided
    if (jsessionid !== null) {
      updateData.linkedin_jsessionid = jsessionid;
    }
    if (bcookie !== null) {
      updateData.linkedin_bcookie = bcookie;
    }

    // Update users table with cookies and user agent
    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      logger.error('Database error storing LinkedIn cookie', { userId, error: error.message });
      throw new Error('Failed to store LinkedIn cookie');
    }

    // Log cookie update (DO NOT log cookie values)
    logger.info('LinkedIn cookie updated successfully', { userId });

    return {
      success: true,
      cookie_updated_at: cookieUpdatedAt
    };
  } catch (err) {
    logger.error('Store LinkedIn cookie error', { userId, error: err.message });
    throw err;
  }
};

module.exports = {
  getUserById,
  updateUserProfile,
  changeUserPassword,
  storeLinkedInCookie
};
