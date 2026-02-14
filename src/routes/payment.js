/**
 * Payment Routes
 *
 * Handles payment confirmation webhooks from Selfany via n8n.
 * All routes are prefixed with /api/payment
 *
 * @module routes/payment
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

/**
 * POST /api/payment/confirm
 * Receive payment confirmation from Selfany via n8n
 *
 * This endpoint:
 * 1. Verifies webhook signature (N8N_WEBHOOK_SECRET)
 * 2. Validates payment data
 * 3. Updates user payment_status to 'paid'
 * 4. Stores payment_id on user record
 * 5. Handles duplicate payment detection
 *
 * @body {string} payment_id - Payment ID (format: PS_[alphanumeric]{3,50})
 * @body {string} email - User's email address
 * @body {number} amount - Payment amount (must be 10.00)
 * @body {string} currency - Currency code (must be "USD")
 * @body {string} status - Payment status (must be "completed")
 * @body {string} timestamp - ISO 8601 timestamp
 * @header {string} X-Webhook-Signature - HMAC SHA256 signature
 * @returns {Object} Success response with user_id and payment_id
 */
router.post('/confirm', paymentController.confirmPayment);

module.exports = router;
