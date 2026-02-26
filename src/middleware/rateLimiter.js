/**
 * Rate Limiting Middleware
 *
 * Protects authentication endpoints from brute force attacks
 * using express-rate-limit.
 *
 * @module middleware/rateLimiter
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate limiter for signup endpoint
 * Limits to 5 signup attempts per IP address per hour
 *
 * Purpose: Prevent mass account creation attacks
 */
const signupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    error: 'Too many signup attempts',
    message: 'Too many accounts created from this IP. Please try again in 1 hour.'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable deprecated `X-RateLimit-*` headers
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn('Signup rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many signup attempts',
      message: 'Too many accounts created from this IP. Please try again in 1 hour.'
    });
  }
});

/**
 * Rate limiter for login endpoint
 * Limits to 10 login attempts per IP address per minute
 *
 * Purpose: Prevent brute force password guessing
 */
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: 'Too many login attempts',
    message: 'Too many login attempts. Please try again in 1 minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn('Login rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many login attempts',
      message: 'Too many login attempts. Please try again in 1 minute.'
    });
  }
});

/**
 * Rate limiter for activation endpoint
 * Limits to 20 activation attempts per hour per IP address
 *
 * Purpose: Prevent Payment ID guessing attacks
 */
const activationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    success: false,
    error: 'Too many activation attempts',
    message: 'Too many activation attempts. Please try again in 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn('Activation rate limit exceeded', {
      email: req.body?.email,
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many activation attempts',
      message: 'Too many activation attempts for this account. Please try again in 1 hour.'
    });
  }
});

// ============================================================================
// Phase 4: User Management Rate Limiters
// ============================================================================

/**
 * Rate limiter for user profile endpoints (GET/PUT /api/user/profile, GET /api/user/api-keys)
 * Limits to 60 requests per hour per IP
 *
 * Purpose: Prevent API abuse on profile read/update operations
 */
const userProfileRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // 60 requests per hour
  message: {
    success: false,
    error: 'Too many profile requests',
    message: 'Too many profile requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn('User profile rate limit exceeded', {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many profile requests',
      message: 'Too many profile requests, please try again later'
    });
  }
});

/**
 * Rate limiter for password change endpoint (PUT /api/user/change-password)
 * Limits to 5 requests per hour per IP (STRICT)
 *
 * Purpose: Prevent password brute force and abuse
 */
const passwordChangeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour (STRICT)
  message: {
    success: false,
    error: 'Too many password change attempts',
    message: 'Too many password change attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn('Password change rate limit exceeded', {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many password change attempts',
      message: 'Too many password change attempts, please try again later'
    });
  }
});

/**
 * Rate limiter for cookie storage endpoint (POST /api/user/cookie)
 * Limits to 10 requests per hour per IP
 *
 * Purpose: Prevent cookie flooding attacks
 */
const cookieStorageRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: {
    success: false,
    error: 'Too many cookie storage requests',
    message: 'Too many cookie storage requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn('Cookie storage rate limit exceeded', {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many cookie storage requests',
      message: 'Too many cookie storage requests, please try again later'
    });
  }
});

// ============================================================================
// Phase 5: Admin Rate Limiters
// ============================================================================

/**
 * Rate limiter for admin login endpoint (POST /api/admin/login)
 * Limits to 5 requests per minute per IP (STRICT)
 *
 * Purpose: Prevent admin credential brute force attacks
 */
const adminLoginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: {
    success: false,
    error: 'Too many login attempts',
    message: 'Too many login attempts, please try again in a minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn('Admin login rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many login attempts',
      message: 'Too many login attempts, please try again in a minute'
    });
  }
});

/**
 * Rate limiter for general admin endpoints
 * Limits to 60 requests per hour per IP
 *
 * Purpose: Prevent API abuse on admin operations
 */
const adminGeneralLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // 60 requests per hour
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logger.warn('Admin general rate limit exceeded', {
      adminId: req.admin?.admin_id,
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Too many requests, please try again later'
    });
  }
});

module.exports = {
  signupRateLimiter,
  loginRateLimiter,
  activationRateLimiter,
  // Phase 4
  userProfileRateLimiter,
  passwordChangeRateLimiter,
  cookieStorageRateLimiter,
  // Phase 5
  adminLoginLimiter,
  adminGeneralLimiter
};
