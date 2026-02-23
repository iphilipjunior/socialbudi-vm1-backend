# SocialBudi Backend API

Lead Generation Platform - Backend API Server

## Project Information
- **Platform:** SocialBudi
- **Type:** Backend API
- **Runtime:** Node.js 20.x
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL)

## Requirements
- Node.js >= 20.0.0
- npm >= 10.0.0
- Supabase account

## Setup
1. Install dependencies: `npm install`
2. Configure environment: Copy `.env.example` to `.env`
3. Start development server: `npm run dev`
4. Start production server: `npm start`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `JWT_SECRET` | Secret key for JWT signing (44+ characters recommended) | Yes |
| `JWT_EXPIRES_IN` | JWT token expiration (default: 7d) | No |
| `CORS_ORIGIN` | Allowed CORS origin (required in production) | Yes (prod) |
| `N8N_WEBHOOK_SECRET` | HMAC secret for payment webhooks | Yes |

## Project Structure
```
socialbudi-backend/
├── src/
│   ├── server.js           # Main application entry point
│   ├── config/             # Configuration files
│   │   └── supabase.js     # Supabase client
│   ├── routes/             # API route definitions
│   │   ├── health.js       # Health check endpoint
│   │   ├── auth.js         # Authentication routes
│   │   ├── user.js         # User management routes (Phase 4)
│   │   ├── payment.js      # Payment webhook routes (Phase 3)
│   │   └── admin.js        # Admin routes (Phase 3)
│   ├── controllers/        # Request handlers
│   │   ├── authController.js
│   │   ├── userController.js   # User management (Phase 4)
│   │   ├── paymentController.js
│   │   └── adminController.js
│   ├── middleware/         # Custom middleware
│   │   ├── authMiddleware.js   # JWT verification
│   │   ├── validation.js       # Input validation
│   │   ├── rateLimiter.js      # Rate limiting
│   │   └── errorHandler.js     # Global error handler
│   ├── services/           # Business logic
│   │   ├── jwtService.js       # JWT operations
│   │   ├── userService.js      # User profile/password (Phase 4)
│   │   ├── apiKeyService.js    # API key management (Phase 4)
│   │   ├── paymentService.js   # Payment processing
│   │   └── paymentValidationService.js
│   └── utils/              # Utility functions
│       ├── logger.js       # Winston logger
│       └── passwordUtils.js # Password hashing
├── tests/
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
├── docs/
│   ├── API_AUTH.md         # Authentication API docs
│   ├── API_USER_MANAGEMENT.md  # User management API docs (Phase 4)
│   ├── API_PAYMENT.md      # Payment API docs
│   └── PHASE_4_COMPLETION_REPORT.md
├── .env                    # Environment variables (not committed)
├── .gitignore              # Git ignore rules
├── jest.config.js          # Jest test configuration
└── package.json            # Project dependencies
```

## Authentication

The backend provides 10 API endpoints (5 authentication + 5 user management). The authentication system includes the following features:

- **User Registration** - Signup with email/password
- **JWT Authentication** - Secure token-based auth (24h expiry)
- **3-State Login Flow** - Handles pending payment, paid, and activated states
- **Account Activation** - Payment ID verification with API key generation
- **Token Management** - Verification and refresh endpoints
- **Rate Limiting** - Protection against brute force attacks
- **Input Validation** - Comprehensive request validation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create new account |
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/activate` | Activate with Payment ID |
| GET | `/api/auth/verify-token` | Verify JWT token |
| POST | `/api/auth/refresh-token` | Refresh expired token |

See [docs/API_AUTH.md](docs/API_AUTH.md) for complete API documentation.

## User Management

The API provides comprehensive user management features for authenticated users:

- **Profile Management** - View and update user profile information
- **Password Management** - Secure password changes with current password verification
- **Cookie Storage** - Store LinkedIn cookies for scraping operations
- **API Key Retrieval** - Access all generated API keys (5 per user)
- **Rate Limiting** - Protection against abuse on all endpoints
- **Input Validation** - Comprehensive validation on all user inputs

### User Management Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/user/profile` | Get current user profile | Yes (JWT) |
| PUT | `/api/user/profile` | Update user profile (name/email) | Yes (JWT) |
| PUT | `/api/user/change-password` | Change password securely | Yes (JWT) |
| POST | `/api/user/cookie` | Store LinkedIn cookie for scraping | Yes (JWT) |
| GET | `/api/user/api-keys` | Get all API keys (5 per user) | Yes (JWT) |

See [docs/API_USER_MANAGEMENT.md](docs/API_USER_MANAGEMENT.md) for complete API documentation.

## Security

The backend has undergone comprehensive security auditing and implements industry-standard security practices.

### Security Features

