# Phase 2: Authentication Backend - Technical Specifications

## Overview
This document defines the exact technical requirements for Phase 2 authentication implementation. All specifications must be followed precisely.

**Phase Duration:** 1 week (40 hours)
**Dependencies:** Phase 1 (Foundation) must be complete
**Deliverables:** Signup, Login, Activation endpoints + JWT system + Tests

---

## Authentication Flow

### User Journey States
1. **New User** → Signup → `payment_status: 'pending'` → Redirect to /waiting-payment
2. **Paid User** → Login → `payment_status: 'paid', activated: false` → Redirect to /activate
3. **Activated User** → Login → `payment_status: 'paid', activated: true` → Return JWT + Redirect to /dashboard

---

## API Endpoints Specifications

### 1. POST /api/auth/signup

**Purpose:** Create new user account with pending payment status

**Authentication:** None required
**Rate Limit:** 5 requests per hour per IP address

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Validation Rules:**
- `name`: Required, string, 2-100 characters, trimmed
- `email`: Required, valid email format, normalized (lowercase), unique in database
- `password`: Required, minimum 8 characters, must contain:
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "next_action": "open_payment_modal"
}
```

**Error Responses:**

*Validation Error (400 Bad Request):*
```json
{
  "success": false,
  "error": "Validation failed",
  "message": "Password must contain at least one uppercase letter, one lowercase letter, and one number"
}
```

*Duplicate Email (409 Conflict):*
```json
{
  "success": false,
  "error": "Email already exists",
  "message": "An account with this email already exists"
}
```

**Database Operations:**
1. Check if email exists in `users` table
2. Hash password with bcrypt (10 salt rounds)
3. Insert new user:
```sql
INSERT INTO users (name, email, password_hash, payment_status, activated)
VALUES ('John Doe', 'user@example.com', '$2b$10$...', 'pending', false)
RETURNING user_id, name, email, created_at;
```
4. Log action to `system_logs`:
```sql
INSERT INTO system_logs (log_level, service, action, message)
VALUES ('info', 'auth', 'user_signup', 'User signed up: user@example.com');
```

**Implementation Notes:**
- Never log the password (plain or hashed)
- Use `password_hash` column, not `password`
- Generate UUID for `user_id` (Supabase does this automatically)
- Set `created_at` timestamp (Supabase does this automatically)

---

### 2. POST /api/auth/login

**Purpose:** Authenticate user and return JWT or redirect based on account state

**Authentication:** None required
**Rate Limit:** 10 requests per minute per IP address

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Validation Rules:**
- `email`: Required, valid email format
- `password`: Required, string

**Success Response - Pending Payment (200 OK):**
```json
{
  "success": true,
  "redirect": "/waiting-payment",
  "message": "Please complete payment to activate your account"
}
```

**Success Response - Paid, Not Activated (200 OK):**
```json
{
  "success": true,
  "redirect": "/activate",
  "message": "Please enter your Payment ID to activate"
}
```

**Success Response - Fully Activated (200 OK):**
```json
{
  "success": true,
  "redirect": "/dashboard",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": "a1b2c3d4-e5f6-...",
    "name": "John Doe",
    "email": "user@example.com"
  }
}
```

**Error Response - Invalid Credentials (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid credentials",
  "message": "The email or password you entered is incorrect"
}
```

**Backend Logic:**
1. Find user by email in `users` table
2. If user not found: Return "Invalid credentials" (do NOT say "User not found")
3. Compare password using `bcrypt.compare(plainPassword, user.password_hash)`
4. If password incorrect: Return "Invalid credentials"
5. Check account state and return appropriate response:
```javascript
if (user.payment_status === 'pending') {
  return { redirect: '/waiting-payment' };
}

if (user.payment_status === 'paid' && user.activated === false) {
  return { redirect: '/activate' };
}

if (user.payment_status === 'paid' && user.activated === true) {
  const token = generateJWT({ user_id, email, role: 'user' });
  return { redirect: '/dashboard', token, user };
}
```

6. Log successful login to `system_logs`
7. Update `last_login` timestamp (optional for Phase 2)

**Security Notes:**
- Never reveal whether email exists or password is wrong
- Always return generic "Invalid credentials" message
- Log failed login attempts for security monitoring

---

### 3. POST /api/auth/activate

**Purpose:** Verify Payment ID and activate user account

**Authentication:** None required (user not fully authenticated yet)
**Rate Limit:** 20 requests per hour per email

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "payment_id": "PS_697b79de46bf0"
}
```

**Validation Rules:**
- `email`: Required, valid email format
- `payment_id`: Required, must match pattern `PS_*` (starts with "PS_")

**Success Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Account activated successfully!",
  "redirect": "/dashboard",
  "user": {
    "user_id": "a1b2c3d4-e5f6-...",
    "name": "John Doe",
    "email": "user@example.com"
  }
}
```

**Error Responses:**

*User Not Found (404 Not Found):*
```json
{
  "success": false,
  "error": "User not found",
  "message": "No account found with this email"
}
```

