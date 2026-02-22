/**
 * User Controller
 *
 * Phase 4: Handles user profile, password, cookie, and API key management.
 * All functions require authenticated user (req.user available from authMiddleware).
 *
 * @module controllers/userController
 */

const logger = require('../utils/logger');
const userService = require('../services/userService');
const apiKeyService = require('../services/apiKeyService');

/**
 * Get user profile
 *
 * Returns the current user's profile information including:
 * - Basic info (full_name, email)
 * - Account status (payment_status, activated)
 * - LinkedIn cookie status
 * - Timestamps
 *
 * @route GET /api/user/profile
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from JWT
 * @param {Object} res - Express response object
 * @returns {Object} User profile data
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Call service to get user profile
    const profile = await userService.getUserById(userId);

    res.status(200).json({
      success: true,
      user: profile
    });
  } catch (error) {
    logger.error('Get profile error', {
      userId: req.user?.id,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve profile'
    });
  }
};

/**
 * Update user profile
 *
 * Updates the current user's profile information.
 * Supports updating: full_name, email
 *
 * @route PUT /api/user/profile
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from JWT
 * @param {Object} req.body - Profile update data
 * @param {string} [req.body.full_name] - Updated full name
 * @param {string} [req.body.email] - Updated email
 * @param {Object} res - Express response object
 * @returns {Object} Updated user profile
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { full_name, email } = req.body;

    // Build updates object
    const updates = {};
    if (full_name) updates.full_name = full_name;
    if (email) updates.email = email;

    // Call service to update profile
    const updatedProfile = await userService.updateUserProfile(userId, updates);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedProfile
    });
  } catch (error) {
    logger.error('Update profile error', {
      userId: req.user?.id,
      error: error.message
    });

    // Handle specific errors
    if (error.message === 'Email already in use by another account') {
      return res.status(409).json({
        success: false,
        error: 'Email already in use by another account'
      });
    }

    if (error.message === 'At least one field (full_name or email) must be provided') {
      return res.status(400).json({
        success: false,
        error: 'At least one field (full_name or email) must be provided'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to update profile'
    });
  }
};

/**
 * Change user password
 *
 * Allows authenticated users to change their password.
 * Requires current password verification.
 *
 * @route PUT /api/user/change-password
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from JWT
 * @param {Object} req.body - Password change data
 * @param {string} req.body.current_password - Current password for verification
 * @param {string} req.body.new_password - New password to set
 * @param {Object} res - Express response object
 * @returns {Object} Success message
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { current_password, new_password } = req.body;

    // Call service to change password
    await userService.changeUserPassword(userId, current_password, new_password);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Password change error', {
      userId: req.user?.user_id,
      error: error.message
    });

    // Handle specific errors
    if (error.message === 'Current password is incorrect') {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    if (error.message === 'New password must be different from current password') {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from current password'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to change password'
    });
  }
};

/**
 * Store LinkedIn cookie
 *
 * Stores LinkedIn authentication cookie and user agent for scraping.
 * Cookie is stored in plain text (required for scraping functionality).
 *
 * @route POST /api/user/cookie
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from JWT
 * @param {Object} req.body - Cookie data
 * @param {string} req.body.linkedin_cookie - LinkedIn li_at cookie value
 * @param {string} req.body.user_agent - Browser user agent string
 * @param {Object} res - Express response object
 * @returns {Object} Success message with cookie_updated_at timestamp
 */
const storeCookie = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { linkedin_cookie, user_agent } = req.body;

    // Call service to store cookie
    const result = await userService.storeLinkedInCookie(userId, linkedin_cookie, user_agent);

    res.status(200).json({
      success: true,
      message: 'LinkedIn cookie stored successfully',
      cookie_updated_at: result.cookie_updated_at
    });
  } catch (error) {
    logger.error('Cookie storage error', {
      userId: req.user?.user_id,
      error: error.message
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to store cookie'
    });
  }
};

/**
 * Get API keys
 *
 * Returns all API keys for the authenticated user.
 * Keys are generated during account activation.
 *
 * @route GET /api/user/api-keys
 * @param {Object} req - Express request object
 * @param {Object} req.user - Authenticated user from JWT
 * @param {Object} res - Express response object
 * @returns {Object} API keys array with service details
 */
const getAPIKeys = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Call service to get API keys
    const result = await apiKeyService.getAPIKeys(userId);

    res.status(200).json(result);
  } catch (error) {
    logger.error('Get API keys error', {
      userId: req.user?.user_id,
      error: error.message
    });

    // Handle specific errors
    if (error.message === 'No API keys found. Keys should have been generated during activation.') {
      return res.status(404).json({
        success: false,
        error: 'No API keys found',
        message: 'API keys should have been generated during activation. Please contact support.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve API keys'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  storeCookie,
  getAPIKeys
};
