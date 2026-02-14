/**
 * Payment Controller
 *
 * Handles payment webhook processing from Selfany.
 *
 * @module controllers/paymentController
 */

const paymentService = require('../services/paymentService');
const logger = require('../utils/logger');

/**
 * Confirm Payment - Process payment webhook from Selfany
 *
 * Verifies webhook signature and updates user payment status.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body with payment data
 * @param {string} req.body.payment_id - Payment ID from Selfany
 * @param {string} req.body.email - User's email
 * @param {number} req.body.amount - Payment amount
 * @param {string} req.body.currency - Currency code
 * @param {string} req.body.status - Payment status
 * @param {string} req.body.timestamp - Payment timestamp
 * @param {Object} req.headers - Request headers
 * @param {string} req.headers['x-webhook-signature'] - Webhook signature
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response
 */
const confirmPayment = async (req, res, next) => {
  try {
    const { payment_id, email, amount, currency, status, timestamp } = req.body;
    const signature = req.headers['x-webhook-signature'];

    logger.info('Payment webhook received', {
      payment_id,
      email,
      amount,
      currency,
      status
    });

    // Step 1: Verify webhook signature
    const isValidSignature = paymentService.verifyWebhookSignature(req.body, signature);

    if (!isValidSignature) {
      logger.warn('Payment webhook rejected - invalid signature', {
        email,
        payment_id
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }

    // Step 2: Validate payment data
    const validationError = paymentService.validatePaymentData({
      payment_id,
      email,
      amount,
      currency,
      status,
      timestamp
    });

    if (validationError) {
      logger.warn('Payment webhook rejected - validation failed', {
        email,
        payment_id,
        error: validationError
      });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationError
      });
    }

    // Step 3: Process the payment
    const result = await paymentService.processPayment({
      payment_id,
      email,
      amount,
      currency,
      status,
      timestamp
    });

    logger.info('Payment processed successfully', {
      user_id: result.user_id,
      payment_id: result.payment_id
    });

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed and user updated',
      user_id: result.user_id,
      payment_id: result.payment_id
    });
  } catch (err) {
    // Handle specific error types
    if (err.message.includes('User not found')) {
      logger.warn('Payment webhook - user not found', {
        email: req.body.email,
        payment_id: req.body.payment_id
      });
      return res.status(404).json({
        success: false,
        error: 'User not found with email: ' + req.body.email
      });
    }

    if (err.message.includes('Payment ID already exists')) {
      logger.warn('Payment webhook - duplicate payment ID', {
        payment_id: req.body.payment_id
      });
      return res.status(409).json({
        success: false,
        error: 'Payment ID already exists',
        message: 'This Payment ID has already been used by another user'
      });
    }

    // Unknown error
    logger.error(`Error in confirmPayment: ${err.message}`, {
      stack: err.stack,
      payment_id: req.body.payment_id,
      email: req.body.email
    });
    next(err);
  }
};

module.exports = {
  confirmPayment
};
