# Phase 5 Specifications: Admin Backend

**Status:** IN PROGRESS
**Phase:** 5
**Repository:** socialbudi-vm1-backend

## Overview

Build the admin backend for SocialBudi. Admins use a separate JWT (ADMIN_JWT_SECRET) to authenticate and access admin-only endpoints for managing users, payments, alerts, and system logs.

## Critical Implementation Rules

### JWT Separation
- Admin JWT signed with: process.env.ADMIN_JWT_SECRET
- User JWT signed with: process.env.JWT_SECRET
- These MUST be different secrets
- adminAuth.js middleware must verify with ADMIN_JWT_SECRET
- If token payload contains user_id field → reject (that's a user token)
- Admin token payload: { admin_id, email, role }

### Database Schema

**admin_users (primary key: admin_id)**
```
admin_id        UUID PK
email           TEXT UNIQUE NOT NULL
password_hash   TEXT NOT NULL
name            TEXT NOT NULL
role            TEXT DEFAULT 'admin'
is_active       BOOLEAN DEFAULT TRUE
last_login      TIMESTAMP
created_by      UUID FK admin_users.admin_id
created_at      TIMESTAMP
updated_at      TIMESTAMP
permissions     JSONB
```

**admin_alerts (primary key: alert_id)**
```
alert_id        UUID PK
alert_type      TEXT NOT NULL
severity        TEXT DEFAULT 'warning'
title           TEXT NOT NULL
description     TEXT
metadata        JSONB
status          TEXT DEFAULT 'unresolved'
resolved_by     UUID FK admin_users.admin_id
resolved_at     TIMESTAMP
created_at      TIMESTAMP
```

**users table reminders**
- Primary key: id (NOT user_id)
- Name column: full_name (NOT name)
- Map in API responses: id → user_id, full_name → name

**system_logs table reminders**
- log_level (NOT log_type)
- action (NOT details)
- admin_id column exists for logging admin actions

## Endpoints

### POST /api/admin/login
- No auth required
- Rate limit: 5/minute per IP
- Body: { email, password }
- Logic: find admin by email → bcrypt.compare → generate admin JWT → update last_login → log to system_logs
- Response: { success: true, token, admin: { admin_id, name, email, role } }
- Errors: 401 invalid credentials, 403 account inactive, 400 validation

### GET /api/admin/users
- Admin JWT required
- Rate limit: 60/hour
- Query: ?search=&payment_status=&activated=&page=1&limit=50
- search: matches full_name ILIKE or email ILIKE
- Response: { success, users: [...], pagination: { current_page, total_pages, total_users, per_page } }
- User object: { user_id, name, email, payment_status, payment_id, activated, linkedin_cookie_set, created_at, activated_at }

### GET /api/admin/users/:id
- Admin JWT required
- Returns full user profile + api_keys array
- id param = users.id (UUID)

### POST /api/admin/users/:id/activate
- Admin JWT required
- Sets activated=true, activated_at=now(), payment_status='paid' if not already
- Logs action to system_logs with admin_id
- Response: { success, message, user: { user_id, email, activated, activated_at } }

### GET /api/admin/payments
- Admin JWT required
- Query: ?payment_status=&page=1&limit=50
- Returns users with payment data (all columns related to payment)

### GET /api/admin/payments/:id
- Admin JWT required
- id = users.id
- Returns full payment detail for that user

### GET /api/admin/orphaned-payments
- Admin JWT required
- Returns users where: payment_id IS NOT NULL AND activated = false AND payment_status != 'paid'
- For each, attempt email similarity match with other users (suggest possible matches)

### POST /api/admin/link-payment
- Admin JWT required
- Body: { user_id, payment_id, admin_notes }
- Updates target user: payment_id, payment_status='paid', activated=true, activated_at=now()
- Resolves any admin_alerts related to this payment_id
- Logs action with admin_id and notes
- Response: { success, message }

### GET /api/admin/alerts
- Admin JWT required
- Query: ?status=unresolved&alert_type=&severity=&page=1&limit=50
- Default: status=unresolved
- Response: { success, alerts: [...], pagination }

### POST /api/admin/alerts/:id/resolve
- Admin JWT required
- id = admin_alerts.alert_id
- Body: { action, notes }
- Sets status='resolved', resolved_by=admin_id, resolved_at=now()
- Logs to system_logs
- Response: { success, message }

### GET /api/admin/logs
- Admin JWT required
- Query: ?log_level=&action=&user_id=&date_from=&date_to=&page=1&limit=100
- Sorted by created_at DESC
- Response: { success, logs: [...], pagination }

## Rate Limiters to Add (rateLimiter.js)

```javascript
// Admin login - strict
adminLoginLimiter: windowMs 60*1000, max: 5

// Admin general - standard
adminGeneralLimiter: windowMs 60*60*1000, max: 60
```

## Validators to Add (validation.js)

- adminLoginValidator: email (valid), password (non-empty)
- adminActivateUserValidator: params.id (UUID format)
- adminLinkPaymentValidator: body.user_id (UUID), body.payment_id (non-empty string)
- adminResolveAlertValidator: params.id (UUID), body.action (non-empty)
- adminLogsQueryValidator: optional date_from/date_to as valid date strings

## Logging Pattern for Admin Actions

```javascript
await supabase.from('system_logs').insert({
  log_level: 'info',
  service: 'admin',
  action: 'action_name', // e.g. 'admin_login', 'manual_activation', 'link_payment'
  message: 'Human readable description',
  admin_id: req.admin.admin_id,
  user_id: affected_user_id || null,
  ip_address: req.ip,
  request_data: { /* relevant non-sensitive context */ }
});
```

## Security Requirements

- Never log password (plain or hashed)
- Never log JWT tokens
- Verify is_active=true on every admin login
- All endpoints behind adminAuth.js middleware (except login)
- Admin JWT expiry: 24 hours (configurable via ADMIN_JWT_EXPIRES_IN env, default '24h')

## Files Structure

```
src/
├── routes/admin.js
├── controllers/adminController.js
├── services/
│   ├── adminService.js
│   └── adminJwtService.js
├── middleware/adminAuth.js

tests/
├── unit/
│   ├── adminService.test.js
│   └── adminJwtService.test.js
└── integration/admin.test.js

docs/API_ADMIN.md
```
