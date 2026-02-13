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
  validate: { xForwardedForHeader: false }
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
  validate: { xForwardedForHeader: false }
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
  validate: { xForwardedForHeader: false }
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

module.exports = {
  signupRateLimiter,
  loginRateLimiter,
  activationRateLimiter
};
