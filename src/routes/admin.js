/**
 * Admin Routes
 *
 * Admin-only endpoints for system operations.
 *
 * @module routes/admin
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

/**
 * POST /api/admin/detect-orphaned-payments
 *
 * Manually trigger orphaned payment detection.
 * Finds duplicate payment IDs and creates admin alerts.
 *
 * Authentication: None (TODO: Add admin authentication in future)
 * Rate Limiting: None (admin endpoint, low traffic)
 *
 * Request Body: None
 *
 * Response (200 - Orphaned Payments Found):
 * {
 *   "success": true,
 *   "message": "Orphaned payment detection completed",
 *   "results": {
 *     "total_paid_users": 150,
 *     "orphaned_payments_found": 2,
 *     "alerts_created": 2,
 *     "orphaned_payments": [
 *       {
 *         "payment_id": "PS_abc123",
 *         "original_user_email": "user1@example.com",
 *         "duplicate_user_email": "user2@example.com"
 *       }
 *     ]
 *   }
 * }
 *
 * Response (200 - No Orphaned Payments):
 * {
 *   "success": true,
 *   "message": "No orphaned payments detected",
 *   "results": {
 *     "total_paid_users": 150,
 *     "orphaned_payments_found": 0,
 *     "alerts_created": 0,
 *     "orphaned_payments": []
 *   }
 * }
 *
 * Response (500 - Error):
 * {
 *   "success": false,
 *   "error": "Failed to detect orphaned payments"
 * }
 */
router.post('/detect-orphaned-payments', adminController.detectOrphanedPayments);

module.exports = router;
