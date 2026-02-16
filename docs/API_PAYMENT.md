# Payment API Reference

**Version:** 1.0.0
**Last Updated:** February 16, 2026
**Base URL:** https://contentscrapingserver.site
**Protocol:** HTTPS only

---

## Overview

The Payment API handles payment confirmations from Selfany payment provider via n8n automation. This API is critical for revenue generation - it updates user payment status when $10 payments are completed, enabling account activation.

### Key Features

- **HMAC SHA256 Signature Verification** - Prevents unauthorized webhook calls
- **Automated Payment Processing** - Updates user status in real-time
- **Duplicate Payment Detection** - Creates admin alerts for duplicates
- **Complete Audit Trail** - All transactions logged to database
- **Rate Limiting** - 100 requests/minute protection

---

## Table of Contents

- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [POST /api/payment/confirm](#post-apipaymentconfirm)
- [Webhook Signature Verification](#webhook-signature-verification)
- [Request/Response Examples](#requestresponse-examples)
- [Error Codes](#error-codes)
- [Testing Guide](#testing-guide)
- [Security](#security)

---

## Authentication

### Webhook Signature Verification

All requests must include a valid HMAC SHA256 signature in the `X-Webhook-Signature` header.

**Required Header:**
```
X-Webhook-Signature: <64-character-hex-string>
```

**Signature Generation Process:**
```javascript
const crypto = require('crypto');
const payload = JSON.stringify(requestBody);
const signature = crypto
  .createHmac('sha256', N8N_WEBHOOK_SECRET)
  .update(payload)
  .digest('hex');
```

**Environment Variable:**
```
N8N_WEBHOOK_SECRET=your-secure-random-string-here
```

> **Critical:** This secret must match between n8n workflow and backend server.

---

## Endpoints

### POST /api/payment/confirm

Receives payment confirmation from n8n workflow and updates user payment status.

| Property | Value |
|----------|-------|
| URL | `/api/payment/confirm` |
| Method | `POST` |
| Content-Type | `application/json` |
| Rate Limit | 100 requests per minute per IP |

#### Request Headers

| Header | Required | Type | Description |
|--------|----------|------|-------------|
| X-Webhook-Signature | Yes | string | HMAC SHA256 signature (64 hex chars) |
| Content-Type | Yes | string | Must be `application/json` |

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| payment_id | string | Yes | 1-100 chars | Unique payment identifier (e.g., "PS_697b79de46bf0") |
| email | string | Yes | Valid email | User's email address (must exist in database) |
| amount | number | Yes | Must be 10.00 | Payment amount in USD |
| currency | string | Yes | Must be "USD" | Currency code |
| status | string | Yes | Must be "completed" | Payment status |
| timestamp | string | Yes | ISO 8601 | Payment timestamp |

**Example Request:**
```json
{
  "payment_id": "PS_697b79de46bf0",
  "email": "user@example.com",
  "amount": 10.00,
  "currency": "USD",
  "status": "completed",
  "timestamp": "2026-02-16T12:30:45.000Z"
}
```

#### Success Response

**Status Code:** `200 OK`

**Response Body:**
```json
{
  "success": true,
  "message": "Payment confirmed and user updated",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "payment_id": "PS_697b79de46bf0"
}
```

**Database Changes:**
- User's `payment_status` updated: `'pending'` -> `'paid'`
- User's `payment_id` populated with value from request
- Entry created in `system_logs` table

#### Error Responses

##### 400 Bad Request - Invalid Signature

**Cause:** HMAC signature doesn't match payload

```json
{
  "success": false,
  "error": "Invalid webhook signature"
}
```

**Common Causes:**
- `N8N_WEBHOOK_SECRET` mismatch between n8n and backend
- Payload modified after signature generation
- Signature algorithm incorrect

**Solution:** Verify webhook secret matches on both sides

##### 400 Bad Request - Validation Failed

**Cause:** Request body fields fail validation

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "amount",
      "message": "Amount must be 10.00"
    }
  ]
}
```

**Validation Rules:**
- `amount`: Must be exactly 10.00
- `currency`: Must be "USD"
- `status`: Must be "completed"
- `email`: Must be valid email format
- `payment_id`: 1-100 characters
- `timestamp`: Valid ISO 8601 format

##### 404 Not Found - User Not Found

**Cause:** No user exists with provided email

```json
{
  "success": false,
  "error": "User not found with email: user@example.com"
}
```

**Common Causes:**
- User hasn't signed up yet
- Email typo in payment
- User deleted from database

**Solution:** Verify user signed up before paying

##### 409 Conflict - Duplicate Payment ID

**Cause:** Payment ID already used by another user

```json
{
  "success": false,
  "error": "Payment ID already exists",
  "message": "This Payment ID has already been used by another user"
}
```

**Database Changes:**
- Entry created in `duplicate_payments` table
- Admin alert created in `admin_alerts` table
- No user updated (duplicate rejected)

**Resolution:** Admin must manually resolve duplicate

##### 500 Internal Server Error

**Cause:** Unexpected server error

```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

**Common Causes:**
- Database connection lost
- Supabase unavailable
- Server crash

**Solution:** Check PM2 logs and server status

---

## Webhook Signature Verification

### How Signatures Work

Webhook signatures use HMAC (Hash-based Message Authentication Code) with SHA256 to prove:

1. Request came from authorized source (n8n)
2. Payload wasn't tampered with
3. Request is fresh (not replay attack)

### Generation Process (n8n Side)

```javascript
const crypto = require('crypto');

// 1. Construct payload (exact JSON that will be sent)
const payload = {
  payment_id: "PS_697b79de46bf0",
  email: "user@example.com",
  amount: 10.00,
  currency: "USD",
  status: "completed",
  timestamp: "2026-02-16T12:30:45.000Z"
};

// 2. Convert to JSON string (order matters!)
const payloadString = JSON.stringify(payload);

// 3. Generate HMAC using webhook secret
const signature = crypto
  .createHmac('sha256', N8N_WEBHOOK_SECRET)
  .update(payloadString)
  .digest('hex');

// 4. Include in request header
// X-Webhook-Signature: 7f3d8c9a2b1e4f5a6c7d8e9f0a1b2c3d...
```

### Verification Process (Backend Side)

```javascript
// 1. Extract signature from header
const receivedSignature = req.headers['x-webhook-signature'];

// 2. Generate expected signature from payload
const expectedSignature = crypto
  .createHmac('sha256', process.env.N8N_WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');

// 3. Compare using constant-time comparison (prevents timing attacks)
const isValid = crypto.timingSafeEqual(
  Buffer.from(expectedSignature),
  Buffer.from(receivedSignature)
);

// 4. Reject if invalid
if (!isValid) {
  return res.status(400).json({
    success: false,
    error: 'Invalid webhook signature'
  });
}
```

### Security Considerations

**Why Constant-Time Comparison?**
- Prevents timing attacks that could reveal signature bytes
- `crypto.timingSafeEqual()` takes same time regardless of where difference is

**Best Practices:**
- Keep `N8N_WEBHOOK_SECRET` long (64+ characters)
- Store in environment variables only
- Never commit to version control
- Rotate periodically (every 90 days)
- Use HTTPS only
- Never log webhook secret
- Never expose in API responses

---

## Request/Response Examples

### Example 1: Successful Payment

**Request:**
```bash
curl -X POST https://contentscrapingserver.site/api/payment/confirm \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: 7f3d8c9a2b1e4f5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b" \
  -d '{
    "payment_id": "PS_697b79de46bf0",
    "email": "user@example.com",
    "amount": 10.00,
    "currency": "USD",
    "status": "completed",
    "timestamp": "2026-02-16T12:30:45.000Z"
  }'
```

**Response:**
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Payment confirmed and user updated",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "payment_id": "PS_697b79de46bf0"
}
```

**Database Verification:**
```sql
SELECT email, payment_status, payment_id, activated
FROM users
WHERE email = 'user@example.com';

-- Result:
-- payment_status: 'paid'
-- payment_id: 'PS_697b79de46bf0'
-- activated: false (user must activate)
```

### Example 2: Invalid Signature

**Request:**
```bash
curl -X POST https://contentscrapingserver.site/api/payment/confirm \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: wrong-signature-123" \
  -d '{
    "payment_id": "PS_test123",
    "email": "test@example.com",
    "amount": 10.00,
    "currency": "USD",
    "status": "completed",
    "timestamp": "2026-02-16T12:30:45.000Z"
  }'
```

**Response:**
```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": "Invalid webhook signature"
}
```

**Database:** No changes made

### Example 3: User Not Found

**Request:**
```bash
# With valid signature but non-existent user
curl -X POST https://contentscrapingserver.site/api/payment/confirm \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: [valid-signature]" \
  -d '{
    "payment_id": "PS_test456",
    "email": "nonexistent@example.com",
    "amount": 10.00,
    "currency": "USD",
    "status": "completed",
    "timestamp": "2026-02-16T12:30:45.000Z"
  }'
