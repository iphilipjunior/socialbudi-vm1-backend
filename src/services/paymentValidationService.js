/**
 * Payment Validation Service
 *
 * Validates Payment IDs during account activation.
 * Ensures the provided Payment ID matches the user's record
 * and that payment has been completed before activation.
 *
 * @module services/paymentValidationService
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Validate Payment ID for account activation
 *
 * Checks that the Payment ID is non-empty, belongs to the user,
 * and that payment has been completed. Does NOT validate Payment ID
 * format/pattern since Selfany uses various formats.
 *
 * @param {string} email - User's email address
 * @param {string} paymentId - Payment ID to validate
 * @returns {Promise<Object>} Validation result with user data
 * @throws {Error} If validation fails at any step
 */
const validatePaymentId = async (email, paymentId) => {
  // Step 1: Validate payment_id is not empty
  if (!paymentId || typeof paymentId !== 'string' || paymentId.trim() === '') {
    throw new Error('Payment ID is required');
  }

  // Step 2: Normalize email
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Step 3: Find user by email
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, full_name, payment_status, payment_id, activated')
      .eq('email', normalizedEmail)
      .single();

    if (findError || !user) {
      logger.warn('Payment validation failed - user not found', {
        email: normalizedEmail
      });
      throw new Error('User not found');
    }

    // Step 4: Check if user has payment_id
    if (!user.payment_id) {
      logger.warn('Payment validation failed - no payment on record', {
        email: normalizedEmail,
        user_id: user.id
      });
      throw new Error('No payment found for this user');
    }

    // Step 5: Check if provided payment_id matches (case-sensitive)
    if (user.payment_id !== paymentId) {
      logger.warn('Payment validation failed - payment ID mismatch', {
        email: normalizedEmail,
        user_id: user.id
      });
      throw new Error('Payment ID does not match');
    }

    // Step 6: Check if payment_status is 'paid'
    if (user.payment_status !== 'paid') {
      logger.warn('Payment validation failed - payment not completed', {
        email: normalizedEmail,
        user_id: user.id,
        payment_status: user.payment_status
      });
      throw new Error('Payment has not been completed');
    }

    // Step 7: Return validation result
    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        payment_status: user.payment_status,
        activated: user.activated
      }
    };
  } catch (err) {
    // Re-throw known validation errors
    if (
      err.message === 'User not found' ||
      err.message === 'No payment found for this user' ||
      err.message === 'Payment ID does not match' ||
      err.message === 'Payment has not been completed'
    ) {
      throw err;
    }

    // Log and re-throw unexpected errors
    logger.error('Payment validation failed unexpectedly', {
      error: err.message,
      email: normalizedEmail
    });
    throw err;
  }
};

module.exports = {
  validatePaymentId
};
