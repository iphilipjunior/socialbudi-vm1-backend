const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * GET /health
 * Basic health check — confirms server is alive
 */
router.get('/', (req, res) => {
  logger.debug('Health check hit');
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /health/db
 * Deep health check — confirms Supabase connectivity
 */
router.get('/db', async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    // Lightweight query — just count rows in system_logs
    const { data, error } = await supabase.from('system_logs').select('id').limit(1);
    if (error) {
      logger.warn('Health check /db — Supabase query error', { error: error.message });
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'Database unreachable',
        timestamp: new Date().toISOString()
      });
    }
    logger.debug('Health check /db — OK');
    res.status(200).json({
      success: true,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Health check /db — exception', { error: err.message });
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Database check failed',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
