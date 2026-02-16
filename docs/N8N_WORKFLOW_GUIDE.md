# n8n Workflow Setup Guide

**Version:** 1.0.0
**Last Updated:** February 16, 2026
**Purpose:** Automate payment confirmation from Selfany emails

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Workflow Architecture](#workflow-architecture)
4. [Step-by-Step Setup](#step-by-step-setup)
5. [Testing](#testing)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)
8. [Maintenance](#maintenance)

---

## Overview

This n8n workflow automates the payment confirmation process by:

1. **Monitoring Gmail** for payment confirmation emails from Selfany
2. **Extracting Payment ID** from email HTML body
3. **Generating HMAC signature** for security verification
4. **Sending payment data** to backend webhook
5. **Handling errors** and logging results

**Automation Benefit:** Eliminates manual payment verification, enables instant account activation within 60 seconds of payment completion.

---

## Prerequisites

### Required Accounts

- **n8n Account** - Free tier sufficient ([Sign up here](https://n8n.io))
- **Gmail Account** - To receive Selfany payment emails
- **Selfany Seller Account** - Configured to send payment emails
- **SocialBudi Backend** - Deployed and accessible via HTTPS

### Required Configuration

- **N8N_WEBHOOK_SECRET** - Generated and configured in backend `.env`
- **Gmail OAuth Credentials** - For inbox monitoring
- **Backend Server** - Accessible from internet (HTTPS required)

### Generate Webhook Secret

```bash
# SSH into VM1 backend server
ssh your-user@contentscrapingserver.site

# Generate 64-character random secret
openssl rand -hex 32

# Output example:
# 7f3d8c9a2b1e4f5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b

# Add to .env file
cd /var/www/socialbudi-backend
echo "N8N_WEBHOOK_SECRET=7f3d8c9a2b1e4f5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b" >> .env

# Restart backend
pm2 restart socialbudi-backend
pm2 save
```

---

## Workflow Architecture

### Payment Automation Flow

```
+-----------------------------------------------------+
|         PAYMENT AUTOMATION WORKFLOW                  |
+-----------------------------------------------------+

1. User pays $10 on Selfany
        |
        v
2. Selfany sends email -> Gmail Inbox
   Subject: "Payment Received"
   From: noreply@selfany.com
   Body: Contains Payment ID
        |
        v
3. n8n Gmail Trigger (polls every 1 minute)
   [x] Detects new email matching criteria
        |
        v
4. n8n Code Node: Extract Payment ID
   [x] Parses HTML email body
   [x] Uses regex to find Payment ID
   [x] Extracts buyer email
   [x] Validates format
        |
        v
5. n8n Code Node: Generate HMAC Signature
   [x] Structures payment data
   [x] Generates HMAC SHA256 signature
   [x] Uses N8N_WEBHOOK_SECRET
        |
        v
6. n8n HTTP Request Node
   [x] POST to backend webhook
   [x] Includes signature in header
        |
        v
7. Backend verifies and processes
   [x] Validates signature
   [x] Updates user payment_status='paid'
   [x] Stores payment_id
        |
        v
8. User can now activate account
```

---

## Step-by-Step Setup

### Step 1: Create n8n Account

1. Go to https://n8n.io
2. Click "Get Started Free"
3. Sign up with email or Google account
4. Verify your email address
5. Log in to n8n dashboard

**Expected:** Access to n8n workflow editor

---

### Step 2: Create New Workflow

1. In n8n dashboard, click "New Workflow"
2. Name the workflow: "Selfany Payment Processor"
3. Click on the workflow to open the editor

**Expected:** Blank workflow canvas

---

### Step 3: Add Gmail Trigger Node

**Node:** Gmail Trigger

#### Configuration Steps:

1. Click "+" button to add first node
2. Search for "Gmail Trigger"
3. Select "Gmail Trigger" from results

#### Authentication Setup

1. Click "Create New Credentials"
2. Select "OAuth2"
3. Follow Google OAuth setup wizard:
   - Grant Gmail permissions
   - Allow n8n to read your inbox
   - Complete authorization flow
4. Click "Save" credentials

#### Node Configuration

| Setting | Value |
|---------|-------|
| Event | Message Received |
| Label Names or IDs | INBOX |
| Filters - Sender | noreply@selfany.com |
| Filters - Subject | Payment Received |
| Polling Time | Every 1 minute |
| Download Attachments | No |
| Format | Resolved |

#### Test the Trigger

1. Send a test email to your Gmail matching the filters:
   - From: Any email (for testing)
   - Subject: "Payment Received"
   - Body: Include text "Payment ID: PS_test123"
2. Click "Listen for event" in n8n
3. Send the test email
4. Verify n8n detects the email (should appear in execution log)

**Expected Output:**
```json
{
  "subject": "Payment Received",
  "from": {
    "email": "noreply@selfany.com"
  },
  "textPlain": "...",
  "textHtml": "...",
  "receivedAt": "2026-02-16T12:00:00Z"
}
```

---

### Step 4: Add Code Node - Extract Payment ID

**Node:** Code

#### Configuration:

1. Click "+" after Gmail Trigger node
2. Search for "Code"
3. Select "Code" node

#### Settings:

| Setting | Value |
|---------|-------|
| Language | JavaScript |
| Mode | Run Once for All Items |

#### Code Implementation

```javascript
// Extract Payment ID and Buyer Email from Selfany payment email

const items = $input.all();
const results = [];

for (const item of items) {
  // Get email body (try plain text first, fallback to HTML)
  const emailBody = item.json.textPlain || item.json.textHtml || '';
  const subject = item.json.subject || '';

  // Extract Payment ID using regex
  // Selfany format: "Payment ID: PS_abc123def456"
  const paymentIdRegex = /Payment\s+ID:\s*([A-Za-z0-9_]+)/i;
  const match = emailBody.match(paymentIdRegex);

  if (!match || !match[1]) {
    throw new Error(`Payment ID not found in email. Subject: ${subject}`);
  }

  const paymentId = match[1].trim();

  // Extract buyer email from email body
  // Selfany format: "Buyer: user@example.com"
  const buyerEmailRegex = /Buyer:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const emailMatch = emailBody.match(buyerEmailRegex);

  if (!emailMatch || !emailMatch[1]) {
    throw new Error(`Buyer email not found in payment email. Subject: ${subject}`);
  }

  const buyerEmail = emailMatch[1].trim().toLowerCase();

  // Construct output
  results.push({
    json: {
      payment_id: paymentId,
      email: buyerEmail,
      amount: 10.00,
      currency: 'USD',
      status: 'completed',
      timestamp: new Date().toISOString(),
      // Keep original email data for debugging
      original_subject: subject,
      original_from: item.json.from?.email || 'unknown'
    }
  });
}

return results;
```

#### Important Notes

> **Adjust Regex Patterns:**
> - The regex patterns above are examples based on typical Selfany email format
> - You MUST test with an actual Selfany payment email
> - Update regex if email format differs

**To get actual email format:**
1. Complete a real $10 test payment on Selfany
2. Check Gmail for the confirmation email
3. View email source
4. Update regex patterns to match actual format

#### Test the Node

1. Click "Execute Node" (use test email from Step 3)
2. Verify output shows:
   - payment_id: Extracted correctly
   - email: Buyer email extracted
   - amount: 10.00
   - currency: "USD"
   - status: "completed"
   - timestamp: Current ISO timestamp

**Expected Output:**
```json
{
  "payment_id": "PS_test123",
  "email": "buyer@example.com",
  "amount": 10.00,
  "currency": "USD",
  "status": "completed",
  "timestamp": "2026-02-16T12:05:30.000Z"
}
```

---

### Step 5: Add Code Node - Generate Signature

**Node:** Code

#### Configuration:

1. Click "+" after Extract Payment ID node
2. Search for "Code"
3. Select "Code" node

#### Settings:

| Setting | Value |
|---------|-------|
| Language | JavaScript |
| Mode | Run Once for All Items |

#### Code Implementation

```javascript
// Generate HMAC SHA256 signature for webhook authentication

const crypto = require('crypto');
const items = $input.all();
const results = [];

// CRITICAL: Replace with your actual webhook secret
// This MUST match the N8N_WEBHOOK_SECRET in your backend .env file
const WEBHOOK_SECRET = 'your-n8n-webhook-secret-here';

for (const item of items) {
  // Construct payload (exactly as it will be sent to backend)
  const payload = {
    payment_id: item.json.payment_id,
    email: item.json.email,
    amount: item.json.amount,
    currency: item.json.currency,
    status: item.json.status,
    timestamp: item.json.timestamp
  };

  // Generate HMAC SHA256 signature
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  // Output payload with signature
  results.push({
    json: {
      ...payload,
      signature: signature
    }
  });
}

return results;
```

#### CRITICAL CONFIGURATION

Replace `your-n8n-webhook-secret-here` with the actual secret from your backend:

1. SSH into your backend server
2. Get the secret:
```bash
cat /var/www/socialbudi-backend/.env | grep N8N_WEBHOOK_SECRET
```
3. Copy the value (e.g., `7f3d8c9a2b1e4f5a6c7d8e9f0a1b2c3d...`)
4. Paste it in the code above, replacing `your-n8n-webhook-secret-here`

> **Security Note:** Keep this secret secure. Anyone with this secret can send fake payment confirmations.

#### Test the Node

1. Click "Execute Node"
2. Verify output shows:
   - All fields from previous node
   - signature: 64-character hexadecimal string

**Expected Output:**
```json
{
  "payment_id": "PS_test123",
  "email": "buyer@example.com",
  "amount": 10.00,
  "currency": "USD",
  "status": "completed",
  "timestamp": "2026-02-16T12:05:30.000Z",
  "signature": "7f3d8c9a2b1e4f5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b"
}
```

---

### Step 6: Add HTTP Request Node - Send to Backend

**Node:** HTTP Request

#### Configuration:

1. Click "+" after Generate Signature node
2. Search for "HTTP Request"
3. Select "HTTP Request" node

#### Request Configuration

| Setting | Value |
|---------|-------|
| Method | POST |
| URL | https://contentscrapingserver.site/api/payment/confirm |
| Authentication | None |
| Send Headers | Yes |

#### Headers Configuration

Click "Add Header" and configure:

**Header 1:**
- Name: `X-Webhook-Signature`
- Value: `={{$json.signature}}`

**Header 2:**
- Name: `Content-Type`
- Value: `application/json`

#### Body Configuration

| Setting | Value |
|---------|-------|
| Send Body | Yes |
| Body Content Type | JSON |
| Specify Body | Using Fields Below |

Add the following fields:

| Name | Value |
|------|-------|
| payment_id | `={{$json.payment_id}}` |
| email | `={{$json.email}}` |
| amount | `={{$json.amount}}` |
| currency | `={{$json.currency}}` |
| status | `={{$json.status}}` |
| timestamp | `={{$json.timestamp}}` |

#### Options Configuration

| Setting | Value |
|---------|-------|
| Timeout | 30000 (30 seconds) |
| Redirect | Follow All Redirects |
| Response Format | JSON |

#### Test the Node

1. Make sure backend is running:
```bash
curl https://contentscrapingserver.site/health
# Should return: {"status":"OK"}
```

2. Click "Execute Node" in n8n

3. Verify response:
```json
{
  "success": true,
  "message": "Payment confirmed and user updated",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "payment_id": "PS_test123"
}
```

**Expected:** HTTP 200 OK response

---

### Step 7: Add Error Handling (Optional but Recommended)

**Node:** Code (on error path)

#### Configuration:

1. On the HTTP Request node, find the "On Error" connection point (small dot on right side)
2. Click and drag to create error path
3. Add Code node on error path

#### Error Handler Code

```javascript
// Log webhook errors for debugging

const error = $input.item.json;
const errorMessage = error.message || 'Unknown error';
const statusCode = error.httpCode || 'N/A';

// Get original payment data from earlier nodes
const paymentId = $('Extract Payment ID').item.json.payment_id;
const email = $('Extract Payment ID').item.json.email;

// Log error details
console.error('Payment webhook failed:', {
  error: errorMessage,
  statusCode: statusCode,
  payment_id: paymentId,
  email: email,
  timestamp: new Date().toISOString()
});

// Optional: Send notification email to admin
// (Add "Send Email" node after this for alerts)

return [{
  json: {
    error: true,
    message: errorMessage,
    statusCode: statusCode,
    payment_id: paymentId,
    email: email,
    timestamp: new Date().toISOString()
  }
}];
```

**Purpose:** Captures error details for troubleshooting

---

### Step 8: Save and Activate Workflow

#### Save Workflow

1. Click "Save" button (top right corner)
2. Confirm workflow name: "Selfany Payment Processor"

#### Activate Workflow

1. Click the "Active" toggle switch (top right)
2. Toggle should turn green (ON)
3. Workflow now runs automatically every 1 minute

#### Activation Checklist

Before activating, verify:

- [ ] Gmail Trigger authenticated and configured
- [ ] All code nodes tested successfully
- [ ] HTTP Request returns 200 OK
- [ ] Webhook secret matches backend
- [ ] Error handler configured
- [ ] Workflow saved

**Status:** Workflow is now live and monitoring Gmail!

---

## Testing

### End-to-End Test

#### Test Plan

1. Create test user in SocialBudi
2. Send test payment email to Gmail
3. Wait for n8n to process (max 1 minute)
4. Verify database updated
5. Test account activation

#### Step 1: Create Test User

```bash
curl -X POST https://contentscrapingserver.site/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test123!@#"
  }'

# Expected: {"success":true,"next_action":"open_payment_modal"}
```

#### Step 2: Send Test Payment Email

**Option A: Real Selfany Payment (Recommended)**
1. Complete actual $10 payment on Selfany
2. Use email: test@example.com
3. Wait for Selfany to send confirmation email

**Option B: Manual Test Email (For testing only)**

Send email to your Gmail with this format:

```
From: noreply@selfany.com (or any email for testing)
To: your-gmail@gmail.com
Subject: Payment Received

Dear Seller,

You have received a new payment!

Buyer: test@example.com
Amount: $10.00 USD
Payment ID: PS_test123abc
Status: Completed
Date: February 16, 2026 at 12:30 PM

Thank you for using Selfany!
```

#### Step 3: Monitor n8n Execution

1. Go to n8n dashboard
2. Click "Executions" in left sidebar
3. Watch for new execution (should appear within 1 minute)
4. Click on execution to view details

**Expected Execution Log:**
```
[x] Gmail Trigger: Email detected
[x] Extract Payment ID: PS_test123abc
[x] Generate Signature: <64-char-hex>
[x] HTTP Request: 200 OK
    Response: {"success":true,"message":"Payment confirmed..."}
```

#### Step 4: Verify Database Update

```bash
# SSH into backend server
ssh your-user@contentscrapingserver.site

# Query database
psql -h stzgkndjnuhqyerycqgu.supabase.co -U postgres -d postgres

# Or use Supabase dashboard
```

```sql
SELECT email, payment_status, payment_id, activated
FROM users
WHERE email = 'test@example.com';

-- Expected result:
-- email: test@example.com
-- payment_status: paid
-- payment_id: PS_test123abc
-- activated: false
```

#### Step 5: Test Account Activation

```bash
curl -X POST https://contentscrapingserver.site/api/auth/activate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "payment_id": "PS_test123abc"
  }'

# Expected: 200 OK with JWT token and API keys
```

**Success Criteria:**
- n8n execution succeeded
- Database updated (payment_status='paid')
- Account activation successful
- JWT token received

---

## Monitoring

### n8n Execution History

**View Recent Executions:**
1. Go to n8n dashboard
2. Click "Executions" in left sidebar
3. Review recent workflow runs

**Execution Status:**
- Green checkmark = Success
- Red X = Failed
- Yellow = Running

**Filter Executions:**
- By date range
- By status (success/error)
- By workflow name

### Backend Logs

**View Payment Webhook Logs:**
```bash
# View recent payment logs
pm2 logs socialbudi-backend --lines 50 | grep payment_webhook

# View errors only
pm2 logs socialbudi-backend --err --lines 20

# Real-time monitoring
pm2 logs socialbudi-backend
```

### Database Monitoring

```sql
-- Check recent payments
SELECT
  email,
  payment_id,
  payment_status,
  activated,
  updated_at
FROM users
WHERE payment_status = 'paid'
ORDER BY updated_at DESC
LIMIT 10;

-- Check payment confirmation logs
SELECT
  log_level,
  service,
  action,
  message,
  created_at
FROM system_logs
WHERE service = 'payment_webhook'
ORDER BY created_at DESC
LIMIT 20;

-- Check for duplicates
SELECT payment_id, COUNT(*)
FROM users
WHERE payment_id IS NOT NULL
GROUP BY payment_id
HAVING COUNT(*) > 1;
```

### Set Up Alerts (Optional)

**Email Alerts for Failures:**
1. In n8n, add "Send Email" node on error path
2. Configure with your admin email
3. Include error details in email body

**Example Email Configuration:**
- To: admin@yourdomain.com
- Subject: [ALERT] Payment Webhook Failed
- Body:
```
Payment webhook failed at {{$now}}
Error: {{$json.error}}
Payment ID: {{$json.payment_id}}
Email: {{$json.email}}
Status Code: {{$json.statusCode}}
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Workflow Not Triggering

**Symptoms:** No executions in n8n history

**Solutions:**

1. **Verify workflow is Active:**
   - Check toggle switch is green/ON
   - Re-toggle if needed

2. **Check Gmail authentication:**
   - Go to Gmail Trigger node
   - Click "Reconnect" if expired
   - Re-authorize if needed

3. **Verify email filters:**
   - From: noreply@selfany.com
   - Subject: Payment Received
   - Send test email matching exact criteria

4. **Check polling frequency:**
   - Default: Every 1 minute
   - Wait at least 60 seconds after sending email

---

#### Issue 2: Payment ID Not Extracted

**Symptoms:** Error "Payment ID not found in email"

**Solutions:**

1. **Check email format:**
   - View actual Selfany email in Gmail
   - View email source/raw content
   - Verify "Payment ID:" text exists

2. **Update regex pattern:**
```javascript
// Current regex
const paymentIdRegex = /Payment\s+ID:\s*([A-Za-z0-9_]+)/i;

// If Selfany format is different, adjust:
// Example: "Payment Number: PS_123"
const paymentIdRegex = /Payment\s+Number:\s*([A-Za-z0-9_]+)/i;
```

3. **Test regex separately:**
   - Use https://regex101.com
   - Paste actual email body
   - Test regex pattern

---

#### Issue 3: Invalid Signature Error (400)

**Symptoms:** Backend returns 400 "Invalid webhook signature"

**Solutions:**

1. **Verify webhook secret matches:**
```bash
# On backend server
cat /var/www/socialbudi-backend/.env | grep N8N_WEBHOOK_SECRET

# In n8n workflow
# Check "Generate Signature" code node
# WEBHOOK_SECRET must match exactly
```

2. **Check payload structure:**
   - Payload sent to backend must match signature generation
   - Field names must be exact
   - JSON stringify order matters

3. **Test signature manually:**
```bash
# Generate test signature
PAYLOAD='{"payment_id":"PS_test","email":"test@example.com","amount":10.00,"currency":"USD","status":"completed","timestamp":"2026-02-16T12:00:00Z"}'
SECRET="your-webhook-secret"
echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET"
```

---

#### Issue 4: User Not Found (404)

**Symptoms:** Backend returns 404 "User not found"

**Solutions:**

1. **Verify user signed up:**
```sql
SELECT * FROM users WHERE email = 'buyer@example.com';
```

2. **Check email extraction:**
   - Verify buyer email extracted correctly
   - Check for extra spaces/characters
   - Emails are normalized to lowercase

3. **Verify email in Selfany payment:**
   - Buyer must use same email for signup and payment

---

#### Issue 5: HTTP Request Timeout

**Symptoms:** n8n shows timeout error after 30 seconds

**Solutions:**

1. **Check backend is running:**
```bash
curl https://contentscrapingserver.site/health
# Should return: {"status":"OK"}
```

2. **Verify PM2 status:**
```bash
pm2 status
# socialbudi-backend should be "online"
```

3. **Check backend logs:**
```bash
pm2 logs socialbudi-backend --err
```

4. **Test endpoint manually:**
```bash
curl -v https://contentscrapingserver.site/api/payment/confirm \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: test" \
  -d '{"payment_id":"PS_test","email":"test@example.com","amount":10.00,"currency":"USD","status":"completed","timestamp":"2026-02-16T12:00:00Z"}'
```

---

## Maintenance

### Weekly Tasks

- [ ] Review n8n execution history for failures
- [ ] Check backend logs for payment webhook errors
- [ ] Verify no orphaned payments detected
- [ ] Monitor payment success rate

### Monthly Tasks

- [ ] Review and update email parsing regex (if Selfany changes format)
- [ ] Check Gmail OAuth token expiration
- [ ] Verify webhook secret is secure
- [ ] Test complete payment flow end-to-end

### Security Tasks (Every 90 Days)

- [ ] Rotate N8N_WEBHOOK_SECRET
```bash
# Generate new secret
openssl rand -hex 32

# Update backend .env
# Update n8n workflow code
# Restart backend
pm2 restart socialbudi-backend
```
- [ ] Review n8n access logs
- [ ] Ensure HTTPS enforced on all requests
- [ ] Monitor for suspicious payment activity

### Backup & Recovery

**Export Workflow (Backup):**
1. Open workflow in n8n
2. Click "..." menu (top right)
3. Select "Download"
4. Save JSON file to secure location

**Import Workflow (Restore):**
1. Go to n8n dashboard
2. Click "Import from File"
3. Select saved JSON file
4. Update webhook secret in Code node
5. Reconnect Gmail authentication
6. Test workflow
7. Activate

---

## Summary

### Workflow Overview

| Node | Purpose | Key Configuration |
|------|---------|-------------------|
| Gmail Trigger | Monitor inbox | From: noreply@selfany.com, Poll: 1 min |
| Extract Payment ID | Parse email | Regex for Payment ID and buyer email |
| Generate Signature | Security | HMAC SHA256 with webhook secret |
| HTTP Request | Send to backend | POST to /api/payment/confirm |
| Error Handler | Log failures | Console error + optional email alert |

### Success Metrics

- **Automation:** Payments confirmed within 60 seconds
- **Accuracy:** 100% Payment ID extraction rate
- **Security:** All webhooks cryptographically signed
- **Reliability:** Workflow runs 24/7 automatically
- **Monitoring:** Full execution history and error tracking

---

## Support

**Issues:** See `TROUBLESHOOTING_PAYMENT.md`

**n8n Help:** https://docs.n8n.io

**Backend Logs:** `pm2 logs socialbudi-backend`

---

**Last Updated:** February 16, 2026
**Workflow Version:** 1.0.0
**Status:** Production

---

**End of n8n Workflow Setup Guide**