```

**Response:**
```
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "success": false,
  "error": "User not found with email: nonexistent@example.com"
}
```

**Database:** No changes made

### Example 4: Duplicate Payment ID

**Request:**
```bash
# Payment ID already used by another user
curl -X POST https://contentscrapingserver.site/api/payment/confirm \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: [valid-signature]" \
  -d '{
    "payment_id": "PS_697b79de46bf0",
    "email": "different@example.com",
    "amount": 10.00,
    "currency": "USD",
    "status": "completed",
    "timestamp": "2026-02-16T14:00:00.000Z"
  }'
```

**Response:**
```
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "success": false,
  "error": "Payment ID already exists",
  "message": "This Payment ID has already been used by another user"
}
```

**Database Changes:**
```sql
-- duplicate_payments table
INSERT INTO duplicate_payments (
  payment_id,
  original_email,
  duplicate_email,
  detected_at,
  resolved
) VALUES (
  'PS_697b79de46bf0',
  'user@example.com',
  'different@example.com',
  NOW(),
  false
);

-- admin_alerts table
INSERT INTO admin_alerts (
  alert_type,
  severity,
  message,
  alert_data
) VALUES (
  'duplicate_payment',
  'high',
  'Duplicate Payment ID: PS_697b79de46bf0',
  {...}
);
```

---

## Error Codes

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | Invalid webhook signature | Signature verification failed | Verify `N8N_WEBHOOK_SECRET` matches |
| 400 | Validation failed | Invalid request fields | Check all required fields |
| 400 | Amount must be 10.00 | Wrong amount | Only $10 payments accepted |
| 400 | Currency must be USD | Wrong currency | Only USD supported |
| 400 | Status must be completed | Invalid status | Only completed payments |
| 404 | User not found | Email not in database | User must signup before paying |
| 409 | Payment ID already exists | Duplicate payment | Check duplicate_payments table |
| 429 | Too many requests | Rate limit exceeded | Wait 1 minute, retry |
| 500 | Internal server error | Server/database error | Check logs, contact admin |

---

## Testing Guide

### Prerequisites

```bash
# 1. Ensure backend is running
curl https://contentscrapingserver.site/health
# Expected: {"status":"OK"}

