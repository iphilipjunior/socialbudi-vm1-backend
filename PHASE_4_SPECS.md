# SocialBudi Phase 4 Specifications
# User Management Backend + Cookie Extractor Extension

**Phase:** 4 of 10
**Dependencies:** Phase 1 ✅, Phase 2 ✅, Phase 3 ✅
**Duration:** 4-5 days (32-40 hours)
**Status:** 🔄 IN PROGRESS

---

## Phase 4 Objectives

This phase implements user account management and LinkedIn cookie extraction infrastructure.

**What Phase 4 Accomplishes:**
1. User profile management (view/update name, email)
2. Secure password change functionality
3. LinkedIn cookie storage for scraping
4. API key generation and retrieval
5. Cookie Extractor Chrome Extension (separate repository)

**Why This Phase is Critical:**
- Phase 6-8 (scrapers) require API keys for authentication
- LinkedIn scraper requires user's li_at cookie
- Cookie extractor eliminates technical barrier for non-technical users
- Without this infrastructure, users cannot interact with scraping services

---

## API Endpoints to Implement

### GET /api/user/profile

**Purpose:** Retrieve authenticated user's profile data

**Authentication:** JWT token required (Bearer)

**Rate Limiting:** 60 requests per hour per user

**Request Headers:**
```json
{
  "Authorization": "Bearer <jwt_token>"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "full_name": "John Doe",
    "email": "john@example.com",
    "payment_status": "paid",
    "activated": true,
    "activated_at": "2026-02-15T10:30:00Z",
    "linkedin_cookie_set": true,
    "cookie_updated_at": "2026-02-16T09:00:00Z",
    "created_at": "2026-02-14T08:00:00Z"
  }
}
```

**Error Responses:**

401 Unauthorized:
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

**Processing Logic:**
1. Verify JWT token from Authorization header
2. Extract user_id from token payload
3. Fetch user from database by id
4. Exclude sensitive fields (password_hash, linkedin_cookie raw value)
5. Add computed field: linkedin_cookie_set (boolean)
6. Return sanitized user data
7. Log profile access to system_logs

---

### PUT /api/user/profile

**Purpose:** Update user's name and/or email

**Authentication:** JWT token required

**Rate Limiting:** 60 requests per hour per user

**Request:**
```json
{
  "full_name": "Jane Smith",
  "email": "jane.smith@example.com"
}
```

**Validation Rules:**
- full_name: Optional, 2-100 characters, letters/spaces/hyphens only
- email: Optional, valid email format, must be unique, normalized (lowercase, trimmed)
- At least one field must be provided