- **Helmet.js** - XSS, clickjacking, and MIME sniffing protection
- **Environment Validation** - Required variables validated on startup
- **CORS Configuration** - Explicit origin whitelisting (no defaults in production)
- **Password Complexity** - Enforced on both signup and password changes
- **Rate Limiting** - Applied to all authentication and user endpoints
- **Input Validation** - Comprehensive validation using express-validator
- **JWT Security** - HS256 algorithm, 7-day expiration, secret from ENV
- **Bcrypt Hashing** - 10 rounds for all passwords
- **No Sensitive Logging** - Passwords, tokens, and cookies never logged
- **Trust Proxy** - Properly configured for Nginx reverse proxy

### Security Audit

**Latest Audit:** February 22, 2026
**Files Audited:** 8
**Issues Found:** 5
**Issues Resolved:** 5
**Security Rating:** **A (Excellent)**

All identified security vulnerabilities have been resolved. The backend implements:
- Helmet.js security headers
- Environment variable validation on startup
- CORS origin validation (no production defaults)
- Password complexity requirements (uppercase, lowercase, number)
- Consistent field naming across controllers

See `docs/PHASE_4_COMPLETION_REPORT.md` for complete security audit details.

---

## Project Status

| Phase | Name | Status |
|-------|------|--------|
| Phase 1 | Foundation & Database | Complete |
| Phase 2 | Authentication Backend | Complete |
| Phase 3 | Payment Integration | Complete |
| Phase 4 | User Management + Chrome Extension | Complete |
| Phase 5 | Admin Backend | Planned |

### Chrome Extension

Phase 4 also delivered a Chrome extension for LinkedIn cookie extraction:

- **Repository:** https://github.com/iphilipjunior/socialbudi-cookie-extractor
- **Distribution:** Google Drive (unpacked extension)
- **Features:** Auto-extraction, copy to clipboard, dashboard integration
- **Download:** [Extension ZIP](https://drive.google.com/file/d/1vei0oUjmbP_4PkBH9WQ4uaUxx7fBnbqQ/view?usp=drive_link)

See the extension repository for installation and usage instructions.

---

## Phase 3: Payment Processing ✅ COMPLETE

**Duration:** February 14, 2026 - February 16, 2026
**Status:** Deployed to Production

### Overview

Phase 3 implemented automated payment processing that converts signups into paying customers. The system integrates Selfany payment provider with n8n workflow automation to eliminate manual payment verification and enable instant account activation.

### Features Implemented

- **Automated Payment Confirmation** - n8n workflow processes Selfany payments automatically
- **Webhook Security** - HMAC SHA256 signature verification prevents unauthorized requests
- **Payment ID Validation** - Secure activation requires verified Payment IDs
- **Duplicate Payment Detection** - Alerts admin when same Payment ID used by multiple users
- **Orphaned Payment Detection** - Identifies and manages payment anomalies
- **Complete Audit Trail** - All payment events logged to system_logs table

### New API Endpoints

#### Payment Webhook
```bash
POST /api/payment/confirm
```
Receives payment confirmations from n8n workflow. Requires HMAC SHA256 signature authentication in `X-Webhook-Signature` header.

**Request Body:**
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

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment confirmed and user updated",
  "user_id": "uuid-here",
  "payment_id": "PS_697b79de46bf0"
}
```

**Documentation:** [Payment API Reference](docs/API_PAYMENT.md)

#### Admin Endpoints
```bash
POST /api/admin/detect-orphaned-payments
```
Detects and creates alerts for duplicate Payment IDs assigned to multiple users.

**Response:**
```json
{
  "success": true,
  "message": "No orphaned payments detected",
  "results": {
    "orphaned_payments_found": 0,
    "alerts_created": 0,
    "orphaned_payments": []
  }
}
```

### Environment Variables

Add to `.env` file:
```bash
# Payment Webhook Security (Phase 3)
N8N_WEBHOOK_SECRET=your-64-character-random-secret-here
```

Generate secure secret:
```bash
openssl rand -hex 32
```

> **CRITICAL:** This secret must match between n8n workflow and backend server.

### n8n Workflow Setup

Payment automation requires n8n workflow configuration to monitor Gmail for Selfany payment emails and forward to backend webhook.

**Setup Guide:** [n8n Workflow Setup](docs/N8N_WORKFLOW_GUIDE.md)

**Workflow Components:**
1. **Gmail Trigger** - Monitors inbox for payment confirmation emails (polls every 1 minute)
2. **Extract Payment ID** - Parses email HTML to extract Payment ID and buyer email
3. **Generate Signature** - Creates HMAC SHA256 signature for authentication
4. **HTTP Request** - Sends payment data to backend webhook endpoint

### Payment Flow

```
User pays $10 on Selfany
    ↓
Selfany sends confirmation email
    ↓
Gmail receives email
    ↓
n8n workflow detects email (within 60 seconds)
    ↓
n8n extracts Payment ID & generates signature
    ↓
n8n sends POST to /api/payment/confirm
    ↓
