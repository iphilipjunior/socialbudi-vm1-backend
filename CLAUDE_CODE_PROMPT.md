# Claude Code Development Rules - SocialBudi VM1 Backend

## Project Context
You are building the authentication backend for SocialBudi, a lead generation platform that scrapes LinkedIn, Instagram, and YouTube data. This VM1 backend serves as the master server handling user authentication, payment verification, API key management, and request routing to scraper services.

Refer to the implementation documentation in project sources titled:
"SOCIALBUDI PLATFORM - COMPLETE IMPLEMENTATION DOCUMENTATION"

## Phase Status
- ✅ Phase 1: Foundation & Database Setup - COMPLETED
- ✅ Phase 2: Authentication Backend - COMPLETED
- ✅ Phase 3: Payment Backend & n8n Workflow - COMPLETED
- ✅ Phase 4: User Management Backend + Cookie Extractor - COMPLETED
- 🔄 Phase 5: Admin Backend - IN PROGRESS

## Phase 5: Admin Backend (CURRENT)

**Status:** IN PROGRESS
**Repository:** socialbudi-vm1-backend
**Depends on:** Phases 1-4 (all complete)

### Purpose
Build the complete admin control panel backend. Admins can log in with a separate JWT, manage users, view/resolve payments, handle orphaned payments, resolve alerts, and view system logs.

### Critical Rules for Phase 5
- Admin JWT uses ADMIN_JWT_SECRET env var (NOT JWT_SECRET — these must be separate)
- Admin JWT payload: { admin_id, email, role }
- User JWT payload uses user_id — adminAuth.js middleware must REJECT tokens where payload.user_id exists (not admin tokens)
- admin_users table uses admin_id as primary key (NOT id)
- All admin actions must be logged to system_logs table
- Rate limit: 5 req/min on login, 60 req/hour on all other admin endpoints
- NEVER log passwords, JWT tokens, or sensitive user data

### Database Schema Reference

**admin_users table:**
- admin_id (UUID, primary key)
- email (TEXT, unique)
- password_hash (TEXT)
- name (TEXT)
- role (TEXT) — 'admin' or 'superadmin'
- is_active (BOOLEAN)
- last_login (TIMESTAMP)
- created_by (UUID, FK to admin_users.admin_id)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- permissions (JSONB)

**admin_alerts table:**
- alert_id (UUID, primary key)
- alert_type (TEXT) — 'orphaned_payment', 'duplicate_payment', 'new_signup', 'system_error'
- severity (TEXT) — 'info', 'warning', 'error'
- title (TEXT)
- description (TEXT)
- metadata (JSONB)
- status (TEXT) — 'unresolved' or 'resolved'
- resolved_by (UUID, FK to admin_users.admin_id)
- resolved_at (TIMESTAMP)
- created_at (TIMESTAMP)

**system_logs table (reminder of actual column names):**
- id (UUID, primary key)
- log_level (NOT log_type)
- service (TEXT)
- action (NOT details)
- message (TEXT)
- user_id (UUID, nullable)
- admin_id (UUID, nullable)
- ip_address (TEXT)
- user_agent (TEXT)
- request_data (JSONB)
- response_data (JSONB)
- error_stack (TEXT)
- created_at (TIMESTAMP)

**users table reminders:**
- id (NOT user_id) — primary key
- full_name (NOT name)
- Map in responses: id → user_id, full_name → name

### Endpoints to Build (10 total + 1 admin login)
- POST /api/admin/login
- GET /api/admin/users
- GET /api/admin/users/:id
- POST /api/admin/users/:id/activate
- GET /api/admin/payments
- GET /api/admin/payments/:id
- GET /api/admin/orphaned-payments
- POST /api/admin/link-payment
- GET /api/admin/alerts
- POST /api/admin/alerts/:id/resolve
- GET /api/admin/logs

### Files to Create (Phase 5)
- src/routes/admin.js
- src/controllers/adminController.js
- src/services/adminService.js
- src/services/adminJwtService.js
- src/middleware/adminAuth.js
- tests/unit/adminService.test.js
- tests/unit/adminJwtService.test.js
- tests/integration/admin.test.js
- docs/API_ADMIN.md
- docs/PHASE_5_COMPLETION_REPORT.md (written at end)

