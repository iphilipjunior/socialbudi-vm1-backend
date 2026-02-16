/**
 * Orphaned Payment Service
 *
 * Detects when the same Payment ID is assigned to multiple users
 * and creates admin alerts for resolution.
 *
 * @module services/orphanedPaymentService
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Detect orphaned payments (Payment ID assigned to multiple users)
 *
 * Queries all paid users and groups them by payment_id to find duplicates.
 * Returns an array of orphaned payment records with details about both
 * the original user and the duplicate user(s).
 *
 * @returns {Promise<Array>} Array of orphaned payment objects
 * @throws {Error} When database query fails
 *
 * @example
 * const orphaned = await detectOrphanedPayments();
 * // Returns: [
 * //   {
 * //     payment_id: "PS_abc123",
 * //     original_user_email: "first@example.com",
 * //     original_user_id: "uuid-1",
 * //     duplicate_user_email: "second@example.com",
 * //     duplicate_user_id: "uuid-2",
 * //     detected_at: "2026-02-16T12:00:00Z"
 * //   }
 * // ]
 */
const detectOrphanedPayments = async () => {
  try {
    logger.info('Starting orphaned payment detection');

    // Step 1: Get all users with payment_id
    const { data: paidUsers, error } = await supabase
      .from('users')
      .select('id, email, payment_id, payment_status, created_at')
      .not('payment_id', 'is', null)
      .eq('payment_status', 'paid');

    if (error) {
      logger.error('Failed to query paid users for orphaned payment detection', {
        error: error.message
      });
      throw new Error('Database query failed: ' + error.message);
    }

    if (!paidUsers || paidUsers.length === 0) {
      logger.info('No paid users found - no orphaned payments possible');
      return [];
    }

    // Step 2: Group users by payment_id to find duplicates
    const paymentIdMap = new Map();

    for (const user of paidUsers) {
      if (!paymentIdMap.has(user.payment_id)) {
        paymentIdMap.set(user.payment_id, []);
      }
      paymentIdMap.get(user.payment_id).push(user);
    }

    // Step 3: Find payment_ids with multiple users (orphaned payments)
    const orphanedPayments = [];

    for (const [paymentId, users] of paymentIdMap.entries()) {
      if (users.length > 1) {
        // Sort by created_at to identify original vs duplicate
        // First user chronologically is the "original", rest are "duplicates"
        users.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const original = users[0];

        // Create an orphaned payment record for each duplicate
        for (let i = 1; i < users.length; i++) {
          orphanedPayments.push({
            payment_id: paymentId,
            original_user_email: original.email,
            original_user_id: original.id,
            duplicate_user_email: users[i].email,
            duplicate_user_id: users[i].id,
            detected_at: new Date().toISOString()
          });
        }
      }
    }

    logger.info('Orphaned payment detection completed', {
      total_paid_users: paidUsers.length,
      unique_payment_ids: paymentIdMap.size,
      orphaned_count: orphanedPayments.length
    });

    return orphanedPayments;
  } catch (err) {
    logger.error('Orphaned payment detection failed', {
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
};

/**
 * Create admin alert for orphaned payment
 *
 * Inserts records into both duplicate_payments and admin_alerts tables,
 * and logs to system_logs for audit trail.
 *
 * @param {Object} orphanedPayment - Orphaned payment details
 * @param {string} orphanedPayment.payment_id - The duplicated Payment ID
 * @param {string} orphanedPayment.original_user_email - Email of first user
 * @param {string} orphanedPayment.original_user_id - ID of first user
 * @param {string} orphanedPayment.duplicate_user_email - Email of duplicate user
 * @param {string} orphanedPayment.duplicate_user_id - ID of duplicate user
 * @returns {Promise<Object>} Created admin alert record
 * @throws {Error} When database insert fails
 *
 * @example
 * const alert = await createOrphanedPaymentAlert({
 *   payment_id: "PS_abc123",
 *   original_user_email: "first@example.com",
 *   original_user_id: "uuid-1",
 *   duplicate_user_email: "second@example.com",
 *   duplicate_user_id: "uuid-2"
 * });
 */
const createOrphanedPaymentAlert = async (orphanedPayment) => {
  const {
    payment_id,
    original_user_email,
    original_user_id,
    duplicate_user_email,
    duplicate_user_id
  } = orphanedPayment;

  try {
    // Step 1: Insert into duplicate_payments table
    const { error: dupError } = await supabase
      .from('duplicate_payments')
      .insert({
        payment_id,
        original_email: original_user_email,
        duplicate_email: duplicate_user_email,
        amount: 10.00,
        currency: 'USD',
        detected_at: new Date().toISOString(),
        resolved: false
      });

    if (dupError) {
      logger.error('Failed to insert duplicate payment record', {
        error: dupError.message,
        payment_id
      });
      // Don't throw - continue to create alert even if duplicate entry fails
    }

    // Step 2: Insert into admin_alerts table
    const { data: alert, error: alertError } = await supabase
      .from('admin_alerts')
      .insert({
        alert_type: 'orphaned_payment',
        severity: 'high',
        message: `Duplicate Payment ID detected: ${payment_id}`,
        alert_data: {
          payment_id,
          original_user: {
            email: original_user_email,
            user_id: original_user_id
          },
          duplicate_user: {
            email: duplicate_user_email,
            user_id: duplicate_user_id
          }
        },
        resolved: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (alertError) {
      logger.error('Failed to create admin alert for orphaned payment', {
        error: alertError.message,
        payment_id
      });
      throw new Error('Failed to create admin alert: ' + alertError.message);
    }

    // Step 3: Log to system_logs
    await supabase.from('system_logs').insert({
      log_level: 'warn',
      service: 'orphaned_payment_detector',
      action: 'orphaned_payment_detected',
      message: `Orphaned payment detected and alert created for ${payment_id}`,
      metadata: {
        payment_id,
        original_user_email,
        duplicate_user_email,
        alert_id: alert.id
      },
      created_at: new Date().toISOString()
    });

    logger.warn('Orphaned payment alert created', {
      payment_id,
      alert_id: alert.id,
      original_email: original_user_email,
      duplicate_email: duplicate_user_email
    });

    return alert;
  } catch (err) {
    logger.error('Failed to create orphaned payment alert', {
      error: err.message,
      payment_id,
      stack: err.stack
    });
    throw err;
  }
};

module.exports = {
  detectOrphanedPayments,
  createOrphanedPaymentAlert
};
