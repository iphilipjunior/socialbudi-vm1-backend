# User Management API Documentation

## Overview

The User Management API allows authenticated users to manage their profile, change passwords, store LinkedIn cookies for scraping, and retrieve API keys for service access.

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

**Base URL:** `https://contentscrapingserver.site`

---

## Authentication

All endpoints in this API require a valid JWT token obtained from the authentication endpoints.

**Header Format:**
```
Authorization: Bearer <your-jwt-token>
```

**Getting a Token:** See [Authentication API Documentation](API_AUTH.md) for login and token generation.

---

## Rate Limiting

Rate limits are applied per IP address:

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| GET /api/user/profile | 60 requests | 1 hour |
| PUT /api/user/profile | 60 requests | 1 hour |
| PUT /api/user/change-password | 5 requests | 1 hour |
| POST /api/user/cookie | 10 requests | 1 hour |
| GET /api/user/api-keys | 60 requests | 1 hour |

When rate limited, the API returns `429 Too Many Requests`.

**Rate Limit Headers:**

```http
RateLimit-Limit: 60
RateLimit-Remaining: 59
RateLimit-Reset: 1706619660
```

---

## Common Response Format

### Success Response

```json
{
  "success": true,
  "message": "Optional success message",
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message"
}
```

---

## HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Validation failed or invalid input |
| 401 | Unauthorized | Missing or invalid token, wrong password |
| 404 | Not Found | Resource not found (e.g., API keys missing) |
| 409 | Conflict | Email already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Endpoints

### 1. GET /api/user/profile

Get the current user's profile information.

**Authentication:** Required

**Rate Limit:** 60 requests/hour

**Request:**

```bash
curl -X GET https://contentscrapingserver.site/api/user/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**

```json
{
  "success": true,
  "user": {
    "id": "f34d5168-ba67-40d5-82bd-8f01a8d3f801",
    "full_name": "John Doe",
    "email": "john@example.com",
    "payment_status": "paid",
    "activated": true,
    "activated_at": "2026-02-20T08:20:34+00:00",
    "linkedin_cookie_set": false,
    "cookie_updated_at": null,
    "created_at": "2026-02-20T08:14:25.111+00:00"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | User's unique identifier (UUID) |
| full_name | string | User's full name |
| email | string | User's email address |
| payment_status | string | Payment status (`pending` or `paid`) |
| activated | boolean | Whether account is activated |
| activated_at | string | When account was activated (ISO 8601) |
| linkedin_cookie_set | boolean | Whether LinkedIn cookie is stored |
| cookie_updated_at | string | When LinkedIn cookie was last updated |
| created_at | string | Account creation timestamp (ISO 8601) |

**Security Notes:**
- Password hash is never returned
- Raw LinkedIn cookie value is never exposed (only boolean flag)

**Error Responses:**

**401 Unauthorized (No token):**

```json
{
  "success": false,
  "error": "No token provided"
}
```

**401 Unauthorized (Invalid token):**

```json
{
  "success": false,
  "error": "Invalid token"
}
```

---

### 2. PUT /api/user/profile

Update the current user's profile information.

**Authentication:** Required

**Rate Limit:** 60 requests/hour

**Request Body:**

```json
{
  "full_name": "Jane Doe",
  "email": "jane@example.com"
}
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| full_name | Optional | New full name (2-100 chars, letters/spaces/hyphens/apostrophes only) |
| email | Optional | New email address (must be unique) |

**Note:** At least one field must be provided.

**Request:**

```bash
curl -X PUT https://contentscrapingserver.site/api/user/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Doe"
  }'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "f34d5168-ba67-40d5-82bd-8f01a8d3f801",
    "full_name": "Jane Doe",
    "email": "john@example.com",
    "payment_status": "paid",
    "activated": true,
    "activated_at": "2026-02-20T08:20:34+00:00",
    "linkedin_cookie_set": false,
    "cookie_updated_at": null,
    "created_at": "2026-02-20T08:14:25.111+00:00"
  }
}
```

**Error Responses:**

**400 Bad Request (No fields provided):**

```json
{
  "success": false,
  "error": "At least one field (full_name or email) must be provided"
}
```

**400 Bad Request (Validation failed):**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "full_name",
      "message": "Full name must be between 2 and 100 characters"
    }
  ]
}
```

**409 Conflict (Email already exists):**

