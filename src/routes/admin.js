/**
 * Admin Routes
 *
 * Admin-only endpoints for authentication, user management,
 * payment management, alerts, and system logs.
 *
 * Mount point: /api/admin (registered in server.js)
 *
 * @module routes/admin
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
const { adminLoginLimiter, adminGeneralLimiter } = require('../middleware/rateLimiter');
const { adminLoginValidator, adminActivateUserValidator, adminLinkPaymentValidator } = require('../middleware/validation');

// ============================================================================
// Authentication (no adminAuth required)
// ============================================================================

/**
 * POST /api/admin/login
 *
 * Authenticate admin user with email and password.
 * Returns JWT token signed with ADMIN_JWT_SECRET.
 *
 * Rate Limit: 5 requests per minute per IP
 * Validation: email (valid format), password (non-empty)
 *
 * Request Body: { email, password }
 * Response: { success, token, admin: { admin_id, name, email, role } }
 */
router.post('/login', adminLoginLimiter, adminLoginValidator, adminController.login);

// ============================================================================
// User Management (adminAuth required)
// ============================================================================

/**
 * GET /api/admin/users
 *
 * Get paginated list of users with optional filters.
 * Query params: search, payment_status, activated, page, limit
 */
router.get('/users', adminGeneralLimiter, adminAuth, adminController.getUsers);

/**
 * GET /api/admin/users/:id
 *
 * Get single user details including API keys.
 */
router.get('/users/:id', adminGeneralLimiter, adminAuth, adminController.getUser);

/**
 * POST /api/admin/users/:id/activate
 *
 * Manually activate a user account.
 */
router.post('/users/:id/activate', adminGeneralLimiter, adminAuth, adminActivateUserValidator, adminController.activateUser);

// ============================================================================
// Payment Management (adminAuth required)
// ============================================================================

/**
 * GET /api/admin/payments
 *
 * Get paginated list of payment records.
 * Query params: payment_status, page, limit
 */
router.get('/payments', adminGeneralLimiter, adminAuth, adminController.getPayments);

/**
 * GET /api/admin/payments/:id
 *
 * Get payment details for a specific user.
 */
router.get('/payments/:id', adminGeneralLimiter, adminAuth, adminController.getPaymentDetail);

/**
 * GET /api/admin/orphaned-payments
 *
 * Get orphaned payments with suggested matches.
 */
router.get('/orphaned-payments', adminGeneralLimiter, adminAuth, adminController.getOrphanedPayments);

/**
 * POST /api/admin/link-payment
 *
 * Link a payment to a user and activate their account.
 * Body: { user_id, payment_id, admin_notes }
 */
router.post('/link-payment', adminGeneralLimiter, adminAuth, adminLinkPaymentValidator, adminController.linkPayment);

// ============================================================================
// Alert Management (adminAuth required)
// ============================================================================

/**
 * GET /api/admin/alerts
 *
 * Get paginated list of admin alerts.
 * Query params: status, alert_type, severity, page, limit
 */
router.get('/alerts', adminGeneralLimiter, adminAuth, adminController.getAlerts);

/**
 * POST /api/admin/alerts/:id/resolve
 *
 * Resolve an admin alert.
 * Body: { action, notes }
 */
router.post('/alerts/:id/resolve', adminGeneralLimiter, adminAuth, adminController.resolveAlert);

// ============================================================================
// System Logs (adminAuth required)
// ============================================================================

/**
 * GET /api/admin/logs
 *
 * Get paginated system logs.
 * Query params: log_level, action, user_id, date_from, date_to, page, limit
 */
router.get('/logs', adminGeneralLimiter, adminAuth, adminController.getLogs);

// ============================================================================
// Orphaned Payment Detection (Phase 3 - preserved)
// ============================================================================

/**
 * POST /api/admin/detect-orphaned-payments
 *
 * Manually trigger orphaned payment detection.
 * Finds duplicate payment IDs and creates admin alerts.
 */
router.post('/detect-orphaned-payments', adminController.detectOrphanedPayments);

module.exports = router;
