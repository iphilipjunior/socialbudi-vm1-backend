# Payment Troubleshooting Guide

**Version:** 1.0.0
**Last Updated:** February 16, 2026
**Purpose:** Diagnose and resolve payment-related issues

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Diagnostics](#quick-diagnostics)
3. [Common Issues](#common-issues)
4. [Webhook Issues](#webhook-issues)
5. [n8n Workflow Issues](#n8n-workflow-issues)
6. [Database Issues](#database-issues)
7. [Payment Status Issues](#payment-status-issues)
8. [Duplicate Payment Resolution](#duplicate-payment-resolution)
9. [Orphaned Payment Resolution](#orphaned-payment-resolution)
10. [Debug Procedures](#debug-procedures)

---

## Overview

This guide helps diagnose and resolve payment processing issues in the SocialBudi platform. Most issues fall into these categories:

- **Webhook Issues** - Backend not receiving payment confirmations
- **n8n Issues** - Workflow not detecting or processing emails
- **Database Issues** - Payment status not updating
- **Duplicate Payments** - Same Payment ID used by multiple users
- **Orphaned Payments** - Payments without associated users

---

## Quick Diagnostics

### System Health Check

Run these commands to verify system status:

```bash
# 1. Check backend is running
curl https://contentscrapingserver.site/health
# Expected: {"status":"OK"}

# 2. Check PM2 status
ssh your-user@contentscrapingserver.site
pm2 status
# Expected: socialbudi-backend status "online"

# 3. Check n8n workflow is active
# Go to n8n dashboard -> Workflows
# Expected: "Selfany Payment Processor" toggle is green/ON

# 4. Test payment webhook manually
curl -X POST https://contentscrapingserver.site/api/payment/confirm \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: test" \
  -d '{"payment_id":"PS_test","email":"test@example.com","amount":10.00,"currency":"USD","status":"completed","timestamp":"2026-02-16T12:00:00Z"}'
# Expected: 400 (invalid signature) or 404 (user not found)
# NOT expected: 502, 504, connection refused
```

### Log Quick Check

```bash
# Check recent payment webhook activity
pm2 logs socialbudi-backend --lines 50 | grep payment

# Check for errors in last 20 log entries
pm2 logs socialbudi-backend --err --lines 20

# Check n8n execution history
# Go to n8n dashboard -> Executions
# Look for recent "Selfany Payment Processor" executions
```

---

## Common Issues

### Issue 1: Payment Received But User Can't Activate

**Symptoms:**
- User paid $10 via Selfany
- User received payment confirmation email
- User tries to activate account
- Gets error: "No payment found for this user" OR "Payment ID does not match"

**Diagnosis:**

```bash
# Step 1: Check if payment webhook was received
pm2 logs socialbudi-backend --lines 100 | grep "payment_confirmed"

# Step 2: Check user's payment status in database
# (Use Supabase dashboard or psql)
```

```sql
SELECT
  email,
  payment_status,
  payment_id,
  activated,
  updated_at
FROM users
WHERE email = 'user@example.com';
```

**Possible Causes & Solutions:**

#### Cause A: Payment webhook never fired

```
Symptoms:
- No "payment_confirmed" in logs
- payment_status still 'pending'
- payment_id is NULL

Solution:
1. Check n8n workflow execution history
2. Verify workflow is active (green toggle)
3. Check Gmail for payment email
4. Manually trigger n8n workflow if needed
```

#### Cause B: Payment ID mismatch

```
Symptoms:
- payment_status is 'paid'
- payment_id exists but doesn't match user's input
- User may have typo in Payment ID

Solution:
1. Get correct Payment ID from database
2. Tell user to use exact Payment ID (case-sensitive)
3. Or update database with correct Payment ID
```

#### Cause C: User signed up with different email

```
Symptoms:
- Webhook processed successfully
- But updated wrong user's record
- User with signup email has payment_status='pending'

Solution:
1. Check which user has the Payment ID
2. Contact user to verify email used for payment
3. Either update user's email or transfer payment
```

---

### Issue 2: Duplicate Payment Detected (409 Error)

**Symptoms:**
- n8n workflow shows 409 Conflict error
- Backend logs show "Payment ID already exists"
- Entry created in duplicate_payments table
- Admin alert created

**Diagnosis:**

```sql
-- Check for duplicate payment
SELECT
  id,
  email,
  payment_id,
  payment_status,
  created_at
FROM users
WHERE payment_id = 'PS_abc123'
ORDER BY created_at ASC;

-- Check duplicate_payments table
SELECT * FROM duplicate_payments
WHERE payment_id = 'PS_abc123';

-- Check admin alerts
SELECT * FROM admin_alerts
WHERE alert_type = 'duplicate_payment'
  AND alert_data->>'payment_id' = 'PS_abc123';
```

**Resolution Workflow:**

#### Step 1: Identify legitimate payment

```
- Check Selfany payment records
- Verify which email actually paid
- Check timestamps (earliest payment is usually legitimate)
```

#### Step 2: Determine resolution path

**Option A: Both users paid (Selfany glitch - rare)**

```
Action: Both payments are legitimate
Resolution:
1. Keep first user's payment as-is
2. Generate new Payment ID for second user
3. Update second user with new Payment ID
4. Mark both as paid
```

**Option B: Only one user paid (duplicate error)**

```
Action: Second webhook was duplicate/error
Resolution:
1. Keep first user's payment (original)
2. Refund second user if they paid
3. Remove second user's payment_id
4. Set second user back to payment_status='pending'
```

#### Step 3: Execute resolution

```sql
-- Option A: Update second user with new Payment ID
UPDATE users
SET payment_id = 'PS_new_unique_id',
    payment_status = 'paid'
WHERE email = 'second@example.com';

-- Option B: Reset second user
UPDATE users
SET payment_id = NULL,
    payment_status = 'pending'
WHERE email = 'second@example.com';

-- Mark duplicate as resolved
UPDATE duplicate_payments
SET resolved = true
WHERE payment_id = 'PS_abc123';

UPDATE admin_alerts
SET resolved = true
WHERE alert_data->>'payment_id' = 'PS_abc123';
```

---

### Issue 3: User Paid But No Confirmation Email Received

**Symptoms:**
- User completed $10 payment on Selfany
- No payment confirmation email in Gmail
- n8n workflow has no recent executions
- User's payment_status still 'pending'

**Diagnosis:**

```
Step 1: Verify payment actually completed
- Check Selfany seller dashboard
- Confirm payment exists and status is "completed"
- Get Payment ID from Selfany

Step 2: Check Gmail
- Log into Gmail account configured in n8n
- Search for emails from: noreply@selfany.com
- Check spam/junk folder
- Verify email exists with Payment ID

Step 3: Check n8n workflow
- Go to n8n dashboard
- Check "Executions" for recent runs
- Verify workflow is Active (green toggle)
- Check last successful execution timestamp
```

**Solutions:**

#### Solution A: Email in spam folder

```
1. Move email to Inbox
2. Mark sender as "Not Spam"
3. Wait up to 1 minute for n8n to detect
4. Check n8n executions for new run
```

#### Solution B: n8n workflow inactive

```
1. Go to n8n workflow
2. Toggle "Active" switch OFF then ON
3. Verify toggle turns green
4. Wait for next poll cycle (1 minute)
```

#### Solution C: Gmail OAuth expired

```
1. Go to n8n workflow
2. Open Gmail Trigger node
3. Click "Reconnect" on credentials
4. Re-authorize Gmail access
5. Save workflow and reactivate
```

#### Solution D: Manual payment update (last resort)

```sql
-- Only if automated process failed
-- Get Payment ID from Selfany dashboard

UPDATE users
SET payment_status = 'paid',
    payment_id = 'PS_from_selfany',
    updated_at = NOW()
WHERE email = 'user@example.com';

-- Log manual update
INSERT INTO system_logs (
  log_level,
  service,
  action,
  message,
  metadata
) VALUES (
  'warn',
  'manual_update',
  'payment_manually_confirmed',
  'Payment manually confirmed due to webhook failure',
  '{"email": "user@example.com", "payment_id": "PS_from_selfany"}'
);
```

---

## Webhook Issues

### Issue: Webhook Returns 400 "Invalid Signature"

**Symptoms:**
- n8n execution shows 400 Bad Request
- Error message: "Invalid webhook signature"
- Backend logs show signature verification failure

**Diagnosis:**

```bash
# Check webhook secret in backend
ssh your-user@contentscrapingserver.site
cat /var/www/socialbudi-backend/.env | grep N8N_WEBHOOK_SECRET

# Compare with n8n workflow
# Go to n8n -> "Generate Signature" Code node
# Verify WEBHOOK_SECRET matches
```

**Solutions:**

#### Solution 1: Webhook secret mismatch

```
Problem: Secrets don't match between n8n and backend

Fix:
1. Choose one secret as source of truth (prefer backend)
2. Update n8n workflow "Generate Signature" code:
   const WEBHOOK_SECRET = 'copy-from-backend-here';
3. Save workflow
4. Test with manual execution
```

#### Solution 2: Payload structure mismatch

```
Problem: Payload sent doesn't match signature generation

Fix:
1. Verify payload in "Generate Signature" node exactly matches
   what's sent in HTTP Request node
2. Ensure JSON.stringify() order is consistent
3. Check no extra fields added after signature generation
```

#### Solution 3: Signature encoding issue

```
Problem: Signature not properly hex encoded

Fix:
In "Generate Signature" node, ensure:

const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex'); // Must be 'hex' not 'base64'
```

---

### Issue: Webhook Returns 404 "User Not Found"

**Symptoms:**
- n8n execution shows 404 Not Found
- Error: "User not found with email: user@example.com"
- Payment email exists, but no matching user

**Diagnosis:**

```sql
-- Check if user exists
SELECT * FROM users WHERE email = 'user@example.com';

-- Check if email has typo
SELECT email FROM users WHERE email LIKE '%user@example%';
```

**Solutions:**

#### Solution 1: User hasn't signed up yet

```
Problem: Payment before signup

Fix:
1. Tell user to sign up first at /signup
2. Wait for them to create account
3. Payment will automatically link after signup
4. Or: Manually create user account (admin only)
```

#### Solution 2: Email mismatch

```
Problem: Different email in signup vs payment

Fix:
1. Get user's signup email from database
2. Get payment email from Selfany confirmation
3. If they match but different case: email normalization issue
4. If they don't match: user error, need to resolve manually
```

#### Solution 3: User deleted

```
Problem: User signed up then deleted account before paying

Fix:
1. Check system_logs for user deletion
2. If confirmed deleted, process refund
3. Or: Restore user account if deletion was error
```

---

## n8n Workflow Issues

### Issue: Workflow Not Detecting Emails

**Symptoms:**
- Payment emails arriving in Gmail
- n8n workflow shows no recent executions
- Workflow status shows "Active" (green)

**Diagnosis Checklist:**

```
[ ] 1. Verify workflow is actually active
    - Toggle should be green/ON
    - Try toggling OFF then ON

[ ] 2. Check Gmail Trigger configuration
    - Sender filter: noreply@selfany.com (exact)
    - Subject filter: Payment Received (exact)
    - Label: INBOX

[ ] 3. Check Gmail OAuth credentials
    - Not expired (check credentials page)
    - Permissions include gmail.readonly

[ ] 4. Verify polling interval
    - Set to "Every 1 minute"
    - Wait full minute after email arrives

[ ] 5. Check email actually matches filters
    - From: must be exact match
    - Subject: must contain exact phrase
    - Email in Inbox, not Archive/Spam
```

**Solutions:**

#### Solution 1: OAuth token expired

```
Fix:
1. Go to n8n workflow
2. Click on Gmail Trigger node
3. Click credentials dropdown
4. Click "Reconnect"
5. Complete OAuth flow again
6. Save workflow
```

#### Solution 2: Filter too restrictive

```
Fix:
1. Temporarily remove subject filter
2. Keep only sender filter: noreply@selfany.com
3. Test with new email
4. If works, adjust subject filter to be less exact
```

#### Solution 3: Gmail API quota exceeded (rare)

```
Symptoms: Worked before, suddenly stopped

Fix:
1. Check Google Cloud Console
2. View Gmail API quotas
3. Request quota increase if needed
4. Or: Reduce polling frequency to every 2-5 minutes
```

---

### Issue: Payment ID Extraction Fails

**Symptoms:**
- n8n workflow execution fails at "Extract Payment ID" node
- Error: "Payment ID not found in email"
- Email clearly contains Payment ID

**Diagnosis:**

```
1. Get actual email content:
   - Check n8n execution log
   - View email body (textPlain or textHtml)
   - Copy exact Payment ID format from email

2. Test regex pattern:
   - Go to https://regex101.com
   - Select "JavaScript" flavor
   - Paste email body in test string
   - Test regex pattern

3. Common format issues:
   - Extra spaces: "Payment  ID:" (double space)
   - Different label: "Payment Number:" instead of "Payment ID:"
   - HTML encoded: "Payment&nbsp;ID:"
   - Different case: "payment id:" (lowercase)
```

**Solutions:**

#### Solution 1: Update regex pattern

```javascript
// Original regex (strict)
const paymentIdRegex = /Payment\s+ID:\s*([A-Za-z0-9_]+)/i;

// More flexible regex (handles extra spaces)
const paymentIdRegex = /Payment\s+ID:\s*([A-Za-z0-9_]+)/i;

// Case insensitive, flexible spacing
const paymentIdRegex = /payment\s*id:?\s*([A-Za-z0-9_]+)/gi;

// If label is different
const paymentIdRegex = /Payment\s+Number:\s*([A-Za-z0-9_]+)/i;
```

#### Solution 2: Extract from HTML instead

```javascript
// If textPlain doesn't have Payment ID but HTML does
const emailBody = item.json.textHtml || item.json.textPlain || '';

// Strip HTML tags first
const plainText = emailBody.replace(/<[^>]*>/g, ' ');

// Then apply regex
const match = plainText.match(paymentIdRegex);
```

#### Solution 3: Add debug logging

```javascript
// Add at start of Extract Payment ID code
console.log('Email body:', emailBody);
console.log('Looking for Payment ID...');

const match = emailBody.match(paymentIdRegex);

console.log('Regex match result:', match);

if (!match) {
  console.log('Payment ID not found. Email body:', emailBody.substring(0, 500));
  throw new Error('Payment ID not found');
}
```

---

## Database Issues

### Issue: Payment Status Not Updating

**Symptoms:**
- Webhook returns 200 OK
- n8n execution successful
- But user's payment_status still 'pending' in database

**Diagnosis:**

```sql
-- Check user record
SELECT
  id,
  email,
  payment_status,
  payment_id,
  updated_at
FROM users
WHERE email = 'user@example.com';

-- Check system logs for update
SELECT
  service,
  action,
  message,
  metadata,
  created_at
FROM system_logs
WHERE metadata->>'email' = 'user@example.com'
ORDER BY created_at DESC
LIMIT 10;

-- Check if update happened but on different user
SELECT
  email,
  payment_status,
  payment_id
FROM users
WHERE payment_id = 'PS_from_webhook';
```

**Solutions:**

#### Solution 1: Email mismatch

```
Problem: Webhook updated different email than expected

Fix:
1. Check which email actually got updated
2. Verify buyer email extracted correctly from payment email
3. Update extraction logic if email format changed
```

#### Solution 2: Database RLS blocking update

```
Problem: Row Level Security preventing service_role update

Fix:
1. Verify backend uses SUPABASE_SERVICE_KEY (not anon key)
2. Check .env file for correct service key
3. Service role should bypass RLS
```

#### Solution 3: Update failed silently

```
Problem: Supabase update returned error but not caught

Fix:
Check backend logs:
pm2 logs socialbudi-backend --lines 100 | grep "payment_confirmed"

Look for database errors:
pm2 logs socialbudi-backend --err --lines 50
```

---

## Payment Status Issues

### Issue: User Shows "paid" But Can't Activate

**Symptoms:**
- payment_status = 'paid'
- payment_id exists and correct
- User tries to activate
- Gets error: "Invalid Payment ID"

**Diagnosis:**

```sql
SELECT
  email,
  payment_status,
  payment_id,
  activated
FROM users
WHERE email = 'user@example.com';
```

**Possible Causes:**

#### Cause 1: Case sensitivity

```
User enters: ps_abc123 (lowercase)
Database has: PS_abc123 (uppercase)
System: Case-sensitive comparison fails

Solution: Tell user Payment ID is case-sensitive
Or: Update validation logic to be case-insensitive
```

#### Cause 2: Extra spaces

```
User enters: "PS_abc123 " (trailing space)
Database has: "PS_abc123"
System: Exact match fails

Solution: Tell user to copy Payment ID exactly
Or: Update validation to trim whitespace
```

#### Cause 3: Already activated

```
User payment_status = 'paid'
User activated = true
User tries to activate again

Solution: Check if user is already activated
If yes: Tell user to login instead
If no: Different issue
```

---

## Duplicate Payment Resolution

### Complete Resolution Workflow

#### Step 1: Detect Duplicate

```bash
# Manually trigger detection
curl -X POST https://contentscrapingserver.site/api/admin/detect-orphaned-payments

# Or check database
```

```sql
SELECT payment_id, COUNT(*) as user_count
FROM users
WHERE payment_id IS NOT NULL
GROUP BY payment_id
HAVING COUNT(*) > 1;
```

#### Step 2: Investigate

```sql
-- Get all users with duplicate Payment ID
SELECT
  id,
  email,
  payment_id,
  payment_status,
  activated,
  created_at
FROM users
WHERE payment_id = 'PS_duplicate123'
ORDER BY created_at ASC;

-- Check Selfany payment records
-- (External - check Selfany dashboard)
-- Verify which email actually paid

-- Check duplicate_payments table
SELECT * FROM duplicate_payments
WHERE payment_id = 'PS_duplicate123';
```

#### Step 3: Determine Resolution

**Scenario A: Both users legitimate (Selfany issued duplicate ID)**

```
Resolution: Keep both, assign new Payment ID to second user

SQL:
UPDATE users
SET payment_id = 'PS_new_unique_' || id::text
WHERE id = (
  SELECT id FROM users
  WHERE payment_id = 'PS_duplicate123'
  ORDER BY created_at DESC
  LIMIT 1
);
```

**Scenario B: First user legitimate, second is error/fraud**

```
Resolution: Keep first, reset second to pending

SQL:
UPDATE users
SET payment_id = NULL,
    payment_status = 'pending'
WHERE id = (
  SELECT id FROM users
  WHERE payment_id = 'PS_duplicate123'
  ORDER BY created_at DESC
  LIMIT 1
);
```

#### Step 4: Mark as Resolved

```sql
UPDATE duplicate_payments
SET resolved = true,
    resolution_notes = 'Second user reset to pending - duplicate webhook'
WHERE payment_id = 'PS_duplicate123';

UPDATE admin_alerts
SET resolved = true
WHERE alert_data->>'payment_id' = 'PS_duplicate123'
  AND alert_type = 'duplicate_payment';
```

#### Step 5: Notify Users

```
Email first user (if needed):
"Your payment has been confirmed. You can now activate your account."

Email second user (if fraud/error):
"We detected a duplicate payment. Your account has been reset to pending.
Please contact support or make a new payment."
```

---

## Orphaned Payment Resolution

### What is an Orphaned Payment?

**Definition:** A payment where the Payment ID exists in the system but is assigned to a user who may not have actually paid, or payment was received before signup.

### Detection

```bash
# Use admin endpoint
curl -X POST https://contentscrapingserver.site/api/admin/detect-orphaned-payments

# Manual SQL check
```

```sql
-- Find Payment IDs used by multiple users
SELECT
  payment_id,
  json_agg(json_build_object(
    'email', email,
    'created_at', created_at,
    'activated', activated
  ) ORDER BY created_at) as users
FROM users
WHERE payment_id IS NOT NULL
  AND payment_status = 'paid'
GROUP BY payment_id
HAVING COUNT(*) > 1;
```

### Resolution Workflow

#### Step 1: Identify True Owner

```
1. Check Selfany payment records
2. Verify which email address actually paid
3. Check timestamps (usually first is legitimate)
4. Contact users if unclear
```

#### Step 2: Update Records

```sql
-- Keep legitimate user's payment
-- This query assumes first user (by created_at) is legitimate

-- Reset other users with same Payment ID
UPDATE users
SET payment_id = NULL,
    payment_status = 'pending'
WHERE payment_id = 'PS_orphaned123'
  AND id NOT IN (
    SELECT id FROM users
    WHERE payment_id = 'PS_orphaned123'
    ORDER BY created_at ASC
    LIMIT 1
  );
```

#### Step 3: Mark as Resolved

```sql
UPDATE admin_alerts
SET resolved = true,
    resolution_notes = 'Orphaned payment resolved - kept original user'
WHERE alert_data->>'payment_id' = 'PS_orphaned123'
  AND alert_type = 'orphaned_payment';
```

---

## Debug Procedures

### Full Payment Flow Debug

#### Step 1: User Signs Up

```bash
# Test signup
curl -X POST https://contentscrapingserver.site/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Debug User","email":"debug@example.com","password":"Test123!@#"}'

# Verify in database
```

```sql
SELECT email, payment_status, payment_id FROM users
WHERE email = 'debug@example.com';
-- Expected: payment_status='pending', payment_id=NULL
```

#### Step 2: User Pays

```
1. Complete $10 payment on Selfany
2. Use email: debug@example.com
3. Note Payment ID from Selfany confirmation
```

#### Step 3: Monitor Email Arrival

```
1. Check Gmail for email from Selfany
2. Verify subject is "Payment Received"
3. Verify email contains Payment ID
```

#### Step 4: Monitor n8n Execution

```
1. Go to n8n dashboard
2. Click "Executions"
3. Wait up to 1 minute
4. Look for new execution of "Selfany Payment Processor"
5. Click execution to view details
```

**Expected n8n Flow:**
```
[x] Gmail Trigger: Email detected
[x] Extract Payment ID: PS_abc123 extracted
[x] Generate Signature: 64-char hex generated
[x] HTTP Request: 200 OK response
```

#### Step 5: Verify Database Update

```sql
SELECT email, payment_status, payment_id, updated_at
FROM users
WHERE email = 'debug@example.com';

-- Expected:
-- payment_status='paid'
-- payment_id='PS_abc123' (from Selfany)
-- updated_at=recent timestamp
```

#### Step 6: Test Activation

```bash
curl -X POST https://contentscrapingserver.site/api/auth/activate \
  -H "Content-Type: application/json" \
  -d '{"email":"debug@example.com","payment_id":"PS_abc123"}'

# Expected: 200 OK with JWT token
```

---

### Backend Debugging Commands

```bash
# Check if backend is running
pm2 status

# View real-time logs
pm2 logs socialbudi-backend

# View last 100 lines
pm2 logs socialbudi-backend --lines 100

# View errors only
pm2 logs socialbudi-backend --err

# Search logs for specific payment
pm2 logs socialbudi-backend --lines 500 | grep "PS_abc123"

# Flush old logs
pm2 flush socialbudi-backend

# Restart backend
pm2 restart socialbudi-backend

# View backend environment variables
pm2 env 0  # 0 is PM2 process ID
```

---

## Emergency Procedures

### Critical: Payment System Down

**Symptoms:** All payments failing, no webhooks processing

**Immediate Actions:**

```bash
# 1. Check backend health
curl https://contentscrapingserver.site/health

# 2. If not responding, restart
ssh your-user@contentscrapingserver.site
pm2 restart socialbudi-backend
pm2 logs socialbudi-backend --err

# 3. Check n8n workflow
# Go to n8n dashboard
# Verify workflow is Active
# Check recent executions for errors

# 4. Notify users
# Post status update on status page
# Email users about temporary payment processing delay
```

### Critical: Mass Duplicate Payments

**Symptoms:** Multiple users with same Payment IDs, many 409 errors

**Immediate Actions:**

```bash
# 1. Pause n8n workflow
# Go to n8n -> Toggle workflow to Inactive

# 2. Assess damage
```

```sql
SELECT COUNT(*) as duplicate_count
FROM (
  SELECT payment_id
  FROM users
  WHERE payment_id IS NOT NULL
  GROUP BY payment_id
  HAVING COUNT(*) > 1
) as duplicates;
```

```
# 3. Contact Selfany support
# Report Payment ID duplication issue
# Request clarification on affected payments

# 4. Manual resolution required
# Use duplicate payment resolution workflow above
# Resolve each duplicate individually
```

---

## Support Contacts

**Backend Issues:**
- Check: `pm2 logs socialbudi-backend`
- Logs: `/var/www/socialbudi-backend/logs/`

**n8n Issues:**
- Dashboard: https://n8n.io
- Execution history available in dashboard

**Database Issues:**
- Supabase: https://supabase.com
- Check table browser and SQL editor

**Payment Provider:**
- Selfany: Check seller dashboard
- Support: Contact Selfany support team

---

**Last Updated:** February 16, 2026
**Version:** 1.0.0
**Status:** Production

---

**End of Payment Troubleshooting Guide**