# 2. Get webhook secret from server
ssh into VM1
cat /var/www/socialbudi-backend/.env | grep N8N_WEBHOOK_SECRET

# 3. Create test user
curl -X POST https://contentscrapingserver.site/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

### Test 1: Valid Payment with Signature

```bash
# Set variables
SECRET="your-n8n-webhook-secret"
PAYLOAD='{"payment_id":"PS_test001","email":"test@example.com","amount":10.00,"currency":"USD","status":"completed","timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}'

# Generate signature using openssl
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

# Send request
curl -X POST https://contentscrapingserver.site/api/payment/confirm \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"

# Expected: 200 OK
```

### Test 2: Invalid Signature (Expected 400)

```bash
curl -X POST https://contentscrapingserver.site/api/payment/confirm \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: invalid-signature-12345" \
  -d '{
    "payment_id": "PS_test002",
    "email": "test@example.com",
    "amount": 10.00,
    "currency": "USD",
    "status": "completed",
    "timestamp": "2026-02-16T12:00:00Z"
  }'

# Expected: 400 Bad Request "Invalid webhook signature"
```

### Test 3: User Not Found (Expected 404)

```bash
# Generate valid signature for non-existent user
PAYLOAD='{"payment_id":"PS_test003","email":"nobody@example.com","amount":10.00,"currency":"USD","status":"completed","timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

curl -X POST https://contentscrapingserver.site/api/payment/confirm \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"

# Expected: 404 Not Found "User not found"
```

