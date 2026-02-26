/**
 * Admin Controller
 *
 * Handles admin operations: authentication, user management,
 * payment management, alert resolution, and system log viewing.
 *
 * @module controllers/adminController
 */

const adminService = require('../services/adminService');
const orphanedPaymentService = require('../services/orphanedPaymentService');
const logger = require('../utils/logger');

/**
 * Admin login
 *
 * Authenticates an admin user with email and password.
 * Returns a JWT token signed with ADMIN_JWT_SECRET.
 *
 * @route POST /api/admin/login
 * @param {Object} req - Express request object
 * @param {Object} req.body - Login credentials
 * @param {string} req.body.email - Admin email address
 * @param {string} req.body.password - Admin password
 * @param {Object} res - Express response object
 * @returns {Object} JWT token and admin profile
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await adminService.loginAdmin(email, password, req.ip);

    res.status(200).json({
      success: true,
      token: result.token,
      admin: result.admin
    });
  } catch (error) {
    if (error.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    if (error.code === 'ACCOUNT_INACTIVE') {
      return res.status(403).json({
        success: false,
        error: 'Account is inactive'
      });
    }

    logger.error('Admin login error', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Login failed'
    });
  }
};

/**
 * Get paginated list of users
 * @route GET /api/admin/users
 */
const getUsers = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

/**
 * Get single user by ID
 * @route GET /api/admin/users/:id
 */
const getUser = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

/**
 * Manually activate a user account
 * @route POST /api/admin/users/:id/activate
 */
const activateUser = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

/**
 * Get paginated list of payments
 * @route GET /api/admin/payments
 */
const getPayments = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

/**
 * Get payment detail for a specific user
 * @route GET /api/admin/payments/:id
 */
const getPaymentDetail = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

/**
 * Get orphaned payments with suggested matches
 * @route GET /api/admin/orphaned-payments
 */
const getOrphanedPayments = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

/**
 * Link a payment to a user and activate their account
 * @route POST /api/admin/link-payment
 */
const linkPayment = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

/**
 * Get paginated list of alerts
 * @route GET /api/admin/alerts
 */
const getAlerts = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

/**
 * Resolve an admin alert
 * @route POST /api/admin/alerts/:id/resolve
 */
const resolveAlert = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

/**
 * Get paginated system logs
 * @route GET /api/admin/logs
 */
const getLogs = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

/**
 * Detect Orphaned Payments
 *
 * Triggers orphaned payment detection and creates admin alerts.
 * Returns results including count of orphaned payments found.
 * (Preserved from Phase 3)
 *
 * @route POST /api/admin/detect-orphaned-payments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with detection results
 */
const detectOrphanedPayments = async (req, res, next) => {
  try {
    logger.info('Admin triggered orphaned payment detection');

    // Step 1: Detect orphaned payments
    const orphanedPayments = await orphanedPaymentService.detectOrphanedPayments();

    if (orphanedPayments.length === 0) {
      logger.info('No orphaned payments detected');

      return res.status(200).json({
        success: true,
        message: 'No orphaned payments detected',
        results: {
          orphaned_payments_found: 0,
          alerts_created: 0,
          orphaned_payments: []
        }
      });
    }

    // Step 2: Create alerts for each orphaned payment
    const alerts = [];
    let alertsCreated = 0;

    for (const orphanedPayment of orphanedPayments) {
      try {
        const alert = await orphanedPaymentService.createOrphanedPaymentAlert(orphanedPayment);
        alerts.push(alert);
        alertsCreated++;
      } catch (err) {
        logger.error('Failed to create alert for orphaned payment', {
          payment_id: orphanedPayment.payment_id,
          error: err.message
        });
        // Continue processing other orphaned payments even if one fails
      }
    }

    logger.info('Orphaned payment detection completed', {
      orphaned_payments_found: orphanedPayments.length,
      alerts_created: alertsCreated
    });

    // Step 3: Return results
    return res.status(200).json({
      success: true,
      message: 'Orphaned payment detection completed',
      results: {
        orphaned_payments_found: orphanedPayments.length,
        alerts_created: alertsCreated,
        orphaned_payments: orphanedPayments.map(op => ({
          payment_id: op.payment_id,
          original_user_email: op.original_user_email,
          original_user_id: op.original_user_id,
          duplicate_user_email: op.duplicate_user_email,
          duplicate_user_id: op.duplicate_user_id,
          detected_at: op.detected_at
        }))
      }
    });
  } catch (err) {
    logger.error('Orphaned payment detection failed', {
      error: err.message,
      stack: err.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to detect orphaned payments',
      message: err.message
    });
  }
};

module.exports = {
  login,
  getUsers,
  getUser,
  activateUser,
  getPayments,
  getPaymentDetail,
  getOrphanedPayments,
  linkPayment,
  getAlerts,
  resolveAlert,
  getLogs,
  detectOrphanedPayments
};
