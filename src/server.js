require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const healthRouter = require('./routes/health');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CORS ────────────────────────────────────────────
// Allow frontend origin. In production this is the WordPress site.
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://contentscrapingserver.site';
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