**Success Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": "uuid-here",
    "full_name": "Jane Smith",
    "email": "jane.smith@example.com"
  }
}
```

**Error Responses:**

400 Bad Request - No fields provided:
```json
{
  "success": false,
  "error": "At least one field (full_name or email) must be provided"
}
```

400 Bad Request - Validation failed:
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

409 Conflict - Email already exists:
```json
{
  "success": false,
  "error": "Email already in use by another account"
}
```

**Processing Logic:**
1. Verify JWT token
2. Validate provided fields
3. If email provided, check uniqueness (exclude current user)
4. Normalize email (lowercase, trim)
5. Update user record
6. Log profile update to system_logs
7. Return updated profile

---

### PUT /api/user/change-password

**Purpose:** Change user's password securely

**Authentication:** JWT token required

**Rate Limiting:** 5 requests per hour per user (STRICT)

**Request:**
```json
{
  "current_password": "old_password_123",
  "new_password": "new_secure_password_456",
  "confirm_password": "new_secure_password_456"
}
```

**Validation Rules:**
- current_password: Required, string
- new_password: Required, minimum 8 characters, must differ from current
- confirm_password: Required, must match new_password exactly

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses:**

401 Unauthorized - Current password incorrect:
```json
{
  "success": false,
  "error": "Current password is incorrect"
}
```

400 Bad Request - Passwords don't match:
```json
{
  "success": false,
  "error": "New password and confirm password do not match"
}
```

400 Bad Request - New password too weak:
```json
{
  "success": false,
  "error": "Password must be at least 8 characters long"
}
```

400 Bad Request - Same as old:
```json
{
  "success": false,
  "error": "New password must be different from current password"
}
```

**Processing Logic:**
1. Verify JWT token
2. Fetch user from database
3. Compare current_password with password_hash using bcrypt.compare()
4. If mismatch → return 401 "Current password is incorrect"
5. Validate new_password matches confirm_password
6. Validate new_password strength (min 8 chars)
7. Verify new_password differs from current_password (compare before hashing)
8. Hash new_password with bcrypt (10 rounds)
9. Update password_hash in database
10. Log password change event to system_logs
11. Return success

**CRITICAL SECURITY RULES:**
- NEVER log passwords (plain text or hashed)
- NEVER return password hashes in responses
- Use bcrypt.compare() for password verification
- Rate limit aggressively (5/hour)

---

### POST /api/user/cookie

**Purpose:** Store user's LinkedIn cookie and user agent for scraping

**Authentication:** JWT token required

**Rate Limiting:** 10 requests per hour per user

**Request:**
```json
{
  "linkedin_cookie": "AQEDARabcdef123456...",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
}
```

**Validation Rules:**
- linkedin_cookie: Required, string, minimum 50 characters
- user_agent: Required, string, must contain "Mozilla"

**Success Response (200):**
```json
{
  "success": true,
  "message": "LinkedIn cookie stored successfully",
  "cookie_updated_at": "2026-02-16T10:30:00Z"
}
```

**Error Responses:**

400 Bad Request - Invalid cookie:
```json
{
  "success": false,
  "error": "Invalid LinkedIn cookie format (minimum 50 characters required)"
}
```

400 Bad Request - Invalid user agent:
```json
{
  "success": false,
  "error": "Invalid user agent format"
}
```

**Processing Logic:**
1. Verify JWT token
2. Validate linkedin_cookie (min 50 chars)
3. Validate user_agent (contains "Mozilla")
4. Update users table:
   - linkedin_cookie = input.linkedin_cookie
   - linkedin_user_agent = input.user_agent
   - cookie_updated_at = NOW()
5. Log cookie update to system_logs (DO NOT log cookie value)
6. Return success with timestamp

**SECURITY NOTES:**
- Cookie stored in plain text (required for scraping)
- DO NOT log cookie value in system_logs
- Only log "LinkedIn cookie updated for user {user_id}"

---

### GET /api/user/api-keys

**Purpose:** Retrieve all API keys for authenticated user

**Authentication:** JWT token required

**Rate Limiting:** 60 requests per hour per user

**Request Headers:**
```json
{
  "Authorization": "Bearer <jwt_token>"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "api_keys": [
    {
      "id": "uuid-1",
      "service": "linkedin",
      "key_name": "LinkedIn API Key",
      "api_key": "a3f5c9b2e1d4f7a8c6e2b9d1f3a7c5e8b4d1f6a9c2e5b7d3f1a8c4e6b2d9f5a1c7",
      "is_active": true,
      "last_used_at": null,
      "created_at": "2026-02-15T10:00:00Z"
    },
    {
      "id": "uuid-2",
      "service": "ytdlp",
      "key_name": "YouTube API Key",
      "api_key": "b7e3f1c5a9d2e6b8f4a1c7e9b3d5f2a6c8e4b1f7a9c2e5b3d1f6a8c4e2b9f5a7c1",
      "is_active": true,
      "last_used_at": "2026-02-16T09:15:00Z",
      "created_at": "2026-02-15T10:00:00Z"
    },
    {
      "id": "uuid-3",
      "service": "instagram",
      "key_name": "Instagram API Key",
      "api_key": "c1e5f9a3d7b2e6f8a4c1e9b5d3f7a2c6e8b4f1a9c5e2b7d3f6a8c1e4b9f2a5c7e1",
      "is_active": true,
      "last_used_at": null,
      "created_at": "2026-02-15T10:00:00Z"
    },
    {
      "id": "uuid-4",
      "service": "enrichment",
      "key_name": "Email Enrichment API Key",
      "api_key": "d9f2a6c1e5b8d3f7a2c6e9b4f1a5c8e2b7d4f9a3c6e1b5d8f2a7c4e9b1f6a3c5e8",
      "is_active": true,
      "last_used_at": null,
      "created_at": "2026-02-15T10:00:00Z"
    },
    {
      "id": "uuid-5",
      "service": "all",
      "key_name": "Master API Key",
      "api_key": "e5b9f3a7c2e6d1f8a4c9e2b6f4a1c7e9b3d5f2a8c6e1b4f7a9c3e5b2d6f1a8c4e9",
      "is_active": true,
      "last_used_at": null,
      "created_at": "2026-02-15T10:00:00Z"
    }
  ]
}
```

**Error Responses:**

401 Unauthorized:
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

404 Not Found - No keys exist:
```json
{
  "success": false,
  "error": "No API keys found",
  "message": "API keys should have been generated during activation. Please contact support."
}
```

**Processing Logic:**
1. Verify JWT token
2. Extract user_id from token
3. Query api_keys table WHERE user_id = user_id
4. If no keys found AND user is activated → this is an error state (keys should exist)
5. Return all keys with full details
6. Do NOT filter by is_active (show all keys, frontend decides what to display)

---

## API Key Generation Service

**Service:** `src/services/apiKeyService.js`

**Function:** `generateAPIKeys(userId)`

**Purpose:** Generate 5 unique API keys for a newly activated user

**Input:**
- userId (uuid) - The user's ID

**Output:**
```javascript
{
  success: true,
  api_keys: [
    { service: 'linkedin', api_key: 'abc123...', key_name: 'LinkedIn API Key' },
    { service: 'ytdlp', api_key: 'def456...', key_name: 'YouTube API Key' },
    { service: 'instagram', api_key: 'ghi789...', key_name: 'Instagram API Key' },
    { service: 'enrichment', api_key: 'jkl012...', key_name: 'Email Enrichment API Key' },
    { service: 'all', api_key: 'mno345...', key_name: 'Master API Key' }
  ]
}
```

**API Key Format:**
```javascript
const crypto = require('crypto');
const apiKey = crypto.randomBytes(32).toString('hex');
// Example: a3f5c9b2e1d4f7a8c6e2b9d1f3a7c5e8b4d1f6a9c2e5b7d3f1a8c4e6b2d9f5a1c7
// Length: exactly 64 characters (32 bytes * 2 hex chars per byte)
```

**Database Insertion:**
For each service ['linkedin', 'ytdlp', 'instagram', 'enrichment', 'all']:
```javascript
{
  user_id: userId,
  api_key: crypto.randomBytes(32).toString('hex'),
  service: service,
  key_name: getKeyName(service),
  is_active: true,
  last_used_at: null,
  expires_at: null,
  created_at: NOW()
}
```

**Key Names Mapping:**
```javascript
const KEY_NAMES = {
  'linkedin': 'LinkedIn API Key',
  'ytdlp': 'YouTube API Key',
  'instagram': 'Instagram API Key',
  'enrichment': 'Email Enrichment API Key',
  'all': 'Master API Key'
};
```

**When to Call This Function:**
- During user activation (POST /api/auth/activate) - check if keys already exist first
- If keys don't exist for an activated user, generate them

**Error Handling:**
- If user_id doesn't exist → throw error
- If keys already exist for user → return existing keys (do NOT regenerate)
- If database insert fails → throw error and rollback

---

## Validation & Middleware

### Validation Rules

Add to `src/middleware/validation.js`:

**validateProfileUpdate:**
```javascript
{
  full_name: {
    optional: true,
    isLength: { min: 2, max: 100 },
    matches: /^[a-zA-Z\s\-']+$/,
    errorMessage: 'Full name must be 2-100 characters, letters/spaces/hyphens only'
  },
  email: {
    optional: true,
    isEmail: true,
    normalizeEmail: true,
    errorMessage: 'Invalid email format'
  }
}
```

**validatePasswordChange:**
```javascript
{
  current_password: {
    exists: true,
    isString: true,
    errorMessage: 'Current password is required'
  },
  new_password: {
    exists: true,
    isLength: { min: 8 },
    errorMessage: 'New password must be at least 8 characters'
  },
  confirm_password: {
    exists: true,
    custom: {
      options: (value, { req }) => value === req.body.new_password,
      errorMessage: 'Passwords do not match'
    }
  }
}
```

**validateCookieStorage:**
```javascript
{
  linkedin_cookie: {
    exists: true,
    isString: true,
    isLength: { min: 50 },
    errorMessage: 'LinkedIn cookie must be at least 50 characters'
  },
  user_agent: {
    exists: true,
    isString: true,
    contains: 'Mozilla',
    errorMessage: 'Invalid user agent format'
  }
}
```

### Rate Limiting

Add to `src/middleware/rateLimiter.js`:

```javascript
const userProfileRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // 60 requests per hour
  message: 'Too many profile requests, please try again later'
});

const passwordChangeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour (STRICT)
  message: 'Too many password change attempts, please try again later'
});

const cookieStorageRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Too many cookie storage requests, please try again later'
});
```

---

## Files to Create

```
src/
├── routes/
│   └── user.js                        # User management routes
├── controllers/
│   └── userController.js              # User management logic
├── services/
│   ├── userService.js                 # User data operations
│   └── apiKeyService.js               # API key generation/retrieval
tests/
├── unit/
│   ├── userService.test.js
│   └── apiKeyService.test.js
└── integration/
    └── user-management.test.js
docs/
└── API_USER_MANAGEMENT.md             # API documentation
```

## Files to Modify

```
src/
├── server.js                          # Register user routes
├── middleware/
│   ├── validation.js                  # Add validation rules
│   └── rateLimiter.js                 # Add rate limiters
README.md                              # Update with Phase 4 info
```

---

## Success Criteria

Phase 4 backend is complete when:

**Endpoints:**
- [ ] GET /api/user/profile returns user data (authenticated)
- [ ] PUT /api/user/profile updates name/email with validation
- [ ] PUT /api/user/change-password changes password securely
- [ ] POST /api/user/cookie stores LinkedIn cookie
- [ ] GET /api/user/api-keys returns all 5 keys
- [ ] All endpoints protected by JWT middleware
- [ ] All inputs validated
- [ ] Rate limiting applied

**Testing:**
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests written (>90% pass rate)
- [ ] All Phase 1-3 tests still passing (no regression)

**Security:**
- [ ] No passwords logged
- [ ] No JWT tokens logged
- [ ] API keys generated unpredictably
- [ ] Email uniqueness enforced

**Documentation:**
- [ ] API documentation complete
- [ ] JSDoc comments on all functions
- [ ] README updated

---

## Implementation Order

1. Create API key service (generateAPIKeys, getAPIKeys)
2. Create user service (getProfile, updateProfile, changePassword, storeCookie)
3. Create user controller (map services to endpoints)
4. Create user routes (define endpoints)
5. Add validation rules to middleware
6. Add rate limiters to middleware
7. Register routes in server.js
8. Write unit tests
9. Write integration tests
10. Create API documentation
11. Update README

---

## Notes for Claude Code

**Database Schema (Actual Supabase):**
- Use `id` (NOT user_id) as primary key in users table
- Use `full_name` (NOT name) in users table
- Use `service` (NOT service_name) in api_keys table
- All timestamps are `timestamptz` type
- Foreign key: api_keys.user_id → users.id

**Critical Security:**
- NEVER log passwords (plain or hashed)
- NEVER log JWT tokens
- NEVER log LinkedIn cookie values
- Use bcrypt.compare() for password verification
- Use crypto.randomBytes() for API key generation

**Error Handling:**
- Always use try-catch for async operations
- Always log errors with context
- Never expose database errors to users
- Return meaningful error messages

**Testing:**
- Test all happy paths
- Test all error paths
- Test validation rules
- Test authentication failures
- Test rate limiting

---

**End of Phase 4 Specifications**