*Payment Not Completed (400 Bad Request):*
```json
{
  "success": false,
  "error": "Payment not completed",
  "message": "No payment found for this account. Please complete payment first."
}
```

*Invalid Payment ID (400 Bad Request):*
```json
{
  "success": false,
  "error": "Invalid Payment ID",
  "message": "The Payment ID you entered doesn't match our records"
}
```

*Already Activated (400 Bad Request):*
```json
{
  "success": false,
  "error": "Already activated",
  "message": "This account is already activated"
}
```

**Backend Logic:**
1. Find user by email
2. Check `payment_status === 'paid'` (if not, return "Payment not completed")
3. Verify `payment_id` matches database record (if not, return "Invalid Payment ID")
4. Check if already activated (if yes, return "Already activated")
5. Update user record:
```sql
UPDATE users
SET activated = true, activated_at = NOW()
WHERE user_id = 'a1b2c3d4-e5f6-...' AND payment_id = 'PS_697b79de46bf0';
```
6. Generate 5 API keys and insert into `api_keys` table:
```sql
INSERT INTO api_keys (user_id, api_key, service, created_at) VALUES
('a1b2c3d4-e5f6-...', 'sk_live_linkedin_abc123...', 'linkedin', NOW()),
('a1b2c3d4-e5f6-...', 'sk_live_ytdlp_def456...', 'ytdlp', NOW()),
('a1b2c3d4-e5f6-...', 'sk_live_instagram_ghi789...', 'instagram', NOW()),
('a1b2c3d4-e5f6-...', 'sk_live_enrichment_jkl012...', 'enrichment', NOW()),
('a1b2c3d4-e5f6-...', 'sk_live_all_mno345...', 'all', NOW());
```
7. Generate JWT token
8. Log activation to `system_logs`
9. Return success response with token

**API Key Generation Format:**
- Pattern: `sk_live_{service}_{random32chars}`
- Services: linkedin, ytdlp, instagram, enrichment, all
- Random part: Use crypto.randomBytes(16).toString('hex')

---

### 4. GET /api/auth/verify-token

**Purpose:** Check if JWT token is valid

**Authentication:** JWT token required
**Rate Limit:** 60 requests per minute per user

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "valid": true,
  "user": {
    "user_id": "a1b2c3d4-e5f6-...",
    "email": "user@example.com",
    "role": "user"
  }
}
```

**Error Responses:**

*No Token (401 Unauthorized):*
```json
{
  "success": false,
  "valid": false,
  "error": "No token provided"
}
```

*Invalid Token (401 Unauthorized):*
```json
{
  "success": false,
  "valid": false,
  "error": "Invalid token"
}
```

*Expired Token (401 Unauthorized):*
```json
{
  "success": false,
  "valid": false,
  "error": "Token expired"
}
```

**Backend Logic:**
1. Extract token from `Authorization: Bearer {token}` header
2. Verify token using `jwt.verify(token, JWT_SECRET)`
3. If valid, return user info from token payload
4. If invalid/expired, return appropriate error

---

### 5. POST /api/auth/refresh-token

**Purpose:** Generate new JWT token (extends session)

**Authentication:** Valid or recently expired JWT required
**Rate Limit:** 10 requests per hour per user

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Token refreshed successfully"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Cannot refresh token",
  "message": "Token is too old or user no longer exists"
}
```

**Backend Logic:**
1. Extract and decode token (allow recently expired - within 7 days)
2. Verify user still exists in database
3. Verify user is still activated
4. Generate new JWT with same payload
5. Return new token

---

## JWT Service Specifications

### Token Generation

**Function:** `generateToken(payload)`

**Input:**
```javascript
{
  user_id: "a1b2c3d4-e5f6-...",
  email: "user@example.com",
  role: "user"
}
```

**Configuration:**
- Algorithm: HS256
- Secret: `process.env.JWT_SECRET`
- Expiration: 24 hours (`'24h'`)

**Output:**
```
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYTFiMmMzZDQtZTVmNi0uLi4iLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTcwNjYxOTYwMCwiZXhwIjoxNzA2NzA2MDAwfQ.signature"
```

**Implementation:**
```javascript
const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '24h'
  });
};
```

### Token Verification

**Function:** `verifyToken(token)`

**Input:** JWT token string

**Success Output:**
```javascript
{
  user_id: "a1b2c3d4-e5f6-...",
  email: "user@example.com",
  role: "user",
  iat: 1706619600,
  exp: 1706706000
}
```

**Error:** Throws error if invalid/expired

**Implementation:**
```javascript
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    throw new Error('Invalid token');
  }
};
```

---

## Password Utilities Specifications

### Hash Password

**Function:** `hashPassword(plainPassword)`

**Configuration:**
- Salt rounds: 10

**Input:** `"SecurePassword123!"`
**Output:** `"$2b$10$N9qo8uLOickgx2ZMRZoMye..."`

**Implementation:**
```javascript
const bcrypt = require('bcrypt');

const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  return await bcrypt.hash(plainPassword, saltRounds);
};
```

### Compare Password

**Function:** `comparePassword(plainPassword, hash)`