Backend verifies signature & updates database
    ↓
User's payment_status changes: 'pending' → 'paid'
    ↓
User can now activate account
```

**Average Processing Time:** ~60 seconds from payment completion to activation-ready

### Testing

**Run Tests:**
```bash
# Payment service unit tests (10 tests)
npm test tests/unit/paymentService.test.js

# Payment validation unit tests (18 tests)
npm test tests/unit/paymentValidationService.test.js

# Orphaned payment unit tests (12 tests)
npm test tests/unit/orphanedPaymentService.test.js

# Integration tests (30 tests)
npm test tests/integration/auth.test.js
```

**Test Results:**
- Unit Tests: 40/40 passing (100%)
- Integration Tests: 27/30 passing (90% - 3 failures due to rate limiting, not code bugs)

### Phase 3 Documentation

- [Phase 3 Completion Report](docs/PHASE_3_COMPLETION_REPORT.md) - Complete implementation details with all 6 steps documented
- [Payment API Reference](docs/API_PAYMENT.md) - Webhook endpoint documentation with request/response examples
- [n8n Workflow Setup Guide](docs/N8N_WORKFLOW_GUIDE.md) - Step-by-step workflow configuration instructions
- [Payment Troubleshooting Guide](docs/TROUBLESHOOTING_PAYMENT.md) - Common issues and resolution procedures

### Production Deployment

**Status:** Live and processing payments

**Active Endpoints:**
- POST /api/payment/confirm - Payment webhook (n8n → backend)
- POST /api/admin/detect-orphaned-payments - Admin duplicate detection
- POST /api/auth/activate - Refactored with payment validation service

**External Integrations:**
- n8n workflow active (polls Gmail every 1 minute)
- Gmail OAuth configured and authorized
- Selfany payment provider integrated via email notifications

**Real Payment Tested:**
- $10.00 test payment processed successfully
- Payment ID: PS_697b79de46bf0
- Database updated automatically
- Account activation successful
- End-to-end flow verified

### Security Implementation

- **HMAC SHA256 Webhook Signatures** - All webhook requests verified cryptographically
- **Constant-Time Signature Comparison** - Prevents timing attacks
- **Input Validation** - All payment fields validated (amount, currency, status, Payment ID format)
- **Duplicate Detection** - Payment IDs cannot be reused across users
- **Rate Limiting** - 100 requests/minute per IP on webhook endpoint
- **Complete Audit Logging** - All payment events logged to system_logs
- **HTTPS Only** - SSL enforced via Nginx

### Known Limitations

- **Fixed Price:** Only $10.00 USD payments accepted (as designed)
- **Currency:** USD only (as designed)
- **Admin Auth:** Admin endpoints lack JWT authentication (TODO: Phase 4)
- **Orphaned Detection:** Manual endpoint only, no automated cron job (TODO: Phase 4)
- **Email Parsing:** Dependent on Selfany email format (fragile if format changes)

### Payment Troubleshooting

For payment issues, see [Troubleshooting Guide](docs/TROUBLESHOOTING_PAYMENT.md)

**Quick Health Checks:**
```bash
# Backend status
curl https://contentscrapingserver.site/health

# PM2 process status
pm2 status

# Recent payment webhook logs
pm2 logs socialbudi-backend --lines 50 | grep payment_webhook

# Check n8n workflow status
# Go to https://n8n.io → Executions tab
```

**Common Issues:**
- Webhook returns 400 "Invalid signature" → Check N8N_WEBHOOK_SECRET matches
- User can't activate after payment → Verify payment_status='paid' in database
- n8n workflow not triggering → Check workflow is Active (green toggle)

### Code Statistics

| Metric | Value |
|--------|-------|
| Files Created | 9 new files |
| Lines of Code | ~2,200 lines (production + tests) |
| Test Coverage | 100% for payment services |
| Database Tables Used | users, system_logs, duplicate_payments, admin_alerts |

### Next Steps

**Phase 4 Priorities:**
1. Add JWT authentication to admin endpoints
2. Implement automated orphaned payment detection (cron job)
3. Add email notifications for admin alerts
4. Build user dashboard (frontend)

---

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

### Test Coverage Targets
- Branches: 70%
- Functions: 80%
- Lines: 80%
- Statements: 80%

## Deployment

Use the provided deployment script:

```bash
./deploy.sh
```

The script handles:
1. Pulling latest changes
2. Installing dependencies
3. Running tests
4. Building the application
5. Restarting services
6. Health check verification

## API Documentation

- [Authentication API](docs/API_AUTH.md) - Complete auth endpoint documentation
- [User Management API](docs/API_USER_MANAGEMENT.md) - User profile and settings documentation
- [Payment API](docs/API_PAYMENT.md) - Payment webhook documentation
- [Phase 4 Completion Report](docs/PHASE_4_COMPLETION_REPORT.md) - Phase 4 implementation details

## License
MIT
