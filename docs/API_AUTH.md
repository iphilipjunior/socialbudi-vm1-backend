# Authentication API Documentation

Base URL: `https://contentscrapingserver.site/api/auth`

All endpoints return JSON with the following structure:

```json
{
  "success": true/false,
  "message": "Human-readable message",
  "data": { ... }
}
```

---

## Endpoints

### 1. POST /signup

**Purpose:** Create a new user account

**Authentication:** None required

**Rate Limit:** 5 requests per hour per IP

**Request:**

```http
POST /api/auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Validation:**
- `name`: 2-100 characters, letters/spaces/hyphens/apostrophes only
- `email`: Valid email format, max 255 characters, unique
- `password`: 8-128 characters, must contain uppercase, lowercase, and number, no spaces

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Account created successfully. Please complete payment to activate.",
  "next_action": "open_payment_modal",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses:**
- `400 Bad Request` - Validation failed
- `409 Conflict` - Email already exists
- `429 Too Many Requests` - Rate limit exceeded

---

### 2. POST /login

**Purpose:** Authenticate user and get JWT token or redirect

**Authentication:** None required

**Rate Limit:** 10 requests per minute per IP

**Request:**

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Success Responses:**

**State 1: Payment Pending (200 OK)**

```json
{
  "success": true,
  "message": "Please complete payment to activate your account",
  "redirect": "/waiting-payment",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**State 2: Paid but Not Activated (200 OK)**

```json
{
  "success": true,
  "message": "Payment received. Please activate your account.",
  "redirect": "/activate",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**State 3: Fully Activated (200 OK)**

```json
{
  "success": true,
  "message": "Login successful",
  "redirect": "/dashboard",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - Invalid credentials
- `429 Too Many Requests` - Rate limit exceeded

---

### 3. POST /activate

**Purpose:** Activate account with Payment ID and receive API keys

**Authentication:** None required

**Rate Limit:** 20 requests per hour per email

**Request:**

```http
POST /api/auth/activate
Content-Type: application/json

{
  "email": "john@example.com",
  "payment_id": "PS_ABC123XYZ"
}
```

**Validation:**
- `payment_id`: Must match pattern `PS_[A-Za-z0-9]{3,50}`

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Account activated successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "api_keys": {
    "linkedin": "a1b2c3d4e5f6...",
    "ytdlp": "f6e5d4c3b2a1...",
    "instagram": "1a2b3c4d5e6f...",
    "enrichment": "6f5e4d3c2b1a...",
    "all": "abcdef123456..."
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid Payment ID format or already activated
- `404 Not Found` - User not found
- `409 Conflict` - Payment ID already used
- `429 Too Many Requests` - Rate limit exceeded

---

### 4. GET /verify-token

**Purpose:** Check if JWT token is still valid

**Authentication:** Required (Bearer token)

**Rate Limit:** None

**Request:**

```http
GET /api/auth/verify-token
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Token is valid",
  "valid": true,
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "role": "user"
  },
  "expires_in_seconds": 82800
}
```

**Error Responses:**
- `401 Unauthorized` - No token, invalid token, or expired token

---

### 5. POST /refresh-token

**Purpose:** Get a new JWT token without re-logging in

**Authentication:** None required (token in body)

**Rate Limit:** None

**Request:**

```http
POST /api/auth/refresh-token
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Token missing or invalid
- `401 Unauthorized` - Token expired more than 7 days ago
- `403 Forbidden` - Account not activated
- `404 Not Found` - User no longer exists

**Note:** Refresh only works for tokens expired within the last 7 days.

---

## JWT Token Details

**Format:** Bearer token in Authorization header

**Expiration:** 24 hours from issuance

**Payload:**

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "role": "user",
  "iat": 1706619600,
  "exp": 1706706000
}
```

**Usage Example:**

```http
GET /api/protected-endpoint
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Rate Limits

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| POST /signup | 5 | 1 hour | IP address |
| POST /login | 10 | 1 minute | IP address |
| POST /activate | 20 | 1 hour | Email address |

**Rate Limit Headers:**

```http
RateLimit-Limit: 10
RateLimit-Remaining: 9
RateLimit-Reset: 1706619660
```

**Rate Limit Exceeded Response (429):**

```json
{
  "success": false,
  "error": "Too many login attempts",
  "message": "Too many login attempts. Please try again in 1 minute."
}
```

---

## Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Validation failed, invalid input |
| 401 | Unauthorized | Invalid credentials, expired token |
| 403 | Forbidden | Account not activated |
| 404 | Not Found | User doesn't exist |
| 409 | Conflict | Duplicate email/payment ID |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error (contact support) |

---

## Testing

**Example cURL commands:**

```bash
# Signup
curl -X POST https://contentscrapingserver.site/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"SecurePass123!"}'

# Login
curl -X POST https://contentscrapingserver.site/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Activate
curl -X POST https://contentscrapingserver.site/api/auth/activate \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","payment_id":"PS_TEST12345"}'

# Verify Token
curl -X GET https://contentscrapingserver.site/api/auth/verify-token \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Refresh Token
curl -X POST https://contentscrapingserver.site/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN_HERE"}'
```

---

## User States

The login endpoint returns different redirects based on user account state:

```
[New User] → Signup → payment_status: 'pending'
                        ↓
                   Login returns: redirect: '/waiting-payment'
                        ↓
[Payment Received] → payment_status: 'paid', activated: false
                        ↓
                   Login returns: redirect: '/activate'
                        ↓
[Activated] → activated: true
                        ↓
                   Login returns: redirect: '/dashboard', token: '...'
```

---

## Security Best Practices

1. **Store tokens securely** - Use httpOnly cookies or secure localStorage
2. **Refresh before expiry** - Implement token refresh logic in your app
3. **Handle 401 errors** - Redirect to login when token is invalid/expired
4. **Don't log tokens** - Never log JWT tokens in client-side code
5. **Use HTTPS only** - All API calls should be over HTTPS