```json
{
  "success": false,
  "error": "Email already in use by another account"
}
```

---

### 3. PUT /api/user/change-password

Change the current user's password.

**Authentication:** Required

**Rate Limit:** 5 requests/hour (STRICT)

**Request Body:**

```json
{
  "current_password": "OldPassword123",
  "new_password": "NewPassword456",
  "confirm_password": "NewPassword456"
}
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| current_password | Yes | Current password for verification |
| new_password | Yes | New password (min 8 characters) |
| confirm_password | Yes | Must match new_password |

**Request:**

```bash
curl -X PUT https://contentscrapingserver.site/api/user/change-password \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "OldPassword123",
    "new_password": "NewPassword456",
    "confirm_password": "NewPassword456"
  }'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses:**

**400 Bad Request (Passwords don't match):**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "confirm_password",
      "message": "Passwords must match"
    }
  ]
}
```

**400 Bad Request (New password same as current):**

```json
{
  "success": false,
  "error": "New password must be different from current password"
}
```

**401 Unauthorized (Wrong current password):**

```json
{
  "success": false,
  "error": "Current password is incorrect"
}
```

**429 Too Many Requests (Rate limited):**

```json
{
  "success": false,
  "error": "Too many password change attempts",
  "message": "Too many password change attempts, please try again later"
}
```

---

### 4. POST /api/user/cookie

Store LinkedIn authentication cookie for scraping services.

**Authentication:** Required

**Rate Limit:** 10 requests/hour

**Request Body:**

```json
{
  "linkedin_cookie": "AQEDARabcdef123456789012345678901234567890123456789012345",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| linkedin_cookie | Yes | LinkedIn li_at cookie value (min 50 chars) |
| user_agent | Yes | Browser user agent string (must contain "Mozilla") |

**Request:**

```bash
curl -X POST https://contentscrapingserver.site/api/user/cookie \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedin_cookie": "AQEDARabcdef123456789012345678901234567890123456789012345",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  }'
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "LinkedIn cookie stored successfully",
  "cookie_updated_at": "2026-02-20T09:30:15.123Z"
}
```

**Error Responses:**

**400 Bad Request (Validation failed):**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "linkedin_cookie",
      "message": "LinkedIn cookie must be at least 50 characters"
    }
  ]
}
```

**400 Bad Request (Invalid user agent):**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "user_agent",
      "message": "User agent must contain Mozilla"
    }
  ]
}
```

**429 Too Many Requests (Rate limited):**

```json
{
  "success": false,
  "error": "Too many cookie storage requests",
  "message": "Too many cookie storage requests, please try again later"
}
```

---

### 5. GET /api/user/api-keys

Retrieve all API keys for the authenticated user.

**Authentication:** Required

**Rate Limit:** 60 requests/hour

**Request:**