### Files to Modify (Phase 5)
- src/server.js — register /api/admin routes
- src/middleware/validation.js — add admin validators
- src/middleware/rateLimiter.js — add admin rate limiters
- .env.example — add ADMIN_JWT_SECRET entry
- README.md — update with Phase 5 info

### Files to NOT Modify
- src/routes/auth.js, user.js, payment.js, health.js
- src/controllers/authController.js, userController.js, paymentController.js
- src/services/authService.js, userService.js, apiKeyService.js, paymentService.js
- src/middleware/auth.js (user JWT middleware — keep completely separate)

---

## Phase 4: User Management Backend (COMPLETED)

Phase 4 delivered:
- 5 user management endpoints (GET/PUT profile, change-password, cookie, api-keys)
- Chrome extension for LinkedIn cookie extraction (separate repository)
- 88 unit tests passing
- Security audit completed (A rating)
- Full documentation in docs/API_USER_MANAGEMENT.md and docs/PHASE_4_COMPLETION_REPORT.md

---

## Your Role
- Write production-ready code following these specifications
- Follow the tech stack strictly (no substitutions)
- Write comprehensive tests for all code (unit + integration)
- Document all functions with JSDoc comments
- Follow existing code patterns and conventions
- Commit frequently with descriptive messages
- Report blockers immediately if specifications are unclear

## Tech Stack
- **Runtime:** Node.js 20.x
- **Framework:** Express.js 5.x
- **Database:** Supabase (PostgreSQL) via @supabase/supabase-js
- **Authentication:** JWT (jsonwebtoken) + bcrypt
- **Logging:** Winston (already configured)
- **Testing:** Jest
- **Validation:** express-validator
- **Rate Limiting:** express-rate-limit
- **Process Management:** PM2 (deployment only)

## Repository File Structure
```
/var/www/socialbudi-vm1-backend/
├── src/
│   ├── server.js              # Express app entry point
│   ├── config/
│   │   └── supabase.js        # Supabase client (Phase 1) ✅ DONE
│   ├── routes/
│   │   ├── health.js          # Health checks (Phase 1) ✅ DONE
│   │   ├── auth.js            # Auth routes (Phase 2) ✅ DONE
│   │   └── payment.js         # Payment routes (Phase 3) ⬅️ NEW
│   ├── controllers/
│   │   ├── authController.js  # Auth logic (Phase 2) ✅ DONE
│   │   └── paymentController.js  # Payment logic (Phase 3) ⬅️ NEW
│   ├── services/
│   │   ├── jwtService.js      # JWT token operations (Phase 2) ✅ DONE
│   │   ├── paymentService.js  # Payment processing (Phase 3) ⬅️ NEW
│   │   └── orphanedPaymentService.js  # Orphaned detection (Phase 3) ⬅️ NEW
│   ├── middleware/
│   │   ├── errorHandler.js    # Global errors (Phase 1) ✅ DONE
│   │   ├── authMiddleware.js  # JWT verification (Phase 2) ✅ DONE
│   │   ├── rateLimiter.js     # Rate limiting (Phase 2) ✅ DONE
│   │   └── validation.js      # Input validators (Phase 2) ✅ DONE
│   └── utils/
│       ├── logger.js          # Winston logger (Phase 1) ✅ DONE
│       └── passwordUtils.js   # Bcrypt operations (Phase 2) ✅ DONE
├── tests/
│   ├── unit/                  # Unit tests
│   └── integration/           # Integration tests
├── docs/                      # API documentation
├── .env                       # Environment variables (gitignored)
├── .env.example               # Template for .env
├── .gitignore
├── package.json
├── jest.config.js             # Jest test configuration
├── deploy.sh                  # Deployment script
└── README.md
```

## Phase 3 Critical Information

### Payment Webhook Endpoint
- **Route:** POST /api/payment/confirm
- **Purpose:** Receive payment confirmations from Selfany via n8n
- **Authentication:** Webhook signature verification (N8N_WEBHOOK_SECRET)
- **Request Body:** { payment_id, email, amount, currency, status, timestamp, signature }
- **Response:** { success, message, user_id, payment_id }

### Payment Processing Logic
1. Verify webhook signature using HMAC SHA256
2. Find user by email
3. Check for duplicate Payment ID
4. Update user: payment_status='paid', payment_id=value
5. Log transaction to system_logs
6. Return success response

### Payment ID Validation Rules
- Format: Must match regex `PS_[A-Za-z0-9]{3,50}`
- Uniqueness: Cannot be reused by different users
- Ownership: Payment ID must belong to user attempting activation
- Status: User must have payment_status='paid' before activation

