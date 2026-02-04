/**
 * Authentication Routes
 *
 * Handles user signup, login, and account activation endpoints.
 * All routes are prefixed with /api/auth
 *
 * @module routes/auth
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * POST /api/auth/signup
 * Create a new user account with pending payment status
 *
 * @body {string} name - User's full name (2-100 chars)
 * @body {string} email - User's email address (unique)
 * @body {string} password - User's password (min 8 chars, must include uppercase, lowercase, number)
 * @returns {Object} Success response with user_id and next_action
 */
router.post('/signup', authController.signup);

/**
 * POST /api/auth/login
 * Authenticate user and return appropriate redirect based on account state
 *
 * @body {string} email - User's email address
 * @body {string} password - User's password
 * @returns {Object} Success response with redirect path and optionally JWT token
 */
router.post('/login', authController.login);

/**
 * POST /api/auth/activate
 * Verify payment ID and activate user account
 *
 * @body {string} email - User's email address
 * @body {string} payment_id - Payment ID from payment provider (format: PS_*)
 * @returns {Object} Success response with JWT token and API keys
 */
router.post('/activate', authController.activate);

module.exports = router;
