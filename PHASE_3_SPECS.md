# SocialBudi Phase 3 Specifications
# Payment Backend & n8n Workflow Integration

**Phase:** 3 of 10
**Dependencies:** Phase 1 ✅, Phase 2 ✅
**Duration:** 1 week (40 hours)
**Status:** 🔄 IN PROGRESS

---

## Phase 3 Objectives

This phase implements the payment verification system that converts signups into paying customers.

**What Phase 3 Accomplishes:**
1. ✅ Payment confirmation webhook endpoint
2. ✅ n8n workflow integration with Selfany
3. ✅ Payment ID validation for activation
4. ✅ Duplicate payment detection
5. ✅ Orphaned payment detection and alerting

**Why This Phase is Critical:**
Without payment verification, users could activate accounts without paying. This phase ensures only paid users can access the platform.

---

## API Endpoints

### POST /api/payment/confirm

**Purpose:** Receive payment confirmation from Selfany via n8n workflow

**Authentication:** Webhook signature verification (N8N_WEBHOOK_SECRET)

**Rate Limiting:** 100 requests per minute per IP

**Request Headers:**
```json
{
  "Content-Type": "application/json",
  "X-Webhook-Signature": "sha256_hmac_signature"
}
```

**Request Body:**
```json
{
  "payment_id": "PS_abc123xyz456",
  "email": "user@example.com",
  "amount": 10.00,
  "currency": "USD",
  "status": "completed",
  "timestamp": "2026-02-14T10:30:00Z"
}
```

**Validation Rules:**
- payment_id: Required, must match `/^PS_[A-Za-z0-9]{3,50}$/`
- email: Required, must be valid email format, normalized (lowercase, trimmed)
- amount: Required, must be number, must equal 10.00
- currency: Required, must be "USD"
- status: Required, must be "completed"
- timestamp: Required, must be valid ISO 8601 datetime
- X-Webhook-Signature: Required, must be valid HMAC SHA256 signature

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment confirmed and user updated",
  "user_id": "uuid-here",
  "payment_id": "PS_abc123xyz456"
}
```

**Error Responses:**

**400 Bad Request - Invalid Signature:**
```json
{
  "success": false,
  "error": "Invalid webhook signature"
}
```

**400 Bad Request - Invalid Data:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "payment_id", "message": "Invalid Payment ID format" },
    { "field": "amount", "message": "Amount must be 10.00" }
  ]
}
```

**404 Not Found - User Not Found:**
```json
{
  "success": false,
  "error": "User not found with email: user@example.com"
}
```

**409 Conflict - Duplicate Payment:**
```json
{
  "success": false,
  "error": "Payment ID already exists",
  "message": "This Payment ID has already been used by another user"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Failed to process payment"
}
```

**Processing Logic:**
1. Extract signature from X-Webhook-Signature header
2. Verify signature using N8N_WEBHOOK_SECRET and request body
3. If invalid signature → return 400
4. Validate request body fields (payment_id format, amount = 10.00, etc.)
5. If validation fails → return 400 with details
6. Find user by email (normalized)
7. If user not found → return 404
8. Check if payment_id already exists in users table
9. If duplicate → create duplicate_payments entry, return 409
10. Update user: payment_status='paid', payment_id=value
11. Log transaction to system_logs (log_level='info', service='payment', action='payment_confirmed')
12. Return 200 success

---

## Payment Service Specifications

### File: src/services/paymentService.js

**Function: verifyWebhookSignature(payload, signature)**

Purpose: Verify HMAC SHA256 signature of webhook payload

Input:
- payload: Object (request body)
- signature: String (from X-Webhook-Signature header)

Output: Boolean (true if valid, false if invalid)

