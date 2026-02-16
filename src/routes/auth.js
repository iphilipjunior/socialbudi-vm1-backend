/**
 * Authentication Routes
 *
 * Handles user signup, login, account activation, and token management.
 * All routes are prefixed with /api/auth
 *
 * Middleware chain for each endpoint:
 * 1. Rate limiter (prevents abuse) - where applicable
 * 2. Input validation (validates and sanitizes) - where applicable
 * 3. Auth middleware (for protected routes)
 * 4. Controller (business logic)
 *
 * @module routes/auth
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { signupValidation, loginValidation, activationValidation } = require('../middleware/validation');
const { signupRateLimiter, loginRateLimiter, activationRateLimiter } = require('../middleware/rateLimiter');

/**
 * POST /api/auth/signup
 * Create a new user account with pending payment status
 *
 * Middleware chain:
 * 1. Rate limiter (5 per hour per IP)
 * 2. Input validation (name, email, password)
 * 3. Controller logic
 *
 * @body {string} name - User's full name (2-100 chars, letters/spaces/hyphens/apostrophes)
 * @body {string} email - User's email address (unique, valid format)
 * @body {string} password - User's password (8-128 chars, must include uppercase, lowercase, number)
 * @returns {Object} Success response with user_id and next_action
 */
router.post('/signup', signupRateLimiter, signupValidation, authController.signup);

/**
 * POST /api/auth/login
 * Authenticate user and return appropriate redirect based on account state
 *
 * Middleware chain:
 * 1. Rate limiter (10 per minute per IP)
 * 2. Input validation (email, password)
 * 3. Controller logic
 *
 * @body {string} email - User's email address
 * @body {string} password - User's password
 * @returns {Object} Success response with redirect path and optionally JWT token
 */
router.post('/login', loginRateLimiter, loginValidation, authController.login);

/**
 * POST /api/auth/activate
 * Verify payment ID and activate user account
 *
 * Middleware chain:
 * 1. Rate limiter (20 per hour per email)
 * 2. Input validation (email, payment_id)
 * 3. Controller logic
 *
 * @body {string} email - User's email address
 * @body {string} payment_id - Payment ID from payment provider (1-100 characters, any format)
 * @returns {Object} Success response with JWT token and API keys
 */
router.post('/activate', activationRateLimiter, activationValidation, authController.activate);

/**
 * GET /api/auth/verify-token
 * Verify if JWT token is valid
 *
 * Middleware chain:
 * 1. Auth middleware (verifies token)
 * 2. Controller logic (returns user info and expiration)
 *
 * @header Authorization: Bearer <token>
 * @returns {Object} Token validity status, user info, and expiration time
 */
router.get('/verify-token', authMiddleware, authController.verifyToken);

/**
 * POST /api/auth/refresh-token
 * Refresh an expired or expiring JWT token
 *
 * Allows tokens expired within 7 days to be refreshed.
 * Verifies user still exists and is activated before issuing new token.
 *
 * @body {string} token - The expired or expiring JWT token
 * @returns {Object} New JWT token and user info
 */
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
