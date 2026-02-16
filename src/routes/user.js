/**
 * User Management Routes
 *
 * Phase 4: User profile, password, cookie, and API key management endpoints.
 * All routes require JWT authentication.
 *
 * @module routes/user
 */

const express = require('express');
const router = express.Router();

// Middleware
const authMiddleware = require('../middleware/authMiddleware');
const {
  userProfileRateLimiter,
  passwordChangeRateLimiter,
  cookieStorageRateLimiter
} = require('../middleware/rateLimiter');
const {
  validateProfileUpdate,
  validatePasswordChange,
  validateCookieStorage
} = require('../middleware/validation');

// Controller
const userController = require('../controllers/userController');

// ============================================================================
// User Profile Routes
// ============================================================================

/**
 * GET /api/user/profile
 * Get current user's profile information
 *
 * @middleware authMiddleware - Verify JWT token
 * @middleware userProfileRateLimiter - 30 requests/minute
 */
router.get(
  '/profile',
  userProfileRateLimiter,
  authMiddleware,
  userController.getProfile
);

/**
 * PUT /api/user/profile
 * Update current user's profile information
 *
 * @middleware authMiddleware - Verify JWT token
 * @middleware userProfileRateLimiter - 30 requests/minute
 * @middleware validateProfileUpdate - Validate name field
 */
router.put(
  '/profile',
  userProfileRateLimiter,
  authMiddleware,
  validateProfileUpdate,
  userController.updateProfile
);

// ============================================================================
// Password Management Routes
// ============================================================================

/**
 * PUT /api/user/change-password
 * Change current user's password
 *
 * @middleware authMiddleware - Verify JWT token
 * @middleware passwordChangeRateLimiter - 5 attempts/hour
 * @middleware validatePasswordChange - Validate current and new password
 */
router.put(
  '/change-password',
  passwordChangeRateLimiter,
  authMiddleware,
  validatePasswordChange,
  userController.changePassword
);

// ============================================================================
// Cookie Storage Routes
// ============================================================================

/**
 * POST /api/user/cookie
 * Store LinkedIn cookie for automation
 *
 * @middleware authMiddleware - Verify JWT token
 * @middleware cookieStorageRateLimiter - 10 requests/minute
 * @middleware validateCookieStorage - Validate linkedin_cookie field
 */
router.post(
  '/cookie',
  cookieStorageRateLimiter,
  authMiddleware,
  validateCookieStorage,
  userController.storeCookie
);

// ============================================================================
// API Key Routes
// ============================================================================

/**
 * GET /api/user/api-keys
 * Get current user's API keys
 *
 * @middleware authMiddleware - Verify JWT token
 * @middleware userProfileRateLimiter - 30 requests/minute
 */
router.get(
  '/api-keys',
  userProfileRateLimiter,
  authMiddleware,
  userController.getAPIKeys
);

module.exports = router;
