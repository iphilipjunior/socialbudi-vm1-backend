require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const healthRouter = require('./routes/health');
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

// ─── ENVIRONMENT VALIDATION ──────────────────────────
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'JWT_SECRET'
];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  logger.error('Please check your .env file and ensure all required variables are set');
  process.exit(1);
}
logger.info('Environment validation passed');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - We're behind Nginx
app.set('trust proxy', 1);

// Security headers via Helmet
app.use(helmet());

// ─── CORS ────────────────────────────────────────────
// Allow frontend origin. In production this is the WordPress site.
let CORS_ORIGIN = process.env.CORS_ORIGIN;
if (!CORS_ORIGIN) {
  if (process.env.NODE_ENV === 'production') {
    logger.error('CORS_ORIGIN must be set in production environment');
    process.exit(1);
  } else {
    logger.warn('CORS_ORIGIN not set, defaulting to http://localhost:3000 for development');
    CORS_ORIGIN = 'http://localhost:3000';
  }
}
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ─── BODY PARSING ────────────────────────────────────
app.use(express.json());

// ─── REQUEST LOGGING ─────────────────────────────────
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// ─── ROUTES ──────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

// ─── 404 HANDLER ─────────────────────────────────────
app.use((req, res) => {
  logger.warn(`404 — ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// ─── GLOBAL ERROR HANDLER (must be last) ─────────────
app.use(errorHandler);

// ─── START SERVER ────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`SocialBudi backend running on port ${PORT}`);
  logger.info(`CORS origin: ${CORS_ORIGIN}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
