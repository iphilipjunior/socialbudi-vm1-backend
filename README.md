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
