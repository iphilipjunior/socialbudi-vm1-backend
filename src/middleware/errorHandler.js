const logger = require('../utils/logger');

/**
 * Global error handling middleware for Express
 * Must be the LAST middleware registered in server.js
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function (required signature even if unused)
 */
const errorHandler = (err, req, res, next) => {
  // Log the full error with context
  logger.error(`${err.message} | Route: ${req.method} ${req.originalUrl}`, {
    stack: err.stack,
    body: req.body
  });

  // Don't expose internal errors in production
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = errorHandler;
