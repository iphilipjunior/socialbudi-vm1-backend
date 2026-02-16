/**
 * Validation Middleware
 *
 * Input validation rules for authentication endpoints using express-validator.
 * Validates and sanitizes user input before it reaches the controllers.
 *
 * @module middleware/validation
 */

const { body, validationResult } = require('express-validator');

/**
 * Creates a validation middleware from an array of validation rules
 * Runs all validations and returns errors in a consistent format
 *
 * @param {Array} validations - Array of express-validator validation chains
 * @returns {Function} Express middleware function
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    next();
  };
};

/**
 * Signup validation rules
 *
 * Validates:
 * - name: 2-100 chars, letters/spaces/hyphens/apostrophes only
 * - email: valid format, normalized, max 255 chars
 * - password: 8-128 chars, must have uppercase, lowercase, number, no spaces
 */
const signupValidation = validate([
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens and apostrophes'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .not()
    .matches(/\s/)
    .withMessage('Password cannot contain spaces')
]);

/**
 * Login validation rules
 *
 * Validates:
 * - email: valid format, normalized
 * - password: not empty (don't reveal password requirements on login)
 */
const loginValidation = validate([
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
]);

/**
 * Activation validation rules
 *
 * Validates:
 * - email: valid format, normalized
 * - payment_id: non-empty string up to 100 characters (accepts any format)
 */
const activationValidation = validate([
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('payment_id')
    .trim()
    .notEmpty()
    .withMessage('Payment ID is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Payment ID must be between 1 and 100 characters')
]);

// ============================================================================
// Phase 4: User Management Validators
// ============================================================================

/**
 * Profile update validation rules
 *
 * Validates:
 * - name: optional, 2-100 chars, letters/spaces/hyphens/apostrophes only
 */
const validateProfileUpdate = validate([
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens and apostrophes')
]);

/**
 * Password change validation rules
 *
 * Validates:
 * - current_password: required, not empty
 * - new_password: 8-128 chars, must have uppercase, lowercase, number, no spaces
 */
const validatePasswordChange = validate([
  body('current_password')
    .notEmpty()
    .withMessage('Current password is required'),

  body('new_password')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
    .not()
    .matches(/\s/)
    .withMessage('New password cannot contain spaces')
]);

/**
 * Cookie storage validation rules
 *
 * Validates:
 * - linkedin_cookie: required, non-empty string, max 10000 chars
 */
const validateCookieStorage = validate([
  body('linkedin_cookie')
    .trim()
    .notEmpty()
    .withMessage('LinkedIn cookie is required')
    .isLength({ max: 10000 })
    .withMessage('LinkedIn cookie must not exceed 10000 characters')
]);

module.exports = {
  signupValidation,
  loginValidation,
  activationValidation,
  // Phase 4
  validateProfileUpdate,
  validatePasswordChange,
  validateCookieStorage
};