Implementation:
```javascript
const crypto = require('crypto');

/**
 * Verify HMAC SHA256 signature of webhook payload
 * @param {Object} payload - Request body object
 * @param {string} signature - Signature from X-Webhook-Signature header
 * @returns {boolean} True if signature is valid, false otherwise
 */
const verifyWebhookSignature = (payload, signature) => {
  if (!payload || !signature) {
    return false;
  }

  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('N8N_WEBHOOK_SECRET not configured');
    return false;
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (err) {
    return false;
  }
};
```

---

**Function: processPayment(paymentData)**

Purpose: Process payment confirmation and update user

Input:
```javascript
{
  payment_id: "PS_abc123",
  email: "user@example.com",
  amount: 10.00,
  currency: "USD",
  status: "completed",
  timestamp: "2026-02-14T10:30:00Z"
}
```

Output:
```javascript
{
  success: true,
  user_id: "uuid",
  payment_id: "PS_abc123"
}
```

Errors:
- UserNotFoundError: User with email doesn't exist
- DuplicatePaymentError: Payment ID already used
- DatabaseError: Database operation failed

Implementation Logic:
1. Normalize email (lowercase, trim)
2. Find user by email in users table
3. If not found → throw UserNotFoundError
4. Check if payment_id exists in users table (any row)
5. If exists → create duplicate_payments entry, throw DuplicatePaymentError
6. Update user table: SET payment_status='paid', payment_id=value WHERE id=user.id
7. Insert system_logs entry (payment_confirmed action)
8. Return success with user_id and payment_id

Implementation:
```javascript
/**
 * Process payment confirmation and update user status
 * @param {Object} paymentData - Payment data from webhook
 * @returns {Promise<Object>} Result with user_id and payment_id
 * @throws {UserNotFoundError} When user doesn't exist
 * @throws {DuplicatePaymentError} When payment_id already used
 * @throws {DatabaseError} When database operation fails
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
      logger.warn('Payment received for non-existent user', { email: normalizedEmail, payment_id });
      throw new UserNotFoundError(`User not found with email: ${normalizedEmail}`);
    }

    // Step 2: Check for duplicate payment_id
    const { data: existingPayment, error: dupError } = await supabase
      .from('users')
      .select('id, email')
      .eq('payment_id', payment_id)
      .single();

    if (existingPayment) {
      // Create duplicate payment record
      await supabase.from('duplicate_payments').insert({
        payment_id,
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
      throw new DuplicatePaymentError('Payment ID already exists');
    }

    // Step 3: Update user with payment info
    const { error: updateError } = await supabase
      .from('users')
      .update({
        payment_status: 'paid',
        payment_id: payment_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Failed to update user payment status', { error: updateError, user_id: user.id });
      throw new DatabaseError('Failed to update user payment status');
    }

    // Step 4: Log transaction to system_logs
    await supabase.from('system_logs').insert({
      log_level: 'info',
      service: 'payment',
      action: 'payment_confirmed',
      message: `Payment confirmed for user ${user.id}`,
      metadata: {
        user_id: user.id,
        email: normalizedEmail,
        payment_id,
        amount,
        currency,
        status,
        timestamp
      },
      created_at: new Date().toISOString()
    });

    logger.info('Payment processed successfully', { user_id: user.id, payment_id });

    return {
      success: true,
      user_id: user.id,
      payment_id
    };
  } catch (err) {
    if (err instanceof UserNotFoundError || err instanceof DuplicatePaymentError) {
      throw err;
    }
    logger.error('Payment processing failed', { error: err.message, payment_id, email: normalizedEmail });
    throw new DatabaseError('Failed to process payment');
  }
};
```

---

**Function: validatePaymentId(email, paymentId)**

Purpose: Validate Payment ID for account activation (called from authController.activate)