**Input:**
- Plain: `"SecurePassword123!"`
- Hash: `"$2b$10$N9qo8uLOickgx2ZMRZoMye..."`

**Output:** `true` or `false`

**Implementation:**
```javascript
const comparePassword = async (plainPassword, hash) => {
  return await bcrypt.compare(plainPassword, hash);
};
```

---

## Auth Middleware Specification

**Function:** `authMiddleware(req, res, next)`

**Purpose:** Verify JWT on protected routes and attach user to request

**Logic:**
1. Extract token from `Authorization: Bearer {token}` header
2. If no token: Return 401 "No token provided"
3. Verify token using `verifyToken()`
4. If invalid: Return 401 "Invalid token"
5. If expired: Return 401 "Token expired"
6. If valid: Attach decoded user to `req.user` and call `next()`

**Implementation:**
```javascript
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);

    req.user = decoded; // Attach user to request
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err.message
    });
  }
};
```

---

## Validation Specifications

### Signup Validation
```javascript
const { body } = require('express-validator');

const signupValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number')
];
```

### Login Validation
```javascript
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];
```

### Activation Validation
```javascript
const activationValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),

  body('payment_id')
    .matches(/^PS_/)
    .withMessage('Invalid Payment ID format (must start with PS_)')
];
```

---

## Rate Limiting Specifications

### Signup Endpoint
- Window: 1 hour
- Max requests: 5 per IP
- Message: "Too many signup attempts. Please try again in 1 hour."
```javascript
const signupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many signup attempts. Please try again in 1 hour.',
  standardHeaders: true,
  legacyHeaders: false
});
```

### Login Endpoint
- Window: 1 minute
- Max requests: 10 per IP
- Message: "Too many login attempts. Please try again in 1 minute."
```javascript
const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many login attempts. Please try again in 1 minute.'
});
```

### Activation Endpoint
- Window: 1 hour
- Max requests: 20 per email (use email as key)
- Message: "Too many activation attempts. Please try again in 1 hour."
```javascript
const activationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.body.email,
  message: 'Too many activation attempts. Please try again in 1 hour.'
});
```

---

## Testing Requirements

### Unit Tests Required
- `jwtService.generateToken()` - generates valid tokens
- `jwtService.verifyToken()` - verifies valid tokens, rejects invalid
- `passwordUtils.hashPassword()` - hashes passwords correctly
- `passwordUtils.comparePassword()` - compares passwords correctly
- `authMiddleware()` - blocks requests without token, allows with valid token

### Integration Tests Required
- POST /api/auth/signup - creates user, rejects duplicates, validates input
- POST /api/auth/login - returns correct redirect based on account state
- POST /api/auth/activate - activates account, generates API keys
- GET /api/auth/verify-token - verifies valid tokens
- POST /api/auth/refresh-token - issues new tokens

### Edge Cases to Test
- Signup with existing email
- Login with wrong password
- Login with non-existent email
- Activate with invalid Payment ID
- Activate already activated account
- Access protected route without token
- Access protected route with expired token
- Rate limiter blocks after limit exceeded

---

## Success Criteria

Phase 2 is complete when ALL of the following are verified:

**Functionality:**
- [ ] Signup creates users with hashed passwords
- [ ] Duplicate emails are rejected
- [ ] Login returns correct redirect for all 3 account states
- [ ] Activation requires valid Payment ID
- [ ] Activation generates exactly 5 API keys
- [ ] JWT tokens expire after 24 hours
- [ ] Auth middleware blocks invalid tokens
- [ ] Token refresh works for recently expired tokens

**Security:**
- [ ] Passwords hashed with bcrypt (10 rounds)
- [ ] No passwords in logs (plain or hashed)
- [ ] JWT secret from environment variable
- [ ] Error messages don't leak info ("Invalid credentials" not "User not found")
- [ ] Rate limiting active on all endpoints
- [ ] HTTPS enforced (Nginx handles this)

**Code Quality:**
- [ ] All functions have JSDoc comments
- [ ] All code follows CLAUDE_CODE_PROMPT.md standards
- [ ] No hardcoded secrets
- [ ] Proper error handling in all functions
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Test coverage >80%

**Deployment:**
- [ ] Code committed to GitHub
- [ ] All tests pass in repository
- [ ] deploy.sh script works
- [ ] Application runs on VM1 without errors
- [ ] All manual curl tests pass

---

## Notes for Implementation

**Database Schema (already exists from Phase 1):**
- `users` table has: user_id, name, email, password_hash, payment_status, payment_id, activated, activated_at, created_at, last_login
- `api_keys` table has: key_id, user_id, api_key, service, created_at, last_used
- `system_logs` table has: log_id, log_level, service, action, message, created_at

**Environment Variables (already in .env on VM1):**
- JWT_SECRET - already set
- SUPABASE_URL - already set
- SUPABASE_SERVICE_KEY - already set

**Phase 3 Dependencies:**
- Payment ID will come from n8n webhook in Phase 3
- For Phase 2 testing, manually set payment_id in Supabase

---

**End of Specifications**
