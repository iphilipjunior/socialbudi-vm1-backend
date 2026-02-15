/**
 * Payment Service
 *
 * Handles payment verification, validation, and processing.
 *
 * @module services/paymentService
 */

const crypto = require('crypto');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Verify webhook signature using HMAC SHA256
 *
 * @param {Object} payload - Request body object
 * @param {string} signature - Signature from X-Webhook-Signature header
 * @returns {boolean} True if signature is valid, false otherwise
 */
const verifyWebhookSignature = (payload, signature) => {
  if (!payload || !signature) {
    logger.warn('Signature verification failed - missing payload or signature');
    return false;
  }

  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('N8N_WEBHOOK_SECRET not configured');
    return false;
  }

  try {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (err) {
    logger.warn('Signature verification failed', { error: err.message });
    return false;
  }
};

/**
 * Validate payment data from webhook
 *
 * @param {Object} data - Payment data
 * @returns {Array|null} Array of validation errors, or null if valid
 */
const validatePaymentData = (data) => {
  const errors = [];

  // Validate payment_id is not empty
  if (!data.payment_id || typeof data.payment_id !== 'string' || data.payment_id.trim() === '') {
    errors.push({ field: 'payment_id', message: 'Payment ID is required' });
  }

  // Validate payment_id length (reasonable maximum)
  if (data.payment_id && data.payment_id.length > 100) {
    errors.push({ field: 'payment_id', message: 'Payment ID must not exceed 100 characters' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  // Validate amount (must be exactly 10.00)
  if (data.amount === undefined || data.amount === null || typeof data.amount !== 'number' || data.amount !== 10.00) {
    errors.push({ field: 'amount', message: 'Amount must be 10.00' });
  }

  // Validate currency (must be USD)
  if (!data.currency || data.currency !== 'USD') {
    errors.push({ field: 'currency', message: 'Currency must be USD' });
  }

  // Validate status (must be completed)
  if (!data.status || data.status !== 'completed') {
    errors.push({ field: 'status', message: 'Status must be completed' });
  }

  // Validate timestamp (must be valid ISO 8601)
  if (!data.timestamp || isNaN(Date.parse(data.timestamp))) {
    errors.push({ field: 'timestamp', message: 'Invalid timestamp format. Must be ISO 8601' });
  }

  return errors.length > 0 ? errors : null;
};

/**
 * Process payment confirmation and update user
 *
 * @param {Object} paymentData - Payment data from webhook
 * @param {string} paymentData.payment_id - Payment ID from Selfany
 * @param {string} paymentData.email - User's email address
 * @param {number} paymentData.amount - Payment amount
 * @param {string} paymentData.currency - Currency code
 * @param {string} paymentData.status - Payment status
 * @param {string} paymentData.timestamp - Payment timestamp
 * @returns {Promise<Object>} Result with user_id and payment_id
 * @throws {Error} If user not found or payment ID already exists
 */
const processPayment = async (paymentData) => {
  const { payment_id, email, amount, currency, status, timestamp } = paymentData;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Step 1: Find user by email
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, email, full_name, payment_status, payment_id')
      .eq('email', normalizedEmail)
      .single();

    if (findError || !user) {
      logger.warn('Payment received for non-existent user', {
        email: normalizedEmail,
        payment_id
      });
      throw new Error(`User not found with email: ${normalizedEmail}`);
    }

    // Step 2: Check for duplicate payment_id
    const { data: existingPayment, error: dupCheckError } = await supabase
      .from('users')
      .select('id, email')
      .eq('payment_id', payment_id)
      .single();

    // If PGRST116 error, it means no rows found (which is good - no duplicate)
    // Any other error is a real database error
    if (dupCheckError && dupCheckError.code !== 'PGRST116') {
      logger.error('Error checking for duplicate payment', { error: dupCheckError });
      throw new Error('Database error while checking duplicate payment');
    }

    if (existingPayment) {
      // Create duplicate payment record
      await supabase.from('duplicate_payments').insert({
        payment_id,
        original_user_id: existingPayment.id,
        duplicate_user_id: user.id,
        original_email: existingPayment.email,
        duplicate_email: normalizedEmail,
        amount,
        currency,
        detected_at: new Date().toISOString()
      });

      logger.warn('Duplicate payment ID detected', {
        payment_id,
        original_email: existingPayment.email,
        duplicate_email: normalizedEmail
      });
      throw new Error('Payment ID already exists');
    }

    // Step 3: Update user with payment info
    const { error: updateError } = await supabase
      .from('users')
      .update({
        payment_status: 'paid',
        payment_id: payment_id,
        payment_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to update user payment status', {
        error: updateError,
        user_id: user.id
      });
      throw new Error('Failed to update user payment status');
    }

    // Step 4: Log transaction to system_logs
    await supabase.from('system_logs').insert({
      log_level: 'info',
      service: 'payment',
      action: 'payment_confirmed',
      message: `Payment confirmed for user ${user.id}`,
      user_id: user.id,
      request_data: {
        payment_id,
        email: normalizedEmail,
        amount,
        currency,
        status,
        timestamp
      },
      created_at: new Date().toISOString()
    });

    logger.info('Payment processed successfully', {
      user_id: user.id,
      payment_id
    });

    return {
      success: true,
      user_id: user.id,
      payment_id
    };
  } catch (err) {
    // Re-throw known errors
    if (err.message.includes('User not found') || err.message.includes('Payment ID already exists')) {
      throw err;
    }

    // Log and throw unknown errors
    logger.error('Payment processing failed', {
      error: err.message,
      stack: err.stack,
      payment_id,
      email: normalizedEmail
    });
    throw new Error('Failed to process payment');
  }
};

module.exports = {
  verifyWebhookSignature,
  validatePaymentData,
  processPayment
};
