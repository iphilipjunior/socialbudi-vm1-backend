# Admin API Documentation

## Overview

Admin API endpoints for managing users, payments, alerts, and system logs.

- **Base URL:** `https://contentscrapingserver.site/api/admin`
- **Authentication:** Bearer token (Admin JWT, signed with `ADMIN_JWT_SECRET`)
- **Admin token expiry:** 24 hours (configurable via `ADMIN_JWT_EXPIRES_IN`)

## Authentication

### POST /api/admin/login

Authenticate an admin user and receive a JWT token.

**Rate Limit:** 5 requests per minute per IP

**Request Body:**
```json
{
  "email": "admin@socialbudi.com",
  "password": "your_password"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "admin": {
    "admin_id": "uuid-here",
    "name": "Admin Name",
    "email": "admin@socialbudi.com",
    "role": "admin"
  }
}
```

**Error Responses:**
- `400` - Validation failed (invalid email or missing password)
- `401` - Invalid credentials
- `403` - Account is inactive
- `429` - Rate limit exceeded

**cURL Example:**
```bash
curl -X POST https://contentscrapingserver.site/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@socialbudi.com", "password": "your_password"}'
```

---

## User Management

### GET /api/admin/users

Get paginated list of users with optional filters.

**Rate Limit:** 60 requests per hour

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by name or email (ILIKE) |
| `payment_status` | string | Filter by 'pending' or 'paid' |
| `activated` | boolean | Filter by activation status |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 50, max: 100) |

**Success Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "user_id": "uuid-here",
      "name": "John Doe",
      "email": "john@example.com",
      "payment_status": "paid",
      "payment_id": "PS_123456",
      "activated": true,
      "linkedin_cookie_set": true,
      "created_at": "2026-02-15T10:00:00Z",
      "activated_at": "2026-02-15T12:00:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_users": 250,
    "per_page": 50
  }
}
```

**cURL Example:**
```bash
curl -X GET "https://contentscrapingserver.site/api/admin/users?payment_status=paid&page=1&limit=25" \
  -H "Authorization: Bearer <admin_token>"
```

---

### GET /api/admin/users/:id

Get single user details including API keys.

**Rate Limit:** 60 requests per hour

**Headers:**
```
Authorization: Bearer <admin_token>
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | User ID |

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "user_id": "uuid-here",
    "name": "John Doe",
    "email": "john@example.com",
    "payment_status": "paid",
    "payment_id": "PS_123456",
    "activated": true,
    "activated_at": "2026-02-15T12:00:00Z",
    "linkedin_cookie_set": true,
    "is_active": true,
    "signup_date": "2026-02-15T10:00:00Z",
    "created_at": "2026-02-15T10:00:00Z",
    "api_keys": [
      {
        "key_id": "key-uuid",
        "key_prefix": "sk_live_abc123",
        "is_active": true,
        "created_at": "2026-02-15T12:00:00Z"
      }
    ]
  }
}
```

**Error Responses:**
- `404` - User not found

**cURL Example:**
```bash
curl -X GET https://contentscrapingserver.site/api/admin/users/<user_id> \
  -H "Authorization: Bearer <admin_token>"
```

---

### POST /api/admin/users/:id/activate

Manually activate a user account.

**Rate Limit:** 60 requests per hour

**Headers:**
```
Authorization: Bearer <admin_token>
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | User ID |

**Success Response (200):**
```json
{
  "success": true,
  "message": "User activated successfully",
  "user": {
    "user_id": "uuid-here",
    "email": "john@example.com",
    "activated": true,
    "activated_at": "2026-02-27T10:00:00Z"
  }
}
```

**Error Responses:**
- `400` - Invalid UUID
- `404` - User not found
- `409` - User is already activated

**cURL Example:**
```bash
curl -X POST https://contentscrapingserver.site/api/admin/users/<user_id>/activate \
  -H "Authorization: Bearer <admin_token>"
```

---

## Payment Management

### GET /api/admin/payments

Get paginated list of users with payment data.

**Rate Limit:** 60 requests per hour

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `payment_status` | string | Filter by 'pending' or 'paid' |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 50, max: 100) |

**Success Response (200):**
```json
{
  "success": true,
  "payments": [
    {
      "user_id": "uuid-here",
      "name": "John Doe",
      "email": "john@example.com",
      "payment_status": "paid",
      "payment_id": "PS_123456",
      "activated": true,
      "activated_at": "2026-02-15T12:00:00Z",
      "signup_date": "2026-02-15T10:00:00Z",
      "created_at": "2026-02-15T10:00:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_payments": 250,
    "per_page": 50
  }
}
```

**cURL Example:**
```bash
curl -X GET "https://contentscrapingserver.site/api/admin/payments?payment_status=pending" \
  -H "Authorization: Bearer <admin_token>"
```

---

### GET /api/admin/payments/:id

Get payment details for a specific user.

**Rate Limit:** 60 requests per hour

**Headers:**
```
Authorization: Bearer <admin_token>
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | User ID |

**Success Response (200):**
```json
{
  "success": true,
  "payment": {
    "user_id": "uuid-here",
    "name": "John Doe",
    "email": "john@example.com",
    "payment_status": "paid",
    "payment_id": "PS_123456",
    "payment_verified_at": "2026-02-15T11:30:00Z",
    "activated": true,
    "activated_at": "2026-02-15T12:00:00Z",
    "signup_date": "2026-02-15T10:00:00Z",
    "created_at": "2026-02-15T10:00:00Z",
    "is_active": true
  }
}
```

**Error Responses:**
- `404` - User not found

**cURL Example:**
```bash
curl -X GET https://contentscrapingserver.site/api/admin/payments/<user_id> \
  -H "Authorization: Bearer <admin_token>"