### Orphaned Payment Detection
- Definition: Payment exists but no matching user signup
- Detection: Query users with payment_id but mismatched email
- Action: Create entry in duplicate_payments table, create admin alert
- Trigger: Can be manual (GET /api/admin/check-orphaned-payments) or scheduled

### Database Tables Used (Phase 3)
- **users:** Update payment_status and payment_id columns
- **duplicate_payments:** Store duplicate/orphaned payment records
- **system_logs:** Log all payment transactions
- **admin_alerts:** Alert admins about payment issues

### Phase 4 Database Fields (Now Active)

**Users Table - Phase 4 Fields:**
- `linkedin_cookie` (text, nullable) - User's li_at cookie from LinkedIn
- `linkedin_user_agent` (text, nullable) - Browser user agent for scraping
- `cookie_updated_at` (timestamptz, nullable) - When cookie was last updated

**API Keys Table - Phase 4 Usage:**
- `api_key` (text, unique) - 64-character random hex string
- `service` (text) - One of: 'linkedin', 'ytdlp', 'instagram', 'enrichment', 'all'
- `key_name` (text) - Display name for the key
- `is_active` (boolean, default true) - Whether key is currently valid
- `last_used_at` (timestamptz, nullable) - Last time key was used for authentication
- `expires_at` (timestamptz, nullable) - Future: key expiration feature

**API Key Generation Rules:**
- Generate during user activation if keys don't exist
- Create exactly 5 keys per user (one per service)
- Format: `crypto.randomBytes(32).toString('hex')` (64-char hex string)
- Store in plain text (the keys themselves are the secret)
- Each key must be unique across entire database

## Coding Standards

### JavaScript Style
- **ES6+ syntax required**: Use async/await, arrow functions, destructuring, template literals
- **No callbacks**: Always use async/await for asynchronous operations
- **Descriptive variable names**: `userProfile` not `up`, `emailAddress` not `ea`
- **Constants in UPPER_SNAKE_CASE**: `MAX_LOGIN_ATTEMPTS`, `JWT_EXPIRY`
- **Functions in camelCase**: `getUserById`, `validatePassword`
- **Classes in PascalCase**: `AuthController`, `JwtService`

### Error Handling - CRITICAL
Every async function MUST follow this pattern:
```javascript
// CORRECT - Always wrap async operations
const getUserById = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      logger.error(`Failed to fetch user ${userId}:`, error);
      throw new Error('Database query failed');
    }

    return data;
  } catch (err) {
    logger.error(`getUserById error: ${err.message}`, { userId, stack: err.stack });
    throw err; // Re-throw after logging
  }
};

// WRONG - No error handling
const getUserById = async (userId) => {
  const { data } = await supabase.from('users').select('*').eq('user_id', userId).single();
  return data;
};
```

### Logging Standards
Use the existing Winston logger (imported from `../utils/logger.js`):
```javascript
const logger = require('../utils/logger');

// Log levels: error, warn, info, debug
logger.info('User logged in successfully', { userId, email });
logger.error('Authentication failed', { email, reason: 'Invalid password' });
logger.warn('Rate limit approaching', { ip, attempts });
```

**NEVER log sensitive data:**
- Passwords (plain or hashed)
- JWT tokens
- API keys
- Supabase service keys
- User IDs, emails, timestamps are OK

### Database Operations (Supabase)
Always use the existing Supabase client:
```javascript
const supabase = require('../config/supabase');

// Always check for errors
const { data, error } = await supabase
  .from('users')
  .insert({ name, email, password_hash });

if (error) {
  logger.error('Insert failed:', error);
  throw new Error('Failed to create user');
}
```

**Important:**
- The Supabase client uses `service_role` key (bypasses RLS)
- Always use parameterized queries (Supabase handles this)
- Table names: `users`, `api_keys`, `admin_users`, `admin_alerts`, `system_logs`, `scraping_activity`, `duplicate_payments`

### API Response Format
All endpoints must return consistent JSON:
```javascript
// Success response
res.status(200).json({
  success: true,
  data: { /* payload */ },
  message: 'Operation completed successfully'
});

// Error response
res.status(400).json({
  success: false,
  error: 'Validation failed',
  message: 'Email format is invalid'
});
```

