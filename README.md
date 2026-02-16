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
| `SUPABASE_KEY` | Supabase anon/service key | Yes |
| `JWT_SECRET` | Secret key for JWT signing | Yes |
| `JWT_EXPIRES_IN` | Token expiration (default: 24h) | No |
| `CORS_ORIGIN` | Allowed CORS origin | No |

## Project Structure
```
socialbudi-backend/
├── src/
│   ├── server.js           # Main application entry point
│   ├── config/             # Configuration files
│   │   └── supabase.js     # Supabase client
│   ├── routes/             # API route definitions
│   │   ├── health.js       # Health check endpoint
│   │   └── auth.js         # Authentication routes
│   ├── controllers/        # Request handlers
│   │   └── authController.js
│   ├── middleware/         # Custom middleware
│   │   ├── authMiddleware.js   # JWT verification
│   │   ├── validation.js       # Input validation
│   │   ├── rateLimiter.js      # Rate limiting
│   │   └── errorHandler.js     # Global error handler
│   ├── services/           # Business logic
│   │   └── jwtService.js   # JWT operations
│   └── utils/              # Utility functions
│       ├── logger.js       # Winston logger
│       └── passwordUtils.js # Password hashing
├── tests/
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
├── docs/
│   └── API_AUTH.md         # Authentication API docs
├── .env                    # Environment variables (not committed)
├── .gitignore              # Git ignore rules
├── jest.config.js          # Jest test configuration
└── package.json            # Project dependencies
```

## Authentication

The API implements a complete authentication system with the following features:

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

---

## Phase 3: Payment Processing ✅ COMPLETE

**Duration:** February 14, 2026 - February 16, 2026
**Status:** Deployed to Production

### Features Implemented

- **Automated Payment Confirmation** - n8n workflow processes Selfany payments automatically
- **Webhook Security** - HMAC SHA256 signature verification
- **Payment ID Validation** - Secure activation with verified Payment IDs
- **Duplicate Payment Detection** - Alerts admin when same Payment ID used by multiple users
- **Orphaned Payment Detection** - Identifies and manages payment anomalies
- **Complete Audit Trail** - All payment events logged to system_logs

### New API Endpoints

#### Payment Webhook
```bash
POST /api/payment/confirm
```
Receives payment confirmations from n8n workflow. Requires HMAC SHA256 signature authentication.

**Documentation:** [Payment API Reference](docs/API_PAYMENT.md)

#### Admin Endpoints
```bash
POST /api/admin/detect-orphaned-payments
```
Detects and alerts on duplicate Payment IDs assigned to multiple users.

### Environment Variables

Add to `.env`:
```bash
# Payment Webhook Security
N8N_WEBHOOK_SECRET=your-64-character-random-secret-here
```

Generate secret:
```bash
openssl rand -hex 32
```

### n8n Workflow Setup

Payment automation requires n8n workflow configuration to monitor Gmail for Selfany payment emails.

**Setup Guide:** [n8n Workflow Setup](docs/N8N_WORKFLOW_GUIDE.md)

**Workflow Components:**
1. **Gmail Trigger** - Monitors inbox for payment emails
2. **Extract Payment ID** - Parses email HTML
3. **Generate Signature** - HMAC SHA256 authentication
4. **HTTP Request** - Sends to payment webhook

### Payment Flow

```
User pays $10 → Selfany email → Gmail → n8n → Backend webhook → Database update → User activates account
```

**Processing Time:** ~60 seconds from payment to activation-ready

### Payment Testing

**Unit Tests:**
```bash
# Payment service tests
npm test tests/unit/paymentService.test.js

# Payment validation tests
npm test tests/unit/paymentValidationService.test.js

# Orphaned payment tests
npm test tests/unit/orphanedPaymentService.test.js
```

**Test Results:**
- Unit Tests: 40/40 passing (100%)
- Integration Tests: 27/30 passing (90% - rate limit issues only)

### Phase 3 Documentation

- [Phase 3 Completion Report](docs/PHASE_3_COMPLETION_REPORT.md) - Complete implementation details
- [Payment API Reference](docs/API_PAYMENT.md) - Webhook endpoint documentation
- [n8n Workflow Guide](docs/N8N_WORKFLOW_GUIDE.md) - Step-by-step workflow setup
- [Troubleshooting Guide](docs/TROUBLESHOOTING_PAYMENT.md) - Common issues and solutions

### Production Deployment

**Status:** Live and processing payments

**Endpoints Active:**
- POST /api/payment/confirm (webhook)
- POST /api/admin/detect-orphaned-payments (admin)
- POST /api/auth/activate (refactored with payment validation)

**External Integrations:**
- n8n workflow active and running
- Gmail OAuth configured
- Selfany payment provider integrated

### Security Implementation

- HMAC SHA256 webhook signatures
- Constant-time signature comparison
- Input validation on all payment fields
- Duplicate payment detection
- Rate limiting (100 requests/minute)
- Complete audit logging

### Known Limitations

- Payment amount fixed at $10.00 USD
- Only USD currency supported
- Admin endpoints lack authentication (TODO: Phase 4)
- Manual orphaned payment detection only

### Payment Troubleshooting

For payment issues, see [Troubleshooting Guide](docs/TROUBLESHOOTING_PAYMENT.md)

**Quick Checks:**
```bash
# Backend health
curl https://contentscrapingserver.site/health

# PM2 status
pm2 status

# Recent payment logs
pm2 logs socialbudi-backend | grep payment_webhook

# Check n8n workflow
# Go to n8n.io dashboard → Executions
```

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

## License
MIT