### Test 4: Invalid Amount (Expected 400)

```bash
PAYLOAD='{"payment_id":"PS_test004","email":"test@example.com","amount":5.00,"currency":"USD","status":"completed","timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

curl -X POST https://contentscrapingserver.site/api/payment/confirm \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"

# Expected: 400 Bad Request "Amount must be 10.00"
```

### Database Verification

After successful payment test:

```sql
-- Check user payment status
SELECT email, payment_status, payment_id, activated
FROM users
WHERE email = 'test@example.com';

-- Expected result:
-- payment_status = 'paid'
-- payment_id = 'PS_test001'
-- activated = false

-- Check system logs
SELECT service, action, message, created_at
FROM system_logs
WHERE metadata->>'email' = 'test@example.com'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Security

### Security Checklist

Before production, verify:

- [ ] **HTTPS Enforced** - No HTTP allowed
- [ ] **Strong Webhook Secret** - 64+ characters random
- [ ] **Secret Matches** - n8n and backend use same secret
- [ ] **Signature Verification** - Active and working
- [ ] **Rate Limiting** - 100/min configured
- [ ] **Error Messages** - No sensitive data leaked
- [ ] **Amount Validation** - Only 10.00 accepted
- [ ] **Currency Validation** - Only USD accepted
- [ ] **Duplicate Detection** - Active and alerting
- [ ] **Audit Logging** - All events in system_logs

### Monitoring

**Check Payment Webhook Logs:**
```bash
pm2 logs socialbudi-backend --lines 50 | grep payment_webhook
```

**Check for Errors:**
```bash
pm2 logs socialbudi-backend --err --lines 20
```

**Monitor Database:**
```sql
-- Recent payments
SELECT email, payment_id, payment_status, updated_at
FROM users
WHERE payment_status = 'paid'
ORDER BY updated_at DESC
LIMIT 10;

-- Recent payment logs
SELECT log_level, action, message, created_at
FROM system_logs
WHERE service = 'payment_webhook'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Integration with n8n

See **N8N Workflow Setup Guide** for complete configuration.

**Quick Reference:**

**n8n HTTP Request Node:**
- Method: `POST`
- URL: `https://contentscrapingserver.site/api/payment/confirm`
- Headers: `X-Webhook-Signature: {{$json.signature}}`
- Body: Payment data (JSON)

**n8n Signature Generation:**
```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', N8N_WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');
```

---

## Support

**Troubleshooting:** See `TROUBLESHOOTING_PAYMENT.md`

**Issues:**
- Check PM2 logs: `pm2 logs socialbudi-backend`
- Check Supabase logs: https://supabase.com
- Check n8n execution history

**Contact:** For production issues, check `system_logs` and `admin_alerts` tables

---

**Last Updated:** February 16, 2026
**API Version:** 1.0.0
**Status:** Production

---

**End of Payment API Documentation**