Input:
- email: String (user's email)
- paymentId: String (Payment ID to validate)

Output:
```javascript
{
  valid: true,
  user: { id, email, full_name, payment_status, activated }
}
```

Errors:
- ValidationError: Payment ID format invalid
- UserNotFoundError: User doesn't exist
- PaymentNotFoundError: User has no payment_id
- PaymentMismatchError: Payment ID doesn't match user's payment_id
- PaymentStatusError: User payment_status not 'paid'

Implementation Logic:
1. Validate paymentId format: `/^PS_[A-Za-z0-9]{3,50}$/`
2. If invalid → throw ValidationError
3. Find user by email
4. If not found → throw UserNotFoundError
5. If user.payment_id is null → throw PaymentNotFoundError
6. If user.payment_id !== paymentId → throw PaymentMismatchError
7. If user.payment_status !== 'paid' → throw PaymentStatusError
8. Return { valid: true, user }

Implementation:
```javascript
const PAYMENT_ID_REGEX = /^PS_[A-Za-z0-9]{3,50}$/;

/**
 * Validate Payment ID for account activation
 * @param {string} email - User's email address
 * @param {string} paymentId - Payment ID to validate
 * @returns {Promise<Object>} Validation result with user data
 * @throws {ValidationError} When Payment ID format is invalid
 * @throws {UserNotFoundError} When user doesn't exist
 * @throws {PaymentNotFoundError} When user has no payment_id
 * @throws {PaymentMismatchError} When Payment ID doesn't match
 * @throws {PaymentStatusError} When payment_status is not 'paid'
 */
const validatePaymentId = async (email, paymentId) => {
  // Step 1: Validate format
  if (!PAYMENT_ID_REGEX.test(paymentId)) {
    throw new ValidationError('Invalid Payment ID format');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Step 2: Find user
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, payment_status, payment_id, activated')
    .eq('email', normalizedEmail)
    .single();

  if (error || !user) {
    throw new UserNotFoundError('User not found');
  }

  // Step 3: Check payment_id exists
  if (!user.payment_id) {
    throw new PaymentNotFoundError('No payment found for this user');
  }

  // Step 4: Check payment_id matches
  if (user.payment_id !== paymentId) {
    logger.warn('Payment ID mismatch during activation', {
      email: normalizedEmail,
      provided: paymentId,
      expected: user.payment_id
    });
    throw new PaymentMismatchError('Payment ID does not match');
  }

  // Step 5: Check payment_status
  if (user.payment_status !== 'paid') {
    throw new PaymentStatusError('Payment has not been completed');
  }

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
};
```

---

## Orphaned Payment Detection

### File: src/services/orphanedPaymentService.js

**Function: detectOrphanedPayments()**

Purpose: Find payments where Payment ID exists but doesn't match any user

Output: Array of orphaned payment objects

Implementation Logic:
1. Query all users where payment_status='paid' AND payment_id IS NOT NULL
2. For each user:
   - Check if another user exists with same payment_id
   - If yes → orphaned payment detected
3. Return array of { payment_id, original_user_email, duplicate_user_email }

Implementation:
```javascript
/**
 * Detect orphaned payments (Payment ID assigned to multiple users)
 * @returns {Promise<Array>} Array of orphaned payment records
 */
const detectOrphanedPayments = async () => {
  try {
    // Get all users with payment_id
    const { data: paidUsers, error } = await supabase
      .from('users')
      .select('id, email, payment_id, payment_status, created_at')
      .not('payment_id', 'is', null)
      .eq('payment_status', 'paid');

    if (error) {
      logger.error('Failed to query paid users', { error });
      throw new DatabaseError('Failed to detect orphaned payments');
    }

    if (!paidUsers || paidUsers.length === 0) {
      return [];
    }

    // Group users by payment_id to find duplicates
    const paymentIdMap = new Map();
    for (const user of paidUsers) {
      if (!paymentIdMap.has(user.payment_id)) {
        paymentIdMap.set(user.payment_id, []);
      }
      paymentIdMap.get(user.payment_id).push(user);
    }

    // Find payment_ids with multiple users
    const orphanedPayments = [];
    for (const [paymentId, users] of paymentIdMap.entries()) {
      if (users.length > 1) {
        // Sort by created_at to identify original vs duplicate
        users.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const original = users[0];

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
      orphaned_count: orphanedPayments.length
    });

    return orphanedPayments;
  } catch (err) {
    logger.error('Orphaned payment detection failed', { error: err.message });
    throw err;
  }
};
```

---

**Function: createOrphanedPaymentAlert(orphanedPayment)**

Purpose: Create admin alert for orphaned payment

Input:
```javascript
{
  payment_id: "PS_abc123",
  original_user_email: "user1@example.com",
  original_user_id: "uuid-1",
  duplicate_user_email: "user2@example.com",
  duplicate_user_id: "uuid-2"
}
```

Implementation Logic:
1. Insert into duplicate_payments table
2. Insert into admin_alerts table:
   - alert_type: 'orphaned_payment'
   - severity: 'high'
   - message: "Orphaned payment detected: {payment_id}"
   - alert_data: JSON with payment details
3. Log to system_logs

Implementation:
```javascript
/**
 * Create admin alert for orphaned payment
 * @param {Object} orphanedPayment - Orphaned payment details
 * @returns {Promise<Object>} Created alert record
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
    // Step 1: Insert into duplicate_payments
    const { error: dupError } = await supabase
      .from('duplicate_payments')
      .insert({
        payment_id,
        original_email: original_user_email,
        duplicate_email: duplicate_user_email,
        detected_at: new Date().toISOString(),
        resolved: false
      });

    if (dupError) {
      logger.error('Failed to create duplicate_payments entry', { error: dupError });
    }

    // Step 2: Create admin alert
    const { data: alert, error: alertError } = await supabase
      .from('admin_alerts')
      .insert({
        alert_type: 'orphaned_payment',
        severity: 'high',
        message: `Orphaned payment detected: ${payment_id}`,
        alert_data: {
          payment_id,
          original_user: {
            id: original_user_id,
            email: original_user_email
          },
          duplicate_user: {
            id: duplicate_user_id,
            email: duplicate_user_email
          }
        },
        resolved: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (alertError) {
      logger.error('Failed to create admin alert', { error: alertError });
      throw new DatabaseError('Failed to create admin alert');
    }

    // Step 3: Log to system_logs
    await supabase.from('system_logs').insert({
      log_level: 'warn',
      service: 'orphaned_payment_detector',
      action: 'orphaned_payment_detected',
      message: `Orphaned payment detected and alert created for ${payment_id}`,
      metadata: orphanedPayment,
      created_at: new Date().toISOString()
    });

    logger.warn('Orphaned payment alert created', { payment_id, alert_id: alert.id });

    return alert;
  } catch (err) {
    logger.error('Failed to create orphaned payment alert', { error: err.message, payment_id });
    throw err;
  }
};
```

---

## Validation Middleware

### File: src/middleware/validation.js (additions)

**Validation: paymentConfirmValidation**

```javascript
const paymentConfirmValidation = [
  body('payment_id')
    .notEmpty()
    .withMessage('Payment ID is required')
    .matches(/^PS_[A-Za-z0-9]{3,50}$/)
    .withMessage('Invalid Payment ID format (must be PS_ followed by 3-50 alphanumeric characters)'),

  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 10.00, max: 10.00 })
    .withMessage('Amount must be 10.00'),

  body('currency')
    .notEmpty()
    .withMessage('Currency is required')
    .equals('USD')
    .withMessage('Currency must be USD'),

  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .equals('completed')
    .withMessage('Status must be completed'),

  body('timestamp')
    .notEmpty()
    .withMessage('Timestamp is required')
    .isISO8601()
    .withMessage('Timestamp must be valid ISO 8601 format')
];
```

---

## Rate Limiter Configuration

### File: src/middleware/rateLimiter.js (additions)

```javascript
/**
 * Rate limiter for payment webhook endpoint
 * 100 requests per minute per IP
 */
const paymentWebhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    success: false,
    error: 'Too many payment requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || 'unknown';
  }
});
```

---

## n8n Workflow Specifications

**Workflow Name:** "Selfany Payment Processor"

**Trigger:** Webhook (POST from Selfany)

**Workflow Steps:**

1. **Webhook Trigger Node**
   - Method: POST
   - Authentication: None (Selfany will send signature)
   - Response: 200 OK immediately

2. **Set Variables Node**
   - Extract: email, payment_id, amount, currency, status, timestamp
   - Calculate HMAC signature for verification

3. **HTTP Request Node**
   - URL: https://contentscrapingserver.site/api/payment/confirm
   - Method: POST
   - Headers:
     - Content-Type: application/json
     - X-Webhook-Signature: {{calculated_signature}}
   - Body: JSON with all payment data

4. **IF Node (Success Check)**
   - Condition: HTTP status code = 200
   - True Path → Success handling
   - False Path → Error handling

5. **Success Path:**
   - Log success to n8n
   - (Optional) Send confirmation email to user

6. **Error Path:**
   - Log error to n8n
   - Create admin alert via backend API
   - (Optional) Retry logic

**n8n Signature Calculation (JavaScript):**
```javascript
const crypto = require('crypto');

const payload = {
  payment_id: $json.payment_id,
  email: $json.email,
  amount: $json.amount,
  currency: $json.currency,
  status: $json.status,
  timestamp: $json.timestamp
};

const secret = $env.N8N_WEBHOOK_SECRET;
const signature = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(payload))
  .digest('hex');

return { signature, payload };
```

---

## Database Schema Changes

**No new tables required.** Phase 3 uses existing tables from Phase 1:

### users table (updated columns):
| Column | Type | Description |
|--------|------|-------------|
| payment_status | VARCHAR(20) | Updated from 'pending' to 'paid' |
| payment_id | VARCHAR(50) | Populated with Payment ID from webhook |

### duplicate_payments table (existing):
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| payment_id | VARCHAR(50) | Duplicated payment ID |
| original_email | VARCHAR(255) | Email of original user |
| duplicate_email | VARCHAR(255) | Email of duplicate user |
| amount | DECIMAL(10,2) | Payment amount |
| currency | VARCHAR(3) | Payment currency |
| detected_at | TIMESTAMP | When detected |
| resolved | BOOLEAN | Resolution status |

### system_logs table (existing):
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| log_level | VARCHAR(10) | info, warn, error |
| service | VARCHAR(50) | Service name (payment) |
| action | VARCHAR(100) | Action performed |
| message | TEXT | Log message |
| metadata | JSONB | Additional data |
| created_at | TIMESTAMP | Log timestamp |

### admin_alerts table (existing):
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| alert_type | VARCHAR(50) | Type of alert |
| severity | VARCHAR(10) | low, medium, high |
| message | TEXT | Alert message |
| alert_data | JSONB | Additional data |
| resolved | BOOLEAN | Resolution status |
| created_at | TIMESTAMP | Alert timestamp |

---

## Custom Error Classes

### File: src/errors/paymentErrors.js

```javascript
/**
 * Custom error classes for payment operations
 */

class PaymentError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'PaymentError';
    this.statusCode = statusCode;
  }
}

class UserNotFoundError extends PaymentError {
  constructor(message = 'User not found') {
    super(message, 404);
    this.name = 'UserNotFoundError';
  }
}

class DuplicatePaymentError extends PaymentError {
  constructor(message = 'Payment ID already exists') {
    super(message, 409);
    this.name = 'DuplicatePaymentError';
  }
}

class ValidationError extends PaymentError {
  constructor(message = 'Validation failed') {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

class PaymentNotFoundError extends PaymentError {
  constructor(message = 'No payment found for this user') {
    super(message, 400);
    this.name = 'PaymentNotFoundError';
  }
}

class PaymentMismatchError extends PaymentError {
  constructor(message = 'Payment ID does not match') {
    super(message, 403);
    this.name = 'PaymentMismatchError';
  }
}

class PaymentStatusError extends PaymentError {
  constructor(message = 'Payment has not been completed') {
    super(message, 400);
    this.name = 'PaymentStatusError';
  }
}

class DatabaseError extends PaymentError {
  constructor(message = 'Database operation failed') {
    super(message, 500);
    this.name = 'DatabaseError';
  }
}

class SignatureVerificationError extends PaymentError {
  constructor(message = 'Invalid webhook signature') {
    super(message, 400);
    this.name = 'SignatureVerificationError';
  }
}

module.exports = {
  PaymentError,
  UserNotFoundError,
  DuplicatePaymentError,
  ValidationError,
  PaymentNotFoundError,
  PaymentMismatchError,
  PaymentStatusError,
  DatabaseError,
  SignatureVerificationError
};
```

---

## Testing Requirements

### Unit Tests

**File: tests/unit/paymentService.test.js**

Test Cases:
- ✅ verifyWebhookSignature() with valid signature → returns true
- ✅ verifyWebhookSignature() with invalid signature → returns false
- ✅ verifyWebhookSignature() with missing payload → returns false
- ✅ verifyWebhookSignature() with missing signature → returns false
- ✅ processPayment() with valid data → updates user successfully
- ✅ processPayment() with non-existent user → throws UserNotFoundError
- ✅ processPayment() with duplicate payment_id → throws DuplicatePaymentError
- ✅ processPayment() logs transaction to system_logs
- ✅ validatePaymentId() with valid Payment ID → returns { valid: true }
- ✅ validatePaymentId() with invalid format → throws ValidationError
- ✅ validatePaymentId() with no payment_id on user → throws PaymentNotFoundError
- ✅ validatePaymentId() with mismatched Payment ID → throws PaymentMismatchError
- ✅ validatePaymentId() with payment_status !== 'paid' → throws PaymentStatusError

**File: tests/unit/orphanedPaymentService.test.js**

Test Cases:
- ✅ detectOrphanedPayments() with orphaned payments → returns array
- ✅ detectOrphanedPayments() with no orphaned payments → returns empty array
- ✅ detectOrphanedPayments() with no paid users → returns empty array
- ✅ createOrphanedPaymentAlert() → creates duplicate_payments entry
- ✅ createOrphanedPaymentAlert() → creates admin_alerts entry
- ✅ createOrphanedPaymentAlert() → logs to system_logs

### Integration Tests

**File: tests/integration/payment-flow.test.js**

Test Cases:
- ✅ Complete flow: Webhook → User Updated → Activation Succeeds
- ✅ Duplicate payment: Second webhook with same Payment ID → 409 error
- ✅ Invalid signature: Webhook with wrong signature → 400 error
- ✅ User not found: Webhook with non-existent email → 404 error
- ✅ Invalid amount: Webhook with amount != 10.00 → 400 error
- ✅ Invalid currency: Webhook with currency != USD → 400 error
- ✅ Invalid payment_id format: Webhook with bad format → 400 error
- ✅ Missing required fields: Webhook with partial data → 400 error
- ✅ Rate limiting: 101 requests in 1 minute → 429 error
- ✅ Activation with valid Payment ID → Account activated, API keys generated
- ✅ Activation with invalid Payment ID format → 400 error
- ✅ Activation with Payment ID from different user → 403 error
- ✅ Activation with no payment → 400 error

### Manual Tests

- ✅ Real Selfany payment (test mode)
- ✅ n8n workflow execution
- ✅ Backend webhook receives data
- ✅ User payment_status updated in database
- ✅ Activation works with real Payment ID
- ✅ Orphaned payment detection works
- ✅ Admin alerts created for orphaned payments

---

## Security Requirements

### Webhook Security
- ✅ All webhooks must verify HMAC SHA256 signature
- ✅ N8N_WEBHOOK_SECRET must be stored in .env (never committed)
- ✅ Use timing-safe comparison for signature verification
- ✅ All webhook endpoints require HTTPS
- ✅ Rate limiting: 100 requests/minute per IP
- ✅ Reject requests with missing or invalid signatures

### Payment ID Security
- ✅ Format validation: Must match `/^PS_[A-Za-z0-9]{3,50}$/`
- ✅ Uniqueness: Payment IDs cannot be reused
- ✅ User matching: Payment ID must belong to user's email
- ✅ Timing: Payment must exist before activation
- ✅ Case sensitivity: Payment IDs are case-sensitive

### Data Logging
- ✅ All payment transactions logged to system_logs
- ✅ Never log credit card numbers or sensitive payment details
- ✅ Failed payments logged for investigation
- ✅ Audit trail includes: payment_id, email, amount, status, timestamp
- ✅ Log user_id (not full user object) in metadata

### Error Handling
- ✅ Generic error messages (don't leak system info)
- ✅ Proper HTTP status codes (400, 404, 409, 500)
- ✅ Winston logging for all errors
- ✅ No sensitive data in error responses
- ✅ Stack traces only in development mode

---

## Environment Variables

**Required (add to .env):**
```bash
# Webhook Security
N8N_WEBHOOK_SECRET=your-32-character-secret-key-here
```

**Generate a secure secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**No other new environment variables needed for Phase 3.**

---

## Success Criteria

Phase 3 is complete when:

- ✅ POST /api/payment/confirm endpoint deployed and accessible
- ✅ n8n workflow processing payments successfully
- ✅ Webhook signature verification working
- ✅ User payment_status updates automatically after payment
- ✅ Payment ID validation prevents unauthorized activations
- ✅ Duplicate payments detected and logged
- ✅ Orphaned payments detected and alerted
- ✅ All unit tests passing (>80% coverage)
- ✅ All integration tests passing
- ✅ All Phase 2 tests still passing (no regression)
- ✅ API documentation complete
- ✅ Code committed to GitHub
- ✅ Production deployment successful

---

## Files to be Created in Phase 3

```
src/
├── routes/
│   └── payment.js                        # Payment routes
├── controllers/
│   └── paymentController.js              # Payment webhook logic
├── services/
│   ├── paymentService.js                 # Payment processing
│   └── orphanedPaymentService.js         # Orphaned payment detection
├── errors/
│   └── paymentErrors.js                  # Custom error classes
tests/
├── unit/
│   ├── paymentService.test.js            # Payment service unit tests
│   └── orphanedPaymentService.test.js    # Orphaned payment unit tests
└── integration/
    └── payment-flow.test.js              # Payment flow integration tests
docs/
├── API_PAYMENT.md                        # Payment API documentation
└── PHASE_3_COMPLETION_REPORT.md          # Phase completion report
```

## Files to be Modified in Phase 3

```
src/
├── server.js                             # Register payment routes
├── middleware/
│   ├── validation.js                     # Add paymentConfirmValidation
│   └── rateLimiter.js                    # Add paymentWebhookRateLimiter
└── controllers/
    └── authController.js                 # Enhance activate() with Payment ID validation
README.md                                 # Update with Phase 3 info
.env.example                              # Add N8N_WEBHOOK_SECRET
```

---

## Implementation Order

1. **Create custom error classes** (src/errors/paymentErrors.js)
2. **Create payment service** (src/services/paymentService.js)
3. **Create orphaned payment service** (src/services/orphanedPaymentService.js)
4. **Add validation middleware** (update src/middleware/validation.js)
5. **Add rate limiter** (update src/middleware/rateLimiter.js)
6. **Create payment controller** (src/controllers/paymentController.js)
7. **Create payment routes** (src/routes/payment.js)
8. **Register routes in server.js**
9. **Update authController.activate()** with payment validation
10. **Write unit tests**
11. **Write integration tests**
12. **Create API documentation**
13. **Update README.md**
14. **Test with n8n workflow**
15. **Deploy to production**

---

**Remember:** This phase is critical for revenue. Every payment must be verified, logged, and secured. No shortcuts on security.