```bash
curl -X GET https://contentscrapingserver.site/api/user/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**

```json
{
  "success": true,
  "api_keys": [
    {
      "id": "key-uuid-1",
      "service": "all",
      "key_name": "Master API Key",
      "api_key": "a3f5c9b2e1d4f7a8c6e2b9d1f3a7c5e8b4d1f6a9c2e5b7d3f1a8c4e6b2d9f5a1c7",
      "is_active": true,
      "last_used_at": null,
      "created_at": "2026-02-20T08:20:34+00:00"
    },
    {
      "id": "key-uuid-2",
      "service": "enrichment",
      "key_name": "Email Enrichment API Key",
      "api_key": "b4d2f8c9e3a7d1f9c8b6e4d2f7a9c3e8b5d1f9a2c6e8b7d4f2a9c5e7b3d1f8a4c9",
      "is_active": true,
      "last_used_at": null,
      "created_at": "2026-02-20T08:20:34+00:00"
    },
    {
      "id": "key-uuid-3",
      "service": "instagram",
      "key_name": "Instagram API Key",
      "api_key": "c5e3f9d1a8b7e4d2f9c6b8e5d3f1a9c7b4d2f8a3c9e7b6d4f3a1c8e6b5d2f9a7c4",
      "is_active": true,
      "last_used_at": "2026-02-20T10:15:22+00:00",
      "created_at": "2026-02-20T08:20:34+00:00"
    },
    {
      "id": "key-uuid-4",
      "service": "linkedin",
      "key_name": "LinkedIn API Key",
      "api_key": "d6f4a1e2b9c8d5f3a7b1e6d4c9f2a8c7b5d3f1a9e6c8b7d4f2a1c9e7b6d3f8a5c1",
      "is_active": true,
      "last_used_at": "2026-02-20T09:45:10+00:00",
      "created_at": "2026-02-20T08:20:34+00:00"
    },
    {
      "id": "key-uuid-5",
      "service": "ytdlp",
      "key_name": "YouTube API Key",
      "api_key": "e7a5b2f3c1d9e6a4b8f2d7c1e9a6b5d4f3a2c8a7e6d5f4b3a1c9a8e7d6f5b4c2a1",
      "is_active": true,
      "last_used_at": null,
      "created_at": "2026-02-20T08:20:34+00:00"
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique key identifier (UUID) |
| service | string | Service name (`all`, `linkedin`, `ytdlp`, `instagram`, `enrichment`) |
| key_name | string | Human-readable key name |
| api_key | string | 64-character hex API key |
| is_active | boolean | Whether key is active |
| last_used_at | string | Last time key was used (null if never used) |
| created_at | string | When key was created (ISO 8601) |

**Error Responses:**

**200 OK (Empty array for non-activated users):**

```json
{
  "success": true,
  "api_keys": []
}
```

**404 Not Found (Activated user with no keys - error state):**

```json
{
  "success": false,
  "error": "No API keys found",
  "message": "API keys should have been generated during activation. Please contact support."
}
```

---

## Usage Examples

### Complete User Profile Update Flow

```bash
# 1. Login to get token
TOKEN=$(curl -s -X POST https://contentscrapingserver.site/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123"}' \
  | jq -r '.token')

# 2. Get current profile
curl -X GET https://contentscrapingserver.site/api/user/profile \
  -H "Authorization: Bearer $TOKEN"

# 3. Update profile
curl -X PUT https://contentscrapingserver.site/api/user/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"New Name"}'

# 4. Change password
curl -X PUT https://contentscrapingserver.site/api/user/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password":"Password123",
    "new_password":"NewPassword456",
    "confirm_password":"NewPassword456"
  }'

# 5. Store LinkedIn cookie
curl -X POST https://contentscrapingserver.site/api/user/cookie \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "linkedin_cookie":"AQEDARabcdef123456789012345678901234567890123456789012345",
    "user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  }'

# 6. Get API keys
curl -X GET https://contentscrapingserver.site/api/user/api-keys \
  -H "Authorization: Bearer $TOKEN"
```

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

const BASE_URL = 'https://contentscrapingserver.site/api';

// Login and get token
const login = async (email, password) => {
  const response = await axios.post(`${BASE_URL}/auth/login`, {
    email,
    password
  });
  return response.data.token;
};

// Get user profile
const getProfile = async (token) => {
  const response = await axios.get(`${BASE_URL}/user/profile`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data.user;
};

// Update profile
const updateProfile = async (token, updates) => {
  const response = await axios.put(`${BASE_URL}/user/profile`, updates, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data.user;
};

// Change password
const changePassword = async (token, currentPassword, newPassword) => {
  const response = await axios.put(`${BASE_URL}/user/change-password`, {
    current_password: currentPassword,
    new_password: newPassword,
    confirm_password: newPassword
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Store LinkedIn cookie
const storeCookie = async (token, cookie, userAgent) => {
  const response = await axios.post(`${BASE_URL}/user/cookie`, {
    linkedin_cookie: cookie,
    user_agent: userAgent
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Get API keys
const getApiKeys = async (token) => {
  const response = await axios.get(`${BASE_URL}/user/api-keys`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data.api_keys;
};
```

---

## Security Considerations

### What's Protected

- All endpoints require valid JWT authentication
- Passwords are verified before changes
- Email uniqueness is enforced
- Sensitive data (password_hash, raw cookies) never exposed in responses

### What's Logged

- All requests (method, path, IP)
- Authentication failures
- Validation errors
- Rate limit violations

### What's NOT Logged (Security)

- Passwords (plain or hashed)
- JWT tokens
- LinkedIn cookie values
- API key values

---

## Related Documentation

- [Authentication API](API_AUTH.md) - Login, signup, activation
- [Payment API](API_PAYMENT.md) - Payment processing
- [Main README](../README.md) - Project overview

---

**Last Updated:** February 20, 2026
**Version:** 1.0
**Status:** Production
