/**
 * Admin Controller
 *
 * Handles admin operations like orphaned payment detection.
 *
 * @module controllers/adminController
 */

const orphanedPaymentService = require('../services/orphanedPaymentService');
const logger = require('../utils/logger');

/**
 * Detect Orphaned Payments
 *
 * Triggers orphaned payment detection and creates admin alerts.
 * Returns results including count of orphaned payments found.
 *
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
  detectOrphanedPayments
};