```

---

### GET /api/admin/orphaned-payments

Get orphaned payments (users with payment_id but not activated) with suggested matches.

**Rate Limit:** 60 requests per hour

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "orphaned_payments": [
    {
      "user_id": "uuid-here",
      "name": "John Doe",
      "email": "john@example.com",
      "payment_id": "PS_123456",
      "payment_status": "pending",
      "created_at": "2026-02-15T10:00:00Z",
      "suggested_matches": [
        {
          "user_id": "other-uuid",
          "name": "Jane Doe",
          "email": "jane@example.com",
          "payment_status": "paid"
        }
      ]
    }
  ],
  "total": 1
}
```

**cURL Example:**
```bash
curl -X GET https://contentscrapingserver.site/api/admin/orphaned-payments \
  -H "Authorization: Bearer <admin_token>"
```

---

### POST /api/admin/link-payment

Manually link a payment to a user and activate their account.

**Rate Limit:** 60 requests per hour

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "user_id": "uuid-here",
  "payment_id": "PS_123456",
  "admin_notes": "Manually linked after customer support request"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment linked and user activated successfully"
}
```

**Error Responses:**
- `400` - Validation failed (invalid UUID or missing payment_id)
- `404` - User not found
- `409` - Payment ID is already linked to another user

**cURL Example:**
```bash
curl -X POST https://contentscrapingserver.site/api/admin/link-payment \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "uuid-here", "payment_id": "PS_123456", "admin_notes": "Manual link"}'
```

---

## Alert Management

### GET /api/admin/alerts

Get paginated list of admin alerts.

**Rate Limit:** 60 requests per hour

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `unresolved` | Filter by 'unresolved' or 'resolved' |
| `alert_type` | string | - | Filter by alert type |
| `severity` | string | - | Filter by 'info', 'warning', or 'error' |
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Results per page (max: 100) |

**Success Response (200):**
```json
{
  "success": true,
  "alerts": [
    {
      "alert_id": "uuid-here",
      "alert_type": "orphaned_payment",
      "severity": "warning",
      "title": "Orphaned Payment Detected",
      "description": "Payment ID used by multiple users",
      "metadata": {"payment_id": "PS_123456"},
      "status": "unresolved",
      "resolved_by": null,
      "resolved_at": null,
      "created_at": "2026-02-15T10:00:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 2,
    "total_alerts": 75,
    "per_page": 50
  }
}
```

**cURL Example:**
```bash
curl -X GET "https://contentscrapingserver.site/api/admin/alerts?status=unresolved&severity=warning" \
  -H "Authorization: Bearer <admin_token>"
```

---

### POST /api/admin/alerts/:id/resolve

Resolve an admin alert.

**Rate Limit:** 60 requests per hour

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Alert ID |

**Request Body:**
```json
{
  "action": "Manually linked payment to correct user",
  "notes": "Customer confirmed via email"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Alert resolved successfully"
}
```

**Error Responses:**
- `400` - Invalid UUID or missing action, or alert is already resolved
- `404` - Alert not found

**cURL Example:**
```bash
curl -X POST https://contentscrapingserver.site/api/admin/alerts/<alert_id>/resolve \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "Linked payment manually", "notes": "Issue resolved"}'
```

---

## System Logs

### GET /api/admin/logs

Get paginated system logs.

**Rate Limit:** 60 requests per hour

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `log_level` | string | Filter by 'info', 'warn', or 'error' |
| `action` | string | Filter by action (e.g., 'admin_login', 'manual_activation') |
| `user_id` | UUID | Filter by user ID |
| `date_from` | ISO 8601 | Start date filter |
| `date_to` | ISO 8601 | End date filter |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 100, max: 200) |

**Success Response (200):**
```json
{
  "success": true,
  "logs": [
    {
      "id": "log-uuid",
      "log_level": "info",
      "service": "admin",
      "action": "admin_login",
      "message": "Admin login: admin@socialbudi.com",
      "user_id": null,
      "admin_id": "admin-uuid",
      "ip_address": "192.168.1.1",
      "created_at": "2026-02-15T10:00:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 10,
    "total_logs": 1000,
    "per_page": 100
  }
}
```

**cURL Example:**
```bash
curl -X GET "https://contentscrapingserver.site/api/admin/logs?log_level=error&date_from=2026-02-01T00:00:00Z" \
  -H "Authorization: Bearer <admin_token>"
```

---

## Error Reference

| Status Code | Description |
|-------------|-------------|
| `400` | Bad Request - Validation failed or invalid parameters |
| `401` | Unauthorized - Missing or invalid token |
| `403` | Forbidden - User token presented to admin endpoint, or admin access required |
| `404` | Not Found - Resource not found |
| `409` | Conflict - Resource already exists or state conflict |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error - Server-side error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /api/admin/login | 5 requests per minute per IP |
| All other admin endpoints | 60 requests per hour per IP |

When rate limited, the API returns:
```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```