### Input Validation
Use express-validator for all inputs:
```javascript
const { body, validationResult } = require('express-validator');

// Validation chain
const signupValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('name').trim().isLength({ min: 2, max: 100 })
];

// Check results in controller
const errors = validationResult(req);
if (!errors.isEmpty()) {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    details: errors.array()
  });
}
```

## Testing Requirements

### Unit Tests
Every service, utility, and middleware MUST have unit tests:
```javascript
// tests/unit/jwtService.test.js
const jwtService = require('../../src/services/jwtService');

describe('jwtService', () => {
  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const payload = { user_id: '123', email: 'test@example.com' };
      const token = jwtService.generateToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should include correct expiration', () => {
      const token = jwtService.generateToken({ user_id: '123' });
      const decoded = jwtService.verifyToken(token);
      expect(decoded.exp).toBeDefined();
    });
  });
});
```

### Integration Tests
Test complete API flows:
```javascript
// tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../src/server');

describe('POST /api/auth/signup', () => {
  it('should create new user with valid data', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123!'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.next_action).toBe('open_payment_modal');
  });
});
```

### Test Coverage
- Aim for >80% coverage on new code
- All happy paths must be tested
- All error conditions must be tested
- Edge cases must be tested

## Commit Message Format
Follow conventional commits:
```
feat: add user signup endpoint
fix: resolve JWT expiration bug
test: add integration tests for login flow
docs: update API documentation
refactor: extract validation logic to middleware
chore: update dependencies
```

**Commit frequency:**
- Commit after each completed feature/function
- Commit before switching tasks
- Never commit broken code
- Never commit secrets or .env files

## Common Patterns

### Express Route Handler
```javascript
// src/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { signupValidation } = require('../middleware/validation');

router.post('/signup', signupValidation, authController.signup);

module.exports = router;
```

### Controller Function
```javascript
// src/controllers/authController.js
const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Business logic here
    const user = await createUser(name, email, password);

    logger.info('User signup successful', { userId: user.user_id });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      next_action: 'open_payment_modal'
    });
  } catch (err) {
    next(err); // Pass to error handler middleware
  }
};

module.exports = { signup };
```

### Middleware Function
```javascript
// src/middleware/authMiddleware.js
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = jwtService.verifyToken(token);
    req.user = decoded; // Attach user to request
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

module.exports = authMiddleware;
```

## Environment Variables
Always use process.env for configuration:
```javascript
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRES_IN || '24h';
const PORT = process.env.PORT || 3000;

// NEVER hardcode secrets:
// const JWT_SECRET = 'my-secret-key-123'; // WRONG
```

## Security Requirements
- Passwords: MUST be hashed with bcrypt (10 rounds)
- JWT tokens: MUST use HS256 algorithm, MUST expire in 24h
- Rate limiting: MUST be applied to all auth endpoints
- Input validation: MUST sanitize and validate ALL inputs
- Error messages: MUST NOT leak system information (e.g., "Invalid credentials" not "User not found")
- HTTPS: Assume HTTPS in production (Nginx handles this)

### Payment Security (Phase 3)
- **Webhook Signatures:** Always verify N8N_WEBHOOK_SECRET signature before processing
- **Payment ID Format:** Strict validation (PS_[A-Za-z0-9]{3,50})
- **Duplicate Prevention:** Check Payment ID uniqueness before storing
- **User Matching:** Payment email must match user email
- **Audit Logging:** Log all payment transactions (success and failure)
- **HTTPS Only:** All payment endpoints require HTTPS
- **No Sensitive Data Logging:** Never log credit card numbers or full payment details

## Performance Guidelines
- Use indexes for database queries (already configured in Supabase)
- Avoid N+1 queries (use joins when possible)
- Use connection pooling (Supabase client handles this)
- Cache frequently accessed data when appropriate

## When Stuck
If specifications are unclear:
1. Check the PHASE_2_SPECS.md file (if exists)
2. Check existing code patterns in the repository
3. Report the blocker with specific question
4. DO NOT make assumptions about business logic

## Success Criteria for Each Task
Before committing, verify:
- [ ] Code follows all style guidelines
- [ ] All functions have JSDoc comments
- [ ] Error handling is comprehensive
- [ ] No sensitive data in logs
- [ ] Tests written and passing
- [ ] No linting errors
- [ ] Commit message follows convention

---

**Remember:** This is production code for a real business. Quality over speed. When in doubt, ask.
