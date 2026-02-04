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
 * - payment_id: must match PS_[alphanumeric]{3,50} pattern
 */
const activationValidation = validate([
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('payment_id')
    .trim()
    .matches(/^PS_[A-Za-z0-9]{3,50}$/)
    .withMessage('Invalid Payment ID format. Must start with PS_ followed by 3-50 alphanumeric characters')
    .isLength({ min: 6, max: 53 })
    .withMessage('Payment ID must be between 6 and 53 characters')
]);

module.exports = {
  signupValidation,
  loginValidation,
  activationValidation
};
