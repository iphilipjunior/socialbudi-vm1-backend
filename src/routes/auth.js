/**
 * Authentication Routes
 *
 * Handles user signup, login, and account activation endpoints.
 * All routes are prefixed with /api/auth
 *
 * Middleware chain for each endpoint:
 * 1. Rate limiter (prevents abuse)
 * 2. Input validation (validates and sanitizes)
 * 3. Controller (business logic)
 *
 * @module routes/auth
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
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
 * @body {string} payment_id - Payment ID from payment provider (format: PS_[alphanumeric]{3,50})
 * @returns {Object} Success response with JWT token and API keys
 */
router.post('/activate', activationRateLimiter, activationValidation, authController.activate);

module.exports = router;
