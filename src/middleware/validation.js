/**
 * Validation Middleware
 *
 * Input validation rules for authentication endpoints using express-validator.
 * Validates and sanitizes user input before it reaches the controllers.
 *
 * @module middleware/validation
 */

const { body, param, validationResult } = require('express-validator');

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
 * Middleware to handle validation errors from express-validator chains.
 * Used as the last element in Phase 4 validation arrays.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const handleValidationErrors = (req, res, next) => {
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

/**
 * Profile update validation rules
 *
 * Validates:
 * - full_name: optional, 2-100 chars, letters/spaces/hyphens/apostrophes only
 * - email: optional, valid email format, normalized
 * - At least one field must be provided
 */
const validateProfileUpdate = [
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .toLowerCase(),

  // Custom validator: at least one field required
  body()
    .custom((value, { req }) => {
      if (!req.body.full_name && !req.body.email) {
        throw new Error('At least one field (full_name or email) must be provided');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Password change validation rules
 *
 * Validates:
 * - current_password: required, string
 * - new_password: required, minimum 8 characters
 * - confirm_password: required, must match new_password
 */
const validatePasswordChange = [
  body('current_password')
    .exists()
    .withMessage('Current password is required')
    .isString()
    .withMessage('Current password must be a string'),

  body('new_password')
    .exists()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('confirm_password')
    .exists()
    .withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('New password and confirm password do not match');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Cookie storage validation rules
 *
 * Validates:
 * - linkedin_cookie: required, string, minimum 50 characters
 * - user_agent: required, string, must contain "Mozilla"
 */
const validateCookieStorage = [
  body('linkedin_cookie')
    .exists()
    .withMessage('LinkedIn cookie is required')
    .isString()
    .withMessage('LinkedIn cookie must be a string')
    .isLength({ min: 50 })
    .withMessage('LinkedIn cookie must be at least 50 characters'),

  body('user_agent')
    .exists()
    .withMessage('User agent is required')
    .isString()
    .withMessage('User agent must be a string')
    .contains('Mozilla')
    .withMessage('Invalid user agent format'),

  handleValidationErrors
];

// ============================================================================
// Phase 5: Admin Validators
// ============================================================================

/**
 * Admin login validation rules
 *
 * Validates:
 * - email: valid email format, normalized
 * - password: non-empty
 */
const adminLoginValidator = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors
];

/**
 * Admin activate user validation rules
 *
 * Validates:
 * - id: valid UUID format (from URL params)
 */
const adminActivateUserValidator = [
  param('id')
    .isUUID()
    .withMessage('Valid user ID (UUID) required'),

  handleValidationErrors
];

/**
 * Admin link payment validation rules
 *
 * Validates:
 * - user_id: valid UUID
 * - payment_id: non-empty string, max 100 chars
 * - admin_notes: optional string, max 500 chars
 */
const adminLinkPaymentValidator = [
  body('user_id')
    .isUUID()
    .withMessage('Valid user ID (UUID) required'),

  body('payment_id')
    .trim()
    .notEmpty()
    .withMessage('Payment ID is required')
    .isLength({ max: 100 })
    .withMessage('Payment ID must not exceed 100 characters'),

  body('admin_notes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Admin notes must not exceed 500 characters'),

  handleValidationErrors
];

module.exports = {
  signupValidation,
  loginValidation,
  activationValidation,
  // Phase 4
  validateProfileUpdate,
  validatePasswordChange,
  validateCookieStorage,
  // Phase 5
  adminLoginValidator,
  adminActivateUserValidator,
  adminLinkPaymentValidator
};
